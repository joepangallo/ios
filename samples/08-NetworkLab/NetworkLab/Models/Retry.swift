// Retry.swift
// Who: Lesson 8.5's retry, idempotency and retry-lab cards, and their tests.
// What: the course's flaky server and withRetry helper (with the sleep and the
//       log injected, so tests never really wait), the backoff schedule, the
//       decision whether an error is worth retrying, jitter, the course's
//       PendingOrder with its idempotency key, a pretend order desk that honors
//       that key, and the retry-storm simulation behind the retry lab.
// Where: the Models folder; nothing here touches the real network.
// When: when the student runs a retry demo, and when the tests run.
// Why: retry logic is easy to get subtly wrong; keeping it pure means every
//      rule in the lesson can be checked exactly and instantly.

import Foundation // URLRequest, JSONEncoder, UUID and URLError.

/// A stand-in for a network timeout, from the course.
enum FetchError: Error { case timedOut } // A tiny custom error keeps the example runnable without a network.

/// A pretend server that fails its first calls, then succeeds. The course's FlakyServer.
actor FlakyServer { // An actor: only one task at a time can touch its state.
    private var calls = 0 // How many times fetch has been called.
    private let failures: Int // How many calls fail before the server recovers.

    /// Creates a server that fails `failures` times. The course's server fails twice.
    init(failures: Int = 2) { self.failures = failures } // 2 matches the course's `calls < 3`.

    /// The fake request: throws on the early calls, then returns a success string.
    func fetch() throws -> String { // Callers outside the actor must await it.
        calls += 1 // Records one more attempt.
        if calls <= failures { throw FetchError.timedOut } // Fails while the server is "overloaded".
        return "200 OK on call \(calls)" // Shows how many attempts it took.
    }

    /// How many calls have been made, for the demo's summary.
    var callCount: Int { calls } // Read-only from outside.
}

/// Retries an operation with exponential backoff: 200, 400, 800 ms.
/// The course's withRetry, with three seams: which errors to retry, how to sleep and where to log.
/// The real app sleeps with Task.sleep and logs to the screen; tests record instead of waiting.
func withRetry<T>(attempts: Int, // The total number of tries, including the first.
                  shouldRetry: (any Error) -> Bool = { _ in true }, // The course retries every error.
                  jitter: ((Int) -> Int)? = nil, // Optional: picks the real wait from the planned one.
                  sleep: (Duration) async throws -> Void = { try await Task.sleep(for: $0) }, // Waits without blocking a thread.
                  log: (String) -> Void, // Where the "Attempt n failed" lines go.
                  _ operation: () async throws -> T) async throws -> T { // The work, passed as a closure so it can run again.
    var delay = 200 // The first wait, in milliseconds.
    for attempt in 1..<max(attempts, 1) { // Every attempt except the last; max(_, 1) keeps the range valid.
        do { return try await operation() } catch { // Success returns at once; failure falls into catch.
            guard shouldRetry(error) else { throw error } // Errors that retrying cannot fix go straight to the caller.
            let wait = jitter?(delay) ?? delay // With jitter, a random wait up to the planned one.
            log("Attempt \(attempt) failed; retry in \(wait) ms") // Makes the retries visible.
            try await sleep(.milliseconds(wait)) // Suspends; throws if the task is cancelled.
            delay *= 2 // The exponential part: 200, 400, 800.
        }
    }
    return try await operation() // The final attempt: its error, if any, reaches the caller.
}

/// The planned waits and the retry rules, as pure values.
enum Backoff { // A namespace for the schedule and the decision.
    /// The planned waits before each retry, in milliseconds: 200, 400, 800 for four attempts.
    static func schedule(attempts: Int, base: Int = 200) -> [Int] { // One wait between each pair of attempts.
        guard attempts > 1 else { return [] } // One attempt never waits.
        return (0..<(attempts - 1)).map { base << $0 } // base times 2 to the power n: << shifts left, doubling each step.
    }

    /// Full jitter: a random wait between 0 and the planned delay, so phones spread out.
    static func jittered(_ delay: Int, random: (ClosedRange<Int>) -> Int = { Int.random(in: $0) }) -> Int { // random is injectable for tests.
        random(0...max(delay, 0)) // Never negative.
    }

    /// Whether a failed request should be retried automatically.
    /// Retry only idempotent methods, or a POST that carries an idempotency key,
    /// and only for failures that a later attempt could fix.
    static func shouldRetry(_ error: any Error, method: HTTPMethod, hasIdempotencyKey: Bool = false) -> Bool { // The lesson's rules in one place.
        if error is CancellationError { return false } // The app stopped the work on purpose.
        guard method.isIdempotent || hasIdempotencyKey else { return false } // Never blindly retry POST or PATCH.
        if let urlError = error as? URLError { // Transport failures.
            switch urlError.code { // Only the temporary ones are worth another try.
            case .timedOut, .networkConnectionLost, .cannotConnectToHost, .cannotFindHost: return true // Often fixed a moment later.
            default: return false // Offline, cancelled, untrusted certificate: retrying will not help now.
            }
        }
        if case APIError.badStatus(let code) = error { return StatusFamily.isWorthRetrying(code) } // 5xx, 408 and 429 only.
        if error is FetchError { return true } // The course's stand-in for a timeout.
        return false // DecodingError and everything else: report it instead.
    }
}

/// An order waiting to be sent, including its retry key. The course's PendingOrder.
struct PendingOrder: Codable { // Codable both ways, so it can be saved to disk and reloaded after a crash.
    let items: [String] // The product ids the user is buying.
    var idempotencyKey = UUID().uuidString // Created once, with the order, and reused for every retry.
}

/// Builds the POST request for a pending order without sending it. The course's createOrderRequest.
func createOrderRequest(_ order: PendingOrder) throws -> URLRequest { // Called on every attempt.
    let url = URL(string: "https://api.example.com/orders")! // An example address: this app never sends it.
    var request = URLRequest(url: url) // Defaults: GET, no headers, no body.
    request.httpMethod = "POST" // The method that is unsafe to retry, which is why the key is needed.
    request.setValue("application/json", // The body is JSON...
                     forHTTPHeaderField: "Content-Type") // ...so the server knows how to parse it.
    request.setValue(order.idempotencyKey, // The order's unique key...
                     forHTTPHeaderField: "Idempotency-Key") // ...in the header servers recognize.
    request.httpBody = try JSONEncoder().encode(order) // The key travels in the body too.
    return request // A value: the retry helper can send it as many times as needed.
}

/// A pretend order server that honors the Idempotency-Key header, for the demo and the tests.
actor OrderDesk { // An actor, because several attempts could arrive at once.
    private var ordersByKey: [String: Int] = [:] // Which order number each key created.
    private(set) var ordersCreated = 0 // How many real orders exist.

    /// Handles one POST: a new key creates an order; a key seen before replays the first result.
    func receive(_ request: URLRequest) -> (orderNumber: Int, replayed: Bool) { // What the server would answer.
        let key = request.value(forHTTPHeaderField: "Idempotency-Key") ?? UUID().uuidString // No key: every request looks new.
        if let existing = ordersByKey[key] { return (existing, true) } // Seen before: same answer, no new order.
        ordersCreated += 1 // A brand-new order.
        ordersByKey[key] = ordersCreated // Remembers the key with its order number.
        return (ordersCreated, false) // The first result for this key.
    }
}

/// Places one order whose first replies are lost, retrying `attempts` times in total.
/// With `reuseKey` the same PendingOrder (and key) is sent each time; without it,
/// each attempt makes a new PendingOrder, the mistake the course's Try It describes.
func placeOrderLosingReplies(reuseKey: Bool, attempts: Int, desk: OrderDesk) async throws -> [String] { // Returns the log.
    var log: [String] = [] // One line per attempt.
    let stored = PendingOrder(items: ["notebook", "pencil"]) // Created once, when the user taps Place Order.
    for attempt in 1...max(attempts, 1) { // Every attempt, including the first.
        let order = reuseKey ? stored : PendingOrder(items: stored.items) // The mistake makes a new key each time.
        let request = try createOrderRequest(order) // Built from the order: same key means same request.
        let (number, replayed) = await desk.receive(request) // The server handles it.
        let key = String(order.idempotencyKey.prefix(8)) // A short form of the key for the log.
        let lost = attempt < attempts ? " (reply lost)" : "" // Every reply but the last never reaches the phone.
        log.append("Attempt \(attempt), key \(key): order #\(number)\(replayed ? " replayed" : " created")\(lost)") // One readable line.
    }
    log.append("Orders created on the server: \(await desk.ordersCreated)") // The number that matters.
    return log // Everything that happened, in order.
}

/// The four strategies the retry lab compares.
enum RetryStrategy: String, CaseIterable, Identifiable { // CaseIterable feeds the picker.
    case none = "No retries" // Fail once, give up.
    case immediate = "Immediate" // Retry in the very next moment.
    case backoff = "Backoff" // Wait 200, 400, 800 ms...
    case backoffJitter = "Backoff + jitter" // Wait a random time up to the backoff.
    var id: String { rawValue } // The label doubles as the identity.

    /// A label short enough for a segmented picker on a phone.
    var shortName: String { // One word each.
        switch self { // One label per strategy.
        case .none: "None" // No retries.
        case .immediate: "Immediate" // Retry at once.
        case .backoff: "Backoff" // Exponential waits.
        case .backoffJitter: "Jitter" // Backoff plus randomness.
        }
    }
}

/// The outcome of one retry-storm simulation.
struct RetryStormResult: Equatable { // Equatable so tests can compare runs.
    var loadPerSlot: [Int] // Requests that reached the server in each 100 ms slot.
    var succeeded = 0 // Phones that got an answer.
    var gaveUp = 0 // Phones that ran out of attempts or never retried.
    var wasted = 0 // Requests the server rejected because it was over capacity.
    var peak: Int { loadPerSlot.max() ?? 0 } // The busiest slot.
}

/// A tiny random number generator that always produces the same sequence for the same seed.
struct SeededGenerator: RandomNumberGenerator { // Deterministic, so tests and screenshots repeat exactly.
    private var state: UInt64 // The generator's memory.
    init(seed: UInt64) { state = seed } // The seed picks which sequence you get.
    mutating func next() -> UInt64 { // SplitMix64: a well-known simple generator.
        state &+= 0x9E37_79B9_7F4A_7C15 // &+= adds and wraps around instead of overflowing.
        var z = state // Mixes the bits below.
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9 // Shift, xor, multiply.
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB // Again, with other constants.
        return z ^ (z >> 31) // The final mix is the next number.
    }
}

/// Simulates `clients` phones that all hit a server the moment it recovers.
/// Each 100 ms slot the server answers at most `capacity` requests; the rest fail
/// and each phone retries according to the strategy, up to `maxAttempts` tries.
func simulateRetryStorm(strategy: RetryStrategy, clients: Int = 200, capacity: Int = 40, // The scenario's size.
                        slots: Int = 40, maxAttempts: Int = 6, seed: UInt64 = 7) -> RetryStormResult { // How long and how many tries.
    var random = SeededGenerator(seed: seed) // Same seed, same run.
    var result = RetryStormResult(loadPerSlot: Array(repeating: 0, count: slots)) // Starts empty.
    var due: [Int: [(client: Int, attempt: Int)]] = [0: (0..<clients).map { ($0, 1) }] // Every phone sends at slot 0.
    for slot in 0..<slots { // Time moves forward one slot at a time.
        var arriving = due[slot] ?? [] // The requests that arrive now.
        arriving.shuffle(using: &random) // The server sees them in a random order.
        result.loadPerSlot[slot] = arriving.count // Records the load.
        for (index, request) in arriving.enumerated() { // Each request in turn.
            if index < capacity { result.succeeded += 1; continue } // Within capacity: answered.
            result.wasted += 1 // Over capacity: rejected, so the request was wasted.
            guard strategy != .none, request.attempt < maxAttempts else { result.gaveUp += 1; continue } // No more tries.
            let planned = 2 << (request.attempt - 1) // Backoff in slots: 2, 4, 8, 16 (200, 400, 800, 1600 ms).
            let wait = switch strategy { // How many slots this phone waits.
            case .immediate: 1 // The very next slot.
            case .backoff: planned // Everyone who failed together comes back together.
            case .backoffJitter: Int.random(in: 1...planned, using: &random) // Spread out at random.
            case .none: 0 // Never reached: the guard above already gave up.
            }
            let next = slot + wait // The slot of the next try.
            if next < slots { due[next, default: []].append((request.client, request.attempt + 1)) } // Schedules the retry.
            else { result.gaveUp += 1 } // Past the end of the simulation: counted as giving up.
        }
    }
    return result // The whole run.
}

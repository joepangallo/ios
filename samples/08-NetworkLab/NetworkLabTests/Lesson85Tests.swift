// Lesson85Tests.swift
// Who: the Swift Testing runner.
// What: checks lesson 8.5: every branch of userMessage(for:), the course's
//       retry output with an injected sleeper (no real waiting), the backoff
//       schedule, jitter and the retry decision, the idempotency key and the
//       order server that honors it, the retry-storm lab, the token store and
//       authorized(_:), pinning, and the constant found in the app's binary.
// Where: the NetworkLabTests target. The only Keychain test uses this app's
//        own Keychain with a service name used by no other code, and cleans up.
// When: only when tests run.
// Why: retry and security logic is easy to get subtly wrong; pure seams let
//      every rule be checked exactly and instantly.

import Testing // @Test, #expect and #require.
import Foundation // URLError, URLRequest and Data.
@testable import NetworkLab // The app's internal types.

@MainActor // The app's types are main-actor isolated.
struct Lesson85Tests { // Errors, Retries and Security.
    @Test(arguments: [ // Every branch of the course's function.
        (URLError(.notConnectedToInternet) as any Error, "You appear to be offline." as String?), // Offline.
        (URLError(.networkConnectionLost), "You appear to be offline."), // Dropped mid-request.
        (URLError(.timedOut), "The server took too long to answer."), // Timeout.
        (URLError(.cannotFindHost), "The server cannot be reached right now."), // DNS.
        (URLError(.cannotConnectToHost), "The server cannot be reached right now."), // Refused.
        (URLError(.serverCertificateUntrusted), "A network problem stopped the request."), // The default branch.
        (URLError(.cancelled), nil), // URLSession's cancellation.
        (CancellationError(), nil), // Swift's cancellation.
        (APIError.badStatus(500), "Something went wrong. Please try again."), // The fallback.
    ])
    func userMessageCoversEveryBranch(error: any Error, expected: String?) { // One check per row.
        #expect(userMessage(for: error) == expected) // The exact sentence, or nil.
    }

    @Test func userMessageForDecodingErrors() { // The bad-data branch.
        let error = DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: "bad")) // Any DecodingError.
        #expect(userMessage(for: error) == "The server sent data this app cannot read.") // Honest wording.
    }

    // withRetry runs its closures on whatever executor it chooses, so the tests hand it
    // @Sendable closures that capture only Sendable values: an actor and a Collector.

    @Test func retryWithBackoffPrintsTheCourseOutput() async throws { // expect: 'Attempt 1 failed; retry in 200 ms\nAttempt 2 failed; retry in 400 ms\n200 OK on call 3'
        let logged = Collector<String>() // The log lines, collected safely.
        let sleeper = RecordingSleeper() // Records waits instead of waiting.
        let server = FlakyServer() // Fails twice, like the course's.
        let result = try await withRetry(attempts: 4, sleep: sleeper.sleep, log: { @Sendable line in logged.append(line) }) { @Sendable in try await server.fetch() } // The course's call.
        var out = Transcript() // The program's console.
        for line in logged.items { out.print(line) } // What withRetry printed...
        out.print(result) // ...then print(try await withRetry(...)).
        #expect(out.lines == ["Attempt 1 failed; retry in 200 ms", "Attempt 2 failed; retry in 400 ms", "200 OK on call 3"]) // Line for line.
        #expect(sleeper.waits == [.milliseconds(200), .milliseconds(400)]) // The delay schedule, with no real waiting.
    }

    @Test func retryGivesUpAfterTheLastAttempt() async { // Try It: calls < 5 with attempts: 4.
        let sleeper = RecordingSleeper() // No real waits.
        let server = FlakyServer(failures: 4) // Fails four times.
        await #expect(throws: FetchError.self) { // The final attempt's error reaches the caller.
            _ = try await withRetry(attempts: 4, sleep: sleeper.sleep, log: { @Sendable _ in }) { @Sendable in try await server.fetch() } // Four tries.
        }
        #expect(await server.callCount == 4) // Exactly four calls: retrying always ends.
        #expect(sleeper.waits == [.milliseconds(200), .milliseconds(400), .milliseconds(800)]) // 200, 400, 800.
    }

    @Test func retryStopsAtOnceForErrorsNotWorthRetrying() async { // shouldRetry says no.
        let sleeper = RecordingSleeper() // Should stay empty.
        let calls = Collector<Int>() // One entry per attempt.
        await #expect(throws: APIError.badStatus(404)) { // A 404 will not get better.
            _ = try await withRetry(attempts: 4, shouldRetry: { @Sendable _ in false }, sleep: sleeper.sleep, log: { @Sendable _ in }) { @Sendable () async throws -> Int in // A rule that says no, as Backoff.shouldRetry does for a 404 (checked in retryDecisionFollowsTheLesson).
                calls.append(1) // One more attempt.
                throw APIError.badStatus(404) // Always 404.
            }
        }
        #expect(calls.items.count == 1) // No retries.
        #expect(sleeper.waits.isEmpty) // No waits.
    }

    @Test func retryUsesJitterWhenGiven() async throws { // Random waits up to the planned delay.
        let logged = Collector<String>() // The log lines.
        let sleeper = RecordingSleeper() // Records waits.
        let server = FlakyServer(failures: 1) // Fails once.
        _ = try await withRetry(attempts: 3, jitter: { @Sendable delay in delay / 2 }, sleep: sleeper.sleep, log: { @Sendable line in logged.append(line) }) { @Sendable in try await server.fetch() } // A predictable "random" half.
        #expect(logged.items == ["Attempt 1 failed; retry in 100 ms"]) // Half of 200.
        #expect(sleeper.waits == [.milliseconds(100)]) // The jittered wait.
    }

    @Test func zeroAttemptsStillTriesOnce() async throws { // The max(_, 1) guard.
        let result = try await withRetry(attempts: 0, log: { @Sendable _ in }) { @Sendable in "ok" } // No crash on an empty range.
        #expect(result == "ok") // The operation ran.
    }

    @Test func backoffScheduleAndJitter() { // Pure helpers.
        #expect(Backoff.schedule(attempts: 4) == [200, 400, 800]) // The course's 200, 400, 800.
        #expect(Backoff.schedule(attempts: 1) == []) // One attempt never waits.
        #expect(Backoff.schedule(attempts: 3, base: 100) == [100, 200]) // Another base.
        #expect(Backoff.jittered(400) { $0.upperBound } == 400) // The top of the range is the planned delay.
        #expect(Backoff.jittered(400) { $0.lowerBound } == 0) // The bottom is zero.
        #expect((0..<50).allSatisfy { _ in (0...800).contains(Backoff.jittered(800)) }) // Real randomness stays in range.
    }

    @Test func retryDecisionFollowsTheLesson() { // Retry only what is safe and temporary.
        #expect(Backoff.shouldRetry(URLError(.timedOut), method: .get)) // Temporary, idempotent.
        #expect(Backoff.shouldRetry(APIError.badStatus(503), method: .put)) // Temporary server trouble.
        #expect(!Backoff.shouldRetry(URLError(.timedOut), method: .post)) // Never blindly retry a POST...
        #expect(Backoff.shouldRetry(URLError(.timedOut), method: .post, hasIdempotencyKey: true)) // ...unless it carries a key.
        #expect(!Backoff.shouldRetry(URLError(.notConnectedToInternet), method: .get)) // Offline: show the message instead.
        #expect(!Backoff.shouldRetry(APIError.badStatus(404), method: .get)) // Will fail the same way again.
        #expect(!Backoff.shouldRetry(DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: "")), method: .get)) // Bad data.
        #expect(!Backoff.shouldRetry(CancellationError(), method: .get)) // On purpose.
        #expect(Backoff.shouldRetry(FetchError.timedOut, method: .get)) // The course's stand-in.
        #expect(!Backoff.shouldRetry(URLError(.timedOut), method: .patch)) // PATCH is not idempotent.
    }

    @Test func createOrderRequestCarriesTheStoredKey() throws { // The course's builder.
        let order = PendingOrder(items: ["a"]) // The key is made once, here.
        let first = try createOrderRequest(order) // Attempt 1.
        let second = try createOrderRequest(order) // Attempt 2.
        #expect(first.httpMethod == "POST") // The unsafe method.
        #expect(first.url?.absoluteString == "https://api.example.com/orders") // Never sent by the app.
        #expect(first.value(forHTTPHeaderField: "Content-Type") == "application/json") // JSON body.
        #expect(first.value(forHTTPHeaderField: "Idempotency-Key") == order.idempotencyKey) // The stored key.
        #expect(second.value(forHTTPHeaderField: "Idempotency-Key") == first.value(forHTTPHeaderField: "Idempotency-Key")) // Same key on every attempt.
        let decoded = try JSONDecoder().decode(PendingOrder.self, from: try #require(first.httpBody)) // The body round-trips.
        #expect(decoded.idempotencyKey == order.idempotencyKey) // The key travels in the body too.
        #expect(PendingOrder(items: ["a"]).idempotencyKey != order.idempotencyKey) // A new order gets a new key.
    }

    @Test func orderDeskReplaysARepeatedKey() async throws { // The pretend server.
        let desk = OrderDesk() // Empty.
        let request = try createOrderRequest(PendingOrder(items: ["a"])) // One order.
        let first = await desk.receive(request) // Creates order 1.
        let again = await desk.receive(request) // The same key again.
        #expect(first.orderNumber == 1 && !first.replayed) // Created.
        #expect(again.orderNumber == 1 && again.replayed) // Replayed, not created.
        #expect(await desk.ordersCreated == 1) // Still one order.
    }

    @Test func reusingTheKeyCreatesOneOrderAndANewKeyCreatesThree() async throws { // The card's two runs.
        let safe = try await placeOrderLosingReplies(reuseKey: true, attempts: 3, desk: OrderDesk()) // The right way.
        let unsafe = try await placeOrderLosingReplies(reuseKey: false, attempts: 3, desk: OrderDesk()) // The Try It's mistake.
        #expect(safe.last == "Orders created on the server: 1") // One order.
        #expect(unsafe.last == "Orders created on the server: 3") // Three orders for one tap.
        #expect(safe[1].contains("replayed")) // The retry was recognized.
        #expect(safe[0].hasSuffix("(reply lost)")) // The story of the first attempt.
    }

    @Test func retryStormKeepsItsBooksBalanced() { // Every phone and every request is accounted for.
        for strategy in RetryStrategy.allCases { // All four strategies.
            let run = simulateRetryStorm(strategy: strategy) // 200 phones, capacity 40.
            #expect(run.succeeded + run.gaveUp == 200) // Every phone ends one way or the other.
            #expect(run.loadPerSlot.reduce(0, +) == run.succeeded + run.wasted) // Every request was answered or rejected.
            #expect(run.loadPerSlot.first == 200) // Everyone arrives at once.
            #expect(run == simulateRetryStorm(strategy: strategy)) // Deterministic: same seed, same run.
        }
    }

    @Test func retryStormComparesTheStrategies() { // The lab's lessons.
        let none = simulateRetryStorm(strategy: .none) // No retries.
        let immediate = simulateRetryStorm(strategy: .immediate) // Lockstep, no waiting.
        let backoff = simulateRetryStorm(strategy: .backoff) // Lockstep, with waiting.
        let jitter = simulateRetryStorm(strategy: .backoffJitter) // Spread out.
        #expect(none.succeeded == 40) // Only the first 40 get through.
        #expect(none.gaveUp == 160) // Everyone else gives up at once.
        #expect(immediate.loadPerSlot[1] == 160) // The failures all come straight back.
        #expect(backoff.loadPerSlot[2] == 160) // Backoff alone: they all come back together, two slots later.
        #expect((jitter.loadPerSlot.dropFirst().max() ?? 0) < (backoff.loadPerSlot.dropFirst().max() ?? 0)) // Jitter flattens the spikes.
        #expect(jitter.wasted < immediate.wasted) // And wastes fewer requests.
    }

    @Test func seededGeneratorRepeats() { // The lab's randomness.
        var a = SeededGenerator(seed: 1) // Two generators...
        var b = SeededGenerator(seed: 1) // ...with the same seed.
        #expect((0..<5).map { _ in a.next() } == (0..<5).map { _ in b.next() }) // Produce the same sequence.
        var c = SeededGenerator(seed: 2) // A different seed.
        #expect(a.next() != c.next()) // Produces a different sequence.
    }

    @Test func authorizedAddsTheBearerHeaderOnlyWithAToken() throws { // The course's authorized(_:), with a stand-in store.
        let store = InMemoryStore() // Never touches the Keychain.
        let plain = URLRequest(url: Placeholder.url("todos/1")) // A request to authorize.
        #expect(authorized(plain, using: store).value(forHTTPHeaderField: "Authorization") == nil) // Nobody signed in: no header.
        try store.save("demo-123") // A made-up token.
        let signed = authorized(plain, using: store) // Now with a token.
        #expect(signed.value(forHTTPHeaderField: "Authorization") == "Bearer demo-123") // The standard scheme.
        #expect(plain.value(forHTTPHeaderField: "Authorization") == nil) // The original is untouched: a value type.
        store.delete() // Signs out.
        #expect(store.savedToken() == nil) // Gone.
    }

    @Test func keychainStoreRoundTripsInThisAppsOwnKeychain() throws { // The real Keychain, isolated by a unique service.
        let store = KeychainStore(service: "com.example.NetworkLab.tests.\(UUID().uuidString)", account: "session-token") // A service no other code uses.
        defer { store.delete() } // Always cleans up.
        #expect(store.savedToken() == nil) // Starts empty.
        try store.save("first") // SecItemAdd.
        try store.save("second") // Replaces, without a duplicate-item error.
        #expect(store.savedToken() == "second") // SecItemCopyMatching.
        store.delete() // SecItemDelete.
        #expect(store.savedToken() == nil) // Gone.
    }

    @Test func keychainErrorsHaveReadableMessages() { // Apple's text for a status code.
        #expect(!KeychainError(status: errSecDuplicateItem).message.isEmpty) // Some description.
    }

    @Test func pinningRules() { // PinCheck.
        #expect(PinCheck.allows(observed: "abc", pins: [])) // Pinning off.
        #expect(PinCheck.allows(observed: "abc", pins: ["abc", "def"])) // A match.
        #expect(!PinCheck.allows(observed: "xyz", pins: ["abc"])) // No match: refuse.
        #expect(!PinCheck.allows(observed: nil, pins: ["abc"])) // No key to compare: refuse.
        #expect(PinCheck.sha256Hex(Data("abc".utf8)) == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad") // The standard test vector.
    }

    @Test func theShippedConstantIsReadableInTheAppBinary() throws { // Never ship a secret.
        let found = try #require(findInAppBinary(ShippedConstant.demoKey)) // The attacker's search.
        #expect(found.offset > 0) // Somewhere inside the file.
        #expect(findInAppBinary("this text is nowhere in the app 0xDEADBEEF") == nil) // A string that was never compiled in.
    }
}

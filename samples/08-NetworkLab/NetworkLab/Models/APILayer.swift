// APILayer.swift
// Who: Lesson 8.7's screen and its unit tests.
// What: the service protocol, its live URLSession implementation and a sample
//       stand-in, the paginating list model, the course's caching session and
//       offline-first request, a probe that reports where an answer came from,
//       a clock-driven HTTP cache simulator, and the two-request REST fetch the
//       GraphQL card compares against.
// Where: the Models folder: below the views, above URLSession.
// When: whenever the list asks for a page, the cache demo fetches, or a test runs.
// Why: a model that receives its service through init (dependency injection)
//      can be tested and previewed without a network, which is the main idea of
//      Designing the API Layer.

import Foundation // URLSession, URLCache, URLComponents and JSONDecoder.
import Observation // @Observable for the list model.

/// The contract every to-do source must meet: a page of to-dos, however it is fetched.
protocol TodoService: Sendable { // Sendable: values can be shared across concurrent tasks.
    func todos(page: Int) async throws -> [Todo] // Says nothing about URLs or JSON.
}

/// The real implementation, backed by JSONPlaceholder's paging parameters.
struct LiveTodoService: TodoService { // Only Sendable properties, so it is Sendable automatically.
    var session = URLSession.shared // Injectable, for caching or timeouts.
    var pageSize = 20 // Enough to fill a screen, small enough to arrive quickly.

    /// The URL of one page, for example /todos?_page=2&_limit=20.
    func url(for page: Int) -> URL { // Separate so the screen and the tests can show it.
        var parts = URLComponents( // Starts from the collection URL...
            string: "https://jsonplaceholder.typicode.com/todos")! // ...a constant string, safe to force-unwrap.
        parts.queryItems = [ // Paging belongs in the query, not the path.
            URLQueryItem(name: "_page", value: String(page)), // Which page, starting at 1.
            URLQueryItem(name: "_limit", value: String(pageSize)), // How many items per page.
        ]
        return parts.url! // Valid parts always form a URL.
    }

    /// Fetches one page: the protocol's requirement.
    func todos(page: Int) async throws -> [Todo] { // The exact signature from the protocol.
        let (data, response) = try await session.data(from: url(for: page)) // Same pattern as every earlier fetch.
        try validate(response) // Throws unless the status is 2xx.
        return try JSONDecoder().decode([Todo].self, from: data) // A JSON array becomes [Todo].
    }
}

/// A stand-in service with fixed pages, for previews and the "inject the stub" switch.
/// The unit tests declare the course's own StubTodoService.
struct SampleTodoService: TodoService { // Meets the same contract as the live one.
    let pages: [[Todo]] // The pages to return, in order.

    /// Returns the requested page from memory, or an empty array past the end.
    func todos(page: Int) async throws -> [Todo] { // async throws to match the protocol, though it never waits or fails.
        page >= 1 && page <= pages.count ? pages[page - 1] : [] // An empty page signals the end, as the real API does.
    }

    /// Three pages of five made-up to-dos.
    static let threePages = SampleTodoService(pages: (0..<3).map { page in // page is 0, 1, 2.
        (1...5).map { n in Todo(userId: 1, id: page * 5 + n, title: "Stub to-do \(page * 5 + n)", completed: n.isMultiple(of: 2)) } // Five per page.
    })
}

/// The list screen's model: it loads pages as the list scrolls. The course's TodoListModel,
/// plus an error message so the screen can offer Retry when a page fails.
@MainActor // The list reads todos on the main thread, so writes happen there too.
@Observable // Views redraw when todos, isLoading or the message change.
final class TodoListModel { // One object owns the pages loaded so far.
    private(set) var todos: [Todo] = [] // Every item loaded so far.
    private(set) var isLoading = false // True while a page request is in flight.
    private(set) var hasMore = true // False once an empty page arrives.
    private(set) var errorMessage: String? // Why the last page failed; nil when it did not.
    private(set) var requestedPages: [Int] = [] // Every page asked for, for the screen's log.
    private var nextPage = 1 // Page numbers in this API start at 1.
    private let service: any TodoService // Live or stub: the model never knows which.

    init(service: any TodoService) { self.service = service } // Dependency injection: the caller decides.

    /// Fetches one more page. It does not throw; a failure leaves the list as it was.
    func loadNextPage() async { // Called when the last row appears.
        guard !isLoading, hasMore else { return } // A load is running, or nothing is left.
        isLoading = true // Set before the await, so a second call is rejected by the guard.
        defer { isLoading = false } // Reset however the method exits.
        errorMessage = nil // A new attempt clears the old message.
        requestedPages.append(nextPage) // Records the request.
        let page: [Todo] // Assigned below if the fetch works.
        do { // The course writes `guard let page = try? await ...`; we keep the error to show it.
            page = try await service.todos(page: nextPage) // Live or stub.
        } catch { // Offline, timeout, bad status or bad JSON.
            errorMessage = userMessage(for: error) // A sentence for the screen; nil for cancellation.
            return // nextPage is untouched, so the same page is requested next time.
        }
        todos += page // Appends the new items.
        hasMore = !page.isEmpty // An empty page means the end was reached.
        nextPage += 1 // Only advances on success, so a failed page is retried, not skipped.
    }
}

/// A session with a larger cache and shorter timeout. The course's makeCachingSession().
func makeCachingSession() -> URLSession { // Called once; the session is then reused.
    let config = URLSessionConfiguration.default // default stores the cache on disk; ephemeral would not.
    config.urlCache = URLCache(memoryCapacity: 10_000_000, // 10 MB in memory: the fastest hits...
                               diskCapacity: 100_000_000) // ...and 100 MB on disk, which survives restarts.
    config.requestCachePolicy = .useProtocolCachePolicy // Follows Cache-Control and ETag (already the default).
    config.timeoutIntervalForRequest = 20 // Fails after 20 seconds of silence instead of 60.
    config.waitsForConnectivity = true // Waits for a network instead of failing at once when offline.
    return URLSession(configuration: config) // The configuration is copied into the session.
}

/// A request that uses any cached copy, however old. The course's offlineFirstRequest(for:).
func offlineFirstRequest(for url: URL) -> URLRequest { // For screens where showing something beats showing nothing.
    var request = URLRequest(url: url) // Default settings.
    request.cachePolicy = .returnCacheDataElseLoad // Cached copy if any; the network only if none.
    return request // The caller sends it with any session.
}

/// The cache policies the caching card offers.
enum CachePolicyChoice: String, CaseIterable, Identifiable { // The raw value labels the button.
    case protocolPolicy = "Follow the server's rules" // .useProtocolCachePolicy
    case offlineFirst = "Offline first" // .returnCacheDataElseLoad
    case reload = "Pull to refresh" // .reloadIgnoringLocalCacheData
    var id: String { rawValue } // The label doubles as the identity.

    /// The URLRequest policy this choice stands for.
    var policy: URLRequest.CachePolicy { // Used when building the request.
        switch self { // One policy per choice.
        case .protocolPolicy: .useProtocolCachePolicy // Fresh copy from cache, stale copy revalidated.
        case .offlineFirst: .returnCacheDataElseLoad // Any cached copy.
        case .reload: .reloadIgnoringLocalCacheData // Always the network.
        }
    }
}

/// What one cached fetch showed: where the answer came from, and the caching headers.
struct CacheProbeResult: Equatable { // Shown as rows on the caching card.
    var sources: [String] // One entry per transaction, for example ["local cache", "network"].
    var status: Int // The status code your code received.
    var cacheControl: String? // The Cache-Control header.
    var etag: String? // The ETag header.

    /// The sources in one plain sentence.
    var summary: String { Self.summary(of: sources) } // Shown in bold on the card.

    /// Explains a list of transaction sources.
    static func summary(of sources: [String]) -> String { // Pure, so tests can check every case.
        switch sources { // The patterns URLSession produces.
        case ["local cache"]: "Answered from the local cache. No network was used." // A fresh hit.
        case ["local cache", "network"]: "Revalidated: the cached copy was checked with the server, which confirmed or replaced it." // A conditional request.
        case ["network"]: "Downloaded from the network." // A miss or a forced reload.
        default: "Transactions: " + sources.joined(separator: ", ") // Anything else, listed.
        }
    }
}

/// Fetches a URL with a cache policy and reports where the answer came from.
func probeCache(_ url: URL, policy: URLRequest.CachePolicy, session: URLSession) async throws -> CacheProbeResult { // The caching card's live button.
    var request = URLRequest(url: url) // Default settings...
    request.cachePolicy = policy // ...with the chosen policy.
    let logger = JourneyLogger() // Lesson 8.1's metrics delegate also reports the fetch type.
    let (_, response) = try await session.data(for: request, delegate: logger) // Sends, or answers from the cache.
    let http = response as? HTTPURLResponse // Headers live on the HTTP response.
    return CacheProbeResult( // Packs the facts.
        sources: await logger.latestReport()?.fetchSources ?? ["unknown"], // Where each transaction came from.
        status: http?.statusCode ?? 0, // URLSession turns a 304 into the cached 200.
        cacheControl: http?.value(forHTTPHeaderField: "Cache-Control"), // How long it may be reused.
        etag: http?.value(forHTTPHeaderField: "ETag")) // The version label.
}

/// A clock-driven model of HTTP caching, like the course's cache lab. No network, no waiting.
struct CacheSimulator: Equatable { // A value: each action makes a new state.
    enum Outcome: String, Equatable { // What one request did.
        case freshHit = "Fresh hit: answered from the cache, 0 bytes downloaded." // Within max-age.
        case revalidated = "304 Not Modified: only headers travelled; the cached body was used." // Stale but unchanged.
        case downloaded = "200 OK: the whole body was downloaded." // A miss, a change or a forced reload.
        case cachedAnyAge = "Cache only: the cached copy was used without asking the server, however old." // Offline first with a copy.
        case failed = "Failed: offline and nothing usable in the cache." // Nothing to show.
    }

    var policy = CachePolicyChoice.protocolPolicy // How requests treat the cache.
    var maxAge = 60 // Cache-Control: max-age, in seconds.
    var bodyBytes = 4_000 // How big the response body is.
    var online = true // Whether the network works.
    private(set) var clock = 0 // Seconds since the start.
    private(set) var serverVersion = 1 // Changes when the server's data changes; doubles as the ETag.
    private(set) var cachedVersion: Int? // The version in the cache, if any.
    private(set) var storedAt = 0 // When the cached copy was stored or last confirmed.
    private(set) var bytesDownloaded = 0 // Total body bytes that crossed the network.
    private(set) var bytesSaved = 0 // Body bytes the cache saved us from downloading.
    private(set) var log: [String] = [] // One line per action.

    /// Moves the clock forward.
    mutating func advance(seconds: Int) { // The cache lab's clock buttons.
        clock += seconds // Time passes.
        log.append("t=\(clock)s: \(seconds) seconds passed.") // Records it.
    }

    /// The server's data changes, so its ETag changes.
    mutating func changeServerData() { // The "server changes data" button.
        serverVersion += 1 // A new version label.
        log.append("t=\(clock)s: the server's data changed (ETag now \"v\(serverVersion)\").") // Records it.
    }

    /// Empties the cache.
    mutating func clearCache() { // The "clear cache" button.
        cachedVersion = nil // Nothing cached any more.
        log.append("t=\(clock)s: cache cleared.") // Records it.
    }

    /// Sends one request and returns what happened.
    @discardableResult // The log already records the outcome.
    mutating func request() -> Outcome { // The heart of the simulator.
        let outcome = decide() // Works out what URLSession would do.
        switch outcome { // Updates the counters and the cache.
        case .freshHit, .cachedAnyAge: bytesSaved += bodyBytes // The body came from the cache.
        case .revalidated: bytesSaved += bodyBytes; storedAt = clock // Confirmed fresh again, no body downloaded.
        case .downloaded: bytesDownloaded += bodyBytes; cachedVersion = serverVersion; storedAt = clock // A new copy is stored.
        case .failed: break // Nothing changes.
        }
        log.append("t=\(clock)s: \(outcome.rawValue)") // Records it.
        return outcome // For tests and the screen.
    }

    /// Decides the outcome of a request from the current state, without changing anything.
    private func decide() -> Outcome { // Pure: reads state only.
        let age = clock - storedAt // How old the cached copy is.
        switch policy { // Each policy treats the cache differently.
        case .reload: // Ignore the cache entirely.
            return online ? .downloaded : .failed // Network or nothing.
        case .offlineFirst: // Any cached copy, however old.
            if cachedVersion != nil { return .cachedAnyAge } // Uses the copy without asking, online or not.
            return online ? .downloaded : .failed // No copy: the network.
        case .protocolPolicy: // Follow max-age and ETag.
            guard let cachedVersion else { return online ? .downloaded : .failed } // A miss.
            if age <= maxAge { return .freshHit } // Still fresh: no network at all.
            guard online else { return .failed } // Stale and offline: URLSession fails.
            return cachedVersion == serverVersion ? .revalidated : .downloaded // If-None-Match: 304 or a new 200.
        }
    }
}

/// The REST way to show a user with three to-dos: two requests, run at the same time with async let.
func userWithTodosREST(userId: Int, session: URLSession = .shared) async throws -> (user: PlaceholderUser, todos: [Todo]) { // The GraphQL card's comparison.
    async let userData = session.data(from: Placeholder.url("users/\(userId)")) // Request 1 starts now...
    async let todoData = session.data(from: Placeholder.url("users/\(userId)/todos").appending(queryItems: [URLQueryItem(name: "_limit", value: "3")])) // ...and request 2 starts too.
    let (u, uResponse) = try await userData // Waits for request 1.
    let (t, tResponse) = try await todoData // Waits for request 2.
    try validate(uResponse) // Both must be 2xx.
    try validate(tResponse) // Both must be 2xx.
    let user = try JSONDecoder().decode(PlaceholderUser.self, from: u) // A nested address too.
    let todos = try JSONDecoder().decode([Todo].self, from: t) // Three to-dos.
    return (user, todos) // Two round trips' worth of data.
}

/// The GraphQL query that would fetch the same thing in one request, as the course shows it.
let graphQLQuery = """
{ user(id: 1) { name todos(first: 3) { title } } }
""" // One endpoint, one POST, exactly these fields.

/// Runs the course's appendsPagesUntilEmpty test inside the app and reports each check.
/// The real test lives in the test target; this lets the screen show the same steps.
func runStubTestInApp() async -> [String] { // Returns one line per step.
    var out = Transcript() // Collects the lines.
    let first = Todo(userId: 1, id: 1, title: "Plan", completed: false) // One known to-do.
    let stub = SampleTodoService(pages: [[first]]) // One page with one item; page 2 comes back empty.
    let model = TodoListModel(service: stub) // The real model with the fake service injected.
    out.print("await model.loadNextPage()") // Act: loads page 1.
    await model.loadNextPage() // Completes instantly: the stub never waits.
    out.print("#expect(model.todos.count == 1):", model.todos.count == 1 ? "passed" : "FAILED") // One item appended.
    out.print("#expect(model.hasMore):", model.hasMore ? "passed" : "FAILED") // A non-empty page keeps paging on.
    out.print("await model.loadNextPage()") // Act again: page 2.
    await model.loadNextPage() // The stub returns an empty page.
    out.print("#expect(model.hasMore == false):", model.hasMore == false ? "passed" : "FAILED") // Paging has stopped.
    return out.lines // Every step, in order.
}

/// What a hand-made conditional request showed.
struct ConditionalResult: Equatable { // Shown on the cache lab card.
    let etag: String // The version label from the first reply.
    let firstStatus: Int // 200 with a body.
    let firstBytes: Int // How big that body was.
    let secondStatus: Int // 304 when nothing changed.
    let secondBytes: Int // 0: a 304 has no body.
}

/// Sends GET /todos/1, then the same request with If-None-Match set to its ETag.
/// The cache is bypassed, so your code sees the server's genuine 304.
func conditionalRequest(session: URLSession = URLSession(configuration: .ephemeral)) async throws -> ConditionalResult { // A fresh session: no cache in the way.
    let url = Placeholder.url("todos/1") // The resource.
    let (body, first) = try await session.data(from: url) // A normal GET.
    guard let etag = (first as? HTTPURLResponse)?.value(forHTTPHeaderField: "ETag") else { throw URLError(.badServerResponse) } // The version label.
    var request = URLRequest(url: url) // The same resource again...
    request.cachePolicy = .reloadIgnoringLocalCacheData // ...without URLSession's cache handling it for us...
    request.setValue(etag, forHTTPHeaderField: "If-None-Match") // ...asking "still this version?"
    let (second, response) = try await session.data(for: request) // The conditional request.
    return ConditionalResult(etag: etag, // What we asked about.
                             firstStatus: (first as? HTTPURLResponse)?.statusCode ?? 0, firstBytes: body.count, // The full download.
                             secondStatus: (response as? HTTPURLResponse)?.statusCode ?? 0, secondBytes: second.count) // The cheap check.
}

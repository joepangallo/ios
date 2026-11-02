// TodoLoading.swift
// Who: Lesson 8.4's screen and its unit tests.
// What: the course's first real fetch (fetchTodo), a small API client for
//       JSONPlaceholder, the loading state as an enum, the observable model a
//       SwiftUI view owns, and an instrumented fetch that times each phase.
// Where: the Models folder, between the views and URLSession.
// When: whenever the to-do screen appears, a button fetches, or a test runs.
// Why: the four phases (build the URL, await the response, check the status,
//      decode) appear in nearly every network call; keeping them here, with an
//      injectable session, lets the tests run them against a stand-in server.

import Foundation // URLSession, URL and JSONDecoder.
import Observation // The @Observable macro; this file holds no views.

/// Fetches one to-do: build the URL, await the response, check the status, decode.
/// The course's fetchTodo(id:), with the session as a parameter so tests can pass a stand-in.
func fetchTodo(id: Int, session: URLSession = .shared) async throws -> Todo { // async: suspends while waiting; throws: every failure reaches the caller.
    let base = URL(string: "https://jsonplaceholder.typicode.com")! // Phase one: the API's base URL.
    let url = base.appending(path: "todos/\(id)") // Adds the resource path, for example /todos/1.
    let (data, response) = // Two constants receive the tuple...
        try await session.data(from: url) // ...phase two: send a GET and suspend until the whole body arrives.
    guard let http = response as? HTTPURLResponse else { // Only an HTTP response has a status code.
        throw URLError(.badServerResponse) // Practically never for https, but the compiler requires a plan.
    }
    guard (200..<300).contains(http.statusCode) else { // Phase three: accept only 2xx.
        throw APIError.badStatus(http.statusCode) // Our own error, carrying the real code.
    }
    return try JSONDecoder().decode(Todo.self, from: data) // Phase four: decode and return.
}

/// Gathers the practice API's calls in one type, like the course's WeatherClient.
/// Views never see URLs or JSON; they ask for posts and to-dos.
struct PlaceholderClient: Sendable { // Sendable: safe to share between concurrent tasks.
    var session = URLSession.shared // Injectable: a test passes a session that never touches the network.

    /// The posts written by one user, using a query item: /posts?userId=3.
    func posts(userId: Int) async throws -> [Post] { // Returns typed posts, not Data.
        var parts = URLComponents( // Starts from the collection's address...
            string: "https://jsonplaceholder.typicode.com/posts")! // ...a constant string we control.
        parts.queryItems = [ // The options after the ?.
            URLQueryItem(name: "userId", value: "\(userId)"), // Filters the collection to one user.
        ]
        let (data, response) = try await session.data(from: parts.url!) // Uses the stored session, not URLSession.shared.
        guard let http = response as? HTTPURLResponse, // Unwraps the HTTP response...
              http.statusCode == 200 else { // ...and requires exactly 200, the only success this endpoint returns.
            throw URLError(.badServerResponse) // Callers handle it like a transport error.
        }
        return try JSONDecoder().decode([Post].self, from: data) // A JSON array becomes [Post].
    }

    /// One to-do, through the course's fetchTodo and this client's session.
    func todo(id: Int) async throws -> Todo { // The model decides what to load; the client decides how.
        try await fetchTodo(id: id, session: session) // The four phases.
    }
}

/// Every state the to-do screen can be in. The data travels inside the loaded case.
enum LoadState: Equatable { // Equatable lets tests compare states with ==.
    case idle // Nothing requested yet.
    case loading // A request is in flight.
    case loaded(Todo) // Success, carrying the to-do.
    case failed(String) // Failure, carrying a message for the user.

    /// The case's name, for the state chips on screen.
    var name: String { // "idle", "loading", "loaded" or "failed".
        switch self { // One name per case.
        case .idle: "idle" // Not started.
        case .loading: "loading" // In flight.
        case .loaded: "loaded" // Succeeded.
        case .failed: "failed" // Failed.
        }
    }
}

/// The to-do screen's model: it owns the state and the loading logic, like the course's WeatherModel.
@MainActor // Every write to state happens on the main thread, where SwiftUI reads it.
@Observable // SwiftUI redraws the views that read state whenever it changes.
final class TodoModel { // A class: the view keeps one object whose state changes over time.
    private(set) var state = LoadState.idle // Views read it; only the model changes it.
    private let client: PlaceholderClient // The model talks to the client; the view never does.
    private let delay: Duration // An optional pause before fetching, so cancellation is easy to see.

    /// Creates a model; pass a slow delay to watch .task cancel the work.
    init(session: URLSession = .shared, delay: Duration = .zero) { // Defaults suit the real screen.
        client = PlaceholderClient(session: session) // A client that uses the chosen session.
        self.delay = delay // Stores the pause.
    }

    /// Loads one to-do. It does not throw: it turns errors into state.
    func load(id: Int) async { // Called from .task and from the Try Again button.
        state = .loading // The view shows a spinner at once.
        do { // The fetch may throw.
            if delay > .zero { try await Task.sleep(for: delay) } // Task.sleep throws if the task is cancelled meanwhile.
            state = .loaded(try await client.todo(id: id)) // Suspends until the to-do arrives, then stores it.
        } catch { // Offline, timeout, bad status, bad JSON or cancellation.
            state = .failed("Could not load the to-do.") // A plain sentence and, on screen, a way to retry.
        }
    }
}

/// One measured phase of a fetch, for the "Watch a request happen" card.
struct PhaseTiming: Identifiable, Equatable { // One row on screen.
    let name: String // For example "Check the status".
    let milliseconds: Int // How long the phase took.
    let succeeded: Bool // false for the phase where the fetch stopped.
    var id: String { name } // Each phase appears once.
}

/// Runs the four phases one by one, timing each, and stops at the first that fails.
func timedFetch(id: Int, session: URLSession = .shared) async -> (phases: [PhaseTiming], result: String) { // Never throws: failures become rows.
    let clock = ContinuousClock() // Measures real elapsed time.
    var phases: [PhaseTiming] = [] // Filled as each phase finishes.
    var mark = clock.now // The start of the current phase.

    /// Records the phase that just ended and starts timing the next one.
    func finish(_ name: String, _ ok: Bool) { // A nested function can change the variables above.
        phases.append(PhaseTiming(name: name, milliseconds: wholeMilliseconds(mark.duration(to: clock.now)), succeeded: ok)) // Time since mark.
        mark = clock.now // The next phase starts now.
    }

    let url = Placeholder.base.appending(path: "todos/\(id)") // Build the URL.
    finish("Build the URL", true) // Building never fails here.
    let data: Data // Assigned once the response arrives.
    let response: URLResponse // The same.
    do { // Waiting can throw a transport error.
        (data, response) = try await session.data(from: url) // Await the response.
        finish("Await the response", true) // The reply arrived.
    } catch { // Offline, timeout and friends.
        finish("Await the response", false) // The fetch stopped here.
        return (phases, userMessage(for: error) ?? "Cancelled.") // A readable reason.
    }
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0 // The status code, or 0 if not HTTP.
    guard (200..<300).contains(status) else { // Check the status.
        finish("Check the status", false) // A 4xx or 5xx stops the fetch.
        return (phases, "Status \(status) \(reasonPhrase(for: status)): nothing to decode.") // Says which status.
    }
    finish("Check the status", true) // 2xx: go on.
    do { // Decoding can throw.
        let todo = try JSONDecoder().decode(Todo.self, from: data) // Decode.
        finish("Decode the body", true) // Typed data now exists.
        let start = clock.now // Times the last phase separately.
        let line = "#\(todo.id) \(todo.title)" // Update the screen state: the text a view would show.
        phases.append(PhaseTiming(name: "Update the screen state", milliseconds: wholeMilliseconds(start.duration(to: clock.now)), succeeded: true)) // Usually 0 ms.
        return (phases, line) // Every phase passed.
    } catch { // The JSON did not match Todo.
        finish("Decode the body", false) // The fetch stopped here.
        return (phases, userMessage(for: error) ?? "Cancelled.") // A readable reason.
    }
}

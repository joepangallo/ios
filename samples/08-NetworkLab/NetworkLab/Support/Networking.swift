// Networking.swift
// Who: every lesson that sends a real request calls these helpers.
// What: the practice API's address, the app's own error type, the shared
//       status check, a record of one request and its reply, the function that
//       sends a request and records it, status reason phrases, and the
//       function that turns any error into a sentence for people.
// Where: the Support folder, below the lesson screens and above URLSession.
// When: whenever a demo button sends a request or a screen shows a failure.
// Why: one place for these rules means every screen checks status codes and
//      words its errors the same way, which is what Lessons 8.4 and 8.5 teach.

import Foundation // URLSession, URLRequest, URLError and JSONSerialization live here.

/// JSONPlaceholder: a free practice REST API with posts, users, to-dos and comments.
/// It needs no key. It accepts POST, PUT, PATCH and DELETE and echoes them back,
/// but it never stores the change, so every student sees the same data.
enum Placeholder { // A namespace for the API's address.
    /// The base address every path is added to.
    static let base = URL(string: "https://jsonplaceholder.typicode.com")! // A literal we control, so force-unwrapping is safe.

    /// Builds the full URL for a path such as "todos/1".
    static func url(_ path: String) -> URL { // Used by demos that need a quick URL.
        base.appending(path: path) // appending(path:) adds the slash and encodes the path for us.
    }
}

/// The app's own error for problems URLSession does not report itself.
enum APIError: Error, Equatable { // Equatable lets tests compare errors with ==.
    case badStatus(Int) // A reply arrived, but its status code was not 2xx.
}

/// Throws unless the response is an HTTP response with a 2xx status code.
/// This is the status check from Lesson 8.4, moved into one shared helper (Lesson 8.7).
func validate(_ response: URLResponse) throws { // Called between receiving a reply and decoding it.
    guard let http = response as? HTTPURLResponse, // Only HTTP responses have a status code.
          (200..<300).contains(http.statusCode) else { // Any 2xx code counts as success.
        throw URLError(.badServerResponse) // A standard error that callers already handle.
    }
}

/// The standard reason phrase for a status code, such as "Not Found" for 404.
func reasonPhrase(for code: Int) -> String { // HTTPURLResponse's own wording is odd ("no error" for 200), so we keep a table.
    switch code { // One case per code the lessons mention.
    case 200: "OK" // The request worked.
    case 201: "Created" // A POST made a new resource.
    case 204: "No Content" // Success with an empty body.
    case 301: "Moved Permanently" // The resource has a new URL for good.
    case 302: "Found" // The resource is temporarily somewhere else.
    case 304: "Not Modified" // Your cached copy is still good.
    case 400: "Bad Request" // The request itself was malformed.
    case 401: "Unauthorized" // Sign in again.
    case 403: "Forbidden" // Signed in, but not allowed.
    case 404: "Not Found" // No resource at that URL.
    case 408: "Request Timeout" // The server gave up waiting for the request.
    case 409: "Conflict" // The change clashes with the current state.
    case 422: "Unprocessable Content" // The data was understood but invalid.
    case 429: "Too Many Requests" // Slow down; see Retry-After.
    case 500: "Internal Server Error" // The server crashed while answering.
    case 502: "Bad Gateway" // A server in front got a bad answer from the one behind it.
    case 503: "Service Unavailable" // Temporarily overloaded or down.
    case 504: "Gateway Timeout" // A server in front gave up waiting.
    default: "" // Codes the lessons do not discuss get no phrase.
    }
}

/// One header line, kept in a list so headers can be shown in order.
struct HeaderLine: Hashable { // Hashable so lists of headers can be compared and shown with ForEach.
    let name: String // For example "Content-Type".
    let value: String // For example "application/json; charset=utf-8".
}

/// Everything one request and its reply looked like, for showing on screen.
struct HTTPExchange { // A plain value the screen can keep and redraw from.
    let method: String // GET, POST and so on.
    let url: URL // The address that was requested.
    let statusCode: Int // The three-digit status code.
    let headers: [HeaderLine] // The response headers, sorted by name.
    let body: Data // The raw response body.
    let milliseconds: Int // How long the whole exchange took.

    /// For example "404 Not Found".
    var statusLine: String { // Shown at the top of every result.
        "\(statusCode) \(reasonPhrase(for: statusCode))".trimmingCharacters(in: .whitespaces) // No trailing space for codes without a phrase.
    }

    /// The body as text, or a note when it is empty.
    var bodyText: String { // Bodies here are JSON text, which reads fine as a String.
        body.isEmpty ? "(empty body)" : String(decoding: body, as: UTF8.self) // String(decoding:as:) never fails; bad bytes become a replacement mark.
    }

    /// Reads one response header. Header names are case-insensitive, so any spelling works.
    func header(_ name: String) -> String? { // Same rule HTTPURLResponse.value(forHTTPHeaderField:) follows.
        headers.first { $0.name.caseInsensitiveCompare(name) == .orderedSame }?.value // Compares ignoring upper and lower case.
    }
}

/// Sends a request, waits for the whole reply and records it, without judging the status.
/// A 404 comes back as an exchange, not an error: only transport failures throw.
func perform(_ request: URLRequest, session: URLSession = .shared) async throws -> HTTPExchange { // Demos that show raw HTTP use this.
    let clock = ContinuousClock() // A clock that only moves forward, ideal for timing.
    let start = clock.now // The moment the request leaves.
    let (data, response) = try await session.data(for: request) // Suspends until the reply arrives or a transport error is thrown.
    let elapsed = start.duration(to: clock.now) // How long that took.
    guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) } // Only HTTP responses have status codes.
    let headers = http.allHeaderFields.map { HeaderLine(name: "\($0.key)", value: "\($0.value)") } // Each header as a name and value pair.
    return HTTPExchange( // Packs everything into one value for the screen.
        method: request.httpMethod ?? "GET", // URLRequest defaults to GET.
        url: request.url ?? Placeholder.base, // The URL is always set for our requests.
        statusCode: http.statusCode, // For example 200.
        headers: headers.sorted { $0.name.lowercased() < $1.name.lowercased() }, // Alphabetical, so the list is easy to scan.
        body: data, // The raw bytes.
        milliseconds: wholeMilliseconds(elapsed) // Rounded for display.
    )
}

/// Converts a Duration to whole milliseconds, for display.
nonisolated func wholeMilliseconds(_ duration: Duration) -> Int { // Duration stores seconds plus attoseconds.
    let (seconds, attoseconds) = duration.components // The two parts of the duration.
    return Int(seconds) * 1000 + Int(attoseconds / 1_000_000_000_000_000) // 10^15 attoseconds make one millisecond.
}

/// Turns any error into a sentence a person can act on, or nil when nothing should be shown.
/// This is the function from Lesson 8.5, shared by every screen in the app.
nonisolated func userMessage(for error: any Error) -> String? { // nonisolated: pure, so any thread may call it, even a completion handler.
    if error is CancellationError { return nil } // Swift cancelled the task on purpose: nothing to tell the user.
    if let urlError = error as? URLError { // Errors from URLSession carry a precise code.
        switch urlError.code { // One branch per kind of network failure.
        case .cancelled: // URLSession's own word for cancellation.
            return nil // Shows nothing, like CancellationError above.
        case .notConnectedToInternet, .networkConnectionLost: // Airplane mode, or the signal dropped mid-request.
            return "You appear to be offline." // Says what happened, without jargon.
        case .timedOut: // No data arrived within the timeout.
            return "The server took too long to answer." // Hints that trying again later is reasonable.
        case .cannotFindHost, .cannotConnectToHost: // DNS failed or the connection was refused.
            return "The server cannot be reached right now." // "Right now" signals it is probably temporary.
        default: // Every other URLError code, such as an untrusted certificate.
            return "A network problem stopped the request." // Still better than a raw error number.
        }
    }
    if error is DecodingError { // The JSON did not match the model.
        return "The server sent data this app cannot read." // Honest wording; retrying will not help.
    }
    return "Something went wrong. Please try again." // A fallback, so no error falls through silently.
}

// SimulatedServer.swift
// Who: demos that need a failure on demand, and every unit test, use it.
// What: a URLProtocol subclass, a pretend server that lives inside the app.
//       A URLSession built with SimulatedServer.session(route:) never touches
//       the network; the route closure decides what each request gets back:
//       a URLError, or a status, headers and a body (optionally in timed chunks,
//       which is how the streaming demo shows lines arriving one by one).
// Where: the Support folder. URLSession calls it on its own background threads.
// When: only for sessions created by session(route:); URLSession.shared and every
//       other session keep using the real network.
// Why: you cannot make a real server answer 503 or switch the phone offline from
//      a button, and unit tests must never depend on the internet. Registering a
//      URLProtocol on a custom URLSessionConfiguration is Apple's own seam for this.

import Foundation // URLProtocol, URLSession, URLSessionConfiguration and URLError.
import Synchronization // Mutex: a lock that Swift 6 accepts as safe for shared state.

/// What the simulated server sends back for one request.
nonisolated enum SimulatedReply: Sendable { // Sendable: replies are created on one thread and used on another.
    case failure(URLError.Code) // No response at all, for example .notConnectedToInternet.
    case response(status: Int, headers: [String: String], chunks: [Data], gap: Duration) // A reply, sent in chunks with a pause between them.

    /// A JSON reply in one piece, with a status code (200 unless you say otherwise).
    static func json(_ text: String, status: Int = 200) -> SimulatedReply { // The most common reply in tests.
        .response(status: status, headers: ["Content-Type": "application/json"], chunks: [Data(text.utf8)], gap: .zero) // One chunk, no pause.
    }
}

/// A pretend server. URLSession creates one instance per request and calls its methods.
/// @unchecked Sendable: URLProtocol predates Swift concurrency; the only state this
/// class changes after creation is `stopped`, which a Mutex protects.
nonisolated final class SimulatedServer: URLProtocol, @unchecked Sendable { // nonisolated: URLSession calls it off the main actor.
    /// Decides the reply for each request. Tests can also record the request here.
    typealias Route = @Sendable (URLRequest) -> SimulatedReply // @Sendable: it runs on URLSession's threads.

    /// The header that tells a request which route answers it.
    static let routeHeader = "X-Simulated-Route" // Added to every request by the session's configuration.

    /// Every route registered so far, found by an id. The Mutex makes the shared dictionary thread-safe.
    private static let routes = Mutex<[String: Route]>([:]) // static: shared by all instances.

    /// Set when URLSession cancels the request, so timed chunks stop being sent.
    private let stopped = Mutex(false) // Read and written from different threads.

    /// Builds a URLSession whose every request is answered by the route instead of the network.
    static func session(route: @escaping Route) -> URLSession { // Each call gets its own route, so parallel tests never collide.
        let id = UUID().uuidString // A unique name for this route.
        routes.withLock { $0[id] = route } // Stores the route under that name.
        let config = URLSessionConfiguration.ephemeral // Ephemeral: no disk cache or cookies to leak between tests.
        config.protocolClasses = [SimulatedServer.self] // URLSession asks this class first for every request.
        config.httpAdditionalHeaders = [routeHeader: id] // Every request from this session carries the route's name.
        return URLSession(configuration: config) // The finished session.
    }

    /// A session where every request gets the same reply.
    static func session(always reply: SimulatedReply) -> URLSession { // Convenient for one-scenario demos.
        session { _ in reply } // Ignores the request and always answers the same way.
    }

    /// URLSession asks whether this class can handle a request. It can handle all of them.
    override class func canInit(with request: URLRequest) -> Bool { true } // Only our sessions list this class, so saying yes is safe.

    /// URLSession asks for a standard form of the request. Ours is already standard.
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request } // No changes needed.

    /// Called by URLSession to start answering the request.
    override func startLoading() { // Runs on one of URLSession's threads.
        let id = request.value(forHTTPHeaderField: Self.routeHeader) ?? "" // Which route this request belongs to.
        guard let route = Self.routes.withLock({ $0[id] }), let url = request.url else { // Looks up the route safely.
            client?.urlProtocol(self, didFailWithError: URLError(.unsupportedURL)) // No route means nothing can answer.
            return // Stops here.
        }
        switch route(request) { // Asks the route what to send back.
        case .failure(let code): // The route wants a transport failure.
            client?.urlProtocol(self, didFailWithError: URLError(code)) // URLSession throws this URLError to the caller.
        case .response(let status, let headers, let chunks, let gap): // The route wants a real-looking reply.
            guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else { // Builds the status line and headers.
                client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse)) // Only fails for impossible inputs.
                return // Stops here.
            }
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed) // Headers first, just like a real server.
            send(chunks[...], gap: gap) // Then the body, piece by piece.
        }
    }

    /// Sends body chunks one at a time, pausing `gap` between them, then finishes.
    private func send(_ chunks: ArraySlice<Data>, gap: Duration) { // Recursive: each call sends one chunk and schedules the rest.
        guard !stopped.withLock({ $0 }) else { return } // A cancelled request gets nothing more.
        guard let first = chunks.first else { // Nothing left to send.
            client?.urlProtocolDidFinishLoading(self) // Tells URLSession the body is complete.
            return // Done.
        }
        client?.urlProtocol(self, didLoad: first) // Delivers this chunk to the reader.
        let rest = chunks.dropFirst() // The chunks still to come.
        if gap == .zero { // No pause wanted.
            send(rest, gap: gap) // Sends the next chunk at once.
        } else { // A pause between chunks, to imitate a live stream.
            let seconds = Double(wholeMilliseconds(gap)) / 1000 // DispatchTime wants seconds as a Double.
            DispatchQueue.global().asyncAfter(deadline: .now() + seconds) { [self] in // Waits off the main thread.
                send(rest, gap: gap) // Then continues with the remaining chunks.
            }
        }
    }

    /// Called by URLSession when the request is cancelled or finished.
    override func stopLoading() { // For example when a task is cancelled.
        stopped.withLock { $0 = true } // Any pending chunks will now be skipped.
    }
}

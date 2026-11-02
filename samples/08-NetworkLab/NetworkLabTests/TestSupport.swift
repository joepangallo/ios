// TestSupport.swift
// Who: every test suite in NetworkLabTests uses these helpers.
// What: a thread-safe recorder for the requests a simulated server receives,
//       shortcuts that build sessions backed by the app's SimulatedServer
//       (a URLProtocol registered on a custom URLSessionConfiguration), and a
//       recording sleeper so retry tests never really wait.
// Where: the test target only; it never ships inside the app.
// When: while tests run.
// Why: unit tests must never touch the real network; these stand-ins answer
//      instantly and the same way every time, so tests are fast and reliable.

import Foundation // URLRequest, URLSession and Data.
import Synchronization // Mutex, for state shared with URLSession's threads.
@testable import NetworkLab // SimulatedServer and SimulatedReply live in the app.

/// Records every request a simulated server receives. URLSession calls routes on its own threads, so a Mutex guards the list.
final class RequestRecorder: Sendable { // Sendable: routes run off the test's actor.
    private let box = Mutex<[URLRequest]>([]) // Starts empty.

    /// Adds one request to the list.
    func record(_ request: URLRequest) { box.withLock { $0.append(request) } } // Under the lock.

    /// Every request so far, oldest first.
    var requests: [URLRequest] { box.withLock { $0 } } // A copy, read under the lock.
}

/// A session whose every request is recorded and answered with the same reply.
func recordingSession(_ recorder: RequestRecorder, reply: SimulatedReply) -> URLSession { // The most common test setup.
    SimulatedServer.session { request in // A route that sees each request.
        recorder.record(request) // Keeps it for the test to inspect.
        return reply // Always the same answer.
    }
}

/// A session that answers by path, for tests that make more than one kind of request.
func routedSession(_ replies: [String: SimulatedReply]) -> URLSession { // Keys are paths such as "/users/1".
    SimulatedServer.session { request in // Chooses the reply from the URL's path.
        replies[request.url?.path() ?? ""] ?? .json("{}", status: 404) // Unknown paths get a 404, like a real server.
    }
}

/// Counts and remembers the waits a retry loop asks for, without waiting.
final class RecordingSleeper: @unchecked Sendable { // Only used from the test's own actor.
    private(set) var waits: [Duration] = [] // Every requested wait, in order.

    /// Stands in for Task.sleep: records the duration and returns at once.
    func sleep(_ duration: Duration) async throws { waits.append(duration) } // No real waiting.
}

/// Collects values from callbacks that may run on any thread, such as a stream's report closure.
final class Collector<Value: Sendable>: Sendable { // Sendable, so @Sendable closures can capture it.
    private let box = Mutex<[Value]>([]) // Starts empty.
    func append(_ value: Value) { box.withLock { $0.append(value) } } // Adds one value under the lock.
    var items: [Value] { box.withLock { $0 } } // Everything so far, oldest first.
}

// Lesson84Tests.swift
// Who: the Swift Testing runner.
// What: checks lesson 8.4's fetchTodo for every outcome (success, bad status,
//       transport failure, bad JSON), the API client's URL and decoding, the
//       loading-state model including cancellation, and the timed fetch.
// Where: the NetworkLabTests target; every session here is simulated.
// When: only when tests run.
// Why: these four phases appear in every network call, so each one is tested
//      against a stand-in server that never touches the internet.

import Testing // @Test, #expect and #require.
import Foundation // URLSession, URLError and Data.
@testable import NetworkLab // The app's internal types.

/// The JSON GET /todos/1 really returns.
private let todoJSON = #"{"userId": 1, "id": 1, "title": "delectus aut autem", "completed": false}"# // Used by several tests.

@MainActor // The app's types are main-actor isolated.
struct Lesson84Tests { // URLSession with async/await.
    @Test func fetchTodoBuildsTheURLAndDecodes() async throws { // All four phases succeed.
        let recorder = RequestRecorder() // Captures the request.
        let todo = try await fetchTodo(id: 1, session: recordingSession(recorder, reply: .json(todoJSON))) // The course's function.
        #expect(todo == Todo(userId: 1, id: 1, title: "delectus aut autem", completed: false)) // Decoded exactly.
        #expect(recorder.requests.first?.url?.absoluteString == "https://jsonplaceholder.typicode.com/todos/1") // Phase one built this URL.
        #expect(recorder.requests.first?.httpMethod == "GET") // data(from:) sends GET.
    }

    @Test func fetchTodoThrowsBadStatusFor404() async { // Phase three.
        let session = SimulatedServer.session(always: .json("{}", status: 404)) // A delivered piece of bad news.
        await #expect(throws: APIError.badStatus(404)) { _ = try await fetchTodo(id: 9, session: session) } // Our error, carrying the code.
    }

    @Test func fetchTodoPassesTransportErrorsThrough() async { // Phase two.
        let session = SimulatedServer.session(always: .failure(.timedOut)) // No response at all.
        await #expect(throws: URLError.self) { _ = try await fetchTodo(id: 1, session: session) } // URLSession's own error.
    }

    @Test func fetchTodoThrowsDecodingErrorForBadJSON() async { // Phase four.
        let session = SimulatedServer.session(always: .json(#"{"id": "one"}"#)) // 200, but the wrong shape.
        await #expect(throws: DecodingError.self) { _ = try await fetchTodo(id: 1, session: session) } // The decoder's error.
    }

    @Test func clientAsksForOneUsersPostsWithAQueryItem() async throws { // PlaceholderClient.posts(userId:).
        let recorder = RequestRecorder() // Captures the request.
        let json = #"[{"userId": 3, "id": 21, "title": "a", "body": "b"}]"# // One post.
        let client = PlaceholderClient(session: recordingSession(recorder, reply: .json(json))) // Injected session.
        let posts = try await client.posts(userId: 3) // The client's method.
        #expect(posts.map(\.id) == [21]) // Decoded.
        #expect(recorder.requests.first?.url?.absoluteString == "https://jsonplaceholder.typicode.com/posts?userId=3") // The query item.
    }

    @Test func clientRejectsAnythingButExactly200() async { // The client's stricter check.
        let client = PlaceholderClient(session: SimulatedServer.session(always: .json("[]", status: 204))) // A 2xx that is not 200.
        await #expect(throws: URLError.self) { _ = try await client.posts(userId: 1) } // badServerResponse.
    }

    @Test func clientFetchesOneTodoThroughFetchTodo() async throws { // PlaceholderClient.todo(id:).
        let client = PlaceholderClient(session: SimulatedServer.session(always: .json(todoJSON))) // Injected session.
        #expect(try await client.todo(id: 1).title == "delectus aut autem") // Same four phases.
    }

    @Test func modelMovesFromIdleToLoaded() async { // TodoModel's happy path.
        let model = TodoModel(session: SimulatedServer.session(always: .json(todoJSON))) // No delay.
        #expect(model.state == .idle) // Starts idle.
        await model.load(id: 1) // Loads.
        #expect(model.state == .loaded(Todo(userId: 1, id: 1, title: "delectus aut autem", completed: false))) // The data travels with the state.
        #expect(model.state.name == "loaded") // The chip's name.
    }

    @Test func modelTurnsErrorsIntoAFailedState() async { // TodoModel's failure path.
        let model = TodoModel(session: SimulatedServer.session(always: .failure(.notConnectedToInternet))) // Offline.
        await model.load(id: 1) // Does not throw.
        #expect(model.state == .failed("Could not load the to-do.")) // A friendly sentence.
        #expect(LoadState.loading.name == "loading") // The other chip names.
        #expect(LoadState.idle.name == "idle") // Idle.
        #expect(model.state.name == "failed") // Failed.
    }

    @Test func cancellingTheTaskStopsTheLoad() async { // What .task does when the view disappears.
        let model = TodoModel(session: SimulatedServer.session(always: .json(todoJSON)), delay: .seconds(30)) // A long pause before fetching.
        let task = Task { await model.load(id: 1) } // Like .task starting the load.
        try? await Task.sleep(for: .milliseconds(50)) // Lets the load reach its pause.
        #expect(model.state == .loading) // In flight.
        task.cancel() // Like the view disappearing.
        await task.value // Waits for the load to finish.
        #expect(model.state == .failed("Could not load the to-do.")) // Task.sleep threw; no to-do was ever fetched.
    }

    @Test func timedFetchReportsEveryPhaseOnSuccess() async { // The "watch a request" card.
        let result = await timedFetch(id: 1, session: SimulatedServer.session(always: .json(todoJSON))) // Simulated.
        #expect(result.phases.map(\.name) == ["Build the URL", "Await the response", "Check the status", "Decode the body", "Update the screen state"]) // All five.
        #expect(result.phases.allSatisfy { $0.succeeded }) // Every one passed.
        #expect(result.result == "#1 delectus aut autem") // What the screen shows.
    }

    @Test func timedFetchStopsAtTheStatusFor404() async { // The invalid-id button.
        let result = await timedFetch(id: 0, session: SimulatedServer.session(always: .json("{}", status: 404))) // Not found.
        #expect(result.phases.map(\.succeeded) == [true, true, false]) // Stopped at the status check.
        #expect(result.result == "Status 404 Not Found: nothing to decode.") // Says why.
    }

    @Test func timedFetchStopsWhileWaitingWhenOffline() async { // A transport failure.
        let result = await timedFetch(id: 1, session: SimulatedServer.session(always: .failure(.notConnectedToInternet))) // Offline.
        #expect(result.phases.last?.name == "Await the response") // Stopped while waiting.
        #expect(result.phases.last?.succeeded == false) // Marked as failed.
        #expect(result.result == "You appear to be offline.") // The readable reason.
    }

    @Test func timedFetchStopsAtDecodingForBadJSON() async { // Bad data.
        let result = await timedFetch(id: 1, session: SimulatedServer.session(always: .json("[]"))) // An array, not a to-do.
        #expect(result.phases.last?.name == "Decode the body") // Stopped while decoding.
        #expect(result.result == "The server sent data this app cannot read.") // The readable reason.
    }
}

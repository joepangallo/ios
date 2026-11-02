// Lesson87Tests.swift
// Who: the Swift Testing runner.
// What: checks lesson 8.7: the course's own stub test (appendsPagesUntilEmpty),
//       the live service's paging URL and decoding against the simulated
//       server, the model's guards and error handling, the caching session's
//       settings, the cache simulator, the in-app test runner, the conditional
//       request and the two-request REST fetch.
// Where: the NetworkLabTests target; every session here is simulated.
// When: only when tests run.
// Why: dependency injection pays off here: the real model is tested with a
//      stub service, with no network, no flakiness and no waiting.

import Testing // @Test, #expect and #require.
import Foundation // URLSession, URLCache and Data.
@testable import NetworkLab // The app's internal types.

/// A fake service that meets the same contract as the live one. The course's StubTodoService.
struct StubTodoService: TodoService { // The model cannot tell the difference, which is the point.
    let pages: [[Todo]] // The pages to return, in order.

    func todos(page: Int) async throws -> [Todo] { // Marked async throws to match the protocol, though it never waits or fails.
        page <= pages.count ? pages[page - 1] : [] // An empty array after the last page mimics the real API.
    }
}

/// A service that fails a set number of times before answering, for the error paths.
actor FlakyTodoService: TodoService { // An actor: its counter is shared safely.
    private var failuresLeft: Int // How many calls still fail.
    private(set) var calls = 0 // How many calls arrived.
    init(failures: Int) { failuresLeft = failures } // Sets the scenario.

    func todos(page: Int) async throws -> [Todo] { // The protocol's requirement.
        calls += 1 // Counts the call.
        try await Task.sleep(for: .milliseconds(20)) // Takes a moment, so duplicate triggers overlap.
        if failuresLeft > 0 { failuresLeft -= 1; throw URLError(.notConnectedToInternet) } // Fails while failures are left.
        return [Todo(userId: 1, id: page, title: "Page \(page)", completed: false)] // One to-do per page.
    }
}

@MainActor // TodoListModel is main-actor isolated, so the test must be too.
@Test func appendsPagesUntilEmpty() async { // The course's test, exactly.
    let first = Todo(userId: 1, id: 1, title: "Plan", completed: false) // One known to-do.
    let stub = StubTodoService(pages: [[first]]) // One page with one item.
    let model = TodoListModel(service: stub) // The real model with the fake service injected.

    await model.loadNextPage() // Loads page 1 from the stub.
    #expect(model.todos.count == 1) // Exactly one item was appended.
    #expect(model.hasMore) // A non-empty page must not end pagination.

    await model.loadNextPage() // Requests page 2, which the stub returns empty.
    #expect(model.hasMore == false) // Pagination has stopped.
}

@MainActor // The app's types are main-actor isolated.
struct Lesson87Tests { // Designing the API Layer.
    @Test func liveServiceBuildsPagingURLs() { // _page and _limit.
        #expect(LiveTodoService().url(for: 2).absoluteString == "https://jsonplaceholder.typicode.com/todos?_page=2&_limit=20") // Defaults.
        #expect(LiveTodoService(pageSize: 5).url(for: 1).absoluteString == "https://jsonplaceholder.typicode.com/todos?_page=1&_limit=5") // A custom size.
    }

    @Test func liveServiceDecodesAPageFromTheSimulatedServer() async throws { // The live implementation, offline.
        let recorder = RequestRecorder() // Captures the request.
        let json = #"[{"userId": 1, "id": 21, "title": "a", "completed": true}]"# // One to-do.
        let service = LiveTodoService(session: recordingSession(recorder, reply: .json(json)), pageSize: 20) // Injected session.
        let page = try await service.todos(page: 2) // The protocol's method.
        #expect(page.map(\.id) == [21]) // Decoded.
        #expect(recorder.requests.first?.url == service.url(for: 2)) // The paging URL was used.
    }

    @Test func liveServiceRejectsBadStatuses() async { // validate(_:) inside the service.
        let service = LiveTodoService(session: SimulatedServer.session(always: .json("[]", status: 500))) // A server error.
        await #expect(throws: URLError.self) { _ = try await service.todos(page: 1) } // badServerResponse.
    }

    @Test func modelIgnoresDuplicateTriggersWhileLoading() async { // The !isLoading guard.
        let service = FlakyTodoService(failures: 0) // Always succeeds, slowly.
        let model = TodoListModel(service: service) // Injected.
        async let a: Void = model.loadNextPage() // The last row appears...
        async let b: Void = model.loadNextPage() // ...twice in quick succession.
        _ = await (a, b) // Both calls finish.
        #expect(await service.calls == 1) // Only one request went out.
        #expect(model.todos.count == 1) // Only one page was appended.
    }

    @Test func modelKeepsThePageNumberAfterAFailure() async { // Retry, not skip.
        let service = FlakyTodoService(failures: 1) // The first call fails.
        let model = TodoListModel(service: service) // Injected.
        await model.loadNextPage() // Fails.
        #expect(model.errorMessage == "You appear to be offline.") // A readable reason.
        #expect(model.todos.isEmpty) // Nothing appended.
        #expect(model.isLoading == false) // defer reset the flag.
        await model.loadNextPage() // The Retry button.
        #expect(model.errorMessage == nil) // Cleared.
        #expect(model.todos.map(\.id) == [1]) // Page 1 again, not page 2.
        #expect(model.requestedPages == [1, 1]) // The same page twice.
    }

    @Test func sampleServiceHasThreePagesThenEmpty() async throws { // The app's stand-in.
        let service = SampleTodoService.threePages // Three pages of five.
        #expect(try await service.todos(page: 1).map(\.id) == [1, 2, 3, 4, 5]) // Page 1.
        #expect(try await service.todos(page: 3).map(\.id) == [11, 12, 13, 14, 15]) // Page 3.
        #expect(try await service.todos(page: 4).isEmpty) // Past the end.
        #expect(try await service.todos(page: 0).isEmpty) // Before the start.
    }

    @Test func runStubTestInAppReportsEveryCheckPassing() async { // The in-app runner.
        let lines = await runStubTestInApp() // The same steps as appendsPagesUntilEmpty.
        #expect(lines == ["await model.loadNextPage()", "#expect(model.todos.count == 1): passed", "#expect(model.hasMore): passed", "await model.loadNextPage()", "#expect(model.hasMore == false): passed"]) // Every check passed.
    }

    @Test func cachingSessionMatchesTheCourse() { // makeCachingSession().
        let config = makeCachingSession().configuration // Its settings.
        #expect(config.urlCache?.memoryCapacity == 10_000_000) // 10 MB.
        #expect(config.urlCache?.diskCapacity == 100_000_000) // 100 MB.
        #expect(config.requestCachePolicy == .useProtocolCachePolicy) // Follow the server.
        #expect(config.timeoutIntervalForRequest == 20) // Shorter than 60.
        #expect(config.waitsForConnectivity) // Wait for a network.
        #expect(offlineFirstRequest(for: Placeholder.base).cachePolicy == .returnCacheDataElseLoad) // The course's helper.
        #expect(CachePolicyChoice.reload.policy == .reloadIgnoringLocalCacheData) // Pull to refresh.
    }

    @Test func cacheProbeSummaries() { // Where an answer came from, in words.
        #expect(CacheProbeResult.summary(of: ["local cache"]).hasPrefix("Answered from the local cache")) // A fresh hit.
        #expect(CacheProbeResult.summary(of: ["local cache", "network"]).hasPrefix("Revalidated")) // A conditional request.
        #expect(CacheProbeResult.summary(of: ["network"]) == "Downloaded from the network.") // A download.
        #expect(CacheProbeResult.summary(of: ["unknown"]) == "Transactions: unknown") // Anything else.
    }

    @Test func probeCacheReadsTheCachingHeaders() async throws { // probeCache against the simulated server.
        let session = SimulatedServer.session(always: .response(status: 200, headers: ["Cache-Control": "max-age=60", "ETag": "\"v1\""], chunks: [Data("{}".utf8)], gap: .zero)) // Caching headers.
        let result = try await probeCache(Placeholder.url("todos/1"), policy: .useProtocolCachePolicy, session: session) // One fetch.
        #expect(result.status == 200) // The status.
        #expect(result.cacheControl == "max-age=60") // How long it may be reused.
        #expect(result.etag == "\"v1\"") // Its version.
        #expect(!result.sources.isEmpty) // The logger reported the transaction.
    }

    @Test func cacheSimulatorFollowsTheProtocolPolicy() { // max-age, then ETag.
        var sim = CacheSimulator() // max-age 60, online.
        #expect(sim.request() == .downloaded) // A miss.
        sim.advance(seconds: 30) // Still fresh.
        #expect(sim.request() == .freshHit) // No network.
        sim.advance(seconds: 300) // Stale.
        #expect(sim.request() == .revalidated) // 304: unchanged.
        sim.advance(seconds: 300) // Stale again.
        sim.changeServerData() // A new ETag.
        #expect(sim.request() == .downloaded) // A new 200.
        sim.advance(seconds: 300) // Stale.
        sim.online = false // Offline.
        #expect(sim.request() == .failed) // Stale and offline: URLSession fails.
        #expect(sim.bytesDownloaded == 8000) // Two full downloads.
        #expect(sim.bytesSaved == 8000) // One fresh hit and one 304.
    }

    @Test func cacheSimulatorOtherPolicies() { // Offline first and reload.
        var sim = CacheSimulator() // Starts empty.
        sim.policy = .offlineFirst // Any cached copy.
        sim.online = false // Offline from the start.
        #expect(sim.request() == .failed) // Nothing cached yet.
        sim.online = true // Back online.
        #expect(sim.request() == .downloaded) // Fills the cache.
        sim.advance(seconds: 10_000) // Very old.
        sim.online = false // Offline again.
        #expect(sim.request() == .cachedAnyAge) // Old copy, shown anyway.
        sim.policy = .reload // Pull to refresh.
        #expect(sim.request() == .failed) // Needs the network.
        sim.online = true // Online.
        #expect(sim.request() == .downloaded) // Always downloads.
        sim.clearCache() // Empties it.
        sim.policy = .protocolPolicy // Back to normal.
        #expect(sim.request() == .downloaded) // A miss again.
        #expect(sim.log.count == 8) // Six requests, one clock step and one clear; settings changes are not logged.
    }

    @Test func conditionalRequestSeesAGenuine304() async throws { // The cache lab's real request, simulated here.
        let session = SimulatedServer.session { request in // A server that honors If-None-Match.
            if request.value(forHTTPHeaderField: "If-None-Match") == "W/\"53\"" { return .response(status: 304, headers: ["ETag": "W/\"53\""], chunks: [], gap: .zero) } // Unchanged.
            return .response(status: 200, headers: ["ETag": "W/\"53\""], chunks: [Data("{\"id\": 1}".utf8)], gap: .zero) // The full body.
        }
        let result = try await conditionalRequest(session: session) // Two requests.
        #expect(result == ConditionalResult(etag: "W/\"53\"", firstStatus: 200, firstBytes: 9, secondStatus: 304, secondBytes: 0)) // 200 then 304.
    }

    @Test func restNeedsTwoRequestsForAUserAndTheirTodos() async throws { // The GraphQL card's comparison.
        let session = routedSession([ // Two paths, two replies.
            "/users/1": .json(#"{"id": 1, "name": "Leanne Graham", "address": {"street": "Kulas Light", "city": "Gwenborough"}}"#), // The user.
            "/users/1/todos": .json(#"[{"userId": 1, "id": 1, "title": "a", "completed": false}]"#), // Their to-dos.
        ])
        let result = try await userWithTodosREST(userId: 1, session: session) // async let, twice.
        #expect(result.user.name == "Leanne Graham") // Request 1.
        #expect(result.todos.map(\.title) == ["a"]) // Request 2.
        #expect(graphQLQuery.contains("todos(first: 3)")) // The one-request alternative.
    }
}

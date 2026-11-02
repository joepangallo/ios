// NetworkLabTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks that the home screen lists each lesson once, in course order,
//       with a real summary, plus the shared helpers every lesson relies on:
//       the simulated server, the request recorder, userMessage(for:) and
//       the readable live phases.
// Where: the NetworkLabTests target, which can see the app's code through @testable import.
// When: only when tests run; test code never ships inside the app.
// Why: a broken lesson list would hide a whole screen from students, and a
//      broken shared helper would break every lesson at once.

import Testing // Swift Testing: @Test, #expect and #require.
import Foundation // URLRequest, URLError and Data.
@testable import NetworkLab // Lets the tests see the app's internal types.

@MainActor // The app's types live on the main actor (the app target's default isolation), so the suite runs there too.
struct CatalogTests { // A suite: related tests grouped in one type.
    @Test func lessonNumbersAreUnique() { // One test; its name says what it checks.
        let numbers = ContentView.lessons.map(\.number) // Every lesson number in the catalog.
        #expect(Set(numbers).count == numbers.count) // A set drops duplicates, so the counts match only when all are unique.
    }

    @Test func lessonsAreInCourseOrderWithTitles() { // Numbers and titles must match the course page.
        #expect(ContentView.lessons.map(\.number) == ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7"]) // Lessons 1 to 7; the worked examples have no screen.
        #expect(ContentView.lessons[0].title == "How an App Talks to a Server") // The first title, exactly.
        #expect(ContentView.lessons[6].title == "Designing the API Layer") // The last title, exactly.
    }

    @Test func everyLessonHasARealSummary() { // No placeholder text may remain.
        for lesson in ContentView.lessons { // Each row.
            #expect(lesson.summary != "Coming soon.") // The placeholder is gone.
            #expect(lesson.summary.hasSuffix(".")) // One plain sentence ends with a period.
        }
    }
}

@MainActor // Uses app types.
struct SharedHelperTests { // The Support folder's helpers.
    @Test func simulatedServerAnswersWithStatusHeadersAndBody() async throws { // The URLProtocol stand-in.
        let recorder = RequestRecorder() // Captures what was sent.
        let session = recordingSession(recorder, reply: .json(#"{"ok": true}"#, status: 201)) // Always 201.
        var request = URLRequest(url: Placeholder.url("todos")) // Any URL works: nothing leaves the phone.
        request.httpMethod = "POST" // A method to check later.
        let (data, response) = try await session.data(for: request) // Answered by the simulated server.
        let http = try #require(response as? HTTPURLResponse) // It must look like HTTP.
        #expect(http.statusCode == 201) // The scripted status.
        #expect(http.value(forHTTPHeaderField: "content-type") == "application/json") // The scripted header, any capitalization.
        #expect(String(decoding: data, as: UTF8.self) == #"{"ok": true}"#) // The scripted body.
        #expect(recorder.requests.count == 1) // Exactly one request arrived.
        #expect(recorder.requests.first?.httpMethod == "POST") // With the method we set.
    }

    @Test func simulatedServerFailsWithURLError() async { // Transport failures on demand.
        let session = SimulatedServer.session(always: .failure(.notConnectedToInternet)) // Airplane mode, simulated.
        await #expect(throws: URLError.self) { _ = try await session.data(from: Placeholder.base) } // URLSession throws the code.
    }

    @Test func simulatedServerSendsChunksWithGaps() async throws { // The streaming mode.
        let session = SimulatedServer.session(always: .response(status: 200, headers: [:], chunks: [Data("a\n".utf8), Data("b\n".utf8)], gap: .milliseconds(5))) // Two timed chunks.
        let (data, _) = try await session.data(from: Placeholder.base) // Waits for both.
        #expect(String(decoding: data, as: UTF8.self) == "a\nb\n") // Arrived in order.
    }

    @Test func routedSessionAnswersByPathAndUnknownPathsGet404() async throws { // The test helper itself.
        let session = routedSession(["/known": .json("[]")]) // One known path.
        let (_, known) = try await session.data(from: Placeholder.url("known")) // A path with a reply.
        let (_, unknown) = try await session.data(from: Placeholder.url("other")) // A path without one.
        #expect((known as? HTTPURLResponse)?.statusCode == 200) // The scripted reply.
        #expect((unknown as? HTTPURLResponse)?.statusCode == 404) // The fallback.
    }

    @Test func performRecordsTheExchangeWithoutThrowingFor404() async throws { // perform(_:session:).
        let session = SimulatedServer.session(always: .response(status: 404, headers: ["ETag": "v1"], chunks: [], gap: .zero)) // An empty 404.
        let exchange = try await perform(URLRequest(url: Placeholder.url("todos/9")), session: session) // Must not throw.
        #expect(exchange.statusCode == 404) // The status survives.
        #expect(exchange.statusLine == "404 Not Found") // With its reason phrase.
        #expect(exchange.bodyText == "(empty body)") // An empty body is labeled.
        #expect(exchange.header("etag") == "v1") // Header lookup ignores case.
        #expect(exchange.method == "GET") // The default method.
    }

    @Test func validateAcceptsOnly2xx() throws { // The shared status check.
        let ok = HTTPURLResponse(url: Placeholder.base, statusCode: 204, httpVersion: nil, headerFields: nil)! // A 2xx.
        let bad = HTTPURLResponse(url: Placeholder.base, statusCode: 500, httpVersion: nil, headerFields: nil)! // A 5xx.
        try validate(ok) // Does not throw.
        #expect(throws: URLError.self) { try validate(bad) } // Throws for 500.
        #expect(throws: URLError.self) { try validate(URLResponse(url: Placeholder.base, mimeType: nil, expectedContentLength: 0, textEncodingName: nil)) } // Not HTTP.
    }

    @Test func reasonPhrasesAndMilliseconds() { // Small helpers.
        #expect(reasonPhrase(for: 200) == "OK") // Not HTTPURLResponse's "no error".
        #expect(reasonPhrase(for: 429) == "Too Many Requests") // A 4xx.
        #expect(reasonPhrase(for: 599) == "") // Unknown codes have no phrase.
        #expect(wholeMilliseconds(.milliseconds(1234)) == 1234) // Exact milliseconds.
        #expect(wholeMilliseconds(.seconds(2)) == 2000) // Whole seconds.
    }

    @Test func livePhaseMakesErrorsReadableAndHidesCancellation() async { // LivePhase.of.
        let success = await LivePhase<Int>.of { 7 } // Work that succeeds.
        let failure = await LivePhase<Int>.of { throw URLError(.timedOut) } // Work that fails.
        let cancelled = await LivePhase<Int>.of { throw CancellationError() } // Work that was cancelled.
        if case .success(let value) = success { #expect(value == 7) } else { Issue.record("Expected success") } // Carries the value.
        if case .failure(let message) = failure { #expect(message == "The server took too long to answer.") } else { Issue.record("Expected failure") } // A sentence.
        if case .idle = cancelled {} else { Issue.record("Cancellation should show nothing") } // Quiet.
    }

    @Test func launchOptionsAreOffDuringTests() { // Tests launch without -autorun or -card.
        #expect(LaunchOptions.autorun == false) // No flag.
        #expect(LaunchOptions.card == nil) // No flag.
    }
}

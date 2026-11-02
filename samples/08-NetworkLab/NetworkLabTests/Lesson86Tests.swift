// Lesson86Tests.swift
// Who: the Swift Testing runner.
// What: checks lesson 8.6: the live-score lab's numbers, the course's WebSocket
//       receive loop against a scripted channel, the echo model's states, the
//       Server-Sent Events parser and stream reader against the simulated
//       server, the device-token formatting and the push registrar.
// Where: the NetworkLabTests target; no socket or stream touches the internet.
// When: only when tests run.
// Why: live connections are hard to test against real servers, so the loop is
//      written against a small protocol and fed scripted messages instead.

import Testing // @Test, #expect and #require.
import Foundation // URLSessionWebSocketTask.Message, URLError and Data.
@testable import NetworkLab // The app's internal types.

/// A stand-in WebSocket: replays scripted messages, then either fails or waits until closed.
@MainActor // Shared by the test and the model, both on the main actor.
final class ScriptedChannel: MessageChannel { // Meets the same contract as the real socket.
    var script: [URLSessionWebSocketTask.Message] // Messages still to deliver.
    let failWhenEmpty: Bool // true: throw once the script runs out; false: wait until closed.
    private(set) var sent: [URLSessionWebSocketTask.Message] = [] // Everything the code sent.
    private(set) var closed = false // Whether close() was called.

    init(_ script: [URLSessionWebSocketTask.Message], failWhenEmpty: Bool) { // Sets the scenario.
        self.script = script // The messages.
        self.failWhenEmpty = failWhenEmpty // What happens after them.
    }

    func send(_ message: URLSessionWebSocketTask.Message) async throws { sent.append(message) } // Records it.

    func receive() async throws -> URLSessionWebSocketTask.Message { // Delivers the next message.
        if !script.isEmpty { return script.removeFirst() } // Scripted messages first.
        if failWhenEmpty { throw URLError(.networkConnectionLost) } // The connection drops.
        while !closed { try await Task.sleep(for: .milliseconds(5)) } // Waits like an idle socket; Task.sleep throws if cancelled.
        throw URLError(.cancelled) // Closing makes a waiting receive throw.
    }

    func close() { closed = true } // A clean close.
}

/// The text of a text message, or the byte count of a binary one, for comparisons.
private func summary(_ message: URLSessionWebSocketTask.Message?) -> String { // Messages are not Equatable.
    switch message { // Pattern matching on the enum.
    case .string(let text): text // The text itself.
    case .data(let data): "\(data.count) bytes" // The size.
    default: "none" // nil or a future kind.
    }
}

/// Waits until a condition holds, checking every 5 ms, for at most two seconds.
@MainActor // Reads main-actor state.
private func waitUntil(_ condition: () -> Bool) async { // Keeps async tests from guessing sleep lengths.
    for _ in 0..<400 where !condition() { try? await Task.sleep(for: .milliseconds(5)) } // Stops as soon as the condition is true.
}

@MainActor // The app's types are main-actor isolated.
struct Lesson86Tests { // Live Data Beyond Request and Response.
    @Test func pollingEveryThirtySeconds() { // The lab's default.
        let result = ScoreLab(delivery: .polling, pollSeconds: 30).run() // Foreground polling.
        #expect(result.goals.compactMap(\.delay) == [26, 10, 20, 19, 20]) // The wait until the next poll after each goal.
        #expect(result.averageDelay == 19) // 95 seconds over 5 goals.
        #expect(result.phoneRequests == 180) // 5,400 s / 30 s.
        #expect(result.emptyResponses == 175) // Only 5 polls carried news.
        #expect(result.radioAwakeSeconds == 900) // 180 polls x 5 s, no overlaps.
        #expect(result.serverWorkForThousandFans == 180_000) // Every fan polls.
        #expect(result.missedGoals == 0) // All delivered, eventually.
    }

    @Test func fastPollingKeepsTheRadioAwakeAllMatch() { // 5 s polls overlap the 5 s radio tail.
        let result = ScoreLab(delivery: .polling, pollSeconds: 5).run() // Eager polling.
        #expect(result.phoneRequests == 1080) // 5,400 / 5.
        #expect(result.radioAwakeSeconds == 5400) // Never sleeps.
    }

    @Test func backgroundAppsMissPollsAndSocketsButNotPush() { // iOS suspends background apps.
        #expect(ScoreLab(delivery: .polling, inBackground: true).run().missedGoals == 5) // Every goal missed.
        #expect(ScoreLab(delivery: .polling, inBackground: true).run().phoneRequests == 0) // No timers run.
        #expect(ScoreLab(delivery: .webSocket, inBackground: true).run().missedGoals == 5) // The socket goes quiet.
        #expect(ScoreLab(delivery: .push, inBackground: true).run().missedGoals == 0) // Push still arrives.
        #expect(ScoreLab(delivery: .polling, inBackground: true).run().averageDelay == nil) // Nothing to average.
    }

    @Test func webSocketAndPushCosts() { // The other two approaches.
        let socket = ScoreLab(delivery: .webSocket).run() // Foreground socket.
        #expect(socket.averageDelay == 0) // News arrives at once.
        #expect(socket.phoneRequests == 1) // One upgrade request.
        #expect(socket.radioAwakeSeconds == 30) // Connect plus five messages, 5 s each.
        #expect(socket.serverWorkForThousandFans == 6000) // One connection and five messages per fan.
        let push = ScoreLab(delivery: .push).run() // Push.
        #expect(push.averageDelay == 2) // Best effort, a little late.
        #expect(push.phoneRequests == 0) // The phone asks for nothing.
        #expect(push.serverWorkForThousandFans == 5000) // One push per goal per fan.
    }

    @Test func overlappingRadioTimeCountsOnce() { // ScoreLab.awakeSeconds.
        #expect(ScoreLab.awakeSeconds(after: [0, 3]) == 8) // 0-5 and 3-8 overlap: 8 seconds.
        #expect(ScoreLab.awakeSeconds(after: [10, 0]) == 10) // Order does not matter.
        #expect(ScoreLab.awakeSeconds(after: []) == 0) // No transfers, no radio time.
    }

    @Test func describeMatchesTheCoursePrints() { // The loop's two cases.
        #expect(describe(.string("1-0")) == "Score update: 1-0") // print("Score update:", text)
        #expect(describe(.data(Data([1, 2, 3]))) == "Binary frame of 3 bytes") // print("Binary frame of \(bytes.count) bytes")
    }

    @Test func followGameSubscribesReportsAndCloses() async { // The course's followGame(id:).
        let channel = ScriptedChannel([.string("goal"), .data(Data([9, 9]))], failWhenEmpty: true) // Two messages, then a drop.
        let lines = Collector<String>() // What the loop reported; Sendable, because the loop may report from another thread.
        await #expect(throws: URLError.self) { try await followGame(id: 7, channel: channel) { @Sendable line in lines.append(line) } } // Ends when the connection drops.
        #expect(summary(channel.sent.first) == "subscribe 7") // Subscribed first.
        #expect(lines.items == ["Score update: goal", "Binary frame of 2 bytes"]) // Both kinds handled.
        #expect(channel.closed) // defer closed the socket.
    }

    @Test func echoModelConnectsSendsAndDisconnects() async { // The echo demo's model.
        let channel = ScriptedChannel([.string("Request served by test")], failWhenEmpty: false) // One greeting, then idle.
        let model = EchoSocketModel { channel } // Injects the stand-in.
        model.connect() // Starts the loop.
        await waitUntil { model.status == .connected } // The greeting proves the connection.
        #expect(model.lines == ["Score update: Request served by test"]) // Shown.
        await model.send("hello") // A text frame.
        await model.sendBinary() // A binary frame.
        #expect(channel.sent.map(summary) == ["subscribe 7", "hello", "3 bytes"]) // Subscribe, text, binary.
        model.disconnect() // Cancels the loop.
        #expect(model.status == .disconnected) // Closed.
        #expect(channel.closed) // The socket was closed.
    }

    @Test func echoModelShowsAReadableFailure() async { // The server drops the connection.
        let channel = ScriptedChannel([], failWhenEmpty: true) // Fails at the first receive.
        let model = EchoSocketModel { channel } // Injects the stand-in.
        model.connect() // Starts the loop.
        await waitUntil { if case .failed = model.status { true } else { false } } // Waits for the failure.
        #expect(model.status == .failed("You appear to be offline.")) // networkConnectionLost, in words.
        model.disconnect() // Keeps the failure visible for Retry.
        #expect(model.status == .failed("You appear to be offline.")) // Still showing.
    }

    @Test func serverSentEventsParser() { // The "data: " prefix rule.
        #expect(ServerSentEvents.payload(of: "data: {\"a\": 1}") == "{\"a\": 1}") // Six characters dropped.
        #expect(ServerSentEvents.payload(of: ": comment") == nil) // A comment.
        #expect(ServerSentEvents.payload(of: "event: goal") == nil) // An event name.
        #expect(ServerSentEvents.payload(of: "") == nil) // A blank line.
    }

    @Test func streamEventsReadsEventsAsTheyArrive() async throws { // The course's streamEvents(), against the simulated event server.
        let events = Collector<String>() // What was reported.
        let skipped = try await streamEvents(from: URL(string: "https://events.example/match")!, session: ServerSentEvents.demoSession(gap: .milliseconds(2))) { @Sendable line in events.append(line) } // Never leaves the phone.
        #expect(events.items.count == 5) // Five data lines.
        #expect(events.items.first == "Event: {\"minute\": 1, \"text\": \"Kick-off\"}") // print("Event:", payload)
        #expect(events.items.last == "Event: {\"minute\": 90, \"text\": \"Full time, 1-1\"}") // The last event.
        #expect(skipped == 4) // Two comments and two event names.
    }

    @Test func streamEventsAsksForTheStreamAndChecksTheStatus() async { // The request and the guard.
        let recorder = RequestRecorder() // Captures the request.
        let session = recordingSession(recorder, reply: .json("{}", status: 503)) // A server that cannot stream now.
        await #expect(throws: URLError.self) { try await streamEvents(from: Placeholder.base, session: session) { @Sendable _ in } } // badServerResponse.
        #expect(recorder.requests.first?.value(forHTTPHeaderField: "Accept") == "text/event-stream") // Asked for the stream.
    }

    @Test func countLinesReportsProgressAndTotals() async throws { // The long-reply streaming demo.
        let body = (1...250).map { "line \($0)\n" }.joined() // 250 lines.
        let progress = Collector<Int>() // Progress callbacks.
        let totals = try await countLines(of: Placeholder.url("comments"), session: SimulatedServer.session(always: .json(body))) { @Sendable count, _ in progress.append(count) } // Simulated.
        #expect(totals.lines == 250) // Every line counted.
        #expect(progress.items == [100, 200]) // Every hundred lines.
        #expect(totals.firstLineMs <= totals.totalMs) // The first line comes before the last.
    }

    @Test func deviceTokensBecomeLowercaseHex() { // The course's formatting step.
        #expect(hexString(fromToken: Data([0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x0F])) == "deadbeef000f") // Two digits per byte, leading zeros kept.
        #expect(hexString(fromToken: Data(repeating: 0xAB, count: 32)).count == 64) // A real token's length.
    }

    @Test func pushRegistrarSimulatedAndFailurePaths() { // Without touching APNs.
        let registrar = PushRegistrar() // A fresh instance, not the app's shared one.
        registrar.simulate() // The default mode.
        guard case .registered(let hex) = registrar.status else { Issue.record("Expected a token"); return } // A token arrived.
        #expect(hex.count == 64) // 32 bytes as hex.
        #expect(registrar.log.count == 5) // Three steps, the token, the next step.
        registrar.didFail(error: URLError(.badServerResponse)) // What AppDelegate reports on a free team.
        if case .failed = registrar.status {} else { Issue.record("Expected a failure") } // Failed.
        #expect(registrar.log.last?.hasPrefix("Registration failed:") == true) // Logged.
        registrar.reset() // Start over.
        #expect(registrar.status == .idle) // Back to idle.
        #expect(registrar.log.isEmpty) // Empty log.
    }
}

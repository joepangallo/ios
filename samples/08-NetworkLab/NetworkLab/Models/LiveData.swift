// LiveData.swift
// Who: Lesson 8.6's screen and its unit tests.
// What: the live-score lab's simulation (polling, WebSocket and push compared),
//       the course's WebSocket receive loop written against a small protocol so
//       a test can feed it scripted messages, the model behind the echo demo,
//       the Server-Sent Events line parser and stream reader, a pretend event
//       server, and the push-notification registrar with a simulated mode.
// Where: the Models folder. The WebSocket and stream code run on URLSession's
//        threads while waiting; the models and the registrar live on the main actor.
// When: when the student runs the lab, opens a socket, streams a response or
//       registers for push.
// Why: request-and-response cannot deliver news the moment it happens; these
//      are the alternatives, each with a cost the lab makes visible.

import Foundation // URLSession, URLSessionWebSocketTask and Data.
import Observation // @Observable for the models the views own.
import UIKit // UIApplication.registerForRemoteNotifications.
import UserNotifications // UNUserNotificationCenter, for the permission prompt.

/// How the score reaches the phone.
enum Delivery: String, CaseIterable, Identifiable { // CaseIterable feeds the picker.
    case polling = "Polling" // Ask every few seconds.
    case webSocket = "WebSocket" // One open two-way channel.
    case push = "Push" // Apple's push service delivers it.
    var id: String { rawValue } // The label doubles as the identity.
}

/// When one goal happened and when the phone heard about it.
struct GoalDelivery: Equatable, Identifiable { // One row of the lab's goal list.
    let goalSecond: Int // Seconds into the match when the goal was scored.
    let deliveredSecond: Int? // When the phone learned of it; nil if it never did.
    var id: Int { goalSecond } // Goals never share a second.
    var delay: Int? { deliveredSecond.map { $0 - goalSecond } } // How late the news was.
}

/// The numbers the live-score lab compares.
struct ScoreLabResult: Equatable { // Equatable so tests can compare whole results.
    var goals: [GoalDelivery] = [] // Every goal and when it arrived.
    var phoneRequests = 0 // Requests the phone sent (polls, or the WebSocket upgrade).
    var emptyResponses = 0 // Requests that carried no news.
    var radioAwakeSeconds = 0 // How long the cellular radio stayed in its high-power state.
    var serverWorkForThousandFans = 0 // Requests plus messages the server handles for 1,000 phones.

    /// The average delay over goals that were delivered, or nil if none were.
    var averageDelay: Double? { // Missed goals are not averaged in; they are counted separately.
        let delays = goals.compactMap(\.delay) // Only delivered goals have a delay.
        return delays.isEmpty ? nil : Double(delays.reduce(0, +)) / Double(delays.count) // Sum divided by count.
    }

    /// How many goals never reached the phone.
    var missedGoals: Int { goals.filter { $0.deliveredSecond == nil }.count } // nil means never delivered.
}

/// Simulates one 90-minute match delivered three ways, like the course's live score lab.
struct ScoreLab: Equatable { // A value: changing a control makes a new lab.
    static let goalSeconds = [754, 2210, 2290, 4271, 5290] // Fixed goal times, so every run is comparable.
    static let matchSeconds = 5400 // Ninety minutes.
    static let radioTail = 5 // Seconds the radio stays awake after each transfer.
    static let pushLatency = 2 // Push is best effort; a couple of seconds is typical.

    var delivery = Delivery.polling // Which approach.
    var pollSeconds = 30 // How often polling asks.
    var inBackground = false // iOS suspends apps in the background.

    /// Runs the match and measures the chosen delivery.
    func run() -> ScoreLabResult { // Pure: same settings, same result.
        var result = ScoreLabResult() // Filled below.
        let goals = Self.goalSeconds // Shorter name for the goal times.
        switch delivery { // One branch per approach.
        case .polling: // The phone asks on a timer.
            guard !inBackground else { // A suspended app runs no timers.
                result.goals = goals.map { GoalDelivery(goalSecond: $0, deliveredSecond: nil) } // Every goal is missed.
                return result // No requests, no radio time.
            }
            let polls = Array(stride(from: pollSeconds, through: Self.matchSeconds, by: max(pollSeconds, 1))) // Every poll time.
            result.goals = goals.map { goal in GoalDelivery(goalSecond: goal, deliveredSecond: polls.first { $0 >= goal }) } // The first poll after the goal brings it.
            let pollsWithNews = Set(result.goals.compactMap(\.deliveredSecond)).count // Distinct polls that found something.
            result.phoneRequests = polls.count // One request per poll.
            result.emptyResponses = polls.count - pollsWithNews // The rest said "no news".
            result.radioAwakeSeconds = Self.awakeSeconds(after: polls) // The radio wakes for every poll.
            result.serverWorkForThousandFans = polls.count * 1000 // Every fan polls on the same timer.
        case .webSocket: // One open channel.
            guard !inBackground else { // iOS suspends the app, and its socket goes quiet.
                result.goals = goals.map { GoalDelivery(goalSecond: $0, deliveredSecond: nil) } // Every goal is missed.
                return result // Nothing else happens.
            }
            result.goals = goals.map { GoalDelivery(goalSecond: $0, deliveredSecond: $0) } // News arrives the moment it happens.
            result.phoneRequests = 1 // The single upgrade request.
            result.radioAwakeSeconds = Self.awakeSeconds(after: [0] + goals) // Wakes to connect and for each message.
            result.serverWorkForThousandFans = (1 + goals.count) * 1000 // One connection plus one message per goal, per fan.
        case .push: // Apple's service delivers.
            result.goals = goals.map { GoalDelivery(goalSecond: $0, deliveredSecond: $0 + Self.pushLatency) } // Works even in the background.
            result.radioAwakeSeconds = Self.awakeSeconds(after: goals.map { $0 + Self.pushLatency }) // Wakes only for real news.
            result.serverWorkForThousandFans = goals.count * 1000 // Your server sends one push per goal per fan.
        }
        return result // The finished measurement.
    }

    /// Seconds the radio is awake when each transfer keeps it up for `radioTail` seconds; overlaps count once.
    static func awakeSeconds(after transfers: [Int]) -> Int { // Merges overlapping awake periods.
        var total = 0 // Seconds counted so far.
        var awakeUntil = Int.min // The end of the current awake period.
        for start in transfers.sorted() { // Earliest first.
            let end = start + radioTail // This transfer keeps the radio up until here.
            total += max(0, end - max(start, awakeUntil)) // Adds only the part not already counted.
            awakeUntil = max(awakeUntil, end) // Extends the current period.
        }
        return min(total, matchSeconds + radioTail) // Never more than the match itself.
    }
}

/// Something that can send and receive WebSocket messages. URLSessionWebSocketTask can; so can a test's stand-in.
protocol MessageChannel: AnyObject { // AnyObject: channels are shared objects with a lifetime.
    func send(_ message: URLSessionWebSocketTask.Message) async throws // Sends one message.
    func receive() async throws -> URLSessionWebSocketTask.Message // Waits for the next message.
    func close() // Closes the channel cleanly.
}

/// The real channel: a URLSessionWebSocketTask.
final class WebSocketChannel: MessageChannel { // Wraps Apple's task in our small protocol.
    private let socket: URLSessionWebSocketTask // The task that owns the connection.

    /// Creates the task and starts the upgrade handshake.
    init(url: URL, session: URLSession = .shared) { // wss:// is WebSocket over TLS.
        var request = URLRequest(url: url) // A request, so we can shorten the timeout.
        request.timeoutInterval = 10 // A dead server should fail in seconds, not a minute.
        socket = session.webSocketTask(with: request) // Created suspended, like every URLSession task.
        socket.resume() // Starts the connection: an HTTP request asking to upgrade.
    }

    func send(_ message: URLSessionWebSocketTask.Message) async throws { try await socket.send(message) } // Forwards to the task.
    func receive() async throws -> URLSessionWebSocketTask.Message { try await socket.receive() } // Suspends until a message arrives.
    func close() { socket.cancel(with: .goingAway, reason: nil) } // A clean close; any waiting receive throws.
}

/// Describes one message the way the course's loop prints it.
func describe(_ message: URLSessionWebSocketTask.Message) -> String? { // nil for kinds Apple might add later.
    switch message { // A WebSocket message is text or binary.
    case .string(let text): // A text frame.
        return "Score update: \(text)" // print("Score update:", text)
    case .data(let bytes): // A binary frame.
        return "Binary frame of \(bytes.count) bytes" // print("Binary frame of \(bytes.count) bytes")
    @unknown default: // Future kinds.
        return nil // Ignored, as the course's break does.
    }
}

/// Subscribes to a game and reports every message until the task is cancelled. The course's followGame(id:).
func followGame(id: Int, channel: some MessageChannel, report: (String) -> Void) async throws { // `some MessageChannel`: the real socket or a stand-in.
    defer { channel.close() } // Runs on every exit: return, error or cancellation.
    try await channel.send(.string("subscribe \(id)")) // Tells the server which game to follow.
    while !Task.isCancelled { // Loops until the surrounding task is cancelled.
        let message = try await channel.receive() // Suspends at no cost until there is news.
        if let line = describe(message) { report(line) } // Text or binary, described.
    }
}

/// The echo demo's model: one WebSocket to a public echo server.
@MainActor // Its state drives the screen.
@Observable // The view redraws when status or lines change.
final class EchoSocketModel { // A class: one connection with a lifetime.
    enum Status: Equatable { case disconnected, connecting, connected, failed(String) } // Where the connection stands.
    static let echoURL = URL(string: "wss://echo.websocket.org")! // A free public server that sends back whatever it receives.

    private(set) var status = Status.disconnected // Starts closed.
    private(set) var lines: [String] = [] // What arrived, oldest first.
    private var channel: (any MessageChannel)? // The open channel, if any.
    private var listener: Task<Void, Never>? // The task running the receive loop.
    private let makeChannel: () -> any MessageChannel // Builds a channel; tests pass a stand-in.

    /// Creates the model; by default it connects to the public echo server.
    init(makeChannel: @escaping () -> any MessageChannel = { WebSocketChannel(url: EchoSocketModel.echoURL) }) { // Injectable for tests.
        self.makeChannel = makeChannel // Stored for connect().
    }

    /// Opens the socket and starts the course's receive loop in a task.
    func connect() { // Called by the Connect button.
        disconnect() // Closes any earlier socket first.
        lines = [] // A fresh log.
        status = .connecting // The screen shows a spinner.
        let channel = makeChannel() // A new channel.
        self.channel = channel // Kept so Send can use it.
        listener = Task { // The loop runs until cancelled or until the connection fails.
            do { // followGame throws when the connection fails.
                try await followGame(id: 7, channel: channel) { line in // Subscribes to game 7 and listens.
                    if self.status == .connecting { self.status = .connected } // The first message proves the connection works.
                    self.lines.append(line) // Shows every message.
                }
            } catch { // The connection failed or was closed.
                if Task.isCancelled { return } // We closed it on purpose: show nothing.
                self.status = .failed(userMessage(for: error) ?? "The connection closed.") // A readable reason, and the screen offers Retry.
            }
        }
    }

    /// Sends a text message; the echo server sends it straight back.
    func send(_ text: String) async { // Called by the Send button.
        guard let channel else { return } // Nothing to send on.
        do { try await channel.send(.string(text)) } catch { status = .failed(userMessage(for: error) ?? "The connection closed.") } // A failed send ends the session.
    }

    /// Sends three bytes as a binary frame, to show the .data case.
    func sendBinary() async { // Called by the Send binary button.
        guard let channel else { return } // Nothing to send on.
        do { try await channel.send(.data(Data([0x01, 0x02, 0x03]))) } catch { status = .failed(userMessage(for: error) ?? "The connection closed.") } // Three bytes.
    }

    /// Cancels the loop and closes the socket. defer inside followGame closes it too.
    func disconnect() { // Called by Disconnect, by connect(), and when the screen goes away.
        listener?.cancel() // Ends the while loop at its next check.
        channel?.close() // Makes a waiting receive() throw at once.
        listener = nil // Forgets the task.
        channel = nil // Forgets the channel.
        if case .failed = status { return } // Keeps a failure visible, so its Retry button stays.
        status = .disconnected // Otherwise the screen shows the socket as closed.
    }
}

/// Server-Sent Events: one long response the server keeps writing "data:" lines into.
enum ServerSentEvents { // A namespace for the parser and the pretend server.
    /// The payload of a data line, or nil for comments, event names and blank lines.
    static func payload(of line: String) -> Substring? { // The course's prefix check, as a function.
        guard line.hasPrefix("data: ") else { return nil } // Only data lines carry events.
        return line.dropFirst(6) // Removes "data: "; a Substring avoids copying the text.
    }

    /// What the pretend event server writes, line by line.
    static let demoLines = [ // A short live match commentary.
        ": stream opened", // A comment line: starts with a colon.
        "event: kickoff", // An event name line.
        "data: {\"minute\": 1, \"text\": \"Kick-off\"}", // Payload 1.
        "data: {\"minute\": 12, \"text\": \"Goal, 1-0\"}", // Payload 2.
        ": keep-alive", // Servers send comments so idle connections stay open.
        "data: {\"minute\": 37, \"text\": \"Goal, 1-1\"}", // Payload 3.
        "event: halftime", // Another event name.
        "data: {\"minute\": 45, \"text\": \"Half-time\"}", // Payload 4.
        "data: {\"minute\": 90, \"text\": \"Full time, 1-1\"}", // Payload 5.
    ]

    /// A session whose server streams `demoLines`, one line every `gap`.
    static func demoSession(gap: Duration = .milliseconds(400)) -> URLSession { // The simulated server sends timed chunks.
        SimulatedServer.session(always: .response( // Every request gets this stream.
            status: 200, headers: ["Content-Type": "text/event-stream"], // The Server-Sent Events media type.
            chunks: demoLines.map { Data(($0 + "\n").utf8) }, gap: gap)) // One chunk per line.
    }
}

/// Reads a Server-Sent Events stream and reports each event as it arrives. The course's streamEvents().
/// Returns how many lines were skipped because they were not data lines.
@discardableResult // Callers that only want the events can ignore the count.
func streamEvents(from url: URL, session: URLSession = .shared, report: (String) -> Void) async throws -> Int { // Runs until the stream ends, fails or is cancelled.
    var request = URLRequest(url: url) // A request, so a header can be added.
    request.setValue("text/event-stream", // Asks for the stream...
                     forHTTPHeaderField: "Accept") // ...rather than ordinary JSON.
    let (bytes, response) = // The byte stream and the response...
        try await session.bytes(for: request) // ...returned once headers arrive, while the body keeps flowing.
    guard (response as? HTTPURLResponse)?.statusCode == 200 else { // Checks the status before reading events.
        throw URLError(.badServerResponse) // The stream could not be opened.
    }
    var skipped = 0 // Comment and event-name lines.
    for try await line in bytes.lines { // Each complete line, as soon as it arrives.
        guard let payload = ServerSentEvents.payload(of: line) else { skipped += 1; continue } // Not a data line: skip it.
        report("Event: \(payload)") // print("Event:", payload)
    }
    return skipped // How many lines were not events.
}

/// Counts the lines of a long response as they arrive, to show streaming on a real server.
func countLines(of url: URL, session: URLSession = .shared, progress: (Int, String) -> Void) async throws -> (lines: Int, firstLineMs: Int, totalMs: Int) { // Times the first and last line.
    let clock = ContinuousClock() // Real elapsed time.
    let start = clock.now // When the request left.
    let (bytes, response) = try await session.bytes(from: url) // Returns once headers arrive.
    try validate(response) // Only a 2xx reply is worth reading.
    var count = 0 // Lines so far.
    var firstLine = 0 // When the first line arrived.
    for try await line in bytes.lines { // Each line, as it arrives.
        count += 1 // One more.
        if count == 1 { firstLine = wholeMilliseconds(start.duration(to: clock.now)) } // Time to the first line.
        if count % 100 == 0 { progress(count, line) } // Updates the screen every hundred lines, not every line.
    }
    return (count, firstLine, wholeMilliseconds(start.duration(to: clock.now))) // Totals.
}

/// Turns a device token into the hexadecimal text servers expect, as the course's delegate does.
func hexString(fromToken token: Data) -> String { // 32 bytes become 64 characters.
    token.map { String(format: "%02x", $0) }.joined() // Each byte as two lowercase hex digits.
}

/// Asks permission to show notifications, then registers with APNs. The course's requestPushPermission().
/// It returns whether permission was granted, so the screen can explain a "no".
@MainActor // UIApplication.shared is main-actor isolated.
func requestPushPermission() async throws -> Bool { // Called only when the student asks for the real thing.
    let center = UNUserNotificationCenter.current() // The app's one notification center.
    let granted = try await center.requestAuthorization( // Shows the system prompt the first time...
        options: [.alert, .sound, .badge]) // ...asking for alerts, sounds and badges.
    guard granted else { return false } // The user declined: the app must still work.
    UIApplication.shared.registerForRemoteNotifications() // Asks APNs for a token; the answer arrives in AppDelegate.
    return true // Permission granted and registration started.
}

/// Tracks push registration, real or simulated. AppDelegate reports APNs's answer here.
@MainActor // Its state drives the screen.
@Observable // The view redraws when status changes.
final class PushRegistrar { // One per app: APNs answers the whole app.
    static let shared = PushRegistrar() // The instance AppDelegate and the screen share.

    enum Status: Equatable { // Where registration stands.
        case idle // Nothing tried yet.
        case waiting // Waiting for APNs to answer.
        case registered(String) // A token arrived (hexadecimal).
        case failed(String) // APNs refused; the message says why.
        case declined // The user said no to the permission prompt.
        case noAnswer // Nothing came back in time.
    }

    private(set) var status = Status.idle // Starts untried.
    private(set) var log: [String] = [] // Each step, for the console.
    var timeout = Duration.seconds(10) // How long to wait for APNs before giving up.

    /// The simulated path: shows every step a paid account would see, without touching APNs.
    func simulate() { // The default mode on this screen.
        let token = Data((0..<32).map { UInt8(($0 * 37 + 11) % 256) }) // 32 made-up bytes, the size of a real token.
        log = ["Simulated: permission granted (alerts, sounds, badges).", // Step 1: the prompt.
               "Simulated: registerForRemoteNotifications() called.", // Step 2: register.
               "Simulated: APNs answered with a 32-byte token."] // Step 3: the token arrives in AppDelegate.
        didRegister(token: token) // Step 4: what AppDelegate does with it.
    }

    /// The real path: asks permission, registers, then waits for AppDelegate to report the answer.
    func registerForReal() async { // Only when the student switches to the real mode.
        status = .waiting // The screen shows a spinner.
        log = ["Asking for notification permission..."] // Step 1.
        do { // The permission request can throw.
            guard try await requestPushPermission() else { // Shows the prompt; false means declined.
                status = .declined // The user said no.
                log.append("Permission declined. The app keeps working without push.") // The course's advice.
                return // Nothing else to do.
            }
        } catch { // Rare: the request itself failed.
            status = .failed(error.localizedDescription) // Says what happened.
            return // Stops.
        }
        log.append("Permission granted. registerForRemoteNotifications() called; waiting for APNs...") // Step 2.
        let clock = ContinuousClock() // Measures the wait.
        let deadline = clock.now.advanced(by: timeout) // When to stop waiting.
        while status == .waiting, clock.now < deadline { // Until AppDelegate answers or time runs out.
            try? await Task.sleep(for: .milliseconds(100)) // Checks ten times a second without blocking.
        }
        if status == .waiting { // Still nothing.
            status = .noAnswer // Never hangs: the screen explains instead.
            log.append("No answer from APNs within \(timeout.components.seconds) seconds.") // Says how long we waited.
        }
    }

    /// AppDelegate calls this with the device token APNs issued.
    func didRegister(token: Data) { // application(_:didRegisterForRemoteNotificationsWithDeviceToken:)
        let hex = hexString(fromToken: token) // The course's formatting step.
        status = .registered(hex) // Shows the token.
        log.append("Device token: \(hex)") // The 64-character hex string.
        log.append("Next: sendTokenToServer(token) would upload it to your backend.") // This app has no backend.
    }

    /// AppDelegate calls this when APNs refuses, as it does for a free team.
    func didFail(error: any Error) { // application(_:didFailToRegisterForRemoteNotificationsWithError:)
        status = .failed(error.localizedDescription) // Apple's message, for example the missing aps-environment entitlement.
        log.append("Registration failed: \(error.localizedDescription)") // Logged, as the course's Try It suggests.
    }

    /// Clears the status and log, so the student can try again.
    func reset() { status = .idle; log = [] } // Back to the start.
}

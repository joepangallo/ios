// Lesson_8_6_LiveData.swift
// Who: the home screen opens this when the student taps lesson 8.6.
// What: Live Data Beyond Request and Response: the ways a server can deliver
//       news, a live-score lab comparing polling, WebSocket and push, a real
//       WebSocket to a public echo server, a response streamed line by line
//       (Server-Sent Events from a simulated server, and a real long reply),
//       and push registration with a simulated mode and the real attempt.
// Where: pushed onto the navigation stack by ContentView.
// When: whenever lesson 8.6 is opened; sockets and streams start on a tap and
//       stop when the screen goes away.
// Why: HTTP is client-initiated; scores, messages and deliveries need a way for
//      news to reach the phone the moment it happens, and each way has a cost.

import SwiftUI // Views and controls.

/// The lesson 8.6 screen: one card per step of the course page.
struct LiveDataLesson: View { // ContentView routes "8.6" here.
    let lesson: Lesson // The number, title and summary from the home screen.

    var body: some View { // Built once; each card keeps its own state.
        CardScroller { // Lets screenshots jump to a card with -card N.
            LessonPage(lesson: lesson) { // The shared scrolling page layout.
                NewsCard().id(1) // When the server has news.
                ScoreLabCard().id(2) // Live score lab.
                WebSocketCard().id(3) // WebSockets with URLSessionWebSocketTask.
                StreamingCard().id(4) // Streaming a response line by line.
                PushGlanceCard().id(5) // Push notifications at a glance.
                PushRegisterCard().id(6) // Register for push and receive the token.
            }
        }
    }
}

/// Formats seconds into the match as mm:ss, for example 12:34.
private func matchClock(_ seconds: Int) -> String { // Used by the score lab.
    String(format: "%02d:%02d", seconds / 60, seconds % 60) // Minutes, then seconds, both two digits.
}

/// "When the server has news": the five ways to get news to a phone.
private struct NewsCard: View { // Card 1.
    var body: some View { // Static content.
        DemoCard(title: "When the server has news", caption: "HTTP is client-initiated: the server can only answer questions. These are the ways around that, each with different costs.") { // Course step 1.
            TermList(terms: [ // The course's five approaches.
                Term(term: "Polling", text: "Ask every few seconds: \"anything new?\" Simple, but most answers are \"no\", and every request wakes the radio."), // Polling.
                Term(term: "Long polling", text: "Ask, and the server holds the request open until there is news or a timeout; then ask again."), // Long polling.
                Term(term: "Streaming (Server-Sent Events)", text: "One long HTTP response that the server keeps writing lines into. News flows one way: server to client."), // SSE.
                Term(term: "WebSocket", text: "An HTTP connection upgraded into a two-way channel. Either side can send a message at any time, with little overhead per message."), // WebSocket.
                Term(term: "Push notifications", text: "Apple's push service delivers a message to the device even when your app is not running."), // Push.
            ])
            Callout(title: "Battery is part of the design", text: "A cellular radio stays in a high-power state for several seconds after each transfer. Many small requests spread over a minute can cost more energy than one larger request. The lab below counts that time.", systemImage: "battery.50") // The course's design note.
        }
    }
}

/// "Live score lab": one match, delivered by polling, WebSocket or push.
private struct ScoreLabCard: View { // Card 2, the course's live score lab.
    @State private var lab = ScoreLab() // Polling every 30 s, in the foreground, by default.

    var body: some View { // Rebuilt when a control changes.
        let result = lab.run() // Instant and deterministic.
        DemoCard(title: "Live score lab", caption: "Five goals in a 90-minute match. Compare how late each update arrives, how many requests carry no news, how long the radio stays awake and how much work the server does for 1,000 fans.") { // Course widget.
            Picker("Delivery", selection: $lab.delivery) { // Polling, WebSocket or push.
                ForEach(Delivery.allCases) { Text($0.rawValue).tag($0) } // One segment each.
            }
            .pickerStyle(.segmented) // Side by side.
            if lab.delivery == .polling { // The interval matters only for polling.
                Picker("Poll every", selection: $lab.pollSeconds) { // How often to ask.
                    ForEach([5, 30, 60, 300], id: \.self) { Text("\($0) s").tag($0) } // From eager to lazy.
                }
                .pickerStyle(.segmented) // Side by side.
            }
            Toggle("App in the background", isOn: $lab.inBackground) // iOS suspends background apps.
            ValueRow(label: "Average delay", value: result.averageDelay.map { String(format: "%.1f s", $0) } ?? "never delivered") // How late the news was.
            ValueRow(label: "Goals missed", value: "\(result.missedGoals) of \(result.goals.count)") // Background polling misses them all.
            ValueRow(label: "Requests from the phone", value: "\(result.phoneRequests)") // Polls, or one upgrade.
            ValueRow(label: "Requests with no news", value: "\(result.emptyResponses)") // Wasted polls.
            ValueRow(label: "Radio awake", value: "\(result.radioAwakeSeconds / 60) min \(result.radioAwakeSeconds % 60) s") // Battery cost.
            ValueRow(label: "Server work for 1,000 fans", value: "\(result.serverWorkForThousandFans.formatted()) messages") // Scale cost.
            ForEach(result.goals) { goal in // One line per goal.
                Text("Goal at \(matchClock(goal.goalSecond)): " + (goal.deliveredSecond.map { "on the phone at \(matchClock($0)) (\(goal.delay ?? 0) s late)" } ?? "never reached the phone")) // When the phone heard.
                    .font(.footnote.monospacedDigit()) // Steady digits.
            }
        }
    }
}

/// "WebSockets with URLSessionWebSocketTask": a real socket to a public echo server.
private struct WebSocketCard: View { // Card 3.
    @State private var model = EchoSocketModel() // Owns the socket and the receive loop.
    @State private var text = "goal 1-0" // The next text message.

    var body: some View { // Rebuilt when the model's status or lines change.
        DemoCard(title: "WebSockets with URLSessionWebSocketTask", caption: "An HTTP request upgraded into a two-way channel. This connects to wss://echo.websocket.org, a free server that sends back whatever it receives, subscribes with \"subscribe 7\" as the course does, and keeps receiving until you disconnect.") { // Course step 3.
            switch model.status { // One row for the connection's state.
            case .disconnected: // Closed.
                Button("Connect") { model.connect() } // Opens the socket and starts the loop.
                    .buttonStyle(.borderedProminent) // The main action.
            case .connecting: // Waiting for the first message.
                ProgressView("Connecting") // A labeled spinner.
            case .connected: // Open.
                HStack { // The message and its buttons.
                    TextField("Message", text: $text) // What to send.
                        .textFieldStyle(.roundedBorder) // A visible box.
                    AsyncButton(title: "Send") { await model.send(text) } // A text frame.
                }
                HStack { // Binary and close.
                    AsyncButton(title: "Send 3 binary bytes") { await model.sendBinary() } // A .data frame.
                    Button("Disconnect") { model.disconnect() } // Cancels the loop; defer closes the socket.
                        .buttonStyle(.bordered) // Secondary.
                }
            case .failed(let message): // The connection failed or the server is down.
                ErrorBox(message: message) { model.connect() } // A readable reason and Retry.
            }
            ConsoleView(lines: model.lines) // Every message the loop received.
            Text("The first line is the echo server greeting the new connection; every line after it is your own message coming back. Closing uses cancel(with: .goingAway).") // What the lines mean.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quieter.
        }
        .autorun({ model.connect() }) // Screenshots run it without a tap.
        .onDisappear { model.disconnect() } // Leaving the screen closes the socket, like .task cancellation would.
    }
}

/// "Streaming a response line by line": bytes(for:) and .lines on a simulated event server and a real long reply.
private struct StreamingCard: View { // Card 4.
    @State private var lines: [String] = [] // Events or progress, oldest first.
    @State private var failure: String? // A readable error, if the stream failed.
    @State private var running: Task<Void, Never>? // The stream's task, so Stop can cancel it.
    @State private var lastRun = 0 // 1 for events, 2 for comments, so Retry repeats the right one.

    var body: some View { // Rebuilt when lines or running change.
        DemoCard(title: "Streaming a response line by line", caption: "bytes(for:) hands you the body as it arrives, and .lines turns it into an asynchronous sequence you read with for try await.") { // Course step 4.
            Button("Stream Server-Sent Events (simulated server)") { start(1) } // The course's streamEvents().
                .buttonStyle(.bordered) // Looks tappable.
            Button("Stream 500 comments from the practice API") { start(2) } // A real long reply, read line by line.
                .buttonStyle(.bordered) // Looks tappable.
            if running != nil { // While a stream is open.
                Button("Stop", role: .destructive) { running?.cancel(); running = nil } // Cancelling the task ends the for-await loop.
                    .buttonStyle(.bordered) // Looks tappable.
            }
            ConsoleView(lines: lines) // Each event as it arrives.
            if let failure { ErrorBox(message: failure) { start(lastRun) } } // A readable reason and Retry.
            Text("The event server lives inside this app (a URLProtocol), writing one line every 0.4 s with text/event-stream; comment and event-name lines are skipped by the \"data: \" check.") // Honest labeling.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quieter.
        }
        .autorun({ start(1) }) // Screenshots run it without a tap.
        .onDisappear { running?.cancel() } // Leaving the screen stops the stream.
    }

    /// Starts one of the two streams in a task, replacing any running one.
    private func start(_ which: Int) { // 1 = events, 2 = comments.
        running?.cancel() // Only one stream at a time.
        lines = [] // A fresh console.
        failure = nil // And no old error.
        lastRun = which // Remembered for Retry.
        running = Task { // The stream runs until it ends, fails or is cancelled.
            do { // Both streams can throw.
                if which == 1 { // Server-Sent Events.
                    let skipped = try await streamEvents(from: URL(string: "https://events.example/match")!, session: ServerSentEvents.demoSession()) { lines.append($0) } // Never leaves the phone: the simulated server answers.
                    lines.append("Stream closed. \(skipped) non-data lines were skipped.") // The loop ends when the server closes.
                } else { // The real long reply.
                    let totals = try await countLines(of: Placeholder.url("comments")) { count, line in lines = ["\(count) lines so far; latest: \(line.trimmingCharacters(in: .whitespaces))"] } // Progress every 100 lines.
                    lines.append("Done: \(totals.lines) lines. First line after \(totals.firstLineMs) ms, last after \(totals.totalMs) ms.") // Reading began long before the end.
                }
            } catch { // Offline, or cancelled.
                failure = userMessage(for: error) // nil for cancellation, so Stop shows nothing.
            }
            running = nil // The stream is over.
        }
    }
}

/// "Push notifications at a glance": the four pieces of APNs.
private struct PushGlanceCard: View { // Card 5.
    var body: some View { // Static content.
        DemoCard(title: "Push notifications at a glance", caption: "Your app cannot keep a connection open in the background; iOS suspends it. For news that must reach someone who is not using your app, use the Apple Push Notification service (APNs).") { // Course step 5.
            TermList(terms: [ // The course's four points.
                Term(term: "Permission", text: "The app asks the user through UNUserNotificationCenter before it shows alerts. Many people decline, so the app must still work without push."), // Permission.
                Term(term: "Device token", text: "The app registers with APNs and receives a token that identifies this app on this device, then sends the token to your server."), // Token.
                Term(term: "Your server sends", text: "Your backend sends the message and the token to APNs, authenticated with a key from your Apple developer account. APNs delivers it."), // Server.
                Term(term: "Not guaranteed", text: "Delivery is best effort, and silent background pushes are throttled. Treat a push as a hint to fetch fresh data, not as the data itself."), // Best effort.
            ])
            Callout(title: "Live Activities", text: "A Live Activity on the Lock Screen, built with ActivityKit, can also be updated by push. It is the system's answer for live scores, deliveries and rides. It needs a widget extension and, for push updates, a paid account, so this app only describes it.", systemImage: "rectangle.badge.checkmark") // The course's ecosystem note.
        }
    }
}

/// "Register for push and receive the token": simulated by default, or the real attempt.
private struct PushRegisterCard: View { // Card 6.
    @State private var useRealAPNs = false // Simulated mode is the default.
    private var registrar: PushRegistrar { .shared } // The registrar AppDelegate reports to.

    var body: some View { // Rebuilt when the registrar's status changes.
        DemoCard(title: "Register for push and receive the token", caption: "Ask permission, register with APNs, receive the device token in an app delegate method. This app's App struct attaches AppDelegate with @UIApplicationDelegateAdaptor.") { // Course step 6.
            Picker("Mode", selection: $useRealAPNs) { // Simulated or real.
                Text("Simulated").tag(false) // Works everywhere.
                Text("Real APNs").tag(true) // Shows what a free team gets.
            }
            .pickerStyle(.segmented) // Side by side.
            Text(useRealAPNs ? "Real mode asks for notification permission, calls registerForRemoteNotifications() and waits up to 10 seconds for AppDelegate. Without a paid account the app has no aps-environment entitlement, so APNs answers with an error, or not at all." : "Simulated mode shows every step a paid account would see, with a made-up token. Nothing is sent to Apple.") // What each mode does.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quieter.
            HStack { // Run and reset.
                AsyncButton(title: useRealAPNs ? "Register with APNs" : "Run the simulation") { // One button, two behaviors.
                    if useRealAPNs { await registrar.registerForReal() } else { registrar.simulate() } // Real or simulated.
                }
                Button("Reset") { registrar.reset() } // Clears the log.
                    .buttonStyle(.bordered) // Secondary.
            }
            switch registrar.status { // One summary line per outcome.
            case .idle: EmptyView() // Nothing yet.
            case .waiting: ProgressView("Waiting for APNs") // The real path is in progress.
            case .registered: Label("Registered: AppDelegate received a device token.", systemImage: "checkmark.seal").foregroundStyle(.green) // Success.
            case .declined: Label("Permission declined. The app works without push.", systemImage: "bell.slash").foregroundStyle(.orange) // A "no".
            case .noAnswer: Label("No answer from APNs. On a free team, registration cannot complete.", systemImage: "clock.badge.exclamationmark").foregroundStyle(.orange) // Never hangs.
            case .failed(let message): // The free-team error.
                VStack(alignment: .leading, spacing: 4) { // The error and its explanation.
                    Label("Registration failed", systemImage: "xmark.octagon").foregroundStyle(.red) // The headline.
                    Text(message).font(.footnote.monospaced()) // Apple's own message.
                    Text("This is expected with a free Personal Team: push needs the aps-environment entitlement, which only the paid Apple Developer Program can add. Everything else in this app works without it.") // The explanation.
                        .font(.footnote) // Small.
                }
            }
            ConsoleView(lines: registrar.log) // Each step.
        }
        .autorun({ registrar.simulate() }) // Screenshots run it without a tap.
    }
}

#Preview { // Shows this lesson in Xcode's canvas.
    NavigationStack { LiveDataLesson(lesson: ContentView.lessons[5]) } // Inside a stack, so the title shows.
}

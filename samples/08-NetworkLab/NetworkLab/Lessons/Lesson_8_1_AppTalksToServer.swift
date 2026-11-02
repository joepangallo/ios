// Lesson_8_1_AppTalksToServer.swift
// Who: the home screen opens this when the student taps lesson 8.1.
// What: How an App Talks to a Server: a client sending a real request, the five
//       layers measured on a live request, latency versus bandwidth, a frozen
//       versus a responsive main thread, the round trips of HTTP/1.1, HTTP/2 and
//       HTTP/3, and the course's JourneyLogger reading URLSessionTaskMetrics.
// Where: pushed onto the navigation stack by ContentView.
// When: whenever lesson 8.1 is opened; requests run only when a button is tapped.
// Why: the layers and round trips are invisible until you measure them; every
//      card here makes one of them visible on a real phone and a real network.

import SwiftUI // Views, controls and TimelineView.

/// The lesson 8.1 screen: one card per step of the course page.
struct AppTalksToServerLesson: View { // ContentView routes "8.1" here.
    let lesson: Lesson // The number, title and summary from the home screen.

    var body: some View { // Built once; each card keeps its own state.
        CardScroller { // Lets screenshots jump to a card with -card N.
            LessonPage(lesson: lesson) { // The shared scrolling page layout.
                ClientCard().id(1) // Your app is a client.
                LayersCard().id(2) // The layers a request travels through.
                LatencyCard().id(3) // Latency, bandwidth and round trips.
                FollowRequestCard().id(4) // Follow one request.
                VersionsCard().id(5) // HTTP/1.1, HTTP/2 and HTTP/3.
                MeasureCard().id(6) // Measuring the journey from Swift.
            }
        }
    }
}

/// A small labeled box with an icon, for the client, network and server diagram.
private struct NodeBox: View { // Used three times in the diagram.
    let symbol: String // The SF Symbol to draw.
    let label: String // The word under it.

    var body: some View { // Rebuilt only if the label changes.
        VStack(spacing: 4) { // Icon over label.
            Image(systemName: symbol) // The picture.
                .font(.title2) // Large enough to recognize.
            Text(label) // The word.
                .font(.caption) // Small, like a diagram label.
        }
        .frame(maxWidth: .infinity, minHeight: 64) // The three boxes share the width equally and match in height.
        .padding(.vertical, 8) // A little height.
        .background(.fill.tertiary, in: .rect(cornerRadius: 8)) // A light box that adapts to dark mode.
    }
}

/// "Your app is a client": the diagram, the four terms and one real request.
private struct ClientCard: View { // Card 1.
    @State private var phase = LivePhase<HTTPExchange>.idle // The live request's state.

    var body: some View { // Rebuilt when phase changes.
        DemoCard(title: "Your app is a client", caption: "The app on the phone starts the conversation; a server in a data center answers it.") { // Course step 1.
            HStack(spacing: 6) { // Client, network, server, left to right.
                NodeBox(symbol: "iphone", label: "Client") // The phone: this app.
                Image(systemName: "arrow.left.arrow.right") // Messages go both ways.
                NodeBox(symbol: "antenna.radiowaves.left.and.right", label: "Network") // Everything in between.
                Image(systemName: "arrow.left.arrow.right") // Messages go both ways.
                NodeBox(symbol: "server.rack", label: "Server") // The machine that answers: the backend.
            }
            TermList(terms: [ // The course's four terms.
                Term(term: "Request", text: "A message from the client asking the server to do something: send data, save data, delete data."), // Out.
                Term(term: "Response", text: "The server's answer: a status that says how it went, plus any data."), // Back.
                Term(term: "Network", text: "Everything in between: Wi-Fi or cellular radio, routers, cables and other companies' networks."), // The middle.
                Term(term: "URLSession", text: "The Foundation class that iOS apps use to send requests and receive responses."), // The tool.
            ])
            AsyncButton(title: "Send one request", action: send) // A real GET to the practice API.
            LiveResult(phase: phase, retry: send) { exchange in // Spinner, result, or error with Retry.
                VStack(alignment: .leading, spacing: 4) { // The two halves of the conversation.
                    ValueRow(label: "Request", value: "GET /todos/1") // What the client asked.
                    ValueRow(label: "Response", value: "\(exchange.statusLine) in \(exchange.milliseconds) ms") // What came back, and how long it took.
                }
            }
            Callout(title: "Design for the gap", text: "Reading memory takes nanoseconds. A network reply takes tens to hundreds of milliseconds, and sometimes never arrives. Every screen that loads data needs a plan for \"still waiting\" and \"it failed\", not only for \"it worked\".", systemImage: "hourglass") // The course's design callout.
        }
        .autorun(send) // Screenshots run the request without a tap.
    }

    /// Sends GET /todos/1 and stores the outcome.
    private func send() async { // Called by the button, Retry and -autorun.
        phase = .running // Shows the spinner.
        phase = await .of { try await perform(URLRequest(url: Placeholder.url("todos/1"))) } // Success or a readable error.
    }
}

/// "The layers a request travels through": DNS, IP, TCP, TLS and HTTP, measured on a real request.
private struct LayersCard: View { // Card 2.
    @State private var phase = LivePhase<[LayerReading]>.idle // The measured layers, once traced.

    var body: some View { // Rebuilt when phase changes.
        DemoCard(title: "The layers a request travels through", caption: "Each protocol solves one problem and relies on the layer beneath it. Trace a request to see what each one did.") { // Course step 2.
            AsyncButton(title: "Trace a request on a fresh connection", action: trace) // Measures one request.
            LiveResult(phase: phase, retry: trace) { readings in // Spinner, rows, or error with Retry.
                VStack(alignment: .leading, spacing: 10) { // One block per layer.
                    ForEach(readings) { reading in // DNS first, HTTP last.
                        VStack(alignment: .leading, spacing: 2) { // Layer name, job and observation.
                            Text("\(reading.layer): \(reading.job)") // What the layer is for.
                                .font(.subheadline.weight(.semibold)) // Bold heading.
                            Text(reading.observed) // What it did this time.
                                .font(.system(.footnote, design: .monospaced)) // Measured facts look like code.
                        }
                    }
                }
            }
            if case .idle = phase { // Before the first trace, list the layers from the course.
                TermList(terms: [ // The course's five terms.
                    Term(term: "DNS", text: "Turns a name such as jsonplaceholder.typicode.com into an IP address, the way a contacts app turns a name into a phone number."), // Names.
                    Term(term: "IP", text: "Gives every machine an address and moves small packets toward it, hop by hop. Packets can be lost or arrive out of order."), // Addresses.
                    Term(term: "TCP", text: "Builds a reliable, ordered stream of bytes on top of IP by numbering packets and resending lost ones."), // Reliability.
                    Term(term: "TLS", text: "Encrypts the stream and proves, with a certificate, that the server is who it claims to be. It is the S in HTTPS."), // Security.
                    Term(term: "HTTP", text: "The request and response format your code works with: method, URL, headers, body and status code."), // Your layer.
                ])
            }
        }
        .autorun(trace) // Screenshots trace without a tap.
    }

    /// Measures one request on a brand-new session, so every layer has to do its work.
    private func trace() async { // Called by the button, Retry and -autorun.
        phase = .running // Shows the spinner.
        let session = URLSession(configuration: .ephemeral) // A new session has no open connections to reuse.
        defer { session.finishTasksAndInvalidate() } // Releases the session when we are done.
        phase = await .of { // Success or a readable error.
            let measured = try await measureJourney(url: Placeholder.url("todos/1"), session: session) // The real request.
            guard let report = measured.report else { throw URLError(.cannotParseResponse) } // No metrics: treat as a failure.
            return LayerReading.readings(for: report, host: Placeholder.base.host() ?? "", status: measured.status) // One row per layer.
        }
    }
}

/// "Latency, bandwidth and round trips": the arithmetic, plus a frozen versus a responsive main thread.
private struct LatencyCard: View { // Card 3.
    @State private var comparison = BatchComparison() // 30 items of 200 bytes, by default.
    @State private var note = "Watch the spinning gear, then tap a button." // What the main-thread demo says.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Latency, bandwidth and round trips", caption: "For small JSON replies, latency matters far more than bandwidth.") { // Course step 3.
            VStack(alignment: .leading) { // The round-trip slider and its value.
                Text("Round-trip time: \(comparison.rttMilliseconds) ms") // 20 ms is good Wi-Fi; 100 ms or more is busy cellular.
                    .font(.subheadline) // Readable size.
                Slider(value: Binding( // Slider works with Double; the model stores Int.
                    get: { Double(comparison.rttMilliseconds) }, // Int to Double for the slider.
                    set: { comparison.rttMilliseconds = Int($0) }), // Double back to Int.
                       in: 10...300, step: 10) // From fast Wi-Fi to a weak signal.
                    .accessibilityLabel("Round-trip time") // VoiceOver names the slider.
            }
            Picker("Bandwidth", selection: $comparison.bandwidthMbps) { // How much the connection carries per second.
                Text("1 Mbps").tag(1.0) // A weak signal.
                Text("10 Mbps").tag(10.0) // Typical cellular.
                Text("100 Mbps").tag(100.0) // Good Wi-Fi.
            }
            .pickerStyle(.segmented) // Three side-by-side buttons.
            ValueRow(label: "30 requests of 200 bytes", value: "\(Int(comparison.separateMilliseconds)) ms") // Pays 30 round trips.
            ValueRow(label: "1 request of 6,000 bytes", value: "\(Int(comparison.batchedMilliseconds)) ms") // Pays one.
            TermList(terms: [ // The course's two rules.
                Term(term: "Reuse connections", text: "URLSession keeps connections open, so the next request to the same server skips the setup. Card 6 measures it."), // Reuse.
                Term(term: "Make fewer requests", text: "One request that returns 20 items beats 20 requests that return one item each. Raise the bandwidth above: the 30 requests barely improve."), // Batch.
            ])
            Divider() // Separates the main-thread demo.
            HStack { // The live indicator and its explanation.
                TimelineView(.animation) { context in // Redraws every frame, but only while the main thread is free.
                    Image(systemName: "gearshape.fill") // Something that visibly moves.
                        .font(.largeTitle) // Big enough to watch.
                        .rotationEffect(.degrees(context.date.timeIntervalSinceReferenceDate * 120)) // 120 degrees per second.
                        .foregroundStyle(.tint) // The accent color.
                }
                Text(note) // What just happened.
                    .font(.subheadline) // Readable size.
            }
            VStack(alignment: .leading) { // The fix above the mistake.
                AsyncButton(title: "Wait 1 s with await") { // The fix: suspends without blocking.
                    note = "Waiting with await: the gear keeps turning." // Said before the wait.
                    try? await Task.sleep(for: .seconds(1)) // Suspends this task; the main thread keeps drawing.
                    note = "Done. The interface never froze." // Said after.
                }
                Button("Block the main thread for 1 s (the mistake)") { // The mistake, kept short on purpose.
                    Thread.sleep(forTimeInterval: 1) // Blocks the main thread: nothing redraws, taps are ignored.
                    note = "That froze everything for a second." // Only drawn once the thread is free again.
                }
                .buttonStyle(.bordered) // Same look as the other button.
                .tint(.red) // Red marks it as the thing not to do.
            }
            Callout(title: "Never block the main thread", text: "The main thread draws your interface. If it sits waiting for the network, the app freezes. Swift's await lets your code wait for a reply while the main thread keeps drawing.", systemImage: "exclamationmark.triangle") // The course's warning.
        }
    }
}

/// "Follow one request": step through the round trips of one HTTPS request.
private struct FollowRequestCard: View { // Card 4, the course's interactive panel.
    @State private var plan = RoundTripPlan() // HTTP/2, fresh connection, 50 ms by default.
    @State private var completed = 0 // How many round trips have finished.

    var body: some View { // Rebuilt when a control changes or a step completes.
        DemoCard(title: "Follow one request", caption: "Step through one HTTPS request. On a fresh connection, setup costs more than the request itself.") { // Course widget.
            Picker("Version", selection: $plan.version) { // HTTP/1.1, HTTP/2 or HTTP/3.
                ForEach(HTTPVersion.allCases) { Text($0.rawValue).tag($0) } // One segment per version.
            }
            .pickerStyle(.segmented) // Side-by-side buttons.
            Toggle("Reuse an open connection", isOn: $plan.reuseConnection) // Skips DNS, TCP and TLS.
            Stepper("Round-trip time: \(plan.rttMilliseconds) ms", value: $plan.rttMilliseconds, in: 10...300, step: 10) // Fast Wi-Fi to a weak signal.
            ForEach(plan.steps) { step in // One row per round trip.
                HStack(alignment: .top) { // Status icon beside the text.
                    Image(systemName: step.id <= completed ? "checkmark.circle.fill" : (step.id == completed + 1 ? "arrow.right.circle" : "circle")) // Done, next or waiting.
                        .foregroundStyle(step.id <= completed ? .green : .secondary) // Green once done.
                    VStack(alignment: .leading, spacing: 2) { // Title over detail.
                        Text("\(step.id). \(step.title)") // For example "2. TCP handshake".
                            .font(.subheadline.weight(.semibold)) // Bold title.
                        Text(step.detail) // What travels each way.
                            .font(.footnote) // Smaller.
                            .foregroundStyle(.secondary) // Quieter.
                    }
                }
            }
            ValueRow(label: "Round trips so far", value: "\(completed) of \(plan.roundTrips) (\(plan.setupRoundTrips) for setup)") // The counter the course asks you to watch.
            ValueRow(label: "Time so far", value: "\(completed * plan.rttMilliseconds) of \(plan.totalMilliseconds) ms") // Round trips times RTT.
            HStack { // Step and reset.
                Button("Next round trip") { completed = min(completed + 1, plan.roundTrips) } // One message out and its reply back.
                    .buttonStyle(.borderedProminent) // The main action.
                    .disabled(completed >= plan.roundTrips) // Nothing left to send.
                Button("Start over") { completed = 0 } // Back to the beginning.
                    .buttonStyle(.bordered) // Secondary.
            }
        }
        .onChange(of: plan) { completed = 0 } // Changing any control restarts the walk.
    }
}

/// "HTTP/1.1, HTTP/2 and HTTP/3": what each version changed, and which one URLSession picked just now.
private struct VersionsCard: View { // Card 5.
    @State private var version = HTTPVersion.http2 // The version being read about.
    @State private var phase = LivePhase<String>.idle // The protocol URLSession negotiated.

    var body: some View { // Rebuilt when the picker or phase changes.
        DemoCard(title: "HTTP/1.1, HTTP/2 and HTTP/3", caption: "The request format has stayed familiar since HTTP/1.1, but the way it travels has changed twice.") { // Course step 5.
            Picker("Version", selection: $version) { // Which version to read about.
                ForEach(HTTPVersion.allCases) { Text($0.rawValue).tag($0) } // One segment each.
            }
            .pickerStyle(.segmented) // Side-by-side buttons.
            Text("\(version.rawValue) (\(String(version.year)))") // For example "HTTP/2 (2015)"; String() avoids a thousands separator.
                .font(.subheadline.weight(.semibold)) // Bold heading.
            Text(version.summary) // What changed.
                .font(.subheadline) // Readable size.
                .fixedSize(horizontal: false, vertical: true) // Wraps fully.
            Callout(title: "URLSession chooses for you", text: "You never pick a version in code. URLSession agrees on HTTP/2 during the TLS handshake, and on iOS 15 and later it uses HTTP/3 once a server advertises support. Your URLRequest looks the same either way.", systemImage: "network") // The course's callout.
            AsyncButton(title: "Ask which version was used", action: ask) // A real request, then the metrics.
            LiveResult(phase: phase, retry: ask) { name in // Spinner, result, or error with Retry.
                ValueRow(label: "networkProtocolName", value: name) // h2 means HTTP/2, h3 means HTTP/3.
            }
        }
        .autorun(ask) // Screenshots run it without a tap.
    }

    /// Sends one request and reads networkProtocolName from its metrics.
    private func ask() async { // Called by the button and Retry.
        phase = .running // Shows the spinner.
        phase = await .of { // Success or a readable error.
            try await measureJourney(url: Placeholder.url("todos/1"), session: .shared).report?.protocolName ?? "unknown" // The negotiated protocol.
        }
    }
}

/// "Measuring the journey from Swift": the course's JourneyLogger on a fresh and on a reused connection.
private struct MeasureCard: View { // Card 6.
    @State private var session = URLSession(configuration: .ephemeral) // Kept between taps, so its connection can be reused.
    @State private var phase = LivePhase<JourneyReport>.idle // The last report.

    var body: some View { // Rebuilt when phase changes.
        DemoCard(title: "Measuring the journey from Swift", caption: "A delegate receives URLSessionTaskMetrics and prints the protocol, whether the connection was reused, the TLS time and the total.") { // Course step 6.
            AsyncButton(title: "Measure on a fresh connection") { await measure(fresh: true) } // New session: DNS, TCP and TLS all run.
            AsyncButton(title: "Measure again on the same connection") { await measure(fresh: false) } // Same session: the connection is reused.
            LiveResult(phase: phase, retry: { await measure(fresh: true) }) { report in // Spinner, report, or error with Retry.
                VStack(alignment: .leading, spacing: 6) { // The console, then the phases.
                    ConsoleView(lines: report.printedLines) // Exactly what the course's logger prints.
                    ValueRow(label: "DNS lookup", value: JourneyReport.milliseconds(report.dnsSeconds)) // nil on reuse.
                    ValueRow(label: "TCP connect", value: JourneyReport.milliseconds(report.connectSeconds)) // nil on reuse.
                    ValueRow(label: "TLS handshake", value: JourneyReport.milliseconds(report.tlsSeconds)) // nil on reuse.
                    ValueRow(label: "Server wait", value: JourneyReport.milliseconds(report.waitSeconds)) // Request sent to first byte.
                    ValueRow(label: "Download", value: JourneyReport.milliseconds(report.downloadSeconds)) // First byte to last.
                    Text(report.isReusedConnection ? "Reused: secureConnectionStartDate, connectStartDate and domainLookupStartDate were all nil, so those phases were skipped." : "Fresh: every setup phase ran. Measure again to reuse this connection.") // Answers the course's Try It question.
                        .font(.footnote) // Small explanatory text.
                        .foregroundStyle(.secondary) // Quieter than the numbers.
                }
            }
        }
        .autorun({ await measure(fresh: true) }) // Screenshots run it without a tap.
    }

    /// Measures GET /todos/1 on a new or the existing session.
    private func measure(fresh: Bool) async { // Called by both buttons and Retry.
        if fresh { // A fresh connection needs a fresh session.
            session.finishTasksAndInvalidate() // Releases the old one.
            session = URLSession(configuration: .ephemeral) // No open connections yet.
        }
        phase = .running // Shows the spinner.
        let session = session // A local copy for the closure below.
        phase = await .of { // Success or a readable error.
            guard let report = try await measureJourney(url: Placeholder.url("todos/1"), session: session).report else { throw URLError(.cannotParseResponse) } // Metrics are required.
            return report // The facts the logger collected.
        }
    }
}

#Preview { // Shows this lesson in Xcode's canvas.
    NavigationStack { AppTalksToServerLesson(lesson: ContentView.lessons[0]) } // Inside a stack, so the title shows.
}

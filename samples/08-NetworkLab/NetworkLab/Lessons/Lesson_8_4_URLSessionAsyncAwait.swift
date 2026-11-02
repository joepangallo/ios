// Lesson_8_4_URLSessionAsyncAwait.swift
// Who: the home screen opens this when the student taps lesson 8.4.
// What: URLSession with async/await: URLSession's main methods run for real
//       (and the old completion-handler style beside them), the course's
//       fetchTodo with every kind of failure on demand, a small API client, a
//       fetch timed phase by phase, the loading state as an enum, and a view
//       whose .task loads on appear and is cancelled when it disappears.
// Where: pushed onto the navigation stack by ContentView.
// When: whenever lesson 8.4 is opened; the .task demo loads when shown.
// Why: build the URL, await the response, check the status, decode: once
//      these four phases feel routine, every API in an app looks the same.

import SwiftUI // Views, controls and the .task modifier.

/// The lesson 8.4 screen: one card per step of the course page.
struct URLSessionAsyncAwaitLesson: View { // ContentView routes "8.4" here.
    let lesson: Lesson // The number, title and summary from the home screen.

    var body: some View { // Built once; each card keeps its own state.
        CardScroller { // Lets screenshots jump to a card with -card N.
            LessonPage(lesson: lesson) { // The shared scrolling page layout.
                MeetURLSessionCard().id(1) // Meet URLSession.
                FirstFetchCard().id(2) // Your first real fetch.
                APIClientCard().id(3) // A small API client.
                WatchRequestCard().id(4) // Watch a request happen.
                LoadStateCard().id(5) // Loading state as an enum.
                TaskModifierCard().id(6) // Calling it from SwiftUI with .task.
            }
        }
    }
}

/// Where a demo's requests go: the real network or the simulated server.
private enum Source: String, CaseIterable, Identifiable { // The raw value labels the picker.
    case real = "Real network" // jsonplaceholder.typicode.com.
    case offline = "Simulated: offline" // URLError.notConnectedToInternet.
    case serverError = "Simulated: 500" // A reply with status 500.
    case badJSON = "Simulated: bad JSON" // A 200 whose body does not match Todo.
    var id: String { rawValue } // The label doubles as the identity.

    /// The session that produces this behavior.
    var session: URLSession { // A new simulated session each time; the real one is shared.
        switch self { // One session per source.
        case .real: .shared // The real network.
        case .offline: SimulatedServer.session(always: .failure(.notConnectedToInternet)) // A transport failure.
        case .serverError: SimulatedServer.session(always: .json(#"{"error": "server crashed"}"#, status: 500)) // A bad status.
        case .badJSON: SimulatedServer.session(always: .json(#"{"id": "one", "title": 7}"#)) // A decoding failure.
        }
    }
}

/// Names which of the three kinds of error a caller received, as the course's Try It asks.
private func errorKind(_ error: any Error) -> String { // Used by the first-fetch card.
    switch error { // Pattern matching on the error's type.
    case is URLError: "Transport error (URLError): no usable response arrived." // Offline, timeout, DNS...
    case APIError.badStatus(let code): "Bad status (APIError.badStatus(\(code))): a reply arrived, but not a 2xx." // Our own error.
    case is DecodingError: "Decoding error (DecodingError): the JSON did not match Todo." // Bad data.
    default: "Other error: \(error.localizedDescription)" // Anything else.
    }
}

/// "Meet URLSession": its main methods, run for real, plus the completion-handler style.
private struct MeetURLSessionCard: View { // Card 1.
    @State private var lines: [String] = [] // One line per method tried.
    @State private var failure: String? // A readable error, if a call failed.

    var body: some View { // Rebuilt when lines or failure change.
        DemoCard(title: "Meet URLSession", caption: "The networking engine built into every Apple platform. You describe what you want; it handles how, off the main thread.") { // Course step 1.
            TermList(terms: [ // The course's terms.
                Term(term: "URLSession.shared", text: "A ready-made session with default settings, fine for most simple requests."), // The shared session.
                Term(term: "data(from:) and data(for:)", text: "Fetch a URL or send a URLRequest; returns the body as Data plus the URLResponse."), // The workhorse.
                Term(term: "upload and download", text: "upload(for:from:) sends a body; download(from:) saves a large file to disk."), // Big bodies.
                Term(term: "bytes(for:)", text: "Delivers the body as it arrives instead of waiting for all of it."), // Streaming.
                Term(term: "URLSessionConfiguration", text: "Builds custom sessions: timeouts, caching, cellular rules, extra headers."), // Custom sessions.
            ])
            HStack { // Two methods per row.
                AsyncButton(title: "data(from:)", action: dataFromDemo) // GET into memory.
                AsyncButton(title: "upload(for:from:)") { await run { // POST a body.
                    var request = URLRequest(url: Placeholder.url("posts")) // The posts collection.
                    request.httpMethod = "POST" // Uploads create things.
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type") // The body is JSON.
                    let (_, response) = try await URLSession.shared.upload(for: request, from: Data(#"{"title": "Hello"}"#.utf8)) // The body travels separately.
                    return "upload(for:from:): status \((response as? HTTPURLResponse)?.statusCode ?? 0)" // 201 Created.
                } }
            }
            HStack { // The other two methods.
                AsyncButton(title: "download(from:)") { await run { // Saves to a file.
                    let (file, _) = try await URLSession.shared.download(from: Placeholder.url("photos")) // 5,000 photo records, saved to disk.
                    let size = (try? FileManager.default.attributesOfItem(atPath: file.path())[.size] as? Int) ?? 0 // The file's size.
                    try? FileManager.default.removeItem(at: file) // The temporary file is ours to delete.
                    return "download(from:): a \(size / 1024) KB file on disk" // Too big to want in memory.
                } }
                AsyncButton(title: "bytes(for:)") { await run { // Streams the body.
                    let (bytes, _) = try await URLSession.shared.bytes(for: URLRequest(url: Placeholder.url("comments"))) // Returns as soon as headers arrive.
                    var count = 0 // Lines read so far.
                    for try await _ in bytes.lines { count += 1; if count == 50 { break } } // Reads 50 lines, then stops.
                    return "bytes(for:): read the first \(count) lines as they arrived" // Without waiting for the rest.
                } }
            }
            Callout(title: "Before async/await", text: "Older code passes a completion handler closure to dataTask(with:) and then calls resume(). You will meet it in existing projects; the async methods replace it.", systemImage: "clock.arrow.circlepath") // The course's history note.
            Button("Run the old completion-handler style") { // The same GET, the old way.
                let task = URLSession.shared.dataTask(with: Placeholder.url("todos/1")) { data, response, error in // The closure runs later, on a background queue.
                    let status = (response as? HTTPURLResponse)?.statusCode ?? 0 // Copied out before hopping threads.
                    let count = data?.count ?? 0 // Same.
                    let message = error.flatMap { userMessage(for: $0) } // A readable error, if any.
                    Task { @MainActor in // State must change on the main actor.
                        if let message { failure = message } else { lines.append("dataTask + resume(): status \(status), \(count) bytes") } // Shows the outcome.
                    }
                }
                task.resume() // Nothing happens until resume() is called.
            }
            .buttonStyle(.bordered) // Looks tappable.
            ConsoleView(lines: lines) // What each method reported.
            if let failure { ErrorBox(message: failure) { self.failure = nil } } // Retry clears the message; tap a method again.
        }
        .autorun(dataFromDemo) // Screenshots run it without a tap.
    }

    /// data(from:): the whole body arrives in memory as Data.
    private func dataFromDemo() async { // Called by the first button and -autorun.
        await run { // Records the line or a readable error.
            let (data, _) = try await URLSession.shared.data(from: Placeholder.url("todos/1")) // The whole body as Data.
            return "data(from:): \(data.count) bytes in memory" // How much arrived.
        }
    }

    /// Runs one demo call and records its line or a readable error.
    private func run(_ work: () async throws -> String) async { // Shared by the four method buttons.
        do { lines.append(try await work()); failure = nil } catch { failure = userMessage(for: error) } // Success adds a line; failure shows a message.
    }
}

/// "Your first real fetch": the course's fetchTodo, with every kind of failure on demand.
private struct FirstFetchCard: View { // Card 2.
    @State private var id = 1 // Which to-do to fetch.
    @State private var source = Source.real // Where the request goes.
    @State private var outcome: String? // The decoded to-do or the error's kind.

    var body: some View { // Rebuilt when a control or the outcome changes.
        DemoCard(title: "Your first real fetch", caption: "Build the URL, await the response, check the status, decode. Every failure arrives as a thrown error.") { // Course step 2.
            Stepper("To-do id: \(id)", value: $id, in: 0...201) // 1 to 200 exist; 0 and 201 answer 404.
            Picker("Source", selection: $source) { // Real network or a simulated failure.
                ForEach(Source.allCases) { Text($0.rawValue).tag($0) } // One entry each.
            }
            .pickerStyle(.menu) // A compact menu.
            AsyncButton(title: "await fetchTodo(id: \(id))", action: fetch) // Runs the course's function.
            if let outcome { // After the first fetch.
                Text(outcome) // The to-do, or which kind of error came back.
                    .font(.system(.footnote, design: .monospaced)) // Fixed width.
                    .fixedSize(horizontal: false, vertical: true) // Wraps fully.
                if outcome.hasPrefix("Transport") { AsyncButton(title: "Retry", action: fetch) } // Offline: offer to try again.
            }
            Text("The three kinds of error a caller can receive: a URLError when no response arrives, APIError.badStatus when the status is not 2xx, and a DecodingError when the JSON does not match.") // Answers the course's Try It.
                .font(.footnote) // Small note.
                .foregroundStyle(.secondary) // Quieter.
        }
        .autorun(fetch) // Screenshots run it without a tap.
    }

    /// Calls fetchTodo with the chosen source and describes the outcome.
    private func fetch() async { // Called by the button and Retry.
        do { // fetchTodo throws for every failure.
            let todo = try await fetchTodo(id: id, session: source.session) // The four phases.
            outcome = "Decoded Todo: id \(todo.id), userId \(todo.userId), \"\(todo.title)\", completed \(todo.completed)" // Typed values.
        } catch { // One of the three kinds.
            outcome = errorKind(error) + "\nMessage for the user: " + (userMessage(for: error) ?? "(none)") // The kind and the friendly sentence.
        }
    }
}

/// "A small API client": views ask PlaceholderClient for posts and never see a URL.
private struct APIClientCard: View { // Card 3.
    @State private var userId = 1 // Whose posts to fetch.
    @State private var phase = LivePhase<[Post]>.idle // The live result.
    private let client = PlaceholderClient() // Knows the address and query items; the view does not.

    var body: some View { // Rebuilt when the stepper or phase changes.
        DemoCard(title: "A small API client", caption: "One type gathers one API's calls. This view calls client.posts(userId:) and gets typed posts back; the session is injectable for tests.") { // Course step 3.
            Stepper("User id: \(userId)", value: $userId, in: 1...10) // JSONPlaceholder has ten users.
            AsyncButton(title: "await client.posts(userId: \(userId))", action: load) // The client's method.
            LiveResult(phase: phase, retry: load) { posts in // Spinner, titles, or error with Retry.
                VStack(alignment: .leading, spacing: 4) { // The posts.
                    Text("\(posts.count) posts by user \(userId)") // Each user wrote ten.
                        .font(.subheadline.weight(.semibold)) // Bold.
                    ForEach(posts.prefix(3)) { Text("#\($0.id) \($0.title)").font(.footnote) } // The first three titles.
                }
            }
        }
        .autorun(load) // Screenshots run it without a tap.
        .onChange(of: userId) { phase = .idle } // A different user clears the old list.
    }

    /// Asks the client for the chosen user's posts.
    private func load() async { // Called by the button and Retry.
        phase = .running // Shows the spinner.
        let userId = userId // A fixed copy for the closure.
        phase = await .of { try await client.posts(userId: userId) } // Success or a readable error.
    }
}

/// "Watch a request happen": each phase of a fetch, timed for real.
private struct WatchRequestCard: View { // Card 4, the course's live widget.
    @State private var phases: [PhaseTiming] = [] // The measured phases.
    @State private var result = "" // The final line, or why it stopped.

    var body: some View { // Rebuilt when phases change.
        DemoCard(title: "Watch a request happen", caption: "Each row lights up as its phase actually happens; the times are measured, not invented. Fetch the same to-do twice and compare, then try an invalid id.") { // Course widget.
            HStack { // Three ways to run it.
                AsyncButton(title: "To-do 1") { await run(id: 1) } // A normal fetch.
                AsyncButton(title: "Again") { await run(id: 1) } // The connection is reused now.
                AsyncButton(title: "Invalid id 0") { await run(id: 0) } // 404 at the status phase.
            }
            ForEach(phases) { phase in // One row per phase that ran.
                HStack { // Icon, name, time.
                    Image(systemName: phase.succeeded ? "checkmark.circle.fill" : "xmark.circle.fill") // Passed or stopped here.
                        .foregroundStyle(phase.succeeded ? .green : .red) // Green or red.
                    Text(phase.name) // For example "Await the response".
                        .font(.subheadline) // Readable size.
                    Spacer() // Pushes the time right.
                    Text("\(phase.milliseconds) ms") // Measured.
                        .font(.caption.monospacedDigit()) // Steady digits.
                }
            }
            if !result.isEmpty { // After a run.
                Text(result) // What the screen state would show.
                    .font(.subheadline.weight(.semibold)) // Bold.
                if let last = phases.last, !last.succeeded, last.name == "Await the response" { // No reply arrived: a network failure.
                    AsyncButton(title: "Retry") { await run(id: 1) } // Offers to try again.
                }
            }
        }
        .autorun { await run(id: 1) } // Screenshots run it without a tap.
    }

    /// Runs the timed fetch and stores its rows.
    private func run(id: Int) async { // Called by the buttons and -autorun.
        phases = [] // Clears the old rows.
        result = "" // And the old line.
        (phases, result) = await timedFetch(id: id) // The measured phases.
    }
}

/// A small chip that lights up when its state is the current one.
private struct StateChip: View { // Used by the loading-state cards.
    let name: String // The case name.
    let isCurrent: Bool // Whether the model is in this state now.

    var body: some View { // Rebuilt when isCurrent changes.
        Text(name) // "idle", "loading", "loaded" or "failed".
            .font(.caption.monospaced()) // Code-like.
            .padding(.horizontal, 8) // Pill shape...
            .padding(.vertical, 4) // ...with a little height.
            .background(isCurrent ? AnyShapeStyle(.tint) : AnyShapeStyle(.fill.tertiary), in: .capsule) // Tinted when current.
            .foregroundStyle(isCurrent ? .white : .primary) // Readable on either background.
    }
}

/// Shows the four LoadState chips with the current one lit.
private struct StateChips: View { // Used by cards 5 and 6.
    let state: LoadState // The model's current state.

    var body: some View { // Rebuilt when the state changes.
        HStack { // Four chips in a row.
            ForEach(["idle", "loading", "loaded", "failed"], id: \.self) { StateChip(name: $0, isCurrent: $0 == state.name) } // Lights the current case.
        }
    }
}

/// "Loading state as an enum": drive TodoModel and watch it move between its four cases.
private struct LoadStateCard: View { // Card 5.
    @State private var failing = false // Whether the next load should fail.
    @State private var model = TodoModel(delay: .milliseconds(600)) // A short pause so loading is visible.

    var body: some View { // Rebuilt when the model's state changes.
        DemoCard(title: "Loading state as an enum", caption: "An enum makes impossible combinations, such as a spinner and stale data at once, unrepresentable. @Observable lets SwiftUI watch state.") { // Course step 5.
            StateChips(state: model.state) // Which case the model is in.
            Toggle("Simulate offline", isOn: $failing) // Switches the model's session.
            AsyncButton(title: "await model.load(id: 1)") { await model.load(id: 1) } // Moves idle to loading to loaded or failed.
            switch model.state { // The same switch a real screen uses.
            case .idle: Text("Nothing requested yet.").font(.footnote) // idle.
            case .loading: ProgressView("Loading to-do") // loading.
            case .loaded(let todo): Text("loaded(Todo #\(todo.id): \(todo.title))").font(.footnote.monospaced()) // The data travels with the state.
            case .failed(let message): Text("failed(\"\(message)\")").font(.footnote.monospaced()) // The message travels with the state.
            }
        }
        .autorun({ await model.load(id: 1) }) // Screenshots run it without a tap.
        .onChange(of: failing) { // A new session needs a new model.
            model = TodoModel(session: failing ? Source.offline.session : .shared, delay: .milliseconds(600)) // Back to idle with the chosen session.
        }
    }
}

/// The course's WeatherView, adapted to a to-do: it owns its model and loads with .task.
private struct TodoScreen: View { // Shown and hidden by card 6.
    let slow: Bool // Adds a 2-second pause so cancellation is easy to trigger.
    let log: (String) -> Void // Reports task events to the card.
    @State private var model: TodoModel // Created once and kept across body recomputations.

    init(slow: Bool, log: @escaping (String) -> Void) { // Builds the model with the chosen pause.
        self.slow = slow // Stored for reference.
        self.log = log // Stored for the task.
        _model = State(initialValue: TodoModel(delay: slow ? .seconds(2) : .zero)) // The underscore reaches the State wrapper itself.
    }

    var body: some View { // Rebuilt whenever model.state changes.
        VStack(spacing: 12) { // The .task modifier attaches to this stack.
            StateChips(state: model.state) // Which case the model is in.
            switch model.state { // Chooses content from the state.
            case .idle, .loading: // Not started, or in flight.
                ProgressView("Loading to-do") // A labeled spinner.
            case .loaded(let todo): // Success: the payload is bound here.
                Text("#\(todo.id) \(todo.title)") // Shown only in this branch.
            case .failed(let message): // Failure: the message is bound here.
                Text(message) // The friendly sentence.
                Button("Try Again") { Task { await load() } } // A Button action is synchronous, so a Task calls async code.
            }
        }
        .frame(maxWidth: .infinity) // Centered in the card.
        .padding() // Breathing room.
        .background(.fill.quaternary, in: .rect(cornerRadius: 12)) // Looks like a little screen.
        .task { // Starts when the view appears; cancelled automatically if it disappears first.
            log("task started") // The view appeared.
            await load() // Loads the to-do.
            log(Task.isCancelled ? "task cancelled: the view disappeared before the reply" : "task finished: state is \(model.state.name)") // Which way it ended.
        }
    }

    /// Wraps the model call with this screen's to-do id.
    private func load() async { // Called from .task and Try Again.
        await model.load(id: 1) // Both callers share the id.
    }
}

/// "Calling it from SwiftUI with .task": show the screen, hide it mid-load, read the log.
private struct TaskModifierCard: View { // Card 6.
    @State private var showScreen = true // Whether the to-do screen is in the view tree.
    @State private var slow = false // Whether loading takes two seconds.
    @State private var events: [String] = [] // What the task reported.

    var body: some View { // Rebuilt when a toggle changes or an event arrives.
        DemoCard(title: "Calling it from SwiftUI with .task", caption: ".task starts the load when the view appears and cancels it if the view disappears first. Turn on the slow network, then hide the screen before it finishes.") { // Course step 6.
            Toggle("Slow network (2 s)", isOn: $slow) // Makes cancellation easy to trigger.
            Toggle("Show the to-do screen", isOn: $showScreen.animation()) // Adds or removes the view.
            if showScreen { // Only in the tree while shown.
                TodoScreen(slow: slow) { events.append($0) } // Its .task runs on appear.
                    .id(slow) // A new identity when the speed changes, so it reloads.
            }
            ConsoleView(lines: events) // The task's own report.
        }
    }
}

#Preview { // Shows this lesson in Xcode's canvas.
    NavigationStack { URLSessionAsyncAwaitLesson(lesson: ContentView.lessons[3]) } // Inside a stack, so the title shows.
}

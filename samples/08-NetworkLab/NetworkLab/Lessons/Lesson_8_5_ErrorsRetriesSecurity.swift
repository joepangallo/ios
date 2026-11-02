// Lesson_8_5_ErrorsRetriesSecurity.swift
// Who: the home screen opens this when the student taps lesson 8.5.
// What: Errors, Retries and Security: real and simulated failures turned into
//       sentences, retry with exponential backoff (and the decision whether to
//       retry at all), an idempotency key that keeps a retried POST from
//       creating two orders, the retry-storm lab, search that cancels stale
//       requests, certificates and App Transport Security, a string constant
//       found inside this app's binary, and a Keychain token in an
//       Authorization: Bearer header.
// Where: pushed onto the navigation stack by ContentView.
// When: whenever lesson 8.5 is opened; nothing runs until a button is tapped.
// Why: on a phone, failure is normal; telling failures apart, retrying only
//      what is safe and keeping secrets off the device are the habits that
//      make an app feel reliable.

import SwiftUI // Views, controls and NavigationLink.
import Charts // Swift Charts, for the retry lab's load graph.

/// The lesson 8.5 screen: one card per step of the course page.
struct ErrorsRetriesSecurityLesson: View { // ContentView routes "8.5" here.
    let lesson: Lesson // The number, title and summary from the home screen.

    var body: some View { // Built once; each card keeps its own state.
        CardScroller { // Lets screenshots jump to a card with -card N.
            LessonPage(lesson: lesson) { // The shared scrolling page layout.
                FailuresCard().id(1) // Everything that can go wrong.
                MessagesCard().id(2) // Turn errors into messages.
                BackoffCard().id(3) // Retry with exponential backoff.
                IdempotencyCard().id(4) // Make a POST safe to retry.
                RetryLabCard().id(5) // Retry lab.
                CancelSearchCard().id(6) // Cancel work nobody needs.
                CertificatesCard().id(7) // HTTPS, certificates and App Transport Security.
                SecretCard().id(8) // Never ship a secret in the app.
                TokenCard().id(9) // Read a token and authorize a request.
            }
        }
    }
}

/// The failures the first card can cause, real or simulated.
private enum Failure: String, CaseIterable, Identifiable { // The raw value labels the button.
    case dns = "Unknown host" // Real: a name that can never resolve.
    case timeout = "Timeout" // Real: a real request with a tiny timeout.
    case offline = "Offline" // Simulated: the simulated server reports no connection.
    case unavailable = "503" // Simulated: a reply with status 503.
    case badData = "Bad JSON" // Simulated: a reply that does not match Todo.
    var id: String { rawValue } // The label doubles as the identity.

    /// Whether the failure really happens on the network, rather than in the simulated server.
    var isReal: Bool { self == .dns || self == .timeout } // The other three are simulated.

    /// Runs the failing request and returns the error it threw.
    func trigger() async -> (any Error)? { // nil if, surprisingly, nothing failed.
        do { // Each case fails in its own way.
            switch self { // One request per case.
            case .dns: _ = try await URLSession.shared.data(from: URL(string: "https://no-such-host.invalid/")!) // .invalid never exists, by standard.
            case .timeout: // A real server, an impossible deadline.
                var request = URLRequest(url: Placeholder.url("todos/1")) // A normal request...
                request.timeoutInterval = 0.001 // ...that gives up after one millisecond.
                _ = try await URLSession.shared.data(for: request) // Throws URLError.timedOut.
            case .offline: _ = try await fetchTodo(id: 1, session: SimulatedServer.session(always: .failure(.notConnectedToInternet))) // Airplane mode, simulated.
            case .unavailable: _ = try await fetchTodo(id: 1, session: SimulatedServer.session(always: .json("{}", status: 503))) // Throws APIError.badStatus(503).
            case .badData: _ = try await fetchTodo(id: 1, session: SimulatedServer.session(always: .json(#"{"id": "1"}"#))) // Throws a DecodingError.
            }
            return nil // No error.
        } catch { // The expected path.
            return error // Hands the error back to be described.
        }
    }
}

/// "Everything that can go wrong": cause real and simulated failures; compare the raw error with the sentence.
private struct FailuresCard: View { // Card 1.
    @State private var raw = "" // The error as the system describes it.
    @State private var friendly = "" // The sentence from userMessage(for:).

    var body: some View { // Rebuilt when the texts change.
        DemoCard(title: "Everything that can go wrong", caption: "Each kind of failure deserves a different response, so your code has to tell them apart. Cause one and compare the two descriptions.") { // Course step 1.
            TermList(terms: [ // The course's five kinds.
                Term(term: "No connection", text: "URLError .notConnectedToInternet or .networkConnectionLost. Show saved data if you have it, plus a calm offline message."), // Offline.
                Term(term: "Timeout or unreachable", text: ".timedOut, .cannotFindHost (the DNS lookup failed) or .cannotConnectToHost. Often temporary."), // Slow or down.
                Term(term: "Bad status", text: "A reply arrived with 4xx or 5xx. URLSession does not throw; your status check does."), // Bad news.
                Term(term: "Bad data", text: "DecodingError: the JSON does not match your model. Retrying will not help, so report it."), // Mismatch.
                Term(term: "Cancelled", text: "URLError .cancelled or CancellationError: your own code stopped the work. Show nothing."), // On purpose.
            ])
            ForEach([true, false], id: \.self) { real in // One row of real failures, one of simulated ones.
                HStack { // The row's label and buttons.
                    Text(real ? "Real:" : "Simulated:") // Says which kind this row causes.
                        .font(.caption.weight(.semibold)) // A small bold label.
                    ForEach(Failure.allCases.filter { $0.isReal == real }) { failure in // The failures of this kind.
                        AsyncButton(title: failure.rawValue) { await cause(failure) } // Causes it.
                    }
                }
            }
            if !raw.isEmpty { // After the first failure.
                Text("What the system says") // Heading.
                    .font(.caption.weight(.semibold)) // Small bold.
                Text(verbatim: raw) // The raw description.
                    .font(.system(.caption, design: .monospaced)) // Code-like.
                    .fixedSize(horizontal: false, vertical: true) // Wraps fully.
                Text("What the person sees") // Heading.
                    .font(.caption.weight(.semibold)) // Small bold.
                Text(friendly) // The sentence.
                    .font(.subheadline) // Readable.
            }
            Callout(title: "Write messages for people", text: "\"The operation couldn't be completed (NSURLErrorDomain error -1009)\" means nothing to a user. \"You appear to be offline. Showing saved results.\" tells them what happened and what they still have.", systemImage: "text.bubble") // The course's design note.
        }
        .autorun({ await cause(.dns) }) // Screenshots run it without a tap.
    }

    /// Causes one failure and stores both descriptions.
    private func cause(_ failure: Failure) async { // Called by the buttons.
        guard let error = await failure.trigger() else { raw = "No error."; friendly = ""; return } // Nothing failed.
        let ns = error as NSError // Every Swift error bridges to NSError, which has a domain and a code.
        raw = "\(ns.domain) \(ns.code): \(ns.localizedDescription)" // The system's view.
        friendly = userMessage(for: error) ?? "(nothing: cancellation is not shown)" // The person's view.
    }
}

/// "Turn errors into messages": every branch of userMessage(for:) at a glance.
private struct MessagesCard: View { // Card 2.
    /// One sample error per branch of the function, with a label.
    private static let samples: [(label: String, error: any Error)] = [ // Labels as the course names them.
        ("CancellationError()", CancellationError()), // Swift cancelled the task.
        ("URLError(.cancelled)", URLError(.cancelled)), // URLSession cancelled the task.
        ("URLError(.notConnectedToInternet)", URLError(.notConnectedToInternet)), // Airplane mode.
        ("URLError(.networkConnectionLost)", URLError(.networkConnectionLost)), // Signal dropped mid-request.
        ("URLError(.timedOut)", URLError(.timedOut)), // Too slow.
        ("URLError(.cannotFindHost)", URLError(.cannotFindHost)), // DNS failed.
        ("URLError(.cannotConnectToHost)", URLError(.cannotConnectToHost)), // Refused.
        ("URLError(.serverCertificateUntrusted)", URLError(.serverCertificateUntrusted)), // The default branch.
        ("DecodingError", DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: "bad"))), // Bad data.
        ("APIError.badStatus(500)", APIError.badStatus(500)), // The fallback.
    ]

    var body: some View { // Static: the table never changes.
        DemoCard(title: "Turn errors into messages", caption: "One function translates any error into a sentence a person can act on, or nil when nothing should be shown at all.") { // Course step 2.
            ForEach(Self.samples, id: \.label) { sample in // One row per branch.
                VStack(alignment: .leading, spacing: 2) { // The error over its message.
                    Text(sample.label) // The error.
                        .font(.caption.monospaced()) // Code-like.
                    Text(userMessage(for: sample.error).map { "\"\($0)\"" } ?? "nil: show nothing") // The function's answer.
                        .font(.subheadline) // Readable.
                        .foregroundStyle(.secondary) // Quieter than the error.
                }
            }
        }
    }
}

/// "Retry with exponential backoff": the course's flaky server and withRetry, with real waits.
private struct BackoffCard: View { // Card 3.
    @State private var failures = 2 // The course's server fails twice.
    @State private var attempts = 4 // The course retries up to four times.
    @State private var useJitter = false // Random waits instead of exact ones.
    @State private var log: [String] = [] // What the run printed.
    @State private var method = HTTPMethod.get // For the retry decision.
    @State private var errorChoice = 0 // Which error the decision is about.
    private static let decisionErrors: [(label: String, error: any Error)] = [ // Errors to ask about.
        ("Timed out", URLError(.timedOut)), // Temporary.
        ("Offline", URLError(.notConnectedToInternet)), // Show the offline message instead.
        ("503", APIError.badStatus(503)), // Temporary server trouble.
        ("404", APIError.badStatus(404)), // Will fail the same way again.
        ("Bad JSON", DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: "bad"))), // Will fail again.
        ("Cancelled", CancellationError()), // On purpose.
    ]

    var body: some View { // Rebuilt when a control or the log changes.
        DemoCard(title: "Retry with exponential backoff", caption: "Wait longer after each failure: 200, 400, 800 ms. The defaults reproduce the course's output exactly.") { // Course step 3.
            Stepper("Server fails the first \(failures) calls", value: $failures, in: 0...6) // How flaky the server is.
            Stepper("Attempts: \(attempts)", value: $attempts, in: 1...6) // How many tries in total.
            Toggle("Add jitter (random wait up to the delay)", isOn: $useJitter) // Spreads phones out.
            ValueRow(label: "Planned waits", value: Backoff.schedule(attempts: attempts).map { "\($0) ms" }.joined(separator: ", ")) // 200, 400, 800...
            AsyncButton(title: "Run withRetry", action: run) // Really waits between attempts.
            ConsoleView(lines: log) // The printed lines.
            Divider() // Separates the decision helper.
            Text("Should the app retry automatically?") // The other half of retrying.
                .font(.subheadline.weight(.semibold)) // Heading.
            Picker("Method", selection: $method) { // GET, POST...
                ForEach(HTTPMethod.allCases) { Text($0.rawValue).tag($0) } // One segment each.
            }
            .pickerStyle(.segmented) // Side by side.
            Picker("Error", selection: $errorChoice) { // Which failure.
                ForEach(Self.decisionErrors.indices, id: \.self) { Text(Self.decisionErrors[$0].label).tag($0) } // One entry each.
            }
            .pickerStyle(.menu) // A compact menu.
            Text(Backoff.shouldRetry(Self.decisionErrors[errorChoice].error, method: method) ? "Yes: retry with backoff." : "No: show a message instead.") // The rule's answer.
                .font(.subheadline.weight(.semibold)) // Bold.
        }
        .autorun(run) // Screenshots run it without a tap.
    }

    /// Runs the course's program with the chosen settings, logging each line.
    private func run() async { // Called by the button and -autorun.
        log = [] // A fresh console.
        let server = FlakyServer(failures: failures) // A new server each run.
        do { // The last attempt may still fail.
            let result = try await withRetry(attempts: attempts, // Up to this many tries.
                                             jitter: useJitter ? { Backoff.jittered($0) } : nil, // Random waits if chosen.
                                             log: { log.append($0) }) { try await server.fetch() } // Each failure is logged.
            log.append(result) // print(try await withRetry(...))
        } catch { // Every attempt failed.
            log.append("Gave up after \(await server.callCount) calls: \(userMessage(for: error) ?? "cancelled")") // Giving up eventually is essential.
        }
    }
}

/// "Make a POST safe to retry": the same key on every attempt creates one order.
private struct IdempotencyCard: View { // Card 4.
    @State private var reuseKey = true // The right way: one key per order.
    @State private var log: [String] = [] // What happened.
    private let sample = PendingOrder(items: ["notebook"], idempotencyKey: "3F2504E0-4F89-11D3-9A0C-0305E82C3301") // A fixed key, so the request text is stable.

    var body: some View { // Rebuilt when the toggle or log changes.
        DemoCard(title: "Make a POST safe to retry", caption: "The app creates a unique key once, stores it with the pending order, and sends it in an Idempotency-Key header on every attempt.") { // Course step 4.
            if let request = try? createOrderRequest(sample) { // The course's builder.
                Text(verbatim: rawRequestText(request)) // POST /orders with both headers and the body.
                    .font(.system(.caption2, design: .monospaced)) // Small fixed width.
                    .padding(8) // Space inside the box.
                    .frame(maxWidth: .infinity, alignment: .leading) // Full width.
                    .background(.fill.tertiary, in: .rect(cornerRadius: 8)) // A light box.
            }
            Toggle("Reuse the stored key on every attempt", isOn: $reuseKey) // Off: a new UUID per attempt, the mistake.
            AsyncButton(title: "Place an order; the first two replies are lost") { // Three attempts against the pretend server.
                log = (try? await placeOrderLosingReplies(reuseKey: reuseKey, attempts: 3, desk: OrderDesk())) ?? ["Could not build the request."] // A fresh server each run.
            }
            ConsoleView(lines: log) // One order, or three.
            Text("This order server is simulated inside the app; api.example.com is never contacted.") // Honest labeling.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quieter.
        }
        .autorun({ log = (try? await placeOrderLosingReplies(reuseKey: reuseKey, attempts: 3, desk: OrderDesk())) ?? [] }) // Screenshots run it without a tap.
    }
}

/// "Retry lab": 200 phones hit a server the moment it recovers.
private struct RetryLabCard: View { // Card 5, the course's retry lab.
    @State private var strategy = RetryStrategy.backoffJitter // The strategy being compared.

    var body: some View { // Rebuilt when the strategy changes.
        let result = simulateRetryStorm(strategy: strategy) // Instant and deterministic.
        DemoCard(title: "Retry lab", caption: "Two hundred simulated phones hit a server that can answer 40 requests per 100 ms. Compare the strategies: watch the load against the capacity line.") { // Course widget.
            Picker("Strategy", selection: $strategy) { // The four strategies.
                ForEach(RetryStrategy.allCases) { Text($0.shortName).tag($0) } // One short segment each, so none is cut off.
            }
            .pickerStyle(.segmented) // Side by side.
            Chart { // Requests per 100 ms slot.
                ForEach(Array(result.loadPerSlot.enumerated()), id: \.offset) { slot, load in // One bar per slot.
                    BarMark(x: .value("Time (ms)", slot * 100), y: .value("Requests", load)) // Height is the load.
                        .foregroundStyle(load > 40 ? .red : .blue) // Red when over capacity.
                }
                RuleMark(y: .value("Capacity", 40)) // The server's limit.
                    .foregroundStyle(.secondary) // A quiet line.
                    .annotation(position: .top, alignment: .trailing) { Text("capacity 40").font(.caption2) } // Labels it.
            }
            .frame(height: 160) // A compact chart.
            Text("Strategy: \(strategy.rawValue)") // The full name under the short segment label.
                .font(.subheadline.weight(.semibold)) // Bold.
            ValueRow(label: "Phones that got an answer", value: "\(result.succeeded) of 200") // Success.
            ValueRow(label: "Phones that gave up", value: "\(result.gaveUp)") // Failure.
            ValueRow(label: "Wasted requests (rejected)", value: "\(result.wasted)") // Load for nothing.
            ValueRow(label: "Peak load after the first burst", value: "\(result.loadPerSlot.dropFirst().max() ?? 0)") // Lockstep retries spike here.
            Text("Cause real failures in the first card: a genuine timeout and a genuine DNS failure; the 503 there is simulated, because a healthy public server will not send one on request.") // Where the real failures are.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quieter.
        }
    }
}

/// The course's SearchView, searching the practice API's posts as you type.
private struct SearchScreen: View { // Pushed by card 6.
    @State private var query: String // The text in the search field; doubles as the task id.
    @State private var results: [Post] = [] // The latest results.
    @State private var errorMessage: String? // Why the last search failed.
    @State private var attempt = 0 // Bumped by Retry, to rerun the same search.
    @State private var stats = (keystrokes: 0, started: 0, cancelled: 0) // What the debounce saved.

    init(initialQuery: String = "") { _query = State(initialValue: initialQuery) } // Empty, unless a screenshot passes -search.

    var body: some View { // Rebuilt when query, results or stats change.
        List { // The screen's one list.
            Section("Requests") { // The counters.
                Text("Keystrokes: \(stats.keystrokes). Searches sent: \(stats.started). Cancelled before or during sending: \(stats.cancelled).") // The saving, in numbers.
                    .font(.footnote) // Small.
                if let errorMessage { // After a real failure.
                    Text(errorMessage).foregroundStyle(.orange) // The readable reason.
                    Button("Retry") { attempt += 1 } // Changing the id reruns the task.
                }
            }
            Section("Results") { // The matches.
                ForEach(results) { Text($0.title) } // One row per post.
            }
        }
        .navigationTitle("Search posts") // The pushed screen's title.
        .searchable(text: $query, prompt: "Try: qui est esse") // A system search field bound to query.
        .onChange(of: query) { stats.keystrokes += 1 } // Counts every change to the text.
        .task(id: "\(query)#\(attempt)") { // Runs now, and again whenever query (or attempt) changes, cancelling the previous run.
            do { // Both sleeping and searching can throw.
                try await Task.sleep(for: .milliseconds(300)) // Debounce: another key within 300 ms cancels this sleep.
                guard !query.isEmpty, let url = searchURL(for: query) else { results = []; return } // Nothing to search for.
                stats.started += 1 // The search really goes out.
                let (data, response) = try await URLSession.shared.data(from: url) // A cancelled task cancels this request too.
                try validate(response) // 2xx only.
                results = try JSONDecoder().decode([Post].self, from: data) // Updates on the main actor.
                errorMessage = nil // A success clears an old message.
            } catch { // Cancellation and real failures alike.
                if Task.isCancelled { stats.cancelled += 1; return } // A newer run is in charge: leave quietly.
                results = [] // A genuine failure clears the list...
                errorMessage = userMessage(for: error) // ...and says why.
            }
        }
    }
}

/// "Cancel work nobody needs": opens the course's search screen.
private struct CancelSearchCard: View { // Card 6.
    @State private var showSearch = false // True while the search screen is pushed.

    var body: some View { // Static apart from the button.
        DemoCard(title: "Cancel work nobody needs", caption: ".task(id:) restarts its task whenever the id changes and cancels the previous one. A 300 ms sleep at the start is a debounce.") { // Course step 6.
            Button { showSearch = true } label: { // Pushes the search screen onto the stack.
                Label("Open the search screen and type quickly", systemImage: "magnifyingglass") // What to do there.
            }
            Text("Type a word quickly: most keystrokes are cancelled during the 300 ms sleep, before they ever touch the network. The counters at the top show how many searches were really sent.") // What to watch.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quieter.
        }
        .navigationDestination(isPresented: $showSearch) { // The stack pushes this while showSearch is true.
            SearchScreen(initialQuery: LaunchOptions.searchText ?? "") // List + .searchable + .task(id: query).
        }
        .task { if LaunchOptions.searchText != nil { showSearch = true } } // Screenshots open it without a tap.
    }
}

/// "HTTPS, certificates and App Transport Security": inspect a real certificate, pin it, and watch ATS block http.
private struct CertificatesCard: View { // Card 7.
    @State private var facts = TrustFacts() // What the last handshake revealed.
    @State private var outcome = "" // What happened to the connection.

    var body: some View { // Rebuilt when facts or outcome change.
        DemoCard(title: "HTTPS, certificates and App Transport Security", caption: "TLS gives every HTTPS connection encryption and authentication: the server proves its identity with a certificate signed by an authority iOS trusts.") { // Course step 7.
            AsyncButton(title: "Inspect the server's certificates") { await inspect(pins: []) } // No pinning.
            AsyncButton(title: "Pin the key seen just now, then reconnect") { await inspect(pins: Set([facts.leafKeyHash].compactMap { $0 })) } // The real key: allowed.
                .disabled(facts.leafKeyHash == nil) // Needs an inspection first.
            AsyncButton(title: "Pin a wrong key, then reconnect") { await inspect(pins: [String(repeating: "0", count: 64)]) } // A key the server does not have: refused.
            AsyncButton(title: "Load over plain http:// (ATS)", action: plainHTTP) // App Transport Security blocks it.
            if !outcome.isEmpty { // After the first try.
                Text(outcome) // What happened.
                    .font(.subheadline.weight(.semibold)) // Bold.
                ForEach(Array(facts.chain.enumerated()), id: \.offset) { index, name in // Server first, authority last.
                    ValueRow(label: index == 0 ? "Server" : "Issuer \(index)", value: name) // Who signed whom.
                }
                if let hash = facts.leafKeyHash { ValueRow(label: "Key SHA-256", value: String(hash.prefix(16)) + "...") } // The value apps pin.
                if !facts.chain.isEmpty { ValueRow(label: "Trusted by iOS", value: facts.trustedBySystem ? "yes" : "no") } // The system's verdict.
            }
            TermList(terms: [ // The course's three terms.
                Term(term: "App Transport Security (ATS)", text: "Since iOS 9, apps load only HTTPS URLs with modern TLS by default. A plain http:// request fails, as the last button shows."), // ATS.
                Term(term: "Exceptions", text: "Info.plist keys under NSAppTransportSecurity can relax ATS for specific domains. Some require a justification during App Review; avoid them. This app has none."), // Exceptions.
                Term(term: "Certificate pinning", text: "Accepting only a specific certificate or key for your own server, used by high-risk apps such as banking. It must be updated whenever the certificate changes."), // Pinning.
            ])
        }
        .autorun({ await inspect(pins: []) }) // Screenshots run it without a tap.
    }

    /// Connects over a fresh TLS handshake, optionally enforcing pins.
    private func inspect(pins: Set<String>) async { // Called by the first three buttons.
        let result = await inspectTrust(of: Placeholder.url("todos/1"), pins: pins) // Never throws.
        facts = result.facts // The certificates.
        outcome = result.outcome // Connected or refused.
    }

    /// Tries the same server over plain HTTP, which ATS refuses before anything is sent.
    private func plainHTTP() async { // Called by the last button.
        do { // Expected to throw.
            _ = try await URLSession.shared.data(from: URL(string: "http://jsonplaceholder.typicode.com/todos/1")!) // No s.
            outcome = "Loaded over http. (ATS exceptions must be present.)" // Never happens in this app.
        } catch let error as URLError { // ATS failures are URLErrors.
            facts = TrustFacts() // No certificate was involved.
            outcome = "Blocked by ATS: URLError \(error.code.rawValue) (\(error.code == .appTransportSecurityRequiresSecureConnection ? "appTransportSecurityRequiresSecureConnection" : "other")). Message for people: \(userMessage(for: error) ?? "")" // The code and the sentence.
        } catch { // Anything else.
            outcome = userMessage(for: error) ?? "Cancelled." // Described in words.
        }
    }
}

/// "Never ship a secret in the app": find a constant in this app's own bytes, and in a UserDefaults file.
private struct SecretCard: View { // Card 8.
    @State private var binaryResult = "" // Where the constant was found.
    @State private var defaultsResult = "" // Whether UserDefaults wrote it to disk.

    var body: some View { // Rebuilt when the results change.
        DemoCard(title: "Never ship a secret in the app", caption: "Everything inside your app is on every user's phone, and an app binary can be copied and inspected.") { // Course step 8.
            ValueRow(label: "Constant in the source", value: ShippedConstant.demoKey) // A clearly fake key, compiled in on purpose.
            Button("Search this app's binary for it") { // Reads the app's own executable files.
                if let found = findInAppBinary(ShippedConstant.demoKey) { // The attacker's view.
                    binaryResult = "Found as readable bytes in \(found.file) at byte \(found.offset). Hiding it only slows an attacker down." // Where it sits.
                } else { // Should not happen.
                    binaryResult = "Not found in the executable files." // Reported honestly.
                }
            }
            .buttonStyle(.bordered) // Looks tappable.
            if !binaryResult.isEmpty { Text(binaryResult).font(.footnote) } // The result.
            AsyncButton(title: "Save a fake token in UserDefaults and look on disk") { // The other mistake.
                if let file = await findInPreferencesFile("fake-token-" + ShippedConstant.demoKey.suffix(4)) { // Writes, searches, then removes it.
                    defaultsResult = "Found in plain bytes in Library/Preferences/\(file). It has been removed again." // A settings file, not a safe.
                } else { // The system had not written the file yet.
                    defaultsResult = "Not on disk yet, but UserDefaults stores values unencrypted either way. It has been removed again." // Still the wrong place.
                }
            }
            if !defaultsResult.isEmpty { Text(defaultsResult).font(.footnote) } // The result.
            TermList(terms: [ // The course's three rules.
                Term(term: "Keep keys on a server", text: "Your app calls your own backend, which adds the secret key and calls the third-party API."), // Server side.
                Term(term: "Per-user tokens", text: "At sign-in your server issues a token for that user only, which can expire and be revoked."), // Revocable.
                Term(term: "Tokens go in the Keychain", text: "The Keychain is the encrypted store iOS provides for small secrets. UserDefaults is a settings file that was never designed for secrets; never put tokens there."), // Storage.
            ])
        }
    }
}

/// "Read a token and authorize a request": save a made-up token in the Keychain, then watch the header appear.
private struct TokenCard: View { // Card 9.
    @State private var typed = "" // The made-up token the student types.
    @State private var stored: String? // What savedToken() last returned.
    @State private var status = "" // What the last action did.
    @State private var phase = LivePhase<HTTPExchange>.idle // The authorized request's reply.
    private let store = KeychainStore() // The real Keychain, this app's own items only.

    /// The request after authorized(_:), built from the current Keychain contents.
    private var request: URLRequest { // Recomputed on every redraw, so it follows the Keychain.
        authorized(URLRequest(url: Placeholder.url("todos/1")), using: store) // Adds the header only when a token is stored.
    }

    var body: some View { // Rebuilt when the text or results change.
        DemoCard(title: "Read a token and authorize a request", caption: "After sign-in, an app saves the user's token with SecItemAdd; each request reads it back and adds an Authorization: Bearer header. Type a made-up token; never a real one.") { // Course step 9.
            TextField("Type a made-up token, such as demo-123", text: $typed) // Fake tokens only.
                .textFieldStyle(.roundedBorder) // A visible box.
                .autocorrectionDisabled() // Tokens are not words.
                .textInputAutocapitalization(.never) // Nor capitalized.
            HStack { // The three Keychain actions.
                Button("Save") { // SecItemAdd.
                    do { try store.save(typed); status = "Saved to the Keychain." } catch let error as KeychainError { status = error.message } catch { status = "\(error)" } // Apple's message on failure.
                    stored = store.savedToken() // Reads it back.
                }
                .disabled(typed.isEmpty) // Nothing to save.
                Button("Read") { stored = store.savedToken(); status = stored == nil ? "savedToken() returned nil: nobody is signed in." : "savedToken() found a token." } // SecItemCopyMatching.
                Button("Delete", role: .destructive) { store.delete(); stored = nil; status = "Deleted." } // SecItemDelete.
            }
            .buttonStyle(.bordered) // All three look tappable.
            if !status.isEmpty { Text(status).font(.footnote) } // What happened.
            ValueRow(label: "Authorization header", value: request.value(forHTTPHeaderField: "Authorization") ?? "(none: no token stored)") // Appears only with a token.
            AsyncButton(title: "Send the authorized request", action: send) // The practice API ignores the header but accepts it.
            LiveResult(phase: phase, retry: send) { ExchangeView(exchange: $0, headerNames: [], bodyLimit: 120) } // Status and body.
        }
        .autorun(send) // Screenshots run it without a tap.
        .onAppear { stored = store.savedToken() } // Shows whatever an earlier visit saved.
    }

    /// Sends GET /todos/1 with whatever header authorized(_:) added.
    private func send() async { // Called by the button and Retry.
        phase = .running // Shows the spinner.
        let request = request // A fixed copy for the closure.
        phase = await .of { try await perform(request) } // The token travels only over HTTPS.
    }
}

#Preview { // Shows this lesson in Xcode's canvas.
    NavigationStack { ErrorsRetriesSecurityLesson(lesson: ContentView.lessons[4]) } // Inside a stack, so the title shows.
}

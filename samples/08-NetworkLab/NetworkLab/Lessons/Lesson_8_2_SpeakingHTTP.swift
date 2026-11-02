// Lesson_8_2_SpeakingHTTP.swift
// Who: the home screen opens this when the student taps lesson 8.2.
// What: Speaking HTTP: the anatomy of a real request and reply, methods and
//       idempotency, URLs built with URLComponents next to the string-gluing
//       mistake, headers, status code families (and why a 404 does not throw),
//       the course's POST builder, and a request builder that sends real
//       requests to the practice API.
// Where: pushed onto the navigation stack by ContentView.
// When: whenever lesson 8.2 is opened; requests run only when a button is tapped.
// Why: HTTP is the layer your code actually writes; seeing the raw text next to
//      the Swift that produced it makes each part of a request concrete.

import SwiftUI // Views and controls.

/// The lesson 8.2 screen: one card per step of the course page.
struct SpeakingHTTPLesson: View { // ContentView routes "8.2" here.
    let lesson: Lesson // The number, title and summary from the home screen.

    var body: some View { // Built once; each card keeps its own state.
        CardScroller { // Lets screenshots jump to a card with -card N.
            LessonPage(lesson: lesson) { // The shared scrolling page layout.
                AnatomyCard().id(1) // Anatomy of a request and a response.
                MethodsCard().id(2) // Methods and idempotency.
                URLComponentsCard().id(3) // Build URLs with URLComponents.
                HeadersCard().id(4) // Headers that matter.
                StatusCard().id(5) // Status codes: how did it go?
                PostRequestCard().id(6) // Building a POST request.
                RequestBuilderCard().id(7) // HTTP request builder.
            }
        }
    }
}

/// A monospaced box for raw HTTP text or code.
private struct CodeBox: View { // Used by several cards on this screen.
    let text: String // The text to show exactly.

    var body: some View { // Rebuilt when the text changes.
        Text(verbatim: text) // verbatim: shown exactly, never translated.
            .font(.system(.caption, design: .monospaced)) // Fixed width.
            .frame(maxWidth: .infinity, alignment: .leading) // Full width.
            .padding(8) // Space inside the box.
            .background(.fill.tertiary, in: .rect(cornerRadius: 8)) // A light box.
            .textSelection(.enabled) // Students can copy it.
    }
}

/// "Anatomy of a request and a response": the raw request text, then the real reply.
private struct AnatomyCard: View { // Card 1.
    @State private var phase = LivePhase<HTTPExchange>.idle // The live reply.

    /// GET /todos/1 with an Accept header, exactly the course's example.
    private var request: URLRequest { // Built fresh when read.
        var request = URLRequest(url: Placeholder.url("todos/1")) // One to-do.
        request.setValue("application/json", forHTTPHeaderField: "Accept") // We read JSON.
        return request // The finished request.
    }

    var body: some View { // Rebuilt when phase changes.
        DemoCard(title: "Anatomy of a request and a response", caption: "A request says what you want; a response says what happened. This is the request as HTTP/1.1 text.") { // Course step 1.
            CodeBox(text: rawRequestText(request)) // GET /todos/1 HTTP/1.1, Host, Accept.
            TermList(terms: [ // The course's five parts.
                Term(term: "Method", text: "The verb: what to do with the resource, such as GET, POST, PUT, PATCH or DELETE."), // GET above.
                Term(term: "URL", text: "Which resource: scheme, host, path and optional query items."), // Host plus /todos/1.
                Term(term: "Headers", text: "Name and value pairs that describe the message: its format, the formats you accept, who is calling."), // Accept above.
                Term(term: "Body", text: "Optional data, usually JSON. Sent with POST, PUT and PATCH, and returned by most responses."), // None on this GET.
                Term(term: "Status code", text: "A three-digit number at the start of every response, such as 200 OK or 404 Not Found."), // Shown below.
            ])
            AsyncButton(title: "Send it and see the response", action: send) // A real request.
            LiveResult(phase: phase, retry: send) { ExchangeView(exchange: $0) } // Status, headers and body, or an error with Retry.
        }
        .autorun(send) // Screenshots send it without a tap.
    }

    /// Sends the request and records the reply.
    private func send() async { // Called by the button, Retry and -autorun.
        phase = .running // Shows the spinner.
        let request = request // A fixed copy for the closure.
        phase = await .of { try await perform(request) } // Success or a readable error.
    }
}

/// "Methods and idempotency": what each method means and whether it may be retried.
private struct MethodsCard: View { // Card 2.
    @State private var method = HTTPMethod.get // The method being described.

    var body: some View { // Rebuilt when the picker changes.
        DemoCard(title: "Methods and idempotency", caption: "Safe methods only read. Idempotent methods have the same effect whether you send them once or five times.") { // Course step 2.
            Picker("Method", selection: $method) { // The five methods.
                ForEach(HTTPMethod.allCases) { Text($0.rawValue).tag($0) } // One segment each.
            }
            .pickerStyle(.segmented) // Side-by-side buttons.
            Text(method.summary) // The course's sentence for this method.
                .font(.subheadline) // Readable size.
                .fixedSize(horizontal: false, vertical: true) // Wraps fully.
            ValueRow(label: "Safe (only reads)", value: method.isSafe ? "yes" : "no") // GET only.
            ValueRow(label: "Idempotent", value: method.isIdempotent ? "yes" : "no") // GET, PUT and DELETE.
            ValueRow(label: "Usually sends a body", value: method.sendsBody ? "yes" : "no") // POST, PUT and PATCH.
            ValueRow(label: "Retry automatically after a timeout?", value: method.mayRetryAutomatically ? "yes" : "never blindly") // The rule of thumb.
            Callout(title: "A retry rule of thumb", text: "Retry GET, PUT and DELETE automatically after a timeout. Never blindly retry a POST; lesson 8.5 builds a POST that carries an Idempotency-Key header so a retry cannot create a second order.", systemImage: "arrow.clockwise") // The course's tip.
        }
    }
}

/// "Build URLs with URLComponents": the encoded URL, what the server reads, and the string-gluing mistake.
private struct URLComponentsCard: View { // Card 3.
    @State private var text = "São Paulo" // What the user typed; the course's own example.
    @State private var phase = LivePhase<[Post]>.idle // The live search result.

    var body: some View { // Rebuilt when the text or phase changes.
        DemoCard(title: "Build URLs with URLComponents", caption: "URLComponents assembles the parts and percent-encodes them, so user input cannot break the URL. This version searches the practice API's posts.") { // Course step 3.
            TextField("Search text", text: $text) // The user's text.
                .textFieldStyle(.roundedBorder) // A visible box.
                .autocorrectionDisabled() // Keeps odd test strings exactly as typed.
            ScrollView(.horizontal, showsIndicators: false) { // Swipe sideways if the examples do not fit.
                HStack { // Quick examples from the course and its quiz.
                    ForEach(["São Paulo", "salt & pepper", "rock+roll", "qui est esse"], id: \.self) { sample in // Accents, &, + and a real match.
                        Button(sample) { text = sample } // Fills the field.
                            .buttonStyle(.bordered) // Looks tappable.
                            .font(.caption) // Small, so most fit on one row.
                    }
                }
            }
            Text("URLComponents and URLQueryItem") // The right way.
                .font(.subheadline.weight(.semibold)) // Heading.
            CodeBox(text: searchURL(for: text)?.absoluteString ?? "nil") // The encoded URL.
            CodeBox(text: queryPairs(of: searchURL(for: text)).joined(separator: "\n")) // What the server reads: one q item, whole.
            Text("The mistake: gluing strings") // The wrong way.
                .font(.subheadline.weight(.semibold)) // Heading.
            CodeBox(text: naiveSearchURL(for: text)?.absoluteString ?? "nil (the string is not a valid URL)") // URL(string:) of glued text.
            CodeBox(text: queryPairs(of: naiveSearchURL(for: text)).joined(separator: "\n")) // An & splits it into two items.
            Text("The + in rock+roll is left alone by URLComponents; many servers read + in a query as a space, so encode it yourself if it must stay a plus.") // Answers the course's Try It.
                .font(.footnote) // Small note.
                .foregroundStyle(.secondary) // Quieter.
            AsyncButton(title: "Send the search", action: search) // A real request with the encoded URL.
            LiveResult(phase: phase, retry: search) { posts in // Spinner, titles, or error with Retry.
                VStack(alignment: .leading, spacing: 4) { // The matches.
                    Text("\(posts.count) matching post\(posts.count == 1 ? "" : "s")") // How many came back.
                        .font(.subheadline.weight(.semibold)) // Bold.
                    ForEach(posts) { Text("#\($0.id) \($0.title)").font(.footnote) } // One line per post.
                }
            }
        }
        .autorun(search) // Screenshots run it without a tap.
    }

    /// Sends the encoded search URL and decodes the posts that match.
    private func search() async { // Called by the button and Retry.
        phase = .running // Shows the spinner.
        let url = searchURL(for: text) // Built before the request starts.
        phase = await .of { // Success or a readable error.
            guard let url else { throw URLError(.badURL) } // Building can fail; this text never makes it fail.
            let (data, response) = try await URLSession.shared.data(from: url) // The real request.
            try validate(response) // 2xx only.
            return try JSONDecoder().decode([Post].self, from: data) // The matches.
        }
    }
}

/// "Headers that matter": request headers we set, and response headers read with any capitalization.
private struct HeadersCard: View { // Card 4.
    @State private var phase = LivePhase<HTTPExchange>.idle // The live reply.

    var body: some View { // Rebuilt when phase changes.
        DemoCard(title: "Headers that matter", caption: "Set request headers on a URLRequest; read response headers from an HTTPURLResponse. Header names are case-insensitive.") { // Course step 4.
            TermList(terms: [ // The course's five headers.
                Term(term: "Content-Type", text: "The format of the body you are sending, such as application/json. Set it whenever you send a body so the server knows how to parse it."), // Describes our body.
                Term(term: "Accept", text: "The formats the client can read. application/json asks for JSON back."), // Describes what we want.
                Term(term: "Authorization", text: "Proves who is calling, usually the word Bearer followed by a token the user received at sign-in. Lesson 8.5 adds one from the Keychain."), // Identity.
                Term(term: "Cache-Control and ETag", text: "Response headers that say how long a reply may be reused and label its version. Lesson 8.7 uses them."), // Caching.
                Term(term: "User-Agent", text: "Names the client software. URLSession fills it in, along with Host, Content-Length and Accept-Encoding; leave those to URLSession."), // Automatic.
            ])
            AsyncButton(title: "Read the response headers", action: send) // A real request.
            LiveResult(phase: phase, retry: send) { exchange in // Spinner, rows, or error with Retry.
                VStack(alignment: .leading, spacing: 4) { // Three spellings, one value.
                    ValueRow(label: "\"Content-Type\"", value: exchange.header("Content-Type") ?? "missing") // The usual spelling.
                    ValueRow(label: "\"content-type\"", value: exchange.header("content-type") ?? "missing") // All lowercase: same value.
                    ValueRow(label: "\"CONTENT-TYPE\"", value: exchange.header("CONTENT-TYPE") ?? "missing") // All capitals: same value.
                    ValueRow(label: "Cache-Control", value: exchange.header("Cache-Control") ?? "missing") // How long it stays fresh.
                    ValueRow(label: "ETag", value: exchange.header("ETag") ?? "missing") // Its version label.
                }
            }
        }
        .autorun(send) // Screenshots run it without a tap.
    }

    /// Sends GET /todos/1 and records the reply.
    private func send() async { // Called by the button and Retry.
        phase = .running // Shows the spinner.
        phase = await .of { try await perform(URLRequest(url: Placeholder.url("todos/1"))) } // Success or a readable error.
    }
}

/// "Status codes: how did it go?": families, meanings, and a real 404 that does not throw.
private struct StatusCard: View { // Card 5.
    private static let codes = [200, 201, 204, 301, 304, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503] // The codes the course lists.
    @State private var code = 404 // The code being described.
    @State private var phase = LivePhase<HTTPExchange>.idle // The live reply.

    var body: some View { // Rebuilt when the picker or phase changes.
        DemoCard(title: "Status codes: how did it go?", caption: "The first digit names the family, so an app can react sensibly even to a code it has never seen.") { // Course step 5.
            Picker("Status code", selection: $code) { // Pick any code from the course.
                ForEach(Self.codes, id: \.self) { Text("\(String($0)) \(reasonPhrase(for: $0))").tag($0) } // For example "404 Not Found".
            }
            .pickerStyle(.menu) // A compact menu: fifteen codes do not fit as segments.
            ValueRow(label: "Family", value: StatusFamily(code: code).rawValue) // Decided by the first digit.
            Text(StatusFamily(code: code).appReaction) // What the app should do.
                .font(.subheadline) // Readable size.
                .fixedSize(horizontal: false, vertical: true) // Wraps fully.
            Callout(title: "A 404 is not an error to URLSession", text: "URLSession throws only when no response arrives at all: offline, timed out, untrusted certificate. A 404 or a 500 is a successfully delivered piece of bad news, so your code must check statusCode itself.", systemImage: "exclamationmark.triangle") // The course's warning.
            HStack { // Two real requests.
                AsyncButton(title: "GET /todos/1") { await fetch("todos/1") } // Exists: 200.
                AsyncButton(title: "GET /todos/99999") { await fetch("todos/99999") } // Does not exist: 404.
            }
            LiveResult(phase: phase, retry: { await fetch("todos/99999") }) { exchange in // Spinner, verdict, or error with Retry.
                VStack(alignment: .leading, spacing: 4) { // The verdict and the reply.
                    Text("data(from:) returned normally; nothing was thrown. statusCode is \(exchange.statusCode), so your code decides.") // The point of the callout.
                        .font(.footnote) // Small.
                    ExchangeView(exchange: exchange, headerNames: []) // Status and body only.
                }
            }
        }
        .autorun({ await fetch("todos/99999") }) // Screenshots run it without a tap.
    }

    /// Sends GET to a path and records whatever came back.
    private func fetch(_ path: String) async { // Called by both buttons and Retry.
        phase = .running // Shows the spinner.
        phase = await .of { try await perform(URLRequest(url: Placeholder.url(path))) } // Only transport failures throw.
    }
}

/// "Building a POST request": the course's makeCreateRequest(title:), shown as raw text and sent for real.
private struct PostRequestCard: View { // Card 6.
    @State private var title = "Read chapter 8" // The to-do the user is creating.
    @State private var phase = LivePhase<HTTPExchange>.idle // The live reply.

    var body: some View { // Rebuilt when the title or phase changes.
        DemoCard(title: "Building a POST request", caption: "A URLRequest bundles the URL, method, headers, JSON body and timeout. makeCreateRequest(title:) only builds it; the button sends it.") { // Course step 6.
            TextField("To-do title", text: $title) // The user's text.
                .textFieldStyle(.roundedBorder) // A visible box.
            if let request = try? makeCreateRequest(title: title) { // Building can throw; it never does for a String.
                CodeBox(text: rawRequestText(request)) // POST /todos, headers and the JSON body.
                ValueRow(label: "timeoutInterval", value: "\(Int(request.timeoutInterval)) s") // 15 instead of 60.
            }
            AsyncButton(title: "Send the POST", action: send) // Creates the to-do on the practice server.
            LiveResult(phase: phase, retry: send) { exchange in // Spinner, reply, or error with Retry.
                VStack(alignment: .leading, spacing: 4) { // The reply and a note.
                    ExchangeView(exchange: exchange, headerNames: ["Content-Type"]) // 201 Created with the new id.
                    Text("JSONPlaceholder answers 201 Created with a new id but does not really store it.") // So nobody is surprised later.
                        .font(.footnote) // Small.
                        .foregroundStyle(.secondary) // Quieter.
                }
            }
        }
        .autorun(send) // Screenshots run it without a tap.
    }

    /// Builds the request with the course's function and sends it.
    private func send() async { // Called by the button and Retry.
        phase = .running // Shows the spinner.
        let title = title // A fixed copy for the closure.
        phase = await .of { try await perform(try makeCreateRequest(title: title)) } // Build, then send.
    }
}

/// "HTTP request builder": pick a method and endpoint, see the raw request and Swift code, and send it.
private struct RequestBuilderCard: View { // Card 7, the course's builder widget.
    @State private var preset = RequestPreset.create // The chosen request.
    @State private var phase = LivePhase<HTTPExchange>.idle // The live reply.

    var body: some View { // Rebuilt when the preset or phase changes.
        DemoCard(title: "HTTP request builder", caption: "Pick a method and endpoint, read the raw request and the equivalent Swift, then send it to the practice API.") { // Course widget.
            Picker("Request", selection: $preset) { // Six ready-made requests.
                ForEach(RequestPreset.allCases) { Text($0.rawValue).tag($0) } // One entry each.
            }
            .pickerStyle(.menu) // A compact menu.
            Text("Raw request") // Section heading.
                .font(.subheadline.weight(.semibold)) // Bold.
            CodeBox(text: rawRequestText(preset.request)) // The request as HTTP text.
            Text("Equivalent Swift") // Section heading.
                .font(.subheadline.weight(.semibold)) // Bold.
            CodeBox(text: swiftCode(for: preset.request)) // The URLRequest code that builds it.
            AsyncButton(title: "Send \(preset.method.rawValue)", action: send) // A real request.
            LiveResult(phase: phase, retry: send) { ExchangeView(exchange: $0) } // Status, timing, headers and body.
        }
        .autorun(send) // Screenshots run it without a tap.
        .onChange(of: preset) { phase = .idle } // A new choice clears the old reply.
    }

    /// Sends the chosen preset and records the reply.
    private func send() async { // Called by the button and Retry.
        phase = .running // Shows the spinner.
        let request = preset.request // A fixed copy for the closure.
        phase = await .of { try await perform(request) } // Success or a readable error.
    }
}

#Preview { // Shows this lesson in Xcode's canvas.
    NavigationStack { SpeakingHTTPLesson(lesson: ContentView.lessons[1]) } // Inside a stack, so the title shows.
}

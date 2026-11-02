// Lesson_8_7_APILayer.swift
// Who: the home screen opens this when the student taps lesson 8.7.
// What: Designing the API Layer: the four layers, the TodoService protocol with
//       its live implementation, a list that paginates as you scroll (with a
//       switch to inject a stub), the stub test run inside the app, HTTP caching
//       as a clock-driven lab plus a genuine 304, the course's caching session,
//       GraphQL compared with two REST requests, gRPC, and REST design habits.
// Where: pushed onto the navigation stack by ContentView.
// When: whenever lesson 8.7 is opened; the list loads its first page on appear.
// Why: a model that receives its service through init can be tested and
//      previewed with no network; that one decision shapes the whole layer.

import SwiftUI // Views and controls.

/// The lesson 8.7 screen: one card per step of the course page.
struct APILayerLesson: View { // ContentView routes "8.7" here.
    let lesson: Lesson // The number, title and summary from the home screen.

    var body: some View { // Built once; each card keeps its own state.
        CardScroller { // Lets screenshots jump to a card with -card N.
            LessonPage(lesson: lesson) { // The shared scrolling page layout.
                LayersCard().id(1) // Layers with clear jobs.
                ServiceCard().id(2) // A protocol and a live implementation.
                PaginationCard().id(3) // Pagination in the model.
                StubTestCard().id(4) // Test the model with a stub.
                CachingCard().id(5) // HTTP caching: do not download it twice.
                CacheLabCard().id(6) // Cache lab.
                ConfigureCacheCard().id(7) // Configure the cache.
                GraphQLCard().id(8) // GraphQL.
                GRPCCard().id(9) // gRPC.
                RESTDesignCard().id(10) // REST API design you will meet.
            }
        }
    }
}

/// A monospaced block for code and queries on this screen.
private struct Snippet: View { // Used by several cards.
    let text: String // Shown exactly.

    var body: some View { // Rebuilt when the text changes.
        Text(verbatim: text) // Never translated.
            .font(.system(.caption, design: .monospaced)) // Fixed width.
            .frame(maxWidth: .infinity, alignment: .leading) // Full width.
            .padding(8) // Space inside the box.
            .background(.fill.tertiary, in: .rect(cornerRadius: 8)) // A light box.
            .textSelection(.enabled) // Students can copy it.
    }
}

/// "Layers with clear jobs": View, Model, Service protocol, Live service or stub.
private struct LayersCard: View { // Card 1.
    var body: some View { // Static content.
        DemoCard(title: "Layers with clear jobs", caption: "Each layer talks only to the one below it. The pagination card further down uses exactly these layers.") { // Course step 1.
            VStack(spacing: 4) { // The stack of layers, top to bottom.
                ForEach(["View: PaginationCard (SwiftUI)", "Model: TodoListModel (@Observable)", "Service protocol: TodoService"], id: \.self) { layer in // The upper three layers.
                    Text(layer).font(.footnote.monospaced()).frame(maxWidth: .infinity).padding(6).background(.fill.tertiary, in: .rect(cornerRadius: 6)) // One box per layer.
                    Image(systemName: "arrow.down").font(.caption) // Talks to the one below.
                }
                HStack { // The bottom layer has two interchangeable implementations.
                    Text("LiveTodoService (URLSession)").font(.footnote.monospaced()).frame(maxWidth: .infinity).padding(6).background(.tint.opacity(0.15), in: .rect(cornerRadius: 6)) // The real one.
                    Text("SampleTodoService (stub)").font(.footnote.monospaced()).frame(maxWidth: .infinity).padding(6).background(.green.opacity(0.15), in: .rect(cornerRadius: 6)) // The stand-in.
                }
            }
            TermList(terms: [ // The course's four layers.
                Term(term: "View", text: "SwiftUI. Shows state and forwards user actions. Knows nothing about URLs or JSON."), // View.
                Term(term: "Model", text: "An @Observable class that holds screen state and decides when to load. Testable without any interface."), // Model.
                Term(term: "Service protocol", text: "Describes what data the app needs, such as todos(page:), not how it is fetched."), // Protocol.
                Term(term: "Live service", text: "The implementation that uses URLSession. Tests and previews swap in a stub that returns fixed data."), // Live.
            ])
            Callout(title: "Dependency injection", text: "The model receives its service through its initializer instead of creating one. That single decision lets you test the model without a network, preview screens offline and point the app at a different server without touching any view.", systemImage: "puzzlepiece") // The course's design note.
        }
    }
}

/// "A protocol and a live implementation": one page from LiveTodoService, with its URL.
private struct ServiceCard: View { // Card 2.
    @State private var page = 1 // Which page to ask for.
    @State private var pageSize = 20 // How many per page.
    @State private var phase = LivePhase<[Todo]>.idle // The live page.

    var body: some View { // Rebuilt when a stepper or phase changes.
        let service = LiveTodoService(pageSize: pageSize) // The real implementation.
        DemoCard(title: "A protocol and a live implementation", caption: "TodoService is the contract; LiveTodoService fulfils it with URLSession, _page and _limit, and the shared validate(_:) status check.") { // Course step 2.
            Stepper("Page: \(page)", value: $page, in: 1...12) // 200 to-dos: past the end, pages are empty.
            Stepper("Page size (_limit): \(pageSize)", value: $pageSize, in: 5...50, step: 5) // Without a limit the API returns all 200.
            Snippet(text: service.url(for: page).absoluteString) // The exact URL the service builds.
            AsyncButton(title: "await service.todos(page: \(page))") { await load(service) } // The protocol's one method.
            LiveResult(phase: phase, retry: { await load(service) }) { todos in // Spinner, summary, or error with Retry.
                Text(todos.isEmpty ? "An empty page: the end of the data." : "\(todos.count) to-dos, ids \(todos.first!.id) to \(todos.last!.id).") // What came back.
                    .font(.subheadline.weight(.semibold)) // Bold.
            }
        }
        .autorun({ await load(service) }) // Screenshots run it without a tap.
        .onChange(of: page) { phase = .idle } // A different page clears the old result.
        .onChange(of: pageSize) { phase = .idle } // So does a different size.
    }

    /// Fetches one page through the protocol's method.
    private func load(_ service: LiveTodoService) async { // Called by the button and Retry.
        phase = .running // Shows the spinner.
        let page = page // A fixed copy for the closure.
        phase = await .of { try await service.todos(page: page) } // Success or a readable error.
    }
}

/// "Pagination in the model": a list that loads the next page when its last row appears.
private struct PaginationCard: View { // Card 3.
    @State private var useStub = false // Which service to inject.
    @State private var model = TodoListModel(service: LiveTodoService()) // The live service by default.

    var body: some View { // Rebuilt when the model changes.
        DemoCard(title: "Pagination in the model", caption: "Scroll the list: when the last row appears, the model asks for the next page. Duplicate triggers are ignored while a load runs, and an empty page ends the list.") { // Course step 3.
            Toggle("Inject the stub service", isOn: $useStub) // Swaps the service without touching the view.
            ValueRow(label: "Loaded", value: "\(model.todos.count) to-dos") // Grows a page at a time.
            ValueRow(label: "Pages requested", value: model.requestedPages.map(String.init).joined(separator: ", ")) // 1, 2, 3...
            ValueRow(label: "hasMore", value: "\(model.hasMore)") // false after the empty page.
            ScrollView { // The list scrolls inside the card.
                LazyVStack(alignment: .leading, spacing: 6) { // Rows are built only as they scroll into view.
                    ForEach(model.todos) { todo in // One row per loaded to-do.
                        Text("#\(todo.id) \(todo.title)") // The row.
                            .font(.footnote) // Compact.
                            .frame(maxWidth: .infinity, alignment: .leading) // Full width.
                            .task { if todo.id == model.todos.last?.id { await model.loadNextPage() } } // The last row's appearance asks for more.
                    }
                    if model.isLoading { ProgressView("Loading the next page") } // A footer spinner.
                    if let message = model.errorMessage { ErrorBox(message: message) { await model.loadNextPage() } } // A failed page can be retried.
                    if !model.hasMore { Text("End of the list.").font(.footnote).foregroundStyle(.secondary) } // No more pages.
                }
                .padding(8) // Space inside the box.
            }
            .frame(height: 220) // A fixed window onto the list.
            .background(.fill.quaternary, in: .rect(cornerRadius: 8)) // A light box.
        }
        .task { if model.todos.isEmpty { await model.loadNextPage() } } // Loads page 1 when the card appears.
        .onChange(of: useStub) { // A new service needs a new model.
            model = TodoListModel(service: useStub ? SampleTodoService.threePages : LiveTodoService()) // Dependency injection in one line.
            Task { await model.loadNextPage() } // Loads its first page.
        }
    }
}

/// "Test the model with a stub": the course's test, run on screen.
private struct StubTestCard: View { // Card 4.
    @State private var lines: [String] = [] // The test's steps.

    var body: some View { // Rebuilt when lines changes.
        DemoCard(title: "Test the model with a stub", caption: "A stub returns fixed data instantly: no network, no flakiness, no waiting. The test target runs appendsPagesUntilEmpty with Swift Testing; this button runs the same steps here.") { // Course step 4.
            AsyncButton(title: "Run appendsPagesUntilEmpty") { lines = await runStubTestInApp() } // Real model, fake service.
            ConsoleView(lines: lines) // Every #expect, passed or not.
        }
        .autorun { lines = await runStubTestInApp() } // Screenshots run it without a tap.
    }
}

/// "HTTP caching: do not download it twice": the four ideas.
private struct CachingCard: View { // Card 5.
    var body: some View { // Static content.
        DemoCard(title: "HTTP caching: do not download it twice", caption: "HTTP has caching built in, and URLSession's URLCache follows its rules automatically.") { // Course step 5.
            TermList(terms: [ // The course's four terms.
                Term(term: "Cache-Control: max-age=60", text: "The server says the response stays fresh for 60 seconds. Within that window URLSession answers from the cache without using the network."), // max-age.
                Term(term: "ETag", text: "A version label for the response, such as \"v42\". URLSession stores it with the cached copy."), // ETag.
                Term(term: "If-None-Match and 304", text: "When the copy is stale, URLSession asks \"still v42?\". If nothing changed, the server answers 304 Not Modified with no body, and your code receives the cached body as a normal 200 response."), // Revalidation.
                Term(term: "Cache policy", text: "Each request can override the default: .returnCacheDataElseLoad for offline-first screens, .reloadIgnoringLocalCacheData for pull to refresh."), // Policies.
            ])
        }
    }
}

/// "Cache lab": control the clock, the server's data, the policy and the network; then send a real conditional request.
private struct CacheLabCard: View { // Card 6, the course's cache lab.
    @State private var sim = CacheSimulator() // max-age 60, protocol policy, online.
    @State private var phase = LivePhase<ConditionalResult>.idle // The real conditional request.

    var body: some View { // Rebuilt when the simulator changes.
        DemoCard(title: "Cache lab", caption: "Request the same resource again and again while you control the clock (max-age is 60 s), the server's data, the policy and the network.") { // Course widget.
            Picker("Policy", selection: $sim.policy) { // How requests treat the cache.
                ForEach(CachePolicyChoice.allCases) { Text($0.rawValue).tag($0) } // One entry each.
            }
            .pickerStyle(.menu) // A compact menu.
            Toggle("Network available", isOn: $sim.online) // Offline changes everything.
            HStack { // The clock and the server.
                Button("+30 s") { sim.advance(seconds: 30) } // Still fresh after one press.
                Button("+5 min") { sim.advance(seconds: 300) } // Definitely stale.
                Button("Change data") { sim.changeServerData() } // A new ETag.
                Button("Clear") { sim.clearCache() } // Empties the cache.
            }
            .buttonStyle(.bordered) // All tappable.
            .font(.caption) // Four fit on a row.
            Button("Request the resource") { sim.request() } // The key action.
                .buttonStyle(.borderedProminent) // Stands out.
            ValueRow(label: "Clock", value: "\(sim.clock) s") // Logical time.
            ValueRow(label: "Body bytes downloaded / saved", value: "\(sim.bytesDownloaded) / \(sim.bytesSaved)") // The point of caching.
            ConsoleView(lines: Array(sim.log.suffix(6))) // The latest outcomes.
            Divider() // Separates the real request.
            AsyncButton(title: "Send a real conditional request", action: conditional) // A genuine 304.
            LiveResult(phase: phase, retry: conditional) { result in // Spinner, rows, or error with Retry.
                VStack(alignment: .leading, spacing: 4) { // Two requests side by side.
                    ValueRow(label: "First GET", value: "\(result.firstStatus), \(result.firstBytes) bytes") // The full body.
                    ValueRow(label: "ETag", value: result.etag) // The version label.
                    ValueRow(label: "Same GET + If-None-Match", value: "\(result.secondStatus) \(reasonPhrase(for: result.secondStatus)), \(result.secondBytes) bytes") // 304, no body.
                }
            }
        }
        .autorun(conditional) // Screenshots run it without a tap.
    }

    /// Sends the two real requests.
    private func conditional() async { // Called by the button and Retry.
        phase = .running // Shows the spinner.
        phase = await .of { try await conditionalRequest() } // Success or a readable error.
    }
}

/// "Configure the cache": the course's makeCachingSession(), fetched with three policies.
private struct ConfigureCacheCard: View { // Card 7.
    @State private var session = makeCachingSession() // One long-lived session, as the course recommends.
    @State private var phase = LivePhase<CacheProbeResult>.idle // The last probe.
    @State private var usage = "" // The cache's current size.

    var body: some View { // Rebuilt when phase or usage changes.
        let config = session.configuration // A copy of the settings the session uses.
        DemoCard(title: "Configure the cache", caption: "A custom URLSessionConfiguration sizes the cache, chooses a default policy and waits for connectivity. Individual requests can still pick their own policy.") { // Course step 7.
            ValueRow(label: "Memory / disk capacity", value: "\((config.urlCache?.memoryCapacity ?? 0) / 1_000_000) MB / \((config.urlCache?.diskCapacity ?? 0) / 1_000_000) MB") // 10 MB and 100 MB.
            ValueRow(label: "timeoutIntervalForRequest", value: "\(Int(config.timeoutIntervalForRequest)) s") // 20 s.
            ValueRow(label: "waitsForConnectivity", value: "\(config.waitsForConnectivity)") // true.
            ForEach(CachePolicyChoice.allCases) { choice in // One button per policy.
                AsyncButton(title: choice.rawValue) { await probe(choice) } // Fetches /todos/1 with that policy.
            }
            LiveResult(phase: phase, retry: { await probe(.protocolPolicy) }) { result in // Spinner, rows, or error with Retry.
                VStack(alignment: .leading, spacing: 4) { // Where the answer came from, and why.
                    Text(result.summary).font(.subheadline.weight(.semibold)) // In one sentence.
                    ValueRow(label: "Status your code saw", value: "\(result.status)") // A 304 is turned into the cached 200.
                    ValueRow(label: "Cache-Control", value: result.cacheControl ?? "none") // How long it may be reused.
                    ValueRow(label: "ETag", value: result.etag ?? "none") // The version label.
                }
            }
            if !usage.isEmpty { ValueRow(label: "Cache in use", value: usage) } // Grows after the first fetch.
            Button("Clear the cache", role: .destructive) { config.urlCache?.removeAllCachedResponses(); usage = "emptied" } // Back to a cold start.
                .buttonStyle(.bordered) // Looks tappable.
            Text("offlineFirstRequest(for:) is the second button: .returnCacheDataElseLoad uses any cached copy, however old.") // Ties the button to the course's helper.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quieter.
        }
        .autorun({ await probe(.protocolPolicy) }) // Screenshots run it without a tap.
    }

    /// Fetches /todos/1 with a policy and reports where the answer came from.
    private func probe(_ choice: CachePolicyChoice) async { // Called by the buttons and Retry.
        phase = .running // Shows the spinner.
        let session = session // A fixed copy for the closure.
        let url = Placeholder.url("todos/1") // The resource.
        phase = await .of { // Success or a readable error.
            if choice == .offlineFirst { // The course's helper builds this request.
                let request = offlineFirstRequest(for: url) // .returnCacheDataElseLoad.
                return try await probeCache(url, policy: request.cachePolicy, session: session) // Same probe, same policy.
            }
            return try await probeCache(url, policy: choice.policy, session: session) // The chosen policy.
        }
        let cache = session.configuration.urlCache // The session's cache.
        usage = "\((cache?.currentMemoryUsage ?? 0) / 1024) KB memory, \((cache?.currentDiskUsage ?? 0) / 1024) KB disk" // How much it holds now.
    }
}

/// "GraphQL": one query for exactly the fields you need, compared with two REST requests.
private struct GraphQLCard: View { // Card 8.
    @State private var phase = LivePhase<(user: PlaceholderUser, todos: [Todo])>.idle // The REST result.

    var body: some View { // Rebuilt when phase changes.
        DemoCard(title: "GraphQL", caption: "One endpoint; the client sends a query describing exactly the fields it wants, and the response mirrors the query's shape.") { // Course step 8.
            Snippet(text: graphQLQuery) // The course's example query: one round trip.
            Text("The same data from this REST API takes two requests, which async let runs at the same time:") // The comparison.
                .font(.footnote) // Small.
            AsyncButton(title: "GET /users/1 and /users/1/todos?_limit=3", action: load) // Two real requests.
            LiveResult(phase: phase, retry: load) { result in // Spinner, result, or error with Retry.
                VStack(alignment: .leading, spacing: 2) { // The combined result.
                    Text("\(result.user.name), via 2 requests").font(.subheadline.weight(.semibold)) // The user.
                    ForEach(result.todos) { Text("- \($0.title)").font(.footnote) } // Three titles.
                }
            }
            TermList(terms: [ // The course's three points.
                Term(term: "Good fit", text: "Screens that combine several related resources, or many clients (phone, watch, web) that need different fields."), // When.
                Term(term: "Costs", text: "More server complexity, harder HTTP caching because queries usually travel as POST requests, and protection needed against very expensive queries."), // Costs.
                Term(term: "On iOS", text: "It is still JSON over HTTP, so URLSession and Codable work. Libraries such as Apollo iOS generate Swift types from the schema."), // How.
            ])
        }
        .autorun(load) // Screenshots run it without a tap.
    }

    /// Fetches the user and three to-dos with two concurrent REST requests.
    private func load() async { // Called by the button and Retry.
        phase = .running // Shows the spinner.
        phase = await .of { try await userWithTodosREST(userId: 1) } // Success or a readable error.
    }
}

/// "gRPC": generated clients, binary messages over HTTP/2.
private struct GRPCCard: View { // Card 9.
    var body: some View { // Static content: gRPC needs a third-party package, which this app does not use.
        DemoCard(title: "gRPC", caption: "A remote procedure call framework: services and messages are described in a .proto file, and a code generator produces the Swift client.") { // Course step 9.
            Snippet(text: "service TodoService {\n  rpc ListTodos (ListTodosRequest) returns (ListTodosReply);\n}\nmessage ListTodosRequest { int32 page = 1; }") // What a .proto contract looks like.
            TermList(terms: [ // The course's three points.
                Term(term: "Good fit", text: "Traffic between services inside a backend, high-volume or streaming APIs, and teams that want a strict, generated contract."), // When.
                Term(term: "Costs", text: "Binary payloads are hard to read while debugging, browsers need a proxy, and both sides must share the .proto files."), // Costs.
                Term(term: "On iOS", text: "The open-source grpc-swift package generates async/await clients. Most public APIs your apps call will still be REST with JSON."), // How.
            ])
        }
    }
}

/// "REST API design you will meet": the conventions, with one live nested route.
private struct RESTDesignCard: View { // Card 10.
    @State private var phase = LivePhase<[Todo]>.idle // The nested route's result.

    var body: some View { // Rebuilt when phase changes.
        DemoCard(title: "REST API design you will meet", caption: "Conventions that make an API predictable for every client that uses it.") { // Course step 10.
            TermList(terms: [ // The course's five conventions.
                Term(term: "Plural nouns, methods as verbs", text: "/users/7/todos rather than /getTodosForUser?id=7. The HTTP method already says what to do. The button below calls exactly that route."), // Naming.
                Term(term: "Honest statuses and error bodies", text: "201 with the new resource after a POST; 422 with a JSON body naming the invalid field. RFC 9457 \"problem details\" standardizes that body."), // Statuses.
                Term(term: "Versioning", text: "A version in the path (/v1/) or a header, so old app versions keep working; not every user updates."), // Versions.
                Term(term: "Idempotency keys", text: "Many APIs accept a unique Idempotency-Key header on POST, the header lesson 8.5 added to an order request. If the server sees the same key twice, it returns the first result instead of charging twice."), // Keys.
                Term(term: "Rate limits", text: "Answer 429 Too Many Requests with a Retry-After header, so clients know when to back off."), // Limits.
            ])
            AsyncButton(title: "GET /users/7/todos", action: load) // A nested, plural route.
            LiveResult(phase: phase, retry: load) { todos in // Spinner, count, or error with Retry.
                Text("\(todos.count) to-dos belong to user 7; \(todos.filter(\.completed).count) are completed.") // What the route returned.
                    .font(.subheadline.weight(.semibold)) // Bold.
            }
        }
        .autorun(load) // Screenshots run it without a tap.
    }

    /// Fetches user 7's to-dos from the nested route.
    private func load() async { // Called by the button and Retry.
        phase = .running // Shows the spinner.
        phase = await .of { // Success or a readable error.
            let (data, response) = try await URLSession.shared.data(from: Placeholder.url("users/7/todos")) // The nested route.
            try validate(response) // 2xx only.
            return try JSONDecoder().decode([Todo].self, from: data) // An array of to-dos.
        }
    }
}

#Preview { // Shows this lesson in Xcode's canvas.
    NavigationStack { APILayerLesson(lesson: ContentView.lessons[6]) } // Inside a stack, so the title shows.
}

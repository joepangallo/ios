// Lesson_8_3_RESTResourcesJSON.swift
// Who: the home screen opens this when the student taps lesson 8.3.
// What: REST Resources and JSON: the five REST routes sent for real, JSON
//       kinds and their Swift types, the course's five decoding programs with
//       their exact output (two of them also decode the live reply), and a
//       decoder lab that names every DecodingError.
// Where: pushed onto the navigation stack by ContentView.
// When: whenever lesson 8.3 is opened; nothing runs until a button is tapped.
// Why: Codable does the decoding for you, but only when the types match the
//      JSON; running each example and breaking the JSON on purpose shows how.

import SwiftUI // Views and controls.

/// The lesson 8.3 screen: one card per step of the course page.
struct RESTResourcesJSONLesson: View { // ContentView routes "8.3" here.
    let lesson: Lesson // The number, title and summary from the home screen.

    var body: some View { // Built once; each card keeps its own state.
        CardScroller { // Lets screenshots jump to a card with -card N.
            LessonPage(lesson: lesson) { // The shared scrolling page layout.
                RESTCard().id(1) // REST: resources and verbs.
                JSONTypesCard().id(2) // From JSON to Swift types.
                FirstDecodeCard().id(3) // Decode your first response.
                CodingKeysCard().id(4) // Rename keys with CodingKeys.
                NestedCard().id(5) // Nested JSON, nested structs.
                FlattenCard().id(6) // Flatten with a nested container.
                FailuresCard().id(7) // When decoding fails.
                DecoderLabCard().id(8) // JSON to Swift decoder lab.
            }
        }
    }
}

/// Shows a JSON sample, a Run button and the printed output of a course program.
private struct RunExample: View { // Used by the five decoding cards.
    let json: String // The JSON the program decodes.
    let run: () throws -> [String] // The program; returns what it printed.
    @State private var lines: [String] = [] // The output, once run.

    var body: some View { // Rebuilt when lines changes.
        VStack(alignment: .leading, spacing: 8) { // JSON, button, output.
            Text(verbatim: json) // The JSON exactly as the course embeds it.
                .font(.system(.caption, design: .monospaced)) // Fixed width.
                .frame(maxWidth: .infinity, alignment: .leading) // Full width.
                .padding(8) // Space inside the box.
                .background(.fill.tertiary, in: .rect(cornerRadius: 8)) // A light box.
            Button("Run the program") { // Decoding is instant, so no async needed.
                do { lines = try run() } catch { lines = ["Error: \(error)"] } // Shows the output, or the error.
            }
            .buttonStyle(.borderedProminent) // The main action of the card.
            ConsoleView(lines: lines) // What the program printed.
        }
        .task { if LaunchOptions.autorun { lines = (try? run()) ?? [] } } // Screenshots show the output without a tap.
    }
}

/// The REST routes the first card sends.
private enum RESTRoute: String, CaseIterable, Identifiable { // The raw value labels the button.
    case collection = "GET /todos" // The whole collection.
    case member = "GET /todos/1" // One member.
    case create = "POST /todos" // Create one.
    case change = "PATCH /todos/1" // Change some fields.
    case remove = "DELETE /todos/1" // Remove one.
    case checkCreated = "GET /todos/201" // Was the POST stored? (It was not.)
    var id: String { rawValue } // The label doubles as the identity.

    /// The request this route sends.
    var request: URLRequest { // Built fresh each time.
        let parts = rawValue.split(separator: " ") // ["GET", "/todos"].
        var request = URLRequest(url: Placeholder.url(String(parts[1].dropFirst()))) // The path without its leading slash.
        request.httpMethod = String(parts[0]) // The verb.
        let body: String? = switch self { // Only POST and PATCH send JSON.
        case .create: #"{"title": "Learn REST", "completed": false, "userId": 1}"# // A new to-do.
        case .change: #"{"completed": true}"# // Just the changed field.
        default: nil // No body.
        }
        if let body { // When there is a body...
            request.setValue("application/json", forHTTPHeaderField: "Content-Type") // ...describe it...
            request.httpBody = Data(body.utf8) // ...and attach it.
        }
        return request // The finished request.
    }

    /// A one-line summary of the reply, in REST terms.
    func summary(of exchange: HTTPExchange) -> String { // Decodes just enough to say something useful.
        let decoder = JSONDecoder() // Reused for each attempt below.
        switch self { // One sentence per route.
        case .collection: // A JSON array.
            let todos = (try? decoder.decode([Todo].self, from: exchange.body)) ?? [] // Every to-do.
            return "The collection: an array of \(todos.count) to-dos." // 200 of them.
        case .member, .change: // One object.
            guard let todo = try? decoder.decode(Todo.self, from: exchange.body) else { return "No to-do in the body." } // Decodes it.
            return "One member: #\(todo.id) \"\(todo.title)\", completed \(todo.completed)." // PATCH shows completed now true.
        case .create: // The created object.
            guard let todo = try? decoder.decode(Todo.self, from: exchange.body) else { return "No to-do in the body." } // Decodes it.
            return "Created with the new id \(todo.id)." // Always 201 on this practice server.
        case .remove: // An empty object.
            return "Removed. The body is \(exchange.bodyText.trimmingCharacters(in: .whitespacesAndNewlines))." // {} on success.
        case .checkCreated: // The stateless check.
            return exchange.statusCode == 404 ? "404: the practice server never stored the POST." : "Found it." // It is never stored.
        }
    }
}

/// "REST: resources and verbs": every route sent for real.
private struct RESTCard: View { // Card 1.
    @State private var route = RESTRoute.member // The route last sent.
    @State private var phase = LivePhase<HTTPExchange>.idle // Its reply.

    var body: some View { // Rebuilt when phase changes.
        DemoCard(title: "REST: resources and verbs", caption: "Each resource has its own URL; the HTTP method says what to do with it. JSONPlaceholder follows the pattern.") { // Course step 1.
            LazyVGrid(columns: [GridItem(.flexible(), alignment: .leading), GridItem(.flexible(), alignment: .leading)]) { // Two buttons per row.
                ForEach(RESTRoute.allCases) { item in // One button per route.
                    AsyncButton(title: item.rawValue) { await send(item) } // Sends it.
                }
            }
            LiveResult(phase: phase, retry: { await send(route) }) { exchange in // Spinner, reply, or error with Retry.
                VStack(alignment: .leading, spacing: 4) { // Summary over reply.
                    Text(route.summary(of: exchange)) // What the reply means.
                        .font(.subheadline.weight(.semibold)) // Bold.
                    ExchangeView(exchange: exchange, headerNames: [], bodyLimit: 240) // Status and the start of the body.
                }
            }
            Callout(title: "Stateless by design", text: "Each request carries everything the server needs, including who is calling. The server does not remember earlier requests, which lets any one of many machines answer the next one.", systemImage: "square.stack.3d.up") // The course's design note.
        }
        .autorun({ await send(.create) }) // Screenshots run it without a tap.
    }

    /// Sends one route and records the reply.
    private func send(_ item: RESTRoute) async { // Called by the buttons and Retry.
        route = item // Remembers which route the reply belongs to.
        phase = .running // Shows the spinner.
        phase = await .of { try await perform(item.request) } // Any status comes back; only transport failures throw.
    }
}

/// "From JSON to Swift types": each JSON kind and the Swift type it becomes.
private struct JSONTypesCard: View { // Card 2.
    var body: some View { // Static content.
        DemoCard(title: "From JSON to Swift types", caption: "Codable converts between them automatically when names and types line up. Decodable reads, Encodable writes, Codable does both.") { // Course step 2.
            TermList(terms: [ // The course's mapping.
                Term(term: "Object { }", text: "A struct whose stored properties match the keys."), // Objects.
                Term(term: "Array [ ]", text: "A Swift Array, such as [Todo]."), // Arrays.
                Term(term: "String, number, true/false", text: "String; Int or Double; Bool."), // Scalars.
                Term(term: "null or a missing key", text: "An Optional property, such as let dueDate: String?. A non-optional property with no value is a decoding error."), // Missing values.
            ])
            Callout(title: "Model only what you use", text: "Your struct may skip keys it does not need. Extra keys in the JSON are ignored, so the server can add fields without breaking your app. The CodingKeys card below ignores \"interval\" that way.", systemImage: "lightbulb") // The course's tip.
        }
    }
}

/// "Decode your first response": the course program, then the same decode on the live reply.
private struct FirstDecodeCard: View { // Card 3.
    @State private var phase = LivePhase<[String]>.idle // The live decode's output.

    var body: some View { // Rebuilt when phase changes.
        DemoCard(title: "Decode your first response", caption: "The JSON that GET /todos/1 really returns, decoded into Todo. Expected output: delectus aut autem, then Still to do.") { // Course step 3.
            RunExample(json: FirstDecodeExample.json, run: FirstDecodeExample.run) // The offline program.
            AsyncButton(title: "Decode the live reply instead", action: live) // The same struct, real data.
            LiveResult(phase: phase, retry: live) { ConsoleView(lines: $0) } // The same two lines, or an error.
        }
        .autorun(live) // Screenshots run it without a tap.
    }

    /// Fetches /todos/1 and prints the same two lines from the real reply.
    private func live() async { // Called by the button and Retry.
        phase = .running // Shows the spinner.
        phase = await .of { // Success or a readable error.
            let todo = try await fetchTodo(id: 1) // Lesson 8.4's fetch: the same Todo type.
            return [todo.title, todo.completed ? "Done" : "Still to do"] // The course's two prints.
        }
    }
}

/// "Rename keys with CodingKeys": snake_case keys mapped to Swift names.
private struct CodingKeysCard: View { // Card 4.
    var body: some View { // Static apart from the Run button.
        DemoCard(title: "Rename keys with CodingKeys", caption: "A nested CodingKeys enum maps each Swift property to its JSON key. This captured reply is decoded offline; the unused \"interval\" key is ignored.") { // Course step 4.
            RunExample(json: CodingKeysExample.json, run: CodingKeysExample.run) // Prints 25.7 °C, wind 18.8 km/h.
            Text("Misspell a raw value and decoding throws keyNotFound naming the key; delete case time and the compiler stops you, because CodingKeys must list every decoded property.") // Answers the course's Try It.
                .font(.footnote) // Small note.
                .foregroundStyle(.secondary) // Quieter.
        }
    }
}

/// "Nested JSON, nested structs": the course program, then the live /users/1 reply.
private struct NestedCard: View { // Card 5.
    @State private var phase = LivePhase<[String]>.idle // The live decode's output.

    var body: some View { // Rebuilt when phase changes.
        DemoCard(title: "Nested JSON, nested structs", caption: "A second struct for the inner object, used as a property's type. Codable decodes the whole tree in one call.") { // Course step 5.
            RunExample(json: NestedExample.json, run: NestedExample.run) // Prints Leanne Graham lives on Kulas Light.
            AsyncButton(title: "Decode the live /users/1 reply", action: live) // The same structs, the full real reply.
            LiveResult(phase: phase, retry: live) { ConsoleView(lines: $0) } // The same lines, or an error.
        }
        .autorun(live) // Screenshots run it without a tap.
    }

    /// Fetches /users/1 and decodes it with the nested structs.
    private func live() async { // Called by the button and Retry.
        phase = .running // Shows the spinner.
        phase = await .of { // Success or a readable error.
            let (data, response) = try await URLSession.shared.data(from: Placeholder.url("users/1")) // The full reply, with many extra keys.
            try validate(response) // 2xx only.
            return try NestedExample.describe(data) // Extra keys are ignored.
        }
    }
}

/// "Flatten with a nested container": a flat Swift type read from nested JSON.
private struct FlattenCard: View { // Card 6.
    var body: some View { // Static apart from the Run button.
        DemoCard(title: "Flatten with a nested container", caption: "init(from:) written by hand: nestedContainer steps into address so city can be a top-level property.") { // Course step 6.
            RunExample(json: FlattenExample.json, run: FlattenExample.run) // Prints Leanne Graham, Gwenborough.
        }
    }
}

/// "When decoding fails": four inputs, four outcomes.
private struct FailuresCard: View { // Card 7.
    var body: some View { // Static apart from the Run button.
        DemoCard(title: "When decoding fails", caption: "Catching specific DecodingError cases turns a crash into a useful message. Each line below is one call to check(_:).") { // Course step 7.
            RunExample(json: DecodingFailureExample.inputs.joined(separator: "\n"), run: DecodingFailureExample.run) // The four inputs and their four results.
            Text("Adding check(\"{\\\"id\\\": 5, \\\"title\\\": null}\") would reach the final catch: a null title is valueNotFound, which neither specific clause matches.") // Answers the course's Try It.
                .font(.footnote) // Small note.
                .foregroundStyle(.secondary) // Quieter.
        }
    }
}

/// "JSON to Swift decoder lab": edit the JSON or the model and read the exact outcome.
private struct DecoderLabCard: View { // Card 8, the course's decoder lab.
    @State private var json = DecoderLab.Edit.original.json // The text being decoded.
    @State private var titleIsOptional = false // let title: String or String?
    @State private var phase = LivePhase<Void>.idle // The live load's state.

    var body: some View { // Rebuilt when the text or toggle changes.
        DemoCard(title: "JSON to Swift decoder lab", caption: "Edit the JSON or the model; the lab decodes it the way JSONDecoder does and names the exact DecodingError, its coding path and message.") { // Course widget.
            ScrollView(.horizontal, showsIndicators: false) { // Six edits do not fit on one row.
                HStack { // One button per edit.
                    ForEach(DecoderLab.Edit.allCases) { edit in // Original, delete a key, quote a number...
                        Button(edit.rawValue) { json = edit.json } // Replaces the text with that edit.
                            .buttonStyle(.bordered) // Looks tappable.
                            .font(.caption) // Small, so more fit.
                    }
                }
            }
            TextEditor(text: $json) // Free editing, too.
                .font(.system(.caption, design: .monospaced)) // Fixed width.
                .frame(minHeight: 90) // Room for a few lines.
                .scrollContentBackground(.hidden) // Lets the box color show through.
                .background(.fill.tertiary, in: .rect(cornerRadius: 8)) // A light box.
                .autocorrectionDisabled() // JSON must not be "corrected".
                .textInputAutocapitalization(.never) // Nor capitalized.
            Toggle("Model: let title: String?", isOn: $titleIsOptional) // Optional title: null and missing decode as nil.
            Text(DecoderLab.decode(json, titleIsOptional: titleIsOptional)) // Decoded as you type.
                .font(.system(.footnote, design: .monospaced)) // Fixed width, like a console.
                .fixedSize(horizontal: false, vertical: true) // Long messages wrap.
                .textSelection(.enabled) // Students can copy it.
            AsyncButton(title: "Load the real /todos/1 reply", action: load) // Replaces the text with live JSON.
            LiveResult(phase: phase, retry: load) { _ in EmptyView() } // Only failures need showing.
        }
    }

    /// Fetches /todos/1 and puts its JSON in the editor.
    private func load() async { // Called by the button and Retry.
        phase = .running // Shows the spinner.
        phase = await .of { // Success or a readable error.
            let (data, response) = try await URLSession.shared.data(from: Placeholder.url("todos/1")) // The real reply.
            try validate(response) // 2xx only.
            json = String(decoding: data, as: UTF8.self) // Into the editor.
        }
    }
}

#Preview { // Shows this lesson in Xcode's canvas.
    NavigationStack { RESTResourcesJSONLesson(lesson: ContentView.lessons[2]) } // Inside a stack, so the title shows.
}

// Lesson_6_7_SecretsInTheKeychain.swift
// Who: the student, after tapping lesson 6.7 on the home screen.
// What: the course's TokenStore working on this app's real Keychain: describe the item,
//       save (or update if it exists), read, delete, every status code in a log, and the
//       safer way to authorize a request without a key compiled into the app.
// Where: pushed from ContentView. The wrapper lives in Support/Keychain.swift.
// When: the screen reads the Keychain once when it appears; every button calls it again.
// Why: tokens and passwords belong in an encrypted vault, never in UserDefaults or a file.

import SwiftUI // Views and state.

struct SecretsInTheKeychainLesson: View { // The lesson 6.7 screen.
    let lesson: Lesson // Which lesson this page shows.
    @State private var recorder = RecordingKeychain() // The real Keychain, with every call logged.
    @State private var tokenText = "sample-token-123" // A made-up sample token. Never type a real one into a demo.
    @State private var readResult = "" // What read() returned last.
    @State private var city = "Lisbon" // The city for the request demo.
    @State private var requestLines: [String] = [] // The request the safer WeatherAPI built.

    /// The course's TokenStore, using the recording Keychain.
    private var store: TokenStore { TokenStore(keychain: recorder) } // Same service and account every time.

    var body: some View { // Rebuilt when state or the log changes.
        LessonPage(lesson: lesson) { // The shared page layout.
            DemoCard(title: "Secrets need a vault", caption: "The Keychain is an encrypted database that iOS keeps outside your container. A token in UserDefaults would sit as readable text in every backup.") { // Course concept.
                LabeledContent("Item", value: "\(store.service) / \(store.account)") // The identifying attributes.
                LabeledContent("Accessibility", value: "WhenUnlockedThisDeviceOnly") // Readable only while unlocked, never moved to a new phone.
                LabeledContent("Lifetime", value: "Can outlive a reinstall") // Items live outside the container; never rely on it either way.
            }
            .font(.footnote) // Small print for all three lines.

            DemoCard(title: "Describe the item you want", caption: "Every call takes a dictionary whose keys are constants such as kSecClass. This is TokenStore's baseQuery, printed.") { // Course code step.
                ConsoleView(lines: KeychainStatus.describe(store.baseQuery)) // Class, service and account.
            }

            DemoCard(title: "Save, or update if it exists", caption: "Tap Save twice: the second SecItemAdd returns errSecDuplicateItem, so save() updates the existing item instead.") { // Course code step.
                TextField("Sample token", text: $tokenText) // The secret to store.
                    .textFieldStyle(.roundedBorder) // A visible box.
                    .autocorrectionDisabled() // Tokens are not words.
                    .textInputAutocapitalization(.never) // Keeps the text exactly as typed.
                Button("Save") { run { try store.save(tokenText); return "save() succeeded" } } // Adds, or updates.
                    .buttonStyle(.borderedProminent) // The main action.
                ConsoleView(lines: Array(recorder.lines.suffix(6))) // The latest calls and their status codes.
            }

            DemoCard(title: "Read and delete", caption: "A missing item is not an error: read() returns nil, which means nobody has signed in.") { // Course code step.
                HStack { // The two actions.
                    Button("Read") { run { try readMessage(ifNil: "show the sign-in screen") } } // SecItemCopyMatching.
                    Button("Delete", role: .destructive) { run { try store.delete(); return "delete() succeeded" } } // SecItemDelete.
                }
                .buttonStyle(.bordered) // Secondary look.
                Text(verbatim: readResult).font(.footnote.monospaced()) // The latest result.
                ConsoleView(lines: Array(recorder.lines.suffix(4))) // The latest calls.
            }

            DemoCard(title: "Never hard-code API keys", caption: "Anything compiled into an app ships to every user, and strings can be pulled out of a binary in minutes.") { // Course compare.
                Text("Risky: a secret compiled into the app").font(.subheadline.bold()).foregroundStyle(.red) // The left side, as an explanation only.
                ScrollView(.horizontal) { // Long code lines scroll sideways instead of wrapping.
                    Text(verbatim: WeatherAPIComparison.riskyCode) // The course's risky code, shown as text and never compiled.
                        .font(.caption2.monospaced()) // Small and fixed-width.
                }
                Text("Safer: your server holds the key").font(.subheadline.bold()).foregroundStyle(.green) // The right side, which really runs.
                TextField("City", text: $city) // The query parameter.
                    .textFieldStyle(.roundedBorder) // A visible box.
                Button("Build the request") { requestLines = buildRequest() } // Builds, never sends.
                    .buttonStyle(.bordered) // Secondary look.
                ConsoleView(lines: requestLines) // The URL and the header.
                Text("The app carries only the signed-in user's own token from the Keychain. Your server adds the service's key when it calls the service.") // The course's verdict.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // A note.
            }
        }
        .task { // Runs when the screen appears.
            run { try readMessage(ifNil: "no token stored yet") } // Shows what is stored right now.
            requestLines = buildRequest() // Shows the request for the default city.
        }
    }

    /// Runs a Keychain action and shows its result or its error.
    private func run(_ action: () throws -> String) { // The action returns a message.
        do { readResult = try action() } // Success: show the message.
        catch KeychainError.unexpectedStatus(let status) { readResult = "Threw unexpectedStatus(\(status)) \(KeychainStatus.name(status))" } // A Keychain problem.
        catch { readResult = "Error: \(error.localizedDescription)" } // Anything else.
    }

    /// Reads the token and describes what read() returned.
    private func readMessage(ifNil: String) throws -> String { // ifNil explains what nil means here.
        guard let token = try store.read() else { return "read() returned nil: \(ifNil)" } // No item stored.
        return "read() returned \"\(token)\"" // The stored sample token.
    }

    /// Builds the safer request and describes it; nothing is sent over the network.
    private func buildRequest() -> [String] { // Returns lines for the console.
        guard let url = WeatherAPI.forecastURL(city: city) else { return ["Could not build a URL"] } // Bad input.
        var request = URLRequest(url: url) // A request that is never sent.
        do { try WeatherAPI.authorize(&request, store: store) } // Adds the token if one is stored.
        catch { return ["Could not read the token: \(error.localizedDescription)"] } // A Keychain problem.
        let header = request.value(forHTTPHeaderField: "Authorization") ?? "(none: no token stored)" // The header, if any.
        return ["GET \(url.absoluteString)", "Authorization: \(header)", "No API key anywhere in the app."] // What would be sent.
    }
}

/// The course's risky version, kept as text so no key is ever compiled into this app.
enum WeatherAPIComparison { // A namespace for the text.
    /// The course's left-hand code, word for word; EXAMPLE-SECRET-1234 is an obviously fake key.
    static let riskyCode = """
    enum WeatherAPI {
        static let apiKey = "EXAMPLE-SECRET-1234"

        static func forecastURL(city: String) -> URL? {
            var parts = URLComponents(
                string: "https://api.example.com/forecast")
            parts?.queryItems = [
                URLQueryItem(name: "city", value: city),
                URLQueryItem(name: "key", value: apiKey),
            ]
            return parts?.url
        }
    }
    """
}

#Preview { // Shows this lesson in Xcode's canvas.
    NavigationStack { SecretsInTheKeychainLesson(lesson: ContentView.lessons[6]) } // Inside a stack, so the title shows.
}

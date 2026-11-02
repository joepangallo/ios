// DemoKit.swift
// Who: every lesson screen in Network Lab uses these small views and helpers.
// What: launch options for screenshots, a wrapper that scrolls to one card,
//       a list of terms, a callout box, labeled values, a button that runs
//       async work, and the live-result view that turns a failure into a
//       readable message with a Retry button.
// Where: the Support folder of the app target, next to the networking helpers.
// When: SwiftUI builds these views whenever a lesson screen appears or changes.
// Why: the lesson files can then focus on networking instead of layout chores,
//      and every live request handles being offline the same friendly way.

import SwiftUI // SwiftUI provides View, Button, ProgressView and the layout types.

/// Words the app was launched with that change how the demos start.
enum LaunchOptions { // A caseless enum is a namespace: it groups names and cannot be created.
    /// True when the app was launched with -autorun, so live demos start without a tap.
    static var autorun: Bool { // Read each time, so it always reflects this launch.
        ProcessInfo.processInfo.arguments.contains("-autorun") // Screenshots pass this flag.
    }

    /// The card number that follows -card, so a screenshot can show a card further down.
    static var card: Int? { // nil when the flag is missing.
        let args = ProcessInfo.processInfo.arguments // Every word the app was launched with.
        guard let flag = args.firstIndex(of: "-card"), flag + 1 < args.count else { return nil } // The number must follow the flag.
        return Int(args[flag + 1]) // Int(_:) returns nil when the word is not a number.
    }

    /// The text that follows -search, so a screenshot can open lesson 8.5's search screen already typed in.
    static var searchText: String? { // nil when the flag is missing.
        let args = ProcessInfo.processInfo.arguments // Every word the app was launched with.
        guard let flag = args.firstIndex(of: "-search"), flag + 1 < args.count else { return nil } // The text must follow the flag.
        return args[flag + 1] // The words to search for.
    }
}

extension View { // Adds two helpers to every view.
    /// Runs the action once when the view appears, but only for -autorun launches.
    func autorun(_ action: @escaping () async -> Void) -> some View { // Used by demos that normally wait for a tap.
        task { if LaunchOptions.autorun { await action() } } // .task starts with the view and is cancelled when it goes away.
    }
}

/// Wraps a lesson page so the launch argument -card N scrolls card N to the top.
struct CardScroller<Content: View>: View { // Generic over the lesson page inside.
    @ViewBuilder let content: () -> Content // The lesson page, which contains the ScrollView.

    var body: some View { // Built once per lesson screen.
        ScrollViewReader { proxy in // The proxy can scroll any ScrollView inside its content.
            content() // The lesson page itself.
                .task { // Runs once, after the page appears.
                    guard let card = LaunchOptions.card else { return } // Only screenshots pass -card.
                    try? await Task.sleep(for: .milliseconds(400)) // Lets the page finish its first layout.
                    proxy.scrollTo(card, anchor: .top) // Every DemoCard carries .id(number), so this finds it.
                }
        }
    }
}

/// One word or phrase and its explanation, as the course lists them.
struct Term: Identifiable { // Identifiable so ForEach can tell the rows apart.
    let term: String // The word in bold, for example "Request".
    let text: String // The explanation under it.
    var id: String { term } // Terms never repeat inside one list.
}

/// Shows a list of terms with their explanations, the way the course page does.
struct TermList: View { // Used by almost every concept card.
    let terms: [Term] // The rows, in course order.

    var body: some View { // Rebuilt only if the terms change, which they never do.
        VStack(alignment: .leading, spacing: 8) { // One row per term, left-aligned.
            ForEach(terms) { item in // One block per term.
                VStack(alignment: .leading, spacing: 2) { // The term over its explanation.
                    Text(item.term) // The term itself.
                        .font(.subheadline.weight(.semibold)) // Bold enough to scan.
                    Text(item.text) // The explanation.
                        .font(.subheadline) // Same size as the term...
                        .foregroundStyle(.secondary) // ...but quieter, so the term leads.
                        .fixedSize(horizontal: false, vertical: true) // Wraps instead of truncating.
                }
            }
        }
    }
}

/// A tinted box for a course callout: a tip, a warning or a design note.
struct Callout: View { // Mirrors the colored callouts on the course page.
    let title: String // The callout's heading.
    let text: String // The callout's sentence or two.
    var systemImage = "lightbulb" // An SF Symbol that hints at the tone.

    var body: some View { // Rebuilt only if the text changes.
        HStack(alignment: .top, spacing: 10) { // Icon on the left, words on the right.
            Image(systemName: systemImage) // The tone icon.
                .foregroundStyle(.tint) // Uses the app's accent color.
            VStack(alignment: .leading, spacing: 2) { // Heading over sentence.
                Text(title) // The heading.
                    .font(.subheadline.weight(.semibold)) // Bold heading.
                Text(text) // The sentence.
                    .font(.subheadline) // Readable body size.
                    .fixedSize(horizontal: false, vertical: true) // Wraps onto as many lines as needed.
            }
        }
        .padding(10) // Breathing room inside the box.
        .frame(maxWidth: .infinity, alignment: .leading) // Full card width.
        .background(.tint.opacity(0.12), in: .rect(cornerRadius: 10)) // A soft tinted panel that works in dark mode.
    }
}

/// One label and its value on a single row, for facts such as "Status: 200".
struct ValueRow: View { // Used wherever a demo reports measured facts.
    let label: String // What the value is.
    let value: String // The value itself, shown exactly.

    var body: some View { // Rebuilt when the value changes.
        HStack(alignment: .firstTextBaseline) { // Label and value share a baseline.
            Text(label) // The label.
                .font(.subheadline) // Readable size.
                .foregroundStyle(.secondary) // Quieter than the value.
            Spacer(minLength: 8) // Pushes the value to the trailing edge.
            Text(verbatim: value) // verbatim: values are shown exactly, never translated.
                .font(.system(.subheadline, design: .monospaced)) // Fixed width, like code.
                .multilineTextAlignment(.trailing) // Long values wrap neatly on the right.
        }
    }
}

/// A button that runs async work, shows a spinner meanwhile and ignores extra taps.
struct AsyncButton: View { // Network demos all need this shape.
    let title: String // The button's words.
    var role: ButtonRole? = nil // .destructive draws it in red, for clearing and deleting.
    let action: () async -> Void // The async work to run on each tap.
    @State private var isRunning = false // True while the work is in progress.

    var body: some View { // Rebuilt when isRunning changes.
        Button(role: role) { // A Button's action is synchronous...
            Task { // ...so a Task is needed to call async code from it.
                isRunning = true // Shows the spinner and disables the button.
                await action() // Waits for the work without blocking the main thread.
                isRunning = false // Back to normal once the work finishes.
            }
        } label: { // What the button looks like.
            HStack(spacing: 6) { // Spinner beside the title.
                if isRunning { ProgressView() } // Only while waiting.
                Text(title) // The button's words.
            }
        }
        .buttonStyle(.bordered) // A visible outline, so it reads as tappable.
        .disabled(isRunning) // A second tap cannot start a second copy of the work.
    }
}

/// Where a live request stands: not started, waiting, finished or failed.
enum LivePhase<Value> { // Generic: each demo chooses what a success carries.
    case idle // Nothing requested yet, or the work was cancelled.
    case running // The request is in flight.
    case success(Value) // The result, carried with the state.
    case failure(String) // A readable sentence for the person holding the phone.

    /// Runs the work and turns its outcome into a phase, with errors made readable.
    static func of(_ work: () async throws -> Value) async -> LivePhase { // Every live demo calls this.
        do { // The work may throw.
            return .success(try await work()) // Success carries the value.
        } catch { // Any failure lands here.
            guard let message = userMessage(for: error) else { return .idle } // Cancellation shows nothing, as Lesson 8.5 explains.
            return .failure(message) // Everything else becomes a sentence.
        }
    }
}

/// Shows a live phase: a spinner, the result, or a readable error with a Retry button.
struct LiveResult<Value, Content: View>: View { // Generic over the value and how it is drawn.
    let phase: LivePhase<Value> // What to show.
    let retry: () async -> Void // What the Retry button runs.
    @ViewBuilder let content: (Value) -> Content // How a success is drawn.

    var body: some View { // Rebuilt whenever the phase changes.
        switch phase { // One branch per state, so two states can never show at once.
        case .idle: // Nothing to show yet.
            EmptyView() // Takes no space.
        case .running: // Waiting for the server.
            ProgressView("Waiting for the server") // A labeled spinner, so VoiceOver says what is happening.
        case .success(let value): // The work finished.
            content(value) // The demo decides how to draw its result.
        case .failure(let message): // The work failed.
            ErrorBox(message: message, retry: retry) // A readable message and a way to try again.
        }
    }
}

/// A readable failure message with a Retry button underneath.
struct ErrorBox: View { // Every live request uses this when it fails.
    let message: String // The sentence from userMessage(for:).
    let retry: () async -> Void // Runs the same request again.

    var body: some View { // Rebuilt when the message changes.
        VStack(alignment: .leading, spacing: 8) { // Message over button.
            Label(message, systemImage: "exclamationmark.triangle") // The sentence with a warning icon.
                .font(.subheadline) // Readable size.
                .foregroundStyle(.orange) // Noticeable without shouting.
            AsyncButton(title: "Retry", action: retry) // Sends the request again.
        }
        .accessibilityElement(children: .contain) // VoiceOver reads the message and offers the button.
    }
}

// SessionListView.swift
// Who: lesson 9.3 (the list the UI test drives), lesson 9.7 (the Today
//      screen's log) and the previews below.
// What: the list of logged sessions with an Add Session button that opens the
//       New Session sheet, plus an empty state for a first launch.
// Where: Features/Sessions, everything the Sessions feature needs in one folder.
// When: rebuilt whenever the shared SessionStore changes.
// Why: the view only displays and forwards taps; the store owns the data. Its
//      button carries a stable accessibility identifier for UI tests, and the
//      previews at the bottom are lesson 9.3's visual checks.

import SwiftUI // SwiftUI provides the views, sheet and accessibility modifiers.

/// The week's sessions, newest first, with a button to add one.
struct SessionListView: View { // Takes its store as input, which makes previews easy.
    let store: SessionStore // The shared store, injected by whoever shows the list.
    var showsAddButton = true // Visual-check copies hide it, so UI tests find exactly one button.
    @State private var isAdding = false // Whether the New Session sheet is showing.

    var body: some View { // Rebuilt when the store's sessions change.
        VStack(alignment: .leading, spacing: 10) { // Header, then rows.
            HStack { // The heading and the button share a line.
                Text("Sessions") // A localizable heading.
                    .font(.title3.bold()) // Large enough to read as a heading.
                    .accessibilityAddTraits(.isHeader) // VoiceOver can jump to it.
                Spacer() // Pushes the button to the trailing edge.
                if showsAddButton { // Only the live list offers the button.
                    Button("Add Session", systemImage: "plus") { isAdding = true } // Opens the sheet.
                        .buttonStyle(.bordered) // A visible, 44-point-tall target.
                        .accessibilityIdentifier("addSessionButton") // The name the UI test taps.
                }
            }
            if let problem = store.problem { // A failed load or save...
                Label(problem, systemImage: "exclamationmark.triangle") // ...is shown, not hidden.
                    .foregroundStyle(.red) // Red text plus an icon: never colour alone.
            }
            if store.sessions.isEmpty { // A first launch has nothing logged.
                ContentUnavailableView("No sessions yet", systemImage: "book.closed", description: Text("Tap Add Session to log your first study session.")) // The standard empty state.
            } else { // At least one session.
                ForEach(Array(store.sessions.enumerated()), id: \.offset) { _, session in // Position as identity: subjects can repeat.
                    SessionRow(session: session) // One row per session.
                }
            }
        }
        .sheet(isPresented: $isAdding) { NewSessionView(store: store) } // The form, sharing the same store.
    }
}

/// One session: the subject and its minutes.
struct SessionRow: View { // Small and cheap, because there may be many.
    let session: StudySession // The data to show.

    var body: some View { // Static for a given session.
        HStack { // Subject on the left, minutes on the right.
            Image(systemName: "book") // A small decorative icon.
                .foregroundStyle(.tint) // The app's accent colour.
                .accessibilityHidden(true) // Decoration: VoiceOver skips it.
            Text(verbatim: session.subject) // User data is shown as typed, never translated.
            Spacer() // Pushes the minutes to the trailing edge.
            Text("\(session.minutes) min") // Localizable: "%lld min".
                .foregroundStyle(.secondary) // Quieter than the subject.
                .monospacedDigit() // Numbers line up from row to row.
        }
        .padding(.vertical, 6) // Comfortable row height.
    }
}

#Preview("Sample data") { // The normal state, with the two known rows.
    ScrollView { SessionListView(store: .sample).padding() } // A fresh seeded store for this preview.
}

#Preview("Empty state") { // What a first launch looks like.
    ScrollView { SessionListView(store: SessionStore(storage: InMemorySessionStorage())).padding() } // No rows at all.
}

#Preview("Largest text") { // Reveals clipped or overlapping text.
    ScrollView { SessionListView(store: .sample).padding() } // The same list...
        .environment(\.dynamicTypeSize, .accessibility3) // ...at a very large accessibility text size.
}

#Preview("Dark mode") { // The course's "try it": one more state to check by eye.
    ScrollView { SessionListView(store: .sample).padding() } // The same list...
        .preferredColorScheme(.dark) // ...in dark mode.
}

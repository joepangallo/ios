// NewSessionView.swift
// Who: SessionListView presents it as a sheet; the UI test types into it.
// What: the form for adding a study session: a title field, a minutes stepper
//       and a Save button that stays disabled until a title is typed.
// Where: Features/Sessions, beside the list that presents it.
// When: created when the user (or a UI test) taps Add Session.
// Why: lesson 9.3. The text field and Save button carry accessibility
//      identifiers, names only tests can see, which survive translation.

import SwiftUI // SwiftUI provides Form, TextField, Stepper and the dismiss action.

/// The New Session sheet.
struct NewSessionView: View { // A small, focused view is easy to tag and to test.
    let store: SessionStore // The shared store that receives the new session.
    @Environment(\.dismiss) private var dismiss // Closes the sheet without knowing who presented it.
    @State private var title = "" // The text being typed, local to this sheet.
    @State private var minutes = 25 // The session length, local to this sheet.

    var body: some View { // Rebuilt on every keystroke.
        NavigationStack { // Gives the sheet a title bar for its title and Cancel button.
            Form { // The standard grouped style, with correct accessibility for free.
                TextField("Title", text: $title) // Placeholder and label "Title", "Título" in Spanish.
                    .accessibilityIdentifier("sessionTitleField") // Tests query it as app.textFields["sessionTitleField"].
                Stepper("\(minutes) minutes", value: $minutes, in: 5...180, step: 5) // Five-minute steps.
                Button("Save") { // The label is also the accessibility label.
                    store.add(title, minutes: minutes) // The store owns the data and checks the title again.
                    dismiss() // Back to the list, where the new row now sits on top.
                }
                .disabled(!SessionStore.isValidTitle(title)) // The store's rule: no empty titles.
                .accessibilityIdentifier("saveSessionButton") // Tests query it as app.buttons["saveSessionButton"].
            }
            .navigationTitle("New Session") // The sheet's title.
            .navigationBarTitleDisplayMode(.inline) // A compact title bar.
            .toolbar { // Bar buttons.
                ToolbarItem(placement: .cancellationAction) { // The standard leading position.
                    Button("Cancel") { dismiss() } // Closes without saving.
                }
            }
        }
    }
}

#Preview { // The sheet on its own, with an empty in-memory store.
    NewSessionView(store: SessionStore(storage: InMemorySessionStorage())) // Saving here changes nothing real.
}

// Lesson_6_6_RelationshipsAndSchemaChanges.swift
// Who: the student, after tapping lesson 6.6 on the home screen.
// What: Folder and Note linked one-to-many, both ways of connecting them, the four
//       delete rules (simulated) and the real .cascade rule, editing with @Bindable,
//       the in-memory container used by previews, and a real VersionedSchema migration.
// Where: pushed from ContentView. The models live in Models/FolderNote.swift and
//        Models/NotesSchemas.swift; the helpers in Support/RelationshipDemos.swift.
// When: the first visit runs addSampleData(to:) once; every button changes real data.
// Why: real data is connected, and shipped models must change without losing data.

import SwiftUI // Views and state.
import SwiftData // @Query, @Bindable models and ModelContext.

struct RelationshipsAndSchemaChangesLesson: View { // The lesson 6.6 screen.
    let lesson: Lesson // Which lesson this page shows.
    @Environment(\.modelContext) private var context // The app's main context.
    @Query(sort: \Folder.name) private var folders: [Folder] // Every folder, A to Z.
    @Query(sort: \Note.text) private var notes: [Note] // Every note, A to Z.
    @AppStorage(SettingsKey.seededFolders) private var seeded = false // Whether the sample data was added already.
    @State private var newFolderName = "" // The add-folder text field.
    @State private var simulation = DeleteRuleSimulation() // The pretend folder for the rule comparison.
    @State private var rule = DeleteRuleSimulation.Rule.nullify // The rule to try.
    @State private var cascadeMessage = "" // What the real cascade delete did.
    @State private var previewReport = Transcript() // What the in-memory container held.
    @State private var migrationLog = Transcript() // What the migration printed.
    @State private var editingNote: Note? // The note the inline editor edits; kept fixed so typing never switches notes.

    var body: some View { // Rebuilt whenever folders, notes or state change.
        LessonPage(lesson: lesson) { // The shared page layout.
            DemoCard(title: "Models that point to each other", caption: "Folder.notes is the to-many end; Note.folder is the to-one end. Change one end and SwiftData updates the other at once.") { // Course concept.
                FolderTreeView(folders: folders, unfiled: notes.filter { $0.folder == nil }) // Each folder with its notes.
                HStack { // Two ways to move a note.
                    Button("note.folder = first folder") { fileFirstUnfiledNote() } // Sets the to-one end.
                    Button("note.folder = nil") { unfileLastNote() } // Clears it.
                }
                .buttonStyle(.bordered) // Secondary look.
                .font(.caption) // Long labels need small text.
            }

            DemoCard(title: "Folder and Note, linked", caption: "@Relationship(deleteRule: .cascade, inverse: \\Note.folder) sits on the to-many end.") { // Course code step.
                HStack { // Add a folder.
                    TextField("New folder name", text: $newFolderName) // The name to use.
                        .textFieldStyle(.roundedBorder) // A visible box.
                    Button("Add folder") { addFolder() } // Inserts a Folder.
                        .disabled(newFolderName.trimmingCharacters(in: .whitespaces).isEmpty) // No blank names.
                }
                Button("Add a note to \(folders.first?.name ?? "a new folder")") { addNoteToFirstFolder() } // Inserts a Note and links it.
                    .buttonStyle(.bordered) // Secondary look.
                Text(verbatim: "In the database: folders \(folders.count), notes \(notes.count)") // Live counts.
                    .font(.caption.monospaced()) // Fixed-width.
            }

            DemoCard(title: "Delete rules", caption: "Pick a rule and delete the pretend Work folder. This app's real Folder uses .cascade, which you can try for real below.") { // Course concept and figure.
                Picker("Rule", selection: $rule) { // The rule to apply.
                    ForEach(DeleteRuleSimulation.Rule.allCases) { Text($0.rawValue).tag($0) } // Four rules.
                }
                .pickerStyle(.segmented) // Side by side.
                HStack { // The two actions.
                    Button("Delete Work") { simulation.deleteFolder(rule: rule) } // Applies the rule.
                        .buttonStyle(.borderedProminent) // The main action.
                    Button("Reset") { simulation = DeleteRuleSimulation() } // Starts over.
                        .buttonStyle(.bordered) // Secondary look.
                }
                Text(verbatim: simulation.folderExists ? "Folder Work: exists" : "Folder Work: deleted").font(.caption.bold()) // The folder's state.
                ForEach(simulation.notes) { note in // Each remaining note.
                    Text(verbatim: "\(note.text)  ->  \(simulation.folderLabel(for: note))").font(.caption.monospaced()) // Where it points now.
                }
                if simulation.notes.isEmpty { Text("No notes left.").font(.caption) } // After a cascade.
                Text(simulation.message).font(.footnote) // What happened.
                Divider() // Separates the simulation from the real delete.
                Button("Delete \(folders.first?.name ?? "a folder") for real (.cascade)", role: .destructive) { deleteFirstFolderForReal() } // Uses SwiftData.
                    .disabled(folders.isEmpty) // Nothing to delete.
                if !cascadeMessage.isEmpty { Text(cascadeMessage).font(.footnote.monospaced()) } // Before and after counts.
            }

            DemoCard(title: "Connecting objects", caption: "The course's addSampleData(to:) inserts each object first, then links one note from the to-one end and one from the to-many end.") { // Course code step.
                Button("Run addSampleData(to:)") { addSampleData(to: context) } // Adds Work with two notes.
                    .buttonStyle(.borderedProminent) // The main action.
                if let work = folders.first(where: { $0.name == "Work" }) { // Shows the result when Work exists.
                    Text(verbatim: "Work.notes: " + work.notes.map(\.text).sorted().joined(separator: ", ")) // Both notes, whichever end linked them.
                        .font(.caption.monospaced()) // Fixed-width.
                }
            }

            DemoCard(title: "Edit a model with @Bindable", caption: "Type in the field: each keystroke changes the stored note, and autosave writes it. Or open the course's NoteEditor.") { // Course code step.
                if let note = editingNote, notes.contains(where: { $0 === note }) { // Only while that note still exists.
                    InlineNoteEditor(note: note) // A @Bindable text field right here.
                }
                ForEach(notes) { note in // A link per note.
                    NavigationLink { // Pushes the editor onto this screen's navigation stack.
                        NoteEditor(note: note) // The course's editor.
                    } label: { // The row.
                        Label(note.text, systemImage: "square.and.pencil").font(.footnote) // The note's text.
                    }
                }
            }

            DemoCard(title: "Previews with an in-memory container", caption: "isStoredInMemoryOnly: true builds a database that vanishes when it is released. Previews and unit tests use it so they never touch real data.") { // Course code step.
                Button("Build an in-memory container") { previewReport = buildInMemoryContainer() } // Runs the course's preview code.
                    .buttonStyle(.bordered) // Secondary look.
                ConsoleView(lines: previewReport.lines) // What it held.
            }

            DemoCard(title: "Change models safely with VersionedSchema", caption: "Version 1 had Note.text. Version 2 renames it to body with @Attribute(originalName:) and adds isPinned with a default. This runs the real migration on a scratch file in tmp.") { // Course code step.
                Button("Run the migration") { // Saves with V1, reopens with V2.
                    do { migrationLog = try MigrationDemo.run() } // Every step.
                    catch { migrationLog = Transcript(); migrationLog.print("Migration failed:", error.localizedDescription) } // Reports a failure.
                }
                .buttonStyle(.borderedProminent) // The main action.
                ConsoleView(lines: migrationLog.lines) // The steps and the migrated notes.
            }
        }
        .onChange(of: notes.count) { pickEditingNote() } // Sample data arrives, or the note was deleted.
        .task { // Runs when the screen appears.
            if !seeded && folders.isEmpty { // Only on the first visit to an empty database.
                addSampleData(to: context) // The course's sample data.
                context.insert(Note(text: "Plan the weekend")) // One note with no folder, to show the nil to-one end.
            }
            seeded = true // Never again.
            pickEditingNote() // Chooses the inline editor's note.
            if migrationLog.lines.isEmpty { migrationLog = (try? MigrationDemo.run()) ?? Transcript() } // Shows the migration once, so the card is never empty.
            if previewReport.lines.isEmpty { previewReport = buildInMemoryContainer() } // Same for the in-memory container.
        }
    }

    /// Keeps the inline editor on one note, choosing a new one only when it has none or its note was deleted.
    private func pickEditingNote() { // Called on appear and whenever the number of notes changes.
        if editingNote == nil || !notes.contains(where: { $0 === editingNote }) { editingNote = notes.first } // The first note, A to Z.
    }

    /// Adds a folder with the typed name.
    private func addFolder() { // Called by the Add folder button.
        context.insert(Folder(name: newFolderName.trimmingCharacters(in: .whitespaces))) // A new, empty folder.
        newFolderName = "" // Clears the field.
    }

    /// Inserts a note, then links it from the to-many end.
    private func addNoteToFirstFolder() { // Called by the Add a note button.
        let folder = folders.first ?? Folder(name: "Inbox") // Uses the first folder, or makes one.
        if folders.isEmpty { context.insert(folder) } // A new folder must be inserted too.
        let note = Note(text: "Note \(notes.count + 1)") // A numbered note.
        context.insert(note) // Insert before linking, as the course advises.
        folder.notes.append(note) // The to-many end; note.folder updates itself.
    }

    /// Files the first unfiled note into the first folder through the to-one end.
    private func fileFirstUnfiledNote() { // Shows that folder.notes updates.
        guard let note = notes.first(where: { $0.folder == nil }), let folder = folders.first else { return } // Needs both.
        note.folder = folder // One assignment; SwiftData fixes folder.notes.
    }

    /// Clears the folder of the last filed note.
    private func unfileLastNote() { // Shows that folder.notes shrinks.
        notes.last(where: { $0.folder != nil })?.folder = nil // The note leaves its folder.
    }

    /// Deletes the first folder with SwiftData and reports the note count before and after.
    private func deleteFirstFolderForReal() { // The real .cascade rule.
        guard let folder = folders.first else { return } // Needs a folder.
        let before = (try? context.fetchCount(FetchDescriptor<Note>())) ?? 0 // Notes before.
        let name = folder.name // Read before the object is deleted.
        context.delete(folder) // Marks the folder, and by cascade its notes, for deletion.
        try? context.save() // Applies the delete rule and writes it.
        let after = (try? context.fetchCount(FetchDescriptor<Note>())) ?? 0 // Notes after.
        cascadeMessage = "Deleted \(name): notes \(before) -> \(after)" // The cascade at work.
    }

    /// Runs the course's preview code and reports what the in-memory container holds.
    private func buildInMemoryContainer() -> Transcript { // Returns lines to show.
        var out = Transcript() // Collects the report.
        do { // Building a container can throw.
            let (container, note) = try PreviewData.makeContainer() // The course's preview setup.
            let folders = try container.mainContext.fetchCount(FetchDescriptor<Folder>()) // 1.
            let notes = try container.mainContext.fetchCount(FetchDescriptor<Note>()) // 1.
            out.print("In memory: \(folders) folder, \(notes) note") // Its contents.
            out.print("note.folder:", note.folder?.name ?? "nil") // Ideas.
            out.print("Stored in memory only:", container.configurations.first?.isStoredInMemoryOnly ?? false) // true.
            out.print("Real database still has", (try? context.fetchCount(FetchDescriptor<Folder>())) ?? 0, "folders") // Untouched.
        } catch { // A failure.
            out.print("Could not build it:", error.localizedDescription) // Reports it.
        }
        return out // The report; the container is released when this function returns.
    }
}

/// Folders with their notes, and the notes with no folder.
struct FolderTreeView: View { // Read-only display.
    let folders: [Folder] // Every folder.
    let unfiled: [Note] // Notes whose folder is nil.

    var body: some View { // One block per folder.
        VStack(alignment: .leading, spacing: 6) { // Stacked blocks.
            ForEach(folders) { folder in // Each folder.
                Text(verbatim: "\(folder.name) (\(folder.notes.count) notes): " + folder.notes.map(\.text).sorted().joined(separator: ", ")) // folder.notes, the to-many end.
                    .font(.caption.monospaced()) // Fixed-width.
            }
            Text(verbatim: "folder == nil: " + (unfiled.isEmpty ? "none" : unfiled.map(\.text).joined(separator: ", "))) // The to-one end is nil.
                .font(.caption.monospaced()) // Fixed-width.
        }
    }
}

/// A one-line editor that edits a stored note directly through @Bindable.
struct InlineNoteEditor: View { // Same idea as NoteEditor, inside the card.
    @Bindable var note: Note // Provides $note.text without owning the note.

    var body: some View { // A labeled text field.
        TextField("Text", text: $note.text) // Every keystroke changes the model.
            .textFieldStyle(.roundedBorder) // A visible box.
    }
}

/// The course's NoteEditor, exactly as written.
struct NoteEditor: View { // Edits one note.
    @Bindable var note: Note // The note lives in the context; @Bindable only makes bindings.

    var body: some View { // A form with the note's fields.
        Form { // Grouped rows.
            TextField("Text", text: $note.text, axis: .vertical) // Grows to several lines.
            LabeledContent("Folder", value: note.folder?.name ?? "None") // The to-one end, read-only.
            Button("Remove from folder") { // Clears the relationship.
                note.folder = nil // SwiftData removes it from folder.notes too.
            }
        }
        .navigationTitle("Edit Note") // The title when pushed.
    }
}

#Preview { // The course's preview: an in-memory container with sample data.
    let config = ModelConfiguration(isStoredInMemoryOnly: true) // Lives only in memory.
    let container = try! ModelContainer( // try! is acceptable in a preview, never in app code.
        for: Folder.self, Note.self, // The two related models.
        configurations: config // In memory.
    )
    let folder = Folder(name: "Ideas") // Sample folder.
    container.mainContext.insert(folder) // Inserted first.
    let note = Note(text: "Try SwiftData") // Sample note.
    container.mainContext.insert(note) // Inserted first.
    note.folder = folder // Linked.

    return NavigationStack { // So the navigation title shows.
        NoteEditor(note: note) // The view under test.
    }
    .modelContainer(container) // The in-memory database.
}

#Preview("Lesson 6.6") { // The whole lesson with a throwaway database.
    NavigationStack { RelationshipsAndSchemaChangesLesson(lesson: ContentView.lessons[5]) } // Inside a stack.
        .modelContainer(for: [TaskItem.self, Folder.self, Note.self], inMemory: true) // Never touches the real database.
}

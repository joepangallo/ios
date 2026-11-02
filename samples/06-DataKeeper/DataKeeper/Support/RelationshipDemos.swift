// RelationshipDemos.swift
// Who: lesson 6.6's cards call these; the tests run them against in-memory containers.
// What: the course's addSampleData(to:) function, a step-by-step simulation of the four
//       delete rules, the in-memory container the course's preview builds, and a real
//       migration from NotesSchemaV1 to NotesSchemaV2 on a scratch store.
// Where: the Support folder.
// When: when the student taps the matching buttons on the lesson 6.6 screen.
// Why: relationships and migrations are easiest to understand by watching them happen.

import Foundation // URL and FileManager.
import SwiftData // ModelContext, ModelContainer and the schemas.

/// The course's "Connecting objects" function: two ways to link a note to a folder.
@MainActor // The main context belongs to the main thread.
func addSampleData(to context: ModelContext) { // Inserts a folder and two linked notes.
    let work = Folder(name: "Work") // A new folder, in memory.
    context.insert(work) // Managed by the context before any linking.

    let agenda = Note(text: "Draft the agenda") // A new note.
    context.insert(agenda) // Managed by the same context.
    agenda.folder = work // Link from the to-one end; SwiftData adds it to work.notes.

    let budget = Note(text: "Check the budget") // Another note.
    context.insert(budget) // Managed by the same context.
    work.notes.append(budget) // Link from the to-many end; SwiftData sets budget.folder.
}

/// A pretend folder with three notes, used to compare all four delete rules side by side.
struct DeleteRuleSimulation: Equatable { // A value type: Reset is just a new value.
    /// The four delete rules from the course.
    enum Rule: String, CaseIterable, Identifiable { // String raw values are the picker labels.
        case nullify = ".nullify" // The default: notes stay, folder becomes nil.
        case cascade = ".cascade" // Notes are deleted too.
        case deny = ".deny" // The delete fails while notes remain.
        case noAction = ".noAction" // Nothing is updated: dangling references.
        var id: String { rawValue } // Identifiable for ForEach.
    }

    /// One pretend note and the name of the folder it points at.
    struct SimNote: Equatable, Identifiable { // Equatable for tests, Identifiable for ForEach.
        let id: Int // A stable identity.
        let text: String // What it says.
        var folder: String? // The folder it points at, or nil.
    }

    var folderExists = true // Whether the Work folder is still there.
    var notes = [SimNote(id: 1, text: "Draft the agenda", folder: "Work"), // Three notes, all in Work.
                 SimNote(id: 2, text: "Check the budget", folder: "Work"), // The second.
                 SimNote(id: 3, text: "Book the room", folder: "Work")] // The third.
    var message = "Work holds 3 notes. Pick a rule and delete the folder." // What happened last.

    /// Deletes the Work folder under the given rule.
    mutating func deleteFolder(rule: Rule) { // mutating: it changes this value.
        guard folderExists else { message = "Work is already deleted. Tap Reset to try another rule."; return } // Only once per reset.
        let count = notes.filter { $0.folder == "Work" }.count // How many notes point at Work.
        switch rule { // One behavior per rule.
        case .nullify: // The default rule.
            folderExists = false // The folder goes.
            for index in notes.indices where notes[index].folder == "Work" { notes[index].folder = nil } // Each note's folder becomes nil.
            message = "Folder deleted. The \(count) notes stay, and their folder is now nil." // Explains.
        case .cascade: // Children cannot live alone.
            folderExists = false // The folder goes.
            notes.removeAll { $0.folder == "Work" } // And every note in it.
            message = "Folder deleted, and its \(count) notes were deleted with it." // Explains.
        case .deny: // Refuse while children exist.
            message = count > 0 ? "Save failed: Work still has \(count) notes, so nothing was deleted." : "Folder deleted." // Nothing changes when notes remain.
            if count == 0 { folderExists = false } // An empty folder can go.
        case .noAction: // Do nothing to the notes.
            folderExists = false // The folder goes...
            message = "Folder deleted, but the \(count) notes still point at it: dangling references." // ...and the notes are left pointing at nothing.
        }
    }

    /// What a note's folder property shows after the delete.
    func folderLabel(for note: SimNote) -> String { // Used by the rows on screen.
        guard let folder = note.folder else { return "folder: nil" } // Nullified.
        return folderExists ? "folder: \(folder)" : "folder: \(folder) (deleted!)" // Dangling when the folder is gone.
    }
}

/// The course's preview pattern, as a function both the screen and the tests can call.
enum PreviewData { // A namespace for the helper.
    /// Builds an in-memory container holding the course's Ideas folder and one note.
    static func makeContainer() throws -> (container: ModelContainer, note: Note) { // Returns the note too, for the editor.
        let config = ModelConfiguration(isStoredInMemoryOnly: true) // Lives only in memory.
        let container = try ModelContainer( // A database just for this.
            for: Folder.self, Note.self, // The two related models.
            configurations: config // The in-memory configuration.
        )
        let folder = Folder(name: "Ideas") // The course's sample folder.
        container.mainContext.insert(folder) // Inserted before linking.
        let note = Note(text: "Try SwiftData") // The course's sample note.
        container.mainContext.insert(note) // Inserted before linking.
        note.folder = folder // Linked; folder.notes now contains it.
        return (container, note) // Both, for the caller.
    }
}

/// Runs a real migration: saves notes with version 1, then reopens the file with version 2.
enum MigrationDemo { // A namespace for the demo.
    /// The scratch folder the demo uses, inside tmp so it never touches real data.
    static let defaultFolder = URL.temporaryDirectory.appending(path: "MigrationDemo") // tmp may be cleared any time, which is fine here.

    /// Creates a version 1 store, closes it, opens it with the migration plan, and prints each step.
    static func run(in folder: URL = defaultFolder) throws -> Transcript { // Tests pass their own folder.
        var out = Transcript() // Collects the printed lines.
        let manager = FileManager.default // The shared file manager.
        try? manager.removeItem(at: folder) // Starts from nothing every time.
        try manager.createDirectory(at: folder, withIntermediateDirectories: true) // Makes the scratch folder.
        let url = folder.appending(path: "notes.store") // The SQLite file both versions use.

        try saveVersionOne(at: url, log: &out) // Step 1, in its own function so the version 1 container is closed afterwards.

        let schema = Schema(versionedSchema: NotesSchemaV2.self) // The current models.
        let config = ModelConfiguration(schema: schema, url: url) // The same file as before.
        let container = try ModelContainer(for: schema, migrationPlan: NotesMigrationPlan.self, configurations: config) // Opening runs the lightweight stage.
        out.print("Opened the same file with NotesSchemaV2 and NotesMigrationPlan") // Step 2.
        let context = ModelContext(container) // A context for reading.
        let notes = try context.fetch(FetchDescriptor<NotesSchemaV2.Note>(sortBy: [SortDescriptor(\.body)])) // Every note, A to Z.
        for note in notes { // One line per migrated note.
            out.print("body:", note.body, "| isPinned:", note.isPinned) // text became body; isPinned got its default.
        }
        return out // Every step.
    }

    /// Saves two notes with the version 1 schema.
    private static func saveVersionOne(at url: URL, log out: inout Transcript) throws { // inout: adds lines to the caller's transcript.
        let schema = Schema(versionedSchema: NotesSchemaV1.self) // The old models.
        let config = ModelConfiguration(schema: schema, url: url) // The scratch file.
        let container = try ModelContainer(for: schema, configurations: config) // Creates the file.
        let context = ModelContext(container) // A context for writing.
        context.insert(NotesSchemaV1.Note(text: "Draft the agenda")) // A version 1 note.
        context.insert(NotesSchemaV1.Note(text: "Check the budget")) // Another.
        try context.save() // Writes both to disk.
        out.print("Version 1 saved", try context.fetchCount(FetchDescriptor<NotesSchemaV1.Note>()), "notes with a text property") // Step 1.
    }
}

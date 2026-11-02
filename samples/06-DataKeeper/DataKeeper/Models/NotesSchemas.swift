// NotesSchemas.swift
// Who: SwiftData's migration machinery, when a store made by version 1 opens with version 2.
// What: two snapshots of a Note model (version 1 with text, version 2 with body and
//       isPinned) and the migration plan that moves data from one to the other.
// Where: the Models folder. Lesson 6.6 runs the migration on a scratch store in tmp;
//        these models are NOT part of the app's main container.
// When: only when the student taps "Run the migration" (and in the unit tests).
// Why: shipped apps must change their models without losing what users already saved.

import SwiftData // VersionedSchema, SchemaMigrationPlan and MigrationStage.

enum NotesSchemaV1: VersionedSchema { // Version 1, frozen exactly as it shipped.
    static let versionIdentifier = Schema.Version(1, 0, 0) // The version number SwiftData records in the store.
    static var models: [any PersistentModel.Type] { [Note.self] } // The models that made up version 1.

    @Model // A stored model nested inside the schema, so it never clashes with other Note types.
    final class Note { // The note as version 1 knew it.
        var text: String // Version 1 called the note's words "text".
        init(text: String) { self.text = text } // Copies the argument into the property.
    }
}

enum NotesSchemaV2: VersionedSchema { // Version 2: a renamed property and a new one.
    static let versionIdentifier = Schema.Version(2, 0, 0) // A higher number than version 1.
    static var models: [any PersistentModel.Type] { [Note.self] } // The models that make up version 2.

    @Model // The version 2 snapshot of the note.
    final class Note { // Same entity, new shape.
        @Attribute(originalName: "text") var body: String // Renamed: the old column "text" becomes body.
        var isPinned: Bool = false // New, with a default, so old rows get false.
        init(body: String) { self.body = body } // Copies the argument into the property.
    }
}

enum NotesMigrationPlan: SchemaMigrationPlan { // The list of versions and the steps between them.
    static var schemas: [any VersionedSchema.Type] { // Every version, oldest first.
        [NotesSchemaV1.self, NotesSchemaV2.self] // Version 1, then version 2.
    }
    static var stages: [MigrationStage] { // How to get from each version to the next.
        [.lightweight(fromVersion: NotesSchemaV1.self, // A lightweight stage: SwiftData works out the changes itself...
                      toVersion: NotesSchemaV2.self)] // ...from version 1 to version 2.
    }
}

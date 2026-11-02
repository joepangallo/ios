// FolderNote.swift
// Who: SwiftData stores these two models; lesson 6.6 creates, links, edits and deletes them.
// What: the course's Folder and Note models, joined by a one-to-many relationship.
// Where: the Models folder. DataKeeperApp registers both in the app's one ModelContainer.
// When: SwiftData reads them at launch to build the schema; objects appear when the
//       student adds sample data or a note.
// Why: a folder that holds notes is the classic example of related records.

import SwiftData // @Model, @Relationship and the delete rules.

@Model // Turns Folder into a stored model.
final class Folder { // One folder, such as "Work".
    var name: String // The folder's name.
    @Relationship(deleteRule: .cascade, inverse: \Note.folder) // Deleting a folder deletes its notes; Note.folder is the other end.
    var notes: [Note] = [] // The to-many end: every note in this folder.

    init(name: String) { // Only the name is needed; notes starts empty.
        self.name = name // Copies the argument into the stored property.
    }
}

@Model // Turns Note into a stored model.
final class Note { // One note, which may or may not sit in a folder.
    var text: String // What the note says.
    var folder: Folder? // The to-one end: optional, because a note may be in no folder.

    init(text: String, folder: Folder? = nil) { // The folder is optional here too.
        self.text = text // Copies the text argument.
        self.folder = folder // Links the note when a folder is given.
    }
}

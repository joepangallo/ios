// Lesson66Tests.swift
// Who: the Swift Testing runner.
// What: checks lesson 6.6: addSampleData(to:) and both ends of the relationship, the real
//       .cascade delete, the delete-rule simulation, the course's in-memory preview
//       container, and a real migration from NotesSchemaV1 to NotesSchemaV2.
// Where: the DataKeeperTests target. SwiftData tests use in-memory containers; the
//        migration uses a scratch file in a temporary folder.
// When: whenever tests run.
// Why: relationships and migrations are where data quietly goes missing.

import Foundation // FileManager.
import SwiftData // ModelContainer and FetchDescriptor.
import Testing // @Test, #expect and #require.
@testable import DataKeeper // The app's internal types.

@MainActor // SwiftData's main context and the app's types are main-actor isolated.
struct RelationshipTests { // Folder and Note.
    @Test func addSampleDataLinksBothWays() throws { // "Connecting objects".
        let container = try makeInMemoryContainer() // A throwaway database.
        let context = container.mainContext // Its main context.
        addSampleData(to: context) // The course's function.
        let work = try #require(try context.fetch(FetchDescriptor<Folder>()).first) // The Work folder.
        #expect(work.name == "Work") // Its name.
        #expect(work.notes.map(\.text).sorted() == ["Check the budget", "Draft the agenda"]) // The to-many end has both.
        #expect(work.notes.allSatisfy { $0.folder === work }) // The to-one end points back for both.
    }

    @Test func settingOneEndUpdatesTheOther() throws { // The inverse is maintained in memory.
        let container = try makeInMemoryContainer() // A throwaway database.
        let context = container.mainContext // Its main context.
        let folder = Folder(name: "Ideas") // A folder.
        let note = Note(text: "Try SwiftData") // A note.
        context.insert(folder) // Inserted first.
        context.insert(note) // Inserted first.
        note.folder = folder // Set the to-one end.
        #expect(folder.notes.contains { $0 === note }) // The to-many end updated without a save.
        note.folder = nil // Clear it.
        #expect(folder.notes.isEmpty) // Removed from the folder too.
    }

    @Test func cascadeDeletesTheNotes() throws { // The real delete rule.
        let container = try makeInMemoryContainer() // A throwaway database.
        let context = container.mainContext // Its main context.
        addSampleData(to: context) // Work with two notes.
        context.insert(Note(text: "Loose")) // A note in no folder.
        try context.save() // Stored.
        let work = try #require(try context.fetch(FetchDescriptor<Folder>()).first) // The folder.
        context.delete(work) // Delete it.
        try context.save() // Apply the rule.
        #expect(try context.fetch(FetchDescriptor<Note>()).map(\.text) == ["Loose"]) // Only the unfiled note survives.
    }

    @Test func previewContainerIsInMemory() throws { // The course's preview pattern.
        let (container, note) = try PreviewData.makeContainer() // Builds it.
        #expect(container.configurations.first?.isStoredInMemoryOnly == true) // Memory only.
        #expect(note.folder?.name == "Ideas") // Linked.
        #expect(try container.mainContext.fetchCount(FetchDescriptor<Folder>()) == 1) // One folder.
    }
}

@MainActor // The app's types are main-actor isolated.
struct DeleteRuleSimulationTests { // The four rules.
    @Test func nullifyKeepsNotesWithNilFolder() { // The default.
        var sim = DeleteRuleSimulation() // Work with three notes.
        sim.deleteFolder(rule: .nullify) // Delete.
        #expect(!sim.folderExists && sim.notes.count == 3) // Folder gone, notes stay.
        #expect(sim.notes.allSatisfy { $0.folder == nil }) // Folder set to nil.
        #expect(sim.folderLabel(for: sim.notes[0]) == "folder: nil") // As shown on screen.
    }

    @Test func cascadeDeletesNotes() { // Children cannot live alone.
        var sim = DeleteRuleSimulation() // Work with three notes.
        sim.deleteFolder(rule: .cascade) // Delete.
        #expect(!sim.folderExists && sim.notes.isEmpty) // Everything gone.
        #expect(sim.message.contains("3 notes were deleted")) // Explained.
    }

    @Test func denyRefusesWhileNotesRemain() { // Saving fails.
        var sim = DeleteRuleSimulation() // Work with three notes.
        sim.deleteFolder(rule: .deny) // Try to delete.
        #expect(sim.folderExists && sim.notes.count == 3) // Nothing changed.
        #expect(sim.message.hasPrefix("Save failed")) // Explained.
    }

    @Test func denyAllowsAnEmptyFolder() { // Nothing to protect.
        var sim = DeleteRuleSimulation() // Work with three notes.
        sim.notes = [] // Empty the folder.
        sim.deleteFolder(rule: .deny) // Delete.
        #expect(!sim.folderExists) // Allowed.
    }

    @Test func noActionLeavesDanglingReferences() { // Rarely what you want.
        var sim = DeleteRuleSimulation() // Work with three notes.
        sim.deleteFolder(rule: .noAction) // Delete.
        #expect(!sim.folderExists && sim.notes.allSatisfy { $0.folder == "Work" }) // Notes still point at Work.
        #expect(sim.folderLabel(for: sim.notes[0]) == "folder: Work (deleted!)") // Shown as dangling.
    }

    @Test func secondDeleteNeedsAReset() { // Only once per reset.
        var sim = DeleteRuleSimulation() // Work with three notes.
        sim.deleteFolder(rule: .cascade) // First delete.
        sim.deleteFolder(rule: .nullify) // Second attempt.
        #expect(sim.message.contains("already deleted")) // Explained.
        #expect(DeleteRuleSimulation() != sim) // Reset is a fresh value.
    }
}

@MainActor // SwiftData's containers are used on the main actor here.
struct MigrationTests { // VersionedSchema and SchemaMigrationPlan.
    @Test func lightweightMigrationRenamesAndAddsDefaults() throws { // The course's plan, run for real.
        let folder = try makeTemporaryFolder() // A private folder.
        defer { try? FileManager.default.removeItem(at: folder) } // Cleaned up afterwards.
        let out = try MigrationDemo.run(in: folder) // Version 1, then version 2.
        #expect(out.lines == [ // Exactly these steps.
            "Version 1 saved 2 notes with a text property", // Step 1.
            "Opened the same file with NotesSchemaV2 and NotesMigrationPlan", // Step 2.
            "body: Check the budget | isPinned: false", // text became body; isPinned defaulted.
            "body: Draft the agenda | isPinned: false", // The second note.
        ])
    }

    @Test func planListsBothVersionsInOrder() { // The plan's shape.
        #expect(NotesMigrationPlan.schemas.count == 2) // Two versions.
        #expect(NotesMigrationPlan.stages.count == 1) // One lightweight stage.
        #expect(NotesSchemaV1.versionIdentifier == Schema.Version(1, 0, 0)) // Version 1.
        #expect(NotesSchemaV2.versionIdentifier == Schema.Version(2, 0, 0)) // Version 2.
    }
}

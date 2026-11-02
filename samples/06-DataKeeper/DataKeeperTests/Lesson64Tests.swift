// Lesson64Tests.swift
// Who: the Swift Testing runner.
// What: checks lesson 6.4's file code in a temporary folder: the round trip, the
//       NotesStore, loadNotes(from:) for all three results, the crash simulation, and the
//       files-or-database rule.
// Where: the DataKeeperTests target. Nothing here touches the app's Documents folder.
// When: whenever tests run.
// Why: file code must treat a missing file and a damaged file differently, on purpose.

import Foundation // FileManager, Data and URL.
import Testing // @Test, #expect and #require.
@testable import DataKeeper // The app's internal types.

/// A notes store that keeps everything in memory, showing that NoteStoring hides the choice of storage.
@MainActor // Matches the app's main-actor protocol.
final class InMemoryNoteStore: NoteStoring { // A stand-in for tests.
    var saved: [FileNotes.Note] = [] // What was saved last.
    func save(_ notes: [FileNotes.Note]) throws { saved = notes } // Keeps a copy.
    func load() throws -> [FileNotes.Note] { saved } // Returns the copy.
}

@MainActor // The app's types are main-actor isolated.
struct FileTests { // The file examples.
    @Test func roundTripMatchesTheCourse() throws { // "Write a file, then read it back".
        let folder = try makeTemporaryFolder() // A private folder.
        defer { try? FileManager.default.removeItem(at: folder) } // Cleaned up afterwards.
        #expect(FileRoundTrip.run(in: folder).lines == ["Hello from the sandbox", "Exists: true"]) // Exactly.
    }

    @Test func roundTripReportsErrors() { // The catch clause.
        let out = FileRoundTrip.run(in: URL(filePath: "/no/such/folder")) // Cannot be written.
        #expect(out.lines.count == 1) // Only the error line.
        #expect(out.lines[0].hasPrefix("File error:")) // Reported, not ignored.
    }

    @Test func storeRoundTrip() throws { // save, then load.
        let folder = try makeTemporaryFolder() // A private folder.
        defer { try? FileManager.default.removeItem(at: folder) } // Cleaned up afterwards.
        let store = FileNotes.NotesStore(fileURL: folder.appending(path: "notes.json")) // Not Documents.
        #expect(try store.load() == []) // A missing file is an empty list.
        let notes = [FileNotes.Note(text: "Buy stamps"), FileNotes.Note(text: "Call the library")] // Two notes.
        try store.save(notes) // Encodes and writes.
        #expect(try store.load() == notes) // The same notes, ids included.
        let raw = try Data(contentsOf: store.fileURL) // The bytes on disk.
        #expect(String(decoding: raw, as: UTF8.self).contains("\"text\":\"Buy stamps\"")) // Plain JSON.
    }

    @Test func storeDefaultsToDocuments() { // The course's location.
        #expect(FileNotes.NotesStore().fileURL == URL.documentsDirectory.appending(path: "notes.json")) // Documents/notes.json.
    }

    @Test func protocolHidesTheStorage() throws { // Any NoteStoring works the same way.
        let stores: [any NoteStoring] = [InMemoryNoteStore()] // A stand-in behind the protocol.
        for store in stores { // Each store.
            try store.save([FileNotes.Note(text: "Hi")]) // Save through the protocol.
            #expect(try store.load().map(\.text) == ["Hi"]) // Load through the protocol.
        }
    }

    @Test func loadNotesResults() throws { // The three LoadResult cases.
        let folder = try makeTemporaryFolder() // A private folder.
        defer { try? FileManager.default.removeItem(at: folder) } // Cleaned up afterwards.
        let url = folder.appending(path: "notes.json") // The file.
        #expect(FileNotes.loadNotes(from: url) == .firstLaunch) // Missing: first launch.
        let notes = [FileNotes.Note(text: "One")] // One note.
        try FileNotes.NotesStore(fileURL: url).save(notes) // Saved properly.
        #expect(FileNotes.loadNotes(from: url) == .loaded(notes)) // Loaded.
        try Data("[{\"id\": \"broken".utf8).write(to: url) // Damage the file.
        guard case .damaged(let message) = FileNotes.loadNotes(from: url) else { Issue.record("expected damaged"); return } // Damaged.
        #expect(message.hasPrefix("The notes file is damaged:")) // The DecodingError clause.
    }

    @Test func loadingAFolderIsDamagedNotFirstLaunch() throws { // The last catch clause.
        let folder = try makeTemporaryFolder() // A folder where a file is expected.
        defer { try? FileManager.default.removeItem(at: folder) } // Cleaned up afterwards.
        guard case .damaged(let message) = FileNotes.loadNotes(from: folder) else { Issue.record("expected damaged"); return } // Reading a folder fails.
        #expect(!message.isEmpty) // A description is shown.
    }

    @Test func nonAtomicCrashLeavesHalfAFile() throws { // The container widget's lesson.
        let folder = try makeTemporaryFolder() // A private folder.
        defer { try? FileManager.default.removeItem(at: folder) } // Cleaned up afterwards.
        let url = folder.appending(path: "notes.json") // The file.
        let original = [FileNotes.Note(text: "Keep me")] // What was saved before.
        try FileNotes.NotesStore(fileURL: url).save(original) // A good file.
        try CrashSimulator.saveThenCrash(original + [FileNotes.Note(text: "New")], to: url, atomic: false) // Crash halfway.
        guard case .damaged = FileNotes.loadNotes(from: url) else { Issue.record("expected damaged"); return } // Half a document does not decode.
        #expect(throws: (any Error).self) { try FileNotes.NotesStore(fileURL: url).load() } // The store's load throws too.
    }

    @Test func atomicCrashKeepsTheOldFile() throws { // .atomic: old or new, never half.
        let folder = try makeTemporaryFolder() // A private folder.
        defer { try? FileManager.default.removeItem(at: folder) } // Cleaned up afterwards.
        let url = folder.appending(path: "notes.json") // The file.
        let original = [FileNotes.Note(text: "Keep me")] // What was saved before.
        try FileNotes.NotesStore(fileURL: url).save(original) // A good file.
        try CrashSimulator.saveThenCrash(original + [FileNotes.Note(text: "New")], to: url, atomic: true) // Crash halfway.
        #expect(FileNotes.loadNotes(from: url) == .loaded(original)) // The old notes are intact.
    }

    @Test func plainSaveStillWorksWithoutACrash() throws { // Non-atomic writes are fine when nothing goes wrong.
        let folder = try makeTemporaryFolder() // A private folder.
        defer { try? FileManager.default.removeItem(at: folder) } // Cleaned up afterwards.
        let url = folder.appending(path: "notes.json") // The file.
        let notes = [FileNotes.Note(text: "Plain")] // One note.
        try CrashSimulator.plainSave(notes, to: url) // No .atomic.
        #expect(FileNotes.loadNotes(from: url) == .loaded(notes)) // Loads normally.
    }

    @Test func folderListing() throws { // Names and sizes, sorted.
        let folder = try makeTemporaryFolder() // A private folder.
        defer { try? FileManager.default.removeItem(at: folder) } // Cleaned up afterwards.
        try Data("abc".utf8).write(to: folder.appending(path: "b.txt")) // 3 bytes.
        try Data("hello".utf8).write(to: folder.appending(path: "a.txt")) // 5 bytes.
        #expect(FolderListing.lines(for: folder) == ["a.txt  5 bytes", "b.txt  3 bytes"]) // Alphabetical.
        #expect(FolderListing.lines(for: URL(filePath: "/no/such/folder")) == []) // Missing folders list as empty.
    }

    @Test func filesOrDatabase() { // The course's lists.
        #expect(FilesOrDatabase.recommend(StorageNeeds()) == .files) // No database features.
        #expect(FilesOrDatabase.recommend(StorageNeeds(largeMedia: true)) == .files) // Media alone: files.
        #expect(FilesOrDatabase.recommend(StorageNeeds(searchAndSort: true)) == .database) // Queries.
        #expect(FilesOrDatabase.recommend(StorageNeeds(relationships: true)) == .database) // Relationships.
        #expect(FilesOrDatabase.recommend(StorageNeeds(thousandsOfRecords: true, largeMedia: true)) == .combine) // Both.
        #expect(FilesOrDatabase.recommend(StorageNeeds(changeOneRecord: true)) == .database) // Partial updates.
    }
}

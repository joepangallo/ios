// NotesFiles.swift
// Who: lesson 6.4's cards save and load notes with these types; the tests run them in a
//      temporary folder.
// What: the course's file examples: a write-then-read round trip, a Codable Note, the
//       NotesStore that saves notes to notes.json, the LoadResult that tells a first launch
//       from a damaged file, a save that "crashes" halfway, and the files-or-database rule.
// Where: the Support folder. The file-based Note sits inside the FileNotes namespace,
//        because lesson 6.6's SwiftData model is also named Note.
// When: when the student taps Save, Load, Crash or Delete on the lesson 6.4 screen.
// Why: Codable plus files is a complete persistence layer for small amounts of data.

import Foundation // URL, Data, FileManager, JSONEncoder and JSONDecoder.

/// The course's "Write a file, then read it back" example.
enum FileRoundTrip { // A namespace for the example.
    /// Writes greeting.txt into a folder, reads it back, and checks that it exists.
    static func run(in folder: URL = URL.documentsDirectory) -> Transcript { // Documents by default; Caches for the Try It.
        var out = Transcript() // Collects the printed lines.
        let fileURL = folder // The folder to write into...
            .appending(path: "greeting.txt") // ...plus the file name.
        do { // Every file operation can fail.
            let text = "Hello from the sandbox" // The text to save.
            try Data(text.utf8).write(to: fileURL, options: .atomic) // All-or-nothing write.

            let bytes = try Data(contentsOf: fileURL) // Reads the whole file.
            let readBack = String(decoding: bytes, as: UTF8.self) // Bytes back to text.
            out.print(readBack) // Hello from the sandbox.

            let exists = FileManager.default.fileExists(atPath: fileURL.path()) // Asks the file system.
            out.print("Exists:", exists) // Exists: true.
        } catch { // A full disk, a missing folder, a locked device...
            out.print("File error:", error.localizedDescription) // ...is reported, not ignored.
        }
        return out // Both lines.
    }
}

/// What every notes store can do, so views never touch FileManager directly.
protocol NoteStoring { // The course's callout: hide the choice behind a type.
    func save(_ notes: [FileNotes.Note]) throws // Writes every note.
    func load() throws -> [FileNotes.Note] // Reads every note.
}

/// The course's file-based notes, in a namespace so they never clash with SwiftData's Note.
enum FileNotes { // A namespace: FileNotes.Note, FileNotes.NotesStore, and so on.
    /// The course's Note: a Codable struct with an id and some text.
    struct Note: Codable, Identifiable, Equatable { // Equatable is added so tests can compare notes.
        var id = UUID() // A unique id, generated when the note is made.
        var text: String // What the note says.
    }

    /// The course's NotesStore: saves the whole array to one JSON file.
    struct NotesStore: NoteStoring { // Conforms to the protocol above.
        let fileURL: URL // Where the notes live.

        /// The course hard-codes Documents/notes.json; this version also accepts another URL, so tests can use a temporary folder.
        init(fileURL: URL = URL.documentsDirectory.appending(path: "notes.json")) { // The course's location by default.
            self.fileURL = fileURL // Remembers the location.
        }

        /// Encodes every note and writes them in one atomic, protected step.
        func save(_ notes: [Note]) throws { // throws: the caller decides how to report a failure.
            let data = try JSONEncoder().encode(notes) // The whole array as JSON bytes.
            try data.write(to: fileURL, // Writes the bytes...
                           options: [.atomic, .completeFileProtection]) // ...all-or-nothing, and encrypted while the phone is locked.
        }

        /// Reads the notes back; a missing file means an empty list, not an error.
        func load() throws -> [Note] { // throws only for real problems.
            let manager = FileManager.default // The shared file manager.
            guard manager.fileExists(atPath: fileURL.path()) else { // First launch: nothing saved yet.
                return [] // An empty list, so the screen can show a friendly empty state.
            }
            let data = try Data(contentsOf: fileURL) // Reads the whole file.
            return try JSONDecoder().decode([Note].self, from: data) // Bytes back to notes.
        }
    }

    /// The course's three possible outcomes of loading.
    enum LoadResult: Equatable { // Equatable, so tests can compare results.
        case loaded([Note]) // Everything worked.
        case firstLaunch // No file yet: expected, not worth an alert.
        case damaged(String) // A file exists but will not load: the user should hear about it.
    }

    /// The course's loadNotes(from:): separate catch clauses for separate problems.
    static func loadNotes(from url: URL) -> LoadResult { // Never throws: every case becomes a result.
        do { // Try the happy path.
            let data = try Data(contentsOf: url) // Throws if the file is missing.
            let notes = try JSONDecoder().decode([Note].self, from: data) // Throws if the bytes are not valid notes.
            return .loaded(notes) // Success.
        } catch CocoaError.fileReadNoSuchFile { // The file does not exist yet.
            return .firstLaunch // Expected on a first launch.
        } catch let error as DecodingError { // The file exists but will not decode.
            return .damaged("The notes file is damaged: \(error)") // Damage, or a format change after an update.
        } catch { // Anything else, such as a permissions problem.
            return .damaged(error.localizedDescription) // Still reported.
        }
    }
}

/// Simulates the app crashing halfway through a save, with and without .atomic.
enum CrashSimulator { // A namespace for the simulation.
    /// Writes the notes without the atomic option, the way a careless save would.
    static func plainSave(_ notes: [FileNotes.Note], to url: URL) throws { // No .atomic: the file is replaced in place.
        try JSONEncoder().encode(notes).write(to: url) // Writes straight into the real file.
    }

    /// Starts a save and stops halfway, as if the app crashed.
    static func saveThenCrash(_ notes: [FileNotes.Note], to url: URL, atomic: Bool) throws { // atomic chooses which kind of write was interrupted.
        let data = try JSONEncoder().encode(notes) // The full bytes the save meant to write.
        let half = data.prefix(data.count / 2) // Only the first half reaches the disk before the "crash".
        if atomic { // An atomic write goes to a temporary file first...
            let temporary = URL.temporaryDirectory.appending(path: "notes-in-progress.json") // ...somewhere else...
            try half.write(to: temporary) // ...so the half-written bytes land there...
            try? FileManager.default.removeItem(at: temporary) // ...and are never renamed over notes.json; tidy up the leftover.
        } else { // A plain write...
            try half.write(to: url) // ...replaces notes.json in place, leaving half a JSON document.
        }
    }
}

/// What the data needs, from the course's "Files or a database?" lists.
struct StorageNeeds: Equatable { // Equatable, so tests can compare.
    var thousandsOfRecords = false // Thousands of records.
    var searchAndSort = false // Searching and sorting.
    var changeOneRecord = false // Changing one record without rewriting everything.
    var relationships = false // Folders that contain notes, and similar links.
    var largeMedia = false // Photos, audio, or other big files.
}

/// The course's files-or-database rule.
enum FilesOrDatabase: String { // String raw values are the screen's answers.
    case files = "Files: simple, and fine for small data you load and save whole." // No database features needed.
    case database = "A database: SwiftData earns its setup here." // Database features needed.
    case combine = "Combine them: media in files, the file name in a database record (or @Attribute(.externalStorage))." // Both kinds of need.

    /// Picks the approach for a set of needs.
    static func recommend(_ needs: StorageNeeds) -> FilesOrDatabase { // Pure: same needs, same answer.
        let needsDatabase = needs.thousandsOfRecords || needs.searchAndSort || needs.changeOneRecord || needs.relationships // Any database feature.
        if needsDatabase && needs.largeMedia { return .combine } // Records plus big files.
        return needsDatabase ? .database : .files // Otherwise one or the other.
    }
}

/// Lists a folder's files with their sizes, for the "inside the container" views.
enum FolderListing { // A namespace for the helper.
    /// One line per item: its name and size in bytes, sorted by name.
    static func lines(for folder: URL) -> [String] { // Never throws: an unreadable folder lists as empty.
        let manager = FileManager.default // The shared file manager.
        let urls = (try? manager.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.fileSizeKey])) ?? [] // Every item, with its size prefetched.
        return urls.sorted { $0.lastPathComponent < $1.lastPathComponent }.map { url in // Alphabetical order.
            let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0 // Folders have no size; they show 0.
            return "\(url.lastPathComponent)  \(size) bytes" // Name and size.
        }
    }
}

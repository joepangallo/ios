// Lesson_6_4_ReadingAndWritingFiles.swift
// Who: the student, after tapping lesson 6.4 on the home screen.
// What: the container's folders, a write-then-read round trip, the course's NotesStore
//       saving Codable notes to Documents/notes.json, a crash in the middle of a save,
//       the three load results, and the files-or-database decision.
// Where: pushed from ContentView. The file logic lives in Support/NotesFiles.swift.
// When: files change only when the student taps a button; every card then refreshes.
// Why: Codable plus FileManager is enough to persist small amounts of data safely.

import SwiftUI // Views and state.

struct ReadingAndWritingFilesLesson: View { // The lesson 6.4 screen.
    let lesson: Lesson // Which lesson this page shows.
    let store: any NoteStoring = FileNotes.NotesStore() // The view talks to the protocol, never to FileManager.
    let notesURL = URL.documentsDirectory.appending(path: "notes.json") // The same file the store uses, for the inspector.
    @State private var notes = [FileNotes.Note(text: "Buy stamps"), FileNotes.Note(text: "Call the library")] // The working copy in memory.
    @State private var storeLog = Transcript() // What the store card did.
    @State private var roundTripInCaches = false // The round trip's Try It: Caches instead of Documents.
    @State private var roundTrip = Transcript() // What the round trip printed.
    @State private var atomic = true // The container card's atomic option.
    @State private var containerLog = Transcript() // What the container card did.
    @State private var loadResult: FileNotes.LoadResult? // The last result of loadNotes(from:).
    @State private var needs = StorageNeeds() // The files-or-database answers.
    @State private var refresh = 0 // Bumped after every file change, so the listings redraw.

    var body: some View { // Rebuilt whenever state changes.
        LessonPage(lesson: lesson) { // The shared page layout.
            DemoCard(title: "Files, URLs, and FileManager", caption: "Files are named with URLs, bytes travel as Data, and FileManager manages folders. These are this install's real folders.") { // Course concept.
                ForEach([SandboxFolder.documents, .applicationSupport, .caches, .tmp]) { folder in // The four folders the course names.
                    VStack(alignment: .leading, spacing: 2) { // Property over path.
                        Text(folder.swiftProperty).font(.caption.monospaced().bold()) // URL.documentsDirectory and its siblings.
                        Text(verbatim: ContainerPaths.short(folder.url)).font(.caption2.monospaced()).foregroundStyle(.secondary) // Where it really is.
                    }
                }
                Text("Documents holds:").font(.subheadline.bold()) // A listing heading.
                ConsoleView(lines: documentsListing) // The real contents of Documents.
            }

            DemoCard(title: "Write a file, then read it back", caption: "Build a URL, write bytes, read them back, and check that the file exists, all inside do and catch.") { // Course code step.
                Toggle("Write to Caches instead of Documents", isOn: $roundTripInCaches) // The course's Try It.
                Button("Run") { // Runs the round trip.
                    roundTrip = FileRoundTrip.run(in: roundTripInCaches ? URL.cachesDirectory : URL.documentsDirectory) // Documents or Caches.
                    refresh += 1 // The Documents listing may have changed.
                }
                .buttonStyle(.borderedProminent) // The main action.
                ConsoleView(lines: roundTrip.lines) // Hello from the sandbox, Exists: true.
            }

            DemoCard(title: "A store that saves Codable notes", caption: "save encodes the whole array and writes it in one atomic step; load treats a missing file as an empty list.") { // Course code step.
                ForEach($notes) { $note in // A binding to each note, so the text field edits it in place.
                    TextField("Note", text: $note.text) // Edits the working copy.
                        .textFieldStyle(.roundedBorder) // A visible box.
                }
                HStack { // The store's actions.
                    Button("Add") { notes.append(FileNotes.Note(text: "New note")) } // Adds to memory only.
                    Button("Save") { saveWithStore() } // store.save(notes).
                    Button("Load") { loadWithStore() } // store.load().
                }
                .buttonStyle(.bordered) // Secondary-looking buttons.
                ConsoleView(lines: storeLog.lines) // What happened.
            }

            DemoCard(title: "Inside the app container", caption: "notes.json's real bytes. Turn off atomic, use Save then crash, and Load: half a JSON document cannot be decoded.") { // Course widget.
                Text(verbatim: fileSummary) // Size and contents of notes.json.
                    .font(.caption2.monospaced()) // Small and fixed-width.
                    .lineLimit(6) // Long files are cut off.
                Toggle("Atomic write", isOn: $atomic) // The .atomic option.
                HStack { // First row of actions.
                    Button("Save") { containerSave() } // A normal save, atomic or not.
                    Button("Save, then crash") { containerCrash() } // A save that stops halfway.
                }
                HStack { // Second row of actions.
                    Button("Load") { containerLoad() } // loadNotes(from:).
                    Button("Delete app", role: .destructive) { deleteApp() } // Simulates losing the container.
                }
                ConsoleView(lines: containerLog.lines) // What happened.
            }
            .buttonStyle(.bordered) // Every button in this card is bordered.

            DemoCard(title: "Handle file errors on purpose", caption: "A missing file on first launch is normal. A file that will not decode means damage, and the user should hear about it.") { // Course code step.
                HStack { // Ways to set up each case.
                    Button("Remove file") { removeNotesFile(); loadResult = FileNotes.loadNotes(from: notesURL) } // Leads to .firstLaunch.
                    Button("Damage file") { damageNotesFile(); loadResult = FileNotes.loadNotes(from: notesURL) } // Leads to .damaged.
                    Button("Load") { loadResult = FileNotes.loadNotes(from: notesURL) } // Whatever is on disk.
                }
                .buttonStyle(.bordered) // Secondary-looking buttons.
                LoadResultView(result: loadResult) { // A different interface for each case.
                    removeNotesFile() // "Start fresh" removes the damaged file...
                    loadResult = FileNotes.loadNotes(from: notesURL) // ...and loads again, which now reports a first launch.
                }
            }

            DemoCard(title: "Files or a database?", caption: "Tick what your data needs.") { // Course concept.
                Toggle("Thousands of records", isOn: $needs.thousandsOfRecords) // A database need.
                Toggle("Searching and sorting", isOn: $needs.searchAndSort) // A database need.
                Toggle("Change one record at a time", isOn: $needs.changeOneRecord) // A database need.
                Toggle("Relationships, such as folders of notes", isOn: $needs.relationships) // A database need.
                Toggle("Large media: photos, audio", isOn: $needs.largeMedia) // A files need.
                Text(FilesOrDatabase.recommend(needs).rawValue) // The answer.
                    .font(.callout.bold()) // Stands out.
                Text("Whichever you pick, hide it behind a type: views call store.load() and store.save(notes), as this screen does through NoteStoring.") // The course's callout.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // A note.
            }
        }
        .task { // Runs once when the screen appears.
            roundTrip = FileRoundTrip.run() // The round trip's output, so the card is never empty.
            refresh += 1 // greeting.txt now exists, so the Documents listing redraws.
            loadResult = FileNotes.loadNotes(from: notesURL) // Shows the current state of notes.json.
            if case .loaded(let saved) = loadResult, !saved.isEmpty { notes = saved } // Starts from the saved notes when there are any.
        }
    }

    /// The files in Documents, re-read whenever refresh changes.
    private var documentsListing: [String] { // Read fresh each time the card draws.
        _ = refresh // Reading refresh makes SwiftUI redraw this list after file changes.
        let lines = FolderListing.lines(for: URL.documentsDirectory) // Names and sizes.
        return lines.isEmpty ? ["(empty)"] : lines // Says so when the folder has no files.
    }

    /// The size and text of notes.json, or a note that it does not exist.
    private var fileSummary: String { // Read fresh each time the card draws.
        _ = refresh // Reading refresh makes SwiftUI redraw this text after file changes.
        guard let data = try? Data(contentsOf: notesURL) else { return "notes.json does not exist yet" } // No file.
        return "notes.json, \(data.count) bytes:\n" + String(decoding: data, as: UTF8.self) // The raw JSON text.
    }

    /// The store card's Save.
    private func saveWithStore() { // Calls the protocol, not FileManager.
        do { // Saving can fail.
            try store.save(notes) // Encodes and writes atomically.
            storeLog.print("Saved", notes.count, "notes to notes.json") // Confirms.
        } catch { // For example, a full disk.
            storeLog.print("Save failed:", error.localizedDescription) // Reports it.
        }
        refresh += 1 // The listings may have changed.
    }

    /// The store card's Load.
    private func loadWithStore() { // Calls the protocol, not FileManager.
        do { // Loading can fail.
            notes = try store.load() // Missing file: an empty list.
            storeLog.print("Loaded", notes.count, "notes") // Confirms.
        } catch { // A damaged file.
            storeLog.print("Load failed:", error.localizedDescription) // Reports it.
        }
    }

    /// The container card's Save, honoring the atomic toggle.
    private func containerSave() { // Atomic uses the store; plain uses a careless write.
        do { // Either write can fail.
            if atomic { try store.save(notes) } else { try CrashSimulator.plainSave(notes, to: notesURL) } // The two kinds of write.
            containerLog.print(atomic ? "Saved atomically" : "Saved in place (not atomic)") // Says which.
        } catch { // Any failure.
            containerLog.print("Save failed:", error.localizedDescription) // Reports it.
        }
        refresh += 1 // Redraw the file inspector.
    }

    /// The container card's crash in the middle of a save.
    private func containerCrash() { // Uses CrashSimulator.
        do { // The simulated write can fail too.
            try CrashSimulator.saveThenCrash(notes, to: notesURL, atomic: atomic) // Half the bytes, then stop.
            containerLog.print(atomic ? "Crashed mid-save: the old notes.json is untouched" : "Crashed mid-save: notes.json now holds half a document") // What the crash left behind.
        } catch { // Any failure.
            containerLog.print("Crash simulation failed:", error.localizedDescription) // Reports it.
        }
        refresh += 1 // Redraw the file inspector.
    }

    /// The container card's Load, through loadNotes(from:).
    private func containerLoad() { // Shows which case came back.
        loadResult = FileNotes.loadNotes(from: notesURL) // Also updates the error-handling card.
        switch loadResult { // One message per case.
        case .loaded(let saved): notes = saved; containerLog.print("Loaded", saved.count, "notes") // Success.
        case .firstLaunch: containerLog.print("No file: first launch") // Missing file.
        case .damaged(let message): containerLog.print(message) // The decoding error.
        case nil: break // Not possible right after a load.
        }
    }

    /// Simulates deleting the app: the files this lesson made disappear, and memory starts empty.
    private func deleteApp() { // A real delete removes the whole container.
        for name in ["notes.json", "greeting.txt"] { // The files this lesson writes to Documents.
            try? FileManager.default.removeItem(at: URL.documentsDirectory.appending(path: name)) // try?: a missing file is fine.
        }
        notes = [] // A reinstalled app starts with nothing in memory.
        containerLog.print("App deleted: its container is gone. A reinstall starts empty.") // Explains.
        loadResult = FileNotes.loadNotes(from: notesURL) // Now reports a first launch.
        refresh += 1 // Redraw the listings.
    }

    /// Removes notes.json, as on a first launch.
    private func removeNotesFile() { // Used by the error-handling card.
        try? FileManager.default.removeItem(at: notesURL) // try?: already missing is fine.
        refresh += 1 // Redraw the listings.
    }

    /// Replaces notes.json with bytes that are not valid JSON.
    private func damageNotesFile() { // Used by the error-handling card.
        try? Data("[{\"id\": \"broken".utf8).write(to: notesURL) // Half a document, as a crash might leave.
        refresh += 1 // Redraw the listings.
    }
}

/// The course's Try It answered: a different interface for each LoadResult case.
struct LoadResultView: View { // Shows one result.
    let result: FileNotes.LoadResult? // nil before the first load.
    let startFresh: () -> Void // What the damaged case's button does.

    var body: some View { // One layout per case.
        switch result { // Which case?
        case .loaded(let notes): // Success.
            Label("Loaded \(notes.count) notes", systemImage: "checkmark.circle") // A quiet confirmation.
                .foregroundStyle(.green) // Green for success.
        case .firstLaunch: // Expected: no alert, just a friendly empty state.
            ContentUnavailableView("No notes yet", systemImage: "note.text", description: Text("This is a first launch. Write your first note.")) // Calm and helpful.
        case .damaged(let message): // Damage: tell the user and offer a way out.
            VStack(alignment: .leading, spacing: 8) { // Message over button.
                Label("Your notes could not be opened", systemImage: "exclamationmark.triangle.fill") // A clear warning.
                    .foregroundStyle(.orange) // Orange for a problem.
                Text(verbatim: message).font(.caption2.monospaced()).lineLimit(4) // The technical detail, kept short.
                Button("Start fresh", role: .destructive, action: startFresh) // Lets the user recover.
            }
        case nil: // Nothing loaded yet.
            Text("Tap Load to see what loadNotes(from:) returns.").foregroundStyle(.secondary) // An instruction.
        }
    }
}

#Preview { // Shows this lesson in Xcode's canvas.
    NavigationStack { ReadingAndWritingFilesLesson(lesson: ContentView.lessons[3]) } // Inside a stack, so the title shows.
}

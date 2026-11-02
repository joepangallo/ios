// Lifecycle.swift
// Who: EcosystemTourApp (which owns one PhaseLog and one DraftStore), lesson
//      1.4's screen (which shows them), and the tests.
// What: a timestamped log of real scenePhase changes; the course's DraftStore,
//       which saves a draft to a file in the app's sandbox and restores it;
//       and the list of the sandbox's standard folders.
// Where: the Models folder. The App struct creates the log and the store and
//        hands them to every screen through the environment.
// When: the log records each phase change; the store saves when the app goes
//       to the background and when the student leaves lesson 1.4.
// Why: iOS can terminate a suspended app silently, so the last reliable
//      moment to save is the move to the background. This file is the real
//      code behind the course's "save when the app leaves the screen".

import SwiftUI // ScenePhase is a SwiftUI type.
import Observation // @Observable makes SwiftUI redraw views when these objects change.

/// A timestamped list of scenePhase changes, recorded by the App struct.
@Observable final class PhaseLog { // final: no subclasses; a class so every screen shares one log.
    /// One line of the log.
    struct Entry: Identifiable { // Identifiable for ForEach.
        let id = UUID() // Two entries can have the same text, so each gets its own id.
        let date: Date // When it happened.
        let text: String // What happened.
    }

    private(set) var entries: [Entry] // Oldest first; changed only through the methods below.
    private(set) var current: ScenePhase? = nil // The latest app-wide phase; nil until the first change.

    init(now: Date = .now) { // The date is a parameter so tests can fix it.
        entries = [Entry(date: now, text: "Launch: iOS started the app's process")] // The log starts at launch.
    }

    /// Records a phase change, worded like the course's print("Phase: \(oldPhase) -> \(newPhase)").
    func record(from old: ScenePhase, to new: ScenePhase, at date: Date = .now) { // Called by the App struct's onChange.
        current = new // Remembers the latest phase.
        entries.append(Entry(date: date, text: Self.line(from: old, to: new))) // Adds the line.
        if entries.count > 40 { entries.removeFirst(entries.count - 40) } // Keeps the log short.
    }

    /// Adds a free-text line, such as "Saved the draft".
    func note(_ text: String, at date: Date = .now) { // Used for saves.
        entries.append(Entry(date: date, text: text)) // Adds the line.
    }

    /// The text of one log line.
    static func line(from old: ScenePhase, to new: ScenePhase) -> String { // Pure, so tests can check it.
        "Phase: \(name(of: old)) -> \(name(of: new))" // For example "Phase: inactive -> background".
    }

    /// A phase's name, as Swift prints it.
    static func name(of phase: ScenePhase) -> String { // Spelled out so the text never depends on debug output.
        switch phase { // One word per phase.
        case .active: "active" // In the foreground and interactive.
        case .inactive: "inactive" // Visible but not interactive, or in transition.
        case .background: "background" // Not visible.
        @unknown default: "unknown" // A phase Apple might add later.
        }
    }

    /// A 24-hour clock time with seconds, such as "09:41:07", for log timestamps.
    static func clock(_ date: Date, calendar: Calendar = .current) -> String { // The calendar is a parameter so tests can use a fixed time zone.
        let parts = calendar.dateComponents([.hour, .minute, .second], from: date) // Hours, minutes and seconds in that calendar's time zone.
        let two = { (n: Int?) in n.map { $0 < 10 ? "0\($0)" : "\($0)" } ?? "00" } // Pads one-digit numbers with a zero.
        return "\(two(parts.hour)):\(two(parts.minute)):\(two(parts.second))" // hh:mm:ss.
    }
}

/// The course's DraftStore: the draft text in memory, saved to a file in the sandbox.
@Observable final class DraftStore { // A class, so the App struct and the lesson screen share one store.
    var text = "" // The draft, in memory. Lost if the app is terminated before a save.
    private(set) var status = "Nothing saved yet" // What happened last, shown on screen.
    private(set) var lastSaved: Date? = nil // When the draft last reached the disk.
    let fileURL: URL // Where the draft is saved.

    /// The default file: draft.txt in the app's Documents folder, inside its sandbox.
    static var defaultURL: URL { URL.documentsDirectory.appending(path: "draft.txt") } // Documents holds files the user creates.

    init(fileURL: URL = DraftStore.defaultURL) { // Tests pass a file in a temporary folder.
        self.fileURL = fileURL // Remembers where to save.
        load() // Restores the last saved draft, if there is one.
    }

    /// Reads the saved draft from disk into memory. Returns whether a saved draft was found.
    @discardableResult func load() -> Bool { // Callers may ignore the result.
        guard let saved = try? String(contentsOf: fileURL, encoding: .utf8) else { // No file yet, or it cannot be read.
            status = "No saved draft on disk yet" // Says so.
            return false // Nothing restored.
        }
        text = saved // Restores the draft.
        status = "Restored \(saved.count) characters from disk" // Says what came back.
        return true // A draft was restored.
    }

    /// Writes the draft to disk, as the course's store.save() does.
    func save(reason: String = "the app moved to the background") { // The reason appears in the status line.
        do { // Writing a file can fail, for example on a full disk.
            try text.write(to: fileURL, atomically: true, encoding: .utf8) // atomically: write a copy, then swap it in, so a crash never leaves half a file.
            lastSaved = .now // Remembers when.
            status = "Saved \(text.count) characters because \(reason)" // Says why.
        } catch { // The write failed.
            status = "Could not save: \(error.localizedDescription)" // Shows the reason instead of failing silently.
        }
    }

    /// Simulates termination and relaunch: memory is wiped, then the draft is read back from disk.
    func simulateRelaunch() { // What happens to memory when iOS terminates a suspended app.
        text = "" // Memory is gone...
        if !load() { status = "Memory wiped and nothing was on disk: the draft is gone" } // ...and only a saved draft comes back.
    }
}

/// The standard folders of the app's sandbox.
enum Sandbox { // A namespace.
    /// One sandbox folder: its name, what belongs in it, and where it is.
    struct Folder: Identifiable { // Identifiable for ForEach.
        let name: String // For example "Documents".
        let purpose: String // What belongs there, from the course.
        let url: URL // Where it is right now, inside this app's container.
        var id: String { name } // Folder names are unique.
    }

    /// The course's four folders, with this app's real locations.
    static var folders: [Folder] { // Computed: the locations come from the system each time.
        [ // In the course's order.
            Folder(name: "Documents", purpose: "Files the user creates. Backed up, and can be exposed in the Files app. This app's draft.txt lives here.", url: .documentsDirectory), // User files.
            Folder(name: "Library/Application Support", purpose: "Your app's own data, such as a SwiftData store. Backed up.", url: .applicationSupportDirectory), // App data.
            Folder(name: "Library/Caches", purpose: "Data you can download again. Not backed up; iOS may delete it when storage runs low.", url: .cachesDirectory), // Re-creatable data.
            Folder(name: "tmp", purpose: "Short-lived scratch files that the system can delete when your app is not running.", url: .temporaryDirectory), // Scratch space.
        ]
    }

    /// A path with the app's container folder shortened to "~", so the interesting part stays readable.
    static func shortPath(_ url: URL, home: String = NSHomeDirectory()) -> String { // home is a parameter so tests can fix it.
        let path = url.path(percentEncoded: false) // The plain file-system path.
        guard path.hasPrefix(home) else { return path } // Outside the container: show it all.
        return "~" + path.dropFirst(home.count) // Inside: replace the container's path with ~.
    }
}

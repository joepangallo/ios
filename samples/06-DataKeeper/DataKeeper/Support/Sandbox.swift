// Sandbox.swift
// Who: lessons 6.1 and 6.4 show these folders; the tests check the rules and the file helpers.
// What: the folders inside the app's container, what each one is for, whether iOS backs it
//       up or may empty it, plus two small file helpers: the draft store and the
//       backup-exclusion flag.
// Where: the Support folder. The URLs come from Foundation, so they point at this install's
//        real container on the Simulator or device.
// When: whenever a lesson screen appears or the student taps a button that writes a file.
// Why: the sandbox rules decide what survives a cleanup, a restore, or deleting the app.

import Foundation // URL, FileManager, Data and URLResourceValues.

/// Something that can happen to the app's container.
enum ContainerEvent: String, CaseIterable, Identifiable { // String raw values are the picker labels.
    case lowStorage = "Cleanup" // iOS frees space while the app is not running.
    case restore = "New phone" // The user restores a backup onto a new device.
    case appDeleted = "Delete app" // The user deletes the app.
    var id: String { rawValue } // Identifiable for ForEach.
}

/// What happens to a folder's contents after an event.
enum FolderFate: String { // String raw values are the labels on screen.
    case kept = "Kept" // Nothing is lost.
    case mayBeEmptied = "May be emptied" // iOS is allowed to delete the contents.
    case restored = "Restored from backup" // The backup brings it back.
    case startsEmpty = "Starts empty" // Not in the backup, so the new phone has nothing.
    case deleted = "Deleted" // Gone with the container.
}

/// The folders inside every app's container.
enum SandboxFolder: String, CaseIterable, Identifiable { // One case per folder.
    case documents, applicationSupport, preferences, caches, tmp // Five folders worth knowing.
    var id: String { rawValue } // Identifiable for ForEach.

    /// The folder's path inside the container.
    var path: String { // As you would see it in a file browser.
        switch self { // One path per folder.
        case .documents: "Documents" // User-created files.
        case .applicationSupport: "Library/Application Support" // The app's own data files.
        case .preferences: "Library/Preferences" // Where UserDefaults keeps its plist.
        case .caches: "Library/Caches" // Re-downloadable data.
        case .tmp: "tmp" // Scratch files.
        }
    }

    /// The Swift expression that finds the folder.
    var swiftProperty: String { // Shown in monospaced text.
        switch self { // One expression per folder.
        case .documents: "URL.documentsDirectory" // A static property on URL.
        case .applicationSupport: "URL.applicationSupportDirectory" // Its sibling.
        case .preferences: "UserDefaults (you never open this folder yourself)" // UserDefaults manages it.
        case .caches: "URL.cachesDirectory" // Another sibling.
        case .tmp: "URL.temporaryDirectory" // And another.
        }
    }

    /// The real URL of this folder for this install.
    var url: URL { // Computed each time, because the container path differs per install.
        switch self { // One URL per folder.
        case .documents: URL.documentsDirectory // Foundation knows where the container is.
        case .applicationSupport: URL.applicationSupportDirectory // Same idea.
        case .preferences: URL.libraryDirectory.appending(path: "Preferences") // Built from Library, since no shortcut exists.
        case .caches: URL.cachesDirectory // Same idea.
        case .tmp: URL.temporaryDirectory // Same idea.
        }
    }

    /// Whether iOS copies the folder into iCloud or computer backups.
    var isBackedUp: Bool { // From the course's table.
        switch self { // Caches and tmp are the exceptions.
        case .documents, .applicationSupport, .preferences: true // Backed up.
        case .caches, .tmp: false // Not backed up.
        }
    }

    /// Whether iOS may delete the contents on its own.
    var mayBePurged: Bool { isBackedUp == false } // In this table the purgeable folders are exactly the ones not backed up.

    /// What belongs in the folder.
    var belongsHere: String { // One sentence per folder.
        switch self { // One answer per folder.
        case .documents: "Files the user created, such as notes and drawings. Backed up, never purged." // From the course.
        case .applicationSupport: "Your app's own data files, including the SwiftData database. Backed up, never purged." // From the course.
        case .preferences: "The UserDefaults plist that @AppStorage reads and writes. Backed up." // From lesson 6.2.
        case .caches: "Data you can download or rebuild. Not backed up; iOS may empty it when storage is low, never while the app runs." // From the course.
        case .tmp: "Short-lived scratch files. Not backed up; iOS may clear it whenever the app is not running." // From the course.
        }
    }

    /// What happens to this folder's contents after an event.
    func fate(after event: ContainerEvent) -> FolderFate { // The heart of the "what survives" table.
        switch event { // One rule per event.
        case .lowStorage: mayBePurged ? .mayBeEmptied : .kept // Only Caches and tmp may be cleared.
        case .restore: isBackedUp ? .restored : .startsEmpty // Only backed-up folders come back.
        case .appDeleted: .deleted // The whole container goes.
        }
    }

    /// How many items the folder holds right now, or nil if it does not exist yet.
    var itemCount: Int? { // Asks the real file system.
        try? FileManager.default.contentsOfDirectory(atPath: url.path()).count // try? turns "folder missing" into nil.
    }
}

/// Short descriptions of URLs relative to the container, so long paths fit on a phone screen.
enum ContainerPaths { // A namespace for the helper.
    /// The container's own folder name, which is random for every install.
    static var containerName: String { URL.homeDirectory.lastPathComponent } // The last part of the home path.

    /// A URL's path with the container part replaced by "container/".
    static func short(_ url: URL) -> String { // For display only.
        var home = URL.homeDirectory.path(percentEncoded: false) // The container's full path.
        if home.hasSuffix("/") { home.removeLast() } // Without a trailing slash, so the joins below stay clean.
        let full = url.path(percentEncoded: false) // The URL's full path, without %20 escapes.
        guard full.hasPrefix(home) else { return full } // Paths outside the container are shown as they are.
        return "container" + full.dropFirst(home.count) // The part after the container folder, which starts with "/".
    }
}

/// Saves and loads the lesson 6.1 draft in a text file.
struct DraftStore { // A struct: it only holds the file's URL.
    var url = URL.documentsDirectory.appending(path: "draft.txt") // Documents, because the user typed it; tests pass a temporary URL.

    /// Writes the draft in one atomic step.
    func save(_ draft: String) throws { // throws: the caller decides how to report a failure.
        try Data(draft.utf8).write(to: url, options: .atomic) // The course's line, with errors reported instead of ignored.
    }

    /// Reads the draft back, or an empty string when nothing was saved yet.
    func load() -> String { // Answers the course's question: where would you read draft.txt back?
        guard let data = try? Data(contentsOf: url) else { return "" } // A missing file just means no draft yet.
        return String(decoding: data, as: UTF8.self) // Turns the bytes back into text.
    }
}

/// Marks files so they stay out of backups, as the course's callout recommends for large downloads.
enum BackupExclusion { // A namespace for the helpers.
    /// Writes a pretend downloaded file (64 KB of zeros) into a folder and returns its URL.
    static func writeDownloadedFile(in folder: URL, name: String = "offline-tiles.bin") throws -> URL { // The folder may not exist yet.
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true) // Creates the folder, and its parents, if needed.
        let url = folder.appending(path: name) // The file's full URL.
        try Data(count: 64 * 1024).write(to: url, options: .atomic) // 65,536 zero bytes stand in for real map tiles.
        return url // The caller marks it next.
    }

    /// Sets or clears the isExcludedFromBackup flag on a file.
    static func setExcluded(_ excluded: Bool, for url: URL) throws { // Resource values are file metadata.
        var target = url // setResourceValues is mutating, so it needs a var copy.
        var values = URLResourceValues() // An empty set of changes.
        values.isExcludedFromBackup = excluded // The one change we want.
        try target.setResourceValues(values) // Writes the flag to the file system.
    }

    /// Reads the flag back from the file system.
    static func isExcluded(_ url: URL) throws -> Bool { // throws if the file system cannot answer; a missing file reads as false.
        let values = try url.resourceValues(forKeys: [.isExcludedFromBackupKey]) // Asks only for the one value.
        return values.isExcludedFromBackup ?? false // nil means the flag was never set.
    }
}

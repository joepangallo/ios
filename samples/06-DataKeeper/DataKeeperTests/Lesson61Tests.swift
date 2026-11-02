// Lesson61Tests.swift
// Who: the Swift Testing runner.
// What: checks lesson 6.1's logic: the storage advisor, the sandbox folder rules, the
//       draft store and the backup-exclusion flag.
// Where: the DataKeeperTests target. File tests use a temporary folder, never Documents.
// When: whenever tests run.
// Why: the advisor's answers and the "what survives" table must match the course.

import Foundation // URL, FileManager and Data.
import SwiftUI // ScenePhase.
import Testing // @Test, #expect and #require.
@testable import DataKeeper // The app's internal types.

@MainActor // The app's types are main-actor isolated.
struct StorageAdvisorTests { // The "Pick the right home for the data" logic.
    @Test(arguments: [ // One run per example, with the home the course expects.
        (StorageExample.loginToken, StorageHome.keychain), // A secret goes to the Keychain.
        (.recipes, .swiftData), // Many records go to a database.
        (.darkMode, .userDefaults), // A small setting goes to UserDefaults.
        (.mapTiles, .caches), // Re-downloadable bulk data goes to Caches.
        (.drawing, .documents), // A user document goes to Documents.
        (.sharedList, .cloudKitShared), // Shared data goes to CloudKit.
    ])
    func examplesGetTheCoursesAnswer(example: StorageExample, home: StorageHome) { // Parameterized test.
        #expect(StorageAdvisor.recommend(for: example.traits) == home) // The advice matches.
    }

    @Test func syncedDataGoesToICloud() { // The "my devices" branch.
        var traits = StorageExample.darkMode.traits // A tiny single value...
        traits.audience = .allDevices // ...needed on every device.
        #expect(StorageAdvisor.recommend(for: traits) == .iCloudKeyValue) // The key-value store.
        traits.shape = .records // Many records on every device.
        #expect(StorageAdvisor.recommend(for: traits) == .swiftDataSync) // SwiftData sync.
    }

    @Test func largeSingleValueGoesToDocuments() { // Not tiny, so not UserDefaults.
        var traits = StorageExample.darkMode.traits // Start from a setting.
        traits.size = .large // Make it huge.
        #expect(StorageAdvisor.recommend(for: traits) == .documents) // A file.
    }

    @Test func whatWouldChangeListsOnlyRealChanges() { // The "What would change the answer?" list.
        let changes = StorageAdvisor.whatWouldChange(StorageExample.loginToken.traits) // For the login token.
        #expect(changes.contains("If it were not secret: UserDefaults")) // Secrecy is the deciding answer.
        #expect(!changes.contains { $0.contains("The Keychain") }) // The current answer never appears as a change.
        let recipeChanges = StorageAdvisor.whatWouldChange(StorageExample.recipes.traits) // For the recipes.
        #expect(recipeChanges.contains("If it were secret: The Keychain")) // Flipping secrecy matters.
        #expect(recipeChanges.contains("If it could be downloaded again: A file in Library/Caches")) // So does downloading.
        #expect(recipeChanges.contains("If others needed it: A CloudKit shared or public database")) // And the audience.
    }

    @Test func everyHomeExplainsItself() { // Each place has an API and a reason.
        for home in StorageHome.allCases { // Every place.
            #expect(!home.api.isEmpty) // An API line.
            #expect(home.why.hasSuffix(".")) // A full sentence.
        }
    }
}

@MainActor // The app's types are main-actor isolated.
struct SandboxTests { // The container folder rules.
    @Test func backupAndPurgeRulesMatchTheCourse() { // The course's table.
        #expect(SandboxFolder.documents.isBackedUp && !SandboxFolder.documents.mayBePurged) // Backed up, never purged.
        #expect(SandboxFolder.applicationSupport.isBackedUp && !SandboxFolder.applicationSupport.mayBePurged) // Same.
        #expect(!SandboxFolder.caches.isBackedUp && SandboxFolder.caches.mayBePurged) // Not backed up, purgeable.
        #expect(!SandboxFolder.tmp.isBackedUp && SandboxFolder.tmp.mayBePurged) // Same.
    }

    @Test func fatesAfterEachEvent() { // What survives.
        #expect(SandboxFolder.documents.fate(after: .lowStorage) == .kept) // Cleanup keeps Documents.
        #expect(SandboxFolder.caches.fate(after: .lowStorage) == .mayBeEmptied) // Cleanup may empty Caches.
        #expect(SandboxFolder.applicationSupport.fate(after: .restore) == .restored) // A restore brings it back.
        #expect(SandboxFolder.tmp.fate(after: .restore) == .startsEmpty) // Not in the backup.
        for folder in SandboxFolder.allCases { // Deleting the app...
            #expect(folder.fate(after: .appDeleted) == .deleted) // ...deletes everything.
        }
    }

    @Test func urlsPointInsideTheContainer() { // The real folder locations.
        #expect(SandboxFolder.documents.url == URL.documentsDirectory) // The Foundation property.
        #expect(SandboxFolder.preferences.url.path().hasSuffix("Library/Preferences")) // Built from Library.
        #expect(ContainerPaths.short(URL.documentsDirectory).hasPrefix("container/Documents")) // Shortened for the screen.
        #expect(!ContainerPaths.short(URL.documentsDirectory).contains("//")) // No doubled slashes.
        #expect(ContainerPaths.short(URL(filePath: "/elsewhere/file.txt")) == "/elsewhere/file.txt") // Outside paths are left alone.
        #expect(!ContainerPaths.containerName.isEmpty) // The random install folder has a name.
    }

    @Test func everyFolderDescribesItself() { // Paths, properties and explanations.
        for folder in SandboxFolder.allCases { // Each folder.
            #expect(!folder.path.isEmpty && !folder.swiftProperty.isEmpty && !folder.belongsHere.isEmpty) // Nothing blank.
        }
        #expect(SandboxFolder.documents.itemCount != nil) // Documents exists in every container.
    }

    @Test func phaseNames() { // The scene phase labels.
        #expect(PhaseName.of(.active) == ".active") // On screen.
        #expect(PhaseName.of(.inactive) == ".inactive") // Visible, no touches.
        #expect(PhaseName.of(.background) == ".background") // Off screen.
    }
}

@MainActor // The app's types are main-actor isolated.
struct DraftAndBackupTests { // File helpers, in a temporary folder.
    @Test func draftRoundTrip() throws { // Save, then load.
        let folder = try makeTemporaryFolder() // A private folder.
        defer { try? FileManager.default.removeItem(at: folder) } // Cleaned up afterwards.
        let store = DraftStore(url: folder.appending(path: "draft.txt")) // Not Documents.
        #expect(store.load() == "") // Nothing saved yet.
        try store.save("Dear diary") // First save.
        #expect(store.load() == "Dear diary") // Reads it back.
        try store.save("Rewritten") // A second save replaces the file.
        #expect(store.load() == "Rewritten") // Only the new text.
    }

    @Test func draftSaveIntoMissingFolderThrows() { // Errors are reported, not ignored.
        let store = DraftStore(url: URL(filePath: "/no/such/folder/draft.txt")) // A folder that cannot exist.
        #expect(throws: (any Error).self) { try store.save("text") } // The write fails loudly.
    }

    @Test func backupExclusionFlag() throws { // isExcludedFromBackup.
        let folder = try makeTemporaryFolder() // A private folder.
        defer { try? FileManager.default.removeItem(at: folder) } // Cleaned up afterwards.
        let url = try BackupExclusion.writeDownloadedFile(in: folder.appending(path: "Downloads")) // Creates the subfolder too.
        #expect(try Data(contentsOf: url).count == 65_536) // 64 KB of zeros.
        #expect(try BackupExclusion.isExcluded(url) == false) // New files are backed up.
        try BackupExclusion.setExcluded(true, for: url) // Exclude it.
        #expect(try BackupExclusion.isExcluded(url)) // The flag reads back.
        try BackupExclusion.setExcluded(false, for: url) // And include it again.
        #expect(try BackupExclusion.isExcluded(url) == false) // Cleared.
    }

    @Test func backupFlagOfMissingFileReadsFalse() throws { // Foundation reports no flag for a missing file.
        #expect(try BackupExclusion.isExcluded(URL(filePath: "/no/such/file.bin")) == false) // nil becomes false.
    }

    @Test func settingTheFlagOnAMissingFileThrows() { // Writing metadata needs a real file.
        #expect(throws: (any Error).self) { try BackupExclusion.setExcluded(true, for: URL(filePath: "/no/such/file.bin")) } // Nothing to mark.
    }

    @Test func sixPlacesAreListed() { // Memory plus the five persistent places.
        #expect(StoragePlaceRow.all.map(\.term) == ["Memory", "UserDefaults", "Files", "A database", "The Keychain", "The cloud"]) // The course's order.
    }
}

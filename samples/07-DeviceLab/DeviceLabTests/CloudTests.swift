// CloudTests.swift
// Who: the Swift Testing runner.
// What: checks lesson 7.4's logic: the account-status switch, the course's error
//       messages on real CKError values, reading a CKRecord into GroceryItem, the
//       simulated databases, the simulated key-value sync and the backend advice.
// Where: the DeviceLabTests target.
// When: whenever the tests run.
// Why: these behaviors are what the lesson teaches, and the simulation must follow
//      CloudKit's rules. No test creates a CKContainer or touches iCloud.

import Testing // @Test, #expect and #require.
import CloudKit // CKAccountStatus, CKError and CKRecord (plain values, no container).
@testable import DeviceLab // The app's internal types.

@MainActor // The app's types live on the main actor.
struct CloudAccountTests { // The account check.
    @Test func realICloudIsOffByDefault() { // The sample must never call CKContainer without the entitlement.
        #expect(CloudConfig.isEnabled == false) // Simulated mode.
    }

    @Test(arguments: [ // Each status and the course's headline for it.
        (CKAccountStatus.available, "Synced with iCloud"), // Signed in.
        (CKAccountStatus.noAccount, "Sign in to sync"), // Signed out.
        (CKAccountStatus.restricted, "iCloud is restricted"), // Blocked.
        (CKAccountStatus.temporarilyUnavailable, "Check your Apple Account"), // Needs attention.
        (CKAccountStatus.couldNotDetermine, "Could not reach iCloud"), // Unknown.
    ])
    func eachStatusGetsItsOwnAdvice(status: CKAccountStatus, title: String) { // Parameterized.
        let checker = CloudAccountChecker() // A fresh checker.
        checker.react(to: status) // The course's switch.
        #expect(checker.advice.title == title) // The right branch.
    }

    @Test func highlightedLinesMatchTheListing() { // The simulation's lines.
        let checker = CloudAccountChecker() // A fresh checker.
        checker.react(to: .noAccount) // Signed out.
        #expect(checker.advice.linesRun == [4, 8, 9]) // From the course's simulation.
        #expect(CloudAccountChecker.listing[9].contains("showSignInHint")) // The highlighted call.
        checker.react(to: .available) // Signed in.
        #expect(CloudAccountChecker.listing[7].contains("enableCloudFeatures")) // The highlighted call.
        #expect(checker.advice.button == nil) // Nothing to fix.
    }

    @Test func onlyFixableStatesOfferSettings() { // Restricted cannot be fixed in Settings.
        let checker = CloudAccountChecker() // A fresh checker.
        checker.react(to: .restricted) // Blocked.
        #expect(checker.advice.button == nil) // No button.
        checker.react(to: .temporarilyUnavailable) // Needs attention.
        #expect(checker.advice.button == "Open Settings") // The fix lives in Settings.
    }
}

@MainActor // The app's types live on the main actor.
struct CloudErrorTests { // The course's describe(_:).
    @Test func eachCodeGetsItsMessage() { // Real CKError values.
        #expect(describe(CKError(.notAuthenticated)) == "Sign in to iCloud in Settings to sync.") // Signed out.
        #expect(describe(CKError(.networkUnavailable)) == "You are offline. We will sync later.") // Offline.
        #expect(describe(CKError(.networkFailure)) == "You are offline. We will sync later.") // Same advice.
        #expect(describe(CKError(.quotaExceeded)) == "Your iCloud storage is full.") // The course's try-it.
        #expect(describe(CKError(.serverRecordChanged)) == "Another device changed this item.") // Conflict.
        #expect(describe(CKError(.unknownItem)) == "Something went wrong. Try again.") // No case of its own.
    }

    @Test func retryAfterSecondsIsReported() { // The server asked us to wait.
        let error = CKError(.serviceUnavailable, userInfo: [CKErrorRetryAfterKey: 30.0]) // Wait 30 s, stored as a Double like CloudKit does.
        #expect(describe(error) == "iCloud is busy. Retry in 30 s.") // Whole seconds.
        #expect(describe(ErrorChoice.busy.error) == "iCloud is busy. Retry in 30 s.") // The picker's choice too.
    }

    @Test func pickerChoicesCarryTheirCodes() { // Each choice builds the right error.
        #expect(ErrorChoice.quotaExceeded.error.code == .quotaExceeded) // Storage full.
        #expect(ErrorChoice.unknownItem.error.code == .unknownItem) // Deleted elsewhere.
        #expect(ErrorChoice.allCases.count == 7) // Seven choices.
    }

    @Test func groceryItemReadsARecord() { // The course's conversion.
        let record = CKRecord(recordType: "GroceryItem") // A local record; nothing is uploaded.
        record["name"] = "Trail mix" // A name.
        record["quantity"] = 3 // A quantity.
        let item = GroceryItem(record: record) // Convert.
        #expect(item.name == "Trail mix") // Read as String.
        #expect(item.quantity == 3) // Read as Int.
        #expect(item.id == record.recordID) // Keeps the ID.
    }

    @Test func missingFieldsGetDefaults() { // Old records, or wrong types.
        let record = CKRecord(recordType: "GroceryItem") // No fields at all.
        let item = GroceryItem(record: record) // Convert.
        #expect(item.name == "") // Empty name.
        #expect(item.quantity == 1) // Quantity 1.
    }
}

@MainActor // The app's types live on the main actor.
struct SimulatedCloudTests { // The simulated databases.
    @Test func privateRecordsBelongToOneUser() throws { // The quiz: Ben cannot see Ana's private item.
        var cloud = SimulatedCloud() // Ana is signed in.
        let saveError = cloud.save("Trail mix", isShared: false) // Save privately.
        #expect(saveError == nil) // Saved.
        let anaItems = try cloud.query(isShared: false).get() // Ana's private query.
        #expect(anaItems.map(\.name) == ["Trail mix"]) // Ana sees it.
        cloud.user = .ben // Switch to Ben.
        let benItems = try cloud.query(isShared: false).get() // Ben's private query.
        #expect(benItems.isEmpty) // Ben does not.
    }

    @Test func publicRecordsAreSharedByEveryone() throws { // The public database.
        var cloud = SimulatedCloud() // Ana is signed in.
        cloud.save("Water filter", isShared: true) // Saved publicly.
        cloud.user = .ben // Switch to Ben.
        let items = try cloud.query(isShared: true).get() // Ben's public query.
        #expect(items.map(\.name) == ["Water filter"]) // Ben sees it.
    }

    @Test func signedOutUsersCannotWriteButCanReadPublic() throws { // The quiz's second question.
        var cloud = SimulatedCloud() // Ana is signed in.
        cloud.save("Map", isShared: true) // A public item.
        cloud.user = .signedOut // Sign out.
        let publicSave = cloud.save("Snacks", isShared: true) // Try a public save.
        let privateSave = cloud.save("Snacks", isShared: false) // Try a private save.
        #expect(publicSave?.code == .notAuthenticated) // Public save fails.
        #expect(privateSave?.code == .notAuthenticated) // Private save fails.
        let publicItems = try cloud.query(isShared: true).get() // Public read.
        #expect(publicItems.count == 1) // Works without an account.
        let privateRead = cloud.query(isShared: false) // Private read.
        #expect(throws: CKError.self) { try privateRead.get() } // Fails without an account.
    }

    @Test func offlineFailsEverything() { // No network.
        var cloud = SimulatedCloud() // Ana is signed in.
        cloud.isOnline = false // Offline.
        let saveError = cloud.save("Rope", isShared: false) // Try to save.
        #expect(saveError?.code == .networkUnavailable) // Save fails.
        if case .failure(let error) = cloud.query(isShared: true) { // Query fails too.
            #expect(error.code == .networkUnavailable) // With the offline code.
        } else { // A success would be wrong.
            Issue.record("An offline query must fail") // Fail the test with a message.
        }
    }

    @Test func fullStorageBlocksOnlyPrivateSaves() { // Private data counts against the user's quota.
        var cloud = SimulatedCloud() // Ana is signed in.
        cloud.isStorageFull = true // Full.
        let privateSave = cloud.save("Tent", isShared: false) // Private.
        let publicSave = cloud.save("Tent", isShared: true) // Public.
        #expect(privateSave?.code == .quotaExceeded) // Private fails.
        #expect(publicSave == nil) // Public works.
    }

    @Test func logRecordsEveryRequest() { // The request log.
        var cloud = SimulatedCloud() // Ana is signed in.
        cloud.save("Trail mix", isShared: false) // One save.
        _ = cloud.query(isShared: false) // One query.
        #expect(cloud.log.count == 2) // Two lines.
        #expect(cloud.log[0].contains("Ana's private database: OK")) // Where it went.
        cloud.reset() // Start over.
        #expect(cloud.log.isEmpty && cloud.publicRecords.isEmpty) // Everything cleared.
    }

    @Test func codeNamesMatchSwift() { // Labels in the log.
        #expect(SimulatedCloud.codeName(.notAuthenticated) == "notAuthenticated") // As written in code.
        #expect(SimulatedCloud.codeName(.quotaExceeded) == "quotaExceeded") // As written in code.
        #expect(SimulatedCloud.codeName(.badContainer).hasPrefix("code ")) // Others by number.
    }
}

@MainActor // The app's types live on the main actor.
struct KeyValueSyncTests { // The simulated NSUbiquitousKeyValueStore.
    @Test func defaultSortOrderIsAisle() { // A brand-new user.
        let store = SimulatedKeyValueCloud() // Nothing stored.
        #expect(store.sortOrder(on: .phone) == "aisle") // The course's default.
    }

    @Test func changesArriveOnlyAfterSync() { // iOS uploads in the background.
        var store = SimulatedKeyValueCloud() // Nothing stored.
        store.setSortOrder("name", on: .phone) // Change it on the iPhone.
        #expect(store.sortOrder(on: .phone) == "name") // The iPhone sees it at once.
        #expect(store.sortOrder(on: .tablet) == "aisle") // The iPad does not yet.
        store.sync() // iCloud delivers it.
        #expect(store.sortOrder(on: .tablet) == "name") // Now it does.
        #expect(store.log.last?.contains("didChangeExternallyNotification") == true) // The iPad was told.
        #expect(store.pending.isEmpty) // Nothing left to deliver.
    }

    @Test func syncWithNothingPendingSaysSo() { // No changes.
        var store = SimulatedKeyValueCloud() // Nothing stored.
        store.sync() // Nothing to do.
        #expect(store.log == ["Nothing to sync"]) // Explained.
    }

    @Test func largeValuesAreRejected() { // 1 MB per user.
        var store = SimulatedKeyValueCloud() // Nothing stored.
        let big = store.store(bytes: 2_000_000, forKey: "photo", on: .phone) // Two megabytes.
        let small = store.store(bytes: 200, forKey: "units", on: .phone) // A few bytes.
        #expect(big == false) // Too big.
        #expect(small) // Small is fine.
        #expect(SimulatedKeyValueCloud.maxKeys == 1024) // The key limit from the lesson.
    }
}

@MainActor // The app's types live on the main actor.
struct StorageAdvisorTests { // CloudKit or your own backend?
    @Test func crossPlatformNeedsABackend() { // Android or the web.
        #expect(StorageAdvisor.recommend(crossPlatform: true, serverLogic: false, onlyPreferences: false).contains("backend")) // A backend.
    }

    @Test func serverLogicNeedsABackend() { // Payments, moderation, jobs.
        #expect(StorageAdvisor.recommend(crossPlatform: false, serverLogic: true, onlyPreferences: true).contains("backend")) // A backend wins.
    }

    @Test func preferencesUseKeyValueStorage() { // A few settings.
        #expect(StorageAdvisor.recommend(crossPlatform: false, serverLogic: false, onlyPreferences: true).contains("NSUbiquitousKeyValueStore")) // Key-value storage.
    }

    @Test func appleOnlyPersonalDataUsesCloudKit() { // The default.
        #expect(StorageAdvisor.recommend(crossPlatform: false, serverLogic: false, onlyPreferences: false).hasPrefix("CloudKit")) // CloudKit.
    }
}

// Lesson68Tests.swift
// Who: the Swift Testing runner.
// What: checks lesson 6.8's simulated parts: the TaskCloud methods against the in-memory
//       database, CKError.serverRecordChanged handling, the sync-readiness rules, the
//       two-device simulator with every conflict policy, and the trips container.
// Where: the DataKeeperTests target. Nothing here creates a CKContainer or uses iCloud.
// When: whenever tests run.
// Why: iCloud cannot run with a free team, so the logic around it must be right on its own.

import Foundation // NSError.
import CloudKit // CKRecord, CKQuery and CKError.
import SwiftData // The trips container.
import Testing // @Test, #expect and #require.
@testable import DataKeeper // The app's internal types.

@MainActor // The app's types are main-actor isolated.
struct SimulatedCloudTests { // "Save and query records".
    @Test func cloudModeIsSimulated() { // Never live without the capability.
        #expect(CloudMode.iCloudCapabilityAdded == false) // The default.
        #expect(CloudMode.label.contains("SIMULATED")) // Clearly labeled.
    }

    @Test func addThenQueryOpenTitles() async throws { // The course's two methods.
        let database = SimulatedCloudDatabase() // The stand-in.
        database.latency = .zero // No waiting in tests.
        let cloud = SimulatedTaskCloud(database: database) // The course's methods.
        let first = try await cloud.add(title: "Pack the stove") // Saved.
        _ = try await cloud.add(title: "Buy fuel") // Saved.
        #expect(database.records.count == 2) // Two records.
        try await cloud.markDone(first) // isDone = true.
        #expect(try await cloud.openTitles() == ["Buy fuel"]) // isDone == 0 filters it out.
    }

    @Test func queryChecksTheRecordType() async throws { // CKQuery's recordType.
        let database = SimulatedCloudDatabase() // The stand-in.
        database.latency = .zero // No waiting.
        let other = CKRecord(recordType: "Note") // A different type...
        other["isDone"] = false // ...that would match the predicate.
        _ = try await database.save(other) // Stored.
        #expect(try await SimulatedTaskCloud(database: database).openTitles() == []) // Not a Task.
    }

    @Test func savingAgainReplaces() async throws { // Same ID, one record.
        let database = SimulatedCloudDatabase() // The stand-in.
        database.latency = .zero // No waiting.
        let record = CKRecord(recordType: "Task") // A record.
        _ = try await database.save(record) // Once.
        _ = try await database.save(record) // Twice.
        #expect(database.records.count == 1) // Replaced, not duplicated.
    }

    @Test func fieldsAreReadable() { // The predicate's dictionary.
        let record = CKRecord(recordType: "Task") // A record.
        record["title"] = "Milk" // A field.
        let fields = SimulatedCloudDatabase.fields(of: record) // As a dictionary.
        #expect(fields["title"] as? String == "Milk") // The value.
        #expect(NSPredicate(format: "title == 'Milk'").evaluate(with: fields)) // NSPredicate can read it.
    }

    @Test func recordInspectorDescribesTheSample() { // The concept card.
        let lines = RecordInspector.describe(RecordInspector.sample) // The sample record.
        #expect(lines.first == "recordType: Task") // The type.
        #expect(lines.contains("title: Pack the tent")) // A field.
        #expect(lines.contains("isDone: 0")) // A Bool is stored as a number.
        #expect(lines[1].hasSuffix(CKRecordZone.default().zoneID.zoneName)) // The default zone.
    }
}

@MainActor // The app's types are main-actor isolated.
struct ConflictTests { // "Conflicts and offline edits".
    @Test func serverVersionComesFromTheError() throws { // CKError.serverRecordChanged.
        let server = CKRecord(recordType: "Task") // The server's copy.
        server["title"] = "Milk" // Its title.
        let error = CloudConflict.outdatedSaveError(server: server) // The error CloudKit would send.
        #expect(error.code == .serverRecordChanged) // The right case.
        #expect(CloudConflict.serverVersion(from: error)?.recordID == server.recordID) // The same record rides along.
    }

    @Test func otherErrorsHaveNoServerVersion() { // Only one case carries a record.
        #expect(CloudConflict.serverVersion(from: CKError(.networkFailure)) == nil) // A different CloudKit error.
        #expect(CloudConflict.serverVersion(from: CocoaError(.fileNoSuchFile)) == nil) // Not a CloudKit error at all.
    }

    @Test func mergeKeepsTheServersOtherFields() { // Field-level merge.
        let server = CKRecord(recordType: "Task") // The server's copy.
        server["title"] = "Milk" // Unchanged title.
        server["isDone"] = true // Checked on another device.
        let local = CKRecord(recordType: "Task", recordID: server.recordID) // Our outdated copy.
        local["title"] = "Oat milk" // Our rename.
        local["isDone"] = false // Stale.
        let merged = CloudConflict.merge(changedFields: ["title"], from: local, into: server) // Only the title.
        #expect(merged["title"] as? String == "Oat milk") // Our change.
        #expect(merged["isDone"] as? Bool == true) // Their change.
    }

    @Test func conflictDemoPrintsEveryStep() { // The card's output.
        #expect(ConflictDemo.run().lines == [ // Exactly these lines.
            "save(local) threw CKError.serverRecordChanged", // Step 1.
            "Server has: Milk isDone: true", // Step 2.
            "Merged: Oat milk isDone: true", // Step 3.
            "Next: save(merged) again", // Step 4.
        ])
    }
}

@MainActor // The app's types are main-actor isolated.
struct SyncReadinessTests { // "Making a model sync-ready".
    @Test func leftVersionBreaksEveryRule() { // The course's "Cannot sync" side.
        #expect(SyncReadiness.problems(in: .cannotSync).count == 5) // Unique, defaults, optional, inverse, deny.
    }

    @Test func rightVersionIsReady() { // The course's "Sync-ready" side.
        #expect(SyncReadiness.problems(in: .syncReady).isEmpty) // No problems.
    }

    @Test func eachRuleCountsOnItsOwn() { // Flip one rule at a time.
        var design = ModelDesign.syncReady // Start ready.
        design.deleteRule = .deny // Break one rule.
        #expect(SyncReadiness.problems(in: design) == ["The .deny delete rule is not supported with sync."]) // Exactly that one.
        design.deleteRule = .nullify // Nullify is allowed.
        #expect(SyncReadiness.problems(in: design).isEmpty) // Ready again.
    }

    @Test func codeMatchesTheCourse() { // The generated source.
        // The sync-ready version must read exactly like the course's right-hand side.
        #expect(SyncReadiness.code(for: .syncReady) == """
        @Model
        final class Trip {
            var code: String = ""
            var name: String = ""
            var startDate: Date = Date.now
            @Relationship(deleteRule: .cascade, inverse: \\Stop.trip)
            var stops: [Stop]? = []
        }
        """) // The course's right-hand properties.
        // The other version must read exactly like the course's left-hand side.
        #expect(SyncReadiness.code(for: .cannotSync) == """
        @Model
        final class Trip {
            @Attribute(.unique) var code: String
            var name: String
            var startDate: Date
            @Relationship(deleteRule: .deny)
            var stops: [Stop]
        }
        """) // The course's left-hand properties.
    }

    @Test func tripsContainerRunsLocally() throws { // Simulated mode: in memory, no CloudKit.
        let container = try TripsContainer.make(live: false) // Never live in tests.
        #expect(container.configurations.first?.isStoredInMemoryOnly == true) // Memory only.
        let context = container.mainContext // Its context.
        let trip = Trip(code: "T1", name: "Lakeside loop") // A sync-ready trip.
        context.insert(trip) // Inserted.
        let stop = Stop(name: "Summit") // A stop.
        context.insert(stop) // Inserted.
        stop.trip = trip // Linked from the to-one end.
        #expect(trip.stops?.count == 1) // The inverse updated.
        context.delete(trip) // Cascade.
        try context.save() // Applied.
        #expect(try context.fetchCount(FetchDescriptor<Stop>()) == 0) // The stop went too.
    }
}

@MainActor // The app's types are main-actor isolated.
struct SyncSimulatorTests { // "Two devices, one list".
    @Test func onlineEditsReachTheOtherDevice() { // Both online.
        var sim = SyncSimulator() // Milk, Eggs, Bread.
        sim.toggleDone(2, on: .iPhone) // Check Eggs on the iPhone.
        #expect(sim.items(on: .iPad).first { $0.id == 2 }?.isDone == true) // The iPad has it.
        #expect(sim.server.first { $0.id == 2 }?.isDone == true) // So does iCloud.
        #expect(sim.pendingCount(on: .iPhone) == 0) // Nothing waiting.
    }

    @Test func offlineEditsQueueUntilReconnect() { // Airplane mode.
        var sim = SyncSimulator() // In sync.
        sim.setOffline(true, for: .iPad) // The iPad goes offline.
        sim.toggleDone(3, on: .iPad) // Check Bread.
        sim.rename(3, to: "Rye bread", on: .iPad) // And rename it.
        #expect(sim.pendingCount(on: .iPad) == 1) // Combined into one queued edit.
        #expect(sim.server.first { $0.id == 3 }?.name == "Bread") // iCloud has not heard.
        #expect(sim.items(on: .iPhone).first { $0.id == 3 }?.name == "Bread") // Nor has the iPhone.
        sim.setOffline(false, for: .iPad) // Back online.
        #expect(sim.pendingCount(on: .iPad) == 0) // Uploaded.
        #expect(sim.items(on: .iPhone).first { $0.id == 3 } == GroceryItem(id: 3, name: "Rye bread", isDone: true)) // Both changes arrived.
    }

    @Test func offlineDeviceCatchesUpOnReconnect() { // Downloads happen when it returns.
        var sim = SyncSimulator() // In sync.
        sim.setOffline(true, for: .iPhone) // The iPhone goes offline.
        sim.addItem(named: "Apples", on: .iPad) // The iPad adds an item.
        #expect(!sim.items(on: .iPhone).contains { $0.name == "Apples" }) // Not yet on the iPhone.
        sim.setOffline(false, for: .iPhone) // Back online.
        #expect(sim.items(on: .iPhone).contains { $0.name == "Apples" }) // Caught up.
        #expect(sim.isOffline(.iPhone) == false) // Online again.
    }

    @Test func itemsAddedOfflineUploadLater() { // New items wait too.
        var sim = SyncSimulator() // In sync.
        sim.setOffline(true, for: .iPhone) // Offline.
        sim.addItem(named: "Coffee", on: .iPhone) // Added locally.
        #expect(sim.server.count == 3 && sim.pendingCount(on: .iPhone) == 1) // Waiting.
        sim.setOffline(false, for: .iPhone) // Online.
        #expect(sim.server.map(\.name) == ["Milk", "Eggs", "Bread", "Coffee"]) // Uploaded.
    }

    @Test func lastWriterWinsMatchesTheQuiz() { // The course's quiz: Oat milk.
        let sim = SyncSimulator.conflictScenario(policy: .lastWriterWins) // The scenario.
        #expect(sim.server.first { $0.id == 1 } == GroceryItem(id: 1, name: "Oat milk", isDone: false)) // The iPhone uploaded last; the iPad's rename and checkmark are lost.
        #expect(sim.items(on: .iPad) == sim.server && sim.items(on: .iPhone) == sim.server) // Both devices agree.
        #expect(sim.log.lines.contains("9:01") && sim.log.lines.contains("9:02")) // The time stamps.
    }

    @Test func fieldMergeKeepsTheCheckmark() { // Different fields survive.
        let sim = SyncSimulator.conflictScenario(policy: .fieldMerge) // The scenario.
        #expect(sim.server.first { $0.id == 1 } == GroceryItem(id: 1, name: "Oat milk", isDone: true)) // The iPhone's name, the iPad's checkmark.
    }

    @Test func keepBothLosesNothing() { // A copy is saved.
        let sim = SyncSimulator.conflictScenario(policy: .keepBoth) // The scenario.
        #expect(sim.server.first { $0.id == 1 } == GroceryItem(id: 1, name: "Whole milk", isDone: true)) // The iPad's version stays.
        #expect(sim.server.contains { $0.name == "Oat milk (from iPhone)" && !$0.isDone }) // The iPhone's version is a copy.
        #expect(sim.server.count == 4) // One extra item.
    }

    @Test func describeShowsTheCheckbox() { // The text format.
        #expect(SyncSimulator.describe(GroceryItem(id: 1, name: "Milk", isDone: true)) == "[x] Milk") // Checked.
        #expect(SyncSimulator.describe(GroceryItem(id: 1, name: "Milk", isDone: false)) == "[ ] Milk") // Unchecked.
    }

    @Test func editsToUnknownItemsAreIgnored() { // Defensive: nothing changes.
        var sim = SyncSimulator() // In sync.
        sim.rename(99, to: "Ghost", on: .iPhone) // No such item.
        #expect(sim.server.count == 3 && sim.log.lines.count == 1) // Nothing beyond the starting line.
    }
}

// CloudSync.swift
// Who: lesson 6.8 uses these types; the tests check the simulated parts.
// What: the switch that keeps CloudKit off unless the app really has the iCloud
//       capability, the course's TaskCloud and TripsApp code (compiled, never run here),
//       an in-memory stand-in for a CloudKit database that stores real CKRecord values,
//       the conflict helper for CKError.serverRecordChanged, and the trips container.
// Where: the Support folder. Nothing in this app calls CKContainer at run time unless
//        CloudMode.iCloudCapabilityAdded is true.
// When: when the student saves or queries records on the lesson 6.8 screen.
// Why: iCloud needs a paid Apple Developer Program membership. A free Personal Team cannot
//      add the capability, and creating a CKContainer without it ends the app at once.

import Foundation // NSPredicate and FileManager.
import CloudKit // CKRecord, CKQuery, CKContainer and CKError.
import SwiftData // ModelContainer and ModelConfiguration.
import SwiftUI // App, Scene and View, for the course's TripsApp.

/// Whether this build may talk to iCloud.
enum CloudMode { // A namespace for the switch.
    /// Set this to true only after adding the iCloud capability (CloudKit, with the containers
    /// named below) and Background Modes > Remote notifications, which needs a paid account.
    static let iCloudCapabilityAdded = false // false: every iCloud demo runs in simulated mode.

    /// The label every lesson 6.8 card shows.
    static var label: String { iCloudCapabilityAdded ? "Live iCloud" : "SIMULATED MODE: no iCloud capability in this build" } // Clear about what is real.

    /// Whether an iCloud account is signed in and available to this app. Safe to call without the capability: it is then nil.
    static var accountAvailable: Bool { FileManager.default.ubiquityIdentityToken != nil } // nil means no account, or no capability.
}

/// The course's TaskCloud, exactly as written. Creating one calls CKContainer, so this app
/// never creates one unless CloudMode.iCloudCapabilityAdded is true.
struct TaskCloud { // Talks to the user's private database.
    let database = CKContainer(identifier: "iCloud.com.example.tasks") // The app's container on Apple's servers...
        .privateCloudDatabase // ...and the signed-in user's private database in it.

    func add(title: String) async throws -> CKRecord.ID { // Saves one task record.
        let record = CKRecord(recordType: "Task") // A new record of type Task.
        record["title"] = title // A string field.
        record["isDone"] = false // A Bool, stored as a number.
        let saved = try await database.save(record) // Sends it over the network.
        return saved.recordID // The ID the server confirmed.
    }

    func openTitles() async throws -> [String] { // Fetches the titles of unfinished tasks.
        let predicate = NSPredicate(format: "isDone == 0") // Only records whose isDone is false.
        let query = CKQuery(recordType: "Task", predicate: predicate) // Task records matching it.
        let (results, _) = try await database.records(matching: query) // Each result is a record or an error.
        return results.compactMap { _, result in // Keeps only successful titles.
            try? result.get()["title"] as? String // The record's title, if it has one.
        }
    }
}

/// A stand-in for a CloudKit database that keeps real CKRecord values in memory.
final class SimulatedCloudDatabase { // A class, so every user shares the same records.
    private(set) var records: [CKRecord] = [] // What "the server" holds.
    var latency: Duration = .milliseconds(350) // A pretend network delay; tests set it to zero.

    /// Stores a record, replacing one with the same ID, after a pretend network delay.
    func save(_ record: CKRecord) async throws -> CKRecord { // Same shape as CKDatabase.save.
        try await Task.sleep(for: latency) // The network takes time.
        records.removeAll { $0.recordID == record.recordID } // Saving again replaces the old copy.
        records.append(record) // Keeps the new copy.
        return record // A real server returns its own copy; this one returns the same record.
    }

    /// Finds records of the query's type whose fields match its predicate.
    func records(matching query: CKQuery) async throws -> (matchResults: [(CKRecord.ID, Result<CKRecord, any Error>)], queryCursor: CKQueryOperation.Cursor?) { // Same shape as CKDatabase.records(matching:).
        try await Task.sleep(for: latency) // The network takes time.
        let predicate = NSPredicate(format: query.predicate.predicateFormat) // CKQuery turns off local evaluation of its own copy, so rebuild it from its text.
        let matches = records.filter { record in // Each stored record...
            record.recordType == query.recordType && predicate.evaluate(with: Self.fields(of: record)) // ...of the right type, matching the predicate.
        }
        return (matches.map { ($0.recordID, .success($0)) }, nil) // Every match succeeded; nil: there is no next page.
    }

    /// A record's fields as a dictionary, which NSPredicate knows how to read.
    static func fields(of record: CKRecord) -> NSDictionary { // NSPredicate reads values by key name.
        var fields: [String: Any] = [:] // Starts empty.
        for key in record.allKeys() { fields[key] = record[key] } // Copies every field.
        return NSDictionary(dictionary: fields) // The Objective-C dictionary NSPredicate expects.
    }
}

/// The course's TaskCloud methods, line for line, against the simulated database.
struct SimulatedTaskCloud { // Same API as TaskCloud.
    let database: SimulatedCloudDatabase // The in-memory stand-in instead of privateCloudDatabase.

    func add(title: String) async throws -> CKRecord.ID { // Identical to TaskCloud.add.
        let record = CKRecord(recordType: "Task") // A real CKRecord; making one needs no container.
        record["title"] = title // A string field.
        record["isDone"] = false // A Bool, stored as a number.
        let saved = try await database.save(record) // "Sends" it.
        return saved.recordID // The record's ID.
    }

    func openTitles() async throws -> [String] { // Identical to TaskCloud.openTitles.
        let predicate = NSPredicate(format: "isDone == 0") // Only unfinished tasks.
        let query = CKQuery(recordType: "Task", predicate: predicate) // Task records matching it.
        let (results, _) = try await database.records(matching: query) // The simulated query.
        return results.compactMap { _, result in // Keeps only successful titles.
            try? result.get()["title"] as? String // The record's title.
        }
    }

    /// Marks a task done by changing its field and saving the record again.
    func markDone(_ id: CKRecord.ID) async throws { // Not in the course; lets the screen change isDone.
        guard let record = database.records.first(where: { $0.recordID == id }) else { return } // Finds the stored record.
        record["isDone"] = true // Changes the field.
        _ = try await database.save(record) // Saves it again.
    }
}

/// The CloudKit conflict pattern from "Conflicts and offline edits".
enum CloudConflict { // A namespace for the helpers.
    /// The server's copy of a record, if the error is CKError.serverRecordChanged.
    static func serverVersion(from error: any Error) -> CKRecord? { // nil for every other error.
        guard let cloudError = error as? CKError, cloudError.code == .serverRecordChanged else { return nil } // Only this one case carries the server's copy.
        return cloudError.serverRecord // Read from the error's userInfo.
    }

    /// The error CloudKit sends when a save is based on an outdated record. Building it needs no network.
    static func outdatedSaveError(server: CKRecord) -> CKError { // Used by the simulated demo and the tests.
        CKError(.serverRecordChanged, userInfo: [CKRecordChangedErrorServerRecordKey: server]) // The server's copy rides along.
    }

    /// Copies only the fields this device changed onto the server's copy: a field-level merge.
    static func merge(changedFields: [String], from local: CKRecord, into server: CKRecord) -> CKRecord { // Returns the record to save again.
        for key in changedFields { server[key] = local[key] } // Our edits win only where we edited.
        return server // The server's other fields are kept.
    }
}

/// Builds the container for lesson 6.8's trips: CloudKit-backed in live mode, in memory otherwise.
enum TripsContainer { // A namespace for the factory.
    static let cloudContainerID = "iCloud.com.example.trips" // The course's container identifier.

    /// The course's configuration in live mode; a local in-memory store in simulated mode.
    static func make(live: Bool = CloudMode.iCloudCapabilityAdded) throws -> ModelContainer { // Never live without the capability.
        let config = live // Which configuration to use?
            ? ModelConfiguration(cloudKitDatabase: .private(cloudContainerID)) // The course's line: sync to the private database.
            : ModelConfiguration(isStoredInMemoryOnly: true, cloudKitDatabase: .none) // Simulated: no sync at all.
        return try ModelContainer(for: Trip.self, configurations: config) // Stop is found through the relationship.
    }
}

/// The course's TripsApp, exactly as written, for reading. It has no @main because
/// DataKeeperApp is this app's entry point, so iOS never creates it and its CloudKit
/// configuration never runs here.
struct TripsApp: App { // A second App type is allowed; only the one marked @main runs.
    let container: ModelContainer // The synced store.

    init() { // Runs only in an app that marks TripsApp with @main.
        let config = ModelConfiguration( // Describes the store...
            cloudKitDatabase: .private("iCloud.com.example.trips") // ...synced to this private database.
        )
        do { // Opening the store can fail.
            container = try ModelContainer(for: Trip.self, // The synced model.
                                           configurations: config) // With the CloudKit configuration.
        } catch { // For example, a model that breaks a sync rule.
            fatalError("Could not open the store: \(error)") // The app cannot work without its store.
        }
    }

    var body: some Scene { // One window.
        WindowGroup { TripListView() } // The list of trips.
            .modelContainer(container) // Shares the synced store.
    }
}

/// The list TripsApp shows: @Query results update when changes arrive from other devices.
struct TripListView: View { // Used by TripsApp and by lesson 6.8's simulated store.
    @Query(sort: \Trip.startDate) private var trips: [Trip] // Every trip, oldest first.

    var body: some View { // One row per trip.
        List(trips) { trip in // A scrolling list.
            Text("\(trip.name): \(trip.stops?.count ?? 0) stops") // stops is optional, as sync requires.
        }
    }
}

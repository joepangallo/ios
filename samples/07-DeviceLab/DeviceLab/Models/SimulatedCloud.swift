// SimulatedCloud.swift
// Who: lesson 7.4's simulated CloudKit console, key-value sync and backend chooser,
//      and their unit tests.
// What: an in-memory stand-in for CloudKit with two users (Ana and Ben), a private
//       database each, one public database, a signed-out state, an offline switch and
//       a full-storage switch; a two-device stand-in for iCloud key-value storage; and
//       the lesson's "CloudKit or your own backend?" advice as a function.
// Where: the Models folder; pure logic that never contacts iCloud.
// When: every time the student saves, queries, signs out, goes offline or syncs.
// Why: a free Personal Team cannot add the iCloud capability, so this simulation lets
//      every student see where records land and which CKError each mistake produces.

import Foundation // Basic types such as String, Array and Dictionary.
import CloudKit // CKRecord and CKError are plain values here; no container is ever created.

/// Who is using the simulated phone.
enum CloudUser: String, CaseIterable, Identifiable { // Raw values are the labels.
    case ana = "Ana" // The first user.
    case ben = "Ben" // The second user.
    case signedOut = "Signed out" // Nobody signed in to iCloud.
    var id: String { rawValue } // Unique.
}

/// The simulated CloudKit: where records land, and which errors come back.
struct SimulatedCloud { // A value type: tests replay steps on copies.
    var user = CloudUser.ana // Who is signed in.
    var isOnline = true // The network switch.
    var isStorageFull = false // Whether the signed-in user's iCloud storage is full.
    private(set) var privateRecords: [CloudUser: [CKRecord]] = [:] // One private database per user.
    private(set) var publicRecords: [CKRecord] = [] // The single public database.
    private(set) var log: [String] = [] // The request log, oldest first.

    /// Saves like GroceryStore.add(_:isShared:) and returns the CKError CloudKit would throw, or nil on success.
    @discardableResult // Callers may ignore the result.
    mutating func save(_ name: String, isShared: Bool) -> CKError? { // Same parameters as the course's add.
        let record = CKRecord(recordType: "GroceryItem") // Built exactly as the course builds it.
        record["name"] = name // The name field.
        record["quantity"] = 1 // The quantity field.
        let place = isShared ? "public" : "private" // For the log.
        if let error = saveError(isShared: isShared) { // CloudKit would refuse.
            log.append("save \"\(name)\" to \(place): CKError .\(Self.codeName(error.code))") // Record the failure.
            return error // The caller shows describe(error).
        }
        if isShared { // The public database.
            publicRecords.append(record) // Everyone can read it.
        } else { // The user's private database.
            privateRecords[user, default: []].append(record) // Only this user can read it.
        }
        log.append("save \"\(name)\" to \(user.rawValue)'s \(place) database: OK") // Record the success.
        return nil // No error.
    }

    /// Queries like loadItems(from:) and returns the items, or the CKError CloudKit would throw.
    mutating func query(isShared: Bool) -> Result<[GroceryItem], CKError> { // Result carries either outcome.
        let place = isShared ? "public" : "private" // For the log.
        if !isOnline { // No network, no query.
            log.append("query \(place): CKError .networkUnavailable") // Record the failure.
            return .failure(CKError(.networkUnavailable)) // The offline error.
        }
        if !isShared && user == .signedOut { // A private database needs an account.
            log.append("query private: CKError .notAuthenticated") // Record the failure.
            return .failure(CKError(.notAuthenticated)) // The signed-out error.
        }
        let records = isShared ? publicRecords : privateRecords[user] ?? [] // Public data needs no account.
        log.append("query \(place) as \(user.rawValue): \(records.count) records") // Record the success.
        return .success(records.map { GroceryItem(record: $0) }) // The course's conversion.
    }

    /// The error a save would produce right now, if any.
    func saveError(isShared: Bool) -> CKError? { // Checked in the order CloudKit meets them.
        if !isOnline { return CKError(.networkUnavailable) } // No network.
        if user == .signedOut { return CKError(.notAuthenticated) } // Writing anywhere needs an account.
        if !isShared && isStorageFull { return CKError(.quotaExceeded) } // Private data counts against the user's storage.
        return nil // The save would succeed.
    }

    /// Empties both databases and the log.
    mutating func reset() { // A fresh start.
        privateRecords = [:] // No private records.
        publicRecords = [] // No public records.
        log = [] // An empty log.
    }

    /// The Swift spelling of the codes this simulation and the error picker use.
    static func codeName(_ code: CKError.Code) -> String { // For log lines and pickers.
        switch code { // One name per code used in this app.
        case .notAuthenticated: "notAuthenticated" // Signed out.
        case .networkUnavailable: "networkUnavailable" // Offline.
        case .networkFailure: "networkFailure" // A dropped connection.
        case .quotaExceeded: "quotaExceeded" // Storage full.
        case .serverRecordChanged: "serverRecordChanged" // A conflict.
        case .serviceUnavailable: "serviceUnavailable" // The server is busy.
        case .unknownItem: "unknownItem" // Deleted on another device.
        default: "code \(code.rawValue)" // Anything else, by number.
        }
    }
}

/// The devices in the key-value sync demo.
enum SyncDevice: String, CaseIterable, Identifiable { // Raw values are the labels.
    case phone = "This iPhone" // Where the change is made.
    case tablet = "Your iPad" // Where it should arrive.
    var id: String { rawValue } // Unique.
}

/// A stand-in for NSUbiquitousKeyValueStore on two devices signed in to one account.
struct SimulatedKeyValueCloud { // A value type for easy testing.
    static let maxBytes = 1_048_576 // At most 1 MB per user.
    static let maxKeys = 1024 // At most 1,024 keys.

    /// One write waiting for iCloud to deliver it.
    struct PendingChange: Equatable { // Equatable for tests.
        let from: SyncDevice // Where it was written.
        let key: String // Which key.
        let value: String // The new value.
    }

    private(set) var values: [SyncDevice: [String: String]] = [:] // Each device's local copy.
    private(set) var pending: [PendingChange] = [] // Writes not yet delivered.
    private(set) var log: [String] = [] // What happened, oldest first.

    /// The course's sortOrder getter, on one device.
    func sortOrder(on device: SyncDevice) -> String { // Reads the local copy instantly.
        values[device]?["sortOrder"] ?? "aisle" // The default covers a brand-new user.
    }

    /// The course's sortOrder setter, on one device.
    mutating func setSortOrder(_ value: String, on device: SyncDevice) { // Writes locally first.
        values[device, default: [:]]["sortOrder"] = value // The local copy changes at once.
        pending.append(PendingChange(from: device, key: "sortOrder", value: value)) // iOS uploads it later.
        log.append("\(device.rawValue): sortOrder = \"\(value)\" (saved locally; iOS uploads it soon)") // Record the write.
    }

    /// iCloud delivers every pending write to the other devices.
    mutating func sync() { // Real iOS does this on its own, often within seconds.
        guard !pending.isEmpty else { log.append("Nothing to sync"); return } // No changes waiting.
        for change in pending { // Each write in order.
            for device in SyncDevice.allCases where device != change.from { // Every other device.
                values[device, default: [:]][change.key] = change.value // The value arrives.
                log.append("\(device.rawValue): didChangeExternallyNotification. Another device changed a setting.") // The course's print.
            }
        }
        pending = [] // Everything delivered.
    }

    /// Tries to store a value of a given size; key-value storage refuses anything over 1 MB.
    mutating func store(bytes: Int, forKey key: String, on device: SyncDevice) -> Bool { // Returns whether it was accepted.
        guard bytes <= Self.maxBytes else { // Too big for this store.
            log.append("\(device.rawValue): \(key) is \(bytes) bytes, over the 1 MB limit. Use CloudKit or a file instead.") // Explain why.
            return false // Rejected.
        }
        values[device, default: [:]][key] = "\(bytes) bytes" // A small value fits.
        log.append("\(device.rawValue): stored \(key), \(bytes) bytes") // Record it.
        return true // Accepted.
    }
}

/// The lesson's "CloudKit or your own backend?" advice.
enum StorageAdvisor { // A namespace for one pure function.
    /// Recommends a storage choice for the answers to three questions.
    static func recommend(crossPlatform: Bool, serverLogic: Bool, onlyPreferences: Bool) -> String { // Pure: easy to test.
        if crossPlatform || serverLogic { // Android, the web, payments, moderation...
            return "A third-party or custom backend, reached with URLSession." // Every platform can reach it.
        }
        if onlyPreferences { // A handful of settings.
            return "iCloud key-value storage (NSUbiquitousKeyValueStore)." // Small and simple.
        }
        return "CloudKit, or SwiftData with CloudKit sync." // Apple-only, personal data.
    }
}

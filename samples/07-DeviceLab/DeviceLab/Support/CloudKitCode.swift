// CloudKitCode.swift
// Who: students reading the real CloudKit code from lesson 7.4, and lesson 7.4's
//      screen, which runs the parts that never touch iCloud.
// What: the course's real CloudKit code: the account check, GroceryStore, the query
//       function, the error describer and the key-value settings class, plus the one
//       switch that turns the real code on.
// Where: the Support folder.
// When: describe(_:), GroceryItem(record:) and react(to:) run in simulated mode. Every
//       line that talks to iCloud (CKContainer, NSUbiquitousKeyValueStore) runs only
//       after CloudConfig.isEnabled is set to true.
// Why: CloudKit needs the iCloud capability, which needs a paid Apple Developer Program
//      membership. Without that entitlement, CKContainer.default() stops the app on the
//      spot, so this sample keeps the real code readable and switched off.

import Foundation // NSPredicate, NotificationCenter and NSUbiquitousKeyValueStore.
import CloudKit // CKContainer, CKRecord, CKQuery, CKError and CKAccountStatus.
import Observation // The @Observable macro.

/// The one switch for real iCloud. Leave it false unless you have added the iCloud
/// capability (with CloudKit and Key-value storage ticked) under Signing & Capabilities.
enum CloudConfig { // A namespace for one setting.
    static let isEnabled = false // False: lesson 7.4 runs in simulated mode and never calls CKContainer.
}

/// What the account check tells the person, as the course's simulation shows it.
struct CloudAdvice: Equatable { // Equatable for tests.
    let symbol: String // An SF Symbol for the phone panel.
    let title: String // The headline.
    let text: String // The explanation.
    let button: String? // A button label, when there is an action.
    let tone: PhonePanel.Tone // Green, orange, red or gray.
    let linesRun: Set<Int> // Lines of `CloudAccountChecker.listing` that ran.

    /// Before any check.
    static let waiting = CloudAdvice(symbol: "icloud", title: "Not checked yet", text: "Pick a status, or run the real check.", button: nil, tone: .neutral, linesRun: []) // The starting state.
}

/// The course's account check, as a class so the screen can show the result.
@Observable // The screen redraws when advice changes.
final class CloudAccountChecker { // One per screen.
    var advice = CloudAdvice.waiting // What to show.

    /// The course's code, exactly as the lesson shows it; positions match `linesRun`.
    static let listing = [ // Copied from the course.
        "import CloudKit", // 0
        "", // 1
        "func checkAccount() async throws {", // 2
        "    let container = CKContainer.default()", // 3
        "    let status = try await container.accountStatus()", // 4
        "    switch status {", // 5
        "    case .available:", // 6
        "        enableCloudFeatures()", // 7
        "    case .noAccount:", // 8
        "        showSignInHint()", // 9
        "    case .restricted:", // 10
        "        showRestrictedMessage()", // 11
        "    case .temporarilyUnavailable:", // 12
        "        showVerifyAccountHint()", // 13
        "    case .couldNotDetermine:", // 14
        "        showTryAgainLater()", // 15
        "    @unknown default:", // 16
        "        showTryAgainLater()", // 17
        "    }", // 18
        "}", // 19
    ]

    /// The real check. Calls CKContainer, so it may run only when CloudConfig.isEnabled is true.
    func checkAccount() async throws { // The course's function.
        let container = CKContainer.default() // The app's container, named in its entitlements.
        let status = try await container.accountStatus() // Asks iOS about the signed-in Apple Account.
        react(to: status) // The same switch simulated mode uses.
    }

    /// The course's switch, taking the status as a parameter so simulated mode and tests can feed any value.
    func react(to status: CKAccountStatus) { // One branch per account state.
        switch status { // The compiler checks that every state is handled.
        case .available: // Signed in and usable.
            enableCloudFeatures() // Turn sync on.
        case .noAccount: // Nobody is signed in.
            showSignInHint() // Data stays on this device.
        case .restricted: // Parental controls or management block iCloud.
            showRestrictedMessage() // Inform without nagging.
        case .temporarilyUnavailable: // Signed in, but the account needs attention.
            showVerifyAccountHint() // Point to Settings.
        case .couldNotDetermine: // The system could not find out.
            showTryAgainLater() // Retry; unknown is not signed out.
        @unknown default: // A future state.
            showTryAgainLater() // Keep data local and retry.
        }
    }

    private func enableCloudFeatures() { // The .available branch.
        advice = CloudAdvice(symbol: "icloud", title: "Synced with iCloud", text: "Your list appears on every device signed in to your Apple Account.", button: nil, tone: .ok, linesRun: [4, 6, 7]) // From the course's simulation.
    }
    private func showSignInHint() { // The .noAccount branch.
        advice = CloudAdvice(symbol: "person.circle", title: "Sign in to sync", text: "Your list is saved on this iPhone. Sign in to iCloud in Settings to see it on your other devices.", button: "Open Settings", tone: .warn, linesRun: [4, 8, 9]) // From the course's simulation.
    }
    private func showRestrictedMessage() { // The .restricted branch.
        advice = CloudAdvice(symbol: "lock", title: "iCloud is restricted", text: "A restriction on this device turns off iCloud. Your list stays on this iPhone.", button: nil, tone: .bad, linesRun: [4, 10, 11]) // From the course's simulation.
    }
    private func showVerifyAccountHint() { // The .temporarilyUnavailable branch.
        advice = CloudAdvice(symbol: "exclamationmark.triangle", title: "Check your Apple Account", text: "iCloud needs your attention. Open Settings and verify your account to resume syncing.", button: "Open Settings", tone: .warn, linesRun: [4, 12, 13]) // From the course's simulation.
    }
    private func showTryAgainLater() { // The .couldNotDetermine and @unknown default branches.
        advice = CloudAdvice(symbol: "clock", title: "Could not reach iCloud", text: "We will try again shortly. Your list is safe on this iPhone.", button: "Try Again", tone: .neutral, linesRun: [4, 14, 15]) // From the course's simulation.
    }
}

/// The course's grocery store. Creating one calls CKContainer.default(), so the screen
/// creates it only when CloudConfig.isEnabled is true.
@MainActor @Observable // Main-thread work; SwiftUI watches items.
final class GroceryStore { // Owns the list and talks to CloudKit.
    let container = CKContainer.default() // The doorway to the private and public databases.
    var items: [CKRecord] = [] // The records shown on screen.
    var lastMessage = "" // Added for this app: the message from the last failure.

    func add(_ name: String, isShared: Bool) async { // Saves one grocery item.
        let record = CKRecord(recordType: "GroceryItem") // A new, empty record with a fresh ID.
        record["name"] = name // The name field.
        record["quantity"] = 1 // The quantity field.
        let database = isShared // Choose where it goes...
            ? container.publicCloudDatabase // ...everyone can read it...
            : container.privateCloudDatabase // ...or only this user can.
        do { // Saving can fail.
            try await database.save(record) // Upload and wait for the server to confirm.
            items.append(record) // Only confirmed records appear.
        } catch let error as CKError { // A CloudKit failure.
            handle(error.code) // One central handler.
        } catch { print(error) } // Anything else.
    }

    /// The course's handler, "not shown" there: turn the code into a message.
    func handle(_ code: CKError.Code) { // Called from the CKError catch.
        lastMessage = describe(CKError(code)) // The same wording the whole app uses.
    }
}

/// The course's plain struct for one grocery item.
struct GroceryItem: Identifiable, Equatable { // Equatable for tests.
    let id: CKRecord.ID // The record's unique CloudKit ID.
    let name: String // The item's name.
    let quantity: Int // How many.
}

extension GroceryItem { // An extension keeps the memberwise initializer available.
    /// The course's conversion from a CKRecord, shared with simulated mode.
    init(record: CKRecord) { // Reads two untyped fields safely.
        self.init(id: record.recordID, // Keep the ID for later updates or deletes.
                  name: record["name"] as? String ?? "", // as? checks the type; "" when missing.
                  quantity: record["quantity"] as? Int ?? 1) // 1 for records saved before the field existed.
    }
}

/// The course's query function. It needs a real CKDatabase, which comes from a CKContainer.
func loadItems(from database: CKDatabase) async -> [GroceryItem] { // Private or public, the same code.
    let query = CKQuery(recordType: "GroceryItem", // Every record of this type...
        predicate: NSPredicate(value: true)) // ...that matches "true", which is all of them.
    do { // Queries can fail.
        let (results, _) = try await database // Wait for the matches; ignore the cursor.
            .records(matching: query) // Run the query on the server.
        let records = results.compactMap { try? $0.1.get() } // Keep the records that loaded.
        return records.map { record in // Convert each one...
            GroceryItem(record: record) // ...with the shared conversion above.
        }
    } catch { // Offline, busy, or a missing index.
        print("Query failed:", error) // Visible in Xcode's console.
        return [] // Callers always get an array.
    }
}

/// The course's error describer: one message per CloudKit error code.
func describe(_ error: CKError) -> String { // Called from every catch that handles CloudKit errors.
    switch error.code { // The code, not the text, drives the advice.
    case .notAuthenticated: // Signed out.
        return "Sign in to iCloud in Settings to sync." // The exact fix.
    case .networkUnavailable, .networkFailure: // Offline or a dropped connection.
        return "You are offline. We will sync later." // Reassure and retry.
    case .quotaExceeded: // The user's iCloud storage is full.
        return "Your iCloud storage is full." // Retrying would fail again.
    case .serverRecordChanged: // Another device saved first.
        return "Another device changed this item." // Merge, or ask.
    default: // Every other code.
        if let wait = error.retryAfterSeconds { // The server asked us to wait.
            return "iCloud is busy. Retry in \(Int(wait)) s." // Say when it will work.
        }
        return "Something went wrong. Try again." // The safe fallback.
    }
}

/// The course's synced setting. NSUbiquitousKeyValueStore needs the Key-value storage
/// checkbox under the iCloud capability, so the screen creates this only when enabled.
final class SettingsSync { // One owner for synced settings.
    private let store = NSUbiquitousKeyValueStore.default // The app's iCloud key-value store.

    var sortOrder: String { // Looks like an ordinary variable.
        get { store.string(forKey: "sortOrder") ?? "aisle" } // Instant local read, with a default.
        set { store.set(newValue, forKey: "sortOrder") } // Saved locally; iOS uploads later.
    }

    init() { // Listen early, then refresh.
        NotificationCenter.default.addObserver( // Register for a system announcement...
            forName: NSUbiquitousKeyValueStore // ...named...
                .didChangeExternallyNotification, // ..."changed on another device"...
            object: store, queue: .main // ...from this store, delivered on the main queue.
        ) { _ in // The details are not needed.
            print("Another device changed a setting.") // A real app would refresh its screen here.
        }
        store.synchronize() // One call at launch, as Apple recommends.
    }
}

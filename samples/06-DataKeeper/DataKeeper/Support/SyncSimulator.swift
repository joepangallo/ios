// SyncSimulator.swift
// Who: lesson 6.8's "Two devices, one list" card; the tests replay the course's scenarios.
// What: an iPhone and an iPad sharing one grocery list through a pretend iCloud server.
//       Edits made offline wait in an outbox; when a device reconnects it uploads them,
//       and a conflict policy decides what happens when two devices changed the same item.
// Where: the Support folder, plain Swift with no views and no networking at all.
// When: on every tap in the card, and when the student runs the conflict scenario.
// Why: sync is never instant, and arrival order, not typing order, decides what survives.

import Foundation // Basic types only.

/// One item on the shared list.
struct GroceryItem: Identifiable, Equatable { // Identifiable for ForEach, Equatable for tests.
    let id: Int // The same item has the same id on every device.
    var name: String // What to buy.
    var isDone: Bool // Checked off?
}

/// The two pretend devices.
enum SyncDevice: String, CaseIterable, Identifiable { // String raw values are the labels.
    case iPhone, iPad // One phone, one tablet.
    var id: String { rawValue } // Identifiable for ForEach.
}

/// What the server does when an upload is based on an outdated copy.
enum ConflictPolicy: String, CaseIterable, Identifiable { // String raw values are the picker labels.
    case lastWriterWins = "Last writer wins" // The later upload replaces the whole item.
    case fieldMerge = "Field merge" // Only the fields the later device changed are replaced.
    case keepBoth = "Keep both" // The later version is saved as a copy.
    var id: String { rawValue } // Identifiable for ForEach.
}

/// One change waiting to be uploaded.
struct PendingEdit: Equatable { // Equatable for tests.
    let itemID: Int // Which item.
    var snapshot: GroceryItem // The device's whole copy of the item after the edit.
    var changedName: Bool // Whether this device renamed it.
    var changedDone: Bool // Whether this device checked or unchecked it.
    let baseVersion: Int // The server version the device last saw; 0 for a new item.
}

/// What one device knows.
struct DeviceState: Equatable { // Equatable for tests.
    var items: [GroceryItem] // The device's local copy of the list.
    var knownVersions: [Int: Int] // The server version of each item, as last seen.
    var isOffline = false // Airplane mode.
    var outbox: [PendingEdit] = [] // Edits made while offline.
}

/// The whole pretend system: a server and two devices.
struct SyncSimulator { // A value type: Reset is just a new value.
    private(set) var server: [GroceryItem] // iCloud's copy of the list.
    private(set) var serverVersions: [Int: Int] // Each item's version on the server.
    private(set) var devices: [SyncDevice: DeviceState] // Each device's copy.
    private(set) var log = Transcript() // What happened, step by step.
    var policy: ConflictPolicy // How conflicts are resolved.
    private var nextID = 4 // The next new item's id.

    /// Starts with Milk, Eggs and Bread everywhere, all in sync.
    init(policy: ConflictPolicy = .lastWriterWins) { // Last writer wins unless told otherwise.
        let start = [GroceryItem(id: 1, name: "Milk", isDone: false), // The item the conflict is about.
                     GroceryItem(id: 2, name: "Eggs", isDone: false), // Another item.
                     GroceryItem(id: 3, name: "Bread", isDone: false)] // And another.
        let versions = [1: 1, 2: 1, 3: 1] // Every item is at version 1.
        server = start // The server has the list...
        serverVersions = versions // ...at version 1.
        devices = [.iPhone: DeviceState(items: start, knownVersions: versions), // So does the iPhone...
                   .iPad: DeviceState(items: start, knownVersions: versions)] // ...and the iPad.
        self.policy = policy // Remembers the policy.
        log.print("Milk, Eggs and Bread are in sync on both devices") // The starting point.
    }

    /// A device's copy of the list.
    func items(on device: SyncDevice) -> [GroceryItem] { devices[device]?.items ?? [] } // Empty if unknown.

    /// Whether a device is in airplane mode.
    func isOffline(_ device: SyncDevice) -> Bool { devices[device]?.isOffline ?? false } // false if unknown.

    /// How many edits a device has waiting.
    func pendingCount(on device: SyncDevice) -> Int { devices[device]?.outbox.count ?? 0 } // 0 if unknown.

    /// Adds a line to the log, for example a time stamp in a scenario.
    mutating func note(_ text: String) { log.print(text) } // Used by the scenario.

    /// Renames an item on one device.
    mutating func rename(_ itemID: Int, to name: String, on device: SyncDevice) { // A name change.
        edit(itemID, on: device, name: true, done: false, describe: "renamed it to \(name)") { $0.name = name } // Only the name changes.
    }

    /// Checks or unchecks an item on one device.
    mutating func toggleDone(_ itemID: Int, on device: SyncDevice) { // A checkmark change.
        edit(itemID, on: device, name: false, done: true, describe: "toggled its checkmark") { $0.isDone.toggle() } // Only isDone changes.
    }

    /// Adds a new item on one device.
    mutating func addItem(named name: String, on device: SyncDevice) { // A brand-new item.
        guard var state = devices[device] else { return } // The device must exist.
        let item = GroceryItem(id: nextID, name: name, isDone: false) // A new id no one else uses.
        nextID += 1 // The next one will differ.
        state.items.append(item) // Shows at once on this device.
        state.outbox.append(PendingEdit(itemID: item.id, snapshot: item, changedName: true, changedDone: false, baseVersion: 0)) // Version 0 marks it as new.
        devices[device] = state // Stores the change.
        log.print("\(device.rawValue)\(state.isOffline ? " (offline)" : ""): added \(name)") // Records it.
        if !state.isOffline { flush(device) } // Online: upload now.
    }

    /// Turns airplane mode on or off. Coming back online uploads the outbox.
    mutating func setOffline(_ offline: Bool, for device: SyncDevice) { // The airplane switch.
        devices[device]?.isOffline = offline // Stores the new state.
        log.print("\(device.rawValue) is now \(offline ? "offline" : "online")") // Records it.
        if !offline { flush(device); pullAll() } // Reconnecting: upload, then catch up.
    }

    /// Applies an edit locally and queues it, merging with an earlier queued edit of the same item.
    private mutating func edit(_ itemID: Int, on device: SyncDevice, name: Bool, done: Bool, describe: String, change: (inout GroceryItem) -> Void) { // The shared path for every edit.
        guard var state = devices[device], let index = state.items.firstIndex(where: { $0.id == itemID }) else { return } // Device and item must exist.
        let oldName = state.items[index].name // For the log.
        change(&state.items[index]) // The edit, on this device's copy.
        let snapshot = state.items[index] // The whole item after the edit.
        if let queued = state.outbox.firstIndex(where: { $0.itemID == itemID }) { // Already waiting to upload?
            state.outbox[queued].snapshot = snapshot // One combined edit...
            state.outbox[queued].changedName = state.outbox[queued].changedName || name // ...remembers every field...
            state.outbox[queued].changedDone = state.outbox[queued].changedDone || done // ...this device changed.
        } else { // The first edit of this item since the last upload.
            state.outbox.append(PendingEdit(itemID: itemID, snapshot: snapshot, changedName: name, changedDone: done, baseVersion: state.knownVersions[itemID] ?? 0)) // Remembers which version it was based on.
        }
        devices[device] = state // Stores the change.
        log.print("\(device.rawValue)\(state.isOffline ? " (offline)" : ""): \(oldName) \(describe)") // Records it.
        if !state.isOffline { flush(device) } // Online: upload now.
    }

    /// Uploads a device's outbox, then lets every online device catch up.
    private mutating func flush(_ device: SyncDevice) { // Only for online devices.
        guard let outbox = devices[device]?.outbox, !outbox.isEmpty else { return } // Nothing to send.
        for pending in outbox { upload(pending, from: device) } // Oldest first.
        devices[device]?.outbox = [] // Everything was sent.
        pullAll() // Every online device downloads the result.
    }

    /// Applies one upload on the server, using the policy when the upload is outdated.
    private mutating func upload(_ pending: PendingEdit, from device: SyncDevice) { // The server's decision.
        let who = device.rawValue // For the log.
        guard pending.baseVersion > 0, let index = server.firstIndex(where: { $0.id == pending.itemID }) else { // A new item, or one the server lost.
            server.append(pending.snapshot) // Stored as it is.
            serverVersions[pending.itemID] = 1 // Its first version.
            log.print("iCloud: stored \(pending.snapshot.name) from \(who)") // Records it.
            return // Done with this upload.
        }
        let current = serverVersions[pending.itemID] ?? 1 // The server's version now.
        if current == pending.baseVersion { // Nobody else changed it meanwhile: no conflict.
            if pending.changedName { server[index].name = pending.snapshot.name } // Applies the name change.
            if pending.changedDone { server[index].isDone = pending.snapshot.isDone } // Applies the checkmark change.
            serverVersions[pending.itemID] = current + 1 // A new version.
            log.print("iCloud: accepted \(who)'s change: \(Self.describe(server[index]))") // Records it.
            return // Done with this upload.
        }
        switch policy { // A conflict: the upload is based on an older version.
        case .lastWriterWins: // The whole record is replaced.
            server[index] = pending.snapshot // The later upload wins every field.
            log.print("iCloud: conflict, last writer wins: \(who)'s copy replaces it: \(Self.describe(server[index]))") // Records it.
        case .fieldMerge: // Only the fields this device changed.
            if pending.changedName { server[index].name = pending.snapshot.name } // This device's rename.
            if pending.changedDone { server[index].isDone = pending.snapshot.isDone } // This device's checkmark.
            log.print("iCloud: conflict, field merge: \(Self.describe(server[index]))") // Records it.
        case .keepBoth: // Nothing is overwritten.
            let copy = GroceryItem(id: nextID, name: pending.snapshot.name + " (from \(who))", isDone: pending.snapshot.isDone) // The late version, as a new item.
            nextID += 1 // The next id will differ.
            server.append(copy) // Both versions now exist.
            serverVersions[copy.id] = 1 // The copy's first version.
            log.print("iCloud: conflict, kept both: added \(copy.name)") // Records it.
        }
        serverVersions[pending.itemID] = current + 1 // The conflict produced a new version too.
    }

    /// Every online device copies the server's list.
    private mutating func pullAll() { // Offline devices keep their own copy.
        for device in SyncDevice.allCases where devices[device]?.isOffline == false { // Only online devices.
            devices[device]?.items = server // Downloads the list.
            devices[device]?.knownVersions = serverVersions // And the versions.
        }
    }

    /// An item as text: [x] Milk.
    static func describe(_ item: GroceryItem) -> String { // Used in the log and the tests.
        (item.isDone ? "[x] " : "[ ] ") + item.name // Checkbox and name.
    }

    /// The course's conflict scenario: both devices edit Milk offline; the iPad reconnects first.
    static func conflictScenario(policy: ConflictPolicy) -> SyncSimulator { // Returns the finished simulation.
        var sim = SyncSimulator(policy: policy) // A fresh list.
        sim.setOffline(true, for: .iPhone) // Both devices go offline.
        sim.setOffline(true, for: .iPad) // The iPad too.
        sim.note("9:01") // A time stamp.
        sim.rename(1, to: "Oat milk", on: .iPhone) // The iPhone renames Milk.
        sim.note("9:02") // A minute later...
        sim.rename(1, to: "Whole milk", on: .iPad) // ...the iPad renames it differently...
        sim.toggleDone(1, on: .iPad) // ...and checks it off.
        sim.setOffline(false, for: .iPad) // The iPad reconnects first.
        sim.setOffline(false, for: .iPhone) // Then the iPhone.
        return sim // The final state.
    }
}

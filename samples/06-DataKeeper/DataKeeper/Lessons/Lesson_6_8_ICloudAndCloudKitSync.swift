// Lesson_6_8_ICloudAndCloudKitSync.swift
// Who: the student, after tapping lesson 6.8 on the home screen.
// What: the ways into iCloud, CloudKit containers, databases and records, saving and
//       querying CKRecord values, the sync rules for SwiftData models, the SwiftData sync
//       configuration, two devices syncing one list, and resolving conflicts.
// Where: pushed from ContentView. The course's real CloudKit code is in
//        Support/CloudSync.swift; this screen runs it against a simulated database.
// When: every card runs in SIMULATED MODE, because a free Personal Team cannot add the
//       iCloud capability, and calling CKContainer without it ends the app.
// Why: cloud data is a copy that follows the user; local first, sync in the background.

import SwiftUI // Views and state.
import SwiftData // The trips container.
import CloudKit // CKRecord and CKError.

struct ICloudAndCloudKitSyncLesson: View { // The lesson 6.8 screen.
    let lesson: Lesson // Which lesson this page shows.
    @State private var database = DatabaseKind.privateDB // The database the second card describes.
    @State private var cloudDatabase = SimulatedCloudDatabase() // The stand-in for privateCloudDatabase.
    @State private var newTitle = "Pack the stove" // The title of the next record.
    @State private var storedRecords: [(title: String, isDone: Bool, id: CKRecord.ID)] = [] // What the simulated server holds.
    @State private var cloudLog = Transcript() // What the save and query calls did.
    @State private var busy = false // true while a pretend network call runs.
    @State private var design = ModelDesign.cannotSync // The sync-readiness toggles.
    @State private var tripsContainer: ModelContainer? // The trips store, made when the screen appears.
    @State private var simulator = SyncSimulator() // The two-device list.
    @State private var conflictLog = Transcript() // What the CKError demo printed.

    var body: some View { // Rebuilt whenever state changes.
        LessonPage(lesson: lesson) { // The shared page layout.
            Text(CloudMode.label) // Says plainly that nothing here reaches iCloud.
                .font(.caption.bold()) // Small but bold.
                .padding(8) // Room inside the badge.
                .frame(maxWidth: .infinity) // Full width.
                .background(Color.orange.opacity(0.2), in: .rect(cornerRadius: 8)) // An orange badge.

            DemoCard(title: "Data that follows the user", caption: "Four ways into iCloud, from tiny to large.") { // Course concept.
                Text("Key-value store: NSUbiquitousKeyValueStore, up to 1 MB of settings.\niCloud Documents: files in an iCloud folder.\nCloudKit: databases of records on Apple's servers.\nSwiftData sync: your models mirrored to CloudKit.") // The four ways.
                    .font(.footnote) // Small print.
                Text("What you need").font(.subheadline.bold()) // The course's callout.
                LabeledContent("Paid developer membership", value: "required") // A free Personal Team cannot add iCloud.
                LabeledContent("iCloud capability in this build", value: CloudMode.iCloudCapabilityAdded ? "yes" : "no") // The switch in CloudSync.swift.
                LabeledContent("iCloud account available", value: CloudMode.accountAvailable ? "yes" : "no") // Checked safely: no CKContainer involved.
                LabeledContent("Works when signed out", value: "yes") // Every demo below runs locally.
            }
            .font(.footnote) // Small print for the labeled lines.

            DemoCard(title: "CloudKit: containers, databases, records", caption: "A container such as iCloud.com.example.tasks holds three databases. A CKRecord is one stored item.") { // Course concept.
                Picker("Database", selection: $database) { // The three databases.
                    ForEach(DatabaseKind.allCases) { Text($0.rawValue).tag($0) } // One segment each.
                }
                .pickerStyle(.segmented) // Side by side.
                Text(database.explanation).font(.footnote) // Who can read and write it.
                Text("A real CKRecord, made on this device without any network:").font(.caption.bold()) // Introduces the record.
                ConsoleView(lines: RecordInspector.describe(RecordInspector.sample)) // Its type, ID and fields.
                Text("Local first: apps keep a local store and sync it, so they launch instantly and work offline.") // The course's callout.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // A note.
            }

            DemoCard(title: "Save and query records", caption: "The course's TaskCloud code, line for line, running against an in-memory stand-in for privateCloudDatabase, with a pretend network delay.") { // Course code step.
                HStack { // Title field and save button.
                    TextField("Title", text: $newTitle) // The next record's title.
                        .textFieldStyle(.roundedBorder) // A visible box.
                    Button("Save") { Task { await saveRecord() } } // add(title:).
                        .disabled(busy || newTitle.isEmpty) // One call at a time.
                }
                ForEach(storedRecords, id: \.id) { record in // Each stored record.
                    HStack { // Checkbox, title, button.
                        Text(verbatim: (record.isDone ? "[x] " : "[ ] ") + record.title).font(.caption.monospaced()) // isDone and title fields.
                        Spacer() // Pushes the button right.
                        if !record.isDone { Button("Done") { Task { await markDone(record.id) } }.font(.caption).disabled(busy) } // Saves isDone = true.
                    }
                }
                Button("Query open titles (isDone == 0)") { Task { await queryOpenTitles() } } // openTitles().
                    .buttonStyle(.bordered) // Secondary look.
                    .disabled(busy) // One call at a time.
                if busy { ProgressView("Waiting for the network...") } // Shows the async wait.
                ConsoleView(lines: cloudLog.lines) // Every call and result.
            }

            DemoCard(title: "Making a model sync-ready", caption: "Both versions compile, but only one opens as a synced store. Flip each rule and watch the problems list.") { // Course compare.
                HStack { // The two course versions.
                    Button("Cannot sync") { design = .cannotSync } // The left side.
                    Button("Sync-ready") { design = .syncReady } // The right side.
                }
                .buttonStyle(.bordered) // Secondary look.
                Toggle("@Attribute(.unique) on code", isOn: $design.codeIsUnique) // Rule 1.
                Toggle("Every property has a default", isOn: $design.propertiesHaveDefaults) // Rule 2.
                Toggle("stops is optional", isOn: $design.stopsIsOptional) // Rule 3.
                Toggle("inverse: \\Stop.trip", isOn: $design.hasInverse) // Rule 4.
                Picker("Delete rule", selection: $design.deleteRule) { // Rule 5.
                    ForEach(ModelDesign.Rule.allCases) { Text($0.rawValue).tag($0) } // Three rules.
                }
                .pickerStyle(.segmented) // Side by side.
                Text(verbatim: SyncReadiness.code(for: design)).font(.caption2.monospaced()) // The matching Swift.
                let problems = SyncReadiness.problems(in: design) // What would stop a synced store opening.
                if problems.isEmpty { // Every rule followed.
                    Label("Sync-ready: this model would open as a synced store.", systemImage: "checkmark.icloud").foregroundStyle(.green).font(.footnote) // Success.
                } else { // At least one rule broken.
                    ForEach(problems, id: \.self) { Label($0, systemImage: "xmark.icloud").foregroundStyle(.orange).font(.footnote) } // One line per problem.
                }
            }

            DemoCard(title: "Turn on SwiftData sync", caption: "With the capability, ModelConfiguration(cloudKitDatabase: .private(\"iCloud.com.example.trips\")) makes the store sync, and @Query updates when changes arrive. Here the same models run in a local in-memory store.") { // Course code step.
                Text(verbatim: CloudMode.iCloudCapabilityAdded ? "cloudKitDatabase: .private(\"\(TripsContainer.cloudContainerID)\")" : "cloudKitDatabase: .none (simulated, in memory)") // The configuration actually in use.
                    .font(.caption.monospaced()) // Fixed-width.
                Text("Also needed: Background Modes > Remote notifications, so the store hears about changes from other devices.") // The course's second requirement.
                    .font(.caption) // Small print.
                if let tripsContainer { // Once the store exists.
                    TripListView() // The course's list view.
                        .contentMargins(.vertical, 0, for: .scrollContent) // Removes the list's empty band above the first row.
                        .frame(height: 130) // A List needs a fixed height here.
                        .clipShape(.rect(cornerRadius: 12)) // Rounded to match the card.
                        .modelContainer(tripsContainer) // The trips store, not the app's main one.
                    Button("Add a trip with two stops") { addTrip(to: tripsContainer) } // Inserts sync-ready models.
                        .buttonStyle(.bordered) // Secondary look.
                }
            }

            DemoCard(title: "Two devices, one list", caption: "Tap an item to check it off. Turn on airplane mode, make edits, and watch them queue. Then run the conflict scenario under each policy.") { // Course widget.
                SyncSimulatorView(simulator: $simulator) // The two devices and the server.
            }

            DemoCard(title: "Conflicts and offline edits", caption: "Last writer wins, field-level merge, or keep both. In CloudKit code, saving an outdated record fails with CKError.serverRecordChanged, which carries the server's version.") { // Course concept.
                Button("Simulate serverRecordChanged and merge") { conflictLog = ConflictDemo.run() } // Builds the real error type, no network.
                    .buttonStyle(.bordered) // Secondary look.
                ConsoleView(lines: conflictLog.lines) // The steps.
                Text("SwiftData's automatic sync resolves conflicts for you. If losing a concurrent edit is unacceptable, use CloudKit directly so you control the merge.") // The course's callout.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // A note.
            }
        }
        .task { // Runs when the screen appears.
            if tripsContainer == nil { tripsContainer = try? TripsContainer.make() } // Simulated: in memory, never CloudKit.
            if let tripsContainer, ((try? tripsContainer.mainContext.fetchCount(FetchDescriptor<Trip>())) ?? 0) == 0 { addTrip(to: tripsContainer) } // One sample trip.
            if conflictLog.lines.isEmpty { conflictLog = ConflictDemo.run() } // Shows the merge once.
            if storedRecords.isEmpty { await saveRecord() } // Saves the first sample record, so the list is never empty.
        }
    }

    /// Calls add(title:) and then lists what the simulated server holds.
    private func saveRecord() async { // async: the save waits for the pretend network.
        busy = true // Disables the buttons.
        defer { busy = false } // Re-enables them however the function ends.
        do { // The save can throw.
            let id = try await SimulatedTaskCloud(database: cloudDatabase).add(title: newTitle) // The course's add(title:).
            cloudLog.print("add(title:) saved record", String(id.recordName.prefix(8)) + "...") // The new record's ID.
            refreshRecords() // Shows it in the list.
        } catch { // A real network could fail here.
            cloudLog.print("Save failed:", error.localizedDescription) // Reports it.
        }
    }

    /// Marks one record done and saves it again.
    private func markDone(_ id: CKRecord.ID) async { // async: waits for the pretend network.
        busy = true // Disables the buttons.
        defer { busy = false } // Re-enables them.
        try? await SimulatedTaskCloud(database: cloudDatabase).markDone(id) // Changes the field and saves.
        cloudLog.print("Saved isDone = true") // Records it.
        refreshRecords() // Updates the list.
    }

    /// Calls openTitles() and prints the result.
    private func queryOpenTitles() async { // async: waits for the pretend network.
        busy = true // Disables the buttons.
        defer { busy = false } // Re-enables them.
        do { // The query can throw.
            let titles = try await SimulatedTaskCloud(database: cloudDatabase).openTitles() // The course's openTitles().
            cloudLog.print("openTitles():", titles.isEmpty ? "[]" : titles.joined(separator: ", ")) // The matching titles.
        } catch { // A real network could fail here.
            cloudLog.print("Query failed:", error.localizedDescription) // Reports it.
        }
    }

    /// Copies the simulated server's records into the list on screen.
    private func refreshRecords() { // Called after every change.
        storedRecords = cloudDatabase.records.map { record in // One entry per stored record.
            ((record["title"] as? String) ?? "", (record["isDone"] as? Bool) ?? false, record.recordID) // Title, isDone and ID.
        }
    }

    /// Inserts a sample trip with two stops into the trips store.
    private func addTrip(to container: ModelContainer) { // Uses the store's main context.
        let context = container.mainContext // The trips store's context.
        let count = (try? context.fetchCount(FetchDescriptor<Trip>())) ?? 0 // For a unique name.
        let trip = Trip(code: "T\(count + 1)", name: "Lakeside loop \(count + 1)") // A sync-ready model.
        context.insert(trip) // Inserted before linking.
        for name in ["Trailhead", "Summit"] { // Two stops.
            let stop = Stop(name: name) // A sync-ready model.
            context.insert(stop) // Inserted before linking.
            stop.trip = trip // The inverse puts it in trip.stops.
        }
    }
}

/// The three CloudKit databases from the course.
enum DatabaseKind: String, CaseIterable, Identifiable { // String raw values are the picker labels.
    case publicDB = "Public", privateDB = "Private", sharedDB = "Shared" // The three databases.
    var id: String { rawValue } // Identifiable for ForEach.

    /// Who can read and write it.
    var explanation: String { // From the course.
        switch self { // One sentence per database.
        case .publicDB: "Shared by everyone who uses the app, such as a catalog of trails. Anyone can read it; writing requires an iCloud account." // Public.
        case .privateDB: "Visible only to the signed-in user: their notes, their tasks. Even you, the developer, cannot read it. It counts against the user's iCloud storage." // Private.
        case .sharedDB: "Records other users chose to share with this user, such as a family shopping list, through a CKShare." // Shared.
        }
    }
}

/// Builds and describes a sample CKRecord without touching any container.
enum RecordInspector { // A namespace for the helpers.
    /// A Task record like the ones TaskCloud saves.
    static let sample: CKRecord = { // Built once.
        let record = CKRecord(recordType: "Task") // A record type and a fresh unique ID.
        record["title"] = "Pack the tent" // A string field.
        record["isDone"] = false // A Bool field.
        return record // The finished record.
    }() // The parentheses run the closure once, right away.

    /// One line per fact about the record.
    static func describe(_ record: CKRecord) -> [String] { // For the console view.
        var lines = ["recordType: \(record.recordType)", // "Task".
                     "recordID: \(record.recordID.recordName.prefix(8))... in \(record.recordID.zoneID.zoneName)"] // A UUID in the default zone.
        for key in record.allKeys().sorted() { // Every field, A to Z.
            lines.append("\(key): \(record[key].map { "\($0)" } ?? "nil")") // Its value.
        }
        return lines // The description.
    }
}

/// The CKError.serverRecordChanged pattern, run without any network.
enum ConflictDemo { // A namespace for the demo.
    /// Builds the error CloudKit would send, reads the server's copy from it, merges, and prints each step.
    static func run() -> Transcript { // Returns the printed steps.
        var out = Transcript() // Collects the lines.
        let server = CKRecord(recordType: "Task") // The server's newer copy...
        server["title"] = "Milk" // ...still named Milk...
        server["isDone"] = true // ...but checked off on another device.
        let local = CKRecord(recordType: "Task", recordID: server.recordID) // This device's outdated copy of the same record.
        local["title"] = "Oat milk" // Renamed here.
        local["isDone"] = false // Unchecked here, because the change had not arrived.
        let error: any Error = CloudConflict.outdatedSaveError(server: server) // What database.save(local) would throw.
        out.print("save(local) threw CKError.serverRecordChanged") // Step 1.
        guard let serverCopy = CloudConflict.serverVersion(from: error) else { return out } // Step 2: the server's version rides on the error.
        out.print("Server has:", serverCopy["title"] as? String ?? "?", "isDone:", serverCopy["isDone"] as? Bool ?? false) // Its fields.
        let merged = CloudConflict.merge(changedFields: ["title"], from: local, into: serverCopy) // Step 3: keep our rename, keep their checkmark.
        out.print("Merged:", merged["title"] as? String ?? "?", "isDone:", merged["isDone"] as? Bool ?? false) // Oat milk, true.
        out.print("Next: save(merged) again") // A live app would save once more.
        return out // Every step.
    }
}

/// Draws the two devices, the server, and the controls.
struct SyncSimulatorView: View { // Edits the simulator through a binding.
    @Binding var simulator: SyncSimulator // Owned by the lesson screen.

    var body: some View { // Devices, server, controls, log.
        VStack(alignment: .leading, spacing: 10) { // Stacked sections.
            HStack(alignment: .top, spacing: 8) { // The two devices side by side.
                ForEach(SyncDevice.allCases) { device in // iPhone, then iPad.
                    DevicePanel(device: device, simulator: $simulator) // One device's list and switch.
                }
            }
            Text(verbatim: "iCloud: " + simulator.server.map(SyncSimulator.describe).joined(separator: ", ")) // The server's copy.
                .font(.caption2.monospaced()) // Small and fixed-width.
            Picker("Policy", selection: $simulator.policy) { // How conflicts are resolved.
                ForEach(ConflictPolicy.allCases) { Text($0.rawValue).tag($0) } // Three policies.
            }
            .pickerStyle(.segmented) // Side by side.
            HStack { // Scenario and reset.
                Button("Run the conflict scenario") { simulator = .conflictScenario(policy: simulator.policy) } // The course's scenario.
                    .buttonStyle(.borderedProminent) // The main action.
                Button("Reset") { simulator = SyncSimulator(policy: simulator.policy) } // Starts over.
                    .buttonStyle(.bordered) // Secondary look.
            }
            ConsoleView(lines: Array(simulator.log.lines.suffix(12))) // The latest steps.
        }
    }
}

/// One device in the simulator.
struct DevicePanel: View { // A column.
    let device: SyncDevice // Which device.
    @Binding var simulator: SyncSimulator // The shared simulator.

    var body: some View { // Name, switch, items, add button.
        VStack(alignment: .leading, spacing: 6) { // Stacked.
            Text(device.rawValue).font(.caption.bold()) // iPhone or iPad.
            Toggle("Airplane", isOn: Binding( // A binding built from the simulator's state.
                get: { simulator.isOffline(device) }, // Reads airplane mode.
                set: { simulator.setOffline($0, for: device) })) // Going online uploads the outbox.
                .font(.caption2) // Small, to fit the column.
            ForEach(simulator.items(on: device)) { item in // This device's copy of the list.
                Button(SyncSimulator.describe(item)) { simulator.toggleDone(item.id, on: device) } // Tap to check or uncheck.
                    .font(.caption2.monospaced()) // Small and fixed-width.
                    .buttonStyle(.plain) // Looks like text.
            }
            Text("Waiting to upload: \(simulator.pendingCount(on: device))").font(.caption2) // The outbox size.
            Button("Add item") { simulator.addItem(named: "Item \(simulator.items(on: device).count + 1)", on: device) } // A new item.
                .font(.caption2) // Small.
        }
        .padding(8) // Room inside the panel.
        .frame(maxWidth: .infinity, alignment: .leading) // Each device gets half the width.
        .background(.fill.tertiary, in: .rect(cornerRadius: 10)) // A soft panel.
    }
}

#Preview { // Shows this lesson in Xcode's canvas.
    NavigationStack { ICloudAndCloudKitSyncLesson(lesson: ContentView.lessons[7]) } // Inside a stack, so the title shows.
}

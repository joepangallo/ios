// Lesson_7_4_CloudKit.swift
// Who: students opening lesson 7.4 from the home screen.
// What: the iCloud account check, saving and querying grocery records in private and
//       public databases, signing out and going offline, CloudKit error messages,
//       key-value settings syncing between two devices, and the backend decision.
//       Everything runs in a clearly labeled simulated mode; the real code lives in
//       Support/CloudKitCode.swift and runs only when CloudConfig.isEnabled is true.
// Where: pushed by ContentView when the student taps "7.4".
// When: built when the lesson opens; nothing here contacts iCloud by default.
// Why: CloudKit needs a paid developer account's iCloud capability. The simulation
//      shows every behavior the lesson describes without that entitlement, and the
//      real code is one switch away for anyone who has it.

import SwiftUI // Views and state.
import CloudKit // CKAccountStatus and CKError values; no container is created in simulated mode.

struct CloudKitLesson: View { // The screen for lesson 7.4.
    let lesson: Lesson // The lesson row that opened this screen.
    @State private var checker = CloudAccountChecker() // The course's account check.
    @State private var pickedStatus = CKAccountStatus.available // The simulated account status.
    @State private var cloud = SimulatedCloud() // The simulated databases.
    @State private var itemName = "Trail mix" // What to save.
    @State private var shareWithEveryone = false // Only me (private) or Everyone (public).
    @State private var saveMessage = "" // The last save's result.
    @State private var queryPublic = false // Which database to query.
    @State private var queryMessage = "" // The last query's result.
    @State private var queriedItems: [GroceryItem] = [] // The last query's items.
    @State private var errorChoice = ErrorChoice.notAuthenticated // The error to describe.
    @State private var keyValues = SimulatedKeyValueCloud() // The simulated key-value store on two devices.
    @State private var phoneSort = "aisle" // The sort order picked on the iPhone.
    @State private var crossPlatform = false // Backend question 1.
    @State private var serverLogic = false // Backend question 2.
    @State private var onlyPreferences = false // Backend question 3.
    @State private var realStore: GroceryStore? // The real store; created only when real iCloud is enabled.

    var body: some View { // The whole lesson page.
        LessonPage(lesson: lesson) { // CourseKit's scrolling page.
            modeCard // Says plainly that this is a simulation.
            whyCard // Why apps keep data in the cloud.
            setupCard // Turn on CloudKit.
            accountCard // Check the iCloud account first.
            saveCard // Save a record.
            queryCard // Query records back.
            consoleCard // Private, public, signed out, offline.
            errorsCard // Handle CloudKit errors.
            keyValueCard // Sync small settings.
            backendCard // CloudKit or your own backend?
        }
    }

    // MARK: - Simulated mode

    private var modeCard: some View { // A clear label for the whole page.
        DemoCard(title: "Simulated mode", caption: "This sample has no iCloud entitlement, so nothing on this page talks to iCloud. The simulation follows CloudKit's rules; the real code is in Support/CloudKitCode.swift.") { // Not a course step: the honesty label.
            Label(CloudConfig.isEnabled ? "Real iCloud is ON (CloudConfig.isEnabled)" : "Real iCloud is OFF: CloudConfig.isEnabled is false", systemImage: CloudConfig.isEnabled ? "icloud" : "icloud.slash") // The switch's state.
                .font(.subheadline.weight(.semibold)) // Stands out.
            Text("With a paid Apple Developer Program team: add the iCloud capability with CloudKit and Key-value storage, then set CloudConfig.isEnabled to true. Calling CKContainer without the entitlement stops the app.") // How to switch it on, and why not otherwise.
                .font(.footnote) // Small print.
                .foregroundStyle(.secondary) // Quieter.
            if CloudConfig.isEnabled { // Only with the entitlement.
                realCloudControls // Buttons that run the real code.
            }
        }
    }

    /// Runs the course's real code; shown only when CloudConfig.isEnabled is true.
    private var realCloudControls: some View { // Never built in simulated mode.
        VStack(alignment: .leading) { // Buttons above the result.
            Button("Check my real iCloud account") { // The course's checkAccount().
                Task { try? await checker.checkAccount() } // Real CKContainer call.
            }
            Button("Save \"\(itemName)\" to my private database") { // The course's GroceryStore.add.
                let store = realStore ?? GroceryStore() // Create the real store on first use.
                realStore = store // Keep it.
                Task { await store.add(itemName, isShared: false) } // Real upload.
            }
            Text(verbatim: "Real records saved: \(realStore?.items.count ?? 0). \(realStore?.lastMessage ?? "")") // The real result.
                .font(.footnote) // Small print.
        }
        .buttonStyle(.bordered) // Secondary style for every button inside.
    }

    // MARK: - Why apps keep data in the cloud

    private var whyCard: some View { // The first concept step.
        DemoCard(title: "Why apps keep data in the cloud", caption: "Data saved with SwiftData or in files lives on one device. A cloud storage API keeps a copy on servers and syncs it between devices.") { // Course concept step.
            TermRow(term: "Container", text: "Your app's own space in iCloud, named like iCloud.com.example.groceries.") // Course term.
            TermRow(term: "Database", text: "Each container has three: private (one user's data), public (readable by every user) and shared (records a user shares with others).") // Course term.
            TermRow(term: "Record", text: "One entry, a CKRecord: a set of named fields plus a record type, such as GroceryItem.") // Course term.
            TermRow(term: "Record zone", text: "A group of records inside a database; custom zones add change tracking and sharing.") // Course term.
            TermRow(term: "Four choices", text: "iCloud key-value storage for a few settings, CloudKit for structured records, SwiftData with CloudKit sync to mirror your models, or a third-party backend for more than Apple devices.") // From the concept body.
        }
    }

    // MARK: - Turn on CloudKit

    private var setupCard: some View { // The setup concept step, as a checklist.
        DemoCard(title: "Turn on CloudKit", caption: "A one-time setup in Xcode. It requires a paid Apple Developer Program membership.") { // Course concept step.
            ForEach(Array(Self.setupSteps.enumerated()), id: \.offset) { index, step in // Numbered steps.
                Text(verbatim: "\(index + 1). \(step)") // For example "1. Select your app target."
                    .font(.subheadline) // Readable.
            }
            TermRow(term: "CloudKit Console", text: "A web dashboard where you browse records, edit the schema (record types and their fields) and add indexes.") // From the concept body.
            TermRow(term: "Development and production", text: "Development is for building and testing; production is for people who install from the App Store. Deploy the schema to production before you release.") // From the concept body.
            CalloutBox(title: "Who pays for the storage", text: "Records in a user's private database count against that user's iCloud storage, not yours. To test, sign in to an Apple Account in the Simulator's Settings app first.") // Course callout.
        }
    }

    /// The setup steps from the lesson.
    static let setupSteps = [ // In the order you click them.
        "Select your app target and open Signing & Capabilities.", // Step 1.
        "Click + Capability and add iCloud.", // Step 2.
        "Tick CloudKit and create a container, such as iCloud.com.example.groceries.", // Step 3.
        "Xcode adds an entitlement: a signed permission that lets the app reach that container.", // Step 4.
    ]

    // MARK: - Check the iCloud account first

    private var accountCard: some View { // The course's account check, with every status.
        DemoCard(title: "Check the iCloud account first", caption: "Pick what accountStatus() returns. The course's switch runs, and the phone shows that branch's message.") { // Course code step.
            MenuPicker(title: "accountStatus()", selection: $pickedStatus) { // The five account states.
                ForEach(Self.accountStatuses, id: \.self) { status in Text(verbatim: Self.statusName(status)).tag(status) } // One per state.
            }
            PhonePanel(symbol: checker.advice.symbol, title: checker.advice.title, text: checker.advice.text, tone: checker.advice.tone, button: checker.advice.button) // The branch's message.
            CodeListing(lines: CloudAccountChecker.listing, highlighted: checker.advice.linesRun) // The lines that ran.
        }
        .onChange(of: pickedStatus, initial: true) { _, status in // At first appearance and on every pick.
            checker.react(to: status) // The course's switch, fed the simulated status.
        }
    }

    /// The five states accountStatus() can return.
    static let accountStatuses: [CKAccountStatus] = [.available, .noAccount, .restricted, .temporarilyUnavailable, .couldNotDetermine] // In the course's order.

    /// The Swift spelling of an account status.
    static func statusName(_ status: CKAccountStatus) -> String { // For the picker.
        switch status { // One name per state.
        case .available: ".available" // Signed in.
        case .noAccount: ".noAccount" // Signed out.
        case .restricted: ".restricted" // Blocked.
        case .temporarilyUnavailable: ".temporarilyUnavailable" // Needs attention.
        case .couldNotDetermine: ".couldNotDetermine" // Unknown.
        @unknown default: "@unknown default" // Future states.
        }
    }

    // MARK: - Save a record

    private var saveCard: some View { // The course's save, simulated.
        DemoCard(title: "Save a record", caption: "Builds a real CKRecord exactly as GroceryStore.add does, then the simulation decides where it lands, or which CKError CloudKit would throw.") { // Course code step.
            Picker("User", selection: $cloud.user) { // Ana, Ben, or signed out.
                ForEach(CloudUser.allCases) { user in Text(verbatim: user.rawValue).tag(user) } // One per user.
            }
            .pickerStyle(.segmented) // Side by side.
            Toggle("Network on", isOn: $cloud.isOnline) // Go offline.
            Toggle("iCloud storage full", isOn: $cloud.isStorageFull) // The .quotaExceeded path.
            TextField("Item", text: $itemName) // What to save.
                .textFieldStyle(.roundedBorder) // A visible box.
            Picker("Who can see it", selection: $shareWithEveryone) { // isShared.
                Text("Only me").tag(false) // The private database.
                Text("Everyone").tag(true) // The public database.
            }
            .pickerStyle(.segmented) // Side by side.
            Button("Save", systemImage: "icloud.and.arrow.up") { // Runs the simulated save.
                if let error = cloud.save(itemName, isShared: shareWithEveryone) { // CloudKit would refuse.
                    saveMessage = "CKError .\(SimulatedCloud.codeName(error.code)): \(describe(error))" // The code and the course's message.
                } else { // It worked.
                    saveMessage = "Saved to \(shareWithEveryone ? "the public database" : "\(cloud.user.rawValue)'s private database")." // Where it went.
                }
            }
            .buttonStyle(.borderedProminent) // The card's main action.
            Text(verbatim: saveMessage.isEmpty ? "Nothing saved yet." : saveMessage) // The result.
                .font(.footnote) // Small print.
        }
    }

    // MARK: - Query records back

    private var queryCard: some View { // The course's query, simulated.
        DemoCard(title: "Query records back", caption: "A query asks one database for every GroceryItem. Each record becomes the course's GroceryItem struct.") { // Course code step.
            Picker("Database", selection: $queryPublic) { // Which database to read.
                Text("Private").tag(false) // The signed-in user's own.
                Text("Public").tag(true) // Everyone's.
            }
            .pickerStyle(.segmented) // Side by side.
            Button("Refresh", systemImage: "arrow.clockwise") { // Runs the simulated query.
                switch cloud.query(isShared: queryPublic) { // Success or a CKError.
                case .success(let items): // Records came back.
                    queriedItems = items // Show them.
                    queryMessage = "\(items.count) items for \(cloud.user.rawValue)." // A summary.
                case .failure(let error): // CloudKit refused.
                    queriedItems = [] // Nothing to show.
                    queryMessage = "CKError .\(SimulatedCloud.codeName(error.code)): \(describe(error))" // The code and the message.
                }
            }
            .buttonStyle(.borderedProminent) // The card's main action.
            Text(verbatim: queryMessage.isEmpty ? "No query yet." : queryMessage) // The result.
                .font(.footnote) // Small print.
            ForEach(queriedItems) { item in // One row per GroceryItem.
                Text(verbatim: "\(item.name), quantity \(item.quantity)") // The struct's fields.
                    .font(.subheadline) // Readable.
            }
        }
    }

    // MARK: - Private, public, signed out, offline

    private var consoleCard: some View { // The course's CloudKit console widget, rebuilt natively.
        DemoCard(title: "Private, public, signed out, offline", caption: "Save as Ana with Only me, then with Everyone. Switch to Ben: Ana's private item disappears, the public one stays. Sign out, then turn the network off.") { // Course widget step.
            databaseColumn("Ana's private", records: cloud.privateRecords[.ana] ?? []) // Ana's database.
            databaseColumn("Ben's private", records: cloud.privateRecords[.ben] ?? []) // Ben's database.
            databaseColumn("Public", records: cloud.publicRecords) // Everyone's.
            ConsoleView(lines: cloud.log) // The request log.
            Button("Empty every database") { cloud.reset() } // Start over.
                .buttonStyle(.bordered) // Secondary.
        }
    }

    /// One database's contents in one line.
    private func databaseColumn(_ name: String, records: [CKRecord]) -> some View { // Shared by the three databases.
        Text(verbatim: "\(name): \(records.isEmpty ? "empty" : records.compactMap { $0["name"] as? String }.joined(separator: ", "))") // Names, or "empty".
            .font(.subheadline) // Readable.
    }

    // MARK: - Handle CloudKit errors

    private var errorsCard: some View { // The course's describe(_:), on real CKError values.
        DemoCard(title: "Handle CloudKit errors", caption: "Pick an error code. The course's describe(_:) turns it into a message and a plan.") { // Course code step.
            MenuPicker(title: "CKError", selection: $errorChoice) { // The codes to try.
                ForEach(ErrorChoice.allCases) { choice in Text(verbatim: choice.rawValue).tag(choice) } // One per code.
            }
            Text(verbatim: describe(errorChoice.error)) // The message.
                .font(.headline) // Stands out.
            Text("Some errors carry retryAfterSeconds, the server's request to wait before trying again. .unknownItem has no case of its own, so it falls through to the generic message: the course's try-it asks you to add one.") // Explains the last two choices.
                .font(.footnote) // Small print.
                .foregroundStyle(.secondary) // Quieter.
        }
    }

    // MARK: - Sync small settings with iCloud key-value storage

    private var keyValueCard: some View { // NSUbiquitousKeyValueStore, simulated on two devices.
        DemoCard(title: "Sync small settings with iCloud key-value storage", caption: "Like UserDefaults, but values follow the user to every device: at most 1 MB and 1,024 keys. Change the sort order on the iPhone, then let iCloud sync.") { // Course code step.
            Picker("Sort order on this iPhone", selection: $phoneSort) { // The course's sortOrder setting.
                ForEach(["aisle", "name", "added"], id: \.self) { order in Text(verbatim: order).tag(order) } // Three orders.
            }
            .pickerStyle(.segmented) // Side by side.
            .onChange(of: phoneSort) { _, order in keyValues.setSortOrder(order, on: .phone) } // The setter runs on the iPhone.
            ForEach(SyncDevice.allCases) { device in // Both devices' local copies.
                Text(verbatim: "\(device.rawValue) reads sortOrder: \(keyValues.sortOrder(on: device))") // The getter on each device.
                    .font(.subheadline) // Readable.
            }
            HStack { // Two actions.
                Button("Let iCloud sync") { keyValues.sync() } // Deliver pending changes.
                    .buttonStyle(.borderedProminent) // Main action.
                Button("Save a 2 MB photo") { _ = keyValues.store(bytes: 2_000_000, forKey: "photo", on: .phone) } // The course's try-it: too big.
                    .buttonStyle(.bordered) // Secondary.
            }
            ConsoleView(lines: keyValues.log) // What happened.
        }
    }

    // MARK: - CloudKit or your own backend?

    private var backendCard: some View { // The decision concept step as three questions.
        DemoCard(title: "CloudKit or your own backend?", caption: "Answer three questions to see the lesson's advice.") { // Course concept step.
            Toggle("People also use Android or the web", isOn: $crossPlatform) // Cross-platform.
            Toggle("The server runs our own logic", isOn: $serverLogic) // Payments, moderation, jobs.
            Toggle("We only store a few preferences", isOn: $onlyPreferences) // Settings only.
            Label(StorageAdvisor.recommend(crossPlatform: crossPlatform, serverLogic: serverLogic, onlyPreferences: onlyPreferences), systemImage: "arrow.right.circle.fill") // The advice.
                .font(.headline) // Stands out.
            CalloutBox(title: "SwiftData can sync for you", text: "Create the model container with ModelConfiguration(cloudKitDatabase: .automatic). Every property must be optional or have a default, every relationship optional, and nothing marked unique.", symbol: "arrow.triangle.2.circlepath") // Course callout.
        }
    }
}

/// The CloudKit errors the describe demo offers.
enum ErrorChoice: String, CaseIterable, Identifiable { // Raw values are the labels.
    case notAuthenticated = ".notAuthenticated" // Signed out.
    case networkUnavailable = ".networkUnavailable" // Offline.
    case networkFailure = ".networkFailure" // Dropped connection.
    case quotaExceeded = ".quotaExceeded" // Storage full.
    case serverRecordChanged = ".serverRecordChanged" // Conflict.
    case busy = ".serviceUnavailable, retry after 30 s" // A wait time from the server.
    case unknownItem = ".unknownItem" // Deleted elsewhere.
    var id: String { rawValue } // Unique.

    /// A real CKError value for this choice; building one needs no container.
    var error: CKError { // Fed to describe(_:).
        switch self { // One error per choice.
        case .notAuthenticated: CKError(.notAuthenticated) // Signed out.
        case .networkUnavailable: CKError(.networkUnavailable) // Offline.
        case .networkFailure: CKError(.networkFailure) // Dropped.
        case .quotaExceeded: CKError(.quotaExceeded) // Full.
        case .serverRecordChanged: CKError(.serverRecordChanged) // Conflict.
        case .busy: CKError(.serviceUnavailable, userInfo: [CKErrorRetryAfterKey: 30.0]) // Wait 30 seconds; CloudKit stores the wait as a Double.
        case .unknownItem: CKError(.unknownItem) // Gone.
        }
    }
}

#Preview { // Shows the lesson in Xcode's canvas.
    NavigationStack { // Gives the page its title bar.
        CloudKitLesson(lesson: ContentView.lessons[3]) // Lesson 7.4.
    }
}

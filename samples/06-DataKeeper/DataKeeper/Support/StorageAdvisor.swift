// StorageAdvisor.swift
// Who: lesson 6.1's "Pick the right home for the data" card asks it for advice; the tests check it.
// What: describes a piece of data by its size, shape, sensitivity, audience and whether it
//       can be downloaded again, then recommends where to store it and which Swift API to use.
// Where: the Support folder. It is plain Swift with no views, so tests can call it directly.
// When: every time the student changes an answer or picks an example.
// Why: choosing a storage place is a short chain of questions; writing the chain down as
//      code makes the reasoning visible and testable.

import Foundation // Only basic types are needed.

/// The facts about a piece of data that decide where it belongs.
struct DataTraits: Equatable { // Equatable, so tests can compare whole sets of answers.
    enum Size: String, CaseIterable, Identifiable { // How big the data is.
        case tiny = "Tiny", medium = "A few MB", large = "Huge" // Short labels fit a segmented picker.
        var id: String { rawValue } // Identifiable for ForEach.
    }
    enum Shape: String, CaseIterable, Identifiable { // How the data is organized.
        case singleValue = "One value", document = "Document", records = "Records" // A number, a file, or many rows.
        var id: String { rawValue } // Identifiable for ForEach.
    }
    enum Audience: String, CaseIterable, Identifiable { // Who needs to see it.
        case thisDevice = "This device", allDevices = "My devices", otherPeople = "Others" // Local, synced, or shared.
        var id: String { rawValue } // Identifiable for ForEach.
    }

    var size: Size // How big.
    var shape: Shape // What shape.
    var isSecret: Bool // Would it let someone act as the user?
    var canRedownload: Bool // Could the app fetch it again at any time?
    var audience: Audience // Who needs it.
}

/// The places the advisor can recommend.
enum StorageHome: String, CaseIterable { // String raw values double as display names.
    case keychain = "The Keychain" // Secrets.
    case userDefaults = "UserDefaults" // Small settings.
    case documents = "A file in Documents" // User documents.
    case caches = "A file in Library/Caches" // Data the app can fetch again.
    case swiftData = "A SwiftData database" // Many records.
    case iCloudKeyValue = "The iCloud key-value store" // A few settings on every device.
    case swiftDataSync = "SwiftData with CloudKit sync" // Records on every device.
    case cloudKitShared = "A CloudKit shared or public database" // Records other people see.

    /// The Swift API you would reach for.
    var api: String { // Shown in a monospaced line under the recommendation.
        switch self { // One answer per place.
        case .keychain: "SecItemAdd / SecItemCopyMatching (lesson 6.7)" // The Security framework calls.
        case .userDefaults: "@AppStorage(\"key\") (lesson 6.2)" // The SwiftUI property wrapper.
        case .documents: "data.write(to: URL.documentsDirectory...) (lesson 6.4)" // A file write.
        case .caches: "data.write(to: URL.cachesDirectory...) (lesson 6.4)" // A file write somewhere purgeable.
        case .swiftData: "@Model, @Query, context.insert (lesson 6.5)" // The database tools.
        case .iCloudKeyValue: "NSUbiquitousKeyValueStore.default (lesson 6.8)" // The synced settings store.
        case .swiftDataSync: "ModelConfiguration(cloudKitDatabase: .private(...)) (lesson 6.8)" // Turning on sync.
        case .cloudKitShared: "CKShare or publicCloudDatabase (lesson 6.8)" // Sharing with other people.
        }
    }

    /// One sentence on why the place fits.
    var why: String { // Shown under the API line.
        switch self { // One answer per place.
        case .keychain: "Secrets need encryption that UserDefaults and files do not give you, and they must stay out of readable backups." // Security first.
        case .userDefaults: "One small, non-secret value is exactly what the preferences file is for." // Small and simple.
        case .documents: "The user made it and expects it in backups, and it is read and written as a whole." // User content.
        case .caches: "It can be fetched again, so it should not fill the user's backup; iOS may clear it when space runs low." // Re-downloadable.
        case .swiftData: "Many records need searching, sorting and changing one at a time, which a database does well." // Structured data.
        case .iCloudKeyValue: "A few small settings that should match on every device, up to 1 MB in total." // Synced settings.
        case .swiftDataSync: "Records the user wants on every device, kept locally first and synced in the background." // Synced records.
        case .cloudKitShared: "Other people must see it, so it has to live on a server they can reach." // Shared data.
        }
    }
}

/// The rules, in order: the first rule that matches decides.
enum StorageAdvisor { // A namespace; there is nothing to store.
    /// Recommends a home for data with these traits.
    static func recommend(for traits: DataTraits) -> StorageHome { // Pure: same answers, same advice.
        if traits.isSecret { return .keychain } // Secrets beat every other concern.
        if traits.audience == .otherPeople { return .cloudKitShared } // Other people need a server.
        if traits.audience == .allDevices { // The user's own devices need sync.
            let small = traits.shape == .singleValue && traits.size == .tiny // A setting, not a collection.
            return small ? .iCloudKeyValue : .swiftDataSync // Tiny settings sync as key-value pairs; the rest as records.
        }
        if traits.canRedownload { return .caches } // Fetchable again: keep it out of backups.
        if traits.shape == .singleValue && traits.size == .tiny { return .userDefaults } // A small preference.
        if traits.shape == .records { return .swiftData } // Many records.
        return .documents // Whole documents and large single values.
    }

    /// Lists every single answer that, changed on its own, would give a different home.
    static func whatWouldChange(_ traits: DataTraits) -> [String] { // Shown as "What would change the answer?".
        let current = recommend(for: traits) // The advice as things stand.
        var changes: [String] = [] // Collects one line per answer that matters.
        for size in DataTraits.Size.allCases where size != traits.size { // Try each other size.
            var other = traits; other.size = size // A copy with only the size changed.
            let home = recommend(for: other) // What the advice would be then.
            if home != current { changes.append("If it were \(size.rawValue.lowercased()): \(home.rawValue)") } // Only real changes are listed.
        }
        for shape in DataTraits.Shape.allCases where shape != traits.shape { // Try each other shape.
            var other = traits; other.shape = shape // A copy with only the shape changed.
            let home = recommend(for: other) // The advice for that copy.
            if home != current { changes.append("If it were \(shape.rawValue.lowercased()): \(home.rawValue)") } // Only real changes.
        }
        for audience in DataTraits.Audience.allCases where audience != traits.audience { // Try each other audience.
            var other = traits; other.audience = audience // A copy with only the audience changed.
            let home = recommend(for: other) // The advice for that copy.
            if home != current { changes.append("If \(audience.rawValue.lowercased()) needed it: \(home.rawValue)") } // Only real changes.
        }
        var flippedSecret = traits; flippedSecret.isSecret.toggle() // A copy with the secret answer flipped.
        let secretHome = recommend(for: flippedSecret) // The advice for that copy.
        if secretHome != current { changes.append("If it were \(traits.isSecret ? "not secret" : "secret"): \(secretHome.rawValue)") } // Only when it matters.
        var flippedFetch = traits; flippedFetch.canRedownload.toggle() // A copy with the download answer flipped.
        let fetchHome = recommend(for: flippedFetch) // The advice for that copy.
        if fetchHome != current { changes.append("If it \(traits.canRedownload ? "could not" : "could") be downloaded again: \(fetchHome.rawValue)") } // Only when it matters.
        return changes // In question order.
    }
}

/// The ready-made examples in the picker, including the course's login token and recipes.
enum StorageExample: String, CaseIterable, Identifiable { // String raw values are the picker labels.
    case loginToken = "Login token" // A secret.
    case recipes = "10,000 recipes" // Many records.
    case darkMode = "Dark mode on or off" // A setting.
    case mapTiles = "300 MB of map tiles" // Re-downloadable bulk data.
    case drawing = "A drawing the user made" // A document.
    case sharedList = "A family shopping list" // Shared with other people.
    var id: String { rawValue } // Identifiable for ForEach.

    /// The answers that describe this example.
    var traits: DataTraits { // Each example fills in every question.
        switch self { // One description per example.
        case .loginToken: DataTraits(size: .tiny, shape: .singleValue, isSecret: true, canRedownload: false, audience: .thisDevice) // Small but secret.
        case .recipes: DataTraits(size: .medium, shape: .records, isSecret: false, canRedownload: false, audience: .thisDevice) // Many rows.
        case .darkMode: DataTraits(size: .tiny, shape: .singleValue, isSecret: false, canRedownload: false, audience: .thisDevice) // One Bool.
        case .mapTiles: DataTraits(size: .large, shape: .document, isSecret: false, canRedownload: true, audience: .thisDevice) // Big and fetchable.
        case .drawing: DataTraits(size: .medium, shape: .document, isSecret: false, canRedownload: false, audience: .thisDevice) // A user document.
        case .sharedList: DataTraits(size: .tiny, shape: .records, isSecret: false, canRedownload: false, audience: .otherPeople) // Other people edit it.
        }
    }
}

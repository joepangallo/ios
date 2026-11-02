// Lesson62Tests.swift
// Who: the Swift Testing runner.
// What: checks lesson 6.2's logic: the UserDefaults API snippet's exact output, the theme
//       mappings, the text size rule and the "does it belong in UserDefaults?" verdicts.
// Where: the DataKeeperTests target. UserDefaults tests use their own uniquely named suite.
// When: whenever tests run.
// Why: the values the snippet reads are exactly what the course explains.

import Foundation // UserDefaults and UUID.
import SwiftUI // Color and ColorScheme.
import Testing // @Test and #expect.
@testable import DataKeeper // The app's internal types.

@MainActor // The app's types are main-actor isolated.
struct UserDefaultsAPITests { // The course's snippet.
    @Test func snippetPrintsTheCoursesValues() { // Every value the course names.
        let name = "DataKeeperTests.api.\(UUID().uuidString)" // A suite no other test uses.
        let defaults = UserDefaultsAPIDemo.freshDefaults(named: name) // Empty to start.
        defer { defaults.removePersistentDomain(forName: name) } // Cleaned up afterwards.
        let out = UserDefaultsAPIDemo.run(on: defaults) // Runs the snippet.
        #expect(out.lines == ["finished: true", "launches: 3", "name: Riley", "unknown: 0", "size: 17.0", "name after removeObject: Guest"]) // Exactly.
    }

    @Test func removingFirstGivesGuest() { // The course's first Try It.
        let name = "DataKeeperTests.api.\(UUID().uuidString)" // A unique suite.
        let defaults = UserDefaultsAPIDemo.freshDefaults(named: name) // Empty to start.
        defer { defaults.removePersistentDomain(forName: name) } // Cleaned up afterwards.
        let out = UserDefaultsAPIDemo.run(on: defaults, removeBeforeReading: true) // Remove before reading.
        #expect(out.lines[2] == "name: Guest") // The fallback appears.
    }

    @Test func freshDefaultsStartEmpty() { // removePersistentDomain really empties the suite.
        let name = "DataKeeperTests.api.\(UUID().uuidString)" // A unique suite.
        let first = UserDefaultsAPIDemo.freshDefaults(named: name) // Empty.
        first.set("old", forKey: "username") // Write something.
        let second = UserDefaultsAPIDemo.freshDefaults(named: name) // Emptied again.
        defer { second.removePersistentDomain(forName: name) } // Cleaned up afterwards.
        #expect(second.string(forKey: "username") == nil) // Nothing left.
    }
}

@MainActor // The app's types are main-actor isolated.
struct ThemeTests { // Appearance and accent.
    @Test func appearanceChoices() { // Stored strings to color schemes.
        #expect(ThemeChoice.from("dark").colorScheme == .dark) // Forced dark.
        #expect(ThemeChoice.from("light").colorScheme == .light) // Forced light.
        #expect(ThemeChoice.from("system").colorScheme == nil) // Follows the phone.
        #expect(ThemeChoice.from("purple") == .system) // Unknown text falls back safely.
        #expect(ThemeChoice.allCases.map(\.title) == ["System", "Light", "Dark"]) // Picker labels.
    }

    @Test func accentPalette() { // The course's dictionary.
        #expect(AccentPalette.color(named: "green") == .green) // A known name.
        #expect(AccentPalette.color(named: "pink") == .pink) // Another.
        #expect(AccentPalette.color(named: "orange") == .blue) // Unknown names fall back to blue.
        #expect(AccentPalette.tints.count == 3) // Blue, green, pink.
    }

    @Test func settingsKeysAreUnique() { // A typo would create a second setting.
        #expect(Set(SettingsKey.all).count == SettingsKey.all.count) // No duplicates.
        #expect(SettingsKey.accentName == "accentName" && SettingsKey.hasFinishedOnboarding == "hasFinishedOnboarding") // The course's key names.
    }
}

@MainActor // The app's types are main-actor isolated.
struct DefaultsRulesTests { // Validation and the quick test.
    @Test func textSizeIsClamped() { // The stepper's range.
        #expect(TextSizeRule.clamped(40) == 28) // Too big.
        #expect(TextSizeRule.clamped(5) == 12) // Too small.
        #expect(TextSizeRule.clamped(17) == 17) // Fine as it is.
    }

    @Test func verdicts() { // Each candidate's verdict.
        #expect(DefaultsCheck.verdict(for: .accessToken) == .secret) // Keychain.
        #expect(DefaultsCheck.verdict(for: .profilePhoto) == .largeData) // Files.
        #expect(DefaultsCheck.verdict(for: .recipes) == .userContent) // SwiftData or files.
        #expect(DefaultsCheck.verdict(for: .selectedTab) == .goodFit) // A preference.
        #expect(DefaultsCheck.verdict(for: .textSize) == .goodFit) // A preference.
        #expect(DefaultsCheck.verdict(for: .onboarding) == .goodFit) // A flag.
    }

    @Test func verdictMessagesNameTheRightPlace() { // The sentences on screen.
        #expect(DefaultsVerdict.secret.message.contains("Keychain")) // Secrets.
        #expect(DefaultsVerdict.largeData.message.contains("files")) // Large data.
        #expect(DefaultsVerdict.userContent.message.contains("SwiftData")) // User content.
        #expect(DefaultsVerdict.goodFit.message.contains("@AppStorage")) // Settings.
    }
}

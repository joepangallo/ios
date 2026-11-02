// ReleaseTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: tests for lesson 9.6: the version text and build configuration, the
//       privacy manifest shipped in the app bundle, version comparison, the
//       upload rules, the phased-release schedule and the pipeline lab.
// Where: the StudyBuddyTests target. Tests run inside the app (the test host),
//        so Bundle.main is the real app bundle.
// When: on every test run.
// Why: a missing or wrong privacy manifest gets an upload rejected; this suite
//      fails first, on your machine.

import Foundation // Foundation provides Data and URL.
import Testing // Swift Testing: @Suite, @Test, #expect and #require.
@testable import StudyBuddy // Lets the tests see the app's internal types.

@MainActor // AppInfo is a main-actor type in this app.
@Suite("Version and configuration") // The code step.
struct VersionTests { // A fresh instance per test.
    @Test("Version text combines version and build") // From any Info.plist dictionary.
    func versionText() { // The course's example numbers.
        #expect(AppInfo.versionText(from: ["CFBundleShortVersionString": "1.2.1", "CFBundleVersion": "42"]) == "Version 1.2.1 (42)") // Both present.
        #expect(AppInfo.versionText(from: nil) == "Version ? (?)") // Missing keys show "?".
    }

    @Test("This build is 1.0 (1)") // MARKETING_VERSION and CURRENT_PROJECT_VERSION of this project.
    func thisBuild() { // Read from the real bundle.
        #expect(AppInfo.version == "Version 1.0 (1)") // Set by the project's build settings.
        #expect(AppInfo.bundleIdentifier == "com.example.StudyBuddy") // The bundle ID.
    }

    @Test("Tests run the Debug configuration and its staging server") // #if DEBUG.
    func debugConfiguration() { // Command-U builds Debug.
        #expect(AppInfo.configuration == "Debug") // The DEBUG flag is set.
        #expect(AppInfo.apiBase.host() == "staging.example.com") // So the staging branch was compiled.
    }
}

@MainActor // PrivacyManifest is a main-actor type in this app.
@Suite("Privacy manifest") // The manifest step.
struct PrivacyManifestTests { // A fresh instance per test.
    @Test("The manifest ships and matches what the app does") // Read from the app bundle.
    func shipped() throws { // try: #require can throw.
        let manifest = try #require(PrivacyManifest.shipped()) // Missing means it is not in the target.
        #expect(manifest.tracking == false) // No tracking.
        #expect(manifest.collectedDataTypes == 0) // Nothing leaves the device.
        #expect(manifest.accessedAPIs == [.init(category: "NSPrivacyAccessedAPICategoryUserDefaults", reasons: ["CA92.1"])]) // Only UserDefaults, for this app.
    }

    @Test("Parsing reads every field") // The reader on its own.
    func parse() throws { // try: parse can throw.
        let xml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <plist version="1.0"><dict>
        <key>NSPrivacyTracking</key><true/>
        <key>NSPrivacyCollectedDataTypes</key><array><dict/><dict/></array>
        <key>NSPrivacyAccessedAPITypes</key><array><dict>
        <key>NSPrivacyAccessedAPIType</key><string>NSPrivacyAccessedAPICategoryDiskSpace</string>
        <key>NSPrivacyAccessedAPITypeReasons</key><array><string>E174.1</string></array>
        </dict></array>
        </dict></plist>
        """ // A small manifest written in the test.
        let manifest = try PrivacyManifest.parse(Data(xml.utf8)) // Act.
        #expect(manifest.tracking) // true.
        #expect(manifest.collectedDataTypes == 2) // Two entries.
        #expect(manifest.accessedAPIs.first?.reasons == ["E174.1"]) // The reason code.
    }

    @Test("Bytes that are not a property list throw") // The reader's failure path.
    func invalid() { // Not XML at all.
        #expect(throws: (any Error).self) { try PrivacyManifest.parse(Data("hello".utf8)) } // It throws.
    }

    @Test("Short names drop the long prefix") // Display helper.
    func shortName() { // One category.
        #expect(PrivacyManifest.shortName("NSPrivacyAccessedAPICategoryUserDefaults") == "UserDefaults") // Readable.
    }
}

@Suite("App versions") // Version comparison.
struct AppVersionTests { // A fresh instance per test.
    @Test("Ordering", arguments: [ // Lower, higher.
        ("1.2", "1.2.1"), ("1.1", "1.2"), ("1.9", "1.10"), ("1.2.1", "2.0"), // Each pair is in order.
    ])
    func ordering(lower: String, higher: String) { // One case per pair.
        #expect(AppVersion(lower) < AppVersion(higher)) // Strictly lower.
    }

    @Test("Missing parts count as zero") // 1.2 and 1.2.0 are the same version.
    func trailingZero() { // Equality.
        #expect(AppVersion("1.2") == AppVersion("1.2.0")) // Equal.
    }
}

@Suite("Upload rules") // The course's quiz question, as code.
struct UploadRuleTests { // A fresh instance per test.
    @Test("1.2.1 (42) is accepted after 1.2 (41)") // The right answer.
    func accepted() { // A new release.
        #expect(UploadRule.problem(liveVersion: "1.2", liveBuild: 41, version: "1.2.1", build: 42) == nil) // No problem.
    }

    @Test("Every wrong answer has a reason", arguments: [("1.2", 41), ("1.1", 42), ("1.2.0", 42), ("1.3", 40)]) // The quiz's wrong answers and more.
    func rejected(version: String, build: Int) { // One case per candidate.
        #expect(UploadRule.problem(liveVersion: "1.2", liveBuild: 41, version: version, build: build) != nil) // A reason is given.
    }
}

@Suite("Phased release") // The seven-day rollout.
struct PhasedReleaseTests { // A fresh instance per test.
    @Test("Percentages per day", arguments: zip(1...7, [1, 2, 5, 10, 20, 50, 100])) // Day and percentage.
    func schedule(day: Int, percent: Int) { // One case per day.
        #expect(PhasedRelease.percentage(onDay: day) == percent) // The published schedule.
    }

    @Test("Days outside the week are clamped") // Defensive.
    func clamped() { // Before and after.
        #expect(PhasedRelease.percentage(onDay: 0) == 1) // Before day 1.
        #expect(PhasedRelease.percentage(onDay: 9) == 100) // After day 7.
    }
}

@Suite("Release pipeline lab") // The widget.
struct PipelineTests { // A fresh instance per test.
    @Test("Seven stages, each with exactly one right answer") // A fair quiz.
    func stages() { // Every stage.
        #expect(ReleaseStage.pipeline.count == 7) // Identity to release.
        for stage in ReleaseStage.pipeline { // One stage at a time.
            #expect(stage.choices.filter(\.correct).count == 1, "\(stage.name) needs one right answer") // Exactly one.
            #expect(stage.choices.allSatisfy { !$0.outcome.isEmpty }) // Every choice explains its outcome.
        }
    }
}

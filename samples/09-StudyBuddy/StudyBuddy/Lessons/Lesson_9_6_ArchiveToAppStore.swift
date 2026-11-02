// Lesson_9_6_ArchiveToAppStore.swift
// Who: a student who opens lesson 9.6 from the home screen.
// What: one card per course step of "From Archive to App Store": this build's
//       identity, its version, build number and configuration, an upload
//       checker, the privacy manifest read back from the app bundle and compared
//       with what the app does, TestFlight and App Review, a phased release you
//       can step through, and the release pipeline lab.
// Where: pushed by ContentView when the 9.6 row is tapped (or launched with -lesson 9.6).
// When: built when the screen appears and rebuilt whenever a control changes.
// Why: release steps are usually invisible until something is rejected. Reading
//      the real values from this build makes each step concrete.

import SwiftUI // SwiftUI provides View, @State and the controls used below.

// MARK: - Logic (tested in StudyBuddyTests/ReleaseTests.swift)

/// A marketing version such as 1.2.1, compared number by number.
nonisolated struct AppVersion: Comparable, Sendable { // Comparable gives <, >, == and friends.
    let parts: [Int] // [1, 2, 1] for "1.2.1".

    /// Parses "1.2.1"; anything that is not a number counts as 0.
    init(_ text: String) { // Version strings come from Info.plist or a picker.
        parts = text.split(separator: ".").map { Int($0) ?? 0 } // Split on dots, convert each piece.
    }

    /// Compares two versions; missing parts count as zero, so 1.2 equals 1.2.0.
    static func < (lhs: AppVersion, rhs: AppVersion) -> Bool { // Required by Comparable.
        for index in 0..<max(lhs.parts.count, rhs.parts.count) { // Walk the longer of the two.
            let left = lhs.parts[safe: index] ?? 0 // Missing means 0.
            let right = rhs.parts[safe: index] ?? 0 // Missing means 0.
            if left != right { return left < right } // The first difference decides.
        }
        return false // Every part equal: not less.
    }

    /// Equal when every part matches, treating missing parts as zero.
    static func == (lhs: AppVersion, rhs: AppVersion) -> Bool { // Required by Equatable.
        !(lhs < rhs) && !(rhs < lhs) // Neither is smaller.
    }
}

/// App Store Connect's version and build rules for an update.
nonisolated enum UploadRule { // A namespace for one function.
    /// Returns nil when the upload is accepted as a new release, or the reason it is not.
    static func problem(liveVersion: String, liveBuild: Int, version: String, build: Int) -> String? { // Live is what users have now.
        if AppVersion(version) < AppVersion(liveVersion) { // Going backwards.
            return "\(version) is lower than the live version \(liveVersion)." // Rejected.
        }
        if AppVersion(version) == AppVersion(liveVersion) { // Same version as live.
            return build == liveBuild // Exactly the live upload again?
                ? "\(version) (\(build)) was already uploaded. Every upload needs a new build number." // Rejected at upload.
                : "\(version) is the version already live, so this is not a new release. Use a higher version such as 1.2.1." // Not a release.
        }
        if build <= liveBuild { // A version bump with a build number already used.
            return "Build \(build) is not higher than \(liveBuild). Raise it with every upload." // A safe habit.
        }
        return nil // Higher version, new build: accepted.
    }
}

/// A phased release: the share of automatic-update users on each of seven days.
nonisolated enum PhasedRelease { // A namespace for the schedule.
    static let percentages = [1, 2, 5, 10, 20, 50, 100] // Day 1 to day 7.

    /// The percentage on a day, clamped to the seven-day schedule.
    static func percentage(onDay day: Int) -> Int { // Day 1 is 1%.
        percentages[min(max(day, 1), 7) - 1] // Days before 1 count as 1; after 7 as 7.
    }
}

/// One stage of the release pipeline lab: a decision with one right answer.
nonisolated struct ReleaseStage: Identifiable, Sendable { // One row of the lab.
    /// One possible answer and what really happens if you choose it.
    struct Choice: Sendable { // A nested type.
        let text: String // The answer.
        let correct: Bool // Whether it moves the release forward.
        let outcome: String // What happens in real life.
    }

    let id: Int // The stage's position.
    let name: String // Identity, Version, Privacy and so on.
    let question: String // The decision to make.
    let choices: [Choice] // Two or three answers.
    let skipped: String // What breaks if this stage is skipped.

    /// The pipeline for shipping Study Buddy 1.2.1.
    static let pipeline = [ // In release order.
        ReleaseStage(id: 0, name: "Identity", question: "Which bundle ID does the first upload use?", choices: [ // Stage 1.
            Choice(text: "com.example.StudyBuddy", correct: true, outcome: "Accepted. It is fixed for this app record from now on."), // Right.
            Choice(text: "com.example.StudyBuddyTemp2", correct: false, outcome: "It uploads, but the temporary name can never change for this app record."), // Wrong.
        ], skipped: "Without a team and bundle ID, Xcode cannot sign the build at all."), // What breaks if this stage is skipped.
        ReleaseStage(id: 1, name: "Version", question: "1.2 (41) is live. Which version and build fix a crash?", choices: [ // Stage 2.
            Choice(text: "1.2 (41)", correct: false, outcome: UploadRule.problem(liveVersion: "1.2", liveBuild: 41, version: "1.2", build: 41) ?? ""), // Wrong.
            Choice(text: "1.2.1 (42)", correct: true, outcome: "Accepted: a higher version and a new build number."), // Right.
            Choice(text: "1.1 (42)", correct: false, outcome: UploadRule.problem(liveVersion: "1.2", liveBuild: 41, version: "1.1", build: 42) ?? ""), // Wrong.
        ], skipped: "Upload rejected: the version and build must be new."), // What breaks if this stage is skipped.
        ReleaseStage(id: 2, name: "Privacy", question: "Study Buddy reads UserDefaults. What does PrivacyInfo.xcprivacy declare?", choices: [ // Stage 3.
            Choice(text: "NSPrivacyAccessedAPICategoryUserDefaults with reason CA92.1", correct: true, outcome: "Validation passes."), // Right.
            Choice(text: "Nothing: UserDefaults is not personal data", correct: false, outcome: "App Store Connect emails ITMS-91053: Missing API declaration."), // Wrong.
        ], skipped: "ITMS-91053: Missing API declaration."), // What breaks if this stage is skipped.
        ReleaseStage(id: 3, name: "Archive", question: "Which configuration does Product > Archive build?", choices: [ // Stage 4.
            Choice(text: "Release", correct: true, outcome: "The archive contains api.example.com only; the DEBUG branch was never compiled."), // Right.
            Choice(text: "Debug, so the staging server is used", correct: false, outcome: "Archive always builds Release in this scheme; shipping Debug settings would point testers at staging."), // Wrong.
        ], skipped: "There is nothing to upload without an archive."), // What breaks if this stage is skipped.
        ReleaseStage(id: 4, name: "TestFlight", question: "The first build goes to 40 external testers. What happens first?", choices: [ // Stage 5.
            Choice(text: "Beta App Review, then testers can install it", correct: true, outcome: "Approved for beta; the build expires after 90 days."), // Right.
            Choice(text: "Testers can install it immediately", correct: false, outcome: "Only internal testers get builds as soon as they finish processing."), // Wrong.
        ], skipped: "Bugs that tests missed reach every user at once."), // What breaks if this stage is skipped.
        ReleaseStage(id: 5, name: "App Review", question: "Study Buddy needs a login. What goes in App Review Information?", choices: [ // Stage 6.
            Choice(text: "A working demo account", correct: true, outcome: "The reviewer gets past the first screen. Approved."), // Right.
            Choice(text: "Nothing; reviewers can sign up", correct: false, outcome: "Rejected under Guideline 2.1: the reviewer could not get past the login screen."), // Wrong.
        ], skipped: "The app cannot reach the App Store without review."), // What breaks if this stage is skipped.
        ReleaseStage(id: 6, name: "Release", question: "Day 3 of a phased release shows a spike in crashes.", choices: [ // Stage 7.
            Choice(text: "Pause the rollout, fix and ship 1.2.2", correct: true, outcome: "Automatic updates stop spreading the bad build while you fix it."), // Right.
            Choice(text: "Let it reach day 7 anyway", correct: false, outcome: "Half of automatic-update users get the crash by day 6."), // Wrong.
        ], skipped: "Nobody gets the update."), // What breaks if this stage is skipped.
    ]
}

// MARK: - The screen

struct ArchiveToAppStoreLesson: View { // The screen for lesson 9.6.
    let lesson: Lesson // The catalog entry: number, title and summary.

    var body: some View { // The page: summary first, then one card per course step.
        LessonPage(lesson: lesson) { // CourseKit's scrolling page layout.
            IdentityCard() // Concept: identity and signing.
            VersionCard() // Code: version, build and configuration.
            PrivacyManifestCard() // Code: the privacy manifest.
            ReviewCard() // Concept: TestFlight and App Review.
            PhasedReleaseCard() // Concept: after approval.
            PipelineCard() // Widget: release pipeline lab.
        }
    }
}

/// Concept step "Identity and signing", with this build's bundle ID.
private struct IdentityCard: View { // Static for one build.
    var body: some View { // The road and its first stage.
        DemoCard(title: "Identity and signing", // Named after the course step.
                 caption: "Shipping follows a fixed road: identity and signing, version and privacy, archive and upload, TestFlight, App Review, release and monitoring.") { // The road.
            LabeledContent("Bundle ID") { Text(verbatim: AppInfo.bundleIdentifier) } // Read from the running app; a short label leaves room for the ID.
            TermList(terms: [ // The course's five terms.
                ("Bundle ID", "Reverse-DNS name such as com.example.StudyBuddy. Unique worldwide, and fixed once a build is uploaded."), // Term 1.
                ("Team", "An Apple Developer Program membership. A free personal team runs apps on your own device but cannot use TestFlight or the App Store."), // Term 2.
                ("Certificate", "Proves who signed the build: Apple Development for testing, Apple Distribution for release."), // Term 3.
                ("Provisioning profile", "Ties a bundle ID, a certificate, allowed devices and capabilities together."), // Term 4.
                ("Capabilities", "Features such as App Groups or push notifications. This sample uses none, so a free team can run it."), // Term 5.
            ])
            Prose("This project uses Automatically manage signing: choose your team in the StudyBuddy target's Signing & Capabilities tab and Xcode creates and renews the rest.") // How this project is set up.
            CalloutBox(title: "Choose the bundle ID carefully", // The course's warning.
                       text: "After the first upload, the bundle ID can never change for that app record. Avoid version numbers or temporary names in it.", // Its message.
                       systemImage: "exclamationmark.triangle") // A warning icon.
        }
    }
}

/// The course's AboutRow: displays the version and build.
struct AboutRow: View { // Testers can quote this text in their feedback.
    var body: some View { // The row only displays; AppInfo does the work.
        LabeledContent("App", value: AppInfo.version) // "App" on the left, "Version 1.0 (1)" on the right.
    }
}

/// Code step "Version, build and configuration", plus an upload checker.
private struct VersionCard: View { // Real values from this build.
    @State private var version = "1.2.1" // The candidate version.
    @State private var build = 42 // The candidate build number.
    private let versions = ["1.1", "1.2", "1.2.0", "1.2.1", "1.3"] // Versions to try.

    var body: some View { // Rebuilt when the candidate changes.
        DemoCard(title: "Version, build and configuration", // Named after the course step.
                 caption: "Every upload needs a version users see and a build number unique for that version. #if DEBUG picks settings per build configuration.") { // The idea.
            AboutRow() // The course's row: MARKETING_VERSION and CURRENT_PROJECT_VERSION from Info.plist.
            LabeledContent("Build configuration") { Text(verbatim: AppInfo.configuration) } // Debug when run from Xcode, Release when archived.
            LabeledContent("Server for this configuration") { Text(verbatim: AppInfo.apiBase.absoluteString) } // staging or production; never contacted.
                .font(.subheadline) // URLs are long.
            CodeBlock("#if DEBUG\nURL(string: \"https://staging.example.com\")!\n#else\nURL(string: \"https://api.example.com\")!\n#endif") // The switch point.
            SectionLabel("Upload checker: 1.2 (41) is live") // Practise the rules.
            Picker("Version", selection: $version) { // The candidate version.
                ForEach(versions, id: \.self) { Text(verbatim: $0) } // One option per version.
            }
            .pickerStyle(.segmented) // All visible.
            Stepper(value: $build, in: 39...45) { Text(verbatim: "Build \(build)") } // The candidate build.
            let problem = UploadRule.problem(liveVersion: "1.2", liveBuild: 41, version: version, build: build) // Apply the rules.
            CheckRow(passed: problem == nil, title: "\(version) (\(build))", detail: problem ?? "Accepted as a new release.") // The verdict.
        }
    }
}

/// Code step "The privacy manifest": read back from the bundle and compared with the app.
private struct PrivacyManifestCard: View { // Proves the manifest shipped.
    var body: some View { // Static for one build.
        let manifest = PrivacyManifest.shipped() // nil if the file is not in the target.
        let declaresDefaults = manifest?.accessedAPIs.contains { $0.category == "NSPrivacyAccessedAPICategoryUserDefaults" && $0.reasons == ["CA92.1"] } ?? false // The one API this app uses.
        DemoCard(title: "The privacy manifest", // Named after the course step.
                 caption: "PrivacyInfo.xcprivacy declares tracking, collected data and required-reason APIs. Uploads that use those APIs without a declared reason are rejected with ITMS-91053.") { // The idea.
            if let manifest { // The file is in the app bundle.
                LabeledContent("NSPrivacyTracking") { Text(verbatim: manifest.tracking ? "true" : "false") } // Study Buddy does not track.
                LabeledContent("Collected data types") { Text(verbatim: "\(manifest.collectedDataTypes)") } // Nothing leaves the device.
                ForEach(manifest.accessedAPIs, id: \.category) { api in // One row per declaration.
                    LabeledContent(PrivacyManifest.shortName(api.category)) { Text(verbatim: api.reasons.joined(separator: ", ")) } // UserDefaults: CA92.1.
                }
            } else { // The file is missing.
                CheckRow(passed: false, title: "PrivacyInfo.xcprivacy is not in the app bundle") // Would be rejected.
            }
            SectionLabel("What the app really does") // The manifest must match the code.
            TermList(terms: [ // The app's real UserDefaults use.
                ("UserDefaultsSessionStorage", "Saves the session log under the key studySessions, for this app only."), // Use 1.
                ("@AppStorage(\"focusMinutes\")", "Remembers the focus length on the Today screen."), // Use 2.
                ("Network, location, tracking", "None. Purpose strings are not needed because the app asks for no permissions."), // Nothing else.
            ])
            CheckRow(passed: manifest != nil && declaresDefaults && manifest?.tracking == false && manifest?.collectedDataTypes == 0, // All four facts.
                     title: "The shipped manifest matches the app", // What was checked.
                     detail: "UserDefaults declared with CA92.1 (app-only defaults), no tracking, no collected data.") // Why.
            Prose("Reason CA92.1 covers reading and writing defaults that only this app uses. Xcode can generate a privacy report from an archive: Organizer, then Generate Privacy Report.") // The reason code.
        }
    }
}

/// Concept step "TestFlight and App Review".
private struct ReviewCard: View { // Static content.
    var body: some View { // Terms and the course's tip.
        DemoCard(title: "TestFlight and App Review", // Named after the course step.
                 caption: "TestFlight delivers beta builds to real people before release. App Review then checks the release build against the App Review Guidelines.") { // The idea.
            TermList(terms: [ // The course's five terms.
                ("Internal testers", "Up to 100 members of your App Store Connect team. Builds are available as soon as they finish processing."), // Term 1.
                ("External testers", "Up to 10,000 people by email or public link. The first build of a version needs Beta App Review. Builds expire after 90 days."), // Term 2.
                ("2.1 Completeness", "Crashes, placeholder text and broken links. Test the exact build you submit."), // Term 3.
                ("2.3 Metadata", "Screenshots and descriptions must match what the app really does."), // Term 4.
                ("5.1.1 Data", "Explain every permission. If users can create an account, they must be able to delete it in the app."), // Term 5.
            ])
            CalloutBox(title: "Help the reviewer", // The course's tip.
                       text: "If the app needs a login, put a working demo account in App Review Information. Reviewers who cannot get past the first screen reject the build.") // Its message.
        }
    }
}

/// Concept step "After approval: release, watch, maintain", with a phased release to step through.
private struct PhasedReleaseCard: View { // A seven-day rollout.
    @State private var day = 1 // The rollout day.
    @State private var paused = false // Whether the rollout is paused.
    @State private var pausedAt = 1 // The day it was paused.

    var body: some View { // Rebuilt when the day or pause changes.
        let percent = PhasedRelease.percentage(onDay: paused ? pausedAt : day) // A paused rollout stays where it was.
        DemoCard(title: "After approval: release, watch, maintain", // Named after the course step.
                 caption: "A phased release rolls an update out over seven days to people with automatic updates. If crash reports spike, pause it; anyone can still download the update manually.") { // The idea.
            Stepper(value: $day, in: 1...7) { Text(verbatim: "Day \(day)") } // Step through the week.
            Toggle("Pause the rollout", isOn: $paused) // The emergency brake.
                .onChange(of: paused) { _, now in if now { pausedAt = day } } // Remember where it stopped.
            ProgressView(value: Double(percent), total: 100) { // How far the update has spread.
                Text(verbatim: "\(percent)% of automatic-update users\(paused ? " (paused)" : "")") // The number, and the state in words.
            }
            TermList(terms: [ // The course's four terms.
                ("Crashes", "Xcode's Organizer collects crash reports from users who share analytics, symbolicated with your archive's dSYMs."), // Term 1.
                ("Hangs and energy", "The Organizer also reports hangs, launch time and battery use from real devices."), // Term 2.
                ("Analytics and ratings", "App Store Connect shows downloads, retention, ratings and reviews."), // Term 3.
                ("Maintenance release", "Fix, test, bump to 1.2.1 with a new build number, TestFlight, submit. Request an expedited review only for critical bugs."), // Term 4.
            ])
        }
    }
}

/// Widget "Release pipeline lab": stages unlock in order.
private struct PipelineCard: View { // Ship Study Buddy 1.2.1.
    @State private var cleared = 0 // How many stages are cleared.
    @State private var message: String? // The outcome of the last answer.
    @State private var peek: Int? // A locked stage selected to see what breaks.

    var body: some View { // Rebuilt after every answer.
        DemoCard(title: "Release pipeline lab", // Named after the course step.
                 caption: "Ship Study Buddy 1.2.1. Each stage asks one release decision; a wrong choice shows what really happens. Select a locked stage to see what breaks if you skip it.") { // What to do.
            ScrollView(.horizontal) { // The stages, in order.
                HStack { // One chip per stage.
                    ForEach(ReleaseStage.pipeline) { stage in // Seven stages.
                        Button { peek = stage.id > cleared ? stage.id : nil } label: { // Locked stages can be peeked at.
                            Label(stage.name, systemImage: stage.id < cleared ? "checkmark.circle.fill" : (stage.id == cleared ? "circle" : "lock.fill")) // Done, current or locked.
                                .font(.caption) // Compact chips.
                        }
                        .buttonStyle(.bordered) // Chip look.
                    }
                }
            }
            if let peek { // A locked stage was selected.
                CheckRow(passed: false, title: "Skipping \(ReleaseStage.pipeline[peek].name)", detail: ReleaseStage.pipeline[peek].skipped) // What breaks.
            }
            if cleared < ReleaseStage.pipeline.count { // Stages remain.
                let stage = ReleaseStage.pipeline[cleared] // The current stage.
                SectionLabel("\(stage.name): \(stage.question)") // The decision.
                ForEach(Array(stage.choices.enumerated()), id: \.offset) { _, choice in // One button per answer.
                    Button { answer(choice) } label: { // Choosing an answer.
                        Text(verbatim: choice.text).frame(maxWidth: .infinity, alignment: .leading) // Full-width option.
                    }
                    .buttonStyle(.bordered) // Each option is a button.
                }
            } else { // Every stage cleared.
                CheckRow(passed: true, title: "Study Buddy 1.2.1 is released", detail: "Keep watching the Organizer for crashes and hangs.") // The end of the road.
                Button("Start again") { cleared = 0; message = nil } // Replay.
                    .buttonStyle(.bordered) // Secondary look.
            }
            if let message { Prose(message) } // What happened.
        }
    }

    /// Applies an answer: right answers clear the stage, wrong ones explain the consequence.
    private func answer(_ choice: ReleaseStage.Choice) { // Called by the option buttons.
        message = (choice.correct ? "Cleared: " : "Not yet: ") + choice.outcome // The real-world outcome.
        if choice.correct { cleared += 1; peek = nil } // Move to the next stage.
    }
}

#Preview { // The lesson in Xcode's canvas.
    NavigationStack { ArchiveToAppStoreLesson(lesson: ContentView.lessons[5]) } // Inside a stack, as in the app.
        .environment(SessionStore.sample) // Supplied for consistency with the app.
}

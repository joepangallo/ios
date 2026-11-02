// Lesson_1_5_DevelopmentLifeCycle.swift
// Who: the student who opens lesson 1.5 from the home screen.
// What: the software development life cycle for PlantPal (phases, skipped
//       phases, waterfall versus agile), requirements you can test, the fern
//       acceptance criterion run live (with the off-by-one bug on a switch),
//       version and build numbers, TestFlight and App Review, privacy labels
//       and the seven-day phased release.
// Where: pushed by ContentView when the "1.5" row is tapped.
// When: built when the lesson opens; redrawn on every control change.
// Why: shipping an app is a loop, not a line. Each card turns one of the
//      loop's rules into something to try.

import SwiftUI // SwiftUI provides the views, controls and @State.

struct DevelopmentLifeCycleLesson: View { // The screen for lesson 1.5.
    let lesson: Lesson // The catalog entry: number, title and summary.
    @State private var phaseID = "requirements" // The life-cycle phase being explored.
    @State private var skipped = false // Whether that phase is skipped.
    @State private var week = 2.0 // The comparison timeline's week.
    @State private var interval = 3 // The schedule's interval in days.
    @State private var lastWatered = 10 // The day of the last watering.
    @State private var today = 13 // The day being checked.
    @State private var buggy = false // The Try it: > instead of >=.
    @State private var lab = VersionLab() // The version-and-build lab.
    @State private var releaseDay = 1 // The phased release's day, 1 to 7.
    @State private var paused = false // Whether the phased release is paused.

    var body: some View { // Rebuilt whenever one of the states above changes.
        let phase = SDLC.phase(phaseID) // The phase being explored.
        LessonPage(lesson: lesson) { // The shared scrolling page from CourseKit.
            DemoCard(title: "A loop, not a line", caption: "The Software Development Life Cycle names the phases a product passes through, from the first idea to its last update. For an iOS app the cycle never really ends: feedback and each year's new iOS start it again.") { // Step 1.
                TermList([ // The step's phases.
                    ("Requirements", "What the app must do, written so that you can test it."), // Phase 1.
                    ("Design", "Screens, flows and architecture, often prototyped as SwiftUI previews."), // Phase 2.
                    ("Implementation and testing", "Writing Swift with automated tests alongside it."), // Phase 3.
                    ("Deployment", "TestFlight betas, App Review, then release."), // Phase 4.
                    ("Maintenance", "Crash fixes, OS updates and new features, which feed the next cycle."), // Phase 5.
                ])
                Callout(tone: .history, title: "Waterfall and agile", text: "The classic waterfall model runs each phase once, in order. Most app teams work in an agile way instead: short iterations, often one or two weeks long, that pass through every phase and end with something people can test.") // The step's callout.
            }

            DemoCard(title: "Follow one app through the cycle", caption: "PlantPal is a plant-watering reminder app. Pick a phase to see its artifacts, people, Apple tools and a common failure, then skip it to see where the damage surfaces later.") { // Step 2, the SDLC widget.
                ScrollView(.horizontal) { // Six phases do not fit side by side, so they scroll.
                    HStack(spacing: 6) { // One capsule per phase.
                        ForEach(SDLC.phases) { item in // In order.
                            Button(item.label) { phaseID = item.id; skipped = false } // Picks the phase and clears the skip.
                                .buttonStyle(.bordered) // A capsule.
                                .tint(item.id == phaseID ? .accentColor : .secondary) // The chosen phase is tinted.
                                .font(.footnote) // Small labels.
                        }
                    }
                }
                Text("Artifacts").font(.subheadline.weight(.semibold)) // A small heading.
                ForEach(phase.artifacts, id: \.self) { item in // One bullet per artifact.
                    Label(item, systemImage: "doc.text") // The artifact.
                        .font(.footnote) // Small.
                }
                TermList([("Who", phase.who), ("Apple tools", phase.tools), ("Common failure", phase.failure)]) // The rest of the phase card.
                Toggle(phase.skipLabel, isOn: $skipped) // Skips the phase.
                if skipped { // Only when skipped.
                    Callout(tone: .warn, title: "The damage surfaces in \(SDLC.phase(phase.damageAt).label)", text: phase.damage) // Where and how it hurts.
                }
            }

            DemoCard(title: "Follow one app through the cycle: waterfall vs agile", caption: "Drag through the 24 weeks and compare when real user feedback first arrives.") { // The widget's second tab.
                Slider(value: $week, in: 0...Double(SDLC.weeks), step: 1) { Text("Week") } // The week to look at.
                Text("Week \(Int(week))") // The chosen week.
                    .font(.subheadline.monospacedDigit().weight(.semibold)) // Even digits.
                TermList([("Waterfall", SDLC.waterfallStatus(week: Int(week))), ("Agile, two-week sprints", SDLC.agileStatus(week: Int(week)))]) // Both teams that week.
                Text("First feedback from people outside the team: week \(SDLC.firstFeedbackAgile) with agile, week \(SDLC.firstFeedbackWaterfall) with waterfall.") // The comparison's point.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // Quiet.
            }

            DemoCard(title: "Requirements you can test", caption: "A requirement is useful only if you can tell whether the app meets it.") { // Step 3.
                TermList([ // The step's points.
                    ("User story", "\"As a plant owner, I want a reminder when a plant needs water, so that it stays healthy.\""), // Point 1.
                    ("Acceptance criterion", "\"Given a fern watered on day 10 with a 3-day interval, when day 13 arrives, then it shows as due.\""), // Point 2.
                    ("Non-functional requirement", "A quality rather than a feature: launches quickly, works offline, supports Dynamic Type and VoiceOver."), // Point 3.
                ])
                Callout(tone: .design, title: "Criteria become tests", text: "The Given / When / Then shape maps straight onto an automated test: set up the data, perform the action, check the result.") // The step's callout.
            }

            DemoCard(title: "An acceptance criterion as a test", caption: "The course's WateringSchedule, live. Change the schedule, then run the fern criterion. The same test, word for word, is in this project's test target: press Command-U to run it.") { // Step 4.
                Stepper("Interval: every \(interval) days", value: $interval, in: 1...14) // intervalDays.
                Stepper("Last watered on day \(lastWatered)", value: $lastWatered, in: 0...30) // lastWatered.
                Stepper("Today is day \(today)", value: $today, in: 0...45) // The day to check.
                Label(WateringSchedule(intervalDays: interval, lastWatered: lastWatered).isDue(onDay: today) ? "Due: water it today" : "Not due yet", systemImage: "drop") // isDue(onDay:), live.
                    .font(.headline) // The answer stands out.
                    .foregroundStyle(WateringSchedule(intervalDays: interval, lastWatered: lastWatered).isDue(onDay: today) ? .blue : .secondary) // Blue when due.
                Divider() // Separates the playground from the test.
                Toggle("Try it: change >= to >", isOn: $buggy) // Plants the off-by-one bug.
                ForEach(AcceptanceCheck.fern(rule: buggy ? AcceptanceCheck.buggyRule : AcceptanceCheck.correctRule)) { check in // The two expectations.
                    Label { // The line of code...
                        Text(verbatim: check.code).font(.system(.footnote, design: .monospaced)) // ...as code.
                    } icon: { // ...with a pass or fail mark.
                        Image(systemName: check.passed ? "checkmark.circle.fill" : "xmark.circle.fill").foregroundStyle(check.passed ? .green : .red) // Green passes, red fails.
                    }
                }
                Text(buggy ? "The first expectation fails: on day 13 the fern is not due, which breaks the requirement's \"when day 13 arrives, then it shows as due\"." : "Both expectations pass: the rule meets the requirement, including the boundary day.") // What the result means.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // Quiet.
                SourceNote("fernIsDueAfterInterval in EcosystemTourTests/DevelopmentLifeCycleTests.swift") // Where the real test is.
            }

            DemoCard(title: "Version numbers and build numbers", caption: "The version (CFBundleShortVersionString) is what people see on the App Store. The build (CFBundleVersion) identifies one upload and must go up every time. This app's own pair:") { // Step 5.
                LabeledContent("This app's version", value: AppInfo.version) // From Info.plist.
                LabeledContent("This app's build", value: AppInfo.build) // From Info.plist.
                Text("Version \(lab.version.description), build \(lab.build)") // The lab's current pair.
                    .font(.title3.monospacedDigit().weight(.semibold)) // Big, with even digits.
                Text(lab.message) // What the last action did.
                    .font(.footnote) // Small print.
                    .foregroundStyle(lab.rejected ? .red : .primary) // Red when refused.
                    .fixedSize(horizontal: false, vertical: true) // Wraps instead of cutting off.
                ForEach(VersionLab.Action.allCases) { action in // One button per action.
                    Button(action.rawValue) { lab.perform(action) } // Performs it.
                        .buttonStyle(.bordered) // Secondary actions.
                        .tint(action == .duplicate ? .red : .accentColor) // The risky one is red.
                        .font(.footnote) // Small labels.
                }
                ForEach(lab.history.prefix(5)) { upload in // The newest five uploads.
                    LabeledContent("\(upload.version) (\(upload.build))", value: "\(upload.destination): \(upload.note)") // For example 1.0.1 (4): App Store.
                        .font(.caption) // Small.
                }
                Button("Reset the lab") { lab = VersionLab() } // Starts over.
                    .font(.footnote) // Small.
            }

            DemoCard(title: "Beta testing and App Review", caption: "TestFlight is Apple's beta service. Up to 100 internal testers get builds right away; up to 10,000 external testers get them after a brief Beta App Review. Each build stays testable for 90 days. Every release then passes App Review:") { // Step 6.
                TermList([ // The guideline areas.
                    ("Safety", "No objectionable content; apps with user-generated content need ways to report and block."), // Area 1.
                    ("Performance", "The build must be complete: no crashes, no placeholder text, no broken links."), // Area 2.
                    ("Business", "Digital content and features are generally sold through In-App Purchase, with some regional exceptions."), // Area 3.
                    ("Design", "An app must offer real functionality, not just a repackaged website."), // Area 4.
                    ("Legal", "A privacy policy, honest privacy labels, and consent before collecting data."), // Area 5.
                ])
            }

            DemoCard(title: "Privacy labels and phased release", caption: "Privacy labels summarize what data an app collects; they must match your code and every library in it. A phased release rolls an approved update out over seven days, and you can pause it if crash reports spike.") { // Step 7.
                Stepper("Day \(releaseDay) of 7", value: $releaseDay, in: 1...7) // The rollout's day.
                    .disabled(paused) // A paused rollout does not advance.
                ProgressView(value: Double(PhasedRelease.percentage(onDay: releaseDay)), total: 100) { // How far the update has spread.
                    Text(paused ? "Paused at \(PhasedRelease.percentage(onDay: releaseDay))% while you fix the crash" : "\(PhasedRelease.percentage(onDay: releaseDay))% of people with automatic updates") // The share.
                        .font(.subheadline) // Body-sized.
                }
                .tint(paused ? .orange : .green) // Orange when paused.
                Toggle("Pause the rollout", isOn: $paused) // The course's best move when crashes spike.
                Text("Anyone can still update by hand from the App Store, whatever the day.") // The course's footnote.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // Quiet.
                TermList([ // The step's points.
                    ("Privacy manifest", "A PrivacyInfo.xcprivacy file, in your app and in each third-party SDK, declaring the data used and the reasons for calling certain sensitive APIs."), // Point 1.
                    ("App Tracking Transparency", "Tracking people across other companies' apps and websites requires asking their permission first."), // Point 2.
                ])
            }
        }
    }
}

#Preview { // The lesson in Xcode's canvas.
    NavigationStack { DevelopmentLifeCycleLesson(lesson: ContentView.lessons[6]) } // Wrapped in a stack so the title shows.
}

// DevelopmentLifeCycleTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: lesson 1.5's acceptance criterion as a test, exactly as the course
//       writes it, plus checks of the SDLC timeline, the in-app acceptance
//       check with and without the off-by-one bug, the version lab and the
//       phased-release schedule.
// Where: the EcosystemTourTests target.
// When: only when tests run.
// Why: "criteria become tests": if someone breaks the watering rule, the
//      first test below fails before the change reaches a tester.

import Testing // Swift Testing: @Test and #expect.
@testable import EcosystemTour // The app's WateringSchedule and the lesson's models.

/// The course's test, word for word. @MainActor is the one addition: in this
/// app, WateringSchedule lives on the main actor (the app's default isolation).
@MainActor // Runs on the main actor, where WateringSchedule lives.
@Test("Fern watered on day 10 is due on day 13") // The display name repeats the acceptance criterion.
func fernIsDueAfterInterval() { // Swift Testing finds and runs it.
    let fern = WateringSchedule(intervalDays: 3, lastWatered: 10) // Given: watered on day 10, every 3 days.
    #expect(fern.isDue(onDay: 13)) // Then: due on day 13.
    #expect(!fern.isDue(onDay: 12)) // And not yet on day 12: catches > instead of >=.
}

@MainActor // The lesson's models are main-actor isolated.
struct SDLCTests { // The life-cycle model.
    @Test func phasesAreTheWidgetsSix() { // Requirements to Maintenance.
        #expect(SDLC.phases.map(\.label) == ["Requirements", "Design", "Implementation", "Testing", "Deployment", "Maintenance"]) // In order.
        #expect(SDLC.phases.allSatisfy { SDLC.phase($0.damageAt).id == $0.damageAt }) // Every skip points at a real phase.
    }

    @Test func skippingRequirementsHurtsTesting() { // The widget's first consequence.
        #expect(SDLC.phase(SDLC.phase("requirements").damageAt).label == "Testing") // Testers cannot tell right from wrong.
    }

    @Test func agileFeedbackArrivesTwentyWeeksEarlier() { // The comparison's point.
        #expect(SDLC.firstFeedbackAgile == 2) // After the first sprint.
        #expect(SDLC.firstFeedbackWaterfall == 22) // At release.
        #expect(SDLC.waterfallStatus(week: 10).contains("Nobody outside the team")) // Waterfall, mid-build.
        #expect(SDLC.agileStatus(week: 10) == "Sprint 6: build 6 is in TestFlight. Testers have been sending feedback since week 2.") // Agile, same week.
        #expect(SDLC.waterfallStatus(week: 22).hasPrefix("Released.")) // Waterfall finally ships.
    }

    @Test func acceptanceCheckPassesWithTheRealRule() { // The in-app check.
        #expect(AcceptanceCheck.fern(rule: AcceptanceCheck.correctRule).allSatisfy { $0.passed }) // Both expectations hold.
    }

    @Test func acceptanceCheckCatchesTheOffByOneBug() { // The Try it: > instead of >=.
        let results = AcceptanceCheck.fern(rule: AcceptanceCheck.buggyRule) // The buggy rule.
        #expect(results.map(\.passed) == [false, true]) // Day 13 fails; day 12 still passes.
    }

    @Test func intervalOfZeroIsAlwaysDue() { // An edge case of the rule.
        #expect(WateringSchedule(intervalDays: 0, lastWatered: 5).isDue(onDay: 5)) // Due the same day.
    }
}

@MainActor // VersionLab is main-actor isolated.
struct VersionLabTests { // The version-and-build lab.
    @Test func startsAtTheFirstRelease() { // 1.0.0 (3).
        let lab = VersionLab() // A fresh lab.
        #expect(lab.version.description == "1.0.0") // The version.
        #expect(lab.build == 3) // The build.
        #expect(lab.history.count == 3) // Three uploads so far.
        #expect(lab.message == VersionLab.intro) // The opening message.
    }

    @Test func betaKeepsTheVersionAndRaisesTheBuild() { // A TestFlight build.
        var lab = VersionLab() // A fresh lab.
        lab.perform(.beta) // Upload a beta.
        #expect(lab.version.description == "1.0.0") // Same version.
        #expect(lab.build == 4) // New build.
        #expect(lab.message == "Same version 1.0.0, new build 4. Testers get it; App Store users still see 1.0.0.") // The course's wording.
    }

    @Test func duplicateUploadIsRejected() { // Quiz: build 14 again.
        var lab = VersionLab() // A fresh lab.
        lab.perform(.duplicate) // The same build again.
        #expect(lab.rejected) // Refused.
        #expect(lab.build == 3) // Nothing changed.
        #expect(lab.message == "Rejected: Redundant Binary Upload. Build 3 already exists for version 1.0.0. Increase the build number and upload again.") // The course's wording.
    }

    @Test func releasesBumpTheRightNumber() { // Patch, minor, major.
        var lab = VersionLab() // 1.0.0 (3).
        lab.perform(.patch) // A bug fix.
        #expect(lab.version.description == "1.0.1") // Last number.
        #expect(lab.message == "Bug fix: only the last number changes. 1.0.0 becomes 1.0.1, and the build keeps climbing: 3 to 4.") // The course's wording.
        lab.perform(.minor) // A feature.
        #expect(lab.version.description == "1.1.0") // Middle number; last resets.
        lab.perform(.major) // A redesign.
        #expect(lab.version.description == "2.0.0") // First number; the rest reset.
        #expect(lab.build == 6) // One build per upload.
        #expect(lab.history.first?.destination == "App Store") // Releases go to the App Store.
    }

    @Test func phasedReleaseFollowsTheSevenDaySchedule() { // 1, 2, 5, 10, 20, 50, 100.
        #expect((1...7).map(PhasedRelease.percentage(onDay:)) == [1, 2, 5, 10, 20, 50, 100]) // Day by day.
        #expect(PhasedRelease.percentage(onDay: 0) == 1) // Clamped below.
        #expect(PhasedRelease.percentage(onDay: 9) == 100) // Clamped above.
    }
}

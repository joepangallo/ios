// QualityUITests.swift
// Who: XCTest's UI testing runner.
// What: the course's quality checks from lesson 9.3: an accessibility audit of
//       the session list screen and of the home screen, and a launch-time
//       measurement.
// Where: the StudyBuddyUITests target.
// When: with every Command-U here; a team might run them only before a release.
// Why: audits catch problems VoiceOver and low-vision users hit, automatically,
//      and launch time is the app's first impression.

import XCTest // XCTest provides audits and performance metrics.

final class QualityUITests: XCTestCase { // Quality checks not tied to one journey.
    /// Decides which audit issues to accept. Returning true ignores an issue; everything else fails the test.
    /// Two cases come from the shared CourseKit scaffold, which this app does not change: its quieter
    /// .secondary captions score "Contrast nearly passed" (just under 4.5:1, not a failure), and a long
    /// lesson title shown inline in the navigation bar is truncated by the system.
    @MainActor // Reads XCUIElement properties.
    static func isAcceptedScaffoldIssue(_ issue: XCUIAccessibilityAuditIssue, navigationTitle: String?) -> Bool { // Used by both audits.
        if issue.auditType == .contrast && issue.compactDescription == "Contrast nearly passed" { return true } // Near-pass only; a real contrast failure still fails.
        if issue.auditType == .textClipped, let navigationTitle, issue.element?.label == navigationTitle { return true } // Only the long inline title.
        return false // Any other issue fails the test.
    }

    @MainActor // Required to use XCUIApplication.
    func testSessionListPassesAccessibilityAudit() throws { // Audits lesson 9.3's list screen.
        let app = XCUIApplication() // The proxy for the app under test.
        app.launchArguments = ["-ui-testing", "-lesson", "9.3"] // Seeded rows: an empty list would hide problems in the rows.
        app.launch() // Starts the app and waits until it is idle.
        XCTAssertTrue(app.buttons["addSessionButton"].waitForExistence(timeout: 10)) // The screen is ready.
        try app.performAccessibilityAudit { issue in // Contrast, descriptions, hit regions, Dynamic Type, clipped text.
            Self.isAcceptedScaffoldIssue(issue, navigationTitle: "9.3 UI Tests, Previews and Accessibility Checks") // true ignores the issue.
        }
    }

    @MainActor // Required to use XCUIApplication.
    func testHomeScreenPassesAccessibilityAudit() throws { // Audits the first screen a student sees.
        let app = XCUIApplication() // The proxy for the app under test.
        app.launchArguments = ["-ui-testing"] // Known data.
        app.launch() // Starts on the lesson list.
        XCTAssertTrue(app.buttons["lesson-9.1"].waitForExistence(timeout: 10)) // The list is ready.
        try app.performAccessibilityAudit { issue in // Records a failure for each issue not accepted.
            Self.isAcceptedScaffoldIssue(issue, navigationTitle: nil) // The home screen's title is short, so only near-pass contrast is accepted.
        }
    }

    @MainActor // Required to use XCUIApplication.
    func testLaunchPerformance() throws { // Cold launch.
        let options = XCTMeasureOptions() // How many times to measure.
        options.iterationCount = 1 // One measured launch keeps Command-U quick; raise it for real baselines.
        measure(metrics: [XCTApplicationLaunchMetric()], options: options) { // Records launch duration.
            XCUIApplication().launch() // Launches the app from scratch.
        }
    }
}

// SessionFlowUITests.swift
// Who: XCTest's UI testing runner, which launches the real app and taps it.
// What: the course's journey from lesson 9.3 (add a session through the sheet
//       and see it listed), the seeded rows, the disabled Save button, and the
//       capstone's own journey: start a focus session and see it logged.
// Where: the StudyBuddyUITests target, a separate bundle from the app.
// When: when you run tests with Command-U; each test launches a fresh app.
// Why: these journeys must never break. Every query uses an identifier or
//      user data, so the tests survive translation and redesign.

import XCTest // XCTest provides XCUIApplication and assertions.

final class SessionFlowUITests: XCTestCase { // Named after the journey it tests.
    override func setUpWithError() throws { // Runs before each test.
        continueAfterFailure = false // Stop at the first failure.
    }

    /// Launches the app with known data on the given lesson.
    @MainActor // XCUIApplication is main-actor isolated.
    private func launch(lesson: String) -> XCUIApplication { // Shared setup.
        let app = XCUIApplication() // A proxy for the app; it does not launch yet.
        app.launchArguments = ["-ui-testing", "-lesson", lesson] // Known data, and the screen to start on.
        app.launch() // Installs and starts the app, then waits until it is idle.
        return app // The tests drive it from here.
    }

    @MainActor // XCUIApplication is main-actor isolated.
    func testAddingASessionShowsItInTheList() throws { // The course's test, step for step.
        let app = launch(lesson: "9.3") // The list screen, with seeded rows.
        app.buttons["addSessionButton"].tap() // Opens the sheet.
        let title = app.textFields["sessionTitleField"] // A query for the sheet's text field.
        title.tap() // Keyboard focus, exactly as for a person.
        title.typeText("Chemistry quiz prep") // Types the title one character at a time.
        app.buttons["saveSessionButton"].tap() // Saves and closes the sheet.
        let row = app.staticTexts["Chemistry quiz prep"] // User data, so querying by label is safe.
        XCTAssertTrue(row.waitForExistence(timeout: 5)) // Waits for the row instead of sleeping.
    }

    @MainActor // XCUIApplication is main-actor isolated.
    func testSeededRowsAreListed() throws { // -ui-testing seeds known data.
        let app = launch(lesson: "9.3") // The list screen.
        XCTAssertTrue(app.staticTexts["Algebra review"].waitForExistence(timeout: 5)) // The newest seeded row.
        XCTAssertTrue(app.staticTexts["Biology flashcards"].exists) // The older seeded row.
    }

    @MainActor // XCUIApplication is main-actor isolated.
    func testSaveIsDisabledUntilATitleIsTyped() throws { // The rule behind .disabled.
        let app = launch(lesson: "9.3") // The list screen.
        app.buttons["addSessionButton"].tap() // Opens the sheet.
        let save = app.buttons["saveSessionButton"] // The Save button.
        XCTAssertTrue(save.waitForExistence(timeout: 5)) // The sheet is up.
        XCTAssertFalse(save.isEnabled) // Disabled with an empty title.
        let title = app.textFields["sessionTitleField"] // The title field.
        title.tap() // Focus.
        title.typeText("Physics") // Type something.
        XCTAssertTrue(save.isEnabled) // Now it can be tapped.
    }

    @MainActor // XCUIApplication is main-actor isolated.
    func testStartingAFocusSessionLogsIt() throws { // The capstone's journey: start a session, see it listed.
        let app = launch(lesson: "9.7") // The capstone's Today screen; fast-forward is on by default.
        let start = app.buttons["startFocusButton"] // The Start button, by identifier.
        XCTAssertTrue(start.waitForExistence(timeout: 10)) // The screen is up.
        start.tap() // Starts the focus timer.
        let stop = app.buttons["stopFocusButton"] // Stop and log.
        XCTAssertTrue(stop.waitForExistence(timeout: 5)) // Present...
        sleep(3) // Let a few seconds pass: with fast-forward each one counts as a minute.
        stop.tap() // Ends the block and logs it.
        let logged = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Logged ")).firstMatch // "Logged 3 min of Algebra."
        XCTAssertTrue(logged.waitForExistence(timeout: 5)) // The confirmation appeared.
        XCTAssertTrue(logged.label.hasSuffix("of Algebra.")) // For the default subject.
    }
}

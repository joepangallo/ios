// StudyBuddyUITests.swift
// Who: XCTest's UI testing runner, which launches the real app and taps it.
// What: checks that a launch argument can open a lesson screen directly, that
//       every lesson opens from the home list, and that a Spanish launch
//       really shows Spanish labels while identifiers stay the same.
// Where: the StudyBuddyUITests target, which drives the app from outside.
// When: when you run tests with Command-U.
// Why: UI tests prove that the whole app works the way a person uses it.

import XCTest // XCTest drives UI tests through XCUIApplication.

final class StudyBuddyUITests: XCTestCase { // UI tests are still written with XCTest.
    override func setUpWithError() throws { // Runs before each test.
        continueAfterFailure = false // Stop a test at its first failure; later steps would only add noise.
    }

    @MainActor // XCUIApplication must be used on the main actor.
    func testLaunchArgumentOpensALesson() throws { // One UI test.
        let app = XCUIApplication() // A handle on the app under test.
        app.launchArguments = ["-lesson", "9.1"] // Ask the app to open lesson 9.1 at launch.
        app.launch() // Starts the app in the Simulator.
        XCTAssertTrue(app.navigationBars.firstMatch.waitForExistence(timeout: 10)) // A lesson screen with a navigation bar appeared.
    }

    @MainActor // XCUIApplication must be used on the main actor.
    func testEveryLessonOpensFromTheList() throws { // Walks the home list like a person.
        let app = XCUIApplication() // A handle on the app under test.
        app.launchArguments = ["-ui-testing"] // Known data, so the run is repeatable.
        app.launch() // Starts on the home screen.
        let titles = [ // Each lesson's navigation title.
            "9.1 Architecture That Survives Change", "9.2 Testing with Swift Testing", // Lessons 1 and 2.
            "9.3 UI Tests, Previews and Accessibility Checks", "9.4 Debugging and Instruments", // Lessons 3 and 4.
            "9.5 Performance, Accessibility and Localization", "9.6 From Archive to App Store", // Lessons 5 and 6.
            "9.7 Capstone: Study Buddy from Idea to Release", // Lesson 7.
        ]
        for title in titles { // One lesson at a time.
            let number = String(title.prefix(3)) // "9.1", which CourseKit uses in each row's identifier.
            let row = app.buttons["lesson-\(number)"] // The row, by its stable identifier.
            for _ in 0..<4 where !row.exists { app.swipeUp() } // List builds rows lazily: scroll until the row exists.
            row.tap() // Opens the lesson.
            XCTAssertTrue(app.navigationBars[title].waitForExistence(timeout: 5), "\(title) did not open") // The lesson's title bar.
            app.navigationBars[title].buttons.firstMatch.tap() // The back button returns to the list.
        }
    }

    @MainActor // XCUIApplication must be used on the main actor.
    func testSpanishLaunchTranslatesLabelsButNotIdentifiers() throws { // The localization check from lesson 9.5.
        let app = XCUIApplication() // A handle on the app under test.
        app.launchArguments = ["-ui-testing", "-lesson", "9.3", "-AppleLanguages", "(es)"] // Spanish, known data, the list screen.
        app.launch() // Starts in Spanish.
        let add = app.buttons["addSessionButton"] // Found by identifier, which never changes.
        XCTAssertTrue(add.waitForExistence(timeout: 10)) // The same identifier still works.
        XCTAssertEqual(add.label, "Añadir sesión") // But the visible label is Spanish.
    }
}

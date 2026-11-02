// LessonFlowUITests.swift
// Who: XCTest's UI testing runner, when you press Command-U.
// What: taps through the interactive cards of every lesson the way a student
//       would (run a program, push a stack, load songs, race the counter, flip
//       a chore) and checks what appears on screen. Each step also keeps a
//       screenshot in the test report.
// Where: the TypeWorkshopUITests target. It launches the app with -lesson N.k
//        and -card N, so each test starts on the card it checks.
// When: with every Command-U; each test launches a fresh copy of the app.
// Why: unit tests prove the logic; these prove the buttons, consoles and
//      live values on screen are wired to it.

import XCTest // XCTest provides XCUIApplication, element queries and attachments.

final class LessonFlowUITests: XCTestCase { // One test per lesson.
    private var app: XCUIApplication! // The app under test; set up by launch(_:card:).

    override func setUp() { // Runs before each test.
        continueAfterFailure = false // Stop a test at its first failure; later steps depend on earlier ones.
    }

    /// Launches the app straight onto one card of one lesson.
    @MainActor // XCUIApplication must be used on the main actor.
    private func launch(_ lesson: String, card: Int) { // For example launch("3.7", card: 1).
        app = XCUIApplication() // A fresh proxy for the app.
        app.launchArguments = ["-lesson", lesson, "-card", "\(card)"] // CourseKit opens the lesson; CardPage scrolls to the card.
        app.launch() // Starts the app and waits until it is idle.
    }

    /// Keeps a screenshot of the whole screen in the test report.
    @MainActor // Screenshots come from the main actor.
    private func shot(_ name: String) { // name appears in the report.
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot()) // Captures the simulator screen.
        attachment.name = name // For example "3.7-actor".
        attachment.lifetime = .keepAlways // Keep it even when the test passes.
        add(attachment) // Attach it to the running test.
    }

    /// A static text whose label starts with the given text.
    @MainActor // Queries run on the main actor.
    private func text(startingWith prefix: String) -> XCUIElement { // Used for lines whose ending changes.
        app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch // The first matching text.
    }

    /// A static text whose label contains the given text.
    @MainActor // Queries run on the main actor.
    private func text(containing part: String) -> XCUIElement { // Used for multi-line code results.
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", part)).firstMatch // The first matching text.
    }

    /// Waits until a query finds at least count elements; true when it does in time.
    @MainActor // Queries run on the main actor.
    private func wait(for query: XCUIElementQuery, atLeast count: Int, timeout: TimeInterval = 5) -> Bool { // Used when the same text already appears once.
        let deadline = Date().addingTimeInterval(timeout) // When to give up.
        while Date() < deadline { // Poll until the deadline.
            if query.count >= count { return true } // Found enough.
            RunLoop.current.run(until: Date().addingTimeInterval(0.2)) // Let the app work for a moment.
        }
        return query.count >= count // One last look.
    }

    /// All static texts whose label contains the given text.
    @MainActor // Queries run on the main actor.
    private func texts(containing part: String) -> XCUIElementQuery { // Used for counting.
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", part)) // Every match.
    }

    /// Flips a SwiftUI Toggle by tapping its switch at the right-hand end of the row.
    @MainActor // Taps run on the main actor.
    private func flip(_ label: String) { // label is the toggle's text.
        let toggle = app.switches[label].firstMatch // The toggle row.
        XCTAssertTrue(toggle.waitForExistence(timeout: 5), "missing toggle \(label)") // It must be on screen.
        toggle.coordinate(withNormalizedOffset: CGVector(dx: 0.93, dy: 0.5)).tap() // Tap the switch itself, not the label.
    }

    @MainActor // Required to use XCUIApplication.
    func testStructsLesson() { // Lesson 3.1.
        launch("3.1", card: 3) // Mutating methods.
        app.buttons["roadTrip.add(...)"].tap() // Calls the mutating method once.
        XCTAssertTrue(text(containing: "Road Trip: 1 songs").waitForExistence(timeout: 5)) // The computed summary followed.
        shot("3.1-mutating") // Keep the screen.
        launch("3.1", card: 5) // Custom init, static members and didSet.
        app.buttons["reading.celsius = -2.5"].tap() // Assigns a new value.
        app.buttons["reading.celsius = reading.celsius"].tap() // Assigns the same value again.
        XCTAssertTrue(text(containing: "-2.5 -> -2.5").waitForExistence(timeout: 5)) // didSet ran even for an equal value.
        shot("3.1-didset") // Keep the screen.
    }

    @MainActor // Required to use XCUIApplication.
    func testClassesLesson() { // Lesson 3.2.
        launch("3.2", card: 1) // A class with an initializer.
        app.buttons["sameAccount.deposit(25)"].tap() // Deposit through the second name.
        XCTAssertTrue(app.staticTexts["Deposits so far: 1"].waitForExistence(timeout: 5)) // The card redrew.
        XCTAssertGreaterThanOrEqual(texts(containing: "125.0").count, 2) // Both names read the new balance.
        shot("3.2-joint-account") // Keep the screen.
        launch("3.2", card: 4) // See it in memory.
        app.buttons["var b = a"].tap() // Copy a into b in both worlds.
        app.buttons["b.balance += 50"].tap() // Change b.
        XCTAssertTrue(app.staticTexts["a.balance: 100"].waitForExistence(timeout: 5)) // The struct world's a kept its value.
        XCTAssertTrue(app.staticTexts["a.balance: 150"].exists) // The class world's a changed with b.
        app.buttons["b = Account(balance: 0)"].tap() // b gets a brand-new object.
        app.buttons["b = a"].tap() // The new object loses its only reference.
        XCTAssertTrue(text(containing: "freed by ARC").waitForExistence(timeout: 5)) // ARC freed it.
        shot("3.2-memory-lab") // The buttons and both worlds.
        let from = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8)) // A point low on the screen...
        from.press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.45))) // ...dragged up a third of the screen.
        shot("3.2-memory-lab-heap") // The heap and the log.
    }

    @MainActor // Required to use XCUIApplication.
    func testEnumsLesson() { // Lesson 3.3.
        launch("3.3", card: 4) // Model screen state with one enum.
        flip("isLoading") // Spinner on...
        flip("hasError") // ...and an error at the same time.
        XCTAssertTrue(text(startingWith: "Impossible state").waitForExistence(timeout: 5)) // Not a real state.
        shot("3.3-three-bools") // Keep the screen.
        launch("3.3", card: 5) // Screen state as an enum.
        app.buttons["Load songs"].tap() // idle -> loading -> loaded.
        XCTAssertTrue(app.staticTexts["state.message  // 2 songs"].waitForExistence(timeout: 5)) // The loaded state.
        shot("3.3-loaded") // Keep the screen.
        flip("Simulate offline") // Make the next load fail.
        app.buttons["Load songs"].tap() // loading -> failed.
        XCTAssertTrue(app.staticTexts["state.message  // Error: Offline"].waitForExistence(timeout: 5)) // The failed state.
        shot("3.3-failed") // Keep the screen.
    }

    @MainActor // Required to use XCUIApplication.
    func testProtocolsLesson() { // Lesson 3.4.
        launch("3.4", card: 1) // Defining and adopting a protocol.
        app.buttons["Add Flat white"].tap() // A Coffee: 4.5.
        app.buttons["Add Croissant"].tap() // A Pastry: 3.25.
        XCTAssertTrue(text(containing: "7.75").waitForExistence(timeout: 5)) // Totalled through the protocol.
        shot("3.4-cart") // Keep the screen.
        launch("3.4", card: 6) // some versus any.
        app.buttons["append(Circle(radius: 1))"].tap() // A second concrete type in the array.
        XCTAssertTrue(text(containing: "Square, Circle").waitForExistence(timeout: 5)) // Both boxes are listed.
        shot("3.4-some-any") // Keep the screen.
    }

    @MainActor // Required to use XCUIApplication.
    func testGenericsLesson() { // Lesson 3.5.
        launch("3.5", card: 2) // A generic type: Stack.
        app.buttons["push"].tap() // Inbox.
        app.buttons["push"].tap() // Inbox again, on top.
        app.buttons["pop"].tap() // Removes the top.
        XCTAssertTrue(text(containing: "screens.count  // 1").waitForExistence(timeout: 5)) // One element left.
        app.buttons["edits.push(1)"].tap() // The Int stack.
        XCTAssertTrue(app.buttons["edits.push(2)"].waitForExistence(timeout: 5)) // The next number to push.
        shot("3.5-stack") // Keep the screen.
    }

    @MainActor // Required to use XCUIApplication.
    func testErrorHandlingLesson() { // Lesson 3.6.
        launch("3.6", card: 4) // Cleaning up with defer.
        app.buttons["try syncPhotos(online: false)"].tap() // The throwing path.
        XCTAssertTrue(wait(for: texts(containing: "Error: offline"), atLeast: 2)) // The course output has one; the live run adds another.
        app.buttons["Sync photos"].tap() // The async version with a real spinner.
        XCTAssertTrue(wait(for: texts(containing: "Uploaded 12 photos"), atLeast: 2)) // The status line joins the course output's line.
        shot("3.6-defer") // Keep the screen.
        launch("3.6", card: 6) // Errors people can read.
        app.buttons["Create account"].tap() // ana@example.com is taken.
        XCTAssertTrue(app.staticTexts["ana@example.com already has an account."].waitForExistence(timeout: 5)) // The readable message.
        shot("3.6-sign-up") // Keep the screen.
    }

    @MainActor // Required to use XCUIApplication.
    func testConcurrencyLesson() { // Lesson 3.7.
        launch("3.7", card: 1) // async and await.
        app.buttons["Run the program"].tap() // Starts the program.
        XCTAssertTrue(app.staticTexts["Done"].waitForExistence(timeout: 5)) // Finished after about a second.
        XCTAssertTrue(app.staticTexts["Seattle: 18 degrees, light rain"].exists) // The awaited line.
        shot("3.7-async-await") // Keep the screen.
        launch("3.7", card: 2) // One after another, or all at once.
        app.buttons["Parallel async let"].tap() // About 2 seconds.
        XCTAssertTrue(text(startingWith: "async let: took").waitForExistence(timeout: 10)) // Timed.
        shot("3.7-async-let") // Keep the screen.
        launch("3.7", card: 3) // Watch the waiting.
        app.buttons["async let"].tap() // Choose the parallel mode.
        app.buttons["Load screen"].tap() // Start the load.
        app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Like")).firstMatch.tap() // A tap during the load still lands.
        XCTAssertTrue(text(startingWith: "loadScreen() returned").waitForExistence(timeout: 10)) // Finished.
        shot("3.7-watch-the-waiting") // Keep the screen.
        launch("3.7", card: 4) // Starting work with Task.
        app.buttons["Tap the button"].tap() // The four-line program.
        XCTAssertTrue(app.staticTexts["Task returned 4"].waitForExistence(timeout: 5)) // The last line.
        app.buttons["Start job"].tap() // A ten-step job.
        app.buttons["Cancel"].tap() // Cancel it partway.
        XCTAssertTrue(text(startingWith: "Cancelled after step").waitForExistence(timeout: 5)) // It stopped.
        shot("3.7-task") // Keep the screen.
        launch("3.7", card: 5) // Actors protect shared state.
        app.buttons["Run: 1,000 tasks call like()"].tap() // A thousand child tasks.
        XCTAssertTrue(text(containing: "-> 1000").waitForExistence(timeout: 10)) // Exactly 1000.
        shot("3.7-actor") // Keep the screen.
        launch("3.7", card: 6) // Race the counter.
        app.buttons["Step"].tap() // One micro-step.
        app.buttons["Run 1,000 times"].tap() // A thousand unprotected races.
        XCTAssertTrue(text(startingWith: "Lost updates in").waitForExistence(timeout: 10)) // Some lost updates.
        shot("3.7-race-unprotected") // Keep the screen.
        app.buttons["Actor"].tap() // Switch to the actor.
        app.buttons["Run 1,000 times"].tap() // A thousand actor races.
        XCTAssertTrue(app.staticTexts["All 1,000 runs ended at 10. The actor never loses an update."].waitForExistence(timeout: 10)) // Never.
        shot("3.7-race-actor") // Keep the screen.
        launch("3.7", card: 8) // A main-actor model with background work.
        app.buttons["await model.refresh()"].tap() // One-second background download.
        XCTAssertTrue(text(containing: "Lisbon").waitForExistence(timeout: 5)) // The forecast arrived.
        shot("3.7-forecast-model") // Keep the screen.
    }

    @MainActor // Required to use XCUIApplication.
    func testParadigmsLesson() { // Lesson 3.8.
        launch("3.8", card: 0) // One problem, five styles.
        flip("Gym (45 min)") // Gym is done now.
        XCTAssertTrue(wait(for: texts(containing: "Completed: 85 min"), atLeast: 5)) // All five styles agree; each row reads "Style, Completed: 85 min".
        XCTAssertTrue(text(containing: "Completed: 85 min, 0 open").exists) // The object adds its open count.
        shot("3.8-five-styles") // Keep the screen.
        launch("3.8", card: 5) // Declarative: TodayView.
        flip("Gym") // The toggle in the course's List.
        XCTAssertTrue(app.staticTexts["Completed: 85 min"].waitForExistence(timeout: 5)) // SwiftUI recomputed body.
        shot("3.8-declarative") // Keep the screen.
    }
}

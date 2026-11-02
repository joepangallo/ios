// DataKeeperTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks that the home screen lists each lesson once, in course order, with a
//       real summary, plus shared helpers the other test files use.
// Where: the DataKeeperTests target, which can see the app's code through @testable import.
// When: only when tests run; test code never ships inside the app.
// Why: a broken lesson list would hide a whole screen from students.

import Foundation // URL, FileManager and UUID for the helpers.
import Testing // Swift Testing: @Test and #expect.
@testable import DataKeeper // Lets the tests see the app's internal types.

@MainActor // The app's types live on the main actor (the app target's default isolation), so the suite runs there too.
struct CatalogTests { // A suite: related tests grouped in one type.
    @Test func lessonNumbersAreUnique() { // One test; its name says what it checks.
        let numbers = ContentView.lessons.map(\.number) // Every lesson number in the catalog.
        #expect(Set(numbers).count == numbers.count) // A set drops duplicates, so the counts match only when all are unique.
    }

    @Test func lessonsAreInCourseOrder() { // The module has eight lessons, 6.1 to 6.8.
        #expect(ContentView.lessons.map(\.number) == ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8"]) // Exactly the course's numbers.
    }

    @Test func everyLessonHasARealSummary() { // No placeholder text may remain.
        for lesson in ContentView.lessons { // Each lesson in turn.
            #expect(!lesson.summary.contains("Coming soon")) // The placeholder is gone.
            #expect(lesson.summary.hasSuffix(".")) // One plain sentence ends with a period.
        }
    }
}

/// A fresh, empty folder in tmp for one test, removed by the caller.
func makeTemporaryFolder() throws -> URL { // Every file test gets its own folder, so tests never collide.
    let folder = FileManager.default.temporaryDirectory.appending(path: "DataKeeperTests-\(UUID().uuidString)") // A unique name.
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true) // Creates it.
    return folder // The caller removes it with defer.
}

// SwiftBasicsTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks that the home screen lists each lesson once, in course order,
//       with a real summary, plus a shared helper the other test files use.
// Where: the SwiftBasicsTests target, which can see the app's code through @testable import.
// When: only when tests run; test code never ships inside the app.
// Why: a broken lesson list would hide a whole screen from students.

import Testing // Swift Testing: @Test and #expect.
@testable import SwiftBasics // Lets the tests see the app's internal types.

/// Runs a program and returns its output as one string, lines joined by newlines.
@MainActor // Program belongs to the app's main actor, so this helper runs there too.
func output(of program: Program) -> String { // Used by every lesson's tests.
    program.run().text // The console text, ready to compare with the course's expected output.
}

@MainActor // The app's types live on the main actor (the app target's default isolation), so the suite runs there too.
struct CatalogTests { // A suite: related tests grouped in one type.
    @Test func lessonNumbersAreUnique() { // One test; its name says what it checks.
        let numbers = ContentView.lessons.map(\.number) // Every lesson number in the catalog.
        #expect(Set(numbers).count == numbers.count) // A set drops duplicates, so the counts match only when all are unique.
    }

    @Test func lessonsAreInCourseOrder() { // The list must match the course page.
        #expect(ContentView.lessons.map(\.number) == ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7"]) // Lessons 1 to 7 of module 2.
    }

    @Test func everyLessonHasARealSummary() { // No placeholder text may remain.
        for lesson in ContentView.lessons { // Each row on the home screen.
            #expect(!lesson.summary.isEmpty) // Something to read...
            #expect(!lesson.summary.contains("Coming soon")) // ...and not the generator's placeholder.
            #expect(lesson.summary.hasSuffix(".")) // One complete sentence.
        }
    }

    @Test func titlesMatchTheCourse() { // Titles are copied from the course and must stay exact.
        #expect(ContentView.lessons.map(\.title) == [ // In order.
            "Values, Types and Your First Program", // 2.1
            "Numbers, Operators and Strings", // 2.2
            "Optionals: Values That Might Be Missing", // 2.3
            "Arrays, Dictionaries and Sets", // 2.4
            "Decisions and Loops", // 2.5
            "Functions", // 2.6
            "Closures and Higher-Order Functions", // 2.7
        ])
    }
}

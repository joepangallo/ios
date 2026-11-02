// EcosystemTourTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks that the home screen lists each lesson once, in course order,
//       with a real summary instead of a placeholder.
// Where: the EcosystemTourTests target, which can see the app's code through @testable import.
// When: only when tests run; test code never ships inside the app.
// Why: a broken lesson list would hide a whole screen from students.

import Testing // Swift Testing: @Test and #expect.
@testable import EcosystemTour // Lets the tests see the app's internal types.

@MainActor // The app's types live on the main actor (the app target's default isolation), so the suite runs there too.
struct CatalogTests { // A suite: related tests grouped in one type.
    @Test func lessonNumbersAreUnique() { // One test; its name says what it checks.
        let numbers = ContentView.lessons.map(\.number) // Every lesson number in the catalog.
        #expect(Set(numbers).count == numbers.count) // A set drops duplicates, so the counts match only when all are unique.
    }

    @Test func lessonsFollowTheCourseOrder() { // Modules 0 and 1, without the Worked Examples lessons.
        #expect(ContentView.lessons.map(\.number) == ["0.1", "0.2", "1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7"]) // The course's numbering.
    }

    @Test func titlesMatchTheCoursePage() { // Titles are copied exactly.
        #expect(ContentView.lessons.first?.title == "Welcome to iOS Development") // The first lesson.
        #expect(ContentView.lessons.last?.title == "Swift Beyond the iPhone") // The last lesson.
    }

    @Test func everyLessonHasARealSummary() { // No placeholder text is left.
        for lesson in ContentView.lessons { // Each row of the home screen.
            #expect(lesson.summary != "Coming soon.") // The scaffold's placeholder is gone.
            #expect(lesson.summary.hasSuffix(".")) // One full sentence.
        }
    }
}

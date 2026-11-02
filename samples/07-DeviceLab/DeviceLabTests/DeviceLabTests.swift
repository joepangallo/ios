// DeviceLabTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks that the home screen lists each lesson once, in course order, with the
//       course's exact numbers and titles and a real summary for every screen.
// Where: the DeviceLabTests target, which can see the app's code through @testable import.
// When: only when tests run; test code never ships inside the app.
// Why: a broken lesson list would hide a whole screen from students.

import Testing // Swift Testing: @Test and #expect.
@testable import DeviceLab // Lets the tests see the app's internal types.

@MainActor // The app's types live on the main actor (the app target's default isolation), so the suite runs there too.
struct CatalogTests { // A suite: related tests grouped in one type.
    @Test func lessonNumbersAreUnique() { // One test; its name says what it checks.
        let numbers = ContentView.lessons.map(\.number) // Every lesson number in the catalog.
        #expect(Set(numbers).count == numbers.count) // A set drops duplicates, so the counts match only when all are unique.
    }

    @Test func lessonsMatchTheCourseInOrder() { // Numbers and titles copied from the course page.
        let expected = [ // The seven topic lessons of module 7.
            ("7.1", "Permission and Privacy"), // Lesson 1.
            ("7.2", "Core Location, the Modern Way"), // Lesson 2.
            ("7.3", "MapKit for SwiftUI"), // Lesson 3.
            ("7.4", "Cloud Storage with CloudKit"), // Lesson 4.
            ("7.5", "Photos, Camera and Sharing"), // Lesson 5.
            ("7.6", "On-Device Intelligence"), // Lesson 6.
            ("7.7", "Beyond the App: Widgets, Intents and Notifications"), // Lesson 7.
        ]
        #expect(ContentView.lessons.map(\.number) == expected.map(\.0)) // Same numbers, same order.
        #expect(ContentView.lessons.map(\.title) == expected.map(\.1)) // Same titles, same order.
    }

    @Test func everyLessonHasARealSummary() { // No placeholder text may remain.
        for lesson in ContentView.lessons { // Each row.
            #expect(!lesson.summary.contains("Coming soon")) // The scaffold's placeholder is gone.
            #expect(lesson.summary.hasSuffix(".")) // One full sentence.
        }
    }
}

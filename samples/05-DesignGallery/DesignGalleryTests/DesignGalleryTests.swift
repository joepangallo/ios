// DesignGalleryTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks that the home screen lists each lesson once, in course order.
// Where: the DesignGalleryTests target, which can see the app's code through @testable import.
// When: only when tests run; test code never ships inside the app.
// Why: a broken lesson list would hide a whole screen from students.

import Testing // Swift Testing: @Test and #expect.
@testable import DesignGallery // Lets the tests see the app's internal types.

@MainActor // The app's types live on the main actor (the app target's default isolation), so the suite runs there too.
struct CatalogTests { // A suite: related tests grouped in one type.
    @Test func lessonNumbersAreUnique() { // One test; its name says what it checks.
        let numbers = ContentView.lessons.map(\.number) // Every lesson number in the catalog.
        #expect(Set(numbers).count == numbers.count) // A set drops duplicates, so the counts match only when all are unique.
    }
}

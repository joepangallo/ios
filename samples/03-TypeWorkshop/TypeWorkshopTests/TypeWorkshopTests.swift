// TypeWorkshopTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks that the home screen lists each lesson once, in course order,
//       with the course's numbers and titles and a real summary; also checks
//       the small helpers in LabKit.swift.
// Where: the TypeWorkshopTests target, which can see the app's code through @testable import.
// When: only when tests run; test code never ships inside the app.
// Why: a broken lesson list would hide a whole screen from students.

import Testing // Swift Testing: @Test and #expect.
@testable import TypeWorkshop // Lets the tests see the app's internal types.

@MainActor // The app's types live on the main actor (the app target's default isolation), so the suite runs there too.
struct CatalogTests { // A suite: related tests grouped in one type.
    @Test func lessonNumbersAreUnique() { // One test; its name says what it checks.
        let numbers = ContentView.lessons.map(\.number) // Every lesson number in the catalog.
        #expect(Set(numbers).count == numbers.count) // A set drops duplicates, so the counts match only when all are unique.
    }

    @Test func lessonsMatchTheCourseInOrder() { // Numbers and titles copied exactly from the course.
        let expected = [ // The course's module 3 lessons, Worked Examples excluded.
            ("3.1", "Structs: Your Own Value Types"), // Lesson 1.
            ("3.2", "Classes and Reference Semantics"), // Lesson 2.
            ("3.3", "Enums: Modeling Choices and State"), // Lesson 3.
            ("3.4", "Protocols and Protocol-Oriented Design"), // Lesson 4.
            ("3.5", "Generics: Write It Once, Keep the Types"), // Lesson 5.
            ("3.6", "Error Handling"), // Lesson 6.
            ("3.7", "Concurrency: async/await and Actors"), // Lesson 7.
            ("3.8", "Programming Paradigms in Swift"), // Lesson 8.
        ]
        #expect(ContentView.lessons.map(\.number) == expected.map(\.0)) // Same numbers, same order.
        #expect(ContentView.lessons.map(\.title) == expected.map(\.1)) // Same titles, same order.
    }

    @Test func everyLessonHasARealSummary() { // No placeholder text may remain.
        for lesson in ContentView.lessons { // Check each row.
            #expect(!lesson.summary.contains("Coming soon")) // The placeholder is gone.
            #expect(lesson.summary.hasSuffix(".")) // One full sentence.
            #expect(lesson.id == lesson.number) // The number is the identity.
        }
    }
}

@MainActor // ConsoleLog is main-actor isolated.
struct LabKitTests { // The shared helpers.
    @Test func transcriptTextJoinsLinesWithLineBreaks() { // The form every program test compares.
        var transcript = Transcript() // Empty at first.
        #expect(transcript.text == "") // Nothing printed yet.
        transcript.print("a", 1, separator: "-") // A custom separator, like print's.
        transcript.print(true) // Any value becomes its description.
        #expect(transcript.text == "a-1\ntrue") // Two lines.
    }

    @Test func consoleLogPrintsAndClears() { // The shared console used by async programs.
        let console = ConsoleLog() // Empty at first.
        console.print("Left:", 30.0) // The default separator is a space.
        console.print("x", "y", separator: ", ") // A custom separator.
        #expect(console.lines == ["Left: 30.0", "x, y"]) // Both lines, in order.
        #expect(console.text == "Left: 30.0\nx, y") // Joined with a line break.
        console.clear() // Forget everything.
        #expect(console.lines.isEmpty) // Empty again.
    }
}

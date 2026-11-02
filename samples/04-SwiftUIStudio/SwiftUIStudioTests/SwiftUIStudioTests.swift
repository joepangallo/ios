// SwiftUIStudioTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks that the home screen lists each lesson once, in course order, with a
//       real summary; plus the small pure helpers that live next to lesson views.
// Where: the SwiftUIStudioTests target, which can see the app's code through @testable import.
// When: only when tests run; test code never ships inside the app.
// Why: a broken lesson list would hide a whole screen from students.

import Testing // Swift Testing: @Test and #expect.
@testable import SwiftUIStudio // Lets the tests see the app's internal types.

@MainActor // The app's types live on the main actor (the app target's default isolation), so the suite runs there too.
struct CatalogTests { // A suite: related tests grouped in one type.
    @Test func lessonNumbersAreUnique() { // One test; its name says what it checks.
        let numbers = ContentView.lessons.map(\.number) // Every lesson number in the catalog.
        #expect(Set(numbers).count == numbers.count) // A set drops duplicates, so the counts match only when all are unique.
    }

    @Test func lessonsAreInCourseOrder() { // Module 4 has lessons 4.1 to 4.9 (the worked examples are not a screen).
        #expect(ContentView.lessons.map(\.number) == ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "4.9"]) // Exactly these, in this order.
    }

    @Test func titlesMatchTheCourse() { // Titles are copied from the course page, word for word.
        let titles = ContentView.lessons.map(\.title) // Every title.
        #expect(titles == [ // The course's titles.
            "Describe the Screen, Not the Steps", "Views and Modifiers", "Stacks, Frames, and Grids", // 4.1 to 4.3.
            "State Drives the Screen", "Observable Models", "Lists and Dynamic Data", // 4.4 to 4.6.
            "Navigation, Tabs, and Sheets", "Forms and Input", "Motion, Adaptivity, and Liquid Glass", // 4.7 to 4.9.
        ]) // End of the expected titles.
    }

    @Test func everySummaryIsReal() { // No placeholder text may reach students.
        for lesson in ContentView.lessons { // Each lesson in turn.
            #expect(!lesson.summary.isEmpty) // Something is written.
            #expect(!lesson.summary.contains("Coming soon")) // And it is not the placeholder.
            #expect(lesson.summary.hasSuffix(".")) // One plain sentence ends with a period.
        }
    }

    @Test func lessonIdentityIsItsNumber() { // CourseKit's Lesson uses the number as its id.
        let lesson = ContentView.lessons[2] // Lesson 4.3.
        #expect(lesson.id == "4.3") // The id is the number.
    }
}

@MainActor // WelcomeCard is a view type, so this runs on the main actor.
struct ViewHelperTests { // Pure helpers that sit next to the lesson views.
    @Test func welcomeCardMessageMatchesTheCourse() { // `Text("\(name): \(streak)-day streak")`
        #expect(WelcomeCard.message(name: "Ada", streak: 3) == "Ada: 3-day streak") // Ada's card.
        #expect(WelcomeCard.message(name: "Grace", streak: 12) == "Grace: 12-day streak") // Grace's card.
    }

    @Test func cardTintHasTheCourseColors() { // .mint and the challenge's .yellow.
        #expect(CardTint.allCases.map(\.rawValue) == ["Mint", "Yellow"]) // Two choices, mint first.
    }
}

// ContentView.swift
// Who: SwiftUI shows this view first, inside the app's window.
// What: the home screen, listing every lesson this app demonstrates.
// Where: created by TypeWorkshopApp; each row opens one lesson screen.
// When: at launch, and again whenever the student returns to the list.
// Why: one screen per lesson, in course order, mirrors the course page.

import SwiftUI // SwiftUI provides View and Text.

struct ContentView: View { // The home screen.
    /// Every lesson in this app, numbered and titled exactly as on the course page.
    static let lessons: [Lesson] = [ // static: one shared list, also read by the tests.
        Lesson(number: "3.1", title: "Structs: Your Own Value Types", summary: "Edit a to-do item, price a coffee order, add songs with a mutating method and watch didSet log every temperature change."), // Lesson 1.
        Lesson(number: "3.2", title: "Classes and Reference Semantics", summary: "Deposit through two names for one account, run month end on a subclass, and copy a struct versus share a class while ARC counts references."), // Lesson 2.
        Lesson(number: "3.3", title: "Enums: Modeling Choices and State", summary: "Switch over coffee sizes, pick from allCases, build payments with associated values and load songs through a loading, loaded or failed screen."), // Lesson 3.
        Lesson(number: "3.4", title: "Protocols and Protocol-Oriented Design", summary: "Fill a cart of any Priced items, share with default behavior, sort Comparable tasks, decode JSON with Codable and compare some with any."), // Lesson 4.
        Lesson(number: "3.5", title: "Generics: Write It Once, Keep the Types", summary: "Run one generic function on Strings and Ints, push and pop a Stack, call constrained functions and rebuild Optional as Maybe."), // Lesson 5.
        Lesson(number: "3.6", title: "Error Handling", summary: "Make a withdrawal fail, see which catch runs, compare try? and try!, watch defer hide a spinner, switch over a Result and read friendly errors."), // Lesson 6.
        Lesson(number: "3.7", title: "Concurrency: async/await and Actors", summary: "Await a forecast, time sequential awaits against async let, freeze and unfreeze the main thread, cancel a task and land 1,000 actor likes."), // Lesson 7.
        Lesson(number: "3.8", title: "Programming Paradigms in Swift", summary: "Flip today's chores and watch the imperative, object-oriented, protocol-oriented, functional and declarative answers agree."), // Lesson 8.
    ]

    var body: some View { // Built once at launch.
        LessonCatalog(title: "Type Workshop", lessons: Self.lessons) { lesson in // The shared list from CourseKit.
            switch lesson.number { // Picks the screen for the tapped lesson.
            case "3.1": StructsLesson(lesson: lesson) // Structs: your own value types.
            case "3.2": ClassesLesson(lesson: lesson) // Classes and reference semantics.
            case "3.3": EnumsLesson(lesson: lesson) // Enums: modeling choices and state.
            case "3.4": ProtocolsLesson(lesson: lesson) // Protocols and protocol-oriented design.
            case "3.5": GenericsLesson(lesson: lesson) // Generics: write it once, keep the types.
            case "3.6": ErrorHandlingLesson(lesson: lesson) // Error handling.
            case "3.7": ConcurrencyLesson(lesson: lesson) // Concurrency: async/await and actors.
            case "3.8": ParadigmsLesson(lesson: lesson) // Programming paradigms in Swift.
            default: Text(lesson.title) // Never reached: every lesson above has a screen.
            }
        }
    }
}

#Preview { // Shows the home screen in Xcode's canvas.
    ContentView() // The whole list.
}

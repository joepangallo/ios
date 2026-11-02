// ContentView.swift
// Who: SwiftUI shows this view first, inside the app's window.
// What: the home screen, listing every lesson this app demonstrates.
// Where: created by SwiftBasicsApp; each row opens one lesson screen.
// When: at launch, and again whenever the student returns to the list.
// Why: one screen per lesson, in course order, mirrors the course page.

import SwiftUI // SwiftUI provides View and Text.

struct ContentView: View { // The home screen.
    /// Every lesson in this app, numbered and titled exactly as on the course page.
    static let lessons: [Lesson] = [ // static: one shared list, also read by the tests.
        Lesson(number: "2.1", title: "Values, Types and Your First Program", summary: "Run your first prints, change let and var values, see what type Swift infers, and convert between Int and Double on purpose."), // Lesson 1.
        Lesson(number: "2.2", title: "Numbers, Operators and Strings", summary: "Change the numbers and text in each operator, string and formatting example, predict the output, then run it."), // Lesson 2.
        Lesson(number: "2.3", title: "Optionals: Values That Might Be Missing", summary: "Open optionals with if let, guard let, ?? and ?., and watch a force unwrap fail safely instead of crashing the app."), // Lesson 3.
        Lesson(number: "2.4", title: "Arrays, Dictionaries and Sets", summary: "Build, search and change arrays, dictionaries and sets, and see that a copied collection is independent."), // Lesson 4.
        Lesson(number: "2.5", title: "Decisions and Loops", summary: "Steer if, switch and loops with your own values, and step through a loop one line at a time."), // Lesson 5.
        Lesson(number: "2.6", title: "Functions", summary: "Call functions with labels, defaults, tuples and inout, pass functions as values, and watch recursion count down."), // Lesson 6.
        Lesson(number: "2.7", title: "Closures and Higher-Order Functions", summary: "Climb the closure syntax ladder, chain map, filter and reduce, and tap counters that capture their own state."), // Lesson 7.
    ]

    var body: some View { // Built once at launch.
        LessonCatalog(title: "Swift Basics", lessons: Self.lessons) { lesson in // The shared list from CourseKit.
            switch lesson.number { // Picks the screen for the tapped lesson.
            case "2.1": ValuesTypesLesson(lesson: lesson) // Values, types, let and var.
            case "2.2": NumbersOperatorsStringsLesson(lesson: lesson) // Operators and strings.
            case "2.3": OptionalsLesson(lesson: lesson) // Optionals.
            case "2.4": ArraysDictionariesSetsLesson(lesson: lesson) // Collections.
            case "2.5": DecisionsLoopsLesson(lesson: lesson) // Control flow.
            case "2.6": FunctionsLesson(lesson: lesson) // Functions.
            case "2.7": ClosuresLesson(lesson: lesson) // Closures.
            default: Text(lesson.title) // Unreachable: every number above has a screen.
            }
        }
    }
}

#Preview { // Shows the home screen in Xcode's canvas.
    ContentView() // The whole list.
}

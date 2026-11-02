// ContentView.swift
// Who: SwiftUI shows this view first, inside the app's window.
// What: the home screen, listing every lesson this app demonstrates.
// Where: created by SwiftUIStudioApp; each row opens one lesson screen.
// When: at launch, and again whenever the student returns to the list.
// Why: one screen per lesson, in course order, mirrors the course page.

import SwiftUI // SwiftUI provides View and Text.

struct ContentView: View { // The home screen.
    /// Every lesson in this app, numbered and titled exactly as on the course page.
    static let lessons: [Lesson] = [ // static: one shared list, also read by the tests.
        Lesson(number: "4.1", title: "Describe the Screen, Not the Steps", summary: "Compare a UIKit counter with a SwiftUI one, watch body re-run, and reshape a view tree."), // The first lesson: declarative screens.
        Lesson(number: "4.2", title: "Views and Modifiers", summary: "Style text, symbols, labels and buttons, and reorder modifiers to see how each one wraps the view."), // Built-in views and modifier order.
        Lesson(number: "4.3", title: "Stacks, Frames, and Grids", summary: "Arrange views with stacks, alignment, spacing, Spacer and frames, then scroll a lazy grid."), // Layout.
        Lesson(number: "4.4", title: "State Drives the Screen", summary: "Change @State, derive values instead of copying them, and share state with a child through @Binding."), // @State and @Binding.
        Lesson(number: "4.5", title: "Observable Models", summary: "Drive views from an @Observable coffee order, edit it with @Bindable, share it through the environment, and count which views re-run."), // @Observable, @Bindable, @Environment.
        Lesson(number: "4.6", title: "Lists and Dynamic Data", summary: "Build lists from identifiable data, group them in sections, swipe to delete or mark done, and search."), // List, ForEach, Section, swipe, search.
        Lesson(number: "4.7", title: "Navigation, Tabs, and Sheets", summary: "Open a navigation stack, value-based links, a tab bar and a sheet, watch the path array, and confirm before resetting."), // Push, tabs, sheets, alerts.
        Lesson(number: "4.8", title: "Forms and Input", summary: "Fill in forms with text fields, toggles, pickers, steppers and dates, and watch validation enable the button."), // Form controls and validation.
        Lesson(number: "4.9", title: "Motion, Adaptivity, and Liquid Glass", summary: "Animate changes of state, try transitions and text sizes, let ViewThatFits choose, and place controls on Liquid Glass."), // Animation, adaptivity, Liquid Glass.
    ]

    var body: some View { // Built once at launch.
        LessonCatalog(title: "SwiftUI Studio", lessons: Self.lessons) { lesson in // The shared list from CourseKit.
            switch lesson.number { // Picks the screen for the tapped lesson.
            case "4.1": DescribeTheScreenLesson(lesson: lesson) // Describe the Screen, Not the Steps.
            case "4.2": ViewsAndModifiersLesson(lesson: lesson) // Views and Modifiers.
            case "4.3": StacksFramesGridsLesson(lesson: lesson) // Stacks, Frames, and Grids.
            case "4.4": StateDrivesTheScreenLesson(lesson: lesson) // State Drives the Screen.
            case "4.5": ObservableModelsLesson(lesson: lesson) // Observable Models.
            case "4.6": ListsAndDynamicDataLesson(lesson: lesson) // Lists and Dynamic Data.
            case "4.7": NavigationTabsSheetsLesson(lesson: lesson) // Navigation, Tabs, and Sheets.
            case "4.8": FormsAndInputLesson(lesson: lesson) // Forms and Input.
            case "4.9": MotionAdaptivityGlassLesson(lesson: lesson) // Motion, Adaptivity, and Liquid Glass.
            default: ContentUnavailableView(lesson.title, systemImage: "questionmark.folder") // Only reachable if a lesson is added to the list without a screen.
            }
        }
    }
}

#Preview { // Shows the home screen in Xcode's canvas.
    ContentView() // The whole list.
}

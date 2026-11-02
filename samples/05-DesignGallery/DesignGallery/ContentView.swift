// ContentView.swift
// Who: SwiftUI shows this view first, inside the app's window.
// What: the home screen, listing every lesson this app demonstrates.
// Where: created by DesignGalleryApp; each row opens one lesson screen.
// When: at launch, and again whenever the student returns to the list.
// Why: one screen per lesson, in course order, mirrors the course page.

import SwiftUI // SwiftUI provides View and Text.

struct ContentView: View { // The home screen.
    /// Every lesson in this app, numbered and titled exactly as on the course page.
    static let lessons: [Lesson] = [ // static: one shared list, also read by the tests.
        Lesson(number: "5.1", title: "Principles of iOS Design", summary: "Squint at a checkout, nest rounded corners, and open a settings screen that adapts for free."), // Hierarchy, harmony, consistency.
        Lesson(number: "5.2", title: "Liquid Glass", summary: "Float controls on regular and clear glass, group and morph them, and see why glass on glass fails."), // The iOS 26 material.
        Lesson(number: "5.3", title: "Typography and Dynamic Type", summary: "Drag through all twelve text sizes and watch text styles grow while fixed sizes freeze."), // Text styles.
        Lesson(number: "5.4", title: "Color, Dark Mode, and Contrast", summary: "Flip cards between Light and Dark, measure contrast ratios, and fix colors that fail."), // Semantic color.
        Lesson(number: "5.5", title: "Layout, Spacing, and Touch Targets", summary: "See the safe areas, group content with three spacing values, and tap-test 44-point targets."), // Layout.
        Lesson(number: "5.6", title: "SF Symbols and App Icons", summary: "Tune symbol weight and scale, try rendering modes and effects, and label icon-only buttons."), // Symbols.
        Lesson(number: "5.7", title: "Choosing a Navigation Pattern", summary: "Open a real tab bar, stack and sheet, then pick the right pattern for eight apps."), // Navigation.
        Lesson(number: "5.8", title: "States, Feedback, and Clear Copy", summary: "Walk a screen through its five states, rewrite vague errors, and confirm a delete."), // States.
        Lesson(number: "5.9", title: "Designing for Accessibility", summary: "Hear what VoiceOver says, label icon buttons, and respect Reduce Motion and color settings."), // Accessibility.
        Lesson(number: "5.10", title: "Process, Prototypes, and Critique", summary: "Write a checkable requirement, run a wireframe, and critique an invoices screen."), // Process.
    ]

    var body: some View { // Built once at launch.
        LessonCatalog(title: "Design Gallery", lessons: Self.lessons) { lesson in // The shared list from CourseKit.
            switch lesson.number { // Picks the screen for the tapped lesson.
            case "5.1": PrinciplesLesson(lesson: lesson) // Principles of iOS Design.
            case "5.2": LiquidGlassLesson(lesson: lesson) // Liquid Glass.
            case "5.3": TypographyLesson(lesson: lesson) // Typography and Dynamic Type.
            case "5.4": ColorContrastLesson(lesson: lesson) // Color, Dark Mode, and Contrast.
            case "5.5": LayoutSpacingLesson(lesson: lesson) // Layout, Spacing, and Touch Targets.
            case "5.6": SymbolsIconsLesson(lesson: lesson) // SF Symbols and App Icons.
            case "5.7": NavigationPatternsLesson(lesson: lesson) // Choosing a Navigation Pattern.
            case "5.8": StatesFeedbackLesson(lesson: lesson) // States, Feedback, and Clear Copy.
            case "5.9": AccessibilityLesson(lesson: lesson) // Designing for Accessibility.
            case "5.10": ProcessCritiqueLesson(lesson: lesson) // Process, Prototypes, and Critique.
            default: Text(lesson.title) // A lesson number this app does not know; never expected.
            }
        }
    }
}

#Preview { // Shows the home screen in Xcode's canvas.
    ContentView() // The whole list.
}

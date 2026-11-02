// ContentView.swift
// Who: SwiftUI shows this view first, inside the app's window.
// What: the home screen, listing every lesson this app demonstrates.
// Where: created by DataKeeperApp; each row opens one lesson screen.
// When: at launch, and again whenever the student returns to the list.
// Why: one screen per lesson, in course order, mirrors the course page.

import SwiftUI // SwiftUI provides View and Text.
import SwiftData // The preview below attaches an in-memory container.

struct ContentView: View { // The home screen.
    /// Every lesson in this app, numbered and titled exactly as on the course page.
    static let lessons: [Lesson] = [ // static: one shared list, also read by the tests.
        Lesson(number: "6.1", title: "Where App Data Lives", summary: "See the six places data can live, explore this app's real sandbox folders, and watch a draft save itself when the app goes to the background."), // Lesson 1.
        Lesson(number: "6.2", title: "Settings with @AppStorage", summary: "Write and read UserDefaults, keep an onboarding flag across launches, pick a theme for the whole app, and edit a settings form that remembers every value."), // Lesson 2.
        Lesson(number: "6.3", title: "Codable and JSON", summary: "Encode a struct to pretty-printed JSON, decode arrays and nested objects, break JSON on purpose to read each DecodingError, and parse ISO 8601 dates."), // Lesson 3.
        Lesson(number: "6.4", title: "Reading and Writing Files", summary: "Write and read files in Documents, save Codable notes to notes.json, crash a save on purpose, and handle a missing or damaged file."), // Lesson 4.
        Lesson(number: "6.5", title: "SwiftData Fundamentals", summary: "Add, complete, delete, sort and filter real SwiftData tasks, watch pending changes reach the database file, and clear completed tasks from code."), // Lesson 5.
        Lesson(number: "6.6", title: "Relationships and Schema Changes", summary: "Link folders and notes, compare delete rules, edit a note with @Bindable, build an in-memory container, and run a real schema migration."), // Lesson 6.
        Lesson(number: "6.7", title: "Secrets in the Keychain", summary: "Save, update, read and delete a sample token in this app's Keychain, and see every status code the Security framework returns."), // Lesson 7.
        Lesson(number: "6.8", title: "iCloud and CloudKit Sync", summary: "Save and query CloudKit records, check a model for sync readiness, and resolve offline edits between two devices, all in a clearly labeled simulated mode."), // Lesson 8.
    ]

    var body: some View { // Built once at launch.
        LessonCatalog(title: "Data Keeper", lessons: Self.lessons) { lesson in // The shared list from CourseKit.
            switch lesson.number { // Picks the screen for the tapped lesson.
            case "6.1": WhereAppDataLivesLesson(lesson: lesson) // Storage landscape and the sandbox.
            case "6.2": SettingsWithAppStorageLesson(lesson: lesson) // UserDefaults and @AppStorage.
            case "6.3": CodableAndJSONLesson(lesson: lesson) // Encoding and decoding.
            case "6.4": ReadingAndWritingFilesLesson(lesson: lesson) // FileManager and Codable files.
            case "6.5": SwiftDataFundamentalsLesson(lesson: lesson) // Models, queries and the context.
            case "6.6": RelationshipsAndSchemaChangesLesson(lesson: lesson) // Relationships and migrations.
            case "6.7": SecretsInTheKeychainLesson(lesson: lesson) // The Keychain wrapper.
            case "6.8": ICloudAndCloudKitSyncLesson(lesson: lesson) // CloudKit, simulated.
            default: Text(lesson.title) // Never reached: every lesson above has a screen.
            }
        }
    }
}

#Preview { // Shows the home screen in Xcode's canvas.
    ContentView() // The whole list.
        .modelContainer(for: [TaskItem.self, Folder.self, Note.self], inMemory: true) // Previews use a throwaway database.
}

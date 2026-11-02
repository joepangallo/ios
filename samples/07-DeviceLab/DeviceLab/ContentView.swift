// ContentView.swift
// Who: SwiftUI shows this view first, inside the app's window.
// What: the home screen, listing every lesson this app demonstrates.
// Where: created by DeviceLabApp; each row opens one lesson screen.
// When: at launch, and again whenever the student returns to the list.
// Why: one screen per lesson, in course order, mirrors the course page.

import SwiftUI // SwiftUI provides View and Text.

struct ContentView: View { // The home screen.
    /// Every lesson in this app, numbered and titled exactly as on the course page.
    static let lessons: [Lesson] = [ // static: one shared list, also read by the tests.
        Lesson(number: "7.1", title: "Permission and Privacy", summary: "Read this app's real permission answers, run the course's status switch, replay a whole permission journey, try a priming screen and open Settings."), // Lesson 1 of the Device APIs module.
        Lesson(number: "7.2", title: "Core Location, the Modern Way", summary: "Stream live positions into an observable model, step through its loop body for every update flag, measure distances and turn coordinates into a place name."), // Lesson 2 of the Device APIs module.
        Lesson(number: "7.3", title: "MapKit for SwiftUI", summary: "Drop markers and annotations, fly the camera in 3D, build a map by hand, search for places and draw a walking route with a Look Around preview."), // Lesson 3 of the Device APIs module.
        Lesson(number: "7.4", title: "Cloud Storage with CloudKit", summary: "Check an iCloud account, save and query grocery records, handle CloudKit errors and sync a setting between two devices, all in a clearly labeled simulated mode."), // Lesson 4 of the Device APIs module.
        Lesson(number: "7.5", title: "Photos, Camera and Sharing", summary: "Pick a photo and load it two ways, see what your app actually receives, check camera permission and share a trail link or photo with ShareLink."), // Lesson 5 of the Device APIs module.
        Lesson(number: "7.6", title: "On-Device Intelligence", summary: "Check whether the on-device language model can run, ask it for trip ideas when it can, compare plain text with guided generation and read a trail sign with Vision."), // Lesson 6 of the Device APIs module.
        Lesson(number: "7.7", title: "Beyond the App: Widgets, Intents and Notifications", summary: "Watch a widget timeline across a day, run an App Intent, start a hike Live Activity and schedule a local notification."), // Lesson 7 of the Device APIs module.
    ]

    var body: some View { // Built once at launch.
        LessonCatalog(title: "Device Lab", lessons: Self.lessons) { lesson in // The shared list from CourseKit.
            switch lesson.number { // Picks the screen for the tapped lesson.
            case "7.1": PermissionPrivacyLesson(lesson: lesson) // Permission and privacy.
            case "7.2": CoreLocationLesson(lesson: lesson) // Core Location.
            case "7.3": MapKitSwiftUILesson(lesson: lesson) // MapKit for SwiftUI.
            case "7.4": CloudKitLesson(lesson: lesson) // CloudKit, in simulated mode.
            case "7.5": PhotosCameraSharingLesson(lesson: lesson) // Photos, camera and sharing.
            case "7.6": OnDeviceIntelligenceLesson(lesson: lesson) // On-device intelligence.
            case "7.7": WidgetsIntentsNotificationsLesson(lesson: lesson) // Widgets, intents and notifications.
            default: Text(lesson.title) // Never reached: every lesson above has a screen.
            }
        }
    }
}

#Preview { // Shows the home screen in Xcode's canvas.
    ContentView() // The whole list.
}

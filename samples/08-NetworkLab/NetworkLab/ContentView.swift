// ContentView.swift
// Who: SwiftUI shows this view first, inside the app's window.
// What: the home screen, listing every lesson this app demonstrates.
// Where: created by NetworkLabApp; each row opens one lesson screen.
// When: at launch, and again whenever the student returns to the list.
// Why: one screen per lesson, in course order, mirrors the course page.

import SwiftUI // SwiftUI provides View and Text.

struct ContentView: View { // The home screen.
    /// Every lesson in this app, numbered and titled exactly as on the course page.
    static let lessons: [Lesson] = [ // static: one shared list, also read by the tests.
        Lesson(number: "8.1", title: "How an App Talks to a Server", summary: "Send a real request, measure its DNS, TCP, TLS and HTTP phases, and step through the round trips of HTTP/1.1, HTTP/2 and HTTP/3."), // Lesson 1.
        Lesson(number: "8.2", title: "Speaking HTTP", summary: "Build URLs, headers and a POST request, see them as raw HTTP text, and send each method to a practice API."), // Lesson 2.
        Lesson(number: "8.3", title: "REST Resources and JSON", summary: "Call REST routes for real, run the course's decoding programs, and break JSON on purpose to read each DecodingError."), // Lesson 3.
        Lesson(number: "8.4", title: "URLSession with async/await", summary: "Fetch, check and decode with async/await, watch each phase timed, and see .task cancel a load when its view disappears."), // Lesson 4.
        Lesson(number: "8.5", title: "Errors, Retries and Security", summary: "Cause real and simulated failures, retry with backoff, keep a POST safe to retry, and put a Keychain token in a request."), // Lesson 5.
        Lesson(number: "8.6", title: "Live Data Beyond Request and Response", summary: "Compare polling, WebSockets and push in a score lab, open a real WebSocket, stream a response line by line, and try push registration."), // Lesson 6.
        Lesson(number: "8.7", title: "Designing the API Layer", summary: "Inject a live or stub service into a paginating list, run its test, and watch URLCache answer from the cache or with a 304."), // Lesson 7.
    ]

    var body: some View { // Built once at launch.
        LessonCatalog(title: "Network Lab", lessons: Self.lessons) { lesson in // The shared list from CourseKit.
            switch lesson.number { // Picks the screen for the tapped lesson.
            case "8.1": AppTalksToServerLesson(lesson: lesson) // How an App Talks to a Server.
            case "8.2": SpeakingHTTPLesson(lesson: lesson) // Speaking HTTP.
            case "8.3": RESTResourcesJSONLesson(lesson: lesson) // REST Resources and JSON.
            case "8.4": URLSessionAsyncAwaitLesson(lesson: lesson) // URLSession with async/await.
            case "8.5": ErrorsRetriesSecurityLesson(lesson: lesson) // Errors, Retries and Security.
            case "8.6": LiveDataLesson(lesson: lesson) // Live Data Beyond Request and Response.
            case "8.7": APILayerLesson(lesson: lesson) // Designing the API Layer.
            default: Text(lesson.title) // Never reached: every lesson above has a screen.
            }
        }
    }
}

#Preview { // Shows the home screen in Xcode's canvas.
    ContentView() // The whole list.
}

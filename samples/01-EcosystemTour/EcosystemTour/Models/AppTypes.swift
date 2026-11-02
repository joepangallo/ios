// AppTypes.swift
// Who: lesson 1.6's "Match the idea to the app type" card, its "Inside this
//      app's bundle" list, and the tests.
// What: the course's ten product ideas with the kind of app or extension that
//       fits each, a matcher that scores answers, and a reader that finds the
//       app extensions shipped inside this app's bundle.
// Where: the Models folder.
// When: the matcher changes on each answer; the bundle is read when the card appears.
// Why: recognizing the shape of an idea early tells you which framework to
//      reach for; finding TourWidget.appex inside the app proves extensions
//      ship together with it.

import Foundation // Bundle and FileManager.

/// The kinds of app and extension the course's matcher offers.
enum AppKind: String, CaseIterable, Identifiable { // CaseIterable lists the choices.
    case utility, listDetail, document, game, widget, liveActivity, appClip, watch, share, intent // The course's ten kinds.
    var id: String { rawValue } // Case names are unique.

    /// The kind's name, as a choice.
    var label: String { // Shown on the buttons.
        switch self { // One name per kind.
        case .utility: "Utility app" // One focused task.
        case .listDetail: "List-detail data app" // Browse and drill in.
        case .document: "Document-based app" // Files the user owns.
        case .game: "Game" // Real-time graphics.
        case .widget: "Home Screen widget" // Glanceable information.
        case .liveActivity: "Live Activity" // An event in progress.
        case .appClip: "App Clip" // A slice without a full install.
        case .watch: "Apple Watch app" // On the wrist.
        case .share: "Share extension" // Content from other apps.
        case .intent: "App Intent for Siri and Shortcuts" // A voice or shortcut action.
        }
    }

    /// The kind's name with "a" or "an", for feedback sentences.
    var withArticle: String { // Such as "an App Clip".
        switch self { // The course's wording.
        case .utility: "a utility app" // Utility.
        case .listDetail: "a list-detail app" // List-detail.
        case .document: "a document-based app" // Document.
        case .game: "a game" // Game.
        case .widget: "a widget" // Widget.
        case .liveActivity: "a Live Activity" // Live Activity.
        case .appClip: "an App Clip" // App Clip.
        case .watch: "an Apple Watch app" // Watch.
        case .share: "a share extension" // Share.
        case .intent: "an App Intent" // Intent.
        }
    }
}

/// One product idea from the course, with its best fit and the tempting wrong answer.
struct AppIdea { // Plain data.
    let text: String // The idea.
    let answer: AppKind // The best fit.
    let framework: String // What you would build it with.
    let why: String // Why the answer fits.
    let tempting: AppKind // The most tempting wrong answer.
    let whyNot: String // Why the tempting answer falls short.

    /// The course's ten ideas.
    static let all: [AppIdea] = [ // static: one shared list.
        AppIdea(text: "Show how many glasses of water you drank today right on the Home Screen, without opening the app.", answer: .widget, framework: "WidgetKit, with a timeline provider your app reloads after each glass", why: "The number changes a few times a day and only needs a glance. A widget draws it from a timeline at almost no battery cost.", tempting: .liveActivity, whyNot: "A Live Activity is for an event with a clear end, like a delivery. A daily total that never finishes belongs in a widget."), // Idea 1.
        AppIdea(text: "Let customers follow their pizza from oven to doorstep on the Lock Screen and in the Dynamic Island.", answer: .liveActivity, framework: "ActivityKit, updated by the app or by push notifications", why: "An order in progress with frequent updates and a clear end is exactly what Live Activities are designed for.", tempting: .widget, whyNot: "Widgets refresh on a budget from a timeline and do not appear in the Dynamic Island, so they lag behind a fast-moving delivery."), // Idea 2.
        AppIdea(text: "Rent a scooter by tapping an NFC tag on its handlebar, with no full app download.", answer: .appClip, framework: "An App Clip target inside the main app, launched by NFC, a QR code, an App Clip Code or a link", why: "The customer is standing at the curb. An App Clip opens in seconds with just the rental flow, then offers the full app afterwards.", tempting: .utility, whyNot: "Asking someone to find and download a whole app at the curb loses most of them before the first ride."), // Idea 3.
        AppIdea(text: "Say \"Log a glass of water\" to Siri, or put that action on the iPhone's Action button.", answer: .intent, framework: "App Intents, with an AppShortcutsProvider that publishes the phrase", why: "Siri, Shortcuts, Spotlight and the Action button all run actions your app describes as App Intents.", tempting: .widget, whyNot: "A widget shows information. Voice commands and the Action button need an action, which is what an App Intent is."), // Idea 4.
        AppIdea(text: "A sketching app where every drawing is a file that people can open, rename and share from the Files app.", answer: .document, framework: "SwiftUI DocumentGroup with a FileDocument type", why: "Each drawing is a file the user owns. DocumentGroup gives you open, save, rename and Files integration for free.", tempting: .listDetail, whyNot: "A list-detail app keeps its data inside the app's own store; people could not see or share the drawings as files."), // Idea 5.
        AppIdea(text: "A physics puzzle where you fling 2D shapes to knock down towers.", answer: .game, framework: "SpriteKit, Apple's 2D game framework with built-in physics", why: "Real-time animation, collisions and a game loop running every frame need a game engine, not standard controls.", tempting: .utility, whyNot: "Buttons and lists cannot simulate gravity and collisions sixty or more times a second."), // Idea 6.
        AppIdea(text: "Save a recipe from a web page in Safari straight into your recipe app.", answer: .share, framework: "A share extension target, with a SwiftUI view for confirming the save", why: "The recipe starts in another app. A share extension puts your app in Safari's share sheet and receives the page.", tempting: .appClip, whyNot: "An App Clip is a quick slice of your app for people who do not have it yet. Here the user already has your app and needs to send it content."), // Idea 7.
        AppIdea(text: "Start, pause and follow a run's heart rate and pace on your wrist, without taking out your phone.", answer: .watch, framework: "A watchOS app in SwiftUI, with HealthKit workout sessions", why: "Controlling a workout and reading heart rate live happen on the wrist, with the watch's own sensors.", tempting: .liveActivity, whyNot: "A Live Activity can show progress, but starting a workout and reading the heart-rate sensor need a real watch app."), // Idea 8.
        AppIdea(text: "Browse 500 houseplants, search them, and open each one for care instructions.", answer: .listDetail, framework: "NavigationStack or NavigationSplitView over SwiftData or a bundled catalog, with .searchable", why: "A large collection to browse, search and drill into is the classic list-detail shape.", tempting: .document, whyNot: "There are no user-owned files to open and save; the plants are a catalog the app manages."), // Idea 9.
        AppIdea(text: "Split a restaurant bill and tip between friends on a single screen.", answer: .utility, framework: "Plain SwiftUI: a Form with a few @State values and computed totals", why: "One focused task with a handful of inputs and an instant answer is a utility app.", tempting: .listDetail, whyNot: "There is no collection to browse; adding navigation would only slow the task down."), // Idea 10.
    ]
}

/// The matcher: one idea at a time, one answer per idea, with a score.
struct AppTypeMatcher { // A value: every answer produces a new state.
    private(set) var order: [Int] // The order the ideas are shown in, as indexes into AppIdea.all.
    private(set) var position = 0 // Which idea in that order is showing.
    private(set) var picked: AppKind? = nil // The answer to the current idea; nil until chosen.
    private(set) var score = 0 // How many answers were right.

    init(order: [Int] = Array(AppIdea.all.indices)) { // Course order by default; tests rely on it.
        self.order = order // Remembers the order.
    }

    var current: AppIdea { AppIdea.all[order[position]] } // The idea on screen.
    var isLast: Bool { position == order.count - 1 } // Whether this is the tenth idea.
    var isCorrect: Bool { picked == current.answer } // Whether the pick was right.

    /// Records the answer to the current idea. Only the first pick counts.
    mutating func choose(_ kind: AppKind) { // One tap on a choice.
        guard picked == nil else { return } // Already answered.
        picked = kind // Remembers it.
        if kind == current.answer { score += 1 } // A point for a right answer.
    }

    /// The feedback for the current answer, built from the course's explanations.
    var feedback: String? { // nil until an answer is picked.
        guard let picked else { return nil } // Nothing to say yet.
        let idea = current // Shorter to read below.
        if picked == idea.answer { // Right.
            return "Yes: this is \(idea.answer.withArticle). \(idea.why) Build it with \(idea.framework). Why not \(idea.tempting.withArticle)? \(idea.whyNot)" // Explains the match and the trap.
        }
        let trap = picked == idea.tempting ? " \(idea.whyNot)" : "" // The tempting answer gets its own explanation.
        return "Not quite: this is \(idea.answer.withArticle), not \(picked.withArticle). \(idea.why)\(trap) Build it with \(idea.framework)." // Explains the right answer.
    }

    /// Moves to the next idea.
    mutating func next() { // After an answer.
        guard picked != nil, !isLast else { return } // Answer first; there is nothing after the last.
        position += 1 // The next idea.
        picked = nil // Unanswered.
    }

    /// Starts over, in a new random order, as the course's widget does.
    mutating func startOver() { // Shuffles the ten ideas.
        self = AppTypeMatcher(order: Array(AppIdea.all.indices).shuffled()) // A fresh matcher.
    }
}

/// Finds the app extensions packed inside an app bundle.
enum BundleContents { // A namespace.
    /// One extension found in the bundle's PlugIns folder.
    struct Extension: Identifiable { // Identifiable for ForEach.
        let fileName: String // Such as "TourWidget.appex".
        let pointIdentifier: String // Which system feature hosts it, from its Info.plist.
        var id: String { fileName } // File names are unique in one folder.
    }

    /// The .appex bundles in this app's PlugIns folder, with their extension points.
    static func extensions(in bundle: Bundle = .main) -> [Extension] { // The bundle is a parameter for flexibility.
        guard let folder = bundle.builtInPlugInsURL, // EcosystemTour.app/PlugIns.
              let names = try? FileManager.default.contentsOfDirectory(atPath: folder.path(percentEncoded: false)) // Everything inside it.
        else { return [] } // No PlugIns folder: no extensions.
        return names.filter { $0.hasSuffix(".appex") }.sorted().map { name in // Only app extensions; test bundles end in .xctest.
            let info = Bundle(url: folder.appending(path: name))?.object(forInfoDictionaryKey: "NSExtension") as? [String: Any] // The extension's NSExtension dictionary.
            return Extension(fileName: name, pointIdentifier: info?["NSExtensionPointIdentifier"] as? String ?? "unknown") // Which system feature runs it.
        }
    }
}

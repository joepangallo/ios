// WaterTimeline.swift
// Who: lesson 7.7's widget demos, and their unit tests.
// What: the timeline-building math from the Water widget's getTimeline (the same code
//       the widget extension runs), a clock-label helper, and a simulator that plays a
//       widget through a whole day with each reload policy.
// Where: the Models folder. The widget extension is a separate target the tests cannot
//        reach, so the logic it shares with the course is repeated here to be tested.
// When: whenever the student scrubs the clock, logs a glass or asks for a reload.
// Why: a widget shows frozen snapshots and changes only on schedule or after a reload,
//      which is easiest to understand by watching a day go by.

import Foundation // Date and TimeInterval.

/// One planned snapshot: when it shows, and what it says.
struct PlannedEntry: Equatable { // Like the widget's WaterEntry.
    let date: Date // When iOS should start showing it.
    let glasses: Int // The count frozen into it.
}

/// The Water widget's getTimeline math, as a pure function.
enum WaterTimelineBuilder { // A namespace.
    /// Entries spaced `step` seconds apart from `start`, each with the same glass count.
    static func entries(start: Date, step: TimeInterval = 3600, count: Int = 4, glasses: Int) -> [PlannedEntry] { // The widget uses 3600 and 4.
        (0..<count).map { i in // One entry per number.
            PlannedEntry(date: start + Double(i) * step, glasses: glasses) // 0, 1, 2... steps from the start.
        }
    }
}

/// The three reload policies the lesson compares.
enum ReloadPolicyChoice: String, CaseIterable, Identifiable { // Raw values are the labels.
    case atEnd = ".atEnd" // Ask again after the last entry passes.
    case afterTwoHours = ".after(start + 2 h)" // Ask again at a chosen time.
    case never = ".never" // Wait for the app to ask.
    var id: String { rawValue } // Unique.
}

/// A snapshot in the day simulator, timed in minutes after midnight.
struct SimEntry: Equatable { // Minutes keep the simulation exact.
    let minute: Int // When it shows.
    let glasses: Int // What it says.
}

/// A widget playing through a day. Times are minutes after midnight.
struct WidgetDaySimulator { // A value type: tests replay days on copies.
    static let entryCount = 4 // Entries per timeline, as in the widget.
    private(set) var clock: Int // The simulated time.
    var stepMinutes = 60 // Spacing between entries in the next timeline.
    var policy = ReloadPolicyChoice.atEnd // The policy for the next timeline.
    private(set) var appGlasses = 3 // What the app knows.
    private(set) var timeline: [SimEntry] = [] // The timeline the widget is showing.
    private(set) var timelineStart = 0 // When that timeline was built.
    private(set) var reloads = 0 // How many timelines have been built.
    private(set) var log: [String] = [] // What happened, oldest first.

    /// Starts the day with the widget just added at `start`.
    init(start: Int = 8 * 60) { // 8:00 by default.
        clock = start // The clock starts here.
        reload(because: "Widget added") // iOS asks for the first timeline at once.
    }

    /// The entry on screen: the last one whose time has come.
    var currentEntry: SimEntry? { timeline.last { $0.minute <= clock } } // nil only before the first entry.

    /// What the widget shows right now.
    var widgetGlasses: Int { currentEntry?.glasses ?? 0 } // The frozen count.

    /// The person logs a glass in the app; the widget does not change.
    mutating func logGlass() { // The app's own data changes at once.
        appGlasses += 1 // The app knows.
        log.append("\(Self.clockLabel(clock)) App: \(appGlasses) glasses. The widget still shows \(widgetGlasses): its snapshot is frozen.") // The lesson's point.
    }

    /// Moves the clock; the policy may make iOS ask for a new timeline.
    mutating func advance(to minute: Int) { // Called by the clock slider.
        clock = minute // Time passes.
        switch policy { // When does iOS ask again?
        case .atEnd: // After the last entry's time passes.
            if let last = timeline.last, clock > last.minute { reload(because: "Last entry passed (.atEnd)") } // Ask again.
        case .afterTwoHours: // At a chosen time.
            if clock >= timelineStart + 120 { reload(because: "Reload date reached (.after)") } // Ask again.
        case .never: // Never on its own.
            break // Only the app can trigger a reload.
        }
    }

    /// The app calls WidgetCenter.shared.reloadTimelines(ofKind: "Water").
    mutating func reloadTimelines() { // The app's way to refresh.
        reload(because: "App called reloadTimelines(ofKind: \"Water\")") // iOS asks the provider again.
    }

    /// Builds a fresh timeline from now, the way getTimeline does.
    private mutating func reload(because reason: String) { // Shared by every trigger.
        timelineStart = clock // This timeline begins now.
        timeline = (0..<Self.entryCount).map { SimEntry(minute: clock + $0 * stepMinutes, glasses: appGlasses) } // Four snapshots of the app's current count.
        reloads += 1 // Count it.
        log.append("\(Self.clockLabel(clock)) \(reason): getTimeline plans \(Self.entryCount) entries showing \(appGlasses)") // Record it.
    }

    /// The course's clock label: 540 minutes is "9:00", 570 is "9:30".
    static func clockLabel(_ total: Int) -> String { // From the course's widget worked example.
        let hour = total / 60 // Whole hours.
        let minute = total % 60 // Leftover minutes.
        if minute < 10 { return "\(hour):0\(minute)" } // Pad one-digit minutes.
        return "\(hour):\(minute)" // Two-digit minutes need no padding.
    }
}

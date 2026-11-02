// WaterProvider.swift
// Who: WidgetKit calls the provider; WaterWidget's view draws each entry.
// What: one timeline entry (a date and a glass count) and the provider that
//       hands WidgetKit a timeline of entries ahead of time.
// Where: the TourWidget extension, which has its own sandbox, separate from the app.
// When: WidgetKit asks for a placeholder while loading, a snapshot for the
//       gallery, and a timeline when the widget is added, when the last entry
//       is reached, and when the app asks for a reload.
// Why: widgets are drawn from snapshots, not from code that keeps running.
//      This provider runs in SIMULATED mode: reading the app's real count
//      would need an App Group, a capability of the paid developer program, so
//      it supplies a clearly labeled sample timeline instead.

import WidgetKit // TimelineEntry, TimelineProvider and Timeline.
import Foundation // Date and Calendar.

/// One moment in the widget's timeline: when to show it and what to show.
struct WaterEntry: TimelineEntry { // WidgetKit requires a date on every entry.
    let date: Date // When WidgetKit should start showing this entry.
    let glasses: Int // The glass count this entry shows.
    let isSample: Bool // True for the simulated timeline, so the view can say so.
}

/// Supplies the widget's entries. Runs in simulated mode, as explained above.
struct WaterProvider: TimelineProvider { // The data source named in WaterWidget's configuration.
    /// How many entries one sample timeline holds, and how far apart they are.
    static let sampleCount = 5 // Five entries...
    static let sampleSpacing: TimeInterval = 60 // ...one minute apart, so you can watch the widget change.

    /// A quick stand-in shown while the widget loads; drawn redacted, so its numbers do not matter.
    func placeholder(in context: Context) -> WaterEntry { // Must return at once, with no waiting.
        WaterEntry(date: .now, glasses: 0, isSample: true) // The course's placeholder: zero glasses.
    }

    /// One entry for the widget gallery's preview.
    func getSnapshot(in context: Context, completion: @escaping (WaterEntry) -> Void) { // completion hands the entry back.
        completion(WaterEntry(date: .now, glasses: 3, isSample: true)) // A friendly sample number for the gallery.
    }

    /// The timeline: dated entries WidgetKit will show in turn, with no code running in between.
    func getTimeline(in context: Context, completion: @escaping (Timeline<WaterEntry>) -> Void) { // Called when a new timeline is needed.
        let entries = Self.sampleEntries(startingAt: .now) // Five dated entries, starting now.
        completion(Timeline(entries: entries, policy: .atEnd)) // .atEnd: ask for a fresh timeline after the last entry.
    }

    /// The simulated timeline: glass counts 2 to 6, one minute apart.
    static func sampleEntries(startingAt start: Date) -> [WaterEntry] { // static: it needs no provider instance.
        (0..<sampleCount).map { index in // One entry per step.
            WaterEntry(date: start.addingTimeInterval(Double(index) * sampleSpacing), glasses: index + 2, isSample: true) // Each entry is one minute later and one glass more; starting at 2 keeps "glasses" plural.
        }
    }
}

// WaterWidget.swift
// Who: WidgetKit, which loads this extension and asks it for timelines; people see
//      the result when they add the Water widget to the Home Screen.
// What: the course's Water widget: a timeline entry, a timeline provider that plans
//       four hourly snapshots, the view that draws one entry, and the widget declaration.
// Where: the DeviceLabWidget extension target, a separate small program bundled
//        inside the app. It cannot see the app's memory or files.
// When: iOS calls the provider when the widget is added, when the reload policy says
//       so, and when the app calls WidgetCenter.shared.reloadTimelines(ofKind: "Water").
// Why: a widget never runs live code on the Home Screen. It shows snapshots that
//      were planned ahead, which saves battery across every widget on the device.

import SwiftUI // Widget views are ordinary SwiftUI views.
import WidgetKit // TimelineEntry, TimelineProvider, Timeline and the Widget protocol.

/// Stands in for data the app saved. An extension has its own sandbox, so reading the
/// app's real count needs an App Group (a paid Apple Developer Program capability):
/// `UserDefaults(suiteName: "group.com.example.DeviceLab")?.integer(forKey: "glasses")`.
/// Without one, this stand-in returns a fixed number, exactly as the course's example does.
struct WaterStore: Sendable { // Sendable: the extension may read it from any thread.
    static let shared = WaterStore() // One shared instance.
    let glassesToday = 3 // The fixed stand-in count.
}

/// One snapshot of the widget's data.
struct WaterEntry: TimelineEntry { // TimelineEntry requires only a date.
    let date: Date // When iOS should start showing this entry.
    let glasses: Int // How many glasses were logged when the snapshot was made.
}

/// Supplies the entries; iOS calls these methods, never your own code.
struct WaterProvider: TimelineProvider { // Separates "which data, when" from "how it looks".
    /// A quick, generic entry for the moment before real data is ready.
    func placeholder(in context: Context) -> WaterEntry { // Shown while the widget loads.
        WaterEntry(date: .now, glasses: 0) // No real data needed.
    }

    /// One entry for the widget gallery's preview.
    func getSnapshot(in context: Context, completion: @escaping (WaterEntry) -> Void) { // Called when people browse widgets.
        completion(WaterEntry(date: .now, glasses: WaterStore.shared.glassesToday)) // A realistic snapshot.
    }

    /// The course's timeline: four entries an hour apart, then ask again at the end.
    func getTimeline(in context: Context, // context describes the widget, such as its size.
                     completion: @escaping // The callback that receives the finished timeline.
                     (Timeline<WaterEntry>) -> Void) { // It takes a timeline of WaterEntry values.
        let glasses = WaterStore.shared.glassesToday // Read the count once per timeline.
        let step: TimeInterval = 3600 // 1 hour between entries.
        let start = Date.now // The first entry appears immediately.
        let entries = (0..<4).map { i in // Four entries: 0, 1, 2 and 3 hours from now.
            WaterEntry(date: start + Double(i) * step, // Each entry's date.
                       glasses: glasses) // The same count in each.
        }
        completion(Timeline(entries: entries, // Hand the timeline back; until then the widget keeps its old one.
                            policy: .atEnd)) // Ask for a new timeline after the last entry's date passes.
    }
}

/// Draws one entry.
struct WaterWidgetView: View { // Rendered ahead of time into a snapshot.
    let entry: WaterEntry // The snapshot to draw.

    var body: some View { // What the widget shows.
        VStack(alignment: .leading, spacing: 4) { // Icon, count and time, top to bottom.
            Image(systemName: "drop.fill") // A water drop.
                .foregroundStyle(.tint) // Accent colored.
            Text("\(entry.glasses) of 8 glasses") // The course's text.
                .font(.headline) // Glanceable.
            Text(entry.date, style: .time) // The course's try-it: when this entry was planned for.
                .font(.caption) // Small.
                .foregroundStyle(.secondary) // Quieter.
        }
        .containerBackground(.fill.tertiary, for: .widget) // A background iOS can remove or tint where needed.
    }
}

/// The widget itself: its identity, data source, view and gallery description.
struct WaterWidget: Widget { // Listed in DeviceLabWidgetBundle.
    var body: some WidgetConfiguration { // Like a view's body, but for configuration.
        StaticConfiguration(kind: "Water", // The kind string the app uses to ask for reloads.
                            provider: WaterProvider()) { // The provider that builds timelines.
            WaterWidgetView(entry: $0) // The view for each entry; $0 is the entry.
        }
        .configurationDisplayName("Water") // The name in the widget gallery.
        .description("Glasses of water you drank today.") // The line under the name.
        .supportedFamilies([.systemSmall, .systemMedium]) // Only the sizes the view was designed for.
    }
}

#Preview(as: .systemSmall) { // Shows the widget in Xcode's canvas.
    WaterWidget() // The widget to preview.
} timeline: { // The entries to step through in the canvas.
    WaterEntry(date: .now, glasses: 3) // Now.
    WaterEntry(date: .now + 3600, glasses: 3) // An hour later.
}

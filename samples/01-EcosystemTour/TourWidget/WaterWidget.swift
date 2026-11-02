// WaterWidget.swift
// Who: WidgetKit reads the configuration; people see the view on the Home
//      Screen and the Lock Screen.
// What: the course's "Water Today" widget: a configuration plus a SwiftUI
//       view for each entry in the timeline.
// Where: the TourWidget extension target, not the app target.
// When: WidgetKit renders each entry ahead of the moment it is shown; none of
//       this code runs while the widget simply sits on the Home Screen.
// Why: a widget is glanceable information drawn from snapshots, which is why
//      it barely touches the battery.

import WidgetKit // Widget, StaticConfiguration and the widget families.
import SwiftUI // Widget content is always drawn with SwiftUI.

/// The course's widget, built from its example.
struct WaterWidget: Widget { // Like App and View, a widget is described with a body.
    var body: some WidgetConfiguration { // WidgetKit reads the configuration, not a view.
        StaticConfiguration( // A widget with no options for people to configure.
            kind: "WaterWidget", // A stable identifier; the app uses it to ask for a reload.
            provider: WaterProvider() // Supplies the timeline of dated entries.
        ) { entry in // Turns one entry into a view, ahead of the moment it is shown.
            WaterWidgetView(entry: entry) // The course's VStack, in its own view so it can adapt to each size.
                .containerBackground(.blue.gradient, for: .widget) // The background the system may replace, for example on the Lock Screen.
        }
        .configurationDisplayName("Water Today") // The name in the widget gallery.
        .description("Shows how many glasses you logged.") // One sentence of purpose in the gallery.
        .supportedFamilies([.systemSmall, .accessoryCircular]) // A small Home Screen widget and a circular Lock Screen one.
    }
}

/// What one entry looks like. The course's drop and count, plus a label for the simulated data.
struct WaterWidgetView: View { // Reads only the entry, so WidgetKit can draw it ahead of time.
    let entry: WaterEntry // The entry to draw.
    @Environment(\.widgetFamily) private var family // Which size is being drawn.

    var body: some View { // Rendered once per entry, not continuously.
        if family == .accessoryCircular { // The tiny round Lock Screen size.
            VStack(spacing: 0) { // The drop above the number.
                Image(systemName: "drop.fill") // The course's symbol.
                Text("\(entry.glasses)") // Just the number fits in a circle.
                    .font(.headline) // Readable at a glance.
            }
        } else { // The small Home Screen size.
            VStack { // The course's layout: icon above count.
                Image(systemName: "drop.fill") // A filled water drop.
                    .font(.title) // Large enough to identify the widget at a glance.
                Text("\(entry.glasses) glasses") // The count from this entry, such as "3 glasses".
                    .font(.headline) // The widget's main fact.
                if entry.isSample { // Simulated mode must be labeled.
                    Text("Sample timeline") // Says the number is not real data.
                        .font(.caption2) // Small print.
                        .opacity(0.8) // Quieter than the count.
                    Text(entry.date, style: .time) // When this entry began, so you can watch the timeline advance.
                        .font(.caption2.monospacedDigit()) // Small, with even digits.
                        .opacity(0.8) // Quieter than the count.
                }
            }
            .foregroundStyle(.white) // White reads well on the blue gradient.
        }
    }
}

#Preview(as: .systemSmall) { // Xcode can preview a widget with sample entries.
    WaterWidget() // The widget being previewed.
} timeline: { // The entries the preview steps through.
    WaterEntry(date: .now, glasses: 2, isSample: true) // First entry.
    WaterEntry(date: .now.addingTimeInterval(60), glasses: 3, isSample: true) // A minute later.
}

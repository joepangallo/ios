// HikeLiveActivity.swift
// Who: ActivityKit and the system, which draw this on the Lock Screen and in the
//      Dynamic Island while a hike started by the app is in progress.
// What: the views for the hike Live Activity: a Lock Screen banner, the expanded
//       Dynamic Island, and its compact and minimal forms.
// Where: the DeviceLabWidget extension; listed in DeviceLabWidgetBundle.
// When: whenever the app starts, updates or ends the activity (lesson 7.7).
// Why: the app starts and updates a Live Activity, but a widget extension draws it.

import SwiftUI // Views.
import WidgetKit // The Widget protocol and ActivityConfiguration.
import ActivityKit // ActivityViewContext and the Dynamic Island types.

/// The hike Live Activity's appearance in every place iOS can show it.
struct HikeLiveActivity: Widget { // A widget whose configuration is an activity configuration.
    var body: some WidgetConfiguration { // Read when iOS loads the extension.
        ActivityConfiguration(for: HikeAttributes.self) { context in // The Lock Screen and banner view.
            HStack { // Icon, name and distance in a row.
                Image(systemName: "figure.hiking") // A hiker.
                    .font(.title2) // Prominent.
                VStack(alignment: .leading) { // Name above progress.
                    Text(context.attributes.trailName) // Fixed detail: the trail.
                        .font(.headline) // Bold.
                    Text(remainingText(context.state.kilometersLeft)) // Changing detail: the distance left.
                        .font(.subheadline) // Smaller.
                }
                Spacer() // Pushes the distance to the right.
            }
            .padding() // Room inside the banner.
            .activityBackgroundTint(Color.green.opacity(0.25)) // A soft trail-green background.
        } dynamicIsland: { context in // The Dynamic Island on iPhones that have one.
            DynamicIsland { // The expanded form, shown on a long press.
                DynamicIslandExpandedRegion(.leading) { // Left side.
                    Image(systemName: "figure.hiking") // A hiker.
                }
                DynamicIslandExpandedRegion(.center) { // Middle.
                    Text(context.attributes.trailName) // The trail.
                }
                DynamicIslandExpandedRegion(.bottom) { // Under everything.
                    Text(remainingText(context.state.kilometersLeft)) // The distance left.
                }
            } compactLeading: { // Left of the camera when compact.
                Image(systemName: "figure.hiking") // A hiker.
            } compactTrailing: { // Right of the camera when compact.
                Text(context.state.kilometersLeft, format: .number.precision(.fractionLength(1))) // For example 3.2.
            } minimal: { // When another activity shares the island.
                Image(systemName: "figure.hiking") // Just the icon.
            }
        }
    }

    /// "3.2 km to go", or "Finished" at the end.
    private func remainingText(_ kilometers: Double) -> String { // Shared by the views above.
        kilometers <= 0 ? "Finished" : String(format: "%.1f km to go", kilometers) // One decimal place.
    }
}

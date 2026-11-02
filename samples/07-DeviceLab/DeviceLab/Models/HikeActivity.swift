// HikeActivity.swift
// Who: lesson 7.7's Live Activity demo, and the tests for its text helper.
// What: the course's trackHike() function, which walks an activity through its whole
//       life at once, and a small controller that does the same steps one button at a
//       time so students can watch the Lock Screen and the Dynamic Island change.
// Where: the Models folder; the widget extension's HikeLiveActivity draws the result.
// When: when the student taps Start, Halfway or Finish.
// Why: a Live Activity shows an event in progress. The app starts it while on screen,
//      updates the whole changing state each time, and ends it promptly.

import Foundation // String(format:) and localizedDescription.
import ActivityKit // Activity, ActivityContent and ActivityAuthorizationInfo.
import Observation // The @Observable macro.

/// The course's function: start, update and end a hike in one go, for illustration.
func trackHike() async throws { // A real app spreads these steps over the hike.
    let start = HikeAttributes.ContentState(kilometersLeft: 6.4) // The first state.
    let activity = try Activity.request( // Ask iOS to show the activity.
        attributes: HikeAttributes(trailName: "Ridge Loop"), // The fixed details.
        content: ActivityContent(state: start, staleDate: nil)) // The starting state; never marked stale.
    let halfway = HikeAttributes.ContentState(kilometersLeft: 3.2) // Halfway along.
    await activity.update( // Send the new state.
        ActivityContent(state: halfway, staleDate: nil)) // Wrapped for delivery.
    let done = HikeAttributes.ContentState(kilometersLeft: 0) // The finish.
    await activity.end( // End the activity.
        ActivityContent(state: done, staleDate: nil), // The final state stays visible briefly.
        dismissalPolicy: .default) // The system decides how long.
}

/// Runs the same steps as trackHike(), one button at a time.
@Observable // The screen redraws when message or kilometersLeft change.
final class HikeActivityController { // One per screen.
    private var activityID: String? // The running activity's id. Activity values are not Sendable, so the controller keeps only the id.
    private(set) var kilometersLeft = 6.4 // The distance in the latest state.
    private(set) var message = "No hike running." // What the screen says.
    var isRunning: Bool { activityID != nil } // Whether there is something to update or end.

    /// Finds an activity by its id. `nonisolated` makes the result a fresh value that
    /// belongs to no actor, so it can be handed to ActivityKit's update and end safely.
    nonisolated static func runningActivity(id: String?) -> Activity<HikeAttributes>? { // nil when nothing runs.
        Activity<HikeAttributes>.activities.first { $0.id == id } // Every hike activity this app started.
    }

    /// Picks up a hike that is still running from an earlier launch, so Halfway and Finish keep working.
    init() { // Called when the lesson screen creates the controller.
        activityID = Activity<HikeAttributes>.activities.first?.id // nil when no hike is running.
        if activityID != nil { message = "A hike from an earlier launch is still running." } // Say so.
    }

    /// Whether the person allows Live Activities for this app (Settings can turn them off).
    var activitiesEnabled: Bool { ActivityAuthorizationInfo().areActivitiesEnabled } // Read fresh each time.

    /// Starts the hike; must happen while the app is on screen.
    func start() { // The first step of trackHike().
        do { // request throws if Live Activities are off.
            let activity = try Activity.request( // Ask iOS to show it.
                attributes: HikeAttributes(trailName: "Ridge Loop"), // The trail.
                content: ActivityContent(state: .init(kilometersLeft: 6.4), staleDate: nil)) // 6.4 km to go.
            activityID = activity.id // Remember which activity is ours.
            kilometersLeft = 6.4 // Remember the state.
            message = "Started. Lock the Simulator (Command-L) or look at the Dynamic Island." // Where to look.
        } catch { // Turned off, or not supported.
            message = "Could not start: \(error.localizedDescription)" // Say why.
        }
    }

    /// Sends a new state with less distance left.
    func walk(to kilometers: Double) async { // The update step.
        guard let activity = Self.runningActivity(id: activityID) else { return } // Nothing running.
        await activity.update(ActivityContent(state: .init(kilometersLeft: kilometers), staleDate: nil)) // The whole changing state.
        kilometersLeft = kilometers // Remember it.
        message = Self.remainingText(kilometers) // Show it.
    }

    /// Ends the hike with a final state.
    func finish() async { // The end step.
        guard let activity = Self.runningActivity(id: activityID) else { activityID = nil; return } // Nothing running.
        await activity.end(ActivityContent(state: .init(kilometersLeft: 0), staleDate: nil), dismissalPolicy: .default) // Final state, default dismissal.
        activityID = nil // No longer running.
        kilometersLeft = 0 // Done.
        message = "Finished. The final state stays on the Lock Screen briefly." // The outcome.
    }

    /// "3.2 km to go", or "Finished" at zero; the same text the widget extension draws.
    static func remainingText(_ kilometers: Double) -> String { // Pure, so tests can check it.
        kilometers <= 0 ? "Finished" : String(format: "%.1f km to go", kilometers) // One decimal place.
    }
}

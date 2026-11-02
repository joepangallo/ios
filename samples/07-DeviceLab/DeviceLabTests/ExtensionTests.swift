// ExtensionTests.swift
// Who: the Swift Testing runner.
// What: checks lesson 7.7's logic: building timeline entries, the day simulator under
//       each reload policy, the clock labels, the notification request, the daily
//       trigger, the Live Activity's text and data, and the App Intent's effect.
// Where: the DeviceLabTests target.
// When: whenever the tests run.
// Why: widgets, intents and notifications run outside the app on the system's
//      schedule, so their pieces are checked here as plain values. No notification is
//      scheduled and no Live Activity is started by these tests.

import Testing // @Test, #expect and #require.
import Foundation // Date, JSONEncoder and JSONDecoder.
import UserNotifications // The request and trigger types.
@testable import DeviceLab // The app's internal types.

@MainActor // The app's types live on the main actor.
struct TimelineTests { // Timeline entries.
    @Test func fourEntriesAnHourApart() { // The widget's getTimeline.
        let start = Date(timeIntervalSince1970: 0) // A fixed start, so the test never depends on the clock.
        let entries = WaterTimelineBuilder.entries(start: start, glasses: 3) // Defaults: 3600 s, 4 entries.
        #expect(entries.count == 4) // 0..<4.
        #expect(entries.map(\.date) == [0, 3600, 7200, 10800].map { start + Double($0) }) // 0, 1, 2 and 3 hours later.
        #expect(entries.allSatisfy { $0.glasses == 3 }) // The same count in each.
    }

    @Test func spacingAndCountAreParameters() { // The course's try-it: 0..<6, 1800 s.
        let entries = WaterTimelineBuilder.entries(start: Date(timeIntervalSince1970: 0), step: 1800, count: 6, glasses: 1) // Six, half an hour apart.
        #expect(entries.count == 6) // Six entries.
        #expect(entries.last?.date == Date(timeIntervalSince1970: 9000)) // 2.5 hours ahead.
    }

    @Test(arguments: [(540, "9:00"), (570, "9:30"), (605, "10:05"), (0, "0:00")]) // From the course's worked example.
    func clockLabels(total: Int, label: String) { // Parameterized.
        #expect(WidgetDaySimulator.clockLabel(total) == label) // Padded minutes.
    }
}

@MainActor // The app's types live on the main actor.
struct WidgetDayTests { // The day simulator.
    @Test func addingTheWidgetBuildsTheFirstTimeline() { // At 8:00.
        let day = WidgetDaySimulator() // A fresh day.
        #expect(day.timeline.map(\.minute) == [480, 540, 600, 660]) // 8:00 to 11:00.
        #expect(day.widgetGlasses == 3) // The app's count.
        #expect(day.reloads == 1) // One timeline so far.
    }

    @Test func loggingAGlassDoesNotChangeTheWidget() { // Snapshots are frozen.
        var day = WidgetDaySimulator() // A fresh day.
        day.logGlass() // The app now knows 4.
        #expect(day.appGlasses == 4) // The app changed.
        #expect(day.widgetGlasses == 3) // The widget did not.
        day.advance(to: 600) // Time passes within the timeline.
        #expect(day.currentEntry?.minute == 600) // The 10:00 entry shows.
        #expect(day.widgetGlasses == 3) // Still the old snapshot.
    }

    @Test func atEndReloadsAfterTheLastEntryPasses() { // .atEnd.
        var day = WidgetDaySimulator() // A fresh day.
        day.logGlass() // The app knows 4.
        day.advance(to: 660) // The last entry's time: not passed yet.
        #expect(day.reloads == 1) // No reload.
        day.advance(to: 675) // Just after.
        #expect(day.reloads == 2) // iOS asked again.
        #expect(day.widgetGlasses == 4) // The new snapshot.
    }

    @Test func neverWaitsForTheApp() { // .never.
        var day = WidgetDaySimulator() // A fresh day.
        day.policy = .never // Never reload on its own.
        day.logGlass() // The app knows 4.
        day.advance(to: 1200) // Far past the last entry.
        #expect(day.reloads == 1) // No reload.
        #expect(day.widgetGlasses == 3) // Stale.
        day.reloadTimelines() // The app asks.
        #expect(day.widgetGlasses == 4) // Fresh.
    }

    @Test func afterReloadsAtTheChosenTime() { // .after(date).
        var day = WidgetDaySimulator() // A fresh day.
        day.policy = .afterTwoHours // Two hours after the timeline began.
        day.advance(to: 585) // 1 h 45 m in.
        #expect(day.reloads == 1) // Not yet.
        day.advance(to: 600) // Two hours in.
        #expect(day.reloads == 2) // Reloaded.
    }

    @Test func spacingAppliesToTheNextTimeline() { // Entry spacing.
        var day = WidgetDaySimulator() // A fresh day.
        day.stepMinutes = 30 // Half an hour.
        day.reloadTimelines() // Build a new timeline.
        #expect(day.timeline.map(\.minute) == [480, 510, 540, 570]) // 30 minutes apart.
        #expect(day.log.last?.contains("reloadTimelines") == true) // Logged with its reason.
    }
}

@MainActor // The app's types live on the main actor.
struct NotificationRequestTests { // The course's sunset reminder.
    @Test func requestMatchesTheCourse() throws { // Identifier, content and trigger.
        let request = SunsetReminder.request() // The default 30-minute version.
        #expect(request.identifier == "sunset") // Replaces any pending duplicate.
        #expect(request.content.title == "Sunset soon") // Title.
        #expect(request.content.body == "Head back to the trailhead.") // Body.
        #expect(request.content.sound != nil) // The default sound.
        let trigger = try #require(request.trigger as? UNTimeIntervalNotificationTrigger) // A delay trigger.
        #expect(trigger.timeInterval == 1800) // 30 * 60 seconds.
        #expect(trigger.repeats == false) // Only once.
    }

    @Test func delayIsAParameter() throws { // The demo's quick version.
        let trigger = try #require(SunsetReminder.request(after: 10).trigger as? UNTimeIntervalNotificationTrigger) // Ten seconds.
        #expect(trigger.timeInterval == 10) // Ten seconds.
    }

    @Test func dailyTriggerFiresAtSixPM() { // The course's try-it.
        let trigger = SunsetReminder.dailyTrigger(hour: 18, minute: 0) // 18:00.
        #expect(trigger.dateComponents.hour == 18) // The hour.
        #expect(trigger.dateComponents.minute == 0) // The minute.
        #expect(trigger.repeats) // Every day.
    }
}

@MainActor // The app's types live on the main actor.
struct LiveActivityAndIntentTests { // ActivityKit data and the App Intent.
    @Test func remainingTextMatchesTheWidget() { // The same words the extension draws.
        #expect(HikeActivityController.remainingText(6.4) == "6.4 km to go") // Start.
        #expect(HikeActivityController.remainingText(3.2) == "3.2 km to go") // Halfway.
        #expect(HikeActivityController.remainingText(0) == "Finished") // The end.
    }

    @Test func contentStateRoundTripsThroughJSON() throws { // Codable, as push updates need.
        let state = HikeAttributes.ContentState(kilometersLeft: 3.2) // Halfway.
        let data = try JSONEncoder().encode(state) // To JSON.
        let back = try JSONDecoder().decode(HikeAttributes.ContentState.self, from: data) // And back.
        #expect(back == state) // Unchanged; Hashable gives ==.
    }

    @Test func controllerStartsIdle() { // Nothing runs until Start.
        let hike = HikeActivityController() // A fresh controller.
        #expect(!hike.isRunning) // No activity.
        #expect(hike.kilometersLeft == 6.4) // The trail's full length.
    }

    @Test func intentAddsItsGlassesToTheStore() async throws { // The course's perform().
        let before = WaterStore.shared.glassesToday // The count now.
        let intent = LogWaterIntent() // A fresh intent.
        intent.glasses = 2 // As Shortcuts would set it.
        _ = try await intent.perform() // Run it.
        #expect(WaterStore.shared.glassesToday == before + 2) // Two more glasses.
    }

    @Test func oneShortcutIsRegistered() { // The AppShortcutsProvider.
        #expect(WaterShortcuts.appShortcuts.count == 1) // Log Water.
    }
}

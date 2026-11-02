// SunsetReminder.swift
// Who: lesson 7.7's local notification demo, and the unit tests that check the request.
// What: builds the course's "Sunset soon" notification request (content, trigger and
//       identifier), schedules it after asking permission, offers the try-it's daily
//       calendar trigger, and lets banners appear while the app is open.
// Where: the Models folder.
// When: when the student turns the reminder on in lesson 7.7.
// Why: a local notification needs no server: ask once, describe the content, choose a
//      trigger and hand the request to the notification center.

import Foundation // DateComponents and TimeInterval.
import UserNotifications // UNUserNotificationCenter and the request types.

/// Builds the pieces of the course's reminder, separately from the scheduling, so tests can check them.
enum SunsetReminder { // A namespace for pure builders.
    static let identifier = "sunset" // Adding another request with this id replaces the pending one.

    /// The content: title, body and sound.
    static func content() -> UNMutableNotificationContent { // An editable description of the banner.
        let content = UNMutableNotificationContent() // Empty content.
        content.title = "Sunset soon" // The bold first line.
        content.body = "Head back to the trailhead." // What to do next.
        content.sound = .default // The standard sound, respecting the person's settings.
        return content // Ready to attach to a request.
    }

    /// The whole request, firing once after `delay` seconds; the course uses 30 minutes.
    static func request(after delay: TimeInterval = 30 * 60) -> UNNotificationRequest { // The delay is a parameter so the demo can use a few seconds.
        let trigger = UNTimeIntervalNotificationTrigger( // Fires after a delay...
            timeInterval: delay, repeats: false) // ...once.
        return UNNotificationRequest( // Bundles the three parts.
            identifier: identifier, content: content(), trigger: trigger) // Named "sunset".
    }

    /// The course's try-it: a trigger that fires every day at a time of day.
    static func dailyTrigger(hour: Int, minute: Int) -> UNCalendarNotificationTrigger { // For example 18:00.
        var components = DateComponents() // Only the parts that must match.
        components.hour = hour // The hour, 0 to 23.
        components.minute = minute // The minute.
        return UNCalendarNotificationTrigger(dateMatching: components, repeats: true) // Every day at that time.
    }
}

/// The course's scheduleSunsetReminder(), returning whether permission was granted.
@discardableResult // Callers may ignore the answer.
func scheduleSunsetReminder(after delay: TimeInterval = 30 * 60) async throws -> Bool { // Called when the person turns the reminder on.
    let center = UNUserNotificationCenter.current() // This app's notification center.
    let granted = try await center.requestAuthorization( // The alert appears once per install.
        options: [.alert, .sound, .badge]) // Banners, sounds and badges.
    guard granted else { return false } // No permission: stop quietly; the screen explains.
    try await center.add(SunsetReminder.request(after: delay)) // iOS delivers it even if the app is closed.
    return true // Scheduled.
}

/// Lets banners appear while the app is on screen; by default iOS hides them then.
final class ForegroundBanners: NSObject, UNUserNotificationCenterDelegate { // Delegate protocols come from Objective-C.
    static let shared = ForegroundBanners() // The center holds its delegate weakly, so something must keep it alive.

    /// Called when a notification arrives while the app is open.
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions { // The protocol does not promise the main actor.
        [.banner, .sound, .list] // Show it as if the app were closed.
    }
}

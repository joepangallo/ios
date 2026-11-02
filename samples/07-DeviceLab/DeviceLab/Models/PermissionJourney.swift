// PermissionJourney.swift
// Who: lesson 7.1's "Walk the whole permission journey" demo, and its unit tests.
// What: a small state machine that plays out Trailhead's location permission
//       story: tapping the feature, an optional priming screen, the system alert,
//       Allow Once expiring in the background, Don't Allow and the way back through
//       Settings, a missing purpose string, and a Screen Time restriction.
// Where: the Models folder; pure logic, so no real alert ever appears.
// When: each time the student taps one of the journey's buttons.
// Why: the real alert can be shown only once per install, so a safe replay is the
//      only way to try every path as often as you like.

import Foundation // Basic types such as String and Bool.

/// A simulated location status, including the temporary Allow Once grant.
enum JourneyStatus: String { // The raw value is the Swift spelling shown on screen.
    case notDetermined = ".notDetermined" // Never asked, or Allow Once expired.
    case allowedOnce = ".authorizedWhenInUse (Allow Once)" // Granted until the app leaves the screen.
    case allowedWhileUsing = ".authorizedWhenInUse" // Granted while the app is in use.
    case denied = ".denied" // The person chose Don't Allow.
    case restricted = ".restricted" // Screen Time or device management blocks location.
}

/// The three buttons of the system alert.
enum AlertAnswer: String, CaseIterable { // CaseIterable so the screen can draw one button per answer.
    case allowOnce = "Allow Once" // A one-time grant.
    case allowWhileUsing = "Allow While Using App" // The usual grant.
    case dontAllow = "Don't Allow" // A refusal; iOS will not ask again.
}

/// Trailhead's whole permission story, one event at a time.
struct PermissionJourney { // A value type: tests can copy it and replay events.
    private(set) var status: JourneyStatus = .notDetermined // What Core Location would report.
    var hasPurposeString = true // Whether Info.plist holds NSLocationWhenInUseUsageDescription.
    var primingOn = false // Whether the app shows its own priming screen first.
    var screenTimeOn = false { // Whether a parent has blocked Location Services.
        didSet { status = screenTimeOn ? .restricted : .notDetermined } // A restriction overrides everything; lifting it starts fresh.
    }
    private(set) var alertShowing = false // True while the simulated system alert is on screen.
    private(set) var primingShowing = false // True while the priming screen is on screen.
    private(set) var screen = "Trailhead lists every trail. Tap Show trails near me." // What the phone shows.
    private(set) var log: [String] = [] // Every step, oldest first, like the course's log panel.

    /// The person taps "Show trails near me".
    mutating func tapFeature() { // The status check runs here, at the moment of use.
        guard !alertShowing, !primingShowing else { return } // A screen is already waiting for an answer.
        log.append("Tap: switch on \(status.rawValue)") // Which case the switch will match.
        switch status { // The same decision table as TrailFinder.
        case .notDetermined: // The only state that may show the alert.
            if primingOn { // Explain first when the reason is not obvious.
                primingShowing = true // The priming screen appears.
                screen = "Priming: Trailhead sorts trails by distance. [Continue]" // One button only, as Apple asks.
                log.append("Priming screen shown, with one Continue button") // Your own view, not the system's.
            } else { // No priming: ask straight away.
                ask() // Hand the request to iOS.
            }
        case .allowedOnce, .allowedWhileUsing: // Access is in place.
            screen = "Showing trails sorted by distance." // The real feature.
            log.append("Feature runs: trails sorted by distance") // No alert needed.
        case .denied: // Asking again would do nothing.
            screen = "Location is off. You can still browse every trail. [Open Settings]" // Degrade and show the way back.
            log.append("No alert: iOS asks once per install. Showing the recovery card") // The one-shot rule.
        case .restricted: // Someone else holds the switch.
            screen = "Location is unavailable on this device." // No Settings button, because it would not help.
            log.append("Restricted: explain without a Settings button") // Different from a denial.
        }
    }

    /// The person taps Continue on the priming screen.
    mutating func continuePriming() { // The single button leads straight to the system alert.
        guard primingShowing else { return } // Only meaningful while priming is visible.
        primingShowing = false // The priming screen goes away.
        ask() // And the real request follows immediately.
    }

    /// The request reaches iOS.
    private mutating func ask() { // Models requestWhenInUseAuthorization().
        log.append("requestWhenInUseAuthorization()") // The call your code makes.
        guard hasPurposeString else { // No purpose string in Info.plist.
            screen = "Nothing happens. No alert, no crash." // iOS ignores the request silently.
            log.append("No purpose string: iOS ignores the request; status stays .notDetermined") // The quiz's trap.
            return // The status does not change.
        }
        alertShowing = true // iOS draws its alert; your code cannot restyle it.
        screen = "System alert: Allow Trailhead to use your location? (shows your Info.plist sentence)" // Drawn by iOS.
        log.append("iOS shows its alert with your purpose string") // The one and only time.
    }

    /// The person answers the system alert.
    mutating func answer(_ choice: AlertAnswer) { // One of the three alert buttons.
        guard alertShowing else { return } // No alert, nothing to answer.
        alertShowing = false // The alert closes.
        switch choice { // Each answer sets a different status.
        case .allowOnce: status = .allowedOnce // Granted for this session only.
        case .allowWhileUsing: status = .allowedWhileUsing // Granted while in use.
        case .dontAllow: status = .denied // Refused; the alert will not return.
        }
        log.append("Answer: \(choice.rawValue) -> \(status.rawValue)") // The new status.
        tapFeatureAfterAnswer() // The feature reacts to the new answer.
    }

    /// The app leaves the screen and comes back later.
    mutating func sendToBackground() { // Only Allow Once changes here.
        guard status == .allowedOnce else { // Other statuses survive the trip.
            log.append("Background and back: status unchanged, \(status.rawValue)") // Nothing expires.
            return // Done.
        }
        status = .notDetermined // The one-time grant has expired.
        screen = "Trailhead lists every trail. Tap Show trails near me." // Back to the start.
        log.append("Allow Once expired in the background: status is .notDetermined again") // So the alert can appear again.
    }

    /// The person follows Open Settings and turns location back on.
    mutating func turnOnInSettings() { // Only Settings can reverse a denial.
        guard status == .denied else { return } // Nothing to fix otherwise.
        status = .allowedWhileUsing // The switch in Settings, now on.
        log.append("Settings: Location set to While Using the App") // The person changed their mind.
        tapFeatureAfterAnswer() // A fresh check reads the new answer.
    }

    /// Starts the story over, keeping the toggles as they are.
    mutating func reset() { // A clean replay.
        status = screenTimeOn ? .restricted : .notDetermined // The restriction, if on, still applies.
        alertShowing = false // No alert.
        primingShowing = false // No priming.
        screen = "Trailhead lists every trail. Tap Show trails near me." // The starting screen.
        log = [] // An empty log.
    }

    /// After an answer, the app re-runs the check, as a real app does when the delegate reports the change.
    private mutating func tapFeatureAfterAnswer() { // Shared by answer and turnOnInSettings.
        switch status { // Only the outcome screen changes here.
        case .allowedOnce, .allowedWhileUsing: screen = "Showing trails sorted by distance." // Granted.
        case .denied: screen = "Location is off. You can still browse every trail. [Open Settings]" // Refused.
        case .notDetermined, .restricted: break // Not reachable from an answer; nothing to redraw.
        }
    }
}

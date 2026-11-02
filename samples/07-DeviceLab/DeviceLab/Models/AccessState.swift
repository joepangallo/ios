// AccessState.swift
// Who: the permission demos in lessons 7.1, 7.5 and 7.7, and their unit tests.
// What: one shared vocabulary for "may this app use the resource?": not asked yet,
//       allowed, denied or restricted, translated from each framework's own status type.
// Where: the Models folder; pure logic, no screens.
// When: whenever a screen reads a permission status and needs plain words for it.
// Why: Core Location, AVFoundation and UserNotifications each name their answers
//      differently, but people only need the four answers lesson 7.1 teaches.

import CoreLocation // CLAuthorizationStatus, the location answer.
import AVFoundation // AVAuthorizationStatus, the camera answer.
import UserNotifications // UNAuthorizationStatus, the notification answer.

/// The four answers a protected resource can have, as lesson 7.1 names them.
enum AccessState: String, CaseIterable { // String raw values double as on-screen labels.
    case notAsked = "Not asked yet" // The app has never asked; only now can iOS show its alert.
    case allowed = "Allowed" // The person said yes.
    case denied = "Denied" // The person said no; only Settings can change it.
    case restricted = "Restricted" // Screen Time or device management blocks it; the person cannot change it.

    /// Translates Core Location's answer.
    init(_ status: CLAuthorizationStatus) { // Called with manager.authorizationStatus.
        switch status { // One branch per status Core Location reports today.
        case .notDetermined: self = .notAsked // Never asked, or an Allow Once grant expired.
        case .authorizedWhenInUse, .authorizedAlways: self = .allowed // Either grant lets the feature work now.
        case .denied: self = .denied // Don't Allow, or location switched off for this app.
        case .restricted: self = .restricted // Blocked by someone else.
        @unknown default: self = .denied // A future status: fail closed, never assume access.
        }
    }

    /// Translates AVFoundation's camera answer.
    init(_ status: AVAuthorizationStatus) { // Called with AVCaptureDevice.authorizationStatus(for: .video).
        switch status { // Same four ideas, different names.
        case .notDetermined: self = .notAsked // Never asked.
        case .authorized: self = .allowed // The person allowed the camera.
        case .denied: self = .denied // The person said no.
        case .restricted: self = .restricted // Parental controls or a company policy.
        @unknown default: self = .denied // Fail closed for anything new.
        }
    }

    /// Translates UserNotifications' answer.
    init(_ status: UNAuthorizationStatus) { // Called with the notification settings' authorizationStatus.
        switch status { // Notifications have no "restricted" answer.
        case .notDetermined: self = .notAsked // Never asked.
        case .authorized, .provisional, .ephemeral: self = .allowed // Every flavor of yes may deliver notifications.
        case .denied: self = .denied // The person turned notifications off.
        @unknown default: self = .denied // Fail closed for anything new.
        }
    }

    /// The SF Symbol that goes with each answer.
    var symbol: String { // Read by the status rows.
        switch self { // One icon per answer.
        case .notAsked: "questionmark.circle" // Still an open question.
        case .allowed: "checkmark.circle.fill" // A clear yes.
        case .denied: "xmark.circle.fill" // A clear no.
        case .restricted: "lock.fill" // Locked by someone else.
        }
    }

    /// What the app should do next, in one sentence.
    var advice: String { // Shown under each status row.
        switch self { // One plan per answer.
        case .notAsked: "Ask at the moment of use; iOS shows its alert only now." // The one chance to show the alert.
        case .allowed: "Use the resource." // Nothing more to do.
        case .denied: "Keep the app working and offer a way to Settings." // Degrade, then show the way back.
        case .restricted: "Explain calmly; Settings cannot change this." // Someone else holds the switch.
        }
    }

    /// True only in the one state where a request can show the system alert.
    var canShowSystemAlert: Bool { self == .notAsked } // Lesson 7.1's rule: the alert appears only from notDetermined.

    /// The Swift spelling of a location status, for labels such as ".denied".
    static func caseName(_ status: CLAuthorizationStatus) -> String { // Used by pickers and logs.
        switch status { // One name per case.
        case .notDetermined: ".notDetermined" // As written in code.
        case .restricted: ".restricted" // As written in code.
        case .denied: ".denied" // As written in code.
        case .authorizedAlways: ".authorizedAlways" // As written in code.
        case .authorizedWhenInUse: ".authorizedWhenInUse" // As written in code.
        @unknown default: "@unknown default" // Matches the switch's last branch.
        }
    }

    /// The Swift spelling of a camera status, for labels such as ".authorized".
    static func caseName(_ status: AVAuthorizationStatus) -> String { // Used by the camera practice picker.
        switch status { // One name per case.
        case .notDetermined: ".notDetermined" // As written in code.
        case .restricted: ".restricted" // As written in code.
        case .denied: ".denied" // As written in code.
        case .authorized: ".authorized" // As written in code.
        @unknown default: "@unknown default" // Matches the switch's last branch.
        }
    }
}

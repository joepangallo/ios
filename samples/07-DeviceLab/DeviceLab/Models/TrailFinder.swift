// TrailFinder.swift
// Who: lesson 7.1's "Check the status before you ask" demo, and its unit tests.
// What: the course's TrailFinder class: it reads the location authorization status
//       and runs exactly one branch for it, plus a delegate method that notices when
//       the person answers the alert or changes the setting in Settings.
// Where: the Models folder; the lesson screen creates two of these, one real and one for practice.
// When: every time someone taps "Show trails near me" or picks a status to try.
// Why: checking the status at the moment of use, and handling every case, is the
//      heart of the iOS permission model.

import CoreLocation // CLLocationManager, CLAuthorizationStatus and the delegate protocol.
import Observation // The @Observable macro; this file does not import SwiftUI.

/// What the last tap ended up doing, so the screen can show it and tests can check it.
enum TrailFinderOutcome: Equatable { // Equatable lets tests compare outcomes with ==.
    case idle // Nothing tapped yet.
    case askedSystem // .notDetermined: the request went to iOS, which draws the alert.
    case showedTrails // Allowed: the real feature ran.
    case showedSettingsPrompt // .denied: a friendly card with an Open Settings button.
    case showedRestrictedMessage // .restricted: a note with no Settings button.
    case unknownStatus // @unknown default: a status from a future iOS; nothing happens.

    /// A sentence for the screen.
    var message: String { // Read by the lesson screen.
        switch self { // One sentence per outcome.
        case .idle: "Tap the button to run the switch." // Before the first tap.
        case .askedSystem: "Asked iOS. The system alert, with the Info.plist sentence, appears now." // Only iOS draws that alert.
        case .showedTrails: "Showing trails sorted by distance." // The feature works.
        case .showedSettingsPrompt: "Location is off. Showing a card with an Open Settings button." // Recovery, not a dead end.
        case .showedRestrictedMessage: "Location is unavailable on this device. No Settings button." // Someone else holds the switch.
        case .unknownStatus: "An unknown status: the safe fallback does nothing." // The @unknown default branch.
        }
    }

    /// Which lines of the course listing ran (positions in `TrailFinder.listing`).
    var linesRun: Set<Int> { // Used to highlight the code.
        switch self { // The switch line plus the matching case and its call.
        case .idle: [] // Nothing ran.
        case .askedSystem: [1, 2, 3] // switch, case .notDetermined, request.
        case .showedTrails: [1, 4, 5] // switch, case authorized, showNearbyTrails().
        case .showedSettingsPrompt: [1, 6, 7] // switch, case .denied, showOpenSettingsPrompt().
        case .showedRestrictedMessage: [1, 8, 9] // switch, case .restricted, showRestrictedMessage().
        case .unknownStatus: [1, 10, 11] // switch, @unknown default, break.
        }
    }
}

@Observable // SwiftUI redraws any view that reads status or outcome.
final class TrailFinder: NSObject, CLLocationManagerDelegate { // NSObject because delegate protocols come from Objective-C.
    @ObservationIgnored let manager = CLLocationManager() // Core Location's object for permission and status; kept for the object's whole life.
    var status: CLAuthorizationStatus // The latest answer, refreshed by the delegate method below.
    var outcome: TrailFinderOutcome = .idle // What the last tap did.
    @ObservationIgnored private let requestPermission: (TrailFinder) -> Void // How to ask iOS; tests and practice mode swap in a stand-in.

    /// The course's code, from the method down, exactly as the lesson shows it.
    static let listing = [ // Each line's position (counting from 0) is what linesRun above refers to.
        "func findNearbyTrails() {", // 0
        "    switch manager.authorizationStatus {", // 1
        "    case .notDetermined:", // 2
        "        manager.requestWhenInUseAuthorization()", // 3
        "    case .authorizedWhenInUse, .authorizedAlways:", // 4
        "        showNearbyTrails()", // 5
        "    case .denied:", // 6
        "        showOpenSettingsPrompt()", // 7
        "    case .restricted:", // 8
        "        showRestrictedMessage()", // 9
        "    @unknown default:", // 10
        "        break", // 11
        "    }", // 12
        "}", // 13
    ]

    /// Creates a finder. Leave `requestPermission` out to ask iOS for real.
    init(requestPermission: ((TrailFinder) -> Void)? = nil) { // Optional so the real app needs no argument.
        status = .notDetermined // Every stored property needs a value before super.init.
        self.requestPermission = requestPermission ?? { finder in // The default asks iOS for real.
            finder.manager.requestWhenInUseAuthorization() // iOS shows its alert, but only from .notDetermined.
        }
        super.init() // NSObject's own setup.
        manager.delegate = self // The manager now reports changes to this object.
        status = manager.authorizationStatus // The real answer stored for this app right now.
    }

    /// The course's method: read the status fresh and run exactly one branch.
    func findNearbyTrails() { // Called by the "Show trails near me" button.
        respond(to: manager.authorizationStatus) // Read at the moment of use, never cached.
    }

    /// The course's switch, taking the status as a parameter so practice mode and tests can feed any value.
    func respond(to status: CLAuthorizationStatus) { // One branch per status.
        switch status { // Exactly one case runs.
        case .notDetermined: // Never asked, or an Allow Once grant expired.
            outcome = .askedSystem // Record what happened for the screen.
            requestPermission(self) // manager.requestWhenInUseAuthorization() in the real app.
        case .authorizedWhenInUse, .authorizedAlways: // Either grant works right now.
            showNearbyTrails() // Run the real feature.
        case .denied: // The person said no, or switched location off.
            showOpenSettingsPrompt() // Explain and point to Settings.
        case .restricted: // Screen Time or device management blocks it.
            showRestrictedMessage() // Explain without a Settings button.
        @unknown default: // A status a future iOS might add.
            outcome = .unknownStatus // Do nothing risky; just note it.
        }
    }

    private func showNearbyTrails() { outcome = .showedTrails } // The feature; the screen draws the sorted list.
    private func showOpenSettingsPrompt() { outcome = .showedSettingsPrompt } // The screen draws the recovery card.
    private func showRestrictedMessage() { outcome = .showedRestrictedMessage } // The screen draws a calm note.

    /// Core Location calls this whenever the answer changes: after the alert, or after a change in Settings.
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) { // nonisolated: the protocol does not promise the main actor.
        let newStatus = manager.authorizationStatus // Read the fresh answer right here.
        Task { @MainActor in self.status = newStatus } // Hop to the main actor, where views read status.
    }
}

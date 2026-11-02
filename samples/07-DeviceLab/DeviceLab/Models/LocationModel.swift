// LocationModel.swift
// Who: lesson 7.2's live location demo and its "one trip through the loop body"
//      practice, plus the unit tests.
// What: the course's LocationModel, which streams CLLocationUpdate.liveUpdates()
//       into @Observable properties, with the loop body moved into apply(...) so
//       practice mode and tests can feed it any combination of update flags.
// Where: the Models folder; one instance lives in the lesson screen's @State.
// When: start() runs while the lesson's "Live updates" switch is on; SwiftUI cancels
//       its task when the switch goes off or the screen closes.
// Why: an async loop reads like ordinary code, and an observable model lets SwiftUI
//      redraw the moment a new position or a new status arrives.

import Foundation // Basic types; Core Location builds on Foundation.
import CoreLocation // CLLocation, CLServiceSession and CLLocationUpdate.
import Observation // The @Observable macro; this file does not import SwiftUI.

/// The four diagnostic flags a CLLocationUpdate carries, as plain values.
struct UpdateFlags: Equatable { // A struct, so tests can build any combination.
    var accuracyLimited = false // The person chose approximate location.
    var stationary = false // The device stopped moving, so updates pause.
    var locationUnavailable = false // No position can be found right now.
    var authorizationDenied = false // The person said no, so location is nil.

    /// Builds flags from any values; every flag defaults to false.
    init(accuracyLimited: Bool = false, stationary: Bool = false, locationUnavailable: Bool = false, authorizationDenied: Bool = false) { // Memberwise, with defaults.
        self.accuracyLimited = accuracyLimited // Copy each argument.
        self.stationary = stationary // Copy each argument.
        self.locationUnavailable = locationUnavailable // Copy each argument.
        self.authorizationDenied = authorizationDenied // Copy each argument.
    }

    /// Copies the flags out of a real update from Core Location.
    init(_ update: CLLocationUpdate) { // Used inside the live loop.
        accuracyLimited = update.accuracyLimited // Precise Location is off.
        stationary = update.stationary // Holding still.
        locationUnavailable = update.locationUnavailable // No signal.
        authorizationDenied = update.authorizationDenied // Permission is off.
    }
}

/// The activity kinds lesson 7.2 lists for liveUpdates(_:).
enum LiveActivityKind: String, CaseIterable, Identifiable { // Raw values are the Swift spellings shown in the picker.
    case standard = ".default" // General use.
    case automotiveNavigation = ".automotiveNavigation" // Driving directions.
    case otherNavigation = ".otherNavigation" // Boats, trains and other vehicles.
    case fitness = ".fitness" // Walking, running and hiking.
    case airborne = ".airborne" // Flying.
    var id: String { rawValue } // Each kind is unique.

    /// The Core Location value for this kind.
    var configuration: CLLocationUpdate.LiveConfiguration { // Passed to liveUpdates(_:).
        switch self { // One configuration per kind.
        case .standard: .default // Balanced accuracy and battery.
        case .automotiveNavigation: .automotiveNavigation // Snaps to roads, high frequency.
        case .otherNavigation: .otherNavigation // Vehicles off the road network.
        case .fitness: .fitness // Tuned for people on foot.
        case .airborne: .airborne // Tuned for flight.
        }
    }
}

@Observable @MainActor // SwiftUI redraws on changes; all work stays on the main thread.
final class LocationModel { // The course's model, slightly extended.
    var location: CLLocation? // The latest position, or nil before the first fix.
    var status = "Starting" // A short, human-readable state for the screen.
    var updateCount = 0 // How many updates have arrived; added so the screen can show the stream ticking.
    private var session: CLServiceSession? // Keeps the service session alive between start and stop.

    /// The course's start(): hold a session and loop over live updates until the task is cancelled.
    func start(_ kind: LiveActivityKind = .standard) async throws { // The kind is an addition for the configuration picker.
        session = CLServiceSession(authorization: .whenInUse) // Declares the goal; iOS shows the alert if needed.
        for try await update in CLLocationUpdate.liveUpdates(kind.configuration) { // One iteration per update, for as long as the task runs.
            apply(location: update.location, flags: UpdateFlags(update)) // The loop body, shared with practice mode.
        }
    }

    /// The course's loop body: reset the status, keep any new fix, then let the flags decide the message.
    func apply(location fix: CLLocation?, flags: UpdateFlags) { // Later checks win, exactly as in the course.
        updateCount += 1 // Count the update.
        status = "Live" // Reset first, so an old message never sticks.
        if let fix { location = fix } // Keep the last good fix when an update has none.
        if flags.accuracyLimited { status = "Approximate" } // Precise Location is off.
        if flags.stationary { status = "Holding still" } // Updates pause to save battery.
        if flags.locationUnavailable { status = "No signal" } // Canyons, tunnels, buildings.
        if flags.authorizationDenied { status = "Location off" } // Checked last, so it wins.
    }

    /// The course's stop(): end the session and drop the reference.
    func stop() { session?.invalidate(); session = nil } // The location indicator and the battery cost go away.
}

/// The five states the course's "one trip through the loop body" simulation offers.
enum LoopScenario: String, CaseIterable, Identifiable { // Raw values are the labels the course uses.
    case location = "update.location" // A fresh position.
    case denied = ".authorizationDenied" // Permission is off.
    case unavailable = ".locationUnavailable" // No signal.
    case limited = ".accuracyLimited" // Approximate location.
    case stationary = ".stationary" // Holding still.
    var id: String { rawValue } // Each scenario is unique.

    /// The loop body as the course prints it; positions match `linesRun`.
    static let listing = [ // Copied from the course's simulation.
        "for try await update in CLLocationUpdate.liveUpdates() {", // 0
        "    status = \"Live\"", // 1
        "    if let fix = update.location { location = fix }", // 2
        "    if update.accuracyLimited { status = \"Approximate\" }", // 3
        "    if update.stationary { status = \"Holding still\" }", // 4
        "    if update.locationUnavailable { status = \"No signal\" }", // 5
        "    if update.authorizationDenied { status = \"Location off\" }", // 6
        "}", // 7
    ]

    /// The lines whose bodies run for this scenario, as the course highlights them.
    var linesRun: Set<Int> { // Used to tint the listing.
        switch self { // From the course's simulation data.
        case .location: [0, 1, 2] // A position arrives.
        case .denied: [0, 1, 6] // No position; the last check wins.
        case .unavailable: [0, 1, 5] // No position; no signal.
        case .limited: [0, 1, 2, 3] // A rough position arrives.
        case .stationary: [0, 1, 2, 4] // A position, then the pause.
        }
    }

    /// Whether this scenario's update carries a position.
    var carriesLocation: Bool { self == .location || self == .limited || self == .stationary } // Denied and unavailable updates have none.

    /// The update flags this scenario sets.
    var flags: UpdateFlags { // Fed to LocationModel.apply.
        switch self { // One flag per scenario, except a plain fix.
        case .location: UpdateFlags() // No flags.
        case .denied: UpdateFlags(authorizationDenied: true) // Permission off.
        case .unavailable: UpdateFlags(locationUnavailable: true) // No signal.
        case .limited: UpdateFlags(accuracyLimited: true) // Approximate.
        case .stationary: UpdateFlags(stationary: true) // Holding still.
        }
    }

    /// What Trailhead's screen says in this scenario, from the course's simulation.
    var screenText: String { // Shown in the phone panel.
        switch self { // One sentence per scenario.
        case .location: "Lakeshore Trail is 0.6 km away. Trails are sorted by distance." // Live.
        case .denied: "Showing every trail from A to Z. Turn on location to sort by distance." // Location off.
        case .unavailable: "Still looking for your position. Canyons and tall buildings can block it." // No signal.
        case .limited: "You are somewhere in this area. Distances are rough estimates." // Approximate.
        case .stationary: "You have not moved for a while, so updates are paused to save battery." // Holding still.
        }
    }
}

// Trip.swift
// Who: SwiftData stores these models in lesson 6.8's trips container.
// What: the course's sync-ready Trip and Stop models: every property has a default,
//       the relationship is optional, has an inverse, and uses .cascade.
// Where: the Models folder. They live in their own container (TripsContainer), which
//        runs in memory in simulated mode because a free team cannot add iCloud.
// When: when the student opens lesson 6.8 and adds a trip.
// Why: CloudKit can deliver records in any order and from older app versions, so
//      synced models must follow these rules from the start.

import Foundation // Date.
import SwiftData // @Model and @Relationship.

@Model // A stored model that is ready for CloudKit sync.
final class Trip { // One trip, such as a weekend hike.
    var code: String = "" // A short code; no .unique, because CloudKit cannot enforce uniqueness.
    var name: String = "" // Default value, so a record arriving without it still loads.
    var startDate: Date = Date.now // Default value again, as sync requires.
    @Relationship(deleteRule: .cascade, inverse: \Stop.trip) // An inverse is required; .deny is not allowed with sync.
    var stops: [Stop]? = [] // Optional to-many end: sync needs every relationship optional.

    init(code: String, name: String) { // startDate and stops keep their defaults.
        self.code = code // Copies the code argument.
        self.name = name // Copies the name argument.
    }
}

@Model // The other end of the relationship.
final class Stop { // One stop along a trip.
    var name: String = "" // Default value, as sync requires.
    var trip: Trip? // Optional to-one end, the inverse of Trip.stops.
    init(name: String) { self.name = name } // Copies the argument into the property.
}

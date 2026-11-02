// HikeAttributes.swift (widget extension copy)
// Who: ActivityKit, and HikeLiveActivity in this extension, which draws the hike.
// What: the data for a hike Live Activity: the trail name, which never changes, and a
//       ContentState with the kilometers left, which every update replaces.
// Where: the DeviceLabWidget folder. An identical copy lives in the app's Models folder,
//        because the app starts the activity and this extension draws it.
// When: read every time the Lock Screen or the Dynamic Island redraws the hike.
// Why: this project uses folder-based groups, so one file cannot belong to both targets
//      here. In your own project, select HikeAttributes.swift and tick both targets under
//      Target Membership instead of keeping two copies. ActivityKit matches the two by
//      their type name, so the copies must stay identical.

import ActivityKit // ActivityAttributes.

/// Describes a hike Live Activity. `nonisolated` keeps its Codable conformance usable
/// from any thread; the app target isolates types to the main actor by default.
nonisolated struct HikeAttributes: ActivityAttributes { // One type for the fixed details and the changing state.
    /// The part that changes over time.
    struct ContentState: Codable, Hashable { // Codable for storage and push; Hashable to detect changes.
        var kilometersLeft: Double // The distance remaining on the trail.
    }
    var trailName: String // Fixed for the whole activity.
}

// UpdateLoop.swift
// Who: lesson 4.1's "A view is a value" card and lesson 4.4's "Watch the loop run" card.
// What: two small models. ImperativeCounterSimulation copies the UIKit counter's two
//       pieces of data (the count and the label's text). CupsLoop is a tiny
//       "Cups today" screen that writes down each step of SwiftUI's update loop.
// Where: the Models folder. Neither type imports SwiftUI, so tests can drive them directly.
// When: every time a demo button or switch on those cards is used.
// Why: the update loop is invisible in a real app. Writing each stage as a line of
//      text lets the screen show it and a test check it.

import Foundation // Foundation is enough here: these are plain Swift values.

/// The UIKit counter from lesson 4.1, reduced to its data so it can run inside SwiftUI.
/// UIKit keeps the number twice: once in `count`, once as the label's text.
struct ImperativeCounterSimulation { // A struct, so a SwiftUI @State can hold it.
    private(set) var count = 0 // The controller's `private var count = 0`.
    private(set) var labelText = "Count: 0" // What `label.text` shows: a second copy, typed by hand.
    var skipsLabelUpdate = false // true models deleting the `label.text = ...` line from addOne().

    /// The `addOne()` action method: change the data, then copy it into the label by hand.
    mutating func addOne() { // Runs once per simulated tap.
        count += 1 // `count += 1`: the data is now correct.
        if !skipsLabelUpdate { // Only when the second line has not been deleted...
            labelText = "Count: \(count)" // ...`label.text = "Count: \(count)"` copies the number into the label.
        }
    }

    /// true while the label still tells the truth about the data.
    var isInSync: Bool { labelText == "Count: \(count)" } // Compares the two copies.

    /// Starts again from a fresh controller.
    mutating func reset() { // Used by the Start over button.
        count = 0 // Back to the starting value.
        labelText = "Count: 0" // And the label's separately typed starting text.
    }
}

/// The "Cups today" screen from lesson 4.4's loop diagram, plus a log of the loop.
/// In bug mode the header keeps its own copy of the count, so it can go stale.
struct CupsLoop { // A value type: every change makes SwiftUI redraw the card holding it.
    private(set) var cups = 2 // `@State private var cups = 2`: the source of truth.
    private(set) var decafOnly = false // `@State private var decafOnly = false`: the switch.
    private(set) var headerCups = 2 // Bug mode only: `@State private var headerCups = 2`, a second copy.
    private(set) var bugMode = false // When true, the header reads headerCups instead of cups.
    private(set) var bodyRuns = 1 // How many times body has run; it ran once when the screen appeared.
    private(set) var stages: [String] = [] // The five lines that describe the most recent trip around the loop.

    /// The header line. In bug mode it reads the copy, which nothing updates.
    var headerText: String { "\(bugMode ? headerCups : cups) cups today" } // Which variable it reads is the whole bug.
    /// The big number in the middle of the screen. It always reads the source of truth.
    var countText: String { "\(cups)" } // Derived from cups, so it is always right.
    /// The caption under the number, derived from the switch.
    var captionText: String { decafOnly ? "Decaf only" : "Any coffee" } // Derived from decafOnly.
    /// true when the header and the number disagree, which only bug mode allows.
    var isOutOfSync: Bool { bugMode && headerCups != cups } // Two copies that drifted apart.

    /// The Add cup button's action, followed by the loop SwiftUI runs by itself.
    mutating func addCup() { // One tap.
        let before = cups // Remembered only so the log can say "from 2 to 3".
        cups += 1 // The state change: the action's whole job.
        bodyRuns += 1 // SwiftUI runs body again because body reads cups.
        let changed = bugMode ? "only the count Text; the header reads the stale copy" : "the header and the count Text" // What the diff finds.
        stages = [ // One line per stage of the loop.
            "Event: you tapped Add cup.", // 1. Something happened.
            "State change: cups went from \(before) to \(cups).", // 2. The action wrote new data.
            "Recompute: body ran again (run \(bodyRuns)).", // 3. SwiftUI asked for a fresh description.
            "Diff: changed \(changed).", // 4. Old and new descriptions compared.
            "Update: the screen now shows \(headerText) and \(countText).", // 5. Only the differences reach the screen.
        ] // End of the log.
    }

    /// The Decaf switch's binding writes here.
    mutating func setDecaf(_ isOn: Bool) { // Called with the switch's new position.
        guard isOn != decafOnly else { return } // No change, no loop.
        decafOnly = isOn // The state change.
        bodyRuns += 1 // body reads decafOnly, so it runs again.
        stages = [ // The same five stages, for a different event.
            "Event: you flipped the Decaf switch.", // 1.
            "State change: decafOnly is now \(decafOnly).", // 2.
            "Recompute: body ran again (run \(bodyRuns)).", // 3.
            "Diff: changed the caption and the switch.", // 4. The count did not change, so it is left alone.
            "Update: the caption now reads \(captionText).", // 5.
        ] // End of the log.
    }

    /// Switches bug mode on or off, starting the screen fresh so both copies begin equal.
    mutating func setBugMode(_ isOn: Bool) { // Called by the bug-mode switch.
        bugMode = isOn // Which variable the header reads.
        reset() // A fresh screen: the copy starts equal, which is why the bug hides at first.
    }

    /// Starts the screen over, keeping the bug-mode choice.
    mutating func reset() { // Used by the Start over button.
        cups = 2 // Back to the starting count.
        headerCups = 2 // The copy starts equal, which is why the bug hides at first.
        decafOnly = false // Switch off.
        bodyRuns = 1 // The fresh screen has run body once.
        stages = [] // Nothing has happened yet.
    }
}

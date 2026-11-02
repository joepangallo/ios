// UpdateLoopTests.swift
// Who: the Swift Testing runner.
// What: checks the UIKit counter simulation (lesson 4.1) and the "Cups today" update
//       loop with its bug mode (lessons 4.1 and 4.4).
// Where: the SwiftUIStudioTests target.
// When: whenever the tests run.
// Why: these models put words on the screen that explain what SwiftUI does. If the
//      words were wrong, students would learn the wrong loop.

import Testing // @Test, #expect, #require.
@testable import SwiftUIStudio // The app's internal types.

@MainActor // The models live on the main actor (the app's default isolation).
struct ImperativeCounterTests { // Lesson 4.1's quiz, as code.
    @Test func startsWithBothCopiesAtZero() { // The controller before any tap.
        let counter = ImperativeCounterSimulation() // A fresh controller.
        #expect(counter.count == 0) // The data.
        #expect(counter.labelText == "Count: 0") // The separately typed label text.
        #expect(counter.isInSync) // They agree, for now.
    }

    @Test func addOneUpdatesBothCopies() { // The full addOne() method.
        var counter = ImperativeCounterSimulation() // A fresh controller.
        for _ in 1...3 { counter.addOne() } // Three taps.
        #expect(counter.count == 3) // The data moved.
        #expect(counter.labelText == "Count: 3") // The label was copied by hand.
        #expect(counter.isInSync) // Still in step.
    }

    @Test func deletingTheLabelLineLeavesCountZeroOnScreen() { // The quiz: delete `label.text = ...`.
        var counter = ImperativeCounterSimulation() // A fresh controller.
        counter.skipsLabelUpdate = true // The line is gone.
        for _ in 1...3 { counter.addOne() } // Three taps.
        #expect(counter.count == 3) // The data really is 3...
        #expect(counter.labelText == "Count: 0") // ...but the screen still says "Count: 0".
        #expect(!counter.isInSync) // Out of sync.
    }

    @Test func resetRestoresTheStartingText() { // Start over.
        var counter = ImperativeCounterSimulation() // A fresh controller.
        counter.addOne() // One tap.
        counter.reset() // Start over.
        #expect(counter.count == 0) // Back to zero.
        #expect(counter.labelText == "Count: 0") // And the label too.
    }
}

@MainActor // Same isolation as the model.
struct CupsLoopTests { // The update loop.
    @Test func startsWithTwoCups() { // The widget's starting screen.
        let loop = CupsLoop() // A fresh screen.
        #expect(loop.headerText == "2 cups today") // Header.
        #expect(loop.countText == "2") // Big number.
        #expect(loop.captionText == "Any coffee") // Caption.
        #expect(loop.bodyRuns == 1) // body ran once when the screen appeared.
        #expect(loop.stages.isEmpty) // Nothing has happened yet.
    }

    @Test func addCupWritesFiveStages() { // One trip around the loop.
        var loop = CupsLoop() // A fresh screen.
        loop.addCup() // The event.
        #expect(loop.cups == 3) // The state change.
        #expect(loop.bodyRuns == 2) // body ran again.
        #expect(loop.stages.count == 5) // Event, state change, recompute, diff, update.
        #expect(loop.stages[0] == "Event: you tapped Add cup.") // Stage 1.
        #expect(loop.stages[1] == "State change: cups went from 2 to 3.") // Stage 2.
        #expect(loop.stages[2] == "Recompute: body ran again (run 2).") // Stage 3.
        #expect(loop.stages[3] == "Diff: changed the header and the count Text.") // Stage 4.
        #expect(loop.stages[4] == "Update: the screen now shows 3 cups today and 3.") // Stage 5.
        #expect(loop.headerText == "3 cups today") // The header reads the source of truth.
    }

    @Test func bugModeLetsTheHeaderGoStale() { // The duplicated state from the widget.
        var loop = CupsLoop() // A fresh screen.
        loop.setBugMode(true) // The header now reads its own copy.
        #expect(!loop.isOutOfSync) // Both copies start equal, so the bug hides at first.
        loop.addCup() // One tap.
        #expect(loop.countText == "3") // The number is right...
        #expect(loop.headerText == "2 cups today") // ...the header is stale.
        #expect(loop.isOutOfSync) // And the model says so.
        #expect(loop.stages[3].contains("stale copy")) // The diff explains why.
    }

    @Test func switchingBugModeStartsFresh() { // Turning bug mode on or off resets the screen.
        var loop = CupsLoop() // A fresh screen.
        loop.addCup() // cups = 3.
        loop.setBugMode(true) // Resets.
        #expect(loop.cups == 2) // Back to the start.
        #expect(loop.bugMode) // Bug mode stays on.
        loop.setBugMode(false) // Off again.
        #expect(!loop.bugMode) // Off.
    }

    @Test func decafChangesOnlyTheCaption() { // The second event on the screen.
        var loop = CupsLoop() // A fresh screen.
        loop.setDecaf(true) // Flip the switch.
        #expect(loop.captionText == "Decaf only") // The caption follows.
        #expect(loop.bodyRuns == 2) // body ran again.
        #expect(loop.stages[0] == "Event: you flipped the Decaf switch.") // Stage 1.
        loop.setDecaf(true) // The same value again.
        #expect(loop.bodyRuns == 2) // No change, no loop.
    }

    @Test func resetKeepsBugModeChoice() { // Start over.
        var loop = CupsLoop() // A fresh screen.
        loop.setBugMode(true) // Bug on.
        loop.addCup() // Drift apart.
        loop.reset() // Start over.
        #expect(loop.cups == 2 && loop.headerCups == 2) // Both copies equal again.
        #expect(loop.bugMode) // The choice is kept.
        #expect(loop.stages.isEmpty) // Log cleared.
    }
}

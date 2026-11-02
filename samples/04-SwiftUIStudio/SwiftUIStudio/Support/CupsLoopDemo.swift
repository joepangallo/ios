// CupsLoopDemo.swift
// Who: lesson 4.1's "A view is a value" card and lesson 4.4's "Watch the loop run" card.
// What: a tiny "Cups today" screen (a header, a big number, a caption, an Add cup
//       button and a Decaf switch) next to a log of SwiftUI's update loop. With bug
//       mode allowed, the header can read a second copy of the count that goes stale.
// Where: the Support folder, because two lessons show it.
// When: built when either card appears; every tap or flip writes a new log.
// Why: you cannot watch SwiftUI re-run body in a real app. Here each trip around the
//      loop is written out step by step, using the CupsLoop model.

import SwiftUI // View, Toggle, Button and the rest.

/// The "Cups today" screen with its update loop written out underneath.
struct CupsLoopDemo: View { // Used by two lessons.
    let allowsBugMode: Bool // Lesson 4.4 shows the bug-mode switch; lesson 4.1 does not.
    @State private var loop = CupsLoop() // The screen's data and the log, owned here.

    var body: some View { // Re-runs after every change to loop.
        VStack(alignment: .leading, spacing: 12) { // Phone screen, controls, log.
            VStack(spacing: 6) { // The pretend phone screen.
                Text(loop.headerText) // "2 cups today", read from cups or, in bug mode, from the copy.
                    .font(.subheadline.bold()) // A small header.
                    .foregroundStyle(loop.isOutOfSync ? .red : .primary) // Red when it disagrees with the number.
                Text(loop.countText) // The big number, always read from cups.
                    .font(.system(size: 44, weight: .bold, design: .rounded)) // Big and friendly.
                    .contentTransition(.numericText()) // Digits roll when the number changes.
                Text(loop.captionText) // "Any coffee" or "Decaf only".
                    .font(.caption) // Small.
                    .foregroundStyle(.secondary) // Quiet.
                HStack { // The two controls side by side.
                    Button("Add cup") { loop.addCup() } // The event: a tap.
                        .buttonStyle(.borderedProminent) // The main action.
                    Toggle("Decaf", isOn: Binding(get: { loop.decafOnly }, set: { loop.setDecaf($0) })) // The switch writes through the model so the log is kept.
                        .fixedSize() // The switch keeps its natural width.
                }
            }
            .frame(maxWidth: .infinity) // Center the pretend screen.
            .padding() // Room inside it.
            .demoPanel() // A white (or black) phone-like panel.

            if allowsBugMode { // Only lesson 4.4 offers the bug.
                Toggle("Bug mode: store the count twice", isOn: Binding(get: { loop.bugMode }, set: { loop.setBugMode($0) })) // The header switches to reading headerCups.
                    .tint(.red) // A warning color for a deliberate bug.
                if loop.isOutOfSync { // Only after the copies drift apart.
                    Text("The header says \(loop.headerText), but cups is \(loop.cups). Nothing updates the copy.") // Explains the drift.
                        .font(.footnote) // Small.
                        .foregroundStyle(.red) // Matches the red header.
                }
            }

            ValueRow(name: "body runs", value: "\(loop.bodyRuns)") // Climbs once per change.
            ConsoleView(lines: loop.stages) // The five stages of the most recent loop.
            Button("Start over") { loop.reset() } // Back to two cups.
                .font(.footnote) // A small secondary action.
        }
    }
}

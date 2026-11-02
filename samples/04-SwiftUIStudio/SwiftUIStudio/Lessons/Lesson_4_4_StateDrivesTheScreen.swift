// Lesson_4_4_StateDrivesTheScreen.swift
// Who: the student who opens lesson 4.4 from the home screen.
// What: the "State Drives the Screen" page: one source of truth, the water tracker,
//       the update loop with its bug mode, the tip calculator's derived values, the
//       duplicated-state bug beside its fix, @Binding versus a copy, the reusable
//       TipPercentPicker, and two controls that share one truth.
// Where: pushed onto the app's NavigationStack by ContentView.
// When: built when the lesson opens; every tap, drag and flip changes @State and
//       SwiftUI re-runs the bodies that read it.
// Why: if you catch yourself writing code whose job is to "update the label", stop.
//      Change the data instead, and let the label read the data.

import SwiftUI // @State, @Binding, Slider, Stepper, Toggle and the rest.

/// Lesson 4.4: state drives the screen.
struct StateDrivesTheScreenLesson: View { // One screen per lesson.
    let lesson: Lesson // Number, title and summary from the home screen.

    var body: some View { // The page: one card per course step.
        LessonPage(lesson: lesson) { // Scrolling page with the summary on top.
            OneSourceOfTruthCard() // Concept: One source of truth.
            WaterTrackerCard() // Code: Your first @State: a water tracker.
            DemoCard(title: "Watch the loop run", caption: "Tap Add cup and flip Decaf, then follow the loop: the event, the state it changes, the body SwiftUI re-runs, the diff, and the update. Then turn on bug mode, where the header keeps its own copy of the count.") { // Widget: Watch the loop run.
                CupsLoopDemo(allowsBugMode: true) // The loop, with the bug available.
            }
            TipCalculatorCard() // Code: Derive, do not duplicate.
            DuplicatedStateCard() // Compare: The duplicated-state bug.
            BindingVersusCopyCard() // Concept: Sharing state with a child: @Binding.
            TipScreenCard() // Code: A reusable child with @Binding.
            FocusCard() // Code: Two controls, one truth.
        }
    }
}

// MARK: - One source of truth

/// Concept: One source of truth.
private struct OneSourceOfTruthCard: View { // One card, read rather than tapped.
    var body: some View { // Static content.
        DemoCard(title: "One source of truth", caption: "State is data that can change while the app runs and that the screen depends on. Keep each piece in exactly one place and let every view read it from there. The loop below then runs without any code of yours.") { // The card.
            Label("Event: a tap, a keystroke, a timer firing, or data arriving.", systemImage: "1.circle") // Stage 1.
            Label("State change: your code writes a new value. That is its whole job.", systemImage: "2.circle") // Stage 2.
            Label("Recompute: SwiftUI calls body again on every view that read the value.", systemImage: "3.circle") // Stage 3.
            Label("Update: SwiftUI compares the old and new trees and changes only what differs.", systemImage: "4.circle") // Stage 4.
            Text("A useful rule: if you are writing code to \"update the label\", stop. Change the data, and let the label read it.") // The callout.
                .font(.footnote.bold()) // Emphasized.
        }
        .font(.callout) // Labels at callout size.
    }
}

// MARK: - Your first @State: a water tracker

/// The course's WaterTrackerView, with the challenges as inputs.
struct WaterTrackerView: View { // `struct WaterTrackerView: View`
    var step = 1 // Challenge 1: += 2 instead of += 1.
    var showsReset = false // Challenge 2: a Reset button.
    @State private var glasses = 0 // SwiftUI keeps this between redraws.

    var body: some View { // Re-runs after every change to glasses.
        VStack(spacing: 16) { // Number above button.
            Text("\(glasses) glasses") // Reads the state; nothing ever "updates the label".
                .font(.largeTitle) // Big.
                .contentTransition(.numericText()) // Digits roll as the number changes.
            Button("Drink a glass") { // The event.
                glasses += step // The state change: `glasses += 1` in the course.
            }
            .buttonStyle(.borderedProminent) // Filled.
            if showsReset { // Only with challenge 2 on.
                Button("Reset") { glasses = 0 } // A second writer of the same state.
            }
        }
    }
}

/// Code: Your first @State: a water tracker.
private struct WaterTrackerCard: View { // One card.
    @State private var byTwo = false // Challenge 1.
    @State private var showsReset = true // Challenge 2, on so students can start over.

    var body: some View { // Redraws when a challenge changes.
        DemoCard(title: "Your first @State: a water tracker", caption: "Tap the button and watch the number change. Changing glasses is enough: SwiftUI re-runs body and redraws what changed.") { // The card.
            WaterTrackerView(step: byTwo ? 2 : 1, showsReset: showsReset) // The live tracker.
                .frame(maxWidth: .infinity) // Centered.
                .padding(.vertical) // Air above and below.
                .demoPanel() // On a plain panel.
            Toggle("glasses += 2", isOn: $byTwo) // Challenge 1.
            Toggle("A Reset button that sets glasses = 0", isOn: $showsReset) // Challenge 2.
        }
    }
}

// MARK: - Derive, do not duplicate: a tip calculator

/// The course's TipCalculatorView, with the challenges as inputs.
struct TipCalculatorView: View { // `struct TipCalculatorView: View`
    var showsTipLine = false // Challenge 2: show the tip amount.
    var splits = false // Challenge 3: split between people.
    @State private var bill = 48.0 // State: the bill.
    @State private var tipPercent = 18.0 // State: the percentage.
    @State private var people = 1.0 // Challenge 3: `@State private var people = 1.0`.

    var tip: Double { TipMath.tip(bill: bill, percent: tipPercent) } // Derived: `bill * tipPercent / 100`.
    var total: Double { TipMath.total(bill: bill, percent: tipPercent) } // Derived: `bill + tip`. Nothing ever assigns to it.

    var body: some View { // Re-runs whenever bill, tipPercent or people changes.
        VStack(spacing: 12) { // Labels and sliders, top to bottom.
            Text("Bill: " + String(format: "$%.2f", bill)) // Reads the state.
            Slider(value: $bill, in: 0...200, step: 1) // Writes the bill through a binding.
            Text("Tip: \(Int(tipPercent))%") // Reads the state.
            Slider(value: $tipPercent, in: 0...30, step: 1) // Writes the percentage.
            if showsTipLine { // Challenge 2.
                Text("Tip: " + String(format: "$%.2f", tip)) // A derived value, shown.
            }
            Text("Total: " + String(format: "$%.2f", total)) // Recalculated from state every time body runs.
                .font(.title) // Big.
            if splits { // Challenge 3.
                Text("People: \(Int(people))") // Reads the state.
                Slider(value: $people, in: 1...8, step: 1) // From 1 to 8.
                Text("Each pays " + String(format: "$%.2f", TipMath.perPerson(bill: bill, percent: tipPercent, people: people))) // Another derived value.
                    .font(.headline) // Emphasized.
            }
        }
        .padding() // Space around the stack.
    }
}

/// Code: Derive, do not duplicate: a tip calculator.
private struct TipCalculatorCard: View { // One card.
    @State private var showsTipLine = false // Challenge 2.
    @State private var splits = false // Challenge 3.

    var body: some View { // Redraws when a challenge changes.
        DemoCard(title: "Derive, do not duplicate: a tip calculator", caption: "Only the bill and the percentage are state. The tip and the total are computed properties, recalculated every time body runs, so they can never disagree. Drag both sliders.") { // The card.
            TipCalculatorView(showsTipLine: showsTipLine, splits: splits) // The live calculator.
                .demoPanel() // On a plain panel.
            Toggle("Show the tip amount above the total", isOn: $showsTipLine) // Challenge 2.
            Toggle("Split between people (1 to 8)", isOn: $splits) // Challenge 3.
        }
    }
}

// MARK: - The duplicated-state bug

/// The bug: the course's StaleTotalView, with its two @State values kept in StaleTotalModel.
struct StaleTotalView: View { // `struct StaleTotalView: View`
    @State private var model = StaleTotalModel() // Holds bill and the stored total (`@State private var total = 56.64`).

    var body: some View { // Re-runs when the bill or the stored total changes.
        VStack(spacing: 12) { // Slider, bill, total, button.
            Slider(value: $model.bill, in: 0...200, step: 1) // Moving it changes the bill only.
            Text("Bill: " + String(format: "$%.2f", model.bill)) // Correct.
            Text("Total: " + String(format: "$%.2f", model.total)) // Stale until someone taps Recalculate.
                .foregroundStyle(model.isStale ? .red : .primary) // Red while it is wrong.
            Button("Recalculate") { model.recalculate() } // `total = bill * 1.18`: the line people forget.
        }
        .padding() // Space around the stack.
    }
}

/// The fix: the course's LiveTotalView, where the total is derived.
struct LiveTotalView: View { // `struct LiveTotalView: View`
    @State private var bill = 48.0 // The only state.
    var total: Double { bill * 1.18 } // Derived: nothing to forget.

    var body: some View { // Re-runs when bill changes.
        VStack(spacing: 12) { // Slider, bill, total.
            Slider(value: $bill, in: 0...200, step: 1) // Changes the bill...
            Text("Bill: " + String(format: "$%.2f", bill)) // ...the bill text follows...
            Text("Total: " + String(format: "$%.2f", total)) // ...and so does the total.
        }
        .padding() // Space around the stack.
    }
}

/// Compare: The duplicated-state bug.
private struct DuplicatedStateCard: View { // One card.
    var body: some View { // Static layout around two live views.
        DemoCard(title: "The duplicated-state bug", caption: "Both show a total with an 18% tip. Drag the top slider without tapping Recalculate: the stored total goes stale and turns red. The bottom one derives its total, so there is nothing to forget.") { // The card.
            Text("Bug: total stored as state") // Left side of the compare.
                .font(.subheadline.bold()) // Small heading.
            StaleTotalView() // The live bug.
                .demoPanel() // On a plain panel.
            Text("Fix: total derived from bill") // Right side of the compare.
                .font(.subheadline.bold()) // Small heading.
            LiveTotalView() // The live fix.
                .demoPanel() // On a plain panel.
            Text("Every extra copy of a fact is a promise to keep two values in sync by hand. If a value can be calculated from other state, make it a computed property, not @State.") // The verdict.
                .font(.footnote) // Small.
        }
    }
}

// MARK: - Sharing state with a child: @Binding

/// A child that borrows the parent's value through a binding.
private struct BoundTipChild: View { // The right way.
    @Binding var percent: Int // Stores nothing; reads and writes the parent's value.
    var body: some View { // Re-runs when the parent's value changes.
        Stepper("$tipPercent child: \(percent)%", value: $percent, in: 0...30) // Writes straight through to the parent.
    }
}

/// A child that was handed a copy and keeps its own state: the bug.
private struct CopiedTipChild: View { // The wrong way.
    @State var percent: Int // A second source of truth, initialized from a copy.
    var body: some View { // Re-runs when its own copy changes.
        Stepper("tipPercent copy: \(percent)%", value: $percent, in: 0...30) // Changes only the copy.
    }
}

/// Concept: Sharing state with a child: @Binding.
private struct BindingVersusCopyCard: View { // One card.
    @State private var tipPercent = 18 // @State: the parent owns the value.

    var body: some View { // Re-runs when the parent's value changes.
        DemoCard(title: "Sharing state with a child: @Binding", caption: "@State owns a value. @Binding borrows read and write access to state owned elsewhere. The $ prefix passes the connection; without it, the child gets a copy of the number.") { // The card.
            Text("Parent owns tipPercent = \(tipPercent)%") // The single source of truth.
                .font(.title3.bold().monospacedDigit()) // Prominent, digits keep their width.
            BoundTipChild(percent: $tipPercent) // Passes the connection.
            CopiedTipChild(percent: tipPercent) // Passes a copy of the number.
            Text("Step the first child: the parent's number moves. Step the second: only the copy moves. Slider, Toggle, Stepper and TextField all take bindings, which is why you have been writing $.") // What to notice.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
            Text("Who owns it? Put @State on the highest view that needs the value, and pass bindings down to the children that change it.") // The callout.
                .font(.footnote.bold()) // Emphasized.
        }
    }
}

// MARK: - A reusable child with @Binding

/// The course's reusable picker: it does not own the percentage.
struct TipPercentPicker: View { // `struct TipPercentPicker: View`
    @Binding var percent: Int // A binding to the parent's state.
    var body: some View { // Re-runs when the bound value changes.
        Stepper("Tip", value: $percent, in: 0...30) // Minus and plus write through the binding.
    }
}

/// The course's TipScreen, with the Reset challenge as an input.
struct TipScreen: View { // `struct TipScreen: View`
    var showsReset = false // Challenge 1: Button("Reset") { tipPercent = 15 }.
    @State private var tipPercent = 18 // The single source of truth.

    var body: some View { // Re-runs when tipPercent changes, whoever changed it.
        VStack(spacing: 20) { // Big number above the picker.
            Text("\(tipPercent)%") // Reads the parent's state.
                .font(.system(size: 64, weight: .bold)) // Very big.
                .contentTransition(.numericText()) // Digits roll.
            TipPercentPicker(percent: $tipPercent) // Hands the child the connection.
            if showsReset { // Challenge 1.
                Button("Reset") { tipPercent = 15 } // The parent writes; the child follows.
            }
        }
        .padding() // Space around the stack.
    }
}

/// Code: A reusable child with @Binding.
private struct TipScreenCard: View { // One card.
    @State private var showsReset = true // Challenge 1, on by default.

    var body: some View { // Redraws when the challenge changes.
        DemoCard(title: "A reusable child with @Binding", caption: "TipPercentPicker receives a binding to TipScreen's state. Tap minus and plus: the stepper lives in the child, yet the big number in the parent changes, because both read one value.") { // The card.
            TipScreen(showsReset: showsReset) // The live parent and child.
                .demoPanel() // On a plain panel.
            Toggle("Button(\"Reset\") { tipPercent = 15 }", isOn: $showsReset) // Challenge 1.
                .font(.footnote.monospaced()) // Code font.
            Text("Challenge 2, breaking it on purpose, is the second child in the card above: @State instead of @Binding, and tipPercent passed without the $.") // Where challenge 2 lives.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - Two controls, one truth

/// The course's FocusView, with the challenges as inputs.
struct FocusView: View { // `struct FocusView: View`
    var secondToggle = false // Challenge 1: Toggle("Silence calls").
    var showsStatus = false // Challenge 2: the status Text.
    @State private var doNotDisturb: Bool // The one value everything reads.

    /// Challenge 3: start in quiet mode by changing the initial value.
    init(secondToggle: Bool = false, showsStatus: Bool = false, startsQuiet: Bool = false) { // Defaults match the course.
        self.secondToggle = secondToggle // Store the input.
        self.showsStatus = showsStatus // Store the input.
        _doNotDisturb = State(initialValue: startsQuiet) // The underscore names the State wrapper itself; this sets its starting value.
    }

    var body: some View { // Re-runs whenever doNotDisturb changes, from any control.
        VStack(spacing: 24) { // Icon, controls.
            Image(systemName: doNotDisturb ? "moon.fill" : "sun.max") // Reads the state.
                .font(.system(size: 60)) // Big.
                .foregroundStyle(doNotDisturb ? .indigo : .orange) // Reads the state.
                .contentTransition(.symbolEffect(.replace)) // The symbol morphs.
            if showsStatus { // Challenge 2.
                Text(doNotDisturb ? "Notifications silenced" : "Notifications on") // Reads the state.
            }
            Toggle("Do Not Disturb", isOn: $doNotDisturb) // Control one: reads and writes through a binding.
            if secondToggle { // Challenge 1.
                Toggle("Silence calls", isOn: $doNotDisturb) // Control three: the same binding.
            }
            Button(doNotDisturb ? "Wake up" : "Go quiet") { // Control two: the title reads the state.
                doNotDisturb.toggle() // Writes the same value.
            }
            .buttonStyle(.borderedProminent) // Filled.
        }
        .padding() // Space around the stack.
    }
}

/// Code: Two controls, one truth.
private struct FocusCard: View { // One card.
    @State private var secondToggle = false // Challenge 1.
    @State private var showsStatus = false // Challenge 2.
    @State private var startsQuiet = false // Challenge 3.

    var body: some View { // Redraws when a challenge changes.
        DemoCard(title: "Two controls, one truth", caption: "Flip the switch or tap the button. Both write the same doNotDisturb state, and the icon, its color, the switch and the button title all read it.") { // The card.
            FocusView(secondToggle: secondToggle, showsStatus: showsStatus, startsQuiet: startsQuiet) // The live view.
                .id(startsQuiet) // A new identity when the starting value changes, so @State starts over.
                .demoPanel() // On a plain panel.
            Toggle("A second Toggle(\"Silence calls\")", isOn: $secondToggle) // Challenge 1.
            Toggle("Show the status text", isOn: $showsStatus) // Challenge 2.
            Toggle("Start in quiet mode (initial value true)", isOn: $startsQuiet) // Challenge 3.
        }
    }
}

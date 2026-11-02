// Lesson_4_5_ObservableModels.swift
// Who: the student who opens lesson 4.5 from the home screen.
// What: the "Observable Models" page: one order shared by two views, the first
//       @Observable model, a live count of which bodies re-run (with the older
//       ObservableObject for comparison), editing with @Bindable, sharing through
//       @Environment, a checkout view model, and the model running with no screen.
// Where: pushed onto the app's NavigationStack by ContentView. The models live in
//        Models/CoffeeOrder.swift and Models/ObservationTracking.swift.
// When: built when the lesson opens; every control changes a model, and SwiftUI
//       re-runs only the bodies that read what changed.
// Why: real apps keep their data and rules in models that several screens share.
//      @Observable lets SwiftUI follow those models precisely.

import SwiftUI // Views, @State, @Bindable, @Environment.
import Combine // @StateObject's ObservableObject comes from Combine.

/// Lesson 4.5: observable models.
struct ObservableModelsLesson: View { // One screen per lesson.
    let lesson: Lesson // Number, title and summary from the home screen.

    var body: some View { // The page: one card per course step.
        LessonPage(lesson: lesson) { // Scrolling page with the summary on top.
            StateOutgrowsViewCard() // Concept: When state outgrows a view.
            FirstObservableCard() // Code: Your first @Observable model.
            ObservationTrackerCard() // Widget: See which views re-run.
            BindableEditorCard() // Code: Editing a model with @Bindable.
            EnvironmentCard() // Code: Sharing a model through @Environment.
            ViewModelCard() // Concept: Model, view, and view model.
            ModelWithoutScreenCard() // Code: The model runs without a screen.
        }
    }
}

// MARK: - When state outgrows a view

/// One of two views that hold the same order object.
private struct OrderCounterTile: View { // A small screen showing the shared order.
    let title: String // "Barista" or "Customer".
    let order: CoffeeOrder // A reference: both tiles point at the same object.

    var body: some View { // Re-runs when shots changes, because it reads shots.
        VStack(spacing: 6) { // Title, value, button.
            Text(title).font(.caption.bold()) // Which screen this is.
            Text("\(order.shots) shots") // Reads the shared object.
                .font(.title3.monospacedDigit()) // Digits keep their width.
            Button("Add a shot") { order.addShot() } // Writes the shared object; the limit lives in the model.
                .buttonStyle(.bordered) // Framed.
                .controlSize(.small) // Compact.
        }
        .frame(maxWidth: .infinity) // Half the row each.
        .padding(.vertical, 10) // Air.
        .demoPanel() // On a plain panel.
    }
}

/// Concept: When state outgrows a view.
private struct StateOutgrowsViewCard: View { // One card.
    @State private var order = CoffeeOrder() // One object, created once and kept alive by @State.

    var body: some View { // Lays out the two tiles.
        DemoCard(title: "When state outgrows a view", caption: "Model: data plus the rules about it, kept separate from any screen. @Observable makes a class report every read and write. A class is a reference type: every view that holds one points at the same single object.") { // The card.
            HStack(spacing: 12) { // Two screens side by side.
                OrderCounterTile(title: "Barista", order: order) // Holds the order.
                OrderCounterTile(title: "Customer", order: order) // Holds the same order.
            }
            Text("Tap either button: both tiles change, because there is only one order. Past four shots the model refuses, whichever screen asks.") // What to notice.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
            Text("The older way: before iOS 17, models adopted ObservableObject with @Published properties, and views used @StateObject or @ObservedObject. Any change re-ran every observing view. The re-run counter card below compares the two.") // The callout.
                .font(.footnote) // Small.
        }
    }
}

// MARK: - Your first @Observable model

/// The course's OrderView, with the challenges as inputs.
struct OrderView: View { // `struct OrderView: View`
    var showsRemove = false // Challenge 1: a Remove a shot button.
    var mocha = false // Challenge 3: the model's drink becomes "Mocha".
    @State private var order = CoffeeOrder() // The view creates the model once; @State keeps it alive.

    var body: some View { // Re-runs when a property it reads changes.
        VStack(spacing: 16) { // Text, price, buttons.
            Text("\(order.drink) with \(order.shots) shots") // Reads drink and shots: `"Latte with \(order.shots) shots"`.
            Text(String(format: "$%.2f", order.price)) // Reads price, which reads shots.
                .font(.largeTitle) // Big.
                .contentTransition(.numericText()) // Digits roll.
            Button("Add a shot") { order.addShot() } // The view asks; the model applies the four-shot limit.
                .buttonStyle(.borderedProminent) // Filled.
            if showsRemove { // Challenge 1.
                Button("Remove a shot") { order.removeShot() } // Never below one shot.
            }
        }
        .onChange(of: mocha, initial: true) { order.drink = mocha ? "Mocha" : "Latte" } // Copies the challenge switch into the model.
    }
}

/// Code: Your first @Observable model.
private struct FirstObservableCard: View { // One card.
    @State private var showsRemove = true // Challenge 1, on by default.
    @State private var mocha = false // Challenge 3.

    var body: some View { // Redraws when a challenge changes.
        DemoCard(title: "Your first @Observable model", caption: "The order lives in a class marked @Observable. The view creates it once and keeps it alive with @State. Tap: the view changes the model, the model reports the change, and SwiftUI re-runs the body that read shots and price.") { // The card.
            OrderView(showsRemove: showsRemove, mocha: mocha) // The live view.
                .frame(maxWidth: .infinity) // Centered.
                .padding(.vertical) // Air.
                .demoPanel() // On a plain panel.
            Toggle("Button(\"Remove a shot\")", isOn: $showsRemove) // Challenge 1.
            Toggle("var drink = \"Mocha\" in the model", isOn: $mocha) // Challenge 3.
            Text("Challenge 2, changing the base price inside the model, needs no change to the view at all: price is computed in CoffeeOrder.") // Challenge 2, explained.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - See which views re-run

/// One tile: a view's name, what it reads, its run count, and its content.
private struct TrackerTile<Content: View>: View { // Shared look for the six tiles.
    let name: String // The view's name, for example "HeaderView".
    let reads: String // What its body reads.
    let runs: Int // Its body-run count, passed in already counted.
    @ViewBuilder let content: Content // What the view shows.

    var body: some View { // Draws the tile.
        VStack(alignment: .leading, spacing: 4) { // Name, reads, content.
            HStack { // Name and count.
                Text(name).font(.caption.monospaced().bold()) // The view's name.
                Spacer() // Pushes the count right.
                Text("runs: \(runs)").font(.caption.monospacedDigit()) // How many times its body ran.
            }
            Text("reads \(reads)").font(.caption2).foregroundStyle(.secondary) // What it depends on.
            content // The view's own content.
        }
        .padding(8) // Room inside.
        .demoPanel() // On a plain panel.
    }
}

/// HeaderView reads only drink.
private struct HeaderTile: View { // @Observable version.
    let order: CoffeeOrder // A reference to the shared order.
    let counter: BodyRunCounter // Where runs are recorded.
    var body: some View { // Re-runs only when drink changes.
        let drink = order.drink // The read happens here, in this body, so this body is what gets tracked.
        let runs = counter.tick("HeaderView") // Count this run.
        TrackerTile(name: "HeaderView", reads: "order.drink", runs: runs) { Text(drink).font(.title3.bold()) } // The drink as a heading.
    }
}

/// PriceTagView reads only price (and through it, shots and oatMilk).
private struct PriceTile: View { // @Observable version.
    let order: CoffeeOrder // A reference to the shared order.
    let counter: BodyRunCounter // Where runs are recorded.
    var body: some View { // Re-runs when shots or oatMilk changes.
        let price = order.priceText // Reading price reads shots and oatMilk.
        let runs = counter.tick("PriceTagView") // Count this run.
        TrackerTile(name: "PriceTagView", reads: "order.price", runs: runs) { Text(price).font(.headline) } // The price.
    }
}

/// SummaryView reads both.
private struct SummaryTile: View { // @Observable version.
    let order: CoffeeOrder // A reference to the shared order.
    let counter: BodyRunCounter // Where runs are recorded.
    var body: some View { // Re-runs after any of the three changes.
        let drink = order.drink // Read one.
        let price = order.priceText // Read two.
        let runs = counter.tick("SummaryView") // Count this run.
        TrackerTile(name: "SummaryView", reads: "drink and price", runs: runs) { HStack { Text(drink); Spacer(); Text(price) } } // Both.
    }
}

/// The ObservableObject versions: each one holds the order with @ObservedObject.
private struct LegacyHeaderTile: View { // ObservableObject version.
    @ObservedObject var order: LegacyCoffeeOrder // Re-runs on every change notice.
    let counter: BodyRunCounter // Where runs are recorded.
    var body: some View { // Re-runs after any change to the order.
        let runs = counter.tick("HeaderView") // Count this run.
        TrackerTile(name: "HeaderView", reads: "order.drink", runs: runs) { Text(order.drink).font(.title3.bold()) } // Same content.
    }
}

/// ObservableObject version of PriceTagView.
private struct LegacyPriceTile: View { // ObservableObject version.
    @ObservedObject var order: LegacyCoffeeOrder // Re-runs on every change notice.
    let counter: BodyRunCounter // Where runs are recorded.
    var body: some View { // Re-runs after any change to the order.
        let runs = counter.tick("PriceTagView") // Count this run.
        TrackerTile(name: "PriceTagView", reads: "order.price", runs: runs) { Text(order.priceText).font(.headline) } // Same content.
    }
}

/// ObservableObject version of SummaryView.
private struct LegacySummaryTile: View { // ObservableObject version.
    @ObservedObject var order: LegacyCoffeeOrder // Re-runs on every change notice.
    let counter: BodyRunCounter // Where runs are recorded.
    var body: some View { // Re-runs after any change to the order.
        let runs = counter.tick("SummaryView") // Count this run.
        TrackerTile(name: "SummaryView", reads: "drink and price", runs: runs) { HStack { Text(order.drink); Spacer(); Text(order.priceText) } } // Same content.
    }
}

/// Widget: See which views re-run.
private struct ObservationTrackerCard: View { // One card.
    @State private var legacy = false // Which approach is showing.
    @State private var order = CoffeeOrder() // The @Observable order.
    @StateObject private var legacyOrder = LegacyCoffeeOrder() // The ObservableObject order; @StateObject keeps it alive.
    @State private var counter = BodyRunCounter() // Counts for the @Observable tiles.
    @State private var legacyCounter = BodyRunCounter() // Counts for the ObservableObject tiles.
    @State private var lastChange: TrackedProperty? = nil // The most recent change, for the prediction line.
    @State private var resetToken = 0 // Changing it gives the tiles new identities, so they start counting again.

    var body: some View { // Lays out controls and tiles.
        DemoCard(title: "See which views re-run", caption: "Three small views share one order: HeaderView reads the drink, PriceTagView reads the price, SummaryView reads both. Change one property at a time and watch the run counters. Then switch to ObservableObject and compare.") { // The card.
            Picker("Approach", selection: $legacy) { // Which model type drives the tiles.
                Text("@Observable").tag(false) // Per-property tracking.
                Text("ObservableObject").tag(true) // The older way.
            }
            .pickerStyle(.segmented) // Side by side.
            if legacy { // The older way.
                LegacyHeaderTile(order: legacyOrder, counter: legacyCounter).id(resetToken) // Three tiles that...
                LegacyPriceTile(order: legacyOrder, counter: legacyCounter).id(resetToken) // ...all observe the whole...
                LegacySummaryTile(order: legacyOrder, counter: legacyCounter).id(resetToken) // ...object.
            } else { // The modern way.
                HeaderTile(order: order, counter: counter).id(resetToken) // Three tiles that...
                PriceTile(order: order, counter: counter).id(resetToken) // ...each track only what...
                SummaryTile(order: order, counter: counter).id(resetToken) // ...they read.
            }
            Picker("Drink", selection: drinkBinding) { // Changes drink.
                ForEach(["Latte", "Mocha", "Cold Brew"], id: \.self) { Text($0).tag($0) } // Three drinks.
            }
            .pickerStyle(.segmented) // Side by side.
            Stepper("Shots: \(legacy ? legacyOrder.shots : order.shots)", value: shotsBinding, in: 1...4) // Changes shots.
            Toggle("Oat milk", isOn: oatBinding) // Changes oatMilk.
            if let lastChange { // After the first change.
                Text("You changed \(lastChange.rawValue). Expected to re-run: \(ObservationPrediction.viewsThatRerun(after: lastChange, legacy: legacy).joined(separator: ", ")).") // The rule, to compare with the counters.
                    .font(.footnote) // Small.
            }
            Button("Reset counts") { // Starts all counters over.
                counter.reset() // Forget the @Observable counts.
                legacyCounter.reset() // Forget the ObservableObject counts.
                resetToken += 1 // New identities: each tile is built once more and shows 1.
            }
            .font(.footnote) // Secondary.
        }
    }

    /// The drink picker's binding: writes whichever model is showing and records the change.
    private var drinkBinding: Binding<String> { // A hand-made binding so one control can drive either model.
        Binding(get: { legacy ? legacyOrder.drink : order.drink }, set: { newValue in // Read from the visible model.
            lastChange = .drink // Remember what changed.
            if legacy { legacyOrder.drink = newValue } else { order.drink = newValue } // Write to the visible model.
        })
    }

    /// The shots stepper's binding.
    private var shotsBinding: Binding<Int> { // Same pattern.
        Binding(get: { legacy ? legacyOrder.shots : order.shots }, set: { newValue in // Read from the visible model.
            lastChange = .shots // Remember what changed.
            if legacy { legacyOrder.shots = newValue } else { order.shots = newValue } // Write to the visible model.
        })
    }

    /// The oat milk switch's binding.
    private var oatBinding: Binding<Bool> { // Same pattern.
        Binding(get: { legacy ? legacyOrder.oatMilk : order.oatMilk }, set: { newValue in // Read from the visible model.
            lastChange = .oatMilk // Remember what changed.
            if legacy { legacyOrder.oatMilk = newValue } else { order.oatMilk = newValue } // Write to the visible model.
        })
    }
}

// MARK: - Editing a model with @Bindable

/// The course's OrderEditor: it receives a model and edits it through bindings.
struct OrderEditor: View { // `struct OrderEditor: View`
    @Bindable var order: CoffeeOrder // @Bindable lets $order.shots produce a binding into the model.
    var showsExtraHot = false // Challenge 1: an Extra hot switch.

    var body: some View { // Re-runs when a property it reads changes.
        Form { // Grouped rows, like Settings.
            Text(order.oatMilk ? "Oat latte" : "Latte") // Reads oatMilk.
                .font(.title2) // Big.
            Stepper("\(order.shots) shots", // The label reads shots...
                    value: $order.shots, in: 1...4) // ...and the stepper writes it through a binding.
            Toggle("Oat milk", isOn: $order.oatMilk) // A binding straight into the model.
            if showsExtraHot { // Challenge 1.
                Toggle("Extra hot", isOn: $order.extraHot) // `var extraHot = false` in the model.
            }
        }
    }
}

/// Code: Editing a model with @Bindable.
private struct BindableEditorCard: View { // One card: plays the parent that creates the order.
    @State private var order = CoffeeOrder() // The parent holds the order with @State...
    @State private var showsExtraHot = true // Challenge 1, on by default.

    var body: some View { // Redraws when the order's price or the challenge changes.
        DemoCard(title: "Editing a model with @Bindable", caption: "Controls need bindings, but a view that merely receives a model cannot use $ on it. Marking the property @Bindable fixes that: $order.shots becomes a binding into the model.") { // The card.
            OrderEditor(order: order, showsExtraHot: showsExtraHot) // ...and passes it in.
                .embeddedForm(height: showsExtraHot ? 230 : 186) // A Form scrolls on its own, so it gets a fixed height inside this page.
                .scrollDisabled(true) // Every row already fits.
            ValueRow(name: "order.price", value: order.priceText) // The parent sees every edit.
            ValueRow(name: "order.extraHot", value: "\(order.extraHot)") // Including the challenge's new property.
            Toggle("Toggle(\"Extra hot\", isOn: $order.extraHot)", isOn: $showsExtraHot) // Challenge 1.
                .font(.footnote.monospaced()) // Code font.
            Text("Challenge 2: delete @Bindable and the $order lines stop compiling, because a plain property cannot produce bindings.") // Challenge 2, explained.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - Sharing a model through @Environment

/// The course's SessionButton: finds the planner in the environment.
struct SessionButton: View { // `struct SessionButton: View`
    @Environment(StudyPlanner.self) private var planner // Reads the planner some ancestor injected.
    var body: some View { // Re-runs if what it reads changes.
        Button("Finish a session") { planner.sessionsDone += 1 } // Writes the shared planner.
            .buttonStyle(.bordered) // Framed.
    }
}

/// The course's PlannerScreen, with the challenge as an input.
struct PlannerScreen: View { // `struct PlannerScreen: View`
    var secondButton = false // Challenge 1: a second SessionButton().
    @State private var planner = StudyPlanner() // The screen owns the planner.

    var body: some View { // Re-runs when sessionsDone changes.
        VStack(spacing: 20) { // Count above buttons.
            Text("\(planner.sessionsDone) sessions done") // Reads the planner.
            SessionButton() // No initializer argument: it finds the planner itself.
            if secondButton { // Challenge 1.
                SessionButton() // Both write to the same planner.
            }
        }
        .environment(planner) // Injects the planner for every view inside.
    }
}

/// Code: Sharing a model through @Environment.
private struct EnvironmentCard: View { // One card.
    @State private var secondButton = false // Challenge 1.

    var body: some View { // Redraws when the challenge changes.
        DemoCard(title: "Sharing a model through @Environment", caption: "The environment is a set of values SwiftUI hands down the view tree. The screen injects the planner once with .environment(planner), and any view inside reads it with @Environment(StudyPlanner.self).") { // The card.
            PlannerScreen(secondButton: secondButton) // The live screen.
                .frame(maxWidth: .infinity) // Centered.
                .padding(.vertical) // Air.
                .demoPanel() // On a plain panel.
            Toggle("A second SessionButton()", isOn: $secondButton) // Challenge 1.
            Text("Predict: without .environment(planner), the app stops with an error saying no StudyPlanner was found in the environment. That is why this app never shows that version.") // Challenge 2, explained instead of crashing.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - Model, view, and view model

/// The checkout screen: a thin view over CheckoutViewModel.
private struct CheckoutView: View { // The view: reads values and forwards taps.
    @Bindable var checkout: CheckoutViewModel // The view model, editable through bindings.

    var body: some View { // Describes the screen from the view model's values.
        VStack(alignment: .leading, spacing: 10) { // Order, controls, message.
            Text(checkout.order.summary + ", " + checkout.order.priceText) // The model's own description and price.
                .font(.headline) // Prominent.
            HStack { // The model's rules, called from the view.
                Button("Add a shot") { checkout.order.addShot() } // order.addShot(): the limit lives in the model.
                Button("Remove") { checkout.order.removeShot() } // order.removeShot().
                Toggle("Oat", isOn: Bindable(checkout.order).oatMilk) // Bindable(...) makes a binding into the model the view model holds.
            }
            .buttonStyle(.bordered) // Framed buttons.
            TextField("Name for the cup", text: $checkout.cupName) // Screen state, kept in the view model.
                .textFieldStyle(.roundedBorder) // A visible field.
            Toggle("Shop is open (simulated)", isOn: $checkout.shopIsOpen) // Switch off to see the error path.
            HStack { // The action and the reset.
                Button("Place order") { Task { await checkout.placeOrder() } } // Task runs the async method from a tap.
                    .buttonStyle(.borderedProminent) // The main action.
                    .disabled(!checkout.canPlaceOrder) // The rule lives in the view model.
                Button("Start over") { checkout.startOver() } // Back to editing.
            }
            Text(checkout.statusMessage) // The view model words every status.
                .font(.footnote) // Small.
                .foregroundStyle(statusColor) // Color by status.
        }
    }

    /// Green for success, red for an error, gray otherwise.
    private var statusColor: Color { // A presentation choice, so it stays in the view.
        switch checkout.status { // One color per status.
        case .placed: .green // Success.
        case .failed: .red // Error.
        case .editing, .sending: .secondary // Neutral.
        }
    }
}

/// Concept: Model, view, and view model.
private struct ViewModelCard: View { // One card.
    @State private var checkout = CheckoutViewModel(order: CoffeeOrder()) // The view model owns the screen's state and holds the model.

    var body: some View { // Lays out the explanation and the live checkout.
        DemoCard(title: "Model, view, and view model", caption: "Model: CoffeeOrder, with shots, milk, the price rule and the four-shot limit. View: reads values and forwards taps. View model: a checkout class that adds status and error messages for this one screen.") { // The card.
            CheckoutView(checkout: checkout) // The live checkout.
                .padding(10) // Room inside.
                .demoPanel() // On a plain panel.
            Text("Payoff: the rules are plain Swift, so the unit tests in this project run CoffeeOrder and CheckoutViewModel with no screen at all. Keep body thin: it reads values and describes layout. Nothing is sent anywhere; the shop is simulated.") // The payoff and the callout.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - The model runs without a screen

/// Code: The model runs without a screen.
private struct ModelWithoutScreenCard: View { // One card.
    @State private var tenLoops = false // Challenge 1: loop 10 times.
    @State private var oatMilk = true // Challenge 2: set oatMilk = false instead.
    @State private var removeOneShot = false // Challenge 3: call removeShot() before the last print.
    @State private var output: [String] = [] // What the last run printed.

    var body: some View { // Redraws when a challenge or the output changes.
        DemoCard(title: "The model runs without a screen", caption: "The coffee order's logic as plain Swift: no views. Run it: because the rules live in the model, you can exercise them directly, which is exactly what automated tests do.") { // The card.
            CodeBlock(lines: [ // The course's program, adjusted by the challenges.
                "let order = CoffeeOrder()", // Create the model.
                "print(String(format: \"$%.2f\", order.price))", // First print.
                "for _ in 1...\(tenLoops ? 10 : 3) { order.addShot() }", // Challenge 1 changes 3 to 10.
                "order.oatMilk = \(oatMilk)", // Challenge 2 changes true to false.
            ] + (removeOneShot ? ["order.removeShot()"] : []) + [ // Challenge 3 adds this line.
                "print(order.shots, String(format: \"$%.2f\", order.price))", // Second print.
            ]) // End of the program.
            Toggle("Loop 10 times", isOn: $tenLoops) // Challenge 1: does shots ever pass 4?
            Toggle("order.oatMilk = true", isOn: $oatMilk) // Challenge 2.
            Toggle("Call removeShot() before the last print", isOn: $removeOneShot) // Challenge 3.
            Button("Run") { output = CoffeeOrderProgram.run(loops: tenLoops ? 10 : 3, oatMilk: oatMilk, removeOneShot: removeOneShot) } // Runs the program.
                .buttonStyle(.borderedProminent) // The main action.
            ConsoleView(lines: output) // The course expects "$4.75" then "4 $6.85".
        }
    }
}

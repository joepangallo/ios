// Lesson_4_1_DescribeTheScreen.swift
// Who: the student who opens lesson 4.1 from the home screen.
// What: the "Describe the Screen, Not the Steps" page: the four words SwiftUI is
//       built on, the UIKit counter beside the SwiftUI counter, the update loop,
//       ProfileCardView's view tree, and WelcomeCard configured by its inputs.
// Where: pushed onto the app's NavigationStack by ContentView.
// When: built when the lesson opens; each card redraws when its own state changes.
// Why: the shift from commands ("now change that label") to descriptions ("the label
//      shows the count") is the idea every later lesson builds on.

import SwiftUI // View, Text, Button, @State and the layout types.

/// Lesson 4.1: describe the screen, not the steps.
struct DescribeTheScreenLesson: View { // One screen per lesson.
    let lesson: Lesson // Number, title and summary from the home screen.

    var body: some View { // The page: one card per course step.
        LessonPage(lesson: lesson) { // Scrolling page with the summary on top.
            WhatSwiftUIIsCard() // Concept: What SwiftUI is.
            SameCounterTwoWaysCard() // Compare: The same counter, two ways.
            DemoCard(title: "A view is a value, and body follows the data", caption: "Input: data the view reads. Recompute: after an input changes, SwiftUI runs body again. Diff: it compares the old and new descriptions and redraws only what differs. Tap and flip, then read the loop.") { // Concept with the loop figure.
                CupsLoopDemo(allowsBugMode: false) // The loop, without the bug (lesson 4.4 adds it).
            }
            ViewTreeCard() // Code: A body returns a view tree.
            ViewInputsCard() // Code: Views are configured by their inputs.
            FollowAlongCard() // Concept: Refresher: follow along in Xcode.
        }
    }
}

// MARK: - What SwiftUI is

/// The four words from the first concept step, each with a tiny live example.
private enum GlossaryTerm: String, CaseIterable, Identifiable { // Shown as a segmented picker.
    case view = "View", body = "body", modifier = "Modifier", preview = "Preview" // The step's four terms.
    var id: String { rawValue } // Identifiable for ForEach.

    /// The course's one-sentence definition.
    var definition: String { // Shown under the picker.
        switch self { // One definition per term.
        case .view: "A type that describes a piece of interface, from a single label to a whole screen." // View.
        case .body: "The property where a view returns its description." // body.
        case .modifier: "A method such as .font() or .padding() that returns an adjusted view." // Modifier.
        case .preview: "A live rendering of a view while you edit, shown in Xcode's canvas." // Preview.
        }
    }
}

/// Concept: What SwiftUI is.
private struct WhatSwiftUIIsCard: View { // One card.
    @State private var term = GlossaryTerm.view // Which word is selected.
    @State private var modified = true // For the Modifier example: apply the modifiers or not.

    var body: some View { // Redraws when term or modified changes.
        DemoCard(title: "What SwiftUI is", caption: "SwiftUI is declarative: you describe what the screen should look like for the current data, and SwiftUI works out how to draw it and how to change it.") { // The card.
            Picker("Term", selection: $term) { // One segment per word.
                ForEach(GlossaryTerm.allCases) { Text($0.rawValue).tag($0) } // The tag is the value each segment stands for.
            }
            .pickerStyle(.segmented) // Side by side.
            Text(term.definition) // The definition for the selected word.
                .font(.callout) // Readable.
            example // A tiny live example of the word.
                .frame(maxWidth: .infinity, minHeight: 70) // Same height for every term, so the card does not jump.
                .demoPanel() // A panel to frame the example.
            Text("Before SwiftUI: UIKit. From the first iPhone SDK in 2008, screens were built with view controller objects that create labels and buttons, then change them step by step. SwiftUI arrived in 2019. The two can be mixed, but new screens are built in SwiftUI.") // The history callout.
                .font(.footnote) // Smaller than the main text.
                .foregroundStyle(.secondary) // A side note.
        }
    }

    /// The example for the selected term.
    @ViewBuilder private var example: some View { // @ViewBuilder lets the switch return different views.
        switch term { // One example per word.
        case .view: // A view describes a piece of interface.
            Label("This label is a View", systemImage: "rectangle.on.rectangle") // A built-in view, created right here.
        case .body: // body returns the description.
            CodeBlock(lines: ["var body: some View {", "    Text(\"Hello\")", "}"]) // The smallest possible body.
                .padding(8) // Room around the code box.
        case .modifier: // Modifiers return adjusted views.
            VStack { // The example and its switch.
                Text("Hello") // The view being modified.
                    .font(modified ? .title.bold() : .body) // .font(...) when the switch is on.
                    .padding(modified ? 8 : 0) // .padding(...) when the switch is on.
                    .background(modified ? Color.yellow : Color.clear, in: .rect(cornerRadius: 6)) // .background(...) when on.
                Toggle("Apply .font, .padding, .background", isOn: $modified.animation()) // .animation() eases the change.
                    .font(.caption) // Small control text.
                    .padding(.horizontal) // Keep the switch off the panel's edges.
            }
        case .preview: // A preview renders a view while you edit.
            Text("In Xcode, #Preview { CounterView() } at the bottom of a file draws CounterView in the canvas. This app runs the same views for real.") // How the canvas relates to this app.
                .font(.footnote) // Small.
                .padding(8) // Room inside the panel.
        }
    }
}

// MARK: - The same counter, two ways

/// The SwiftUI counter from the course, exactly as written there.
struct CounterView: View { // `struct CounterView: View`
    @State private var count = 0 // The only copy of the count.

    var body: some View { // Runs again after every change to count.
        VStack(spacing: 12) { // Text above button, 12 points apart.
            Text("Count: \(count)") // Derived from count; no line ever copies the number into it.
            Button("Add one") { // The action is the closure.
                count += 1 // Change the data; the text follows.
            }
        }
    }
}

/// Compare: The same counter, two ways.
private struct SameCounterTwoWaysCard: View { // One card.
    @State private var uikit = ImperativeCounterSimulation() // The UIKit controller's two copies of the count.

    /// The UIKit version from the course, shown as read-along code.
    private let uikitCode = [ // One string per line, exactly as the course shows it.
        "import UIKit", // Line 1.
        "final class CounterViewController: UIViewController {", // The controller.
        "    private var count = 0", // The data.
        "    private let label = UILabel()", // A label object to change later.
        "    private let button = UIButton(type: .system)", // A button object.
        "    override func viewDidLoad() {", // Setup hook.
        "        super.viewDidLoad()", // Let UIKit do its own setup first.
        "        label.text = \"Count: 0\"", // The second copy of the number, typed by hand.
        "        button.setTitle(\"Add one\", for: .normal)", // Title for the normal state.
        "        button.addTarget(self, action: #selector(addOne),", // Target-action wiring...
        "                         for: .touchUpInside)", // ...for a completed tap.
        "        for subview in [label, button] { view.addSubview(subview) }", // Insert both views.
        "    }", // End of viewDidLoad.
        "    @objc private func addOne() {", // The action method.
        "        count += 1", // Change the data...
        "        label.text = \"Count: \\(count)\"", // ...then copy it into the label by hand.
        "    }", // End of addOne.
        "}", // End of the class.
    ] // End of the code.

    var body: some View { // Redraws when the simulation changes.
        DemoCard(title: "The same counter, two ways", caption: "Both build one screen: a label that shows a count and a button that adds one. UIKit commands objects step by step; SwiftUI describes the screen in terms of the data.") { // The card.
            Text("Before: imperative UIKit (read along)") // Left side of the compare.
                .font(.subheadline.bold()) // A small heading.
            CodeBlock(lines: uikitCode) // The UIKit code, for reading.
            Text("UIKit keeps the number twice: in count and in label.text. Simulate the controller below, then delete the label line and tap three times.") // Sets up the simulation.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
            VStack(alignment: .leading, spacing: 8) { // The simulated controller.
                Text(uikit.labelText) // What the label shows on screen.
                    .font(.title3.monospacedDigit()) // Digits keep their width.
                Toggle("Delete the label.text line from addOne()", isOn: $uikit.skipsLabelUpdate) // The quiz's mistake, made on purpose.
                    .font(.footnote) // Small control text.
                HStack { // The two buttons.
                    Button("Add one") { uikit.addOne() } // Runs the simulated addOne().
                        .buttonStyle(.bordered) // A UIKit-style system button.
                    Button("Start over") { uikit.reset() } // Back to zero.
                        .font(.footnote) // Secondary.
                }
                ValueRow(name: "count", value: "\(uikit.count)") // The data.
                ValueRow(name: "label.text", value: uikit.labelText) // The copy on screen.
                if !uikit.isInSync { // Only when the two copies disagree.
                    Text("The data says \(uikit.count), the screen still says \(uikit.labelText). UIKit does not watch your data.") // The quiz's answer, made visible.
                        .font(.footnote) // Small.
                        .foregroundStyle(.red) // A warning.
                }
            }
            .padding(10) // Room inside the simulation panel.
            .demoPanel() // A panel.
            Divider() // Separates before from after.
            Text("After: declarative SwiftUI (live)") // Right side of the compare.
                .font(.subheadline.bold()) // A small heading.
            CounterView() // The course's CounterView, running for real.
                .frame(maxWidth: .infinity) // Centered.
                .padding(.vertical, 8) // Some air.
                .demoPanel() // A panel.
            Text("SwiftUI keeps one source of truth and describes the text in terms of it, so the screen cannot fall out of sync. That shift, from commands to descriptions, is what declarative means.") // The verdict.
                .font(.footnote) // Small.
        }
    }
}

// MARK: - A body returns a view tree

/// The course's ProfileCardView. The inputs all have defaults, so `ProfileCardView()`
/// still draws exactly the course's card; the card below changes them for the challenges.
struct ProfileCardView: View { // `struct ProfileCardView: View`
    var name = "Ada Lovelace" // Challenge 1: change the name.
    var largeTitle = false // Challenge 1: .title2 becomes .largeTitle.
    var includesCity = false // Challenge 2: add Text("London").
    var horizontal = false // Challenge 3: VStack becomes HStack.

    var body: some View { // The root of this view's tree.
        let layout = horizontal ? AnyLayout(HStackLayout(spacing: 8)) : AnyLayout(VStackLayout(spacing: 8)) // AnyLayout swaps VStack and HStack without rebuilding the children.
        layout { // VStack(spacing: 8) { ... } in the course.
            Image(systemName: "person.circle") // First child: an SF Symbol.
                .font(.system(size: 64)) // Symbols size like text.
                .foregroundStyle(.tint) // The app's accent color.
            Text(name) // Second child: the name.
                .font(largeTitle ? .largeTitle : .title2) // .title2 in the course.
                .bold() // Heavier weight.
            Text("Mathematician and writer") // Third child: the description.
                .foregroundStyle(.secondary) // Softer gray.
            if includesCity { // Only with the challenge switched on.
                Text("London") // A fourth child.
            }
        }
        .padding() // The padding view becomes the root of the tree.
    }
}

/// Code: A body returns a view tree.
private struct ViewTreeCard: View { // One card.
    @State private var name = "Ada Lovelace" // Challenge 1.
    @State private var largeTitle = false // Challenge 1.
    @State private var includesCity = false // Challenge 2.
    @State private var horizontal = false // Challenge 3.

    var body: some View { // Redraws when any challenge changes.
        DemoCard(title: "A body returns a view tree", caption: "A VStack holds an Image and two Text views, and padding wraps the whole stack. The indentation of the outline mirrors the shape of the tree.") { // The card.
            ProfileCardView(name: name, largeTitle: largeTitle, includesCity: includesCity, horizontal: horizontal) // The live card.
                .frame(maxWidth: .infinity) // Centered.
                .demoPanel() // A panel.
            TextField("Name", text: $name) // Challenge 1: your own name.
                .textFieldStyle(.roundedBorder) // A visible field.
            Toggle(".title2 becomes .largeTitle", isOn: $largeTitle) // Challenge 1.
            Toggle("Add a fourth child: Text(\"London\")", isOn: $includesCity) // Challenge 2.
            Toggle("Change VStack to HStack", isOn: $horizontal.animation()) // Challenge 3, animated.
            Text("The view tree") // Heading for the outline.
                .font(.subheadline.bold()) // Small heading.
            CodeBlock(lines: ViewTreeOutline.lines(name: name, horizontal: horizontal, includesCity: includesCity)) // The tree as indented text.
        }
    }
}

// MARK: - Views are configured by their inputs

/// The two colors from the course's challenge. An enum, not a Color, so comparing
/// two cards' inputs is a simple value comparison.
enum CardTint: String, CaseIterable, Identifiable { // Shown as a segmented picker.
    case mint = "Mint", yellow = "Yellow" // `.background(.mint)`, or the challenge's `.yellow`.
    var id: String { rawValue } // Identifiable for ForEach.
    var color: Color { self == .mint ? .mint : .yellow } // The SwiftUI color.
}

/// The course's WelcomeCard: draws itself from its inputs and never edits itself.
struct WelcomeCard: View { // `struct WelcomeCard: View`
    let name: String // Input: the person to greet.
    let streak: Int // Input: days in a row.
    var tint: CardTint = .mint // Stands in for editing `.background(.mint)` inside WelcomeCard.
    var runs: BodyRunCounter? = nil // Optional: counts this card's body runs for the demo.

    /// The card's text, for example "Ada: 3-day streak".
    static func message(name: String, streak: Int) -> String { // Pure, so the tests can check it.
        "\(name): \(streak)-day streak" // `Text("\(name): \(streak)-day streak")`
    }

    var body: some View { // Runs when the card appears and when its inputs change.
        let run = runs?.tick(name) // Records this run, if a counter was given.
        VStack(spacing: 2) { // The course's text, plus a small run counter.
            Text(Self.message(name: name, streak: streak)) // Both inputs in one line.
            if let run { // Only when counting.
                Text("body runs: \(run)") // How many times this card's body has run.
                    .font(.caption2.monospacedDigit()) // Tiny.
                    .opacity(0.75) // A little quieter, but readable on mint and yellow.
            }
        }
        .padding() // Space inside the colored area.
        .background(tint.color) // The background wraps the padding, so it fills the padded card.
    }
}

/// The course's HomeView: two WelcomeCards with different inputs.
struct HomeView: View { // `struct HomeView: View`
    var adaStreak = 3 // Ada's input; the stepper below changes it.
    var graceStreak = 12 // Grace's input.
    var tint: CardTint = .mint // The shared color challenge.
    var includesThirdCard = false // Challenge 1: a third card.
    var runs: BodyRunCounter? = nil // Optional run counter for the demo.

    var body: some View { // Creates fresh card values every time it runs.
        VStack(spacing: 24) { // Cards 24 points apart.
            WelcomeCard(name: "Ada", streak: adaStreak, tint: tint, runs: runs) // `WelcomeCard(name: "Ada", streak: 3)`
            WelcomeCard(name: "Grace", streak: graceStreak, tint: tint, runs: runs) // `WelcomeCard(name: "Grace", streak: 12)`
            if includesThirdCard { // Only with the challenge on.
                WelcomeCard(name: "You", streak: 1, tint: tint, runs: runs) // A third card from the same description.
            }
        }
    }
}

/// Code: Views are configured by their inputs.
private struct ViewInputsCard: View { // One card.
    @State private var adaStreak = 3 // Starts like the course.
    @State private var graceStreak = 12 // Starts like the course.
    @State private var tint = CardTint.mint // Starts mint.
    @State private var includesThirdCard = false // Starts with two cards.
    @State private var runs = BodyRunCounter() // Kept in @State so the counts survive redraws.

    var body: some View { // Redraws when an input changes.
        DemoCard(title: "Views are configured by their inputs", caption: "HomeView creates two WelcomeCard values with different inputs. Change Ada's streak: HomeView's body creates fresh card values, and SwiftUI re-runs the body of only the card whose inputs changed.") { // The card.
            HomeView(adaStreak: adaStreak, graceStreak: graceStreak, tint: tint, includesThirdCard: includesThirdCard, runs: runs) // The live parent and its cards.
                .frame(maxWidth: .infinity) // Centered.
            Stepper("Ada's streak: \(adaStreak)", value: $adaStreak, in: 0...365) // The quiz: streak 3 becomes 4.
            Stepper("Grace's streak: \(graceStreak)", value: $graceStreak, in: 0...365, step: 22) // Challenge 2: try reaching 100.
            Picker("Card color", selection: $tint) { // Challenge 3: .mint becomes .yellow.
                ForEach(CardTint.allCases) { Text($0.rawValue).tag($0) } // One segment per color.
            }
            .pickerStyle(.segmented) // Side by side.
            Toggle("Add a third WelcomeCard", isOn: $includesThirdCard) // Challenge 1.
            Text("Every card shares one description, so the color change reaches all of them. A streak change reaches only its own card.") // What to notice.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - Refresher: follow along in Xcode

/// Concept: Refresher: follow along in Xcode.
private struct FollowAlongCard: View { // One card, read rather than tapped.
    var body: some View { // Static content.
        DemoCard(title: "Refresher: follow along in Xcode", caption: "Make one practice project (iOS > App, SwiftUI, Swift) and give each example its own file instead of piling everything into ContentView. This app is built the same way: one file per lesson.") { // The card.
            Label("New view file: File > New > File from Template (Command-N), pick SwiftUI View, and name it after the example, such as CounterView.", systemImage: "doc.badge.plus") // Step 1.
            Label("See it: show the canvas with Command-Option-Return. If the preview pauses, press Command-Option-P.", systemImage: "eye") // Step 2.
            Label("Run it: replace ContentView() in the App struct with the example's view, then press Command-R.", systemImage: "play.fill") // Step 3.
            Text("Each file keeps its own #Preview, so the canvas shows whichever example is open.") // The tip callout.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
        .font(.callout) // All three labels read at callout size.
    }
}

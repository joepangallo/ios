// Lesson_3_3_Enums.swift
// Who: a student who opens lesson 3.3 from the home screen.
// What: one card per course step of "Enums: Modeling Choices and State": the key
//       terms, coffee sizes with an exhaustive switch, raw values and a picker
//       driven by CaseIterable, payments with associated values, the three-Bools
//       versus one-enum figure, and a real song screen driven by a LoadState enum.
// Where: pushed by ContentView when the 3.3 row is tapped (or launched with -lesson 3.3).
// When: built when the screen appears and rebuilt whenever a control changes state.
// Why: an enum lists every possibility, so the compiler can check that each one
//      is handled. Driving real screens from enums shows why that matters.

import SwiftUI // SwiftUI provides View, @State, Picker, ProgressView and the rest.

struct EnumsLesson: View { // The screen for lesson 3.3.
    let lesson: Lesson // The catalog entry: number, title and summary.

    var body: some View { // The page: summary first, then one card per course step.
        CardPage(lesson: lesson) { // CourseKit's scrolling page layout, plus the -card launch argument.
            FixedPossibilitiesCard() // Concept: a fixed set of possibilities.
            CoffeeSizeCard() // Code: cases and an exhaustive switch.
            RawValuesCard() // Code: raw values and CaseIterable.
            PaymentCard() // Code: associated values.
            BoolsOrEnumCard() // Concept: model screen state with one enum.
            SongScreenCard() // Code: screen state as an enum.
        }
    }
}

/// Concept step "A fixed set of possibilities".
private struct FixedPossibilitiesCard: View { // The terms and the callout.
    var body: some View { // Static content.
        DemoCard(title: "A fixed set of possibilities", // Named after the course step.
                 caption: "An enum defines a type with a fixed list of cases. A coffee size is small, medium or large, never \"medium-ish\" and never a typo like \"lrage\".") { // The key idea.
            TermList(terms: [ // The four terms from the course page.
                ("Case", "One of the named possibilities, written with a leading dot when the type is known: .medium."), // Term 1.
                ("Exhaustive", "A switch that covers every case. Swift requires it, so no possibility is forgotten."), // Term 2.
                ("Raw value", "A fixed Int or String tied to each case, useful for saving and loading."), // Term 3.
                ("Associated value", "Data stored with one specific value, such as the last four digits of a card."), // Term 4.
            ])
            CalloutBox(title: "Enums are values", // The course's tip.
                       text: "Like structs, enums are value types: assigning one copies it. They are cheap, safe to share between tasks, and perfect for describing state.") // Its message.
        }
    }
}

/// Code step "Cases and an exhaustive switch".
private struct CoffeeSizeCard: View { // Pick a size and see the switch's answer.
    @State private var size = CasesAndExhaustiveSwitch.CoffeeSize.medium // Starts where the course program starts.
    private let sizes: [CasesAndExhaustiveSwitch.CoffeeSize] = [.small, .medium, .large] // CoffeeSize is not CaseIterable, so the list is written out.

    var body: some View { // Rebuilt when size changes.
        DemoCard(title: "Cases and an exhaustive switch", // Named after the course step.
                 caption: "The switch in ounces(for:) has no default. The compiler can see every case is handled, and complains if a case is ever added.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: CasesAndExhaustiveSwitch.run().lines) // medium 12, large 16.
            Divider() // Separates the program from the live picker.
            Picker("Size", selection: $size) { // Chooses the case.
                ForEach(sizes, id: \.self) { option in // One segment per case.
                    Text(verbatim: "\(option)").tag(option) // Printing a case shows its name.
                }
            }
            .pickerStyle(.segmented) // Three side-by-side buttons.
            CodeText("print(size, ounces(for: size))\n// \(size) \(CasesAndExhaustiveSwitch.ounces(for: size))") // The live result.
            Text("Try it from the course: add case extraLarge to the enum.") // The try item.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A note.
            CompilerNote(code: "// in ounces(for:), after adding case extraLarge:\nswitch size {", // Where the compiler points.
                         message: "switch must be exhaustive") // Exact Xcode message.
        }
    }
}

/// Code step "Raw values and CaseIterable".
private struct RawValuesCard: View { // A picker built from allCases, and rebuilding a case from a number.
    @State private var priority = RawValuesAndCaseIterable.Priority.medium // The picker's choice.
    @State private var saved = 2 // The pretend number loaded from storage.

    var body: some View { // Rebuilt when priority or saved changes.
        DemoCard(title: "Raw values and CaseIterable", // Named after the course step.
                 caption: "Int raw values count up; String raw values default to the case name. CaseIterable adds allCases, perfect for a picker.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: RawValuesAndCaseIterable.run().lines) // The five lines.
            Divider() // Separates the program from the live controls.
            Picker("Priority", selection: $priority) { // A picker whose choices come from allCases.
                ForEach(RawValuesAndCaseIterable.Priority.allCases, id: \.self) { option in // Every case, in declaration order.
                    Text(verbatim: "\(option)").tag(option) // The case name as the segment title.
                }
            }
            .pickerStyle(.segmented) // Side-by-side buttons.
            CodeText("priority.rawValue  // \(priority.rawValue)") // 1, 2 or 3.
            CodeText("Priority.allCases.count  // \(RawValuesAndCaseIterable.Priority.allCases.count)") // 3: add a case and the picker grows.
            Stepper(value: $saved, in: 0...8) { // Chooses the number to rebuild a case from.
                CodeText("Priority(rawValue: \(saved))") // The failable initializer call.
            }
            Text(verbatim: RawValuesAndCaseIterable.load(saved: saved)) // Loaded medium, or the warning for numbers with no case.
                .font(.system(.body, design: .monospaced)) // Looks like console output.
            Text("String raw values:") // Introduces the Category list.
                .font(.subheadline.bold()) // A small heading.
            CodeText("Category.work.rawValue  // \(RawValuesAndCaseIterable.Category.work.rawValue)") // The default: the case name.
            CodeText("Category.home.rawValue  // \(RawValuesAndCaseIterable.Category.home.rawValue)") // The default again.
            CodeText("Category.errands.rawValue\n// \(RawValuesAndCaseIterable.Category.errands.rawValue)") // The custom raw value.
        }
    }
}

/// The three kinds of payment, for the payment picker.
private enum PaymentKind: String, CaseIterable { // A small enum just for this screen's picker.
    case cash = "Cash" // Pays with cash.
    case card = "Card" // Pays with a card.
    case giftCard = "Gift card" // Pays with a gift card.
}

/// Code step "Associated values".
private struct PaymentCard: View { // Build a payment and see which branch of the switch matches.
    @State private var kind = PaymentKind.card // Which case to build.
    @State private var last4 = "4242" // Data for the card case.
    @State private var balance = 2.5 // Data for the gift card case.

    private var payment: AssociatedValues.Payment { // The value the controls describe.
        switch kind { // Each kind builds its case with its own data.
        case .cash: .cash // No associated value.
        case .card: .card(last4: last4) // Carries the digits.
        case .giftCard: .giftCard(balance: balance) // Carries the balance.
        }
    }

    var body: some View { // Rebuilt whenever a control changes.
        DemoCard(title: "Associated values", // Named after the course step.
                 caption: "A card needs its last four digits, a gift card its balance, cash nothing. A switch pulls the data back out with let, and where adds a condition.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: AssociatedValues.run().lines) // Four payment lines.
            Divider() // Separates the program from the live builder.
            Picker("Payment", selection: $kind) { // Chooses the case.
                ForEach(PaymentKind.allCases, id: \.self) { Text($0.rawValue).tag($0) } // One segment per kind.
            }
            .pickerStyle(.segmented) // Side-by-side buttons.
            if kind == .card { // Only the card case carries digits.
                TextField("Last four digits", text: $last4) // The associated String.
                    .textFieldStyle(.roundedBorder) // The familiar bordered field.
                    .keyboardType(.numberPad) // Digits only on the keyboard.
                    .onChange(of: last4) { _, newValue in last4 = String(newValue.filter(\.isNumber).prefix(4)) } // Keeps at most four digits.
            }
            if kind == .giftCard { // Only the gift card case carries a balance.
                Stepper(value: $balance, in: 0...50, step: 2.5) { // The associated Double.
                    Text(verbatim: "balance: \(balance)") // The value the case will carry.
                }
            }
            LabeledContent { // The branch that matched.
                CodeText(AssociatedValues.matchedBranch(for: payment)) // Changes as you cross the 5 dollar line.
            } label: { Text("Matched") } // What the value means.
            CodeText("describe(payment)\n// \(AssociatedValues.describe(payment))") // The course function's answer.
        }
    }
}

/// Concept step "Model screen state with one enum": three Bools versus one enum.
private struct BoolsOrEnumCard: View { // Flip flags or pick a case and see what the screen would draw.
    @State private var useEnum = false // false: three Bools; true: one enum.
    @State private var flags = ThreeBoolsOrOneEnum.Flags() // The three switches.
    @State private var state = "idle" // The enum's case, by name.
    private let states = ["idle", "loading", "loaded", "failed"] // The four valid states.

    var body: some View { // Rebuilt whenever a control changes.
        DemoCard(title: "Model screen state with one enum", // Named after the course step.
                 caption: "Three Bools allow 8 combinations, but only 4 make sense. One enum with four cases allows exactly the four valid states.") { // The key idea.
            Picker("Model", selection: $useEnum) { // Chooses which model to try.
                Text("Three Bools").tag(false) // The first attempt.
                Text("One enum").tag(true) // The better model.
            }
            .pickerStyle(.segmented) // Two side-by-side buttons.
            if useEnum { // The enum model.
                Picker("State", selection: $state) { // Only the four valid states can be chosen.
                    ForEach(states, id: \.self) { Text(verbatim: "." + $0).tag($0) } // .idle, .loading, .loaded, .failed
                }
                .pickerStyle(.segmented) // Side-by-side buttons.
                MockScreen(parts: partsForEnum) // Draws exactly one thing.
                Text("Every value you can write is a state the screen knows how to draw.") // What to notice.
                    .font(.caption) // Small print.
                    .foregroundStyle(.secondary) // A note.
            } else { // The Bools model.
                Toggle(isOn: $flags.isLoading) { CodeText("isLoading") } // Spinner flag.
                Toggle(isOn: $flags.hasError) { CodeText("hasError") } // Error flag.
                Toggle(isOn: $flags.hasData) { CodeText("hasData") } // Song list flag.
                MockScreen(parts: flags.drawnParts) // Draws every part whose flag is on, all at once.
                if let name = flags.matchingState { // A meaningful combination.
                    Label("This combination means .\(name)", systemImage: "checkmark.circle") // One of the four.
                        .foregroundStyle(.green) // Good news.
                } else { // A contradictory combination.
                    Label("Impossible state: no real screen looks like this", systemImage: "exclamationmark.triangle") // A bug waiting to happen.
                        .foregroundStyle(.orange) // A warning.
                }
                Text("Valid combinations: \(ThreeBoolsOrOneEnum.validCombinations.count) of \(ThreeBoolsOrOneEnum.allCombinations.count)") // 4 of 8.
                    .font(.caption) // Small print.
                    .foregroundStyle(.secondary) // A note.
            }
        }
    }

    /// What the enum model draws for the chosen case: always exactly one part, or none for idle.
    private var partsForEnum: [String] { // Mirrors a switch over the four cases.
        switch state { // One answer per case.
        case "loading": ["spinner"] // Only the spinner.
        case "loaded": ["song list"] // Only the list.
        case "failed": ["error"] // Only the error.
        default: [] // idle draws nothing yet.
        }
    }
}

/// A tiny pretend phone screen that draws the parts it is given.
private struct MockScreen: View { // Used by both models of the figure.
    let parts: [String] // "spinner", "error" and "song list", in any combination.

    var body: some View { // Rebuilt when parts changes.
        VStack(spacing: 8) { // The parts stacked, as a careless screen would draw them.
            if parts.isEmpty { // idle: nothing requested yet.
                Text("Pull to refresh") // The idle message.
                    .foregroundStyle(.secondary) // Quiet.
            }
            if parts.contains("spinner") { ProgressView() } // The loading indicator.
            if parts.contains("error") { // The error message.
                Label("Could not load songs", systemImage: "wifi.slash") // A failure line.
                    .foregroundStyle(.red) // Errors are red.
            }
            if parts.contains("song list") { // The data.
                Text("Golden Hour\nNight Owl") // Two song titles.
                    .multilineTextAlignment(.center) // Centered like a short list.
            }
        }
        .font(.footnote) // Small, like a phone thumbnail.
        .frame(maxWidth: .infinity, minHeight: 90) // A fixed-height screen area.
        .background(.background, in: .rect(cornerRadius: 12)) // A screen-like panel.
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(.secondary.opacity(0.4))) // A thin bezel.
    }
}

/// Code step "Screen state as an enum": a real screen that switches over LoadState.
private struct SongScreenCard: View { // Load songs and watch the screen move through its states.
    @State private var model = SongScreenModel() // The model whose state is one LoadState.

    var body: some View { // Rebuilt whenever model.state changes.
        DemoCard(title: "Screen state as an enum", // Named after the course step.
                 caption: "The view switches over the state and draws one thing for each case. message turns each state into text.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: ScreenStateAsEnum.run().lines) // The four messages.
            Divider() // Separates the program from the live screen.
            Group { // The screen: one branch per case, exactly like the course describes.
                switch model.state { // Exhaustive: every state has a drawing.
                case .idle: // Before any request.
                    Text(model.state.message) // Pull to refresh.
                        .foregroundStyle(.secondary) // Quiet.
                case .loading: // A request is in flight.
                    ProgressView(model.state.message) // A spinner with Loading...
                case .loaded(let songs): // Success: the songs travel with the case.
                    VStack(alignment: .leading, spacing: 4) { // A small list.
                        Text(model.state.message).font(.caption).foregroundStyle(.secondary) // 2 songs
                        ForEach(songs, id: \.self) { Label($0, systemImage: "music.note") } // One row per song.
                    }
                case .failed(let reason): // Failure: the reason travels with the case.
                    Label(reason, systemImage: "wifi.slash") // The reason, Offline.
                        .foregroundStyle(.red) // Errors are red.
                }
            }
            .frame(maxWidth: .infinity, minHeight: 90) // A fixed-height screen area.
            .background(.background, in: .rect(cornerRadius: 12)) // A screen-like panel.
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(.secondary.opacity(0.4))) // A thin bezel, like the figure's screens.
            Toggle("Simulate offline", isOn: $model.simulateOffline) // Makes the next load fail.
            HStack { // The two actions.
                Button("Load songs") { // Starts a load.
                    Task { await model.load() } // A Task bridges the button into async code.
                }
                .buttonStyle(.borderedProminent) // The main action.
                .disabled(model.state == .loading) // One load at a time.
                Spacer() // Pushes reset to the right.
                Button("Reset") { model.reset() } // Back to idle.
            }
            CodeText("state.message  // \(model.state.message)") // The computed property, live.
        }
    }
}

#Preview { // Shows this screen in Xcode's canvas.
    NavigationStack { EnumsLesson(lesson: ContentView.lessons[2]) } // Inside a stack so the title appears.
}

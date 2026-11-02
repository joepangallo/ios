// Lesson_3_5_Generics.swift
// Who: a student who opens lesson 3.5 from the home screen.
// What: one card per course step of "Generics: Write It Once, Keep the Types":
//       the key terms with the generic names of everyday types, recent<Item>
//       run on Strings and Ints, a Stack<Element> you push and pop on screen,
//       constrained functions, and Maybe<Wrapped> next to the real Optional.
// Where: pushed by ContentView when the 3.5 row is tapped (or launched with -lesson 3.5).
// When: built when the screen appears and rebuilt whenever a control changes state.
// Why: generics are easiest to trust when the same code visibly works for
//      different types while every result keeps its real type.

import SwiftUI // SwiftUI provides View, @State and the controls used below.

struct GenericsLesson: View { // The screen for lesson 3.5.
    let lesson: Lesson // The catalog entry: number, title and summary.

    var body: some View { // The page: summary first, then one card per course step.
        CardPage(lesson: lesson) { // CourseKit's scrolling page layout, plus the -card launch argument.
            WhyGenericsCard() // Concept: why generics.
            RecentCard() // Code: a generic function.
            StackCard() // Code: a generic type, Stack.
            ConstraintsCard() // Code: constraints and where clauses.
            MaybeCard() // Code: Optional is a generic enum.
        }
    }
}

/// Concept step "Why generics".
private struct WhyGenericsCard: View { // The terms, plus the real generic names of familiar types.
    var body: some View { // Static content computed from real values.
        DemoCard(title: "Why generics", // Named after the course step.
                 caption: "A generic function or type has a type parameter, a placeholder in angle brackets such as <Item>, that the compiler fills in with a real type at each use.") { // The key idea.
            TermList(terms: [ // The three terms from the course page.
                ("Type parameter", "A placeholder type name, such as Item or Element, used inside the generic code."), // Term 1.
                ("Constraint", "A rule such as T: Comparable that limits which types may fill the placeholder."), // Term 2.
                ("Inference", "Swift usually works out the real type from the arguments, so you rarely write it."), // Term 3.
            ])
            Text("You already use generics. Swift reports these real types:") // The course's callout, made live.
                .font(.subheadline.bold()) // A small heading.
            CodeText("type(of: [\"pho\"])\n// \(type(of: ["pho"]))") // Array<String>: [String] is shorthand.
            CodeText("type(of: [\"Ana\": 3])\n// \(type(of: ["Ana": 3]))") // Dictionary<String, Int>.
            CodeText("type(of: Int(\"5\"))\n// \(type(of: Int("5")))") // Optional<Int>: Int? is shorthand.
            CodeText("type(of: Result<Int, any Error>.success(1))\n// \(type(of: Result<Int, any Error>.success(1)))") // Result<Int, Error>.
        }
    }
}

/// Code step "A generic function": one function, two element types.
private struct RecentCard: View { // Change the limit and read both results.
    @State private var limit = 2 // How many recent items to keep.

    var body: some View { // Rebuilt whenever limit changes.
        let words = AGenericFunction.recent(AGenericFunction.searches, limit: limit) // Item is String here.
        let ids = AGenericFunction.recent(AGenericFunction.songIDs, limit: limit) // Item is Int here.
        return DemoCard(title: "A generic function", // Named after the course step.
                        caption: "recent<Item> serves a search history of Strings and a play history of Int song IDs. Swift infers Item from the argument, and the return type follows.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: AGenericFunction.run().lines) // The two course calls.
            Divider() // Separates the program from the live calls.
            Stepper(value: $limit, in: 0...6) { CodeText("limit: \(limit)") } // The second argument.
            CodeText("recent(searches, limit: \(limit))\n// \(words)  is \(type(of: words))") // Strings in, Strings out.
            CodeText("recent(songIDs, limit: \(limit))\n// \(ids)  is \(type(of: ids))") // Ints in, Ints out.
            CodeText("recent(searches, limit: 1).first?.uppercased()\n// \(AGenericFunction.recent(AGenericFunction.searches, limit: 1).first?.uppercased() ?? "nil")") // The course's try item: String methods are available, no casting.
        }
    }
}

/// Code step "A generic type: Stack": push and pop on screen.
private struct StackCard: View { // A Stack<String> of screens and a Stack<Int> of edits.
    @State private var screens = Stack<String>() // Element is String.
    @State private var nextScreen = "Inbox" // The value the next push will add.
    @State private var edits = Stack<Int>() // Element is Int: a different type.
    @State private var lastPopped = "nothing yet" // What the most recent pop returned.

    var body: some View { // Rebuilt whenever a stack changes.
        DemoCard(title: "A generic type: Stack", // Named after the course step.
                 caption: "A stack is last in, first out, like screens in a navigation stack. Stack<String> and Stack<Int> are two different, fully type-checked types made from one definition.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: AGenericTypeStack.run().lines) // Attachment, Message, true true.
            Divider() // Separates the program from the live stack.
            HStack { // A field and two buttons.
                TextField("Screen", text: $nextScreen) // The String to push.
                    .textFieldStyle(.roundedBorder) // The familiar bordered field.
                Button("push") { screens.push(nextScreen) } // Adds on top.
                    .disabled(nextScreen.isEmpty) // Nothing to push.
                Button("pop") { lastPopped = screens.pop() ?? "nil" } // Removes the top, or reports nil.
            }
            .buttonStyle(.bordered) // Visible button shapes.
            StackDrawing(labels: screens.bottomToTop) // The stack, top drawn first.
            CodeText("screens.top  // \(screens.top ?? "nil")\nscreens.isEmpty  // \(screens.isEmpty)\nscreens.count  // \(screens.count)\nlast pop returned  // \(lastPopped)") // The stack's properties, live.
            Text("Stack<Int>") // The second specialization.
                .font(.subheadline.bold()) // A small heading.
            HStack { // Int buttons.
                Button("edits.push(\(edits.count + 1))") { edits.push(edits.count + 1) } // Pushes the next number.
                Button("edits.pop()") { lastPopped = edits.pop().map { "\($0)" } ?? "nil" } // nil when empty, never a crash.
            }
            .font(.system(.footnote, design: .monospaced)) // Code-looking titles.
            .buttonStyle(.bordered) // Visible button shapes.
            StackDrawing(labels: edits.bottomToTop.map { "\($0)" }) // The Int stack.
            CompilerNote(code: "screens.push(42)", // The course's try item.
                         message: "cannot convert value of type 'Int' to expected argument type 'String'") // Element is fixed to String.
        }
    }
}

/// Draws a stack of labels with the top element first.
private struct StackDrawing: View { // Used for both stacks.
    let labels: [String] // Bottom to top.

    var body: some View { // Rebuilt when labels change.
        VStack(spacing: 4) { // One block per element.
            if labels.isEmpty { // Nothing stacked.
                Text("empty") // Says so.
                    .foregroundStyle(.secondary) // Quiet.
            }
            ForEach(Array(labels.enumerated().reversed()), id: \.offset) { position, label in // Reversed, so the top is drawn first.
                Text(verbatim: position == labels.count - 1 ? "\(label)   <- top" : label) // Marks the top element.
                    .font(.system(.footnote, design: .monospaced)) // Code-looking text.
                    .frame(maxWidth: .infinity) // Full-width blocks.
                    .padding(6) // Room inside each block.
                    .background(Color.accentColor.opacity(position == labels.count - 1 ? 0.3 : 0.12), in: .rect(cornerRadius: 6)) // The top block is darker.
            }
        }
    }
}

/// The three arrays the constraints card can search.
private enum Dataset: String, CaseIterable { // Drives a segmented picker.
    case temperatures = "Doubles" // [72.5, 88.0, 64.25]
    case fruit = "Strings" // ["kiwi", "apple", "mango"]
    case empty = "Empty" // [] of Int
}

/// Code step "Constraints and where clauses".
private struct ConstraintsCard: View { // largest on several element types, countMatches with a target.
    @State private var dataset = Dataset.temperatures // Which array largest searches.
    @State private var target = 5 // What countMatches looks for.

    private var largestLine: String { // The call and its result for the chosen array.
        switch dataset { // T is inferred differently for each array.
        case .temperatures: "largest(\(ConstraintsAndWhereClauses.temperatures))\n// \(ConstraintsAndWhereClauses.largest(ConstraintsAndWhereClauses.temperatures).map { "\($0)" } ?? "nil")" // T is Double.
        case .fruit: "largest(\(ConstraintsAndWhereClauses.fruit))\n// \(ConstraintsAndWhereClauses.largest(ConstraintsAndWhereClauses.fruit) ?? "nil")" // T is String.
        case .empty: "largest([Int]())\n// \(ConstraintsAndWhereClauses.largest([Int]()).map { "\($0)" } ?? "nil")" // An empty array returns nil.
        }
    }

    var body: some View { // Rebuilt whenever a control changes.
        DemoCard(title: "Constraints and where clauses", // Named after the course step.
                 caption: "largest needs >, which only Comparable types have, so it says T: Comparable. countMatches needs ==, written as where T: Equatable.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: ConstraintsAndWhereClauses.run().lines) // 88.0, mango, 3.
            Divider() // Separates the program from the live calls.
            Picker("Array", selection: $dataset) { // Chooses what largest searches.
                ForEach(Dataset.allCases, id: \.self) { Text($0.rawValue).tag($0) } // One segment per array.
            }
            .pickerStyle(.segmented) // Side-by-side buttons.
            CodeText(largestLine) // The call and its answer.
            Stepper(value: $target, in: 1...5) { CodeText("target: \(target)") } // What to count.
            CodeText("countMatches(of: \(target), in: \(ConstraintsAndWhereClauses.ratings))\n// \(ConstraintsAndWhereClauses.countMatches(of: target, in: ConstraintsAndWhereClauses.ratings))") // How many ratings equal target.
            CompilerNote(code: "largest([true, false])", // The course's try item.
                         message: "global function 'largest' requires that 'Bool' conform to 'Comparable'") // Bool has no ordering. The course declares largest as a global function, hence the wording.
        }
    }
}

/// Code step "Optional is a generic enum".
private struct MaybeCard: View { // Maybe<String> next to the real String?.
    @State private var hasNickname = false // Whether the nickname holds a value.
    @State private var nicknameText = "Sam" // The value when it does.

    var body: some View { // Rebuilt whenever a control changes.
        let nickname: OptionalIsAGenericEnum.Maybe<String> = hasNickname ? .some(nicknameText) : .none // The rebuilt Optional.
        let realNickname: Optional<String> = hasNickname ? nicknameText : nil // The real one, written with its generic name.
        return DemoCard(title: "Optional is a generic enum", // Named after the course step.
                        caption: "Swift's Optional is a generic enum with two cases, none and some(Wrapped). Maybe rebuilds it; its or method is ?? written as a method.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: OptionalIsAGenericEnum.run().lines) // Guest 5, Guest [5, 4].
            Divider() // Separates the program from the live values.
            Toggle("nickname has a value", isOn: $hasNickname) // Switches between .none and .some.
            if hasNickname { // Only a present value needs text.
                TextField("Nickname", text: $nicknameText) // The wrapped String.
                    .textFieldStyle(.roundedBorder) // The familiar bordered field.
            }
            CodeText("let nickname: Maybe<String> = \(hasNickname ? ".some(\"\(nicknameText)\")" : ".none")\nnickname.or(\"Guest\")  // \(nickname.or("Guest"))") // The rebuilt optional.
            CodeText("let realNickname: Optional<String> = \(hasNickname ? "\"\(nicknameText)\"" : "nil")\nrealNickname ?? \"Guest\"  // \(realNickname ?? "Guest")") // The real optional behaves the same.
        }
    }
}

#Preview { // Shows this screen in Xcode's canvas.
    NavigationStack { GenericsLesson(lesson: ContentView.lessons[4]) } // Inside a stack so the title appears.
}

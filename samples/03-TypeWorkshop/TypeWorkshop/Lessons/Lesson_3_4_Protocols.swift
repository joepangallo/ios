// Lesson_3_4_Protocols.swift
// Who: a student who opens lesson 3.4 from the home screen.
// What: one card per course step of "Protocols and Protocol-Oriented Design":
//       the key terms, a Priced cart that mixes coffees and pastries, Shareable
//       with a default implementation, the everyday standard protocols, live
//       Equatable/Hashable/Comparable checks, a JSON editor for a Codable song,
//       and some versus any with shapes.
// Where: pushed by ContentView when the 3.4 row is tapped (or launched with -lesson 3.4).
// When: built when the screen appears and rebuilt whenever a control changes state.
// Why: protocols are how Swift, SwiftUI and Codable fit together. Changing the
//      data and watching the protocol-powered features react shows what each
//      conformance buys you.

import SwiftUI // SwiftUI provides View, @State, TextEditor and the rest.

struct ProtocolsLesson: View { // The screen for lesson 3.4.
    let lesson: Lesson // The catalog entry: number, title and summary.

    var body: some View { // The page: summary first, then one card per course step.
        CardPage(lesson: lesson) { // CourseKit's scrolling page layout, plus the -card launch argument.
            ContractsCard() // Concept: protocols are contracts.
            PricedCartCard() // Code: defining and adopting a protocol.
            ShareableCard() // Code: default behavior with protocol extensions.
            StandardProtocolsCard() // Concept: standard protocols you will use every day.
            HashableComparableCard() // Code: Equatable, Hashable and Comparable.
            CodableCard() // Code: Identifiable and Codable.
            SomeAnyCard() // Compare: some versus any.
        }
    }
}

/// Concept step "Protocols are contracts".
private struct ContractsCard: View { // The terms and the callout.
    var body: some View { // Static content.
        DemoCard(title: "Protocols are contracts", // Named after the course step.
                 caption: "A protocol lists requirements. A type conforms by declaring it and meeting every requirement, and the compiler checks the promise.") { // The key idea.
            TermList(terms: [ // The four terms from the course page.
                ("Requirement", "A property or method signature the protocol demands, with no body."), // Term 1.
                ("Conformance", "A type's promise, written after a colon, to meet every requirement."), // Term 2.
                ("any Protocol", "A box that can hold a value of any conforming type, such as [any Priced]."), // Term 3.
                ("Protocol extension", "Shared code, including default implementations, for every conforming type."), // Term 4.
            ])
            CalloutBox(title: "Protocols everywhere", // The course's ecosystem callout.
                       text: "SwiftUI (View, App), JSON (Codable), lists (Identifiable) and Swift Testing all rest on protocols. Learning to read a protocol's requirements is learning to read Apple's documentation.") // Its message.
        }
    }
}

/// Code step "Defining and adopting a protocol": a cart of any Priced items.
private struct PricedCartCard: View { // Add coffees and pastries to one array.
    @State private var cart: [any DefiningAndAdoptingAProtocol.Priced] = [] // The live cart, empty at first.
    @State private var shots = 2 // Shots for the next coffee.

    var body: some View { // Rebuilt whenever cart or shots changes.
        DemoCard(title: "Defining and adopting a protocol", // Named after the course step.
                 caption: "Coffee computes its price and Pastry stores it; both satisfy the same { get } requirement, so one [any Priced] array holds both.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: DefiningAndAdoptingAProtocol.run().lines) // Two cart lines.
            Divider() // Separates the program from the live cart.
            Stepper(value: $shots, in: 1...4) { Text("Coffee shots: \(shots)") } // Shots for the next coffee.
            HStack { // The add buttons.
                Button("Add Flat white") { // Appends a Coffee.
                    cart.append(DefiningAndAdoptingAProtocol.Coffee(name: "Flat white", shots: shots)) // A computed price.
                }
                Button("Add Croissant") { // Appends a Pastry.
                    cart.append(DefiningAndAdoptingAProtocol.Pastry(name: "Croissant", price: 3.25)) // A stored price.
                }
                Spacer() // Pushes Clear to the right.
                Button("Clear", systemImage: "trash", role: .destructive) { cart.removeAll() } // Empties the cart.
                    .labelStyle(.iconOnly) // Just the trash icon, so all three buttons fit on one line.
            }
            .buttonStyle(.bordered) // Visible button shapes.
            ForEach(cart.indices, id: \.self) { index in // One row per item; the loop only sees any Priced.
                LabeledContent(cart[index].name) { // The name requirement.
                    Text(verbatim: "\(cart[index].price)") // The price requirement, however it is produced.
                }
            }
            LabeledContent("Total") { Text(cart.reduce(0) { $0 + $1.price }, format: .currency(code: "USD")) } // Only protocol members are needed to total.
                .font(.headline) // Stands out.
            CompilerNote(code: "for item in cart { print(item.shots) }", // The course's try item.
                         message: "value of type 'any Priced' has no member 'shots'") // Only the requirements are visible through the box.
        }
    }
}

/// Code step "Default behavior with protocol extensions".
private struct ShareableCard: View { // Edit the song and recipe and read their share text.
    @State private var songTitle = "Night Owl" // The song's title.
    @State private var recipeTitle = "Pad thai" // The recipe's title.
    @State private var minutes = 25 // The recipe's cooking time.

    private var items: [any ProtocolExtensions.Shareable] { // The same mixed array as the course program, built from the controls.
        [ProtocolExtensions.Song(title: songTitle), ProtocolExtensions.Recipe(title: recipeTitle, minutes: minutes)] // One song, one recipe.
    }

    var body: some View { // Rebuilt whenever a control changes.
        DemoCard(title: "Default behavior with protocol extensions", // Named after the course step.
                 caption: "Song gets shareText for free from the protocol extension. Recipe provides its own, and a type's own implementation always wins.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: ProtocolExtensions.run().lines) // Default text, then custom text.
            Divider() // Separates the program from the live items.
            TextField("Song title", text: $songTitle) // The song's only property.
                .textFieldStyle(.roundedBorder) // The familiar bordered field.
            TextField("Recipe title", text: $recipeTitle) // The recipe's title.
                .textFieldStyle(.roundedBorder) // The familiar bordered field.
            Stepper(value: $minutes, in: 5...120, step: 5) { Text("Recipe minutes: \(minutes)") } // The recipe's extra data.
            ForEach(items.indices, id: \.self) { index in // The course's loop over any Shareable.
                VStack(alignment: .leading, spacing: 2) { // The text and where it came from.
                    Text(verbatim: items[index].shareText) // Dispatched to each item's own version.
                        .font(.system(.body, design: .monospaced)) // Looks like console output.
                    Text(index == 0 ? "Song: default from extension Shareable" : "Recipe: its own shareText") // Which implementation ran.
                        .font(.caption) // Small print.
                        .foregroundStyle(.secondary) // A note.
                }
            }
        }
    }
}

/// Concept step "Standard protocols you will use every day".
private struct StandardProtocolsCard: View { // The five protocols and the design callout.
    var body: some View { // Static content.
        DemoCard(title: "Standard protocols you will use every day", // Named after the course step.
                 caption: "For many of these the compiler writes the code for you (synthesis), as long as every stored property already conforms.") { // The key idea.
            TermList(terms: [ // The five protocols from the course page.
                ("Equatable", "== compares two values. Needed by contains and firstIndex(of:), and by SwiftUI to spot changes."), // Protocol 1.
                ("Hashable", "Produces a hash so values can go in a Set or be Dictionary keys. Includes Equatable."), // Protocol 2.
                ("Comparable", "< orders values, so sorted() and max() work. You usually write < yourself."), // Protocol 3.
                ("Identifiable", "A stable id property, so SwiftUI lists can track rows as they move."), // Protocol 4.
                ("Codable", "Converts to and from JSON and other formats. It is Encodable plus Decodable."), // Protocol 5.
            ])
            CalloutBox(title: "Protocol-oriented programming", // The course's design callout.
                       text: "Describe capabilities as small protocols, give them default behavior in extensions, and let value types adopt exactly the capabilities they need.") // Its message.
        }
    }
}

/// Code step "Equatable, Hashable and Comparable".
private struct HashableComparableCard: View { // Change due days and watch ==, Set and sorted() react.
    @State private var copyDay = 1 // The copy's due day; equal to rent's at first.
    @State private var callDay = 5 // "Call the bank" due day.
    @State private var gymDay = 3 // "Renew gym" due day.

    private typealias Item = EquatableHashableComparable.TodoItem // A short local name for the course's type.

    var body: some View { // Rebuilt whenever a stepper changes.
        let rent = Item(title: "Pay rent", dueDay: 1) // Fixed: due on day 1.
        let copy = Item(title: "Pay rent", dueDay: copyDay) // Same title; the day is yours to change.
        let call = Item(title: "Call the bank", dueDay: callDay) // Movable due day.
        let gym = Item(title: "Renew gym", dueDay: gymDay) // Movable due day.
        let unique: Set<Item> = [rent, copy, call, gym] // Duplicates are stored once.
        return DemoCard(title: "Equatable, Hashable and Comparable", // Named after the course step.
                        caption: "Hashable gives TodoItem == and hashing for free. Comparable needs one function, <, which here says earlier due dates come first.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: EquatableHashableComparable.run().lines) // true, 3, the sorted titles.
            Divider() // Separates the program from the live checks.
            Stepper(value: $copyDay, in: 1...7) { Text("copy is due on day \(copyDay)") } // Changes one stored property of copy.
            CodeText("rent == copy  // \(rent == copy)") // Synthesized ==: every stored property must match.
            CodeText("Set([rent, copy, call, gym]).count  // \(unique.count)") // 3 while rent and copy are equal, 4 otherwise.
            Stepper(value: $callDay, in: 1...7) { Text("Call the bank: day \(callDay)") } // Moves a task in the order.
            Stepper(value: $gymDay, in: 1...7) { Text("Renew gym: day \(gymDay)") } // Moves another task.
            CodeText("[call, rent, gym].sorted()\n// \([call, rent, gym].sorted().map { $0.title })") // Your < decides the order.
            CodeText("[call, rent, gym].max()?.title\n// \([call, rent, gym].max()?.title ?? "none")") // The course's try item: the latest due date.
        }
    }
}

/// Code step "Identifiable and Codable": edit JSON and decode it.
private struct CodableCard: View { // A JSON editor, the decoded song and the encoded JSON.
    @State private var jsonText = IdentifiableAndCodable.sampleJSON // The text being decoded.

    var body: some View { // Rebuilt whenever jsonText changes.
        DemoCard(title: "Identifiable and Codable", // Named after the course step.
                 caption: "Declaring Codable lets JSONDecoder and JSONEncoder convert between JSON and the struct with no hand-written parsing. Identifiable just requires an id.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: IdentifiableAndCodable.run().lines) // The title line, then the pretty JSON.
            Divider() // Separates the program from the live editor.
            Text("Edit the JSON:") // Introduces the editor.
                .font(.subheadline.bold()) // A small heading.
            TextEditor(text: $jsonText) // Free-form JSON input.
                .font(.system(.footnote, design: .monospaced)) // Fixed width, like code.
                .autocorrectionDisabled() // JSON is not prose.
                .textInputAutocapitalization(.never) // Keys are lowercase.
                .frame(height: 80) // Enough for one object.
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(.secondary.opacity(0.4))) // A visible border.
            HStack { // Quick edits that provoke the common failures.
                Button("Remove \"artist\"") { // Leaves a stored property without a key.
                    jsonText = #"{"id": 7, "title": "Night Owl"}"# // The decoder will throw keyNotFound.
                }
                Button("id as text") { // Gives a number property a String.
                    jsonText = #"{"id": "seven", "title": "Night Owl", "artist": "The Late Trains"}"# // typeMismatch.
                }
                Spacer() // Pushes Restore to the right.
                Button("Restore") { jsonText = IdentifiableAndCodable.sampleJSON } // Back to the course's JSON.
            }
            .font(.footnote) // Compact buttons.
            .buttonStyle(.bordered) // Visible button shapes.
            switch Result(catching: { try IdentifiableAndCodable.decodeSong(from: jsonText) }) { // Result turns the throwing call into a value.
            case .success(let song): // The JSON matched the struct.
                CodeText("song.title  // \(song.title)\nsong.artist  // \(song.artist)\nsong.id  // \(song.id)") // Typed properties.
                ProgramOutput(heading: "Encoded again, pretty and sorted", lines: [IdentifiableAndCodable.prettyJSON(for: song)]) // The reverse trip.
            case .failure(let error): // The JSON did not match.
                Label(IdentifiableAndCodable.explain(error), systemImage: "exclamationmark.triangle") // Why decoding failed.
                    .foregroundStyle(.orange) // A warning.
            }
            Text("Identifiable: ForEach tracks each decoded song by its id.") // Introduces the list.
                .font(.subheadline.bold()) // A small heading.
            ForEach((try? IdentifiableAndCodable.decodeSongs(from: IdentifiableAndCodable.playlistJSON)) ?? []) { song in // No id: argument needed.
                LabeledContent(song.title, value: "id \(song.id)") // Title on the left, id on the right.
            }
        }
    }
}

/// Compare step "some versus any".
private struct SomeAnyCard: View { // One hidden type on the left, a box of mixed types on the right.
    @State private var shapes: [any SomeVersusAny.Shape] = [SomeVersusAny.Square(side: 3)] // The right side's array.

    var body: some View { // Rebuilt whenever shapes changes.
        DemoCard(title: "some versus any", // Named after the course step.
                 caption: "some Shape means one specific conforming type that is not named. any Shape is a box that may hold any conforming type. SwiftUI's some View is the first kind.") { // The key idea.
            HStack(alignment: .top) { // The two course programs side by side.
                ProgramOutput(heading: "some prints", lines: SomeVersusAny.runSome().lines) // 9.0
                ProgramOutput(heading: "any prints", lines: SomeVersusAny.runAny().lines) // Both areas.
            }
            Divider() // Separates the programs from the live demo.
            Text("some: one hidden concrete type") // The left label from the course.
                .font(.subheadline.bold()) // A small heading.
            CodeText("makeBadge().area()  // \(SomeVersusAny.makeBadge().area())") // Always a Square underneath.
            CompilerNote(code: "func makeBadge() -> some Shape {\n    if flag { return Square(side: 3) }\n    return Circle(radius: 1)\n}", // Two different concrete types.
                         message: "function declares an opaque return type 'some Shape', but the return statements in its body do not have matching underlying types") // Exact Xcode message.
            Text("any: a box for any conforming type") // The right label from the course.
                .font(.subheadline.bold()) // A small heading.
            VStack(alignment: .leading, spacing: 8) { // Buttons that append different concrete types, one per line.
                Button("append(Square(side: 2))") { shapes.append(SomeVersusAny.Square(side: 2)) } // A square.
                Button("append(Circle(radius: 1))") { shapes.append(SomeVersusAny.Circle(radius: 1)) } // A circle.
            }
            .font(.system(.caption, design: .monospaced)) // Code-looking titles.
            .buttonStyle(.bordered) // Visible button shapes.
            CodeText("shapes.map { $0.area() }\n// \(shapes.map { $0.area() })") // Each call is dispatched to the right type.
            CodeText("shapes holds: \(shapes.map { "\(type(of: $0))" }.joined(separator: ", "))") // The concrete types inside the boxes.
            Button("Reset to [Square(side: 3)]") { shapes = [SomeVersusAny.Square(side: 3)] } // Start over.
                .font(.footnote) // Small.
        }
    }
}

#Preview { // Shows this screen in Xcode's canvas.
    NavigationStack { ProtocolsLesson(lesson: ContentView.lessons[3]) } // Inside a stack so the title appears.
}

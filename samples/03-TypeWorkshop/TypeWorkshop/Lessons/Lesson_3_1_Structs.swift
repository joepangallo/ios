// Lesson_3_1_Structs.swift
// Who: a student who opens lesson 3.1 from the home screen.
// What: one card per course step of "Structs: Your Own Value Types": the four
//       key terms, then each struct program with its real output and live
//       controls (a to-do item, a coffee order, a playlist, a weather reading
//       and a printable to-do list), plus the compiler errors the course asks
//       you to provoke.
// Where: pushed by ContentView when the 3.1 row is tapped (or launched with -lesson 3.1).
// When: built when the screen appears and rebuilt whenever a control changes @State.
// Why: structs are easier to understand when you can change a property and watch
//      the computed values, mutating methods and observers react straight away.

import SwiftUI // SwiftUI provides View, @State and the controls used below.

struct StructsLesson: View { // The screen for lesson 3.1.
    let lesson: Lesson // The catalog entry: number, title and summary.

    var body: some View { // The page: summary first, then one card per course step.
        CardPage(lesson: lesson) { // CourseKit's scrolling page layout, plus the -card launch argument.
            WhyOwnTypesCard() // Concept: why define your own types.
            DefiningAStructCard() // Code: defining a struct.
            ComputedPropertiesCard() // Code: computed properties and methods.
            MutatingMethodsCard() // Code: mutating methods.
            MutatingMeetsLetCard() // Code: when mutating meets let.
            DidSetCard() // Code: custom init, static members and didSet.
            CustomDescriptionCard() // Code: choosing how a value prints.
        }
    }
}

/// Concept step "Why define your own types".
private struct WhyOwnTypesCard: View { // private: only this file uses the card.
    var body: some View { // Static content: the terms and the callout.
        DemoCard(title: "Why define your own types", // Named after the course step.
                 caption: "A type is a blueprint: it names a kind of data, says what it holds and what it can do. Swift's main custom types are structs, classes and enums.") { // The idea in one sentence.
            TermList(terms: [ // The four terms from the course page.
                ("Instance", "One concrete value built from a type, such as one particular to-do item."), // Term 1.
                ("Property", "A named piece of data stored in, or computed by, an instance."), // Term 2.
                ("Method", "A function that belongs to a type and works with its properties."), // Term 3.
                ("Initializer", "The code (init) that gives every stored property its first value."), // Term 4.
            ])
            CalloutBox(title: "Model the domain", // The course's design callout.
                       text: "When your type names match the words users say (order, playlist, reading), the code reads like the problem it solves.") // Its message.
        }
    }
}

/// Code step "Defining a struct": a live TodoItem you can edit.
private struct DefiningAStructCard: View { // Shows the program, then lets you edit one instance.
    @State private var chore = DefiningAStruct.TodoItem(title: "Buy oat milk", isDone: false, minutes: 15) // One instance, owned by this card.
    @State private var newMinutes = 15 // The minutes a brand-new item will be created with.

    var body: some View { // Rebuilt whenever chore or newMinutes changes.
        DemoCard(title: "Defining a struct", // Named after the course step.
                 caption: "Swift writes a memberwise initializer: one labeled parameter per stored property.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: DefiningAStruct.run().lines) // What the course program prints.
            Divider() // Separates the program from the live instance.
            Text("Edit the var properties of chore:") // Introduces the controls.
                .font(.subheadline.bold()) // A small heading.
            TextField("Title", text: $chore.title) // Writes straight into chore.title, a var property.
                .textFieldStyle(.roundedBorder) // The familiar bordered field.
            Toggle(isOn: $chore.isDone) { CodeText("chore.isDone") } // Writes into chore.isDone, also a var.
            LabeledContent { // Shows the let property, which has no control.
                Text(verbatim: "\(chore.minutes)") // The value fixed by the initializer.
            } label: { // The label half.
                Label("minutes is a let", systemImage: "lock.fill") // A lock: it cannot change after init.
            }
            CodeText("print(chore)  // \(chore)") // The default description, recomputed live.
            Stepper(value: $newMinutes, in: 5...60, step: 5) { // Chooses minutes for a new instance.
                Text("New item minutes: \(newMinutes)") // The value the next initializer call will use.
            }
            Button("chore = TodoItem(title:isDone:minutes:)") { // Builds a whole new value with the memberwise init.
                chore = DefiningAStruct.TodoItem(title: chore.title, isDone: chore.isDone, minutes: newMinutes) // The only way to get a new minutes value.
            }
            .font(.system(.footnote, design: .monospaced)) // Code-looking button title.
            Text("Try it from the course: both lines below are rejected by the compiler.") // Introduces the errors.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A hint, not a demo.
            CompilerNote(code: "chore.minutes = 20", // Try item 1.
                         message: "cannot assign to property: 'minutes' is a 'let' constant") // Exact Xcode message.
            CompilerNote(code: "let chore = TodoItem(...)\nchore.isDone = true", // Try item 2.
                         message: "cannot assign to property: 'chore' is a 'let' constant") // With let, no property can change.
        }
    }
}

/// Code step "Computed properties and methods": a coffee order whose price follows its options.
private struct ComputedPropertiesCard: View { // Change the options and watch price and receipt().
    @State private var order = ComputedPropertiesAndMethods.CoffeeOrder(drink: "Latte", shots: 2, hasOatMilk: true) // The course's order.
    private let drinks = ["Latte", "Flat white", "Cappuccino"] // Choices for the drink picker.

    var body: some View { // Rebuilt whenever order changes.
        DemoCard(title: "Computed properties and methods", // Named after the course step.
                 caption: "price is computed from the order every time you read it, so it can never fall out of date.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: ComputedPropertiesAndMethods.run().lines) // 4.85, then the receipt.
            Divider() // Separates the program from the live order.
            Picker("Drink", selection: $order.drink) { // Changes the stored drink.
                ForEach(drinks, id: \.self) { Text($0) } // One choice per drink name.
            }
            .pickerStyle(.segmented) // Three side-by-side buttons.
            Stepper(value: $order.shots, in: 1...4) { // Changes the stored shot count.
                Text("Shots: \(order.shots)") // The current count.
            }
            Toggle("Oat milk", isOn: $order.hasOatMilk) // Changes the stored oat milk flag.
            LabeledContent { // The computed property, read again on every redraw.
                Text(verbatim: "\(order.price)") // The raw Double, exactly as print would show it.
            } label: { CodeText("order.price") } // Labeled with the expression that produced it.
            LabeledContent { // The method's result.
                Text(verbatim: order.receipt()) // Formatted with exactly two decimals.
            } label: { CodeText("order.receipt()") } // Methods use parentheses; properties do not.
            Text("Some prices print with long decimals, such as 6.3500000000000005, because Double cannot store every decimal exactly. receipt() uses %.2f, so money always shows two decimals.") // Explains what students may see.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A side note.
        }
    }
}

/// Code step "Mutating methods": a playlist you add songs to.
private struct MutatingMethodsCard: View { // Calls the mutating add method on a var playlist.
    @State private var roadTrip = MutatingMethods.Playlist(name: "Road Trip") // Starts empty, as in the course.
    @State private var nextSong = "Golden Hour" // The title the next add call will use.

    var body: some View { // Rebuilt whenever roadTrip or nextSong changes.
        DemoCard(title: "Mutating methods", // Named after the course step.
                 caption: "add is marked mutating because it changes songs. It can only be called on a var.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: MutatingMethods.run().lines) // The summary and the array.
            Divider() // Separates the program from the live playlist.
            TextField("Song title", text: $nextSong) // The argument for the next add call.
                .textFieldStyle(.roundedBorder) // The familiar bordered field.
            HStack { // The two actions side by side.
                Button("roadTrip.add(...)") { // Calls the mutating method.
                    roadTrip.add(nextSong) // Appends the typed title to songs.
                }
                .disabled(nextSong.isEmpty) // Nothing to add without a title.
                Spacer() // Pushes the reset button to the right.
                Button("Reset", role: .destructive) { // Starts over with the default songs, an empty array.
                    roadTrip = MutatingMethods.Playlist(name: "Road Trip") // A new value from the memberwise init.
                }
            }
            .font(.system(.footnote, design: .monospaced)) // Code-looking button titles.
            CodeText("roadTrip.summary  // \(roadTrip.summary)") // The computed summary, always current.
            CodeText("roadTrip.songs  // \(roadTrip.songs)") // The raw array, in Swift's array format.
        }
    }
}

/// Code step "When mutating meets let": the mistake explained, the fix running.
private struct MutatingMeetsLetCard: View { // Switch between let and var to see which compiles.
    @State private var useVar = false // false shows the broken program, true the fixed one.

    var body: some View { // Rebuilt when the picker changes.
        DemoCard(title: "When mutating meets let", // Named after the course step.
                 caption: "With let, the whole struct value is constant, so a mutating method may not run on it.") { // The key idea.
            Picker("Declaration", selection: $useVar) { // Chooses which version of the program to show.
                Text(verbatim: "let favorites").tag(false) // The program from the course page.
                Text(verbatim: "var favorites").tag(true) // The program after the fix.
            }
            .pickerStyle(.segmented) // Two side-by-side buttons.
            if useVar { // The fixed program compiles and runs.
                CodeText("var favorites = Playlist()\nfavorites.add(\"Golden Hour\")\nprint(favorites.songs)") // The fixed lines.
                ProgramOutput(lines: MutatingMeetsLet.runFixed().lines) // ["Golden Hour"]
            } else { // The course's version does not compile.
                CompilerNote(code: "let favorites = Playlist()\nfavorites.add(\"Golden Hour\")", // The two lines involved.
                             message: "cannot use mutating member on immutable value: 'favorites' is a 'let' constant") // Exact Xcode message.
                Text("The program never runs, so nothing is printed. Change let to var to fix it.") // What happens instead of output.
                    .font(.caption) // Small print.
                    .foregroundStyle(.secondary) // A note.
            }
            Text("Try it: delete the word mutating instead. The error moves into the method:") // The course's second try item.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A note.
            CompilerNote(code: "func add(_ song: String) { songs.append(song) }", // The method without mutating.
                         message: "cannot use mutating member on immutable value: 'self' is immutable") // Inside a non-mutating method, self is read-only.
        }
    }
}

/// Code step "Custom init, static members and didSet": a reading whose observer logs changes.
private struct DidSetCard: View { // Create readings in Fahrenheit, assign Celsius, watch didSet.
    @State private var fahrenheit = 41.0 // The Fahrenheit value the custom init receives.
    @State private var reading = CustomInitStaticDidSet.WeatherReading(city: "Denver", fahrenheit: 41) // The course's reading.
    @State private var newCelsius = -2.5 // The next value to assign to celsius.

    var body: some View { // Rebuilt whenever any of the state changes.
        DemoCard(title: "Custom init, static members and didSet", // Named after the course step.
                 caption: "init(city:fahrenheit:) converts to Celsius once. didSet runs after every later assignment, never during init.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: CustomInitStaticDidSet.run().lines) // The didSet line, then true.
            Divider() // Separates the program from the live reading.
            Stepper(value: $fahrenheit, in: -4...104, step: 9) { // Steps of 9 Fahrenheit are steps of 5 Celsius.
                Text(verbatim: "fahrenheit: \(fahrenheit)") // The argument for the custom init.
            }
            Button("reading = WeatherReading(city: \"Denver\", fahrenheit: \(Int(fahrenheit)))") { // Calls the custom init.
                reading = CustomInitStaticDidSet.WeatherReading(city: "Denver", fahrenheit: fahrenheit) // A fresh reading; its log starts empty.
            }
            .font(.system(.footnote, design: .monospaced)) // Code-looking button title.
            .multilineTextAlignment(.leading) // A wrapped title stays left-aligned, like code.
            LabeledContent { // The stored value after conversion.
                Text(verbatim: "\(reading.celsius)") // Always Celsius inside the struct.
            } label: { CodeText("reading.celsius") } // The expression being shown.
            Stepper(value: $newCelsius, in: -10...10, step: 2.5) { // Chooses the next Celsius value.
                Text(verbatim: "new value: \(newCelsius)") // The value the assignment button will store.
            }
            VStack(alignment: .leading, spacing: 8) { // Two ways to assign, one per line.
                Button("reading.celsius = \(newCelsius.formatted())") { // An ordinary assignment.
                    reading.celsius = newCelsius // didSet runs and logs old -> new.
                }
                Button("reading.celsius = reading.celsius") { // The course's try item: does didSet run for an equal value?
                    reading.celsius = reading.celsius // Stores the same number again; didSet still runs.
                }
            }
            .font(.system(.footnote, design: .monospaced)) // Code-looking button titles.
            ProgramOutput(heading: "didSet log", lines: reading.log.lines) // Every line the observer printed.
            LabeledContent { // The computed property that compares with the static constant.
                Text(verbatim: "\(reading.isFreezing)") // true at or below 0.0.
            } label: { CodeText("reading.isFreezing") } // The expression being shown.
            LabeledContent { // The static member, read on the type, not an instance.
                Text(verbatim: "\(CustomInitStaticDidSet.WeatherReading.freezingPoint)") // 0.0, shared by every reading.
            } label: { CodeText("WeatherReading.freezingPoint") } // Reached through the type name.
        }
    }
}

/// Code step "Choosing how a value prints": a to-do list that prints with checkboxes.
private struct CustomDescriptionCard: View { // Toggle tasks and watch the custom descriptions change.
    @State private var items = [ // The two tasks the course starts with.
        ChoosingHowAValuePrints.TodoItem(title: "Book flights"), // Open at first.
        ChoosingHowAValuePrints.TodoItem(title: "Pack charger", isDone: true), // Already done.
    ]
    @State private var newTitle = "Water plants" // The next task to append.

    var body: some View { // Rebuilt whenever items or newTitle changes.
        DemoCard(title: "Choosing how a value prints", // Named after the course step.
                 caption: "CustomStringConvertible is a protocol: it asks for one property, description, which print and interpolation then use.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: ChoosingHowAValuePrints.run().lines) // Three tasks and the open count.
            Divider() // Separates the program from the live list.
            ForEach(items.indices, id: \.self) { index in // One row per task; the index identifies it.
                Toggle(isOn: $items[index].isDone) { // Writes into the struct stored in the array.
                    Text(verbatim: "\(items[index])") // Interpolation uses our description.
                        .font(.system(.body, design: .monospaced)) // Looks like console output.
                }
            }
            HStack { // A field and a button on one line.
                TextField("New task", text: $newTitle) // The title for the next append.
                    .textFieldStyle(.roundedBorder) // The familiar bordered field.
                Button("append") { // Adds an unfinished task.
                    items.append(ChoosingHowAValuePrints.TodoItem(title: newTitle)) // isDone uses its default, false.
                }
                .disabled(newTitle.isEmpty) // Nothing to add without a title.
            }
            CodeText("Open: \(items.filter { !$0.isDone }.count)") // The filter-and-count line, live.
            Text("Without the protocol, the same task prints like this:") // Sets up the comparison.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A note.
            CodeText("\(DefiningAStruct.TodoItem(title: items.first?.title ?? "Book flights", isDone: items.first?.isDone ?? false, minutes: 15))") // A plain struct's default description.
        }
    }
}

#Preview { // Shows this screen in Xcode's canvas.
    NavigationStack { StructsLesson(lesson: ContentView.lessons[0]) } // Inside a stack so the title appears.
}

// Lesson_3_2_Classes.swift
// Who: a student who opens lesson 3.2 from the home screen.
// What: one card per course step of "Classes and Reference Semantics": the key
//       terms, a joint bank account shared by two constants, inheritance with
//       override, super and final, a live "copy a struct, share a class" demo,
//       the memory lab that counts references, and the struct-or-class guide.
// Where: pushed by ContentView when the 3.2 row is tapped (or launched with -lesson 3.2).
// When: built when the screen appears and rebuilt whenever a control changes state.
// Why: "assignment copies a value but shares an object" is easiest to believe
//      once you change one name and watch the other name change too, or not.

import SwiftUI // SwiftUI provides View, @State and the controls used below.

struct ClassesLesson: View { // The screen for lesson 3.2.
    let lesson: Lesson // The catalog entry: number, title and summary.

    var body: some View { // The page: summary first, then one card per course step.
        CardPage(lesson: lesson) { // CourseKit's scrolling page layout, plus the -card launch argument.
            SharedObjectsCard() // Concept: classes are shared objects with identity.
            BankAccountCard() // Code: a class with an initializer.
            InheritanceCard() // Code: inheritance, override, super and final.
            CopyOrShareCard() // Compare: copy a struct, share a class.
            MemoryLabCard() // Widget: see it in memory.
            StructOrClassCard() // Concept: struct or class? A decision guide.
        }
    }
}

/// Concept step "Classes: shared objects with identity".
private struct SharedObjectsCard: View { // The terms and the history callout.
    var body: some View { // Static content.
        DemoCard(title: "Classes: shared objects with identity", // Named after the course step.
                 caption: "Assigning a struct copies the value. Assigning a class copies a reference, an arrow to one shared object on the heap. ARC frees the object once no references remain.") { // The key idea.
            TermList(terms: [ // The three terms from the course page.
                ("Value type", "Struct, enum, tuple. Each variable holds its own independent copy."), // Term 1.
                ("Reference type", "Class, actor. Variables hold references to one shared instance."), // Term 2.
                ("Identity", "Two references are identical (===) when they point at the very same object."), // Term 3.
            ])
            CalloutBox(title: "Why Swift prefers values", // The course's history callout.
                       text: "Objective-C built almost everything from classes. Swift flips the default: the standard library and SwiftUI are mostly structs, and classes are kept for things that need shared identity.") // Its message.
        }
    }
}

/// Two names for one account, created exactly the way the course program does it.
private struct JointAccounts { // A struct that holds two references to the same object.
    let joint: AClassWithAnInitializer.BankAccount // The first reference.
    let sameAccount: AClassWithAnInitializer.BankAccount // The second reference.

    init() { // Builds one object and two references to it.
        let account = AClassWithAnInitializer.BankAccount(owner: "Ana and Ben", balance: 100) // One object on the heap.
        joint = account // let joint = BankAccount(...)
        sameAccount = account // let sameAccount = joint
    }
}

/// Code step "A class with an initializer": deposit through either name, read through both.
private struct BankAccountCard: View { // Shows that both constants see every deposit.
    @State private var accounts = JointAccounts() // The two references, kept for the life of the screen.
    @State private var third: AClassWithAnInitializer.BankAccount? // A separate account, created on request.
    @State private var deposits = 0 // Counts deposits; changing it is what redraws the balances.

    var body: some View { // Rebuilt whenever deposits or third changes.
        DemoCard(title: "A class with an initializer", // Named after the course step.
                 caption: "Classes get no memberwise initializer, so BankAccount writes its own init. Two constants, one object: a deposit through either shows up through both.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: AClassWithAnInitializer.run().lines) // 150.0 and true.
            Divider() // Separates the program from the live account.
            VStack(alignment: .leading, spacing: 8) { // One deposit button per reference, one per line.
                Button("joint.deposit(25)") { // Deposits through the first reference.
                    accounts.joint.deposit(25) // Changes the shared object.
                    deposits += 1 // Records the change so the card redraws.
                }
                Button("sameAccount.deposit(25)") { // Deposits through the second reference.
                    accounts.sameAccount.deposit(25) // Changes the same shared object.
                    deposits += 1 // Records the change so the card redraws.
                }
            }
            .font(.system(.footnote, design: .monospaced)) // Code-looking button titles.
            .buttonStyle(.bordered) // Visible button shapes.
            LabeledContent { Text(verbatim: "\(accounts.joint.balance)") } label: { CodeText("joint.balance") } // Read through joint.
            LabeledContent { Text(verbatim: "\(accounts.sameAccount.balance)") } label: { CodeText("sameAccount.balance") } // Read through sameAccount.
            LabeledContent { Text(verbatim: "\(accounts.joint === accounts.sameAccount)") } label: { CodeText("joint === sameAccount") } // Same object: true.
            Text("Deposits so far: \(deposits)") // Shows how many times the shared object changed.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A note.
            Button("Open a third account with the same owner and balance") { // The course's first try item.
                third = AClassWithAnInitializer.BankAccount(owner: accounts.joint.owner, balance: accounts.joint.balance) // A second object with equal contents.
            }
            if let third { // Only after the button was tapped.
                LabeledContent { Text(verbatim: "\(third.balance)") } label: { CodeText("third.balance") } // Same number as joint.
                LabeledContent { Text(verbatim: "\(third === accounts.joint)") } label: { CodeText("third === joint") } // false: a different object.
                Text("Equal contents, different objects: === asks \"same object?\", not \"equal values?\".") // Why it is false.
                    .font(.caption) // Small print.
                    .foregroundStyle(.secondary) // A note.
            }
        }
    }
}

/// Code step "Inheritance, override, super and final".
private struct InheritanceCard: View { // Runs month end on a plain account and a savings account.
    @State private var accounts = InheritanceOverrideSuperFinal.makeAccounts() // The two accounts from the course.
    @State private var log: [String] = [] // Every line printed by the live month ends.

    var body: some View { // Rebuilt whenever log changes.
        DemoCard(title: "Inheritance, override, super and final", // Named after the course step.
                 caption: "SavingsAccount inherits balance and init from Account, overrides monthEnd(), and calls super to reuse the base text. final stops anyone subclassing it.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: InheritanceOverrideSuperFinal.run().lines) // The two month-end lines.
            Divider() // Separates the program from the live loop.
            ForEach(accounts.indices, id: \.self) { index in // One row per account in the [Account] array.
                LabeledContent { // The object's current balance.
                    Text(verbatim: "\(accounts[index].balance)") // Grows each month for the savings account.
                } label: { // Which class this element really is.
                    CodeText("accounts[\(index)] is \(type(of: accounts[index]))") // The dynamic type, not the declared Account.
                }
            }
            HStack { // The loop and a reset.
                Button("for account in accounts { account.monthEnd() }") { // One pass of the course's loop.
                    log.append(contentsOf: InheritanceOverrideSuperFinal.monthEndReport(for: accounts).lines) // Each object picks its own monthEnd.
                }
                .font(.system(.footnote, design: .monospaced)) // Code-looking button title.
                Spacer() // Pushes reset to the right.
                Button("Reset") { // Fresh accounts, empty log.
                    accounts = InheritanceOverrideSuperFinal.makeAccounts() // Balances back to 200 and 1000.
                    log = [] // Nothing printed yet.
                }
            }
            ProgramOutput(heading: "Printed by the live loop", lines: log) // Every month end so far.
            Text("Try it from the course:") // Introduces the errors.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A note.
            CompilerNote(code: "// in SavingsAccount, without override:\nfunc monthEnd() -> String {", // Try item 1.
                         message: "overriding declaration requires an 'override' keyword") // Exact Xcode message.
            CompilerNote(code: "class PremiumSavings: SavingsAccount {}", // Try item 2.
                         message: "inheritance from a final class 'SavingsAccount'") // What final prevents.
        }
    }
}

/// Two names for one Settings object, for the class side of the compare.
private struct SharedSettings { // Holds the two references.
    let phone: ShareAClass.Settings // let phone = Settings()
    let tablet: ShareAClass.Settings // let tablet = phone

    init() { // One object, two references.
        let settings = ShareAClass.Settings() // The object on the heap.
        phone = settings // The first reference.
        tablet = settings // The second reference to the same object.
    }
}

/// Compare step "Copy a struct, share a class": change the tablet, watch the phone.
private struct CopyOrShareCard: View { // Both programs, then a live version of each.
    @State private var structPhone = CopyAStruct.Settings() // var phone = Settings() in the struct world.
    @State private var structTablet = CopyAStruct.Settings() // var tablet = phone: an independent copy with the same contents.
    @State private var classSettings = SharedSettings() // let phone and let tablet in the class world.
    @State private var classVolume = 5 // Mirrors the shared object's volume so SwiftUI redraws when it changes.

    var body: some View { // Rebuilt whenever a stepper changes state.
        DemoCard(title: "Copy a struct, share a class", // Named after the course step.
                 caption: "The same tiny type written as a struct and as a class. Copy phone into tablet, then change only the tablet's volume. Does the phone change?") { // The key idea.
            HStack(alignment: .top) { // The two course programs side by side.
                ProgramOutput(heading: "struct prints", lines: CopyAStruct.run().lines) // 5 9
                ProgramOutput(heading: "class prints", lines: ShareAClass.run().lines) // 9 9
            }
            Divider() // Separates the programs from the live demo.
            Text("struct: tablet gets its own copy") // The left label from the course.
                .font(.subheadline.bold()) // A small heading.
            Stepper(value: $structTablet.volume, in: 0...10) { // Changes only the struct copy in tablet.
                CodeText("tablet.volume = \(structTablet.volume)") // The tablet's own value.
            }
            CodeText("print(phone.volume, tablet.volume)\n// \(structPhone.volume) \(structTablet.volume)") // The phone keeps its volume.
            Text("class: tablet shares the object") // The right label from the course.
                .font(.subheadline.bold()) // A small heading.
            Stepper(value: classVolumeBinding, in: 0...10) { // Changes the one shared object through tablet.
                CodeText("tablet.volume = \(classVolume)") // The shared object's value.
            }
            CodeText("print(phone.volume, tablet.volume)\n// \(classSettings.phone.volume) \(classSettings.tablet.volume)") // Both names read the same object.
            Button("Start over: var tablet = phone again") { // Resets both worlds to volume 5.
                structPhone = CopyAStruct.Settings() // A fresh phone value.
                structTablet = structPhone // A fresh copy for the tablet.
                classSettings = SharedSettings() // A fresh shared object.
                classVolume = 5 // The new object's volume.
            }
            Text("The class side uses let and still changes volume: let freezes the reference, not the object behind it.") // The course's verdict.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A note.
        }
    }

    /// A binding that writes through the tablet reference and records the new value.
    private var classVolumeBinding: Binding<Int> { // Steppers need a binding.
        Binding( // Built from a getter and a setter.
            get: { classVolume }, // Reads the mirrored value.
            set: { newValue in // Runs when the stepper changes.
                classSettings.tablet.volume = newValue // tablet.volume = newValue: changes the shared object.
                classVolume = newValue // Updates state so the card redraws.
            }
        )
    }
}

/// Widget "See it in memory: values and references".
private struct MemoryLabCard: View { // Runs the same line in a struct world and a class world.
    @State private var lab = ValueReferenceLab() // Both worlds, the heap and the log.

    var body: some View { // Rebuilt whenever the lab's log changes.
        DemoCard(title: "See it in memory: values and references", // Named after the course widget.
                 caption: "Both worlds start with var a = Account(balance: 100). Each button runs the same line in both worlds. Then point b at a brand-new account and watch ARC count the references to each object.") { // The widget's intro.
            ForEach(ValueReferenceLab.Operation.allCases, id: \.self) { operation in // One button per line of code.
                Button { // Runs the line in both worlds.
                    lab.run(operation) // Updates the values, the heap and the log.
                } label: { // The button shows the code it runs.
                    Text(verbatim: lab.code(for: operation)) // For example var b = a.
                        .font(.system(.footnote, design: .monospaced)) // Code-looking text.
                        .frame(maxWidth: .infinity, alignment: .leading) // Full-width buttons, text on the left.
                }
                .buttonStyle(.bordered) // Visible button shapes.
                .disabled(!lab.isEnabled(operation)) // b must exist before it can be changed or compared.
            }
            HStack(alignment: .top, spacing: 12) { // The two worlds side by side.
                VStack(alignment: .leading, spacing: 4) { // The struct world.
                    Text("Struct world") // Column heading.
                        .font(.subheadline.bold()) // A small heading.
                    CodeText("a.balance: \(lab.structA.balance.formatted())") // a's own value.
                    CodeText(lab.structB.map { "b.balance: \($0.balance.formatted())" } ?? "b: not declared") // b's own copy, if any.
                    Text("Every variable holds its own copy.") // What to notice.
                        .font(.caption) // Small print.
                        .foregroundStyle(.secondary) // A note.
                }
                .frame(maxWidth: .infinity, alignment: .leading) // Half the width each.
                VStack(alignment: .leading, spacing: 4) { // The class world.
                    Text("Class world") // Column heading.
                        .font(.subheadline.bold()) // A small heading.
                    CodeText("a.balance: \(lab.classA.balance.formatted())") // Read through a.
                    CodeText(lab.classB.map { "b.balance: \($0.balance.formatted())" } ?? "b: not declared") // Read through b, if declared.
                    Text("Variables hold references.") // What to notice.
                        .font(.caption) // Small print.
                        .foregroundStyle(.secondary) // A note.
                }
                .frame(maxWidth: .infinity, alignment: .leading) // Half the width each.
            }
            Text("Heap (class world)") // The objects the class world created.
                .font(.subheadline.bold()) // A small heading.
            ForEach(lab.heap) { entry in // One row per object ever created.
                if let object = entry.object { // Still alive: something refers to it.
                    CodeText("object \(entry.id): balance \(object.balance.formatted()), references: \(lab.referenceCount(of: object)) (\(lab.names(for: object)))") // Its value and who points at it.
                } else { // The weak reference became nil.
                    CodeText("object \(entry.id): freed by ARC (no references left)") // ARC really deallocated it.
                }
            }
            ProgramOutput(heading: "Lines run so far", lines: lab.log) // Every operation, with any printed result.
            Button("Reset both worlds", role: .destructive) { lab.reset() } // Start over.
        }
    }
}

/// Concept step "Struct or class? A decision guide".
private struct StructOrClassCard: View { // Pick an example and see which kind of type fits.
    @State private var example = StructOrClassGuide.examples[0] // The example being looked at.
    @State private var originalShouldChange = false // The quick test's answer.

    var body: some View { // Rebuilt when the picker or toggle changes.
        DemoCard(title: "Struct or class? A decision guide", // Named after the course step.
                 caption: "Start with a struct. Reach for a class when an instance has a real identity that several parts of the app must share and see change together.") { // Apple's guidance, from the course.
            TermList(terms: [ // The four kinds from the course page.
                ("Struct", StructOrClassGuide.reason(for: .structType)), // Data.
                ("Class", StructOrClassGuide.reason(for: .classType)), // Shared identity.
                ("Enum", StructOrClassGuide.reason(for: .enumType)), // A fixed set of possibilities.
                ("Actor", StructOrClassGuide.reason(for: .actorType)), // Protected shared state.
            ])
            LabeledContent("Model") { // A label, so the menu's purpose is clear.
                Picker("Model", selection: $example) { // Chooses one of the course's examples.
                    ForEach(StructOrClassGuide.examples) { item in // One menu item per example.
                        Text(item.name).tag(item) // The tag is the value the picker stores.
                    }
                }
                .pickerStyle(.menu) // A compact pop-up menu.
            }
            LabeledContent("Use", value: example.kind.rawValue) // The kind of type the course recommends.
                .font(.headline) // Stands out as the answer.
            CalloutBox(title: "A quick test", // The course's tip.
                       text: "Ask: if I copy this and change the copy, should the original change too? If not, use a struct. If it should, you need shared identity, which means a class.") // Its message.
            Toggle("The original should change too", isOn: $originalShouldChange) // Your answer to the quick test.
            LabeledContent("Quick test says", value: StructOrClassGuide.quickTest(originalShouldChange: originalShouldChange).rawValue) // Struct or Class.
        }
    }
}

#Preview { // Shows this screen in Xcode's canvas.
    NavigationStack { ClassesLesson(lesson: ContentView.lessons[1]) } // Inside a stack so the title appears.
}

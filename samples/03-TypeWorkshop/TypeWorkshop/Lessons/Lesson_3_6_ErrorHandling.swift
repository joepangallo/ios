// Lesson_3_6_ErrorHandling.swift
// Who: a student who opens lesson 3.6 from the home screen.
// What: one card per course step of "Error Handling": the key terms, a
//       withdrawal you can make fail, catch clauses that light up as they
//       match, try? and try! on typed text, defer hiding a real spinner, Result
//       for a city lookup, and a sign-up form whose errors people can read.
// Where: pushed by ContentView when the 3.6 row is tapped (or launched with -lesson 3.6).
// When: built when the screen appears and rebuilt whenever a control changes state.
// Why: error handling is about which lines run and which are skipped. Live inputs
//      let you push a program down its failure path and watch it recover.

import SwiftUI // SwiftUI provides View, @State, SecureField and the rest.

struct ErrorHandlingLesson: View { // The screen for lesson 3.6.
    let lesson: Lesson // The catalog entry: number, title and summary.

    var body: some View { // The page: summary first, then one card per course step.
        CardPage(lesson: lesson) { // CourseKit's scrolling page layout, plus the -card launch argument.
            FailureByDesignCard() // Concept: failure is part of the design.
            WithdrawCard() // Code: throwing and catching.
            SpecificCatchCard() // Code: catching specific errors.
            TryOptionalCard() // Code: try? and try!.
            DeferCard() // Code: cleaning up with defer.
            ResultCard() // Code: Result, success or failure as a value.
            ReadableErrorsCard() // Code: errors people can read.
        }
    }
}

/// Concept step "Failure is part of the design".
private struct FailureByDesignCard: View { // The terms and the warning callout.
    var body: some View { // Static content.
        DemoCard(title: "Failure is part of the design", // Named after the course step.
                 caption: "A function marked throws can stop early and hand back an error: a value of any type that conforms to Error. Callers write try, then handle it or pass it on.") { // The key idea.
            TermList(terms: [ // The four terms from the course page.
                ("throw", "Stops the current function and sends an error to the caller."), // Term 1.
                ("try", "Marks a call that might throw, so readers can see every risky line."), // Term 2.
                ("do / catch", "Runs code and routes any thrown error to the first matching catch."), // Term 3.
                ("try?", "Turns a thrown error into nil when you only care whether it worked."), // Term 4.
            ])
            CalloutBox(title: "Errors are not crashes", // The course's warning callout.
                       text: "A thrown error is normal control flow that your code handles. A crash (a failed try!, force-unwrapping nil, fatalError) stops the whole app. Throw for expected problems; crash only on true programmer mistakes.") // Its message.
        }
    }
}

/// Code step "Throwing and catching": change the amounts and see which lines print.
private struct WithdrawCard: View { // The course program with adjustable numbers.
    @State private var balance = 50.0 // The opening balance.
    @State private var first = 20.0 // The first withdrawal.
    @State private var second = 45.0 // The second withdrawal.

    var body: some View { // Rebuilt whenever a stepper changes.
        DemoCard(title: "Throwing and catching", // Named after the course step.
                 caption: "When a try call throws, control jumps straight to catch, skipping the rest of the do block. The program then carries on.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: ThrowingAndCatching.run().lines) // Left, Failed, Done.
            Divider() // Separates the program from the live version.
            Stepper(value: $balance, in: 0...100, step: 5) { CodeText("balance: \(balance)") } // The starting money.
            Stepper(value: $first, in: 0...100, step: 5) { CodeText("try withdraw(\(first.formatted()), from: balance)") } // First call.
            Stepper(value: $second, in: 0...100, step: 5) { CodeText("try withdraw(\(second.formatted()), from: left)") } // Second call.
            ProgramOutput(heading: "Your version prints", lines: ThrowingAndCatching.run(balance: balance, first: first, second: second).lines) // Recomputed on every change.
            Text("Set the second amount to 25 (the course's try item) and \"Never printed\" appears.") // Points at the try item.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A hint.
            CompilerNote(code: "// without try:\nlet left = withdraw(20, from: 50)", // The course's second try item.
                         message: "call can throw but is not marked with 'try'") // Exact Xcode message.
        }
    }
}

/// The three errors the specific-catch card can throw.
private enum ProblemChoice: String, CaseIterable { // Drives a segmented picker.
    case declined = "cardDeclined" // Matches only the catch-all.
    case stock = "outOfStock" // Matches the pattern catch.
    case network = "NetworkError" // Matches the type-cast catch.
}

/// Code step "Catching specific errors": the matching clause lights up.
private struct SpecificCatchCard: View { // Pick an error and watch which catch handles it.
    @State private var choice = ProblemChoice.stock // The error to throw.
    @State private var item = "Oat milk" // Data for outOfStock.
    @State private var code = 503 // Data for NetworkError.

    private var problem: any Error { // The error value the controls describe.
        switch choice { // Each choice builds a different error.
        case .declined: CatchingSpecificErrors.CheckoutError.cardDeclined // No data.
        case .stock: CatchingSpecificErrors.CheckoutError.outOfStock(item: item) // Carries the item.
        case .network: CatchingSpecificErrors.NetworkError(code: code) // Carries the status code.
        }
    }

    var body: some View { // Rebuilt whenever a control changes.
        let result = CatchingSpecificErrors.handle(problem) // Throws the error and reports the clause that caught it.
        let clauses = [ // The three catch lines, in the order Swift tries them.
            "catch CheckoutError.outOfStock(let item)", // Clause 1.
            "catch let error as NetworkError", // Clause 2.
            "catch", // Clause 3, the catch-all.
        ]
        return DemoCard(title: "Catching specific errors", // Named after the course step.
                        caption: "Catch clauses are tried top to bottom, like switch cases: a pattern for one case, a whole error type with as, and a plain catch for everything else.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: CatchingSpecificErrors.run().lines) // One line per error.
            Divider() // Separates the program from the live version.
            Picker("Error", selection: $choice) { // Chooses the error to throw.
                ForEach(ProblemChoice.allCases, id: \.self) { Text(verbatim: $0.rawValue).tag($0) } // One segment per error.
            }
            .pickerStyle(.segmented) // Side-by-side buttons.
            if choice == .stock { // Only outOfStock carries an item.
                TextField("Item", text: $item) // The associated value.
                    .textFieldStyle(.roundedBorder) // The familiar bordered field.
            }
            if choice == .network { // Only NetworkError carries a code.
                Stepper(value: $code, in: 400...599) { CodeText("code: \(code)") } // The status code.
            }
            ForEach(clauses.indices, id: \.self) { index in // One row per clause.
                Label { // The clause, highlighted when it ran.
                    Text(verbatim: clauses[index]) // The catch line.
                        .font(.system(.footnote, design: .monospaced)) // Code-looking text.
                } icon: { // A marker showing whether this clause caught the error.
                    Image(systemName: result.clause == index + 1 ? "arrowtriangle.right.fill" : "circle") // Arrow on the matching clause.
                }
                .foregroundStyle(result.clause == index + 1 ? Color.accentColor : Color.secondary) // The matching clause stands out.
            }
            CodeText(result.message) // What that clause printed.
            Text("Move the plain catch to the top (the course's try item) and it would catch everything, so the specific clauses would never run.") // The second try item.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A note.
        }
    }
}

/// Code step "try? and try!": type a tip and compare the three styles.
private struct TryOptionalCard: View { // Shows try?, a default with ??, do/catch, and try!.
    @State private var text = "15%" // The typed tip text.

    var body: some View { // Rebuilt whenever text changes.
        let typed = try? TryQuestionAndTryBang.parseTip(text) // Int?: a value or nil.
        let caught: String = { // The same call with do/catch keeps the error itself.
            do { return "\(try TryQuestionAndTryBang.parseTip(text))" } // The parsed number.
            catch { return "caught \(error)" } // The ParseError, with the bad text inside.
        }() // Run the closure right away.
        return DemoCard(title: "try? and try!", // Named after the course step.
                        caption: "try? converts any thrown error into nil, giving an optional that pairs well with ??. try! asserts the call cannot fail and crashes if it does.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: TryQuestionAndTryBang.run().lines) // 15 0, Tip percent, Preset tip.
            Divider() // Separates the program from the live version.
            TextField("Tip text", text: $text) // What the user typed.
                .textFieldStyle(.roundedBorder) // The familiar bordered field.
                .autocorrectionDisabled() // Keep exactly what was typed.
            CodeText("try? parseTip(\"\(text)\")  // \(typed.map { "Optional(\($0))" } ?? "nil")") // Printed without ??, an optional shows as Optional(...).
            CodeText("(try? parseTip(\"\(text)\")) ?? 18  // \(typed ?? 18)") // A sensible default keeps the screen usable.
            CodeText("do { try parseTip(\"\(text)\") } catch\n// \(caught)") // do/catch keeps the reason.
            CodeText("try! parseTip(\"20\")  // \((try? TryQuestionAndTryBang.parseTip("20")) ?? 0)") // Fine: a constant we wrote.
            Text("try! on text that is not a number, such as \"twenty\", stops the whole app with \"Fatal error: 'try!' expression unexpectedly raised an error\". That is why this screen never offers it for typed text.") // The course's try item, described rather than crashed.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A note.
        }
    }
}

/// Code step "Cleaning up with defer": the printed order, and a real spinner.
private struct DeferCard: View { // The course program, a live run, and an async version with a spinner.
    @State private var online = false // The flag for the live run.
    @State private var log = Transcript() // Lines printed by the live runs.
    @State private var model = PhotoSyncModel() // The async version with a real spinner.

    var body: some View { // Rebuilt whenever state changes.
        DemoCard(title: "Cleaning up with defer", // Named after the course step.
                 caption: "A defer block runs when the scope ends, however it ends: normal return, early return, or a thrown error. No exit path can skip the cleanup.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: CleaningUpWithDefer.run().lines) // Online run, then offline run.
            Divider() // Separates the program from the live version.
            Toggle("online", isOn: $online) // The argument for the next call.
            HStack { // Run and clear.
                Button { // One call, with its own do/catch.
                    do { try CleaningUpWithDefer.syncPhotos(online: online, out: &log) } // Prints into log.
                    catch { log.print("Error:", error) } // Runs after the defer already hid the spinner.
                } label: { // The button shows the call it makes.
                    Text(verbatim: "try syncPhotos(online: \(online))") // verbatim, because a Bool cannot be localized.
                }
                .font(.system(.footnote, design: .monospaced)) // Code-looking title.
                Spacer() // Pushes Clear to the right.
                Button("Clear") { log = Transcript() } // Empties the live log.
            }
            ProgramOutput(heading: "Your runs print", lines: log.lines) // Hide spinner always follows Show spinner.
            Text("The same idea in a real screen:") // Introduces the async version.
                .font(.subheadline.bold()) // A small heading.
            Toggle("Device online", isOn: $model.online) // Flip off to take the throwing path.
            HStack { // The button and the spinner.
                Button("Sync photos") { Task { await model.sync() } } // Starts the async upload.
                    .buttonStyle(.borderedProminent) // The main action.
                    .disabled(model.isSyncing) // One sync at a time.
                if model.isSyncing { ProgressView() } // Visible only while syncing.
            }
            Text(model.status) // The outcome; the spinner is gone either way thanks to defer.
                .font(.callout) // Slightly smaller than body.
        }
    }
}

/// Code step "Result: success or failure as a value".
private struct ResultCard: View { // Look up a city and switch over the Result.
    @State private var city = "Oslo" // The city to look up.

    var body: some View { // Rebuilt whenever city changes.
        let result = ResultExample.forecast(for: city) // A value holding success or failure.
        return DemoCard(title: "Result: success or failure as a value", // Named after the course step.
                        caption: "Result<Success, Failure> is a generic enum with .success and .failure. It stores an outcome you can keep and switch over later; get() turns it back into a throwing call.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: ResultExample.run().lines) // Oslo, Atlantis, 24.
            Divider() // Separates the program from the live lookup.
            Picker("City", selection: $city) { // Chooses the city.
                ForEach(["Lisbon", "Oslo", "Atlantis"], id: \.self) { Text($0).tag($0) } // Two known cities and one imaginary one.
            }
            .pickerStyle(.segmented) // Side-by-side buttons.
            switch result { // The same two cases the course switches over.
            case .success(let high): // Binds the Int.
                CodeText("case .success(let high)  // high is \(high)") // The success branch.
            case .failure(.cityNotFound(let name)): // Nested pattern.
                CodeText("case .failure(.cityNotFound(let name))  // name is \(name)") // The failure branch.
            }
            CodeText(ResultExample.describe(city: city)) // What the course's loop prints for this city.
            CodeText("try? forecast(for: \"\(city)\").get()\n// \((try? result.get()).map { "Optional(\($0))" } ?? "nil")") // get() bridges back to throwing code.
        }
    }
}

/// Code step "Errors people can read": a sign-up form.
private struct ReadableErrorsCard: View { // Shows the developer text and the human text for the same error.
    @State private var email = "ana@example.com" // Starts with a taken email, so the first tap shows an error.
    @State private var password = "short" // Too short at first.
    @State private var outcome: String? // The message after Create account.
    @State private var developerText: String? // How print would show the same error.

    var body: some View { // Rebuilt whenever state changes.
        DemoCard(title: "Errors people can read", // Named after the course step.
                 caption: "Printing insufficientFunds(needed: 15.0) helps you, not your users. LocalizedError lets an error supply a sentence through errorDescription, which localizedDescription returns.") { // The key idea.
            CodeText("let error: any Error = SignUpError.weakPassword(minimum: 12)\nerror.localizedDescription\n// \(ErrorsPeopleCanRead.message())") // The course's program and its result.
            Divider() // Separates the program from the live form.
            TextField("Email", text: $email) // The email to register.
                .textFieldStyle(.roundedBorder) // The familiar bordered field.
                .keyboardType(.emailAddress) // The email keyboard.
                .textInputAutocapitalization(.never) // Emails are lowercase.
                .autocorrectionDisabled() // Keep exactly what was typed.
            SecureField("Password", text: $password) // Hidden while typing.
                .textFieldStyle(.roundedBorder) // The familiar bordered field.
            Text(verbatim: "Taken in this demo: ana@example.com, ben@example.com. Passwords need at least \(ErrorsPeopleCanRead.minimumPasswordLength) characters.") // verbatim, so the addresses are not turned into links.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A hint.
            Button("Create account") { // Runs the checks.
                do { // The throwing call.
                    outcome = try ErrorsPeopleCanRead.signUp(email: email, password: password) // Success text.
                    developerText = nil // No error to show.
                } catch { // Any SignUpError.
                    outcome = error.localizedDescription // The sentence users see.
                    developerText = "\(error)" // What print would show a developer.
                }
            }
            .buttonStyle(.borderedProminent) // The main action.
            if let outcome { // After the first tap.
                Label(outcome, systemImage: developerText == nil ? "checkmark.circle" : "exclamationmark.circle") // The human message.
                    .foregroundStyle(developerText == nil ? .green : .red) // Green for success, red for an error.
            }
            if let developerText { // Only when there was an error.
                CodeText("print(error)  // \(developerText)") // The developer view of the same value.
            }
        }
    }
}

#Preview { // Shows this screen in Xcode's canvas.
    NavigationStack { ErrorHandlingLesson(lesson: ContentView.lessons[5]) } // Inside a stack so the title appears.
}

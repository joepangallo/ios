// Lesson_4_8_FormsAndInput.swift
// Who: the student who opens lesson 4.8 from the home screen.
// What: the "Forms and Input" page: every control bound to state, a sign-up form
//       that reads its state back, a Picker over an enum, validation that disables
//       a button, the complete order form, and a reservation form with a DatePicker,
//       keyboard types and @FocusState.
// Where: pushed onto the app's NavigationStack by ContentView. The rules live in
//        Models/FormRules.swift. The reservation form needs a keyboard toolbar, so
//        it opens in a sheet with a NavigationStack of its own.
// When: every keystroke, switch flip and stepper tap writes @State, and SwiftUI
//       re-runs the bodies that read it.
// Why: a control is a window onto state. The right control prevents bad input
//      before it happens, and validation keeps the rest out.

import SwiftUI // Form, TextField, Toggle, Picker, Stepper, DatePicker and @FocusState.

/// Lesson 4.8: forms and input.
struct FormsAndInputLesson: View { // One screen per lesson.
    let lesson: Lesson // Number, title and summary from the home screen.

    var body: some View { // The page: one card per course step.
        LessonPage(lesson: lesson) { // Scrolling page with the summary on top.
            ControlsCard() // Concept: Controls are windows onto state.
            SignUpCard() // Code: A sign-up form.
            SizePickerCard() // Code: Choose one option with a Picker.
            CreateAccountCard() // Code: Validate input and disable the button.
            CoffeeOrderFormCard() // Code: The complete order form.
            ReservationCard() // Code: Dates, keyboards, and focus.
        }
    }
}

extension View { // A helper shared by the forms on this page.
    /// `.pickerStyle(.segmented)` or `.pickerStyle(.menu)`; each is a different type, so an if picks one.
    @ViewBuilder func pickerStyle(segmented: Bool) -> some View { // @ViewBuilder lets the branches differ.
        if segmented { pickerStyle(.segmented) } else { pickerStyle(.menu) } // One style or the other.
    }
}

// MARK: - Controls are windows onto state

/// Concept: Controls are windows onto state.
private struct ControlsCard: View { // One card.
    @State private var nickname = "" // TextField writes here.
    @State private var pin = "" // SecureField writes here.
    @State private var reminders = true // Toggle writes here.
    @State private var size = Size.medium // Picker writes here.
    @State private var people = 2 // Stepper writes here.
    @State private var volume = 0.5 // Slider writes here.

    var body: some View { // Re-runs whenever any control writes.
        DemoCard(title: "Controls are windows onto state", caption: "Every control is connected to state with a $ binding: it displays the value and writes back whatever the person enters. The control never keeps its own copy. Change any control and watch its state below.") { // The card.
            Form { // Grouped rows, like Settings.
                Section("Text") { // TextField and SecureField: free text.
                    TextField("Nickname", text: $nickname) // Visible text.
                    SecureField("PIN", text: $pin) // Hidden text, for passwords.
                }
                Section("Choices and numbers") { // The constrained controls.
                    Toggle("Reminders", isOn: $reminders) // One on-or-off choice.
                    Picker("Size", selection: $size) { // One choice from a fixed set.
                        ForEach(Size.allCases, id: \.self) { Text($0.rawValue).tag($0) } // Small, Medium, Large.
                    }
                    Stepper("People: \(people)", value: $people, in: 1...12) // A small exact count: the quiz's 1 to 12.
                    Slider(value: $volume) // An approximate value in a range (0 to 1 by default).
                }
            }
            .embeddedForm(height: 470) // Fixed height inside the page.
            ValueRow(name: "nickname", value: "\"\(nickname)\"") // What the TextField wrote.
            ValueRow(name: "pin", value: "\(pin.count) characters") // Never shown, only counted.
            ValueRow(name: "reminders", value: "\(reminders)") // What the Toggle wrote.
            ValueRow(name: "size", value: ".\(size)") // What the Picker wrote.
            ValueRow(name: "people", value: "\(people)") // What the Stepper wrote.
            ValueRow(name: "volume", value: String(format: "%.2f", volume)) // What the Slider wrote.
            Text("Pick the control that fits the data: a Stepper cannot produce \"two-ish\", and a Picker cannot select a size that does not exist.") // The callout.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - A sign-up form

/// The course's SignUpView, with challenge 3's Name field added.
struct SignUpView: View { // `struct SignUpView: View`
    var secureEmail = false // Challenge 2: the email field as a SecureField.
    @State private var name = "" // Challenge 3: `TextField("Name", text: $name)` needs this.
    @State private var email = "" // Written by the email field.
    @State private var password = "" // Written by the password field.
    @State private var wantsTips = false // Written by the switch.

    var body: some View { // Re-runs on every keystroke.
        Form { // Grouped rows.
            TextField("Name", text: $name) // Challenge 3.
            if secureEmail { // Challenge 2.
                SecureField("Email", text: $email) // Hidden on screen; the summary still shows it.
            } else { // The course's field.
                TextField("Email", text: $email) // Visible text.
                    .textInputAutocapitalization(.never) // Emails are lowercase.
                    .autocorrectionDisabled() // Autocorrect would "fix" addresses.
            }
            SecureField("Password", text: $password) // Hides what is typed.
            Toggle("Weekly tips by email", isOn: $wantsTips) // On or off.
            Section("What your state holds") { // Reads the same state back.
                ForEach(SignUpSummary.lines(email: email, password: password, wantsTips: wantsTips, name: name), id: \.self) { Text($0) } // One row per line of the summary.
            }
        }
    }
}

/// Code: A sign-up form.
private struct SignUpCard: View { // One card.
    @State private var secureEmail = false // Challenge 2.

    var body: some View { // Redraws when the challenge changes.
        DemoCard(title: "A sign-up form", caption: "Two text fields and a switch. The bottom section reads the same state back: each keystroke writes into @State and SwiftUI recomputes body. Type and watch it change.") { // The card.
            SignUpView(secureEmail: secureEmail) // The live form.
                .embeddedForm(height: 520) // Fixed height inside the page.
            Toggle("Email as a SecureField", isOn: $secureEmail) // Challenge 2: dots on screen, same summary.
        }
    }
}

// MARK: - Choose one option with a Picker

/// The course's SizePickerView, with the challenges as inputs.
struct SizePickerView: View { // `struct SizePickerView: View`
    var segmented = true // Challenge 1: .segmented or .menu.
    @State private var size: Size // The selection; always one of the enum's cases.

    /// Challenge 3 changes the default to Size.small.
    init(segmented: Bool = true, startsSmall: Bool = false) { // Defaults match the course.
        self.segmented = segmented // Store the input.
        _size = State(initialValue: startsSmall ? .small : .medium) // `@State private var size = Size.medium`
    }

    var body: some View { // Re-runs when size changes.
        Form { // Grouped rows.
            Picker("Size", selection: $size) { // Bound to a Size value.
                ForEach(Size.allCases, id: \.self) { option in // One option per case.
                    Text(option.rawValue).tag(option) // The tag is the value the option stands for.
                }
            }
            .pickerStyle(segmented: segmented) // Side by side, or a pop-up menu row.
            Text(size.sentence) // `Text("You picked \(size.rawValue).")`
        }
    }
}

/// Code: Choose one option with a Picker.
private struct SizePickerCard: View { // One card.
    @State private var segmented = true // Challenge 1.
    @State private var startsSmall = false // Challenge 3.

    var body: some View { // Redraws when a challenge changes.
        DemoCard(title: "Choose one option with a Picker", caption: "An enum lists the options, so an invalid size cannot exist. The Picker is bound to a Size value, and each option is tagged with the value it stands for.") { // The card.
            SizePickerView(segmented: segmented, startsSmall: startsSmall) // The live form.
                .id(startsSmall) // A new identity when the default changes, so @State starts over.
                .embeddedForm(height: 150) // Fixed height inside the page.
            Toggle(".pickerStyle(.segmented) (off: .menu)", isOn: $segmented) // Challenge 1.
            Toggle("Default to Size.small", isOn: $startsSmall) // Challenge 3.
            Text("Challenge 2 adds a case to the enum; the Picker grows with no other change, because it loops over Size.allCases.") // Challenge 2, explained.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - Validate input and disable the button

/// The course's CreateAccountView, with the challenges as inputs.
struct CreateAccountView: View { // `struct CreateAccountView: View`
    var minimum = 8 // Challenge 2: 12.
    var strict = false // Challenge 3: tighten isValid.
    @State private var email = "" // Written by the email field.
    @State private var password = "" // Written by the password field.
    @State private var created = false // Shows a confirmation after the tap (nothing is sent).

    var isValid: Bool { AccountRules.isValid(email: email, password: password, minimum: minimum, strict: strict) } // `email.contains("@") && password.count >= 8`

    var body: some View { // Re-runs on every keystroke.
        Form { // Grouped rows.
            TextField("Email", text: $email) // Free text.
                .textInputAutocapitalization(.never) // Emails are lowercase.
                .autocorrectionDisabled() // No autocorrect.
            SecureField("Password (\(minimum)+ characters)", text: $password) // Hidden text.
            if let hint = AccountRules.hint(password: password, minimum: minimum) { // Only while too short.
                Text(hint) // "6 more characters needed".
                    .foregroundStyle(.red) // A polite warning.
            }
            Button("Create account") { created = true } // The course's action is empty; here it confirms.
                .disabled(!isValid) // Grayed out until the rules pass.
            if created && isValid { // After a tap.
                Text("Account created (simulated; nothing is sent).") // Feedback.
                    .foregroundStyle(.green) // Success.
            }
        }
        .onChange(of: email) { created = false } // Editing clears the old confirmation.
        .onChange(of: password) { created = false } // Same.
    }
}

/// Code: Validate input and disable the button.
private struct CreateAccountCard: View { // One card.
    @State private var twelve = false // Challenge 2.
    @State private var strict = false // Challenge 3.

    var body: some View { // Redraws when a challenge changes.
        DemoCard(title: "Validate input and disable the button", caption: "A computed isValid decides whether the form is ready, .disabled(!isValid) grays out the button until it is, and a hint appears only while the password is too short.") { // The card.
            CreateAccountView(minimum: twelve ? 12 : 8, strict: strict) // The live form.
                .embeddedForm(height: 250) // Fixed height; the Form scrolls if the hint and confirmation both show.
            Toggle("Require 12 characters", isOn: $twelve) // Challenge 2: both isValid and the hint change.
            Toggle("Tighter email check", isOn: $strict) // Challenge 3: " @" no longer passes.
            Text("Try \" @\" (a space and an at sign) as the email with a long password: it passes the course's rule, and fails the tighter one.") // Challenge 3, explained.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - The complete order form

/// The course's CoffeeOrderView, with the challenges as inputs.
struct CoffeeOrderView: View { // `struct CoffeeOrderView: View`
    var withExtras = false // Challenges 1 and 2: an oat milk switch and a drink menu.
    var maxShots = 4 // Challenge 3: 1...6.
    var ignoreBlankNames = false // The quiz: a single space should not count as a name.
    @State private var shots = 2 // Written by the stepper.
    @State private var name = "" // Written by the text field.
    @State private var oatMilk = false // Challenge 1.
    @State private var drink = "Latte" // Challenge 2.

    var total: Double { OrderFormRules.total(shots: shots, oatMilk: oatMilk) } // `3.0 + Double(shots) * 0.75`, plus oat milk.

    var body: some View { // Re-runs on every change.
        Form { // Two sections.
            Section("Drink") { // What to make.
                if withExtras { // Challenge 2.
                    Picker("Drink", selection: $drink) { // A menu of three drinks.
                        ForEach(OrderFormRules.drinks, id: \.self) { Text($0).tag($0) } // Latte, Mocha, Cold Brew.
                    }
                    .pickerStyle(.menu) // A pop-up.
                }
                Stepper("Shots: \(shots)", value: $shots, in: 1...maxShots) // A small exact count.
                if withExtras { // Challenge 1.
                    Toggle("Oat milk", isOn: $oatMilk) // Adds 0.60 to the total.
                }
            }
            Section("Pickup") { // Who it is for.
                TextField("Name for the cup", text: $name) // Free text.
                Button(OrderFormRules.payTitle(total: total)) { } // "Pay $4.50": derived from state, so always right.
                    .disabled(!OrderFormRules.canPay(name: name, ignoringSpaces: ignoreBlankNames)) // `.disabled(name.isEmpty)`
            }
        }
        .onChange(of: maxShots) { shots = min(shots, maxShots) } // Keep shots inside a shrinking range.
    }
}

/// Code: The complete order form.
private struct CoffeeOrderFormCard: View { // One card.
    @State private var withExtras = false // Challenges 1 and 2.
    @State private var sixShots = false // Challenge 3.
    @State private var ignoreBlankNames = false // The quiz's fix.

    var body: some View { // Redraws when a challenge changes.
        DemoCard(title: "The complete order form", caption: "Sections, a stepper, a text field, a derived price, and a button that stays disabled until the cup has a name. Change the shots and type a name.") { // The card.
            CoffeeOrderView(withExtras: withExtras, maxShots: sixShots ? 6 : 4, ignoreBlankNames: ignoreBlankNames) // The live form.
                .embeddedForm(height: withExtras ? 360 : 270) // Taller when the extra rows are on.
            Toggle("Oat milk switch and a drink menu", isOn: $withExtras) // Challenges 1 and 2.
            Toggle("Stepper range 1...6", isOn: $sixShots) // Challenge 3.
            Toggle("Ignore a name of only spaces", isOn: $ignoreBlankNames) // The quiz: .disabled(name.isEmpty) lets " " through.
        }
    }
}

// MARK: - Dates, keyboards, and focus

/// The course's ReservationView, with the challenges as inputs.
struct ReservationView: View { // `struct ReservationView: View`
    enum Field { case email } // The fields that can hold focus.
    var withTime = false // Challenge 2: [.date, .hourAndMinute].
    var numberPad = false // Challenge 1: .numberPad instead of .emailAddress.
    @State private var date = Date() // Written by the DatePicker.
    @State private var email = "" // Written by the text field.
    @FocusState private var focus: Field? // Which field has the cursor; nil means none.

    var body: some View { // Re-runs on every change.
        Form { // Grouped rows.
            DatePicker("Arrival", selection: $date, // Binds to a Date...
                       displayedComponents: withTime ? [.date, .hourAndMinute] : .date) // ...showing the date, or date and time.
            TextField("Email", text: $email) // Free text.
                .keyboardType(numberPad ? .numberPad : .emailAddress) // Which keyboard iOS shows.
                .textContentType(.emailAddress) // Lets iOS offer autofill.
                .textInputAutocapitalization(.never) // Emails are lowercase.
                .focused($focus, equals: .email) // Ties this field to focus == .email.
            Button("Add email") { focus = .email } // Moves the cursor into the field.
            Section("What your state holds") { // Reads the state back.
                Text("Arrival: \(date.formatted(date: .abbreviated, time: withTime ? .shortened : .omitted))") // The chosen date.
                Text("Email: \(email)") // The typed text.
                Text("focus: \(focus == .email ? ".email" : "nil")") // Where the cursor is.
            }
        }
        .toolbar { // The keyboard's own toolbar (needs a NavigationStack above).
            ToolbarItemGroup(placement: .keyboard) { // Shown above the keyboard.
                Spacer() // Pushes Done to the trailing edge.
                Button("Done") { focus = nil } // Clearing focus hides the keyboard; the number pad has no return key.
            }
        }
    }
}

/// Code: Dates, keyboards, and focus.
private struct ReservationCard: View { // One card.
    @State private var showing = false // Whether the sheet is open.
    @State private var withTime = false // Challenge 2.
    @State private var numberPad = false // Challenge 1.

    var body: some View { // Redraws when a choice changes.
        DemoCard(title: "Dates, keyboards, and focus", caption: "A DatePicker binds to a Date. .keyboardType and .textContentType tell iOS which keyboard to show and to offer autofill. @FocusState lets a button move the cursor into a field. It opens in a sheet with its own NavigationStack, which the keyboard's Done button needs.") { // The card.
            Toggle("Show date and time", isOn: $withTime) // Challenge 2.
            Toggle(".keyboardType(.numberPad)", isOn: $numberPad) // Challenge 1: predict the keyboard first.
            Button("Open ReservationView") { showing = true } // Presents the sheet.
                .buttonStyle(.borderedProminent) // The main action.
        }
        .sheet(isPresented: $showing) { // The form on top of the page.
            ClosableDemo(title: "ReservationView") { // A Close bar above the demo.
                NavigationStack { // Needed for the keyboard toolbar and the title.
                    ReservationView(withTime: withTime, numberPad: numberPad) // The course's view.
                        .navigationTitle("Reservation") // Sheet title.
                        .navigationBarTitleDisplayMode(.inline) // Small title.
                }
            }
        }
    }
}

// Lesson_5_10_ProcessCritique.swift
// Who: the home screen opens this when the student taps 5.10.
// What: process, prototypes and critique, live: the design loop, a user story
//       and acceptance criterion with a checker for untestable words, the
//       course's gray wireframe next to a working prototype of the same screen,
//       the "five users" curve with a task-wording checker, an invoices screen
//       to critique by tapping its parts, and the critique applied in code.
// Where: the Lessons folder; the course's example views sit below the lesson.
// When: SwiftUI builds it when lesson 5.10 is pushed onto the home screen's stack.
// Why: you can change a sketch in seconds, a prototype in minutes and shipped
//      code in days, so the module ends by practicing the cheap steps.

import SwiftUI // SwiftUI views.
import UIKit // UIColor.tertiaryLabel, measured for the critique's evidence.

struct ProcessCritiqueLesson: View { // The screen for lesson 5.10.
    let lesson: Lesson // The number, title and summary from the home screen.
    @State private var stage = DesignStage.understand // The current stage of the loop.
    @State private var story = UserStory.nurse // The editable user story.
    @State private var criterion = AcceptanceCriterion.swap // The editable acceptance criterion.
    @State private var requirement = "The swap flow should feel fast and intuitive to every nurse on the team" // A requirement to check.
    @State private var oneHanded = true // Persona: uses the phone one-handed.
    @State private var gloves = true // Persona: often wears gloves.
    @State private var hurried = true // Persona: always in a hurry.
    @State private var prototype = Version.before // before = wireframe, after = working prototype.
    @State private var spacerAbove = false // Try it: Spacer above the card.
    @State private var shortCard = false // Try it: card height 60.
    @State private var users = 5.0 // Testers per round.
    @State private var task = "Tap the Swap button" // A usability task to check.
    @State private var invoiceRow = Version.before // Flawed or fixed invoice row.

    var body: some View { // Rebuilt whenever a control changes.
        LessonPage(lesson: lesson) { // The shared scrolling page layout.
            DemoCard(title: "Design is a loop, not a step", caption: "Understand, sketch, build something people can try, watch them use it, and go around again.") { // Concept step 1.
                HStack(spacing: 6) { // The four stages in a row.
                    ForEach(DesignStage.allCases) { item in // One capsule per stage.
                        Text(item.rawValue) // The stage's name.
                            .font(.caption.weight(item == stage ? .bold : .regular)) // Bold when current.
                            .padding(.horizontal, 8).padding(.vertical, 6) // Room inside the capsule.
                            .background(item == stage ? AnyShapeStyle(.tint.opacity(0.2)) : AnyShapeStyle(.fill.tertiary), in: .capsule) // Tinted when current.
                            .accessibilityAddTraits(item == stage ? .isSelected : []) // VoiceOver hears "selected".
                    }
                }
                Text(stage.summary).font(.subheadline) // What happens in this stage.
                Button("Next stage", systemImage: "arrow.triangle.2.circlepath") { stage = stage.next } // Around the loop.
                    .buttonStyle(.bordered) // Secondary.
                ConceptPoints(points: [ // The step's five terms.
                    ("Requirements", "What the app must do, for whom, and how you will know it works, written so someone can check it."), // Requirements.
                    ("Persona", "A short, research-based portrait of a typical user: goals, context and frustrations."), // Persona.
                    ("User flow", "The path through screens to finish one task, including the error and empty branches."), // Flow.
                    ("Wireframe and prototype", "A wireframe is a low-detail layout of boxes and labels; a prototype is something people can tap."), // Wireframe.
                    ("Usability test", "Watching representative people try real tasks with your prototype, then fixing whatever trips them up."), // Test.
                    ("Cheap before expensive", "Change a sketch in seconds, a prototype in minutes, shipped code in days. Find problems early."), // The callout.
                ])
            }

            DemoCard(title: "Requirements you can design from", caption: "A requirement helps only if a designer can act on it and a tester can check it.") { // Concept step 2.
                Text("User story").font(.subheadline.weight(.semibold)) // A small heading.
                labeledField("As a", $story.role) // Who.
                labeledField("I want", $story.want) // What.
                labeledField("so that", $story.benefit) // Why.
                Text(story.sentence).font(.callout.italic()) // The story as a sentence.
                Text("Acceptance criterion").font(.subheadline.weight(.semibold)) // A small heading.
                labeledField("Given", $criterion.given) // The situation.
                labeledField("when", $criterion.when) // The action.
                labeledField("then", $criterion.then) // The observable result.
                Text(criterion.sentence).font(.callout.italic()) // The criterion as a sentence.
                checkLine(criterion.sentence) // Can a tester check it?
                Text("Check any requirement").font(.subheadline.weight(.semibold)) // A small heading.
                TextField("Requirement", text: $requirement, axis: .vertical).textFieldStyle(.roundedBorder) // Free text.
                checkLine(requirement) // The verdict.
                Text("The persona shapes the screen:").font(.subheadline.weight(.semibold)) // A small heading.
                Toggle("Uses the app one-handed", isOn: $oneHanded) // Persona trait 1.
                Toggle("Often wears gloves", isOn: $gloves) // Persona trait 2.
                Toggle("Always in a hurry", isOn: $hurried) // Persona trait 3.
                ConsoleView(lines: designRequirements) // The design requirements that follow.
                ConceptPoints(points: [ // The step's terms and callout.
                    ("Functional requirement", "What the app does: swap a shift, notify a manager."), // Functional.
                    ("Design requirement", "How well it must work, in numbers: controls at least 44 x 44 pt, text contrast at least 4.5:1, usable with VoiceOver and at the largest text size."), // Design.
                    ("Personas come from research", "Base them on interviews or observation of real users, not on a meeting's assumptions."), // The warning.
                ])
            }

            DemoCard(title: "A wireframe you can run", caption: "The course's ShiftWireframe: gray placeholders keep feedback on structure. Flip to Prototype for the same layout with real data and a working Swap button.") { // Code step.
                BeforeAfterPicker(version: $prototype, beforeLabel: "Wireframe", afterLabel: "Prototype") // Flip fidelity.
                PreviewSurface { // A piece of screen.
                    Group { // Either fidelity.
                        if prototype == .before { // The course's wireframe.
                            ShiftWireframe(spacerAboveCard: spacerAbove, cardHeight: shortCard ? 60 : 120) // With its try-its.
                        } else { // A prototype people can tap.
                            ShiftPrototype() // Real data, the acceptance criterion in action.
                        }
                    }
                    .frame(height: 470) // A phone-like height so the Spacer has room to work.
                }
                Toggle("Try it: move Spacer() above the card", isOn: $spacerAbove) // Which layout suits one hand?
                Toggle("Try it: card height 60", isOn: $shortCard) // Is the next shift still most important?
                Text(spacerAbove ? "With the Spacer above, the content sinks toward the thumb, but the title and next shift lose their place at the top." : "The Spacer keeps the primary action at the bottom, within thumb reach for a one-handed nurse.") // Explains the state.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }

            DemoCard(title: "Test with a few people, then iterate", caption: "Give a representative person a realistic task, ask them to think aloud, and watch. Every hesitation is data.") { // Concept step 3.
                Stepper("Testers this round: \(Int(users))", value: $users, in: 1...15) // How many people.
                FiveUsersChart(users: Int(users)) // The diminishing-returns curve.
                Text("If each person finds about 31 percent of the problems (a classic usability-research average), \(Int(users)) people find about \(Int((UsabilityMath.shareFound(users: Int(users)) * 100).rounded())) percent. Several small rounds, with fixes in between, beat one big study.") // The arithmetic.
                    .font(.footnote) // A caption.
                Text("Is your task a goal or an instruction?").font(.subheadline.weight(.semibold)) // A small heading.
                TextField("Task", text: $task).textFieldStyle(.roundedBorder) // The task to check.
                let leaks = TaskWording.leaks(in: task) // Words that give the answer away.
                Label(leaks.isEmpty ? "A goal: it does not name the interface." : "Gives the answer away: \(leaks.joined(separator: ", ")). Try \"Swap your Friday shift.\"", systemImage: leaks.isEmpty ? "checkmark.circle" : "exclamationmark.triangle") // The verdict.
                    .font(.footnote) // Compact.
                ConceptPoints(points: [ // The step's four points.
                    ("A task, not an instruction", "Say \"Swap your Friday shift,\" not \"Tap the Swap button.\""), // Tasks.
                    ("What to measure", "Task success, time on task, errors, and where people hesitate or backtrack."), // Measures.
                    ("Test the edges", "Include a session at the largest text size, one with VoiceOver, and one on a real device in bright light."), // Edges.
                    ("TestFlight", "Apple's beta-testing service, which delivers test builds of your app to testers' devices before release."), // TestFlight.
                ])
            }

            DemoCard(title: "Spot the problems", caption: "This invoices screen breaks eight guidelines from this module. Tap anything on it to inspect it; some parts are fine. Then switch to After.") { // Widget step.
                CritiqueBoard() // The interactive critique.
            }

            DemoCard(title: "The critique, in code", caption: "One invoice row before and after: a text style, readable color, a symbol and a word, and a labeled 44 pt button.") { // Compare step.
                BeforeAfterPicker(version: $invoiceRow, beforeLabel: "Four violations", afterLabel: "Every fix applied") // Flip the version.
                PreviewSurface(minHeight: 60) { // A piece of screen.
                    if invoiceRow == .before { PoorInvoiceRow() } else { BetterInvoiceRow() } // The two versions.
                }
                ConsoleView(lines: evidence) // The evidence for each finding.
                VerdictBox(text: "None of the four fixes changes what the row does; all of them change who can use it. Name the guideline, show the evidence, and propose a specific, standard fix.") // The verdict.
            }
        }
    }

    /// A text field with its blank's name always visible on the leading side.
    private func labeledField(_ label: String, _ text: Binding<String>) -> some View { // Used for the story and the criterion.
        HStack { // Name, then field.
            Text(label).font(.subheadline.italic()).frame(width: 64, alignment: .leading) // "As a", "Given"...
            TextField(label, text: text, axis: .vertical).textFieldStyle(.roundedBorder) // The editable blank; wraps instead of truncating.
        }
    }

    /// A pass or fail line for a requirement's wording.
    private func checkLine(_ text: String) -> some View { // Shared by two fields.
        let vague = RequirementCheck.vagueWords(in: text) // Opinion words.
        return Label(vague.isEmpty ? "Checkable: no opinion words." : "Not checkable yet: \(vague.joined(separator: ", ")). Turn opinions into numbers, such as \"in under a minute\".", systemImage: vague.isEmpty ? "checkmark.circle" : "exclamationmark.triangle") // Shape plus words.
            .font(.footnote) // Compact.
    }

    /// The design requirements that follow from the persona switches.
    private var designRequirements: [String] { // Printed in a ConsoleView.
        var lines: [String] = [] // Collected requirements.
        if oneHanded { lines.append("Primary action at the bottom, within thumb reach.") } // One hand.
        if gloves { lines.append("Hit areas at least 44 x 44 pt, larger for the main action.") } // Gloves.
        if hurried { lines.append("Status readable at a glance: a symbol and a word, contrast 4.5:1 or more.") } // Hurry.
        lines.append("Usable with VoiceOver and at the largest text size.") // Always.
        return lines // The list.
    }

    /// The evidence for the four violations, or for their fixes.
    private var evidence: [String] { // Measured where possible.
        if invoiceRow == .before { // The flawed row.
            let tertiary = Contrast.ratio(of: .tertiaryLabel, on: .systemBackground, in: .light) // Measured from the system color.
            return ["Name: .system(size: 11), 11 pt at every text size (body: \(Int(TypeScale.pointSize(of: .body, at: .large))) pt, \(Int(TypeScale.pointSize(of: .body, at: .accessibility5))) at AX5)", // Typography.
                    "Name color: .tertiary, \(Contrast.label(tertiary)):1 on white (needs 4.5:1)", // Color contrast.
                    "Status: a 9 pt red dot, color only, nothing for VoiceOver", // Color alone.
                    "Edit: a pencil glyph under 20 pt with onTapGesture, no button trait"] // Touch target.
        }
        let primary = Contrast.ratio(of: .label, on: .systemBackground, in: .light) // The fixed name color.
        return ["Name: .body, \(Int(TypeScale.pointSize(of: .body, at: .large))) pt now, grows with Dynamic Type", // Typography.
                "Name color: primary, \(Contrast.label(primary)):1 on white", // Contrast.
                "Status: Label(\"Overdue\", systemImage: \"exclamationmark.triangle\")", // Shape and word.
                "Edit: Button, 44 x 44 pt, accessibilityLabel(\"Edit Invoice\")"] // Target and name.
    }
}

/// Bars for 1 to 15 testers, highlighting the chosen number.
struct FiveUsersChart: View { // The diminishing-returns curve.
    let users: Int // The chosen number of testers.

    var body: some View { // Fifteen bars.
        HStack(alignment: .bottom, spacing: 3) { // Side by side, bottom-aligned.
            ForEach(1...15, id: \.self) { n in // One bar per team size.
                RoundedRectangle(cornerRadius: 2) // A bar.
                    .fill(n == users ? AnyShapeStyle(.tint) : AnyShapeStyle(.fill.secondary)) // The chosen one in the accent color.
                    .frame(height: 80 * UsabilityMath.shareFound(users: n)) // Height = share of problems found.
            }
        }
        .frame(height: 80) // The chart's height.
        .accessibilityElement() // One element for VoiceOver...
        .accessibilityLabel("Share of problems found rises quickly, then levels off after about five testers") // ...described in words.
    }
}

/// The nurse's prototype: the wireframe's layout with real data and a working swap.
struct ShiftPrototype: View { // Built on the tested ShiftBoard model.
    @State private var board = ShiftBoard.sample // Three upcoming shifts.
    @State private var choosing = false // The "which shift?" dialog.

    var body: some View { // Same structure as the wireframe.
        VStack(alignment: .leading, spacing: 16) { // Title, next shift, rows, action.
            Text("Shifts").font(.largeTitle).bold() // The title.
            if let next = board.nextShift { // The most important thing on the screen.
                VStack(alignment: .leading, spacing: 4) { // The next-shift card.
                    Text("Next shift").font(.caption).foregroundStyle(.secondary) // The card's label.
                    Text("\(next.day), \(next.time)").font(.title3.bold()) // When.
                    statusLabel(next.status) // Its status, in words and a symbol.
                }
                .padding() // Room inside.
                .frame(maxWidth: .infinity, minHeight: 100, alignment: .leading) // Full width.
                .background(.fill.tertiary, in: .rect(cornerRadius: 12)) // A solid card.
            }
            ForEach(board.shifts.dropFirst()) { shift in // The later shifts.
                HStack { // One row.
                    Text("\(shift.day), \(shift.time)") // When.
                    Spacer() // Status to the right.
                    statusLabel(shift.status) // Status.
                }
                .frame(minHeight: 44) // A full-size row.
            }
            if !board.managerInbox.isEmpty { // After a request.
                Label(board.managerInbox.last ?? "", systemImage: "bell.badge") // Proof the manager was notified.
                    .font(.footnote) // Compact.
                    .foregroundStyle(.secondary) // Quieter.
            }
            Spacer() // Pushes the action down, into thumb reach.
            Button("Swap a Shift") { choosing = true } // The primary action.
                .buttonStyle(.borderedProminent) // Prominent.
                .controlSize(.large) // A generous target.
                .frame(maxWidth: .infinity) // Centered.
                .confirmationDialog("Which shift?", isPresented: $choosing, titleVisibility: .visible) { // Pick a shift.
                    ForEach(board.shifts.filter { $0.status == .scheduled }) { shift in // Only scheduled shifts.
                        Button("\(shift.day), \(shift.time)") { board.requestSwap(shiftID: shift.id) } // Request the swap.
                    }
                    if board.shifts.allSatisfy({ $0.status == .pending }) { // Nothing left to swap.
                        Button("Reset the Prototype") { board = .sample } // Start over.
                    }
                }
        }
        .padding() // Standard margins.
    }

    /// A status with a symbol and a word.
    private func statusLabel(_ status: Shift.Status) -> some View { // Never color alone.
        Label { // The word stays in a readable text color...
            Text(status.rawValue) // "Scheduled" or "Pending".
        } icon: { // ...and only the symbol carries color.
            Image(systemName: status == .pending ? "clock" : "checkmark.circle").foregroundStyle(status == .pending ? .orange : .secondary) // Color only reinforces.
        }
        .font(.subheadline) // Readable.
    }
}

/// The invoices screen to critique, before or after, with tappable parts.
struct CritiqueBoard: View { // From the course's "Spot the problems" widget.
    @State private var session = CritiqueSession() // Problems found so far.
    @State private var version = Version.before // The flawed or the fixed screen.
    @State private var inspected: String? // The part being inspected.
    @State private var showHint = false // Whether the hint is visible.

    /// Every part of the screen, for the accessible "Inspect a part" menu.
    private let partIDs = ["icon", "title", "glass", "align", "margins", "color", "fixed", "contrast", "targets", "primary", "tabbar"] // In screen order.
    private let partNames = ["Top-right button", "Screen title", "Summary card", "Section header", "Invoice rows", "Row status", "Row title and amount", "Row due date", "Row action buttons", "New Invoice button", "Tab bar"] // The same order.

    var body: some View { // Rebuilt after every inspection.
        VStack(alignment: .leading, spacing: 10) { // Controls, screen, inspector.
            BeforeAfterPicker(version: $version, beforeLabel: "Before", afterLabel: "After") // Flip the screen.
            HStack { // Score and actions.
                Text("Found \(session.score) of 8").font(.headline.monospacedDigit()) // The score.
                Spacer() // Push the buttons right.
                Button("Hint") { showHint = true }.disabled(session.nextHint == nil) // A nudge.
                Button("Reset") { session.reset(); inspected = nil; showHint = false } // Start over.
            }
            .buttonStyle(.bordered) // Real buttons.
            if showHint, let hint = session.nextHint { Text("Hint: \(hint)").font(.footnote).foregroundStyle(.secondary) } // The hint.
            InvoicesScreen(fixed: version == .after, selected: inspected) { inspect($0) } // The screen itself.
            Menu("Inspect a part") { // The same parts, as a list.
                ForEach(partIDs.indices, id: \.self) { i in Button(partNames[i]) { inspect(partIDs[i]) } } // One item per part.
            }
            inspector // What the inspected part shows.
        }
    }

    /// Records an inspection.
    private func inspect(_ id: String) { // Called by taps and by the menu.
        inspected = id // Show its notes.
        _ = session.inspect(id) // Count it if it is a problem.
        showHint = false // The hint was for the previous search.
    }

    /// The notes for the inspected part.
    @ViewBuilder private var inspector: some View { // Nothing, a problem, or a fine part.
        if let id = inspected { // Something was tapped.
            if let problem = CritiqueSession.problems.first(where: { $0.id == id }) { // A planted problem.
                VStack(alignment: .leading, spacing: 4) { // Name, what, fix.
                    Label("\(problem.topic): \(problem.name)", systemImage: version == .before ? "exclamationmark.triangle.fill" : "checkmark.seal.fill") // The finding.
                        .font(.subheadline.weight(.semibold)) // Stands out.
                    Text(version == .before ? problem.what : "Fixed: \(problem.fix)").font(.footnote) // What is wrong, or how it was fixed.
                    if version == .before { Text("Fix: \(problem.fix)").font(.footnote).foregroundStyle(.secondary) } // The standard fix.
                }
            } else if let note = CritiqueSession.fine[id] { // A part that is fine.
                Label(note, systemImage: "hand.thumbsup").font(.footnote) // Say so.
            }
        }
    }
}

/// The invoices screen, drawn flawed or fixed. Each part reports taps by id.
struct InvoicesScreen: View { // The screen behind the critique.
    let fixed: Bool // false: the eight problems; true: every fix applied.
    let selected: String? // The part to outline.
    let onInspect: (String) -> Void // Called with a part's id.

    private let rows = [ // The widget's three invoices.
        InvoiceSample(client: "Northwind Studio", amount: "$1,200", due: "Oct 12", status: .paid), // Paid.
        InvoiceSample(client: "Bluebird Bakery", amount: "$860", due: "Oct 3", status: .overdue), // Overdue.
        InvoiceSample(client: "Atlas Fitness", amount: "$2,760", due: "Oct 28", status: .dueSoon), // Due soon.
    ]

    var body: some View { // The whole screen.
        VStack(alignment: .leading, spacing: 10) { // Top to bottom.
            HStack { // The top bar.
                Spacer() // Push the button right.
                Group { // The mystery button, or its fix.
                    if fixed { Text("Remind All").font(.subheadline.weight(.semibold)).padding(.horizontal, 12).frame(minHeight: 36).glassEffect() } // Words, on toolbar glass.
                    else { Image(systemName: "wand.and.stars").font(.caption).padding(6).glassEffect() } // A mystery symbol.
                }
                .part("icon", selected, onInspect) // Inspectable.
            }
            Text("Invoices").font(.largeTitle.bold()).part("title", selected, onInspect) // The title: fine.
            summaryCard.part("glass", selected, onInspect) // The summary card.
            Text(fixed ? "Recent" : "RECENT") // The section header.
                .font(fixed ? .subheadline.weight(.semibold) : .caption) // A header style, or tiny capitals.
                .foregroundStyle(.secondary) // Quieter.
                .padding(.leading, fixed ? 0 : 28) // Misaligned before: a second left edge.
                .part("align", selected, onInspect) // Inspectable.
            VStack(spacing: 0) { // The rows.
                ForEach(rows) { invoice in // One row per invoice.
                    row(invoice) // Flawed or fixed.
                    Divider() // Separator.
                }
            }
            .padding(.horizontal, fixed ? 0 : -12) // Before: rows run almost to the screen edge.
            .part("margins", selected, onInspect) // Tapping the row background inspects the margins.
            Button("New Invoice") { onInspect("primary") } // The primary action: fine.
                .buttonStyle(.borderedProminent) // Prominent.
                .controlSize(.large) // Generous.
                .frame(maxWidth: .infinity) // Centered.
                .part("primary", selected, onInspect) // Outlined when selected.
            HStack { // A floating tab bar: fine.
                Label("Invoices", systemImage: "doc.text").frame(maxWidth: .infinity) // Section one: symbol and word.
                Label("Clients", systemImage: "person.2").frame(maxWidth: .infinity) // Section two.
                Label("Settings", systemImage: "gearshape").frame(maxWidth: .infinity) // Section three.
            }
            .font(.caption2) // Compact tab labels.
            .padding(.vertical, 10) // Room inside the bar.
            .glassEffect() // Navigation layer: glass belongs here.
            .part("tabbar", selected, onInspect) // Inspectable.
        }
        .padding(16) // The screen margins.
        .background(Color(.systemBackground), in: .rect(cornerRadius: 20)) // The screen.
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(.separator)) // Its edge.
    }

    /// The summary card: glass on glass before, solid content after.
    @ViewBuilder private var summaryCard: some View { // Two versions.
        if fixed { // Content on a solid background.
            VStack(alignment: .leading, spacing: 8) { // Numbers, then one action.
                Text("3 open · $4,820 due").font(.headline) // The summary.
                Button("Export") { onInspect("glass") }.buttonStyle(.bordered) // A standard button, not glass.
            }
            .padding() // Room inside.
            .frame(maxWidth: .infinity, alignment: .leading) // Full width.
            .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 14)) // Solid.
        } else { // Glass over a decorative image, with glass buttons inside.
            ZStack { // Image behind, glass in front.
                PhotoBackdrop() // The decorative image.
                VStack(alignment: .leading, spacing: 8) { // Content on glass.
                    Text("3 open · $4,820 due").font(.headline) // The summary, on glass.
                    HStack { // Two glass buttons inside glass.
                        Button("Remind") { onInspect("glass") }.buttonStyle(.glass) // Glass on glass.
                        Button("Export") { onInspect("glass") }.buttonStyle(.glass) // Glass on glass.
                    }
                }
                .padding() // Room inside.
                .glassEffect(.regular, in: .rect(cornerRadius: 14)) // The card itself is glass.
                .padding(10) // Image around the edges.
            }
            .frame(height: 130) // A fixed height.
            .clipShape(.rect(cornerRadius: 14)) // Rounded.
        }
    }

    /// One invoice row, flawed or fixed.
    @ViewBuilder private func row(_ invoice: InvoiceSample) -> some View { // Two versions.
        if fixed { // Every fix applied.
            HStack { // Name and due date, status, actions.
                VStack(alignment: .leading, spacing: 2) { // Name over due date.
                    Text("\(invoice.client) · \(invoice.amount)").font(.body).part("fixed", selected, onInspect) // A text style.
                    Text("Due \(invoice.due)").font(.subheadline).foregroundStyle(Color("DueDateGray")).part("contrast", selected, onInspect) // The asset color that passes 4.5:1.
                }
                Spacer() // Push status and button right.
                Label { Text(invoice.status.word) } icon: { Image(systemName: invoice.status.symbol).foregroundStyle(invoice.status.color) } // A word in readable text, a colored symbol.
                    .font(.caption).part("color", selected, onInspect) // Symbol and word, inspectable.
                Button { onInspect("targets") } label: { Image(systemName: "ellipsis").frame(width: 44, height: 44) } // One More button, 44 pt.
                    .accessibilityLabel("More actions for \(invoice.client)") // Named.
                    .part("targets", selected, onInspect) // Outlined when selected.
            }
            .frame(minHeight: 64) // Generous rows.
        } else { // The eight problems' share of the row.
            HStack(spacing: 6) { // Cramped.
                Circle().fill(invoice.status.color).frame(width: 9, height: 9).part("color", selected, onInspect) // Color alone.
                Text("\(invoice.client)  \(invoice.amount)").font(.system(size: 11)).part("fixed", selected, onInspect) // Fixed 11 pt.
                Text(invoice.due).font(.system(size: 11)).foregroundStyle(Color(RGB(hex: 0xC7C7CC))).part("contrast", selected, onInspect) // #C7C7CC on white.
                Spacer() // Push the icons right.
                HStack(spacing: 4) { // Two tiny icons, 4 pt apart.
                    Image(systemName: "pencil") // Edit.
                    Image(systemName: "square.and.arrow.up") // Share.
                }
                .font(.caption2) // Tiny.
                .part("targets", selected, onInspect) // Inspectable.
            }
            .frame(height: 40) // Cramped rows.
        }
    }
}

/// One invoice on the critique screen.
struct InvoiceSample: Identifiable { // A tiny model for the rows.
    let client: String // Who owes.
    let amount: String // How much, already formatted.
    let due: String // When.
    let status: InvoiceStatus // Paid, overdue or due soon.
    var id: String { client } // Clients are unique in the sample.
}

/// An invoice's status, with a symbol, a word and a color.
enum InvoiceStatus { // The three statuses in the critique.
    case paid, overdue, dueSoon // Paid, overdue, due soon.
    var word: String { self == .paid ? "Paid" : (self == .overdue ? "Overdue" : "Due Soon") } // The word.
    var symbol: String { self == .paid ? "checkmark.circle.fill" : (self == .overdue ? "exclamationmark.triangle.fill" : "clock") } // A distinct shape each.
    var color: Color { self == .paid ? .green : (self == .overdue ? .red : .orange) } // Color only reinforces.
}

extension View { // A helper for the critique screen's inspectable parts.
    /// Makes a part of the critique screen inspectable: a tap reports its id, and the selected part gets an outline.
    func part(_ id: String, _ selected: String?, _ onInspect: @escaping (String) -> Void) -> some View { // Used on every part.
        self // The part itself...
            .contentShape(Rectangle()) // ...tappable across its whole frame...
            .onTapGesture { onInspect(id) } // ...reporting its id. An inspection tool, not an app control.
            .overlay { RoundedRectangle(cornerRadius: 6).stroke(selected == id ? Color.accentColor : .clear, lineWidth: 2).padding(-3) } // Outline when selected.
            .accessibilityAddTraits(.isButton) // VoiceOver users can inspect it too...
            .accessibilityAction { onInspect(id) } // ...with a double-tap.
    }
}

// MARK: - The course's examples

/// The course's ShiftWireframe, with its two try-its.
struct ShiftWireframe: View { // From "A wireframe you can run".
    var spacerAboveCard = false // Try it 1.
    var cardHeight: CGFloat = 120 // Try it 2: 60.

    var body: some View { // Gray placeholders, real structure.
        VStack(alignment: .leading, spacing: 16) { // Top to bottom.
            Text("Shifts").font(.largeTitle).bold() // The title.
            if spacerAboveCard { Spacer() } // The try-it: content sinks.
            RoundedRectangle(cornerRadius: 12) // The next-shift card...
                .fill(Color.gray.opacity(0.3)) // ...as a gray box...
                .frame(height: cardHeight) // ...120 pt tall in the course...
                .overlay { Text("Next shift") } // ...with a label.
            ForEach(0..<3) { _ in // Three placeholder rows.
                RoundedRectangle(cornerRadius: 8) // A row...
                    .fill(Color.gray.opacity(0.15)) // ...lighter gray...
                    .frame(height: 44) // ...44 pt tall.
            }
            if !spacerAboveCard { Spacer() } // The course: pushes the action down.
            Button("Swap a Shift") { } // The primary action.
                .buttonStyle(.borderedProminent) // Prominent.
        }
        .padding() // Standard margins.
    }
}

/// The course's flawed invoice row.
struct PoorInvoiceRow: View { // The "before" of "The critique, in code".
    var body: some View { // Four violations.
        HStack { // One row.
            Circle().fill(Color.red).frame(width: 9, height: 9) // Color alone means "overdue".
            Text("Bluebird Bakery") // The most important text...
                .font(.system(size: 11)) // ...fixed at 11 pt...
                .foregroundStyle(.tertiary) // ...in the faintest label color.
            Spacer() // Pushes the icon to the edge.
            Image(systemName: "pencil") // A small glyph meaning "edit"...
                .onTapGesture { } // ...that is not a button.
        }
        .padding(4) // Almost on the screen edge.
    }
}

/// The course's fixed invoice row.
struct BetterInvoiceRow: View { // The "after".
    var body: some View { // Every fix applied.
        HStack { // One row.
            Text("Bluebird Bakery").font(.body) // A text style in the primary color.
            Spacer() // Status and action to the trailing edge.
            Label("Overdue", systemImage: "exclamationmark.triangle") // Shape plus word.
            Button { } label: { // A real Button.
                Image(systemName: "pencil") // The same glyph...
                    .frame(width: 44, height: 44) // ...in a 44 × 44 pt hit area.
            }
            .accessibilityLabel("Edit Invoice") // Words for VoiceOver and Voice Control.
        }
        .padding(.horizontal) // The 16 pt margin.
    }
}

#Preview("Lesson 5.10") { // The whole lesson in Xcode's canvas.
    NavigationStack { ProcessCritiqueLesson(lesson: ContentView.lessons[9]) } // Inside a stack, as in the app.
}

#Preview("ShiftWireframe") { ShiftWireframe() } // The course's preview.

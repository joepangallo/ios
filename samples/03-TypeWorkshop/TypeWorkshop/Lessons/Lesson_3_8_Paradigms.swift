// Lesson_3_8_Paradigms.swift
// Who: a student who opens lesson 3.8 from the home screen.
// What: one card per course step of "Programming Paradigms in Swift": the same
//       chores solved five ways side by side (flip a chore and all five answers
//       move together), the imperative loop, the TaskList object, the Trackable
//       protocol, loop versus pipeline with its stages, the course's SwiftUI
//       TodayView running for real, and the guide to choosing a paradigm.
// Where: pushed by ContentView when the 3.8 row is tapped (or launched with -lesson 3.8).
// When: built when the screen appears and rebuilt whenever a switch changes state.
// Why: one problem with one answer leaves only the style to compare, which is
//      exactly what a paradigm is.

import SwiftUI // SwiftUI provides View, @State, List, Toggle and the rest.

struct ParadigmsLesson: View { // The screen for lesson 3.8.
    let lesson: Lesson // The catalog entry: number, title and summary.

    var body: some View { // The page: summary first, then one card per course step.
        CardPage(lesson: lesson) { // CourseKit's scrolling page layout, plus the -card launch argument.
            FiveStylesCard() // Concept: one problem, five styles.
            ImperativeCard() // Code: imperative.
            ObjectOrientedCard() // Code: object-oriented.
            ProtocolOrientedCard() // Code: protocol-oriented.
            LoopOrPipelineCard() // Compare: loop or pipeline.
            DeclarativeCard() // Code: declarative.
            ChoosingParadigmCard() // Concept: choosing a paradigm.
        }
    }
}

/// Concept step "One problem, five styles": flip a chore and watch all five answers.
private struct FiveStylesCard: View { // The overview of the whole lesson.
    @State private var records = FiveStyles.today // The three chores; toggles change isDone.

    var body: some View { // Rebuilt whenever a toggle changes.
        DemoCard(title: "One problem, five styles", // Named after the course step.
                 caption: "Given today's chores, how many minutes of work are already done? With the course's data the answer is always 40. Flip a chore and every style recomputes.") { // The key idea.
            TermList(terms: [ // The five terms from the course page.
                ("Imperative", "Step-by-step commands that change variables."), // Style 1.
                ("Object-oriented", "Objects bundle state with the methods that guard it."), // Style 2.
                ("Protocol-oriented", "Capabilities described by protocols and shared through extensions."), // Style 3.
                ("Functional", "Transform data with functions, without changing anything in place."), // Style 4.
                ("Declarative", "Describe what the result should be; the framework works out how."), // Style 5.
            ])
            ForEach(records.indices, id: \.self) { index in // One switch per chore.
                Toggle("\(records[index].title) (\(records[index].minutes) min)", isOn: $records[index].isDone) // Writes into the record.
            }
            LabeledContent("Imperative") { CodeText(FiveStyles.imperative(records)).foregroundStyle(.primary) } // Parallel arrays and a loop.
            LabeledContent("Object-oriented") { CodeText(FiveStyles.objectOriented(records)).foregroundStyle(.primary) } // The TaskList's report.
            LabeledContent("Protocol-oriented") { CodeText(FiveStyles.protocolOriented(records)).foregroundStyle(.primary) } // The Trackable extension.
            LabeledContent("Functional") { CodeText(FiveStyles.functional(records)).foregroundStyle(.primary) } // filter, map, reduce.
            LabeledContent("Declarative") { CodeText(FiveStyles.declarative(records)).foregroundStyle(.primary) } // The sum TodayView shows.
            Button("Back to the course's data") { records = FiveStyles.today } // Restores 40.
                .font(.footnote) // Small.
        }
    }
}

/// Code step "Imperative: tell the computer each step".
private struct ImperativeCard: View { // The parallel arrays and the loop.
    var body: some View { // Static content.
        DemoCard(title: "Imperative: tell the computer each step", // Named after the course step.
                 caption: "Create a variable, loop, test, update. The data lives in three parallel arrays, where the same index in each array describes one chore.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: Imperative.run().lines) // Completed: 40 min
            CodeText("titles  = \(Imperative.titles)\nminutes = \(Imperative.minutes)\ndone    = \(Imperative.done)") // The three arrays, lined up.
            ForEach(Imperative.titles.indices, id: \.self) { index in // A trace of the loop.
                CodeText("index \(index): done[\(index)] is \(Imperative.done[index]) -> \(Imperative.done[index] ? "total += \(Imperative.minutes[index])" : "skip")") // What each pass does.
            }
            Text("Try it from the course: add a fourth chore to only two of the arrays. The loop then reads past the end of the shorter array and the app stops with \"Fatal error: Index out of range\". Nothing ties the arrays together.") // The try item, described rather than crashed.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A note.
        }
    }
}

/// Code step "Object-oriented: an object guards its state".
private struct ObjectOrientedCard: View { // Send messages to a TaskList.
    @State private var list = ObjectOrientedCard.makeList() // The object, with the three chores added.
    @State private var messages: [String] = [] // The messages sent so far.

    /// A TaskList with the course's three chores added, none completed.
    private static func makeList() -> ObjectOriented.TaskList { // Used at start and on reset.
        let today = ObjectOriented.TaskList() // One object.
        today.add("Email Sam", minutes: 10) // First chore.
        today.add("Gym", minutes: 45) // Second chore.
        today.add("Read ch. 3", minutes: 30) // Third chore.
        return today // All three open.
    }

    var body: some View { // Rebuilt whenever messages changes.
        DemoCard(title: "Object-oriented: an object guards its state", // Named after the course step.
                 caption: "Outside code cannot touch the private properties; it can only send messages such as add and complete. The object keeps its own state consistent: encapsulation.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: ObjectOriented.run().lines) // Completed: 40 min, 1 open
            Divider() // Separates the program from the live object.
            ForEach(["Email Sam", "Gym", "Read ch. 3"], id: \.self) { title in // One button per chore.
                Button { // Sends the complete message.
                    list.complete(title) // Does nothing if the chore is not open.
                    messages.append("today.complete(\"\(title)\")") // Record the message; also redraws the card.
                } label: { // The message as code.
                    Text(verbatim: "today.complete(\"\(title)\")") // For example today.complete("Gym").
                        .font(.system(.footnote, design: .monospaced)) // Code-looking text.
                }
            }
            CodeText("today.report  // \(list.report)") // The only way to see the state.
            Text("Messages sent: \(messages.count). Completing the same chore twice changes nothing; the object refuses to count it again.") // The course's try item.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A note.
            Button("Start a new list") { list = Self.makeList(); messages = [] } // Reset.
                .font(.footnote) // Small.
            CompilerNote(code: "today.minutesDone = 999", // The course's second try item.
                         message: "'minutesDone' is inaccessible due to 'private' protection level") // Exact Xcode message.
        }
    }
}

/// Code step "Protocol-oriented: share a capability".
private struct ProtocolOrientedCard: View { // Chores and workouts share completedMinutes.
    @State private var workoutDone = [true, false] // Whether each of two workouts is done.

    var body: some View { // Rebuilt whenever a toggle changes.
        let workouts = [ProtocolOriented.Workout(minutes: 20, isDone: workoutDone[0]), // A short workout.
                        ProtocolOriented.Workout(minutes: 35, isDone: workoutDone[1])] // A longer one.
        return DemoCard(title: "Protocol-oriented: share a capability", // Named after the course step.
                        caption: "Anything with minutes and a done flag is Trackable. One extension gives every sequence of Trackable values a completedMinutes property, whether it holds chores, workouts or study sessions.") { // The key idea.
            ProgramOutput(heading: "Course program output", lines: ProtocolOriented.run().lines) // Completed: 40 min
            CodeText("today.completedMinutes  // \(ProtocolOriented.today.completedMinutes)") // Chores.
            Text("Workout is a second Trackable type (the course's try item):") // Introduces the workouts.
                .font(.subheadline.bold()) // A small heading.
            Toggle("Workout 1 (20 min) done", isOn: $workoutDone[0]) // First workout.
            Toggle("Workout 2 (35 min) done", isOn: $workoutDone[1]) // Second workout.
            CodeText("workouts.completedMinutes  // \(workouts.completedMinutes)") // The same extension, a different type.
            CompilerNote(code: "// with isDone removed:\nstruct Chore: Trackable {", // The course's second try item.
                         message: "type 'Chore' does not conform to protocol 'Trackable'") // Exact Xcode message.
        }
    }
}

/// Compare step "Loop or pipeline".
private struct LoopOrPipelineCard: View { // Both programs and the pipeline's stages.
    var body: some View { // Static content computed from the course's data.
        let today = LoopOrPipeline.today // The three chores.
        let kept = today.filter { $0.isDone } // Stage 1: filter.
        let minutes = kept.map { $0.minutes } // Stage 2: map.
        return DemoCard(title: "Loop or pipeline", // Named after the course step.
                        caption: "The left builds the answer by changing a variable inside a loop. The right passes the data through filter, map and reduce, each returning a new value.") { // The key idea.
            HStack(alignment: .top) { // The two course programs side by side.
                ProgramOutput(heading: "Imperative loop", lines: LoopOrPipeline.runLoop().lines) // Completed: 40 min
                ProgramOutput(heading: "Functional pipeline", lines: LoopOrPipeline.runPipeline().lines) // Completed: 40 min
            }
            Text("The pipeline, one stage at a time:") // Introduces the stages.
                .font(.subheadline.bold()) // A small heading.
            CodeText(".filter { $0.isDone }  // \(kept.map(\.title))") // Only the finished chores.
            CodeText(".map { $0.minutes }  // \(minutes)") // Their minutes: [10, 30].
            CodeText(".reduce(0, +)  // \(minutes.reduce(0, +))") // Added up: 40.
            Text("Both are correct. The pipeline has no mutable variable, so there is no running total to get wrong. Loops still win for complex control flow, such as stopping early.") // The course's verdict.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A note.
        }
    }
}

/// The course's SwiftUI view from "Declarative: describe the screen", unchanged except for the type names.
struct TodayView: View { // A struct that conforms to View.
    @State private var chores = DeclarativeExample.today // The screen's source of truth, owned by SwiftUI.

    var body: some View { // Recomputed whenever chores changes.
        let sum = chores.reduce(0) { $1.isDone ? $0 + $1.minutes : $0 } // $0 is the running total, $1 the current chore.
        List { // A scrolling list of rows.
            ForEach(chores.indices, id: \.self) { i in // One row per chore index.
                Toggle(chores[i].title, isOn: $chores[i].isDone) // The binding writes straight into @State.
            }
            Text("Completed: \(sum) min") // Nothing ever updates this label directly.
        }
    }
}

/// Code step "Declarative: describe the screen": TodayView, running.
private struct DeclarativeCard: View { // Embeds the course's view.
    var body: some View { // Static content around a live view.
        DemoCard(title: "Declarative: describe the screen", // Named after the course step.
                 caption: "body describes what the screen looks like for the current state, and SwiftUI redraws it when that state changes. Flip the Gym toggle: the total becomes 85, and no code ever tells the label to change.") { // The key idea.
            TodayView() // The course's view, live.
                .frame(height: 290) // A List needs a fixed height inside a scrolling page; this fits all four rows.
                .clipShape(.rect(cornerRadius: 12)) // Rounded like the cards.
        }
    }
}

/// Concept step "Choosing a paradigm".
private struct ChoosingParadigmCard: View { // The guide and the callout.
    var body: some View { // Static content.
        DemoCard(title: "Choosing a paradigm", // Named after the course step.
                 caption: "No paradigm wins everywhere. A typical SwiftUI app is declarative in its views, protocol-oriented and value-based in its models, functional when transforming data, object-oriented for a few shared models, and imperative inside small algorithms.") { // The key idea.
            TermList(terms: [ // Where each style fits, from the course page.
                ("Imperative", "Small algorithms with tricky control flow, early exits or tight performance needs."), // Style 1.
                ("Object-oriented", "Shared objects with identity and a lifecycle, such as an @Observable model several screens watch."), // Style 2.
                ("Protocol-oriented", "Behavior shared by many unrelated value types, like Trackable chores and workouts."), // Style 3.
                ("Functional", "Transforming collections: filter, map, sort, total. Fewer variables, fewer bugs."), // Style 4.
                ("Declarative", "User interfaces. Describe the screen for each state and let SwiftUI keep it current."), // Style 5.
            ])
            CalloutBox(title: "Clarity is the goal", // The course's design callout.
                       text: "Swift's API Design Guidelines put clarity at the point of use above brevity. Choose the style that makes the next reader, often you in six months, understand the code fastest.") // Its message.
        }
    }
}

#Preview { // Shows this screen in Xcode's canvas.
    NavigationStack { ParadigmsLesson(lesson: ContentView.lessons[7]) } // Inside a stack so the title appears.
}

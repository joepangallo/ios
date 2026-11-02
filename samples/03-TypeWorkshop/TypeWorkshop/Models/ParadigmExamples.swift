// ParadigmExamples.swift
// Who: the 3.8 lesson screen runs these programs and compares the five styles;
//      the unit tests check every program and that all five styles agree.
// What: the programs from the course lesson "Programming Paradigms in Swift":
//       one problem (how many minutes of today's chores are done?) solved
//       imperatively, object-oriented, protocol-oriented, as a functional
//       pipeline, and with the sum a declarative SwiftUI view computes.
// Where: the Models folder; Lesson_3_8_Paradigms.swift is the screen that uses
//        them and also holds the course's SwiftUI TodayView.
// When: run() executes when the screen draws; FiveStyles recomputes whenever
//       the student flips a chore's done switch.
// Why: the data never changes and the answer is always the same, so the only
//      thing left to compare is the style. That is the point of the lesson.

/// Course step "Imperative: tell the computer each step".
enum Imperative { // A caseless enum used as a namespace for this example.
    static let titles = ["Email Sam", "Gym", "Read ch. 3"] // Chore names.
    static let minutes = [10, 45, 30] // Minutes, in the same order.
    static let done = [true, false, true] // Done flags, in the same order: parallel arrays.

    /// The course's loop over three parallel arrays.
    static func total(titles: [String], minutes: [Int], done: [Bool]) -> Int { // The same index in each array is one chore.
        var total = 0 // A mutable running total.
        for index in 0..<titles.count { // Visits indices 0, 1 and 2.
            if done[index] { // Is the chore at this index finished?
                total += minutes[index] // Mutation in place.
            }
        }
        return total // 40 for the course's data.
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed line.
        let total = Self.total(titles: titles, minutes: minutes, done: done) // The loop, on the course's arrays; Self. names the function, not this constant.
        out.print("Completed: \(total) min") // Completed: 40 min
        return out // One printed line.
    }
}

/// Course step "Object-oriented: an object guards its state".
enum ObjectOriented { // Namespace for this step's example.
    class TaskList { // An object that owns today's chores.
        private var open: [String: Int] = [:] // Title -> minutes for unfinished chores; hidden from outside code.
        private var minutesDone = 0 // Running total of completed minutes, also hidden.

        func add(_ title: String, minutes: Int) { // The only way in is through methods the object controls.
            open[title] = minutes // Stores the chore's minutes under its title.
        }

        func complete(_ title: String) { // Marks a chore finished.
            if let minutes = open.removeValue(forKey: title) { // nil if the chore was not open.
                minutesDone += minutes // The total can never count a chore twice.
            }
        }

        var report: String { // The only public way to see the state.
            "Completed: \(minutesDone) min, \(open.count) open" // Only the object knows how to summarize itself.
        }
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed line.
        let today = TaskList() // One list object; let fixes the reference, not the object.
        today.add("Email Sam", minutes: 10) // Sends a message to the object.
        today.add("Gym", minutes: 45) // Gym stays open.
        today.add("Read ch. 3", minutes: 30) // All three chores are now open.
        today.complete("Email Sam") // Moves 10 minutes to done.
        today.complete("Read ch. 3") // Moves 30 more minutes to done.
        out.print(today.report) // Completed: 40 min, 1 open
        return out // One printed line.
    }
}

/// Course step "Protocol-oriented: share a capability".
enum ProtocolOriented { // Namespace for this step's example.
    protocol Trackable { // The capability: has minutes and can be done.
        var minutes: Int { get } // Any type with minutes can join in.
        var isDone: Bool { get } // Two small requirements make the protocol easy to adopt.
    }

    struct Chore: Trackable { // A plain value type, no superclass needed.
        let title: String // Extra data the protocol does not need.
        let minutes: Int // Satisfies the first requirement.
        let isDone: Bool // Satisfies the second requirement.
    }

    struct Workout: Trackable { // The course's try item: a second, unrelated Trackable type.
        let minutes: Int // Satisfies the first requirement.
        let isDone: Bool // Satisfies the second requirement.
    }

    /// The course's three chores.
    static let today = [Chore(title: "Email Sam", minutes: 10, isDone: true), // Finished.
                        Chore(title: "Gym", minutes: 45, isDone: false), // Still open.
                        Chore(title: "Read ch. 3", minutes: 30, isDone: true)] // Finished.

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed line.
        out.print("Completed: \(today.completedMinutes) min") // Reads like a built-in feature of arrays.
        return out // One printed line.
    }
}

extension Sequence where Element: ProtocolOriented.Trackable { // Every sequence of Trackable values gains this property.
    var completedMinutes: Int { // Written once, reused by every Trackable type.
        var total = 0 // A local running total.
        for item in self where item.isDone { // self is the sequence; only finished items.
            total += item.minutes // Works without knowing the concrete type.
        }
        return total // Callers see only a clean property.
    }
}

/// Course compare "Loop or pipeline".
enum LoopOrPipeline { // Namespace for both sides.
    struct Chore { // The same chore model on both sides.
        let title: String // Never read by the calculation.
        let minutes: Int // Added up.
        let isDone: Bool // Decides which chores count.
    }

    /// The course's three chores.
    static let today = [Chore(title: "Email Sam", minutes: 10, isDone: true), // Finished.
                        Chore(title: "Gym", minutes: 45, isDone: false), // Still open.
                        Chore(title: "Read ch. 3", minutes: 30, isDone: true)] // Finished.

    /// Left side: build the answer by changing a variable inside a loop.
    static func loopTotal(_ today: [Chore]) -> Int { // Explicit iteration and branching.
        var total = 0 // The answer is built by mutation.
        for chore in today { // You say how to walk the data.
            if chore.isDone { // You say how to choose.
                total += chore.minutes // State changes on every pass.
            }
        }
        return total // 40
    }

    /// Right side: pass the data through filter, map and reduce, changing nothing in place.
    static func pipelineTotal(_ today: [Chore]) -> Int { // No var anywhere.
        let total = today // Feeds the array into the pipeline.
            .filter { $0.isDone } // Keep the finished chores.
            .map { $0.minutes } // Take their minutes: [10, 30].
            .reduce(0, +) // Add them up, starting from 0.
        return total // 40
    }

    /// Runs the left-hand program.
    static func runLoop() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed line.
        out.print("Completed: \(loopTotal(today)) min") // Completed: 40 min
        return out // One printed line.
    }

    /// Runs the right-hand program.
    static func runPipeline() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed line.
        out.print("Completed: \(pipelineTotal(today)) min") // Completed: 40 min
        return out // One printed line.
    }
}

/// Course step "Declarative: describe the screen": the model and the sum its view computes.
/// The view itself, TodayView, lives in Lesson_3_8_Paradigms.swift because it is SwiftUI.
enum DeclarativeExample { // Namespace for the declarative example's model.
    struct Chore { // The same chore data, but isDone is a var so a toggle can change it.
        let title: String // Shown as the toggle label.
        let minutes: Int // Added up by the sum.
        var isDone: Bool // Only what the user can change needs to be var.
    }

    /// The course's three chores, as the view's @State starts them.
    static let today = [Chore(title: "Email Sam", minutes: 10, isDone: true), // Finished.
                        Chore(title: "Gym", minutes: 45, isDone: false), // Flip its toggle and the total becomes 85.
                        Chore(title: "Read ch. 3", minutes: 30, isDone: true)] // Finished.

    /// The exact reduce that TodayView's body runs: $0 is the running total, $1 the current chore.
    static func sum(of chores: [Chore]) -> Int { // A functional calculation inside a declarative view.
        chores.reduce(0) { $1.isDone ? $0 + $1.minutes : $0 } // Adds the minutes of finished chores.
    }
}

/// The overview: the same three chores fed to all five styles at once.
enum FiveStyles { // Namespace for the comparison.
    /// One chore, in a neutral shape each style can convert from.
    struct Record: Equatable { // Equatable so tests can compare lists of records.
        let title: String // The chore's name.
        let minutes: Int // Its length.
        var isDone: Bool // Whether it is finished; the screen's toggles change this.
    }

    /// The course's data: the answer is always 40.
    static let today = [Record(title: "Email Sam", minutes: 10, isDone: true), // Finished.
                        Record(title: "Gym", minutes: 45, isDone: false), // Open.
                        Record(title: "Read ch. 3", minutes: 30, isDone: true)] // Finished.

    /// Imperative: split into parallel arrays and loop.
    static func imperative(_ records: [Record]) -> String { // Returns the printed line.
        let total = Imperative.total(titles: records.map(\.title), minutes: records.map(\.minutes), done: records.map(\.isDone)) // Three parallel arrays.
        return "Completed: \(total) min" // The same line the course prints.
    }

    /// Object-oriented: send add and complete messages to a TaskList.
    static func objectOriented(_ records: [Record]) -> String { // Returns the object's report.
        let list = ObjectOriented.TaskList() // One object.
        for record in records { list.add(record.title, minutes: record.minutes) } // Every chore starts open.
        for record in records where record.isDone { list.complete(record.title) } // Finished chores move to done.
        return list.report // The object's own summary.
    }

    /// Protocol-oriented: an array of Trackable chores and the shared extension.
    static func protocolOriented(_ records: [Record]) -> String { // Returns the printed line.
        let chores = records.map { ProtocolOriented.Chore(title: $0.title, minutes: $0.minutes, isDone: $0.isDone) } // Convert to Trackable chores.
        return "Completed: \(chores.completedMinutes) min" // The extension does the work.
    }

    /// Functional: filter, map and reduce.
    static func functional(_ records: [Record]) -> String { // Returns the printed line.
        let chores = records.map { LoopOrPipeline.Chore(title: $0.title, minutes: $0.minutes, isDone: $0.isDone) } // Convert to the compare's chores.
        return "Completed: \(LoopOrPipeline.pipelineTotal(chores)) min" // The pipeline.
    }

    /// Declarative: the sum TodayView's body computes from its state.
    static func declarative(_ records: [Record]) -> String { // Returns the text the view shows.
        let chores = records.map { DeclarativeExample.Chore(title: $0.title, minutes: $0.minutes, isDone: $0.isDone) } // Convert to the view's chores.
        return "Completed: \(DeclarativeExample.sum(of: chores)) min" // What the Text in the List shows.
    }
}

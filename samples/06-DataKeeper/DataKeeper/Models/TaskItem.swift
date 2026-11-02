// TaskItem.swift
// Who: SwiftData, which stores every TaskItem; lessons 6.5 and 6.1 create and list them.
// What: the course's TaskItem model: a title, a done flag, a priority and a creation date.
// Where: the Models folder. DataKeeperApp registers it in the app's one ModelContainer.
// When: SwiftData reads the class at launch to build the database schema; objects are
//       made whenever the student taps Add or loads the sample tasks.
// Why: it is named TaskItem, not Task, so it never clashes with Swift's concurrency type Task.

import Foundation // Date lives in Foundation.
import SwiftData // @Model and the rest of SwiftData.

@Model // The macro writes the code that stores, tracks and observes this class.
final class TaskItem { // final: models cannot be subclassed.
    var title: String // What the task says, for example "Pack the tent".
    var isDone: Bool // true once the task is completed.
    var priority: Int // 1 is low; higher numbers matter more.
    var createdAt: Date // When the task was made; the list sorts by it.

    init(title: String, priority: Int = 1) { // A normal initializer; priority defaults to 1.
        self.title = title // Copies the title argument into the stored property.
        self.isDone = false // Every new task starts unfinished.
        self.priority = priority // Copies the priority argument.
        self.createdAt = .now // Stamps the moment the object was created.
    }
}

/// Sample tasks for a hiking trip, so the SwiftData screens never start empty.
enum TaskSamples { // An enum with no cases is a handy namespace for related helpers.
    /// Inserts four sample tasks into the context and returns them, newest first.
    @discardableResult // Callers may ignore the returned array.
    static func insert(into context: ModelContext) -> [TaskItem] { // The context decides which database they go to.
        let specs: [(String, Int, Bool)] = [ // Title, priority and done flag for each sample.
            ("Pack the tent", 3, false), // The most important task.
            ("Buy trail mix", 2, false), // Medium priority.
            ("Print the trail map", 2, false), // Same priority, so the title breaks the tie.
            ("Charge the headlamp", 1, true), // Already finished, so filters can hide it.
        ]
        var made: [TaskItem] = [] // Collects the objects as they are created.
        for (index, spec) in specs.enumerated() { // index gives each task a different age.
            let task = TaskItem(title: spec.0, priority: spec.1) // A new object, in memory only so far.
            task.isDone = spec.2 // Marks the finished sample.
            task.createdAt = Date.now.addingTimeInterval(Double(-index) * 60) // Each one a minute older than the last.
            context.insert(task) // Registers it with the context, so it is shown and saved.
            made.append(task) // Remembers it for the caller.
        }
        return made // Newest first, because index 0 is the youngest.
    }
}

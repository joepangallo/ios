// TaskQueries.swift
// Who: lesson 6.5's buttons and list views call these; the tests run them against an
//      in-memory container.
// What: the course's clearCompleted(in:) function, the #Predicate and sort order used by
//       FilteredTaskList, and a few small fetch helpers.
// Where: the Support folder. Keeping queries here, outside the views, lets tests use them.
// When: when the student filters the list, taps Clear Completed, or opens the screen.
// Why: views read data with @Query, but other code fetches with FetchDescriptor.

import Foundation // Date and string comparison.
import SwiftData // ModelContext, FetchDescriptor, #Predicate and SortDescriptor.

/// The course's "Fetch and save outside a view" function.
@MainActor // The main context belongs to the main thread.
func clearCompleted(in context: ModelContext) throws -> Int { // Returns how many tasks were removed.
    let descriptor = FetchDescriptor<TaskItem>( // Describes what to fetch...
        predicate: #Predicate { $0.isDone } // ...only finished tasks.
    )
    let done = try context.fetch(descriptor) // Runs the query in the database.
    for task in done { // Each finished task...
        context.delete(task) // ...is marked for deletion.
    }
    try context.save() // Guarantees the deletions are on disk before returning.
    return done.count // How many were removed.
}

/// The query pieces FilteredTaskList uses, kept here so tests can run them too.
enum TaskFilter { // A namespace for the predicate and the sort.
    /// The course's predicate: optionally hide finished tasks, optionally match a search text.
    static func predicate(search: String, hideDone: Bool) -> Predicate<TaskItem> { // Captures both values.
        #Predicate<TaskItem> { task in // The macro turns this closure into a database query.
            (!hideDone || !task.isDone) && // Keep every task, or only unfinished ones...
            (search.isEmpty || // ...and keep everything when the search is empty...
                task.title.localizedStandardContains(search)) // ...or titles that contain it, ignoring case.
        }
    }

    /// The course's sort: highest priority first, then by title.
    static let sortOrder = [SortDescriptor(\TaskItem.priority, order: .reverse), // Priority 3 before 1.
                            SortDescriptor(\TaskItem.title)] // A to Z within a priority.

    /// The course's Try It: how many tasks have priority 3.
    static func countPriorityThree(in context: ModelContext) throws -> Int { // fetchCount counts without loading objects.
        try context.fetchCount(FetchDescriptor<TaskItem>(predicate: #Predicate { $0.priority == 3 })) // Only priority 3.
    }

    /// The titles stored in the database file itself, ignoring changes not yet saved.
    static func savedTitles(in container: ModelContainer) throws -> [String] { // Uses a fresh context, which reads from disk.
        let reader = ModelContext(container) // A second context sees only what was saved.
        let descriptor = FetchDescriptor<TaskItem>(sortBy: [SortDescriptor(\.createdAt, order: .reverse)]) // Newest first.
        return try reader.fetch(descriptor).map { ($0.isDone ? "[x] " : "[ ] ") + $0.title } // A checkbox and the title.
    }
}

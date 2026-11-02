// Lesson65Tests.swift
// Who: the Swift Testing runner.
// What: checks lesson 6.5's SwiftData code against an in-memory container: the TaskItem
//       initializer, the sample tasks, clearCompleted(in:), the #Predicate filter and its
//       sort, fetchCount, and the difference between pending and saved rows.
// Where: the DataKeeperTests target. Every test builds its own in-memory container.
// When: whenever tests run.
// Why: an in-memory container is fast and isolated, and never touches the real database.

import Foundation // Date.
import SwiftData // ModelContainer, ModelContext and FetchDescriptor.
import Testing // @Test and #expect.
@testable import DataKeeper // The app's internal types.

/// A fresh in-memory container with every model the app registers.
@MainActor // ModelContainer's main context belongs to the main actor.
func makeInMemoryContainer() throws -> ModelContainer { // Used by the SwiftData test files.
    try ModelContainer(for: TaskItem.self, Folder.self, Note.self, // The app's three models.
                       configurations: ModelConfiguration(isStoredInMemoryOnly: true)) // Lives only in memory.
}

@MainActor // SwiftData's main context and the app's types are main-actor isolated.
struct SwiftDataTaskTests { // The task model and queries.
    @Test func initializerSetsDefaults() { // "Define a model".
        let before = Date.now // Just before creation.
        let task = TaskItem(title: "Run") // Priority not given.
        #expect(task.title == "Run" && task.isDone == false && task.priority == 1) // The defaults.
        #expect(task.createdAt >= before) // Stamped at creation.
        #expect(task.modelContext == nil) // Not inserted yet: memory only.
    }

    @Test func insertRegistersWithTheContext() throws { // context.insert.
        let container = try makeInMemoryContainer() // A throwaway database.
        let context = container.mainContext // Its main context.
        let task = TaskItem(title: "Run") // In memory only.
        context.insert(task) // Registered.
        #expect(task.modelContext != nil) // Now managed.
        #expect(try context.fetchCount(FetchDescriptor<TaskItem>()) == 1) // Visible to fetches.
    }

    @Test func samplesAreNewestFirst() throws { // TaskSamples.
        let container = try makeInMemoryContainer() // A throwaway database.
        let made = TaskSamples.insert(into: container.mainContext) // Four tasks.
        #expect(made.count == 4) // All four.
        #expect(made.map(\.createdAt) == made.map(\.createdAt).sorted(by: >)) // Each one older than the last.
        let newestFirst = try container.mainContext.fetch(FetchDescriptor<TaskItem>(sortBy: [SortDescriptor(\.createdAt, order: .reverse)])) // The list's order.
        #expect(newestFirst.map(\.title) == ["Pack the tent", "Buy trail mix", "Print the trail map", "Charge the headlamp"]) // As inserted.
    }

    @Test func clearCompletedRemovesOnlyFinishedTasks() throws { // "Fetch and save outside a view".
        let container = try makeInMemoryContainer() // A throwaway database.
        let context = container.mainContext // Its main context.
        TaskSamples.insert(into: context) // One finished, three open.
        #expect(try clearCompleted(in: context) == 1) // One removed.
        let left = try context.fetch(FetchDescriptor<TaskItem>()) // What remains.
        #expect(left.count == 3 && left.allSatisfy { !$0.isDone }) // Only open tasks.
        #expect(try clearCompleted(in: context) == 0) // Nothing more to clear.
    }

    @Test func predicateAndSortMatchTheCourse() throws { // "Sort and filter with #Predicate".
        let container = try makeInMemoryContainer() // A throwaway database.
        let context = container.mainContext // Its main context.
        TaskSamples.insert(into: context) // Four tasks.
        func titles(_ search: String, _ hideDone: Bool) throws -> [String] { // Runs the filter like FilteredTaskList does.
            try context.fetch(FetchDescriptor(predicate: TaskFilter.predicate(search: search, hideDone: hideDone), sortBy: TaskFilter.sortOrder)).map(\.title) // Titles in order.
        }
        #expect(try titles("", false) == ["Pack the tent", "Buy trail mix", "Print the trail map", "Charge the headlamp"]) // Priority, then title.
        #expect(try titles("", true) == ["Pack the tent", "Buy trail mix", "Print the trail map"]) // Finished task hidden.
        #expect(try titles("TRAIL", false) == ["Buy trail mix", "Print the trail map"]) // Case-insensitive search.
        #expect(try titles("headlamp", true) == []) // Matches only a finished task, which is hidden.
    }

    @Test func priorityThreeCount() throws { // The predicate Try It.
        let container = try makeInMemoryContainer() // A throwaway database.
        TaskSamples.insert(into: container.mainContext) // One priority 3 task.
        #expect(try TaskFilter.countPriorityThree(in: container.mainContext) == 1) // Pack the tent.
    }

    @Test func savedRowsWaitForSave() throws { // Pending changes versus the store.
        let container = try makeInMemoryContainer() // A throwaway database.
        let context = ModelContext(container) // A context that does not autosave.
        context.insert(TaskItem(title: "Unsaved")) // Pending only.
        #expect(try TaskFilter.savedTitles(in: container) == []) // Not in the store yet.
        #expect(context.insertedModelsArray.count == 1) // Waiting in the context.
        try context.save() // Writes it.
        #expect(try TaskFilter.savedTitles(in: container) == ["[ ] Unsaved"]) // Now stored.
        #expect(context.hasChanges == false) // Nothing pending.
    }

    @Test func deleteRemovesFromQueries() throws { // context.delete, as in onDelete.
        let container = try makeInMemoryContainer() // A throwaway database.
        let context = container.mainContext // Its main context.
        let tasks = TaskSamples.insert(into: context) // Four tasks.
        context.delete(tasks[0]) // Delete one.
        try context.save() // Make it final.
        #expect(try context.fetchCount(FetchDescriptor<TaskItem>()) == 3) // Three left.
    }

    @Test func coreDataMappingHasFourRows() { // The concept card's table.
        #expect(CoreDataMapping.rows.map(\.swiftData) == ["@Model", "ModelContainer", "@Query / FetchDescriptor", "ModelContext"]) // The course's pairs.
    }
}

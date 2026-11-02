// Lesson_6_5_SwiftDataFundamentals.swift
// Who: the student, after tapping lesson 6.5 on the home screen.
// What: the TaskItem model, the container the App struct creates once, the course's
//       TaskListView (insert, list, delete), a live view of pending changes versus saved
//       rows, FilteredTaskList with #Predicate, and clearCompleted(in:).
// Where: pushed from ContentView. Everything uses the app's real database, created by
//        .modelContainer(for:) in DataKeeperApp.
// When: on first visit the screen adds four sample tasks; every button changes real data.
// Why: SwiftData stores model objects in a SQLite file and keeps views up to date.

import SwiftUI // Views and state.
import SwiftData // @Query, ModelContext and FetchDescriptor.

struct SwiftDataFundamentalsLesson: View { // The lesson 6.5 screen.
    let lesson: Lesson // Which lesson this page shows.
    @Environment(\.modelContext) private var context // The main context the App struct put in the environment.
    @Query(sort: \TaskItem.createdAt, order: .reverse) private var tasks: [TaskItem] // Every task, newest first.
    @AppStorage(SettingsKey.seededTasks) private var seeded = false // Whether the samples were added already.
    @State private var draftTask: TaskItem? // A task made but not inserted, for the model card.
    @State private var search = "" // The filter card's search text.
    @State private var hideDone = false // The filter card's toggle.
    @State private var priorityThreeCount: Int? // The Try It answer.
    @State private var clearMessage = "" // What clearCompleted reported.

    var body: some View { // Rebuilt whenever tasks or state change.
        LessonPage(lesson: lesson) { // The shared page layout.
            DemoCard(title: "What SwiftData does", caption: "@Model, ModelContainer, ModelContext and @Query, working on this app's real database file.") { // Course concept.
                StoreFileView() // Where the SQLite file lives and what it holds.
            }

            DemoCard(title: "Core Data, the framework underneath", caption: "SwiftData is built on Core Data. When you meet Core Data, map each idea to the one you know.") { // Course concept.
                ForEach(CoreDataMapping.rows, id: \.coreData) { row in // One line per pair.
                    HStack { // Core Data on the left, SwiftData on the right.
                        Text(row.coreData).font(.caption.monospaced()) // The Core Data name.
                        Spacer() // Pushes the SwiftData name right.
                        Text(row.swiftData).font(.caption.monospaced().bold()) // The SwiftData name.
                    }
                }
            }

            DemoCard(title: "Refresher: the Storage menu in a new project", caption: "Choosing SwiftData in Xcode's new-project options adds these pieces. This app wrote each one by hand instead.") { // Course concept.
                Text("Item.swift: a sample @Model with a timestamp.\nThe App struct: a ModelContainer attached with .modelContainer(...).\nContentView.swift: a @Query list with insert and delete buttons.\nHost in CloudKit: needs the iCloud capability, which a free Personal Team cannot add.") // The four pieces.
                    .font(.footnote) // Small print.
            }

            DemoCard(title: "Define a model", caption: "TaskItem is a class marked @Model. Creating one only makes it in memory; inserting it registers it with the context.") { // Course code step.
                if let task = draftTask { // A task exists.
                    TaskDetailsView(task: task) // Its properties, including whether it has a context.
                    Button("Insert it") { context.insert(task); draftTask = nil } // Registers it, then clears the card.
                        .buttonStyle(.borderedProminent) // The main action.
                } else { // No task yet.
                    Button("Make a TaskItem") { draftTask = TaskItem(title: "Pack snacks") } // In memory only.
                        .buttonStyle(.bordered) // Secondary look.
                }
            }

            DemoCard(title: "Create the container once, in the App", caption: "DataKeeperApp has .modelContainer(for: [TaskItem.self, Folder.self, Note.self]) on its WindowGroup.") { // Course code step.
                LabeledContent("Models in the schema", value: context.container.schema.entities.map(\.name).sorted().joined(separator: ", ")) // Read from the real container.
                LabeledContent("This is the main context", value: context === context.container.mainContext ? "yes" : "no") // The environment holds the main context.
            }
            .font(.footnote) // Small print for both lines.

            DemoCard(title: "Insert, list, and delete", caption: "The course's TaskListView. Tap the plus button in the navigation bar to insert; swipe a row left to delete.") { // Course code step.
                TaskListView() // Exactly as the course wrote it.
                    .contentMargins(.vertical, 0, for: .scrollContent) // Removes the list's empty band above the first row.
                    .frame(height: 230) // A List scrolls itself, so it needs a fixed height.
                    .clipShape(.rect(cornerRadius: 12)) // Rounded to match the card.
            }

            DemoCard(title: "Watch SwiftData work", caption: "Left: the list @Query shows. Right: the rows actually saved in the database file. Turn autosave off to see changes wait until you save.") { // Course widget.
                SwiftDataInspector() // Pending changes versus saved rows.
            }

            DemoCard(title: "Sort and filter with #Predicate", caption: "FilteredTaskList builds a new Query in its initializer, so the database does the filtering. Highest priority first, then by title.") { // Course code step.
                TextField("Search titles", text: $search) // Passed to the child's initializer.
                    .textFieldStyle(.roundedBorder) // A visible box.
                Toggle("Hide finished tasks", isOn: $hideDone) // Also passed to the initializer.
                FilteredTaskList(search: search, hideDone: hideDone) // Rebuilt with a new Query on every change.
                    .contentMargins(.vertical, 0, for: .scrollContent) // Removes the list's empty band above the first row.
                    .frame(height: 200) // A List needs a fixed height here.
                    .clipShape(.rect(cornerRadius: 12)) // Rounded to match the card.
                Button("Count priority 3 tasks") { priorityThreeCount = try? TaskFilter.countPriorityThree(in: context) } // The course's Try It.
                if let priorityThreeCount { // Only after the button is tapped.
                    Text("Priority 3 tasks: \(priorityThreeCount)").font(.footnote.monospaced()) // The answer.
                }
            }

            DemoCard(title: "Fetch and save outside a view", caption: "clearCompleted(in:) fetches finished tasks with a FetchDescriptor, deletes them, and calls save() so they are gone from disk.") { // Course code step.
                HStack { // Two actions.
                    Button("Clear Completed") { // Runs the course's function.
                        do { // The fetch and the save can both throw.
                            let removed = try clearCompleted(in: context) // How many finished tasks went.
                            clearMessage = "Removed \(removed) finished tasks" // Shows the count.
                        } catch { // Any failure.
                            clearMessage = "Failed: \(error.localizedDescription)" // Reports it.
                        }
                    }
                    .buttonStyle(.borderedProminent) // The main action.
                    Button("Add sample tasks") { TaskSamples.insert(into: context) } // Puts four samples back.
                        .buttonStyle(.bordered) // Secondary look.
                }
                if !clearMessage.isEmpty { Text(clearMessage).font(.footnote.monospaced()) } // The result, once there is one.
            }
        }
        .task { // Runs when the screen appears.
            if !seeded && tasks.isEmpty { TaskSamples.insert(into: context) } // The first visit gets sample tasks.
            seeded = true // Never again, even if the student deletes them all.
        }
    }
}

/// The course's TaskListView: insert, list, and delete.
struct TaskListView: View { // Reads tasks from the environment's context.
    @Environment(\.modelContext) private var context // The main context.
    @Query(sort: \TaskItem.createdAt, order: .reverse) // Fetches every task, newest first...
    private var tasks: [TaskItem] // ...and refreshes the view when they change.

    var body: some View { // Rebuilt whenever tasks changes.
        List { // A scrolling list.
            ForEach(tasks) { task in Text(task.title) } // One row per task.
                .onDelete { offsets in // Swipe to delete.
                    for index in offsets { // The rows that were swiped.
                        context.delete(tasks[index]) // Deletes the matching object.
                    }
                }
        }
        .toolbar { // Adds a button to the navigation bar.
            Button("Add", systemImage: "plus") { // A plus icon labeled Add for VoiceOver.
                context.insert(TaskItem(title: "New task")) // Appears in the list at once.
            }
        }
    }
}

/// The course's FilteredTaskList: a query built in the initializer.
struct FilteredTaskList: View { // Recreated by its parent whenever the search changes.
    @Query private var tasks: [TaskItem] // Configured in init, not here.

    init(search: String, hideDone: Bool) { // The parent passes the current filter.
        let predicate = TaskFilter.predicate(search: search, hideDone: hideDone) // The course's #Predicate, kept in TaskFilter so tests can use it.
        _tasks = Query( // Replaces the wrapper itself, hence the underscore.
            filter: predicate, // Only matching rows are loaded.
            sort: TaskFilter.sortOrder // Priority high to low, then title.
        )
    }

    var body: some View { // Rebuilt when the results change.
        List(tasks) { task in Text(task.title) } // One row per matching task.
    }
}

/// Shows a TaskItem's properties, including whether it belongs to a context yet.
struct TaskDetailsView: View { // Used by the model card.
    let task: TaskItem // The task to describe.

    var body: some View { // Five labeled lines.
        VStack(alignment: .leading, spacing: 4) { // Tight spacing.
            Text(verbatim: "title: \(task.title)") // The title from init.
            Text(verbatim: "isDone: \(task.isDone)") // false, set by init.
            Text(verbatim: "priority: \(task.priority)") // 1, the default.
            Text(verbatim: "createdAt: \(task.createdAt.formatted(date: .omitted, time: .standard))") // Stamped by init.
            Text(verbatim: "modelContext: \(task.modelContext == nil ? "nil (in memory only)" : "set (inserted)")") // nil until inserted.
        }
        .font(.caption.monospaced()) // Fixed-width, like output.
    }
}

/// Where the database file lives and how many objects it holds.
struct StoreFileView: View { // Reads the real container.
    @Environment(\.modelContext) private var context // The main context.

    var body: some View { // Recomputed whenever the screen redraws.
        let url = context.container.configurations.first?.url // The file the first configuration uses.
        VStack(alignment: .leading, spacing: 4) { // One fact per line.
            Text(verbatim: url.map { ContainerPaths.short($0) } ?? "unknown") // In Library/Application Support.
                .font(.caption.monospaced()) // Fixed-width.
            Text(verbatim: "File size: \(url.flatMap(Self.fileSize) ?? 0) bytes (recent changes may still be in the -wal file)") // SQLite keeps a write-ahead log beside the file.
                .font(.caption) // Small print.
            Text(verbatim: "TaskItem: \(count(TaskItem.self))  Folder: \(count(Folder.self))  Note: \(count(Note.self))") // fetchCount for each model.
                .font(.caption.monospaced()) // Fixed-width.
        }
    }

    /// How many objects of a model type exist.
    private func count<T: PersistentModel>(_ type: T.Type) -> Int { // Generic over the three models.
        (try? context.fetchCount(FetchDescriptor<T>())) ?? 0 // Counts without loading objects.
    }

    /// The size of a file in bytes, or nil if it cannot be read.
    private static func fileSize(_ url: URL) -> Int? { // A static helper.
        (try? url.resourceValues(forKeys: [.fileSizeKey]))?.fileSize // Asks the file system.
    }
}

/// Lesson 6.5's widget idea: what @Query shows versus what is saved on disk.
struct SwiftDataInspector: View { // Works on the main context.
    @Environment(\.modelContext) private var context // The main context.
    @Query(sort: \TaskItem.createdAt, order: .reverse) private var tasks: [TaskItem] // What the view sees.
    @State private var autosave = true // Mirrors context.autosaveEnabled.
    @State private var sortByTitle = false // Changes only the query, never the stored rows.

    var body: some View { // Rebuilt when tasks or state change.
        VStack(alignment: .leading, spacing: 10) { // Controls, columns, then status.
            HStack { // Edit actions.
                Button("Add") { context.insert(TaskItem(title: "Task \(tasks.count + 1)")) } // A new object in the context.
                Button("Complete") { tasks.first { !$0.isDone }?.isDone = true } // Changes one object.
                Button("Delete") { if let newest = tasks.first { context.delete(newest) } } // Marks the newest for deletion.
                Button("Save") { try? context.save() } // Writes pending changes now.
            }
            .buttonStyle(.bordered) // Secondary look.
            Toggle("Autosave", isOn: $autosave) // The main context autosaves by default.
                .onChange(of: autosave) { _, on in context.autosaveEnabled = on } // Applies the switch to the real context.
            Toggle("Sort the query by title", isOn: $sortByTitle) // Changes the query, not the data.
            HStack(alignment: .top) { // Two columns.
                VStack(alignment: .leading) { // Left column.
                    Text("@Query").font(.caption.bold()) // Column heading.
                    QueryColumn(sortByTitle: sortByTitle) // The query's results.
                }
                .frame(maxWidth: .infinity, alignment: .leading) // Half the width.
                VStack(alignment: .leading) { // Right column.
                    Text("Saved rows").font(.caption.bold()) // Column heading.
                    TimelineView(.periodic(from: .now, by: 1)) { _ in // Re-reads the file every second, so autosave shows up.
                        ForEach(Array(((try? TaskFilter.savedTitles(in: context.container)) ?? []).enumerated()), id: \.offset) { _, line in // One line per stored row.
                            Text(verbatim: line).font(.caption2.monospaced()) // Checkbox and title.
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading) // The other half.
            }
            TimelineView(.periodic(from: .now, by: 1)) { _ in // Refreshes the counts every second.
                Text(verbatim: "Pending: \(context.insertedModelsArray.count) inserted, \(context.changedModelsArray.count) changed, \(context.deletedModelsArray.count) deleted") // What save() would write.
                    .font(.caption.monospaced()) // Fixed-width.
            }
        }
        .onDisappear { context.autosaveEnabled = true } // Leaves the app's context as it was found.
    }
}

/// The left column of the inspector: a query whose sort is chosen in init.
struct QueryColumn: View { // A new Query each time the sort changes.
    @Query private var tasks: [TaskItem] // Configured in init.

    init(sortByTitle: Bool) { // The parent passes the choice.
        let sort = sortByTitle ? SortDescriptor(\TaskItem.title) : SortDescriptor(\TaskItem.createdAt, order: .reverse) // Title A to Z, or newest first.
        _tasks = Query(sort: [sort]) // The new query.
    }

    var body: some View { // One line per task.
        ForEach(tasks) { task in // Every task, including unsaved ones.
            Text(verbatim: (task.isDone ? "[x] " : "[ ] ") + task.title).font(.caption2.monospaced()) // Checkbox and title.
        }
    }
}

/// The course's Core Data to SwiftData map.
enum CoreDataMapping { // A namespace for the table.
    static let rows: [(coreData: String, swiftData: String)] = [ // Four pairs.
        ("NSManagedObject", "@Model"), // The stored type.
        ("NSPersistentContainer", "ModelContainer"), // The database.
        ("NSFetchRequest", "@Query / FetchDescriptor"), // How you fetch.
        ("NSManagedObjectContext", "ModelContext"), // The scratchpad.
    ]
}

#Preview { // Shows this lesson with a throwaway database.
    NavigationStack { SwiftDataFundamentalsLesson(lesson: ContentView.lessons[4]) } // Inside a stack, so the toolbar button shows.
        .modelContainer(for: [TaskItem.self, Folder.self, Note.self], inMemory: true) // Never touches the real database.
}

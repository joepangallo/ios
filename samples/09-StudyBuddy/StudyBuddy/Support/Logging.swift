// Logging.swift
// Who: every part of Study Buddy that records what it does: the session store,
//      the sync service and the focus timer screen.
// What: the app's named loggers, one per category, all under one subsystem.
// Where: the Support folder, the course's Core/Logging.swift.
// When: each logger is created the first time anything uses it.
// Why: lesson 9.4. Unified logging keeps messages with a level, a subsystem and a
//      category, so they can be filtered in Xcode's console or the Console app,
//      and private values are hidden in logs collected from a device.

import OSLog // OSLog provides Logger, Apple's unified logging API.

extension Logger { // Adds the app's own loggers to the system Logger type.
    /// The subsystem shared by every logger: the app's bundle identifier.
    nonisolated static let subsystem = "com.example.StudyBuddy" // nonisolated: logging works from any thread.

    /// Messages about uploading sessions (lesson 9.4's SyncService).
    nonisolated static let sync = Logger(subsystem: subsystem, category: "sync") // Filter by "sync" while chasing a sync bug.

    /// Messages about adding, loading and saving sessions.
    nonisolated static let sessions = Logger(subsystem: subsystem, category: "sessions") // The store's category.

    /// Messages about the focus timer starting, pausing and finishing.
    nonisolated static let timer = Logger(subsystem: subsystem, category: "timer") // The Today screen's category.
}

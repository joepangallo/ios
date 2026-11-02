// SessionStore.swift
// Who: StudyBuddyApp creates one and shares it through the environment; the
//      session list, the New Session sheet and the Today screen all read it.
// What: the observable view model for the week's sessions. It wraps a
//       StudyPlanner (the rules) and an injected SessionStorage (the saving).
// Where: the Models folder, the course's Core layer shared by every feature.
// When: created once at launch by the composition root; tests and previews
//       create their own with stand-in storage.
// Why: one store shared by the list and the sheet keeps both screens in step,
//      and injecting the storage keeps tests away from real saved data.

import Foundation // Foundation provides String(localized:) and string trimming.
import Observation // Observation provides @Observable without importing SwiftUI.
import OSLog // OSLog provides Logger, used to record what the store does.

/// The shared list of study sessions and the rules for changing it.
@Observable final class SessionStore { // SwiftUI redraws the views that read sessions when they change.
    private let storage: any SessionStorage // Whichever storage was injected. let properties are not tracked.
    private(set) var planner = StudyPlanner() // The rules and the sessions themselves.
    private(set) var problem: String? // A friendly message after a failed load or save; nil when all is well.

    /// Receives its storage from outside: dependency injection through the initializer.
    init(storage: any SessionStorage) { // You cannot create a store without choosing a storage.
        self.storage = storage // Keep the dependency.
        reload() // Read whatever the storage already holds.
    }

    /// The injected storage's name, so a screen can show which one this launch chose.
    var storageName: String { storage.name } // Read through the protocol; the store never learns the type.

    /// The sessions, newest first.
    var sessions: [StudySession] { planner.sessions } // Forwarded from the planner.

    /// The week's total minutes.
    var weeklyMinutes: Int { planner.weeklyMinutes } // Forwarded from the planner.

    /// The rule behind the sheet's disabled Save button: a title must have real characters.
    static func isValidTitle(_ title: String) -> Bool { // static: the sheet can ask before any change.
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty // Spaces alone do not count.
    }

    /// Adds a session from the New Session sheet. Returns true when it was added.
    @discardableResult // Callers may ignore the result.
    func add(_ title: String, minutes: Int = 25) -> Bool { // Same name as the course's store method.
        guard Self.isValidTitle(title) else { return false } // Invalid titles are rejected here, not only in the view.
        let subject = title.trimmingCharacters(in: .whitespacesAndNewlines) // Store the title without stray spaces.
        return log(StudySession(subject: subject, minutes: minutes)) // The shared path below does the rest.
    }

    /// Logs a finished session. Returns true when the planner accepted it.
    @discardableResult // Callers may ignore the result.
    func log(_ session: StudySession) -> Bool { // The focus timer's Stop and log button ends up here.
        let before = planner.sessions.count // How many sessions there were.
        planner.log(session) // The planner applies the zero-minute rule.
        guard planner.sessions.count > before else { // Nothing was added...
            Logger.sessions.notice("Ignored a \(session.minutes)-minute session") // ...so record why.
            return false // Report the rejection to the caller.
        }
        Logger.sessions.info("Logged \(session.minutes) minutes") // A normal event, at the info level.
        persist() // Save the new list.
        return true // Report success.
    }

    /// Clears the week, for the demo's Clear button.
    func removeAll() { // A single entry point, like every other change.
        planner.removeAll() // Empty the planner.
        persist() // Save the empty list.
    }

    /// Reads the storage again, turning a failure into a visible message.
    func reload() { // Called at creation and by the lessons' Reload buttons.
        do { // load() can throw.
            planner = StudyPlanner(sessions: try storage.load()) // Rebuild the planner from saved data.
            problem = nil // The read worked.
        } catch { // Any thrown error lands here.
            planner = StudyPlanner() // Show an empty week instead of stale data.
            problem = String(localized: "Could not load sessions", comment: "Shown when saved sessions cannot be read") // Friendly, translatable text.
            Logger.sessions.error("Load failed: \(error)") // Errors are always kept in the log.
        }
    }

    /// Writes the current list, turning a failure into a visible message.
    private func persist() { // private: only the store decides when to save.
        do { // save(_:) can throw.
            try storage.save(planner.sessions) // Hand the list to whichever storage was injected.
            problem = nil // The write worked.
        } catch { // Any thrown error lands here.
            problem = String(localized: "Could not save sessions", comment: "Shown when sessions cannot be saved") // Friendly, translatable text.
            Logger.sessions.error("Save failed: \(error)") // Errors are always kept in the log.
        }
    }
}

extension SessionStore { // Extra members kept apart from the main type.
    /// A fresh store seeded with the two known sessions, for previews and visual checks.
    static var sample: SessionStore { // Computed: every caller gets its own copy.
        SessionStore(storage: InMemorySessionStorage(seed: SampleData.seededSessions)) // The same rows the UI test uses.
    }
}

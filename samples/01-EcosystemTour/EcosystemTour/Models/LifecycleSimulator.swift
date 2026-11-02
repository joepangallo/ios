// LifecycleSimulator.swift
// Who: lesson 1.4's "Drive an app through its lifecycle" card and its tests.
// What: a model of a notes app moving through the five lifecycle states:
//       launch, the app switcher, a system alert, going home, suspension,
//       memory pressure and relaunch, with a log of the callbacks that fire.
// Where: the Models folder; the lesson screen sends it events.
// When: one event per button press on that card.
// Why: you cannot easily make iOS terminate a suspended app on cue. A model
//      lets you try it with saving off and on and see whether the draft survives.

import Foundation // Plain values.

/// A notes app's lifecycle, following the course's simulator.
struct LifecycleSimulator { // A value: every event produces a new state to draw.
    /// The five states every app moves through.
    enum Phase: String { // The raw value is the label shown on screen.
        case notRunning = "Not running", inactive = "Inactive", active = "Active", background = "Background", suspended = "Suspended" // The course's five states.
    }

    /// Something covering the app while it is inactive.
    enum Overlay { case alert, switcher } // A system alert, or the app switcher.

    private(set) var phase = Phase.notRunning // Starts before launch.
    private(set) var overlay: Overlay? = nil // Nothing covers the app yet.
    private(set) var disk: String? = nil // The saved draft; nil until the first save.
    private(set) var log: [String] = [] // What happened, oldest first.
    private(set) var savesOnBackground = false // The course's switch starts off.
    private var lost: String? = nil // A draft lost to termination, reported at the next launch.
    var memory = "" // The draft in memory; the text field edits it.

    /// Whether the draft can be typed into: only when active and uncovered.
    var canEdit: Bool { phase == .active && overlay == nil } // Inactive apps receive no touches.
    var canLaunchOrReturn: Bool { phase != .active && overlay != .alert } // Launch from not running, return from anywhere else.
    var canGoHome: Bool { phase == .active || overlay == .switcher } // Home works from the app or the switcher.
    var canOpenSwitcher: Bool { phase == .active && overlay == nil } // Only from the running app.
    var canToggleAlert: Bool { (phase == .active && overlay == nil) || overlay == .alert } // Show from active, dismiss when showing.
    var canApplyMemoryPressure: Bool { phase == .suspended } // iOS reclaims memory only from suspended apps.

    /// Wraps a draft in quotes for the log, shortened if long, like the course's simulator.
    static func quote(_ s: String) -> String { // Pure, so tests can check it.
        if s.isEmpty { return "empty" } // An empty draft reads as "empty".
        return "\"" + (s.count > 28 ? String(s.prefix(27)) + "..." : s) + "\"" // Long drafts are cut at 27 characters.
    }

    private mutating func phaseChange(_ from: String, _ to: String) { // Logs one scenePhase callback.
        log.append("onChange(of: scenePhase): .\(from) -> .\(to)") // The SwiftUI callback that fires.
    }

    /// The Launch / Return button.
    mutating func launchOrReturn() { // What happens depends on where the app is.
        if phase == .notRunning { // A fresh launch.
            log.append("Launch: iOS starts a new process") // A new process.
            log.append("NotesApp.init(), then WindowGroup creates a scene") // SwiftUI builds the app.
            memory = disk ?? "" // Memory starts with whatever was saved.
            if let disk { log.append("DraftStore loaded \(Self.quote(disk)) from disk") } // The draft survived.
            else if let lost { log.append("Nothing on disk: \(Self.quote(lost)) is gone for good") } // The draft did not.
            else { log.append("DraftStore starts empty: nothing saved yet") } // Nothing was ever typed.
            lost = nil // Reported once.
            log.append("ContentView.onAppear") // The first view appears.
            phaseChange("inactive", "active") // Launch passes through inactive.
            phase = .active // Running and interactive.
        } else if overlay == .switcher { // Back from the app switcher.
            overlay = nil // The switcher closes.
            phaseChange("inactive", "active") // Interactive again.
            phase = .active // Running.
        } else if phase == .background || phase == .suspended { // Back from the Home Screen.
            if phase == .suspended { log.append("iOS resumes the app from memory. init() does not run again") } // A resume is not a launch.
            phaseChange("background", "inactive") // On screen again...
            phaseChange("inactive", "active") // ...and interactive.
            phase = .active // Running.
            log.append("Draft still in memory: \(Self.quote(memory))") // Nothing was lost.
        }
    }

    /// The Home button (or swipe up): the app goes to the background and saves if saving is on.
    mutating func goHome() { // Works from the app or the switcher.
        guard canGoHome else { return } // Ignored otherwise.
        if phase == .active { phaseChange("active", "inactive") } // From the app, it passes through inactive first.
        phaseChange("inactive", "background") // Now off screen.
        phase = .background // Still running, briefly.
        overlay = nil // The switcher, if open, is gone.
        if savesOnBackground { // The course's NotesApp saves here.
            disk = memory // store.save().
            log.append("store.save() wrote \(Self.quote(memory)) to disk") // Says what was saved.
        } else { // Saving is off.
            log.append("No save: the draft exists only in memory") // The risk.
        }
    }

    /// Time passes in the background: iOS suspends the app.
    mutating func suspend() { // The screen calls this shortly after goHome.
        guard phase == .background else { return } // Only a backgrounded app is suspended.
        phase = .suspended // Frozen in memory.
        log.append("iOS suspends the app. No callback: your code is frozen") // Nothing runs from now on.
    }

    /// Opens the app switcher: the app is still visible, but not interactive.
    mutating func openSwitcher() { // Swipe up and pause.
        guard canOpenSwitcher else { return } // Only from the running app.
        overlay = .switcher // The switcher covers the app.
        phaseChange("active", "inactive") // Visible, not interactive.
        phase = .inactive // Inactive.
    }

    /// Shows or dismisses a system alert, such as a permission prompt.
    mutating func toggleAlert() { // One button does both.
        if phase == .active && overlay == nil { // Show it.
            overlay = .alert // The alert covers the app.
            phaseChange("active", "inactive") // Visible, not interactive.
            log.append("A system alert covers the app: visible, but not receiving touches") // Why it is inactive.
            phase = .inactive // Inactive.
        } else if overlay == .alert { // Dismiss it.
            overlay = nil // The alert goes away.
            phaseChange("inactive", "active") // Interactive again.
            phase = .active // Running.
        }
    }

    /// Memory pressure: iOS terminates the suspended app silently.
    mutating func applyMemoryPressure() { // Only a suspended app can be reclaimed.
        guard phase == .suspended else { return } // Ignored otherwise.
        log.append("iOS terminates the suspended app to free memory. No callback runs") // No code of yours runs.
        if !memory.isEmpty && memory != disk { lost = memory } // An unsaved draft is lost.
        memory = "" // Memory is wiped.
        phase = .notRunning // Back to the start.
    }

    /// The "Save when backgrounded" switch.
    mutating func setSavesOnBackground(_ on: Bool) { // Logs the change, like the course's simulator.
        savesOnBackground = on // Remembers the choice.
        log.append(on ? "Saving on .background is now ON" : "Saving on .background is now OFF") // Says so.
    }
}

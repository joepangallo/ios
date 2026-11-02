// AppLifecycleTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks lesson 1.4: the phase log's wording and timestamps, the draft
//       store's save, load and simulated relaunch (in a temporary file), the
//       sandbox path shortening, and the lifecycle simulator's scenarios.
// Where: the EcosystemTourTests target.
// When: only when tests run.
// Why: the simulator's whole point is "is the draft still there?"; these tests
//      answer it for both settings of the save switch.

import Testing // Swift Testing: @Test, #expect and #require.
import Foundation // URL, Date and Calendar.
import SwiftUI // ScenePhase.
@testable import EcosystemTour // The app's internal types.

@MainActor // PhaseLog and DraftStore are main-actor isolated.
struct PhaseLogTests { // The real scenePhase log.
    @Test func linesMatchTheCoursesPrint() { // print("Phase: \(oldPhase) -> \(newPhase)").
        #expect(PhaseLog.line(from: .inactive, to: .background) == "Phase: inactive -> background") // Going home.
        #expect(PhaseLog.line(from: .background, to: .inactive) == "Phase: background -> inactive") // Coming back.
    }

    @Test func recordingUpdatesTheCurrentPhase() { // The App struct records each change.
        let log = PhaseLog(now: Date(timeIntervalSince1970: 0)) // A fixed launch time.
        #expect(log.entries.count == 1) // Just the launch line.
        #expect(log.current == nil) // No change seen yet.
        log.record(from: .inactive, to: .active) // Launch finishes.
        #expect(log.current == .active) // The latest phase.
        #expect(log.entries.last?.text == "Phase: inactive -> active") // The new line.
        log.note("Saved") // A free-text line.
        #expect(log.entries.last?.text == "Saved") // Added at the end.
    }

    @Test func logKeepsTheNewestForty() { // The log does not grow forever.
        let log = PhaseLog() // A fresh log.
        for _ in 0..<50 { log.record(from: .active, to: .inactive) } // Fifty changes.
        #expect(log.entries.count == 40) // Trimmed.
    }

    @Test func clockTimesArePadded() { // 09:41:07, not 9:41:7.
        var calendar = Calendar(identifier: .gregorian) // A fixed calendar...
        calendar.timeZone = TimeZone(identifier: "UTC")! // ...in a fixed time zone, so the test passes anywhere.
        let date = Date(timeIntervalSince1970: 9 * 3600 + 41 * 60 + 7) // 09:41:07 UTC on 1 January 1970.
        #expect(PhaseLog.clock(date, calendar: calendar) == "09:41:07") // Two digits each.
    }
}

@MainActor // DraftStore is main-actor isolated.
struct DraftStoreTests { // The course's save-on-background store.
    /// A fresh file in the app's temporary folder, so tests never touch the real draft.
    func tempFile() -> URL { URL.temporaryDirectory.appending(path: "draft-test-\(UUID().uuidString).txt") } // A unique name per test.

    @Test func savedDraftComesBackAfterARelaunch() { // The whole point of saving.
        let url = tempFile() // Where this test saves.
        defer { try? FileManager.default.removeItem(at: url) } // Cleans up afterwards.
        let store = DraftStore(fileURL: url) // A store with nothing on disk.
        #expect(store.text.isEmpty) // Starts empty.
        store.text = "Repot the fern" // Typing.
        store.save(reason: "the test said so") // store.save().
        #expect(store.lastSaved != nil) // Remembers when.
        #expect(store.status.contains("the test said so")) // Says why.
        store.simulateRelaunch() // Memory wiped, disk read back.
        #expect(store.text == "Repot the fern") // Restored.
        let fresh = DraftStore(fileURL: url) // A brand-new store, as after a real launch.
        #expect(fresh.text == "Repot the fern") // Also restored.
    }

    @Test func unsavedDraftIsLostOnRelaunch() { // The silent-termination lesson.
        let store = DraftStore(fileURL: tempFile()) // A file that never gets written.
        store.text = "Never saved" // Typed but not saved.
        store.simulateRelaunch() // Terminated and relaunched.
        #expect(store.text.isEmpty) // Gone.
        #expect(store.status.contains("gone")) // And the screen says so.
    }

    @Test func shortPathReplacesTheContainer() { // Readable sandbox paths.
        #expect(Sandbox.shortPath(URL(filePath: "/Container/App/Documents"), home: "/Container/App") == "~/Documents") // Inside the container.
        #expect(Sandbox.shortPath(URL(filePath: "/Elsewhere/tmp"), home: "/Container/App") == "/Elsewhere/tmp") // Outside: unchanged.
    }

    @Test func sandboxListsTheCoursesFourFolders() { // Documents, Application Support, Caches, tmp.
        #expect(Sandbox.folders.map(\.name) == ["Documents", "Library/Application Support", "Library/Caches", "tmp"]) // In the course's order.
    }
}

@MainActor // LifecycleSimulator is main-actor isolated.
struct LifecycleSimulatorTests { // The "Drive an app through its lifecycle" model.
    /// Launches, types a draft, goes home, gets suspended and reclaimed, then relaunches.
    func dayOut(saving: Bool) -> LifecycleSimulator { // The course's experiment.
        var sim = LifecycleSimulator() // Not running.
        sim.setSavesOnBackground(saving) // The switch.
        sim.launchOrReturn() // Launch.
        sim.memory = "Buy soil" // Type a draft.
        sim.goHome() // To the background.
        sim.suspend() // Time passes.
        sim.applyMemoryPressure() // iOS reclaims the memory.
        sim.launchOrReturn() // Relaunch.
        return sim // The state after the experiment.
    }

    @Test func freshLaunchStartsEmptyAndActive() { // The first launch.
        var sim = LifecycleSimulator() // Not running.
        sim.launchOrReturn() // Launch.
        #expect(sim.phase == .active) // Running.
        #expect(sim.canEdit) // Typing is possible.
        #expect(sim.log.contains("DraftStore starts empty: nothing saved yet")) // Nothing saved yet.
        #expect(sim.log.contains("onChange(of: scenePhase): .inactive -> .active")) // The callback fired.
    }

    @Test func withoutSavingTheDraftIsGoneForGood() { // Saving off.
        let sim = dayOut(saving: false) // The experiment.
        #expect(sim.memory.isEmpty) // The draft did not come back.
        #expect(sim.log.contains("Nothing on disk: \"Buy soil\" is gone for good")) // And the log says so.
    }

    @Test func withSavingTheDraftComesBack() { // Saving on.
        let sim = dayOut(saving: true) // The experiment.
        #expect(sim.memory == "Buy soil") // Restored.
        #expect(sim.log.contains("DraftStore loaded \"Buy soil\" from disk")) // From disk.
        #expect(sim.log.contains("store.save() wrote \"Buy soil\" to disk")) // Saved on the way out.
    }

    @Test func alertMakesTheAppInactive() { // Quiz: a system alert.
        var sim = LifecycleSimulator() // Not running.
        sim.launchOrReturn() // Active.
        sim.toggleAlert() // An alert appears.
        #expect(sim.phase == .inactive) // Inactive, not background.
        #expect(!sim.canEdit) // No touches reach the app.
        sim.toggleAlert() // Dismissed.
        #expect(sim.phase == .active) // Active again.
    }

    @Test func homeFromTheSwitcherSkipsActive() { // Already inactive in the switcher.
        var sim = LifecycleSimulator() // Not running.
        sim.launchOrReturn() // Active.
        sim.openSwitcher() // Inactive.
        let before = sim.log.count // Lines so far.
        sim.goHome() // From the switcher.
        #expect(sim.phase == .background) // Off screen.
        #expect(sim.log[before] == "onChange(of: scenePhase): .inactive -> .background") // No active -> inactive this time.
    }

    @Test func returningFromSuspensionKeepsMemory() { // A resume is not a launch.
        var sim = LifecycleSimulator() // Not running.
        sim.launchOrReturn() // Active.
        sim.memory = "Still here" // A draft.
        sim.goHome() // Background.
        sim.suspend() // Suspended.
        sim.launchOrReturn() // Back.
        #expect(sim.memory == "Still here") // Nothing lost.
        #expect(sim.log.contains("iOS resumes the app from memory. init() does not run again")) // Resumed, not relaunched.
    }

    @Test func memoryPressureOnlyAffectsSuspendedApps() { // iOS reclaims only suspended apps.
        var sim = LifecycleSimulator() // Not running.
        sim.launchOrReturn() // Active.
        sim.applyMemoryPressure() // Ignored.
        #expect(sim.phase == .active) // Still running.
        #expect(!sim.canApplyMemoryPressure) // The button is disabled.
    }

    @Test func longDraftsAreShortenedInTheLog() { // The log quotes at most 27 characters.
        #expect(LifecycleSimulator.quote("") == "empty") // An empty draft.
        #expect(LifecycleSimulator.quote("Short") == "\"Short\"") // Short drafts are quoted whole.
        #expect(LifecycleSimulator.quote(String(repeating: "a", count: 40)) == "\"" + String(repeating: "a", count: 27) + "...\"") // Long ones are cut.
    }
}

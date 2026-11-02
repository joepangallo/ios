// FocusTimerView.swift
// Who: the capstone lesson (9.7) shows it as Study Buddy's Today screen.
// What: the focus timer: choose a subject and a length, start, pause, then stop
//       and log the session into the shared SessionStore.
// Where: Features/Focus. The rules live in FocusTimer (Models); this view only
//        displays them and forwards taps.
// When: rebuilt whenever the timer or the store changes; a task ticks the timer
//       once a second while it runs.
// Why: this is the core of Study Buddy's first story ("log a study session")
//      working end to end: view, view model, rules and storage.

import SwiftUI // SwiftUI provides the views, @AppStorage and the task modifier.
import OSLog // OSLog provides Logger, used to record timer events.

/// Study Buddy's Today screen: a focus timer that logs sessions.
struct FocusTimerView: View { // The view: layout and forwarding only.
    let store: SessionStore // Where finished sessions are logged.
    @State private var timer = FocusTimer() // The rules, owned for as long as this screen is on screen.
    @AppStorage("focusMinutes") private var savedMinutes = 25 // The preferred length, kept in UserDefaults.
    @State private var subject = "Algebra" // The subject the next session is for.
    @State private var fastForward = true // Demo speed: each second counts as a minute.
    @State private var lastResult: String? // What happened at the last Stop and log.

    static let subjects = ["Algebra", "Biology", "Chemistry", "History"] // The subjects to choose from.

    var body: some View { // Rebuilt whenever the timer's tracked properties change.
        VStack(alignment: .leading, spacing: 14) { // Controls stacked top to bottom.
            Picker("Subject", selection: $subject) { // Which subject this block is for.
                ForEach(Self.subjects, id: \.self) { Text(verbatim: $0) } // Subjects are data, shown as written.
            }
            .pickerStyle(.segmented) // All four visible at once.
            .disabled(timer.phase != .ready) // A running block keeps its subject.

            FocusLengthControl(minutes: $savedMinutes) // The custom control from lesson 9.5.
                .disabled(timer.phase != .ready) // A running block keeps its length.
                .onChange(of: savedMinutes) { _, new in timer.setLength(minutes: new) } // Forward the choice to the rules.

            ZStack { // The ring with the clock inside it.
                Circle().stroke(.fill.secondary, lineWidth: 12) // The empty ring.
                Circle().trim(from: 0, to: timer.progress) // The part already studied.
                    .stroke(.tint, style: StrokeStyle(lineWidth: 12, lineCap: .round)) // Accent colour, rounded ends.
                    .rotationEffect(.degrees(-90)) // Start at twelve o'clock.
                VStack(spacing: 4) { // Clock over phase.
                    Text(verbatim: timer.clockText) // "mm:ss", built by the model.
                        .font(.system(size: 44, weight: .semibold, design: .rounded).monospacedDigit()) // Big, steady digits.
                    Text(phaseLabel) // Ready, Running, Paused or Finished, translated.
                        .font(.subheadline) // Smaller than the clock.
                        .foregroundStyle(.secondary) // Quieter than the clock.
                }
            }
            .frame(width: 180, height: 180) // A fixed ring size.
            .frame(maxWidth: .infinity) // Centred in the card.
            .accessibilityElement(children: .ignore) // One element for VoiceOver.
            .accessibilityLabel("Focus timer") // What it is.
            .accessibilityValue(Text(verbatim: timer.clockText).accessibilityTextContentType(.plain)) // Its current reading.

            Toggle("Fast-forward: one second counts as one minute", isOn: $fastForward) // Lets a demo log minutes quickly.
                .font(.subheadline) // Smaller than the controls.

            HStack(spacing: 10) { // The three action buttons.
                Button(primaryTitle, systemImage: timer.phase == .running ? "pause.fill" : "play.fill") { primaryTapped() } // Start, pause or resume.
                    .buttonStyle(.borderedProminent) // The main action stands out.
                    .disabled(timer.phase == .finished) // A finished block can only be logged or reset.
                    .accessibilityIdentifier("startFocusButton") // A stable name for UI tests.
                Button("Stop and log", systemImage: "checkmark") { stopTapped() } // Ends the block and logs it.
                    .buttonStyle(.bordered) // Secondary look.
                    .disabled(timer.phase == .ready) // Nothing to log before starting.
                    .accessibilityIdentifier("stopFocusButton") // A stable name for UI tests.
                Button("Reset", systemImage: "arrow.counterclockwise") { timer.reset() } // Throws the block away.
                    .buttonStyle(.bordered) // Secondary look.
                    .labelStyle(.iconOnly) // Icon only; the title remains its spoken label.
            }

            if let lastResult { // After a Stop and log...
                Text(verbatim: lastResult) // ...say what happened.
                    .font(.subheadline) // Body-sized.
            }
            LabeledContent("Weekly total") { // The weekly total from the planner's rule.
                Text("\(store.weeklyMinutes) min") // Localizable: "%lld min".
                    .monospacedDigit() // Steady digits.
            }
        }
        .onAppear { timer.setLength(minutes: savedMinutes) } // Start from the remembered length.
        .task(id: timer.phase) { await runClock() } // Restarted whenever the phase changes; cancelled when the screen goes.
    }

    /// The translated label for the timer's phase.
    private var phaseLabel: LocalizedStringKey { // A key, so Text looks it up in the String Catalog.
        switch timer.phase { // One label per phase.
        case .ready: "Ready" // Not started.
        case .running: "Running" // Counting.
        case .paused: "Paused" // Stopped for now.
        case .finished: "Finished" // Reached the planned length.
        }
    }

    /// The main button's title, which depends on the phase.
    private var primaryTitle: LocalizedStringKey { // Also translated.
        switch timer.phase { // One title per phase.
        case .running: "Pause" // Running: offer to pause.
        case .paused: "Resume" // Paused: offer to resume.
        default: "Start" // Ready or finished: offer to start.
        }
    }

    /// Start, pause or resume, depending on the phase.
    private func primaryTapped() { // The view forwards; the model decides what is allowed.
        if timer.phase == .running { // Running...
            timer.pause() // ...so pause.
            Logger.timer.info("Paused at \(timer.elapsedSeconds) seconds") // Record the event.
        } else { // Ready or paused...
            timer.start() // ...so start or resume.
            Logger.timer.info("Started \(subject, privacy: .public)") // Subjects are not personal, so they may be public.
        }
    }

    /// Stops the block and logs it into the shared store.
    private func stopTapped() { // The view forwards; the timer and store apply the rules.
        guard let session = timer.stop(subject: subject) else { // Under a minute counted...
            lastResult = String(localized: "Under a minute: nothing was logged.", comment: "Focus timer result when too short") // ...nothing to log.
            return // Stop here.
        }
        store.log(session) // The store saves it through the injected storage.
        lastResult = String(localized: "Logged \(session.minutes) min of \(session.subject).", comment: "Focus timer result after logging") // Confirms what was logged.
    }

    /// Ticks the timer once a second while it runs.
    private func runClock() async { // The clock lives here, outside the rules, so tests can skip it.
        while timer.phase == .running { // Stop as soon as the phase changes.
            try? await Task.sleep(for: .seconds(1)) // Wait a second without blocking the main thread.
            if Task.isCancelled { return } // The screen went away or the phase changed.
            timer.tick(seconds: fastForward ? 60 : 1) // Add time; the model caps it and may finish.
        }
    }
}

#Preview { // The Today screen with an in-memory store.
    ScrollView { FocusTimerView(store: .sample).padding() } // Logging here never touches saved data.
}

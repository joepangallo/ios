// Lesson_7_1_PermissionPrivacy.swift
// Who: students opening lesson 7.1 from the home screen.
// What: live demos of the iOS permission model: this app's real permission
//       statuses, its real Info.plist purpose strings, the course's TrailFinder
//       switch (for real and in practice mode), a replayable permission journey,
//       a priming screen, the Open Settings recovery screen and this app's own
//       privacy manifest.
// Where: pushed by ContentView when the student taps "7.1".
// When: built when the lesson opens; statuses refresh whenever the app becomes active.
// Why: permission is a relationship. Students see each answer iOS can give and the
//      kind, honest response the course recommends for each one.

import SwiftUI // Views, state and the openURL environment action.
import CoreLocation // CLAuthorizationStatus for the practice picker.
import AVFoundation // The camera's authorization status.
import UserNotifications // The notification authorization status.

struct PermissionPrivacyLesson: View { // The screen for lesson 7.1.
    let lesson: Lesson // The lesson row that opened this screen.
    @State private var finder = TrailFinder() // The real finder: asks iOS for real.
    @State private var practice = TrailFinder { _ in } // A practice finder whose request does nothing, so any status can be tried safely.
    @State private var practiceStatus: CLAuthorizationStatus = .denied // The status picked in practice mode.
    @State private var journey = PermissionJourney() // The replayable permission story.
    @State private var cameraState = AccessState(AVCaptureDevice.authorizationStatus(for: .video)) // Camera answer, read at launch of the screen.
    @State private var notificationState: AccessState? // Notification answer; nil until read (reading it is asynchronous).
    @State private var locationKnown = true // The "degrade, do not block" toggle.
    @State private var primerID = 0 // Changing it rebuilds the priming screen, which resets its @State.
    @State private var primerAsksForReal = false // Whether Continue really asks iOS.
    @Environment(\.scenePhase) private var scenePhase // Tells us when the app comes back from Settings or an alert.

    var body: some View { // The whole lesson page.
        LessonPage(lesson: lesson) { // CourseKit's scrolling page.
            sensesCard // Protected resources and their live statuses.
            infoPlistCard // This app's purpose strings.
            statusCheckCard // The course's TrailFinder switch.
            journeyCard // Five journeys through the permission model.
            contextCard // Ask in context and degrade gracefully.
            primerCard // The course's priming screen.
            settingsCard // The course's Open Settings screen.
            manifestCard // This app's privacy manifest.
        }
        .task { await refreshStatuses() } // Read the asynchronous notification status once the page appears.
        .onChange(of: scenePhase) { _, phase in // Runs whenever the app becomes active, inactive or background.
            if phase == .active { Task { await refreshStatuses() } } // Back from Settings or an alert: read the answers fresh.
        }
    }

    // MARK: - Your app borrows the device's senses

    private var sensesCard: some View { // The concept step, with live answers.
        DemoCard(title: "Your app borrows the device's senses", caption: "Protected resources need the person's permission. These are this app's real answers right now.") { // Course step 1.
            statusRow("Location", state: AccessState(finder.status)) // Core Location's answer.
            statusRow("Camera", state: cameraState) // AVFoundation's answer.
            statusRow("Notifications", state: notificationState) // UserNotifications' answer.
            TermRow(term: "Protected resource", text: "Location, camera, microphone, photos, contacts, calendars, Bluetooth, health data, and the right to send notifications.") // Course term.
            TermRow(term: "Authorization status", text: "The current answer your code reads before using the resource: not asked yet, allowed, denied or restricted.") // Course term.
            TermRow(term: "Restricted", text: "A parent or an employer has blocked the resource with Screen Time or device management. The person cannot change it either.") // Course term.
            TermRow(term: "Least privilege", text: "Ask for the smallest access that works: while the app is in use instead of always, one picked photo instead of the whole library.") // Course term.
            CalloutBox(title: "Permission is a relationship", text: "People grant access to apps they trust. Every request spends a little of that trust, so ask only when the benefit is obvious to them.") // Course callout.
        }
    }

    /// One row: a resource, its answer, and what to do about it.
    private func statusRow(_ name: String, state: AccessState?) -> some View { // Shared by the three resources.
        HStack(alignment: .top) { // Icon beside the text.
            Image(systemName: state?.symbol ?? "hourglass") // An hourglass while the answer is still loading.
                .foregroundStyle(.tint) // Accent colored.
                .frame(width: 24) // Icons line up in a column.
            VStack(alignment: .leading, spacing: 2) { // Name and answer above the advice.
                Text(verbatim: "\(name): \(state?.rawValue ?? "Reading...")") // For example "Camera: Not asked yet".
                    .font(.subheadline.weight(.semibold)) // Stands out.
                Text(verbatim: state?.advice ?? "") // What the app should do now.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // Quieter.
            }
        }
    }

    /// Reads every status again, because the person may have changed them in Settings.
    private func refreshStatuses() async { // Called on appear and whenever the app becomes active.
        finder.status = finder.manager.authorizationStatus // Location answers instantly.
        cameraState = AccessState(AVCaptureDevice.authorizationStatus(for: .video)) // So does the camera.
        let settings = await UNUserNotificationCenter.current().notificationSettings() // Notifications answer asynchronously.
        notificationState = AccessState(settings.authorizationStatus) // Translate into the four answers.
    }

    // MARK: - Usage descriptions live in Info.plist

    private var infoPlistCard: some View { // The Info.plist concept step, read from this app.
        DemoCard(title: "Usage descriptions live in Info.plist", caption: "Read from this app's own Info.plist. iOS prints the sentence inside its alert.") { // Course step 2.
            ForEach(UsageDescription.rows(in: Bundle.main.infoDictionary ?? [:])) { row in // One row per key the lesson lists.
                VStack(alignment: .leading, spacing: 2) { // Key, meaning, value.
                    Label(row.key, systemImage: row.sentence == nil ? "minus.circle" : "checkmark.circle.fill") // Present or missing at a glance.
                        .font(.caption.monospaced()) // Keys are code.
                    Text(verbatim: row.meaning) // What the key unlocks.
                        .font(.footnote) // Small print.
                        .foregroundStyle(.secondary) // Quieter.
                    Text(verbatim: row.sentence.map { "\"\($0)\"" } ?? "Not in this app: it does not need this resource.") // The real sentence, or why it is missing.
                        .font(.footnote.italic()) // Quoted text in italics.
                }
            }
            CalloutBox(title: "Missing key, broken feature", text: "Without the key, a location request is silently ignored, and touching the camera crashes the app. Notifications are the exception: they have no key, and iOS writes the alert text itself.", symbol: "exclamationmark.triangle") // Course callout.
        }
    }

    // MARK: - Check the status before you ask

    private var statusCheckCard: some View { // The course's TrailFinder code, running.
        DemoCard(title: "Check the status before you ask", caption: "The real button runs the course's switch on this app's real status. Practice mode feeds the same switch any status, so even .restricted can be tried.") { // Course code step.
            Button("Show trails near me", systemImage: "location") { // The feature that needs location.
                finder.findNearbyTrails() // Reads the status fresh and runs one branch.
            }
            .buttonStyle(.borderedProminent) // The main action of the card.
            Text(verbatim: "Real status: \(AccessState.caseName(finder.status)). \(finder.outcome.message)") // What actually happened.
                .font(.footnote) // Small print.
            if finder.outcome == .showedSettingsPrompt { // Denied for real: offer the way back.
                LocationOffView() // The course's recovery screen.
                    .frame(height: 220) // Enough room for its title, text and button.
            }
            Divider() // Separates real mode from practice mode.
            MenuPicker(title: "Practice status", selection: $practiceStatus) { // Every status the switch handles.
                ForEach([CLAuthorizationStatus.notDetermined, .authorizedWhenInUse, .authorizedAlways, .denied, .restricted], id: \.self) { status in // The five statuses Core Location reports today.
                    Text(verbatim: AccessState.caseName(status)).tag(status) // The Swift spelling as the label.
                }
            }
            CodeListing(lines: TrailFinder.listing, highlighted: practice.outcome.linesRun) // The lines that ran are tinted.
            Text(verbatim: practice.outcome.message) // What the branch does.
                .font(.footnote) // Small print.
                .foregroundStyle(.secondary) // Quieter.
        }
        .onChange(of: practiceStatus, initial: true) { _, status in // At first appearance and on every pick.
            practice.respond(to: status) // The same switch; the practice finder never shows a real alert.
        }
    }

    // MARK: - Walk the whole permission journey

    private var journeyCard: some View { // The course's interactive widget, rebuilt natively.
        DemoCard(title: "Walk the whole permission journey", caption: "A safe replay of Trailhead's story. Notice that the alert appears only from .notDetermined, and only iOS draws it.") { // Course widget step.
            Toggle("Info.plist has the purpose string", isOn: $journey.hasPurposeString) // Empty it and ask: nothing happens.
            Toggle("Screen Time restricts location", isOn: $journey.screenTimeOn) // The .restricted path.
            Toggle("Show a priming screen first", isOn: $journey.primingOn) // One Continue button, then the alert.
            PhonePanel(symbol: journey.alertShowing ? "exclamationmark.bubble" : "figure.hiking", title: "Status: \(journey.status.rawValue)", text: journey.screen) // The simulated phone.
            if journey.alertShowing { // The system alert is up: offer its three buttons.
                HStack { // The alert's buttons side by side.
                    ForEach(AlertAnswer.allCases, id: \.self) { choice in // Allow Once, Allow While Using, Don't Allow.
                        Button(choice.rawValue) { journey.answer(choice) } // Answer the alert.
                            .buttonStyle(.bordered) // Looks tappable.
                            .font(.caption) // Three buttons must fit.
                    }
                }
            } else if journey.primingShowing { // The priming screen is up.
                Button("Continue") { journey.continuePriming() } // Its one and only button.
                    .buttonStyle(.borderedProminent) // The expected next step.
            } else { // Normal screen: the journey's actions.
                HStack { // Two common actions side by side.
                    Button("Show trails near me") { journey.tapFeature() } // The tap that triggers the check.
                        .buttonStyle(.borderedProminent) // Main action.
                    Button("Background") { journey.sendToBackground() } // Leave the app and come back.
                        .buttonStyle(.bordered) // Secondary.
                }
                HStack { // Recovery and reset.
                    Button("Open Settings, turn it on") { journey.turnOnInSettings() } // Only Settings can reverse a denial.
                        .buttonStyle(.bordered) // Secondary.
                        .disabled(journey.status != .denied) // Only makes sense after Don't Allow.
                    Button("Reset") { journey.reset() } // Start the story again.
                        .buttonStyle(.bordered) // Secondary.
                }
            }
            ConsoleView(lines: journey.log) // The step-by-step log, oldest first.
        }
    }

    // MARK: - Ask in context, prime honestly, recover gracefully

    private var contextCard: some View { // The concept step about timing and recovery.
        DemoCard(title: "Ask in context, prime honestly, recover gracefully", caption: "Ask right after a tap that clearly needs the resource. Flip the switch to see degrade, do not block.") { // Course concept step.
            TermRow(term: "One shot", text: "iOS shows its alert once per install. After Don't Allow, asking again does nothing; only Settings can change the answer.") // Course point.
            TermRow(term: "Degrade, do not block", text: "When access is denied, keep the rest of the app working: list trails alphabetically instead of by distance.") // Course point.
            TermRow(term: "Show the way back", text: "Offer a button that opens your app's page in Settings, and say what will improve.") // Course point.
            Toggle("Location allowed", isOn: $locationKnown) // Pretend location is on or off.
            ForEach(TrailSorter.sorted(Trail.samples, from: locationKnown ? Trail.sampleSpot : nil)) { trail in // Sorted by distance, or A to Z.
                HStack { // Name on the left, detail on the right.
                    Text(verbatim: trail.name) // The trail.
                    Spacer() // Pushes the detail to the right edge.
                    Text(verbatim: locationKnown ? DistanceText.text(meters: trail.location.distance(from: Trail.sampleSpot)) : "\(trail.lengthKm) km long") // Distance when known, length otherwise.
                        .foregroundStyle(.secondary) // Quieter than the name.
                }
                .font(.subheadline) // Compact rows.
            }
            CalloutBox(title: "Apple's rule for priming screens", text: "A pre-permission screen should have only one button, and it should open the system alert. A Not Now or Skip button there can feel manipulative.", symbol: "paintbrush") // Course design callout.
        }
    }

    // MARK: - A priming screen in SwiftUI

    private var primerCard: some View { // The course's LocationPrimer, live.
        DemoCard(title: "A priming screen in SwiftUI", caption: "The course's LocationPrimer. Turn on the switch to make Continue really ask iOS, as a real app would.") { // Course code step.
            Toggle("Continue really asks for location", isOn: $primerAsksForReal) // Off: the message only; on: the real request too.
            LocationPrimer(onContinue: primerAsksForReal ? { finder.findNearbyTrails() } : {}) // The view from the course.
                .id(primerID) // A new id makes SwiftUI build a fresh primer with continued = false.
                .frame(maxWidth: .infinity) // Centered in the card.
            Button("Show the primer again") { primerID += 1 } // Resets the primer.
                .buttonStyle(.bordered) // Secondary.
        }
    }

    // MARK: - Send people to Settings

    private var settingsCard: some View { // The course's LocationOffView, live.
        DemoCard(title: "Send people to Settings", caption: "The course's LocationOffView. Open Settings really opens this app's page in the Settings app.") { // Course code step.
            LocationOffView() // The recovery screen.
                .frame(height: 220) // Enough room for every part.
        }
    }

    // MARK: - Privacy manifests and App Store privacy labels

    private var manifestCard: some View { // The concept step, read from this app's own manifest.
        DemoCard(title: "Privacy manifests and App Store privacy labels", caption: "Read from this app's PrivacyInfo.xcprivacy file, which Xcode copied into the app bundle.") { // Course concept step.
            if let manifest = PrivacyManifest.load() { // The file was found and read.
                Text(verbatim: "Tracking: \(manifest.tracking ? "yes" : "no")") // NSPrivacyTracking.
                Text(verbatim: "Tracking domains: \(manifest.trackingDomains.isEmpty ? "none" : manifest.trackingDomains.joined(separator: ", "))") // NSPrivacyTrackingDomains.
                Text(verbatim: "Collected data types: \(manifest.collectedDataTypes)") // NSPrivacyCollectedDataTypes.
                Text(verbatim: "Required-reason APIs: \(manifest.accessedAPICategories.isEmpty ? "none" : manifest.accessedAPICategories.joined(separator: ", "))") // NSPrivacyAccessedAPITypes.
            } else { // No manifest in the bundle.
                Text("No privacy manifest found in this app.") // Honest fallback.
            }
            TermRow(term: "Required-reason APIs", text: "APIs that could fingerprint a device, such as UserDefaults, file timestamps and free disk space. Your manifest says why you call them.") // From the concept body.
            TermRow(term: "App Privacy details", text: "The \"nutrition label\" on your App Store page, filled in through App Store Connect: what data you collect and whether it is linked to the person.") // Course point.
            TermRow(term: "Tracking", text: "Linking data from your app with data from other companies' apps or websites, for advertising or data brokers.") // Course point.
            TermRow(term: "App Tracking Transparency", text: "Before tracking, add NSUserTrackingUsageDescription and call ATTrackingManager to ask. Most apps never need it.") // Course point.
            CalloutBox(title: "Labels must match reality", text: "You write the labels yourself, and Apple expects them to match what the app and every SDK inside it actually do.", symbol: "checkmark.seal") // Course callout.
        }
    }
}

/// The course's priming screen, with one addition: an optional action for Continue.
struct LocationPrimer: View { // From "A priming screen in SwiftUI".
    var onContinue: () -> Void = {} // Added for this app: what Continue does besides swapping the message.
    @State private var continued = false // Whether the person tapped Continue.

    var body: some View { // Rebuilt when continued changes.
        VStack(spacing: 16) { // Icon, headline, then message or button.
            Image(systemName: "location.fill") // The icon people link with location.
                .font(.largeTitle) // Large.
            Text("Trailhead sorts trails by distance.") // The benefit, first.
                .font(.headline) // Bold.
            if continued { // After the tap.
                Text("The system alert appears now.") // Marks the hand-off to iOS.
            } else { // Before the tap.
                Button("Continue") { continued = true; onContinue() } // The only button: swap the message, then run the action.
                    .buttonStyle(.borderedProminent) // The expected next step.
            }
        }
    }
}

/// The course's recovery screen for denied location.
struct LocationOffView: View { // From "Send people to Settings".
    @Environment(\.openURL) private var openURL // The system's open-a-link action.

    var body: some View { // The empty-state layout.
        ContentUnavailableView { // SwiftUI's standard empty state.
            Label("Location Is Off", systemImage: "location") // Names the problem.
        } description: { // The second closure: the explanation.
            Text("You can still browse every trail.") // Degrade, do not block.
        } actions: { // The third closure: the buttons.
            Button("Open Settings", action: openSettings) // The one action that fixes it.
                .buttonStyle(.borderedProminent) // Emphasized.
        }
    }

    private func openSettings() { // Builds the Settings link and opens it.
        let link = UIApplication.openSettingsURLString // The special link to this app's page in Settings.
        guard let url = URL(string: link) else { return } // Turn the string into a URL, or stop quietly.
        openURL(url) // Leaves the app and opens Settings.
    }
}

#Preview { // Shows the lesson in Xcode's canvas.
    NavigationStack { // Gives the page its title bar.
        PermissionPrivacyLesson(lesson: ContentView.lessons[0]) // Lesson 7.1.
    }
}

// Lesson_7_7_WidgetsIntentsNotifications.swift
// Who: students opening lesson 7.7 from the home screen.
// What: the Water widget's timeline (the real widget lives in the DeviceLabWidget
//       extension), a day-long widget simulator for every reload policy, the course's
//       LogWaterIntent run right here, a hike Live Activity on the Lock Screen and in
//       the Dynamic Island, and the course's sunset reminder as a real local notification.
// Where: pushed by ContentView when the student taps "7.7".
// When: built when the lesson opens; notification permission is asked only when the
//       student turns the reminder on.
// Why: people meet your app in many places besides its own screen, and each of those
//      places has its own rules about when your code may run.

import SwiftUI // Views and state.
import WidgetKit // WidgetCenter.
import UserNotifications // The notification center.

struct WidgetsIntentsNotificationsLesson: View { // The screen for lesson 7.7.
    let lesson: Lesson // The lesson row that opened this screen.
    @State private var planStart = Date.now // When the timeline card's plan starts.
    @State private var installedWidgets = "Tap Count to ask WidgetKit." // How many Water widgets are on the Home Screen.
    @State private var day = WidgetDaySimulator() // The day-long simulation.
    @State private var clock = 480.0 // The clock slider, in minutes after midnight.
    @State private var store = WaterStore.shared // The store LogWaterIntent writes to.
    @State private var intentGlasses = 1 // The intent's Glasses parameter.
    @State private var intentDialog = "" // What Siri would say.
    @State private var hike = HikeActivityController() // Starts, updates and ends the Live Activity.
    @State private var notificationState: AccessState? // The real notification answer.
    @State private var quickDelay = true // 10 seconds for the demo, or the course's 30 minutes.
    @State private var reminderMessage = "" // What scheduling did.
    @State private var pending: [String] = [] // Identifiers of scheduled notifications.

    var body: some View { // The whole lesson page.
        LessonPage(lesson: lesson) { // CourseKit's scrolling page.
            outsideCard // Your app can appear outside its own window.
            timelineCard // A timeline of snapshots.
            declareCard // Declare the widget.
            dayCard // Watch a widget across a day.
            intentCard // App Intents.
            liveActivityCard // Live Activities in brief.
            notificationCard // Schedule a local notification.
        }
        .task { // When the page appears.
            UNUserNotificationCenter.current().delegate = ForegroundBanners.shared // Let banners show while the app is open.
            await refreshNotifications() // Read the current answer and the pending list.
        }
    }

    // MARK: - Your app can appear outside its own window

    private var outsideCard: some View { // The first concept step.
        DemoCard(title: "Your app can appear outside its own window", caption: "Most of these run as app extensions: small separate programs bundled inside your app. This app bundles one: DeviceLabWidget.") { // Course concept step.
            TermRow(term: "Widgets", text: "Glanceable snapshots of your app's data on the Home Screen, Lock Screen and StandBy, built with WidgetKit.") // Course term.
            TermRow(term: "Live Activities", text: "A view of an event in progress, such as a delivery or a hike, that updates on the Lock Screen. Built with ActivityKit.") // Course term.
            TermRow(term: "App Intents", text: "Actions your app offers to Siri, Shortcuts, Spotlight, the Action button and Control Center controls.") // Course term.
            TermRow(term: "Notifications", text: "Alerts your app schedules on the device or your server sends, built with UserNotifications.") // Course term.
            CalloutBox(title: "Sharing data with an extension", text: "An extension has its own sandbox. Sharing data needs the App Groups capability on both targets, which a free Personal Team cannot add, so this app's widget shows a fixed stand-in count of 3.") // Course callout, and what this app does.
        }
    }

    // MARK: - A timeline of snapshots

    private var timelineCard: some View { // The course's getTimeline, with the entries it plans.
        let entries = WaterTimelineBuilder.entries(start: planStart, glasses: 3) // The same math the widget runs, with its stand-in count.
        return DemoCard(title: "A timeline of snapshots", caption: "iOS asks the provider for a timeline: entries, each a snapshot with the date it should appear, plus a policy that says when to ask again.") { // Course code step.
            CodeListing(lines: Self.getTimelineListing) // The course's code.
            ForEach(entries, id: \.date) { entry in // One row per planned entry.
                Text(verbatim: "\(entry.date.formatted(date: .omitted, time: .shortened)): \(entry.glasses) of 8 glasses") // When and what.
                    .font(.subheadline.monospacedDigit()) // Times line up.
            }
            Text("Policy .atEnd: iOS asks for a new timeline after the last entry's date passes.") // The policy.
                .font(.footnote) // Small print.
                .foregroundStyle(.secondary) // Quieter.
            Button("Plan from now") { planStart = .now } // Rebuild from the current time.
                .buttonStyle(.bordered) // Secondary.
        }
    }

    /// The core of the course's getTimeline, as printed in the lesson.
    static let getTimelineListing = [ // Copied from the course.
        "let glasses = WaterStore.shared.glassesToday", // Read the count.
        "let step: TimeInterval = 3600 // 1 hour", // Spacing.
        "let start = Date.now", // First entry: now.
        "let entries = (0..<4).map { i in", // Four entries.
        "    WaterEntry(date: start + Double(i) * step,", // Each entry's date.
        "               glasses: glasses)", // The same count.
        "}", // End of map.
        "completion(Timeline(entries: entries,", // Hand it back.
        "                    policy: .atEnd))", // Ask again at the end.
    ]

    // MARK: - Declare the widget

    private var declareCard: some View { // Where the real widget is, and how to add it.
        DemoCard(title: "Declare the widget", caption: "WaterWidget in the DeviceLabWidget folder joins the provider to a view with StaticConfiguration(kind: \"Water\"), and names it for the widget gallery.") { // Course code step.
            Text("To add it: go to the Home Screen, touch and hold an empty spot, tap Edit, then Add Widget, and search for Device Lab. It offers .systemSmall and .systemMedium.") // How to see the real widget.
                .font(.subheadline) // Readable.
            HStack { // Two WidgetKit calls.
                Button("Count widgets") { // Asks WidgetKit which widgets are installed.
                    Task { // The call is asynchronous.
                        let all = (try? await WidgetCenter.shared.currentConfigurations()) ?? [] // Every installed widget from this app.
                        installedWidgets = "Water widgets on screen: \(all.filter { $0.kind == "Water" }.count)" // Only the Water kind.
                    }
                }
                .buttonStyle(.bordered) // Secondary.
                Button("Reload Water") { WidgetCenter.shared.reloadTimelines(ofKind: "Water") } // The kind string from StaticConfiguration.
                    .buttonStyle(.bordered) // Secondary.
            }
            Text(verbatim: installedWidgets) // The answer.
                .font(.footnote) // Small print.
        }
    }

    // MARK: - Watch a widget across a day

    private var dayCard: some View { // The course's timeline widget, rebuilt natively.
        DemoCard(title: "Watch a widget across a day", caption: "Scrub the clock. Log a glass in the app and notice that the widget keeps its old snapshot until a reload happens. Try each policy and spacing.") { // Course widget step.
            LabeledSlider(title: "Clock", value: $clock, range: 360...1380, step: 15) // 6:00 to 23:00 in quarter hours.
                .onChange(of: clock) { _, minutes in day.advance(to: Int(minutes)) } // Time passes in the simulation.
            HStack { // App and widget side by side.
                PhonePanel(symbol: "iphone", title: "App: \(day.appGlasses)", text: "Clock \(WidgetDaySimulator.clockLabel(day.clock))") // What the app knows.
                PhonePanel(symbol: "drop.fill", title: "Widget: \(day.widgetGlasses)", text: "Entry \(day.currentEntry.map { WidgetDaySimulator.clockLabel($0.minute) } ?? "-")", tone: day.widgetGlasses == day.appGlasses ? .ok : .warn) // The frozen snapshot.
            }
            MenuPicker(title: "Policy", selection: $day.policy) { // Takes effect with the next timeline.
                ForEach(ReloadPolicyChoice.allCases) { policy in Text(verbatim: policy.rawValue).tag(policy) } // Three policies.
            }
            Picker("Spacing", selection: $day.stepMinutes) { // Minutes between entries in the next timeline.
                Text("30 min").tag(30) // Dense.
                Text("1 hour").tag(60) // The course's spacing.
                Text("2 hours").tag(120) // Sparse.
            }
            .pickerStyle(.segmented) // Side by side.
            HStack { // The two app actions.
                Button("Log a glass") { day.logGlass() } // The app's data changes.
                    .buttonStyle(.bordered) // Secondary.
                Button("reloadTimelines") { // The app asks iOS to refresh.
                    day.reloadTimelines() // In the simulation...
                    WidgetCenter.shared.reloadTimelines(ofKind: "Water") // ...and for the real widget too.
                }
                .buttonStyle(.borderedProminent) // Main action.
            }
            Text(verbatim: "Timeline: " + day.timeline.map { WidgetDaySimulator.clockLabel($0.minute) }.joined(separator: ", ") + ". Reloads so far: \(day.reloads).") // The planned entries.
                .font(.footnote.monospacedDigit()) // Times line up.
            ConsoleView(lines: Array(day.log.suffix(5))) // The last five events.
            Text("The system chooses exact reload times: a frequently viewed widget typically gets about 40 to 70 refreshes a day.") // From the course.
                .font(.footnote) // Small print.
                .foregroundStyle(.secondary) // Quieter.
        }
    }

    // MARK: - App Intents

    private var intentCard: some View { // The course's LogWaterIntent, run here.
        DemoCard(title: "App Intents: actions Siri and Shortcuts can run", caption: "The course's LogWaterIntent and WaterShortcuts. Run the intent here, or find Log Water under Device Lab in the Shortcuts app.") { // Course code step.
            Text(verbatim: "WaterStore: \(store.glassesToday) glasses today") // The store the intent writes to.
                .font(.headline) // Stands out.
            Stepper("Glasses: \(intentGlasses)", value: $intentGlasses, in: 1...5) // The @Parameter value.
            Button("Run LogWaterIntent", systemImage: "drop") { // Runs perform() directly.
                Task { // perform() is async.
                    let intent = LogWaterIntent() // A fresh intent, as the system would make.
                    intent.glasses = intentGlasses // Fill in the parameter, as Shortcuts would.
                    _ = try? await intent.perform() // Do the work.
                    intentDialog = "Siri would say: Logged \(intentGlasses) glasses." // The dialog from the course.
                }
            }
            .buttonStyle(.borderedProminent) // Main action.
            if !intentDialog.isEmpty { Text(verbatim: intentDialog).font(.footnote) } // The confirmation.
            Text("On a device, say \"Log water in Device Lab\". Every phrase must name the app, so Siri knows which app should handle it.") // The AppShortcutsProvider phrase.
                .font(.footnote) // Small print.
                .foregroundStyle(.secondary) // Quieter.
        }
    }

    // MARK: - Live Activities in brief

    private var liveActivityCard: some View { // The course's hike activity, step by step.
        DemoCard(title: "Live Activities in brief", caption: "NSSupportsLiveActivities is YES in this app's Info.plist. Start the hike, then lock the Simulator (Command-L) or look at the Dynamic Island.") { // Course code step.
            Label(hike.activitiesEnabled ? "Live Activities are allowed for this app" : "Live Activities are turned off for this app in Settings", systemImage: hike.activitiesEnabled ? "checkmark.circle" : "xmark.circle") // ActivityAuthorizationInfo.
                .font(.subheadline) // Readable.
            HStack { // The three steps of trackHike().
                Button("Start") { hike.start() } // Activity.request.
                    .disabled(hike.isRunning) // One hike at a time.
                Button("Halfway") { Task { await hike.walk(to: 3.2) } } // activity.update.
                    .disabled(!hike.isRunning) // Needs a running hike.
                Button("Finish") { Task { await hike.finish() } } // activity.end.
                    .disabled(!hike.isRunning) // Needs a running hike.
            }
            .buttonStyle(.bordered) // Every button in the row.
            Text(verbatim: hike.message) // What happened.
                .font(.footnote) // Small print.
            Button("Run trackHike() all at once") { Task { try? await trackHike() } } // The course's function: start, update and end immediately.
                .buttonStyle(.bordered) // Secondary.
            Text("A server can also update an activity through push notifications while the app is closed; that needs the paid Push Notifications capability.") // From the lesson, with this sample's limit.
                .font(.footnote) // Small print.
                .foregroundStyle(.secondary) // Quieter.
        }
    }

    // MARK: - Schedule a local notification

    private var notificationCard: some View { // The course's scheduleSunsetReminder(), live.
        let daily = SunsetReminder.dailyTrigger(hour: 18, minute: 0) // The try-it's calendar trigger.
        return DemoCard(title: "Schedule a local notification", caption: "The course's sunset reminder. Notifications need no Info.plist key: iOS writes the alert text itself. The first tap shows the system alert.") { // Course code step.
            Text(verbatim: "Notifications: \(notificationState?.rawValue ?? "Reading...")") // The real answer.
                .font(.subheadline) // Readable.
            Toggle("Fire after 10 seconds (off: the course's 30 minutes)", isOn: $quickDelay) // A delay you can wait for.
            Button("Turn on the sunset reminder", systemImage: "bell") { // Ask, then schedule.
                Task { // Both steps are asynchronous.
                    do { // Scheduling can throw.
                        let granted = try await scheduleSunsetReminder(after: quickDelay ? 10 : 30 * 60) // The course's function.
                        reminderMessage = granted ? "Scheduled \"Sunset soon\". It arrives even if you leave the app." : "Not allowed. Turn notifications on in Settings to get reminders." // The outcome.
                    } catch { // An invalid trigger, for example.
                        reminderMessage = "Could not schedule: \(error.localizedDescription)" // Say why.
                    }
                    await refreshNotifications() // Show the new status and pending list.
                }
            }
            .buttonStyle(.borderedProminent) // Main action.
            if !reminderMessage.isEmpty { Text(verbatim: reminderMessage).font(.footnote) } // The result.
            Text(verbatim: "Pending: \(pending.isEmpty ? "none" : pending.joined(separator: ", "))") // Scheduled but not yet delivered.
                .font(.footnote) // Small print.
            Button("Cancel the reminder") { // Removes the pending request by its identifier.
                UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [SunsetReminder.identifier]) // "sunset".
                Task { await refreshNotifications() } // Show the empty list.
            }
            .buttonStyle(.bordered) // Secondary.
            Text(verbatim: "Try-it: UNCalendarNotificationTrigger(dateMatching: hour \(daily.dateComponents.hour ?? 0), minute \(daily.dateComponents.minute ?? 0), repeats: \(daily.repeats)) fires every day at 18:00.") // The calendar trigger's parts.
                .font(.footnote) // Small print.
                .foregroundStyle(.secondary) // Quieter.
        }
    }

    /// Reads the notification answer and the pending requests.
    private func refreshNotifications() async { // Called on appear and after changes.
        let center = UNUserNotificationCenter.current() // This app's center.
        notificationState = AccessState(await center.notificationSettings().authorizationStatus) // The four answers.
        pending = await center.pendingNotificationRequests().map(\.identifier) // Just the names.
    }
}

#Preview { // Shows the lesson in Xcode's canvas.
    NavigationStack { // Gives the page its title bar.
        WidgetsIntentsNotificationsLesson(lesson: ContentView.lessons[6]) // Lesson 7.7.
    }
}

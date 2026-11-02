// Lesson_6_2_SettingsWithAppStorage.swift
// Who: the student, after tapping lesson 6.2 on the home screen.
// What: the UserDefaults API run for real, the course's onboarding flag, theme picker and
//       settings form, an app-wide color scheme picker, stored-value validation, and the
//       "what does not belong in UserDefaults" quick test.
// Where: pushed from ContentView. The non-view logic lives in Support/UserDefaultsDemo.swift
//        and Support/Theme.swift.
// When: every control writes UserDefaults immediately; the values survive relaunches.
// Why: settings are the simplest persistent data, and @AppStorage makes them one line.

import SwiftUI // Views and @AppStorage.

struct SettingsWithAppStorageLesson: View { // The lesson 6.2 screen.
    let lesson: Lesson // Which lesson this page shows.
    @State private var apiOutput = Transcript() // What the API demo printed.
    @State private var removeBeforeReading = false // The course's first Try It.
    @State private var savedKeys: [String] = [] // The "keys this app has saved" list.
    @State private var candidate = DefaultsCandidate.accessToken // The value being checked in the last card.
    @AppStorage(SettingsKey.appearance) private var appearance = ThemeChoice.system.rawValue // The app-wide color scheme.
    @AppStorage(SettingsKey.textSize) private var textSize = 17.0 // The same key the settings form uses.

    var body: some View { // Rebuilt whenever state or a stored setting changes.
        LessonPage(lesson: lesson) { // The shared page layout.
            DemoCard(title: "UserDefaults: a small settings file", caption: "Values live in a plist in Library/Preferences. Missing keys read as a fallback: false, 0, 0.0, or nil.") { // Course concept.
                Text("Good fits: preferences and flags. Value types: Bool, Int, Double, String, Date, Data, URL, and arrays or dictionaries of them.") // The course's points.
                    .font(.footnote) // Small print.
                Button("Show the keys this app has saved") { savedKeys = readSavedKeys() } // Reads UserDefaults.standard.
                ConsoleView(lines: savedKeys) // One line per key.
            }

            DemoCard(title: "The UserDefaults API", caption: "The course's snippet, run on a separate defaults file so it never touches this app's real settings.") { // Course code step.
                Toggle("Remove username before reading it", isOn: $removeBeforeReading) // Try It: predict the value of name.
                Button("Run") { // Runs the snippet on a fresh suite.
                    apiOutput = UserDefaultsAPIDemo.run(on: UserDefaultsAPIDemo.freshDefaults(), removeBeforeReading: removeBeforeReading) // Fresh every time.
                }
                .buttonStyle(.borderedProminent) // The main action.
                ConsoleView(lines: apiOutput.lines) // What it printed.
            }

            DemoCard(title: "An onboarding flag that persists", caption: "Tap Get Started, then quit the app from the app switcher and open it again: Home is still showing.") { // Course code step.
                OnboardingView() // The course's ContentView, renamed because this app already has a ContentView.
                    .frame(maxWidth: .infinity, minHeight: 140) // Centered in a fixed area, like a small phone screen.
            }

            DemoCard(title: "A theme picker", caption: "The course's picker saves a String. This app's App struct reads the same key, so the whole app's accent color follows your choice.") { // Course code step.
                ThemeSettingsView() // The course's view, unchanged.
                Text("App color scheme").font(.subheadline.bold()) // The second picker's heading.
                Picker("Appearance", selection: $appearance) { // Saves "system", "light" or "dark".
                    ForEach(ThemeChoice.allCases) { Text($0.title).tag($0.rawValue) } // The tag is the String that gets saved.
                }
                .pickerStyle(.segmented) // Three short choices.
            }

            DemoCard(title: "A profile and settings form", caption: "A String, a Bool and a Double, each under its own key. Change them, relaunch, and nothing resets.") { // Course code step.
                SettingsView() // The course's form, unchanged.
                    .frame(height: 390) // A Form scrolls itself, so it needs a fixed height inside this page; 390 points shows every row.
                    .clipShape(.rect(cornerRadius: 12)) // Rounded corners to match the card.
                Text("Validating stored values").font(.subheadline.bold()) // The course's second Try It.
                Text(verbatim: "Stored textSize: \(textSize)") // The raw stored Double.
                    .font(.footnote.monospaced()) // Fixed-width, like output.
                HStack { // Two buttons side by side.
                    Button("Store 40") { textSize = 40 } // A value outside the stepper's 12...28 range.
                    Button("Clamp to 12...28") { textSize = TextSizeRule.clamped(textSize) } // Pulls it back into range.
                }
                .buttonStyle(.bordered) // Secondary actions.
                Text("A stepper does not fix a value that is already out of range, so check stored values when you read them.") // The lesson of the Try It.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // A note.
            }

            DemoCard(title: "What does not belong in UserDefaults", caption: "The quick test: would you happily show it on a settings screen, and is it no more than a few kilobytes?") { // Course concept.
                Picker("Value", selection: $candidate) { // The value to check.
                    ForEach(DefaultsCandidate.allCases) { Text($0.rawValue).tag($0) } // Six candidates.
                }
                .pickerStyle(.menu) // A compact menu.
                Text(DefaultsCheck.verdict(for: candidate).message) // The verdict for the chosen value.
                    .font(.callout) // Readable.
                    .padding(10) // Room inside the box.
                    .frame(maxWidth: .infinity, alignment: .leading) // Full width.
                    .background(.fill.tertiary, in: .rect(cornerRadius: 10)) // A soft box.
            }
        }
        .task { // Runs once when the screen appears, so no card starts empty.
            savedKeys = readSavedKeys() // Lists the keys as they are right now.
            apiOutput = UserDefaultsAPIDemo.run(on: UserDefaultsAPIDemo.freshDefaults()) // Runs the snippet once.
        }
    }

    /// Describes the preferences plist, then lists every key this app uses with its saved value.
    private func readSavedKeys() -> [String] { // Reads UserDefaults.standard.
        let plist = URL.libraryDirectory.appending(path: "Preferences/\(Bundle.main.bundleIdentifier ?? "app").plist") // Where iOS keeps this app's defaults.
        let size = (try? plist.resourceValues(forKeys: [.fileSizeKey]))?.fileSize // nil until iOS first writes the file.
        let header = ContainerPaths.short(plist) + (size.map { ", \($0) bytes" } ?? ", not written yet") // The file and its size.
        let keys = SettingsKey.all.map { key in // One line per key.
            if let value = UserDefaults.standard.object(forKey: key) { // object(forKey:) returns nil for a missing key.
                return "\(key) = \(value)" // The saved value.
            }
            return "\(key): never saved" // Reading it gives the fallback.
        }
        return [header] + keys // The file first, then the keys.
    }
}

/// The course's onboarding view. The course calls it ContentView; it is renamed here because
/// this app's home screen is already named ContentView.
struct OnboardingView: View { // A view that remembers whether onboarding is finished.
    @AppStorage("hasFinishedOnboarding") var isOnboarded = false // false is only the fallback for a key never saved.

    var body: some View { // Rebuilt whenever isOnboarded changes.
        VStack(spacing: 16) { // Stacks the content with 16 points between items.
            if isOnboarded { // The stored flag picks the screen.
                Label("Home", systemImage: "house") // What a returning user sees.
                    .font(.largeTitle) // The large title text style.
                Button("Replay onboarding") { // A way back to the welcome screen.
                    isOnboarded = false // Saves false and refreshes the view.
                }
            } else { // Onboarding not finished yet.
                Text("Welcome to Trailhead").font(.title) // The course's hiking app.
                Button("Get Started") { // Finishes onboarding.
                    isOnboarded = true // Saves true; every later launch starts at Home.
                }
                .buttonStyle(.borderedProminent) // The single main action.
            }
        }
    }
}

/// The course's theme picker, exactly as written.
struct ThemeSettingsView: View { // Saves the accent name as a String.
    @AppStorage("accentName") private var accentName = "blue" // The saved name; blue until the user picks.
    let tints = ["blue": Color.blue, "green": .green, "pink": .pink] // Turns a saved name into a color.

    var body: some View { // Rebuilt when accentName changes.
        VStack(spacing: 24) { // Picker over icon.
            Picker("Accent", selection: $accentName) { // The binding saves each choice.
                Text("Blue").tag("blue") // The tag is the String that gets saved.
                Text("Green").tag("green") // Same for green.
                Text("Pink").tag("pink") // Same for pink.
            }
            .pickerStyle(.segmented) // Three choices side by side.
            Image(systemName: "paintpalette") // A palette icon.
                .font(.system(size: 72)) // Big enough to show the color.
                .foregroundStyle(tints[accentName] ?? .blue) // Unknown names fall back to blue.
        }
        .padding() // Space around the content.
    }
}

/// The course's profile and settings form, exactly as written.
struct SettingsView: View { // Three settings of three types.
    @AppStorage("username") private var username = "" // A String.
    @AppStorage("showTips") private var showTips = true // A Bool.
    @AppStorage("textSize") private var textSize = 17.0 // A Double.

    var body: some View { // Rebuilt when any setting changes.
        Form { // Groups controls the way the Settings app does.
            TextField("Your name", text: $username) // Each keystroke is saved.
            Toggle("Show tips", isOn: $showTips) // Saved on every flip.
            Stepper("Text size: \(Int(textSize))", // Shows the size as a whole number.
                    value: $textSize, in: 12...28) // Saved on every tap, within 12 to 28.
            Section("Preview") { // Shows the settings in use.
                Text("Hello, \(username)") // Uses the saved name.
                    .font(.system(size: textSize)) // Uses the saved size.
                if showTips { // Uses the saved flag.
                    Text("Relaunch the app: nothing resets.") // The tip, adapted from the course for a real app.
                }
            }
        }
    }
}

#Preview { // Shows this lesson in Xcode's canvas.
    NavigationStack { SettingsWithAppStorageLesson(lesson: ContentView.lessons[1]) } // Inside a stack, so the title shows.
}

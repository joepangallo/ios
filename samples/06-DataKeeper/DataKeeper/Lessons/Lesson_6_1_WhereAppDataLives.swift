// Lesson_6_1_WhereAppDataLives.swift
// Who: the student, after tapping lesson 6.1 on the home screen.
// What: the six places data can live, this install's real sandbox folders, what survives
//       a cleanup, a restore or a delete, a draft that saves itself when the app goes to
//       the background, and an advisor that picks the right home for any data.
// Where: pushed from ContentView. The helpers live in Support/Sandbox.swift and
//        Support/StorageAdvisor.swift.
// When: each card runs when the student taps its buttons or leaves the app.
// Why: deciding where data lives comes before writing any storage code.

import SwiftUI // Views, @State, @AppStorage and the scene phase.

struct WhereAppDataLivesLesson: View { // The lesson 6.1 screen.
    let lesson: Lesson // Which lesson this page shows, for its title and summary.
    @State private var memoryTaps = 0 // Lives only in memory, so it resets on every launch.
    @AppStorage(SettingsKey.storedTaps) private var storedTaps = 0 // Lives in UserDefaults, so it survives relaunches.
    @State private var selectedFolder = SandboxFolder.documents // The folder whose details are showing.
    @State private var event = ContainerEvent.lowStorage // The event in the "what survives" table.
    @State private var exclusionLog = Transcript() // What the backup-exclusion demo printed.

    var body: some View { // Rebuilt whenever any state above changes.
        LessonPage(lesson: lesson) { // The shared scrolling page layout.
            DemoCard(title: "Six places your data can live", caption: "Memory is fast but temporary; the other five places are persistent.") { // Course step 1.
                ForEach(StoragePlaceRow.all) { place in // One row per place.
                    StoragePlaceRowView(place: place) // Icon, name and explanation.
                }
                Divider() // Separates the list from the live demo.
                Text("Memory versus UserDefaults").font(.subheadline.bold()) // A small heading for the demo.
                HStack { // The two counters side by side.
                    CounterBox(title: "@State (memory)", value: memoryTaps) // Resets when the app is ended.
                    CounterBox(title: "@AppStorage (disk)", value: storedTaps) // Comes back after a relaunch.
                }
                Button("Tap both counters") { // Adds one to each counter.
                    memoryTaps += 1 // Changes memory only.
                    storedTaps += 1 // Also writes the new value to UserDefaults.
                }
                .buttonStyle(.borderedProminent) // The main action of the card.
                Text("Now swipe the app away in the app switcher and open it again: the memory count starts at 0, the stored count does not.") // How to see the difference.
                    .font(.footnote) // Smaller than the demo.
                    .foregroundStyle(.secondary) // An instruction, not output.
            }

            DemoCard(title: "The app sandbox", caption: "Every install gets its own private container. Tap a folder to see what belongs there and the Swift property that finds it.") { // Course step 2.
                LabeledContent("This install's container", value: String(ContainerPaths.containerName.prefix(8)) + "...") // The random folder name, shortened to fit.
                    .font(.footnote) // Small, like a detail.
                ForEach(SandboxFolder.allCases) { folder in // One button per folder.
                    Button { // Selecting a folder shows its details below.
                        selectedFolder = folder // Remembers the choice.
                    } label: { // What the button looks like.
                        HStack { // Icon, path and item count in one line.
                            Image(systemName: folder == selectedFolder ? "folder.fill" : "folder") // A filled folder marks the selection.
                            Text(folder.path) // The folder's path in the container.
                            Spacer() // Pushes the count to the right edge.
                            Text(folder.itemCount.map { $0 == 1 ? "1 item" : "\($0) items" } ?? "not created yet") // Asks the real file system.
                                .font(.caption) // Small print.
                                .foregroundStyle(.secondary) // Quieter than the name.
                        }
                    }
                    .buttonStyle(.plain) // Looks like a row, not a blue link.
                }
                VStack(alignment: .leading, spacing: 6) { // The selected folder's details.
                    Text(selectedFolder.swiftProperty) // How Swift finds the folder.
                        .font(.system(.footnote, design: .monospaced)) // Code is shown in a fixed-width font.
                    Text(selectedFolder.belongsHere) // What belongs there.
                        .font(.footnote) // Small print.
                    Text(verbatim: ContainerPaths.short(selectedFolder.url)) // The real path on this device.
                        .font(.caption.monospaced()) // Small and fixed-width.
                        .foregroundStyle(.secondary) // A detail, not the main point.
                }
                .padding(10) // Room inside the detail box.
                .frame(maxWidth: .infinity, alignment: .leading) // Full width.
                .background(.fill.tertiary, in: .rect(cornerRadius: 10)) // A soft box that adapts to dark mode.
            }

            DemoCard(title: "What survives: backups, cleanup, deletion", caption: "Pick an event and see what each folder keeps.") { // Course step 3.
                Picker("Event", selection: $event) { // The event to apply.
                    ForEach(ContainerEvent.allCases) { event in // One segment per event.
                        Text(event.rawValue).tag(event) // The tag is the value the picker stores.
                    }
                }
                .pickerStyle(.segmented) // Three short choices side by side.
                ForEach(SandboxFolder.allCases) { folder in // One line per folder.
                    let fate = folder.fate(after: event) // What happens to it.
                    HStack { // Folder on the left, fate on the right.
                        Text(folder.path).font(.footnote) // The folder.
                        Spacer() // Pushes the fate to the right.
                        Text(fate.rawValue) // The outcome.
                            .font(.footnote.bold()) // Bold, so it stands out.
                            .foregroundStyle(fate == .kept || fate == .restored ? Color.green : Color.orange) // Green when safe, orange when at risk.
                    }
                }
                Text("Deleting the app deletes the container, and anything not synced to the cloud is gone. Large files you can download again should stay out of backups: keep them in Caches, or set isExcludedFromBackup on them.") // The course's callout.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // A note under the table.
                Button("Save a large download and exclude it from backup") { // Runs the real file-system demo.
                    exclusionLog = runExclusionDemo() // Shows what happened.
                }
                ConsoleView(lines: exclusionLog.lines) // The demo's printed lines.
            }

            DemoCard(title: "Save before iOS stops your app", caption: "Type something, then press the Home button (or swipe up) and come back. The draft was saved the moment the app moved to the background.") { // Course step 4.
                DraftView() // The course's DraftView, with the load and the log added.
            }

            DemoCard(title: "Pick the right home for the data", caption: "Pick an example or change any answer. Compare Login token with 10,000 recipes, then read what would change the answer.") { // Course widget.
                StoragePickerView() // The advisor's controls and result.
            }
        }
        .task { exclusionLog = runExclusionDemo() } // Runs the backup demo once when the screen appears.
    }

    /// Writes a pretend download into Application Support, excludes it from backup, and reports each step.
    private func runExclusionDemo() -> Transcript { // Returns the lines to show.
        var log = Transcript() // Collects the report.
        do { // Every file step can fail.
            let folder = URL.applicationSupportDirectory.appending(path: "Downloads") // Application Support may not exist yet.
            let url = try BackupExclusion.writeDownloadedFile(in: folder) // Creates the folder and a 64 KB file.
            log.print("Wrote", ContainerPaths.short(url)) // Where it went.
            log.print("Excluded before:", try BackupExclusion.isExcluded(url)) // New files are backed up by default.
            try BackupExclusion.setExcluded(true, for: url) // Sets the flag.
            log.print("Excluded after:", try BackupExclusion.isExcluded(url)) // Reads it back from the file system.
        } catch { // Any failure lands here.
            log.print("File error:", error.localizedDescription) // Reports it instead of hiding it.
        }
        return log // The finished report.
    }
}

/// One of the six places, as a row in the first card.
struct StoragePlaceRow: Identifiable { // Identifiable for ForEach.
    let term: String // The place's name.
    let text: String // What it is for, in the course's words.
    let symbol: String // An SF Symbol that hints at the place.
    var id: String { term } // Names are unique.

    /// Memory plus the course's five persistent places.
    static let all = [ // In the course's order.
        StoragePlaceRow(term: "Memory", text: "Variables and objects while the app runs. Fast, but gone when iOS ends the app.", symbol: "memorychip"), // Not persistent.
        StoragePlaceRow(term: "UserDefaults", text: "A small key-value store for settings such as \"dark mode on\". In SwiftUI you use it through @AppStorage.", symbol: "gearshape"), // Lesson 6.2.
        StoragePlaceRow(term: "Files", text: "Whole documents, JSON, images, or audio that you write into your app's folders with FileManager.", symbol: "doc"), // Lesson 6.4.
        StoragePlaceRow(term: "A database", text: "Many structured records you can search, sort, and connect. Apple's modern framework is SwiftData.", symbol: "cylinder.split.1x2"), // Lessons 6.5 and 6.6.
        StoragePlaceRow(term: "The Keychain", text: "An encrypted system vault for secrets such as passwords and access tokens.", symbol: "key"), // Lesson 6.7.
        StoragePlaceRow(term: "The cloud", text: "Copies on servers so data follows the user to every device: iCloud, CloudKit, or your own backend.", symbol: "icloud"), // Lesson 6.8.
    ]
}

/// Draws one StoragePlaceRow.
struct StoragePlaceRowView: View { // A small reusable row.
    let place: StoragePlaceRow // The place to show.

    var body: some View { // Icon on the left, text on the right.
        HStack(alignment: .top, spacing: 10) { // Top-aligned, so long text wraps neatly.
            Image(systemName: place.symbol) // The hint icon.
                .frame(width: 24) // A fixed width keeps the text column straight.
                .foregroundStyle(.tint) // Uses the app's accent color.
            VStack(alignment: .leading, spacing: 2) { // Name over explanation.
                Text(place.term).font(.subheadline.bold()) // The name.
                Text(place.text).font(.footnote).foregroundStyle(.secondary) // The explanation.
            }
        }
    }
}

/// A labeled number box for the memory-versus-disk demo.
struct CounterBox: View { // Used twice, side by side.
    let title: String // What kind of storage the number lives in.
    let value: Int // The current count.

    var body: some View { // Title over a big number.
        VStack(spacing: 4) { // Tight spacing.
            Text(title).font(.caption) // The storage kind.
            Text("\(value)").font(.title.monospacedDigit()) // Monospaced digits stop the number from jiggling.
        }
        .frame(maxWidth: .infinity) // Both boxes share the width equally.
        .padding(8) // Room inside the box.
        .background(.fill.tertiary, in: .rect(cornerRadius: 10)) // A soft box.
    }
}

/// The course's DraftView: saves the draft to a file when the app moves to the background.
struct DraftView: View { // Self-contained, so it could move to any app.
    @Environment(\.scenePhase) private var scenePhase // .active, .inactive or .background, supplied by SwiftUI.
    @State private var draft = "" // The text being typed: memory only, until it is saved.
    @State private var log = Transcript() // What happened, for the console below the editor.
    var store = DraftStore() // Where the file lives: Documents/draft.txt.

    var body: some View { // Rebuilt on every keystroke.
        VStack(alignment: .leading, spacing: 10) { // Editor over console.
            TextEditor(text: $draft) // A multiline editor bound to draft.
                .frame(height: 110) // A fixed height inside the scrolling page.
                .padding(4) // Room between the text and the border.
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.4))) // A light border shows where to type.
                .onChange(of: scenePhase) { oldPhase, newPhase in // Runs whenever the phase changes.
                    log.print("Phase:", PhaseName.of(oldPhase), "->", PhaseName.of(newPhase)) // Records the transition.
                    if newPhase == .background { // The last moment you can count on.
                        saveDraft() // Writes the file.
                    }
                }
            Text("Current phase: \(PhaseName.of(scenePhase))") // Shows the live phase.
                .font(.footnote.monospaced()) // Fixed-width, like output.
            ConsoleView(lines: log.lines) // Every phase change and save.
        }
        .task { // Runs once when the view appears.
            draft = store.load() // Reads draft.txt back, so the text reappears after a relaunch.
            log.print("Loaded", draft.count, "characters from draft.txt") // Shows that the load happened.
        }
    }

    /// Writes the current draft to Documents/draft.txt.
    private func saveDraft() { // Called only from the phase handler.
        do { // The write can fail, for example on a full disk.
            try store.save(draft) // One atomic write.
            log.print("Saved", draft.count, "characters to draft.txt") // Confirms the save.
        } catch { // A real app should report errors, not ignore them.
            log.print("Save failed:", error.localizedDescription) // Says what went wrong.
        }
    }
}

/// Readable names for scene phases.
enum PhaseName { // A namespace for the helper.
    /// The phase's name, as the course writes it.
    static func of(_ phase: ScenePhase) -> String { // ScenePhase has no built-in text.
        switch phase { // One name per phase.
        case .active: ".active" // On screen and receiving touches.
        case .inactive: ".inactive" // Visible but not receiving touches, for example during the app switcher.
        case .background: ".background" // Off screen; may be suspended next.
        @unknown default: "unknown" // A future iOS could add phases.
        }
    }
}

/// The "Pick the right home for the data" tool.
struct StoragePickerView: View { // Holds its own answers.
    @State private var example = StorageExample.loginToken // The chosen example.
    @State private var traits = StorageExample.loginToken.traits // The answers, which start from the example.

    var body: some View { // Rebuilt when any answer changes.
        let home = StorageAdvisor.recommend(for: traits) // The advice for the current answers.
        VStack(alignment: .leading, spacing: 10) { // Controls, then the result.
            Picker("Example", selection: $example) { // Ready-made descriptions.
                ForEach(StorageExample.allCases) { Text($0.rawValue).tag($0) } // One menu item per example.
            }
            .pickerStyle(.menu) // A compact pop-up menu.
            .onChange(of: example) { _, newValue in traits = newValue.traits } // Choosing an example fills in every answer.
            Picker("Size", selection: $traits.size) { // How big is it?
                ForEach(DataTraits.Size.allCases) { Text($0.rawValue).tag($0) } // Three sizes.
            }
            .pickerStyle(.segmented) // Side by side.
            Picker("Shape", selection: $traits.shape) { // What shape is it?
                ForEach(DataTraits.Shape.allCases) { Text($0.rawValue).tag($0) } // Three shapes.
            }
            .pickerStyle(.segmented) // Side by side.
            Picker("Who needs it", selection: $traits.audience) { // Who needs it?
                ForEach(DataTraits.Audience.allCases) { Text($0.rawValue).tag($0) } // Three audiences.
            }
            .pickerStyle(.segmented) // Side by side.
            Toggle("It is a secret", isOn: $traits.isSecret) // Would it let someone act as the user?
            Toggle("The app can download it again", isOn: $traits.canRedownload) // Could it be rebuilt?
            VStack(alignment: .leading, spacing: 4) { // The recommendation box.
                Text(home.rawValue).font(.headline) // Where it belongs.
                Text(home.api).font(.caption.monospaced()) // The Swift API.
                Text(home.why).font(.footnote) // Why.
            }
            .padding(10) // Room inside the box.
            .frame(maxWidth: .infinity, alignment: .leading) // Full width.
            .background(Color.accentColor.opacity(0.12), in: .rect(cornerRadius: 10)) // A tinted box marks the answer.
            Text("What would change the answer?").font(.subheadline.bold()) // The course's list heading.
            ForEach(StorageAdvisor.whatWouldChange(traits), id: \.self) { line in // One line per answer that matters.
                Text(verbatim: "- " + line).font(.footnote) // A simple bulleted line.
            }
        }
    }
}

#Preview { // Shows this lesson in Xcode's canvas.
    NavigationStack { WhereAppDataLivesLesson(lesson: ContentView.lessons[0]) } // Inside a stack, so the title shows.
}

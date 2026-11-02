// Lesson_5_7_NavigationPatterns.swift
// Who: the home screen opens this when the student taps 5.7.
// What: choosing a navigation pattern, live: the usual combination of tabs,
//       stacks and a sheet; the course's tab bar, drill-down stack, "New" tab
//       versus toolbar-plus-sheet, the Cancel and Save sheet, a sheet that
//       protects unsaved edits, one shared stack versus a stack per tab, the
//       iOS 26 tab bar with a search tab, and an eight-scenario pattern quiz.
// Where: the Lessons folder; the course's example views sit below the lesson.
// When: SwiftUI builds it when lesson 5.7 is pushed onto the home screen's stack.
// Why: lesson screens are already inside a NavigationStack, so every example
//      with its own TabView or NavigationStack opens in a sheet or full-screen
//      cover, which is also exactly how real apps present them.

import SwiftUI // SwiftUI provides TabView, NavigationStack and sheets.

struct NavigationPatternsLesson: View { // The screen for lesson 5.7.
    let lesson: Lesson // The number, title and summary from the home screen.
    @State private var showCombination = false // The usual-combination cover.
    @State private var showRecipesApp = false // The tab bar cover.
    @State private var addSearchTab = false // Try it: a fourth tab.
    @State private var badgeZero = false // Try it: .badge(0).
    @State private var longTabTitle = false // Try it: a long tab title.
    @State private var showRecipeList = false // The drill-down sheet.
    @State private var addBananaBread = false // Try it: a fourth recipe.
    @State private var inlineDetail = true // Try it: delete .navigationBarTitleDisplayMode(.inline).
    @State private var showTabComparison = false // The "New" tab comparison cover.
    @State private var showTripForm = false // The Cancel and Save sheet.
    @State private var swapPlacements = false // Try it: swap the placements.
    @State private var okLabel = false // Try it: "OK" instead of "Save".
    @State private var savedTrips: [String] = [] // Destinations saved from the sheet.
    @State private var showEditor = false // The unsaved-edits sheet.
    @State private var showStackComparison = false // One stack versus a stack per tab.
    @State private var showRootTabs = false // The iOS 26 tab bar cover.

    var body: some View { // Rebuilt whenever a control changes.
        LessonPage(lesson: lesson) { // The shared scrolling page layout.
            DemoCard(title: "Three ways to move through an app", caption: "Choose by asking one question: how do these screens relate to each other?") { // Concept step 1.
                ConceptPoints(points: [ // The step's three patterns.
                    ("Flat: tab bar", "A few peer sections people switch between at any time. SwiftUI: TabView with Tab. Use 3 to 5 tabs on iPhone; each tab is a place, never an action."), // Flat.
                    ("Hierarchical: navigation stack", "Drilling down from general to specific: a list, then an item, then a detail. SwiftUI: NavigationStack with NavigationLink."), // Hierarchical.
                    ("Modal: sheet", "A focused, self-contained task that pauses the current context. SwiftUI: .sheet. It always offers a clear way out: Cancel, or Done when finished."), // Modal.
                ])
                Button("Open the usual combination", systemImage: "square.stack.3d.up") { showCombination = true } // Tabs, stacks and a sheet together.
                    .buttonStyle(.borderedProminent) // The card's main action.
                Text("Tabs at the root, a NavigationStack inside each tab, and sheets for creating or editing: the shape of Music and the App Store.") // The callout.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }
            .fullScreenCover(isPresented: $showCombination) { ClosableCover { UsualCombination() } } // Full screen: it has its own TabView.

            DemoCard(title: "Flat sections with a tab bar", caption: "The course's RecipesApp. In iOS 26 the tab bar floats above the content as Liquid Glass.") { // Code step.
                Toggle("Try it: add a Search tab", isOn: $addSearchTab) // Try it 1.
                Toggle("Try it: .badge(3) → .badge(0)", isOn: $badgeZero) // Try it 2.
                Toggle("Try it: rename Saved to a long title", isOn: $longTabTitle) // Try it 3.
                Button("Open RecipesApp", systemImage: "square.grid.2x2") { showRecipesApp = true } // Opens it.
                    .buttonStyle(.borderedProminent) // The card's main action.
                Text(badgeZero ? "A badge of 0 is not shown at all." : "Tap each tab: every tab keeps its screen alive while you visit the others.") // Explains the state.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }
            .fullScreenCover(isPresented: $showRecipesApp) { // Full screen: it has its own TabView.
                ClosableCover { RecipesApp(addSearch: addSearchTab, badge: badgeZero ? 0 : 3, longTitle: longTabTitle) } // The course's app.
            }

            DemoCard(title: "Drill down with a navigation stack", caption: "The course's RecipeList, in a sheet so it can have its own stack. Tap a recipe, then go back with the back button or an edge swipe.") { // Code step.
                Toggle("Try it: add \"Banana Bread\"", isOn: $addBananaBread) // Try it 1.
                Toggle("Keep the inline title on recipe screens", isOn: $inlineDetail) // Try it 2: off deletes .navigationBarTitleDisplayMode(.inline).
                Button("Open RecipeList", systemImage: "list.bullet") { showRecipeList = true } // Opens it.
                    .buttonStyle(.borderedProminent) // The card's main action.
                Text(inlineDetail ? "The list has a large title; each recipe has a small inline one." : "Without .inline, each recipe screen gets its own large title.") // Explains the state.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }
            .sheet(isPresented: $showRecipeList) { // A sheet with its own stack.
                RecipeList(extraRecipe: addBananaBread, inlineDetail: inlineDetail) // The course's list.
                    .presentationDragIndicator(.visible) // Shows that a swipe down closes it.
            }

            DemoCard(title: "A tab is a place, not an action", caption: "Type a draft in the New tab, switch tabs and come back. Then compare the standard pattern: a toolbar button that opens a sheet.") { // Compare step.
                Button("Compare both screens", systemImage: "rectangle.split.2x1") { showTabComparison = true } // Opens the comparison.
                    .buttonStyle(.bordered) // Secondary-looking.
                VerdictBox(text: "Tabs are places people return to; actions start tasks. Put an action in the toolbar of the screen it belongs to and present the task as a sheet with a clear way out.") // The verdict.
            }
            .fullScreenCover(isPresented: $showTabComparison) { // Full screen: both versions own a stack or tabs.
                FullScreenComparison(beforeLabel: "Action as a tab", afterLabel: "Toolbar + sheet") { // The comparison.
                    PoorTabs() // Before.
                } after: { // After.
                    BetterInbox() // The fix.
                }
            }

            DemoCard(title: "Inside the sheet: Cancel and Save", caption: "The course's NewTripForm: Cancel leading, Save trailing and disabled until there is a destination.") { // Code step.
                Toggle("Try it: swap the two placements", isOn: $swapPlacements) // Try it 1.
                Toggle("Try it: \"Save\" → \"OK\"", isOn: $okLabel) // Try it 2.
                Button("New Trip", systemImage: "plus") { showTripForm = true } // Opens the sheet.
                    .buttonStyle(.borderedProminent) // The card's main action.
                Text(savedTrips.isEmpty ? "No trips saved yet." : "Saved: " + savedTrips.joined(separator: ", ")) // Shows what Save did.
                    .font(.footnote) // A caption.
                Text(swapPlacements ? "Swapped: Save now sits where people expect Cancel. Someone leaving in a hurry saves by accident." : (okLabel ? "\"OK\" says nothing about what will happen; \"Save\" does." : "Semantic placements put each button where iOS users expect it.")) // Explains the state.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }
            .sheet(isPresented: $showTripForm) { // A sheet: a small task with an end.
                NewTripForm(swapPlacements: swapPlacements, confirmTitle: okLabel ? "OK" : "Save") { savedTrips.append($0) } // The course's form.
            }

            DemoCard(title: "Every screen needs a way back", caption: "People explore with confidence only when they know they can return.") { // Concept step 2.
                ConceptPoints(points: [ // The step's four points.
                    ("Back button and edge swipe", "In a stack, the back button and a swipe from the left edge both return one level. Never hide it or replace it with a control that breaks the swipe."), // Back.
                    ("Tabs remember", "Each tab keeps its own path and scroll position, so give each tab its own NavigationStack."), // Tabs.
                    ("Sheets end clearly", "Cancel leaves without changes; Save or Done commits. Swiping down acts like Cancel, so with unsaved edits, block the swipe with .interactiveDismissDisabled and ask before discarding."), // Sheets.
                    ("Avoid traps", "Avoid opening a sheet from a sheet, and never hide top-level sections in a slide-out menu."), // Traps.
                ])
                Button("Open an editor with unsaved-edit protection", systemImage: "square.and.pencil") { showEditor = true } // Opens the protected sheet.
                    .buttonStyle(.bordered) // Secondary-looking.
                Button("Compare one shared stack with a stack per tab", systemImage: "exclamationmark.triangle") { showStackComparison = true } // The common bug.
                    .buttonStyle(.bordered) // Secondary-looking.
                Text("A common bug: wrapping the whole TabView in one NavigationStack. Pushing a detail covers the tab bar, and the tabs fight over one title and toolbar.") // The callout.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }
            .sheet(isPresented: $showEditor) { NoteEditor() } // The protected sheet.
            .fullScreenCover(isPresented: $showStackComparison) { // Both versions own tabs.
                FullScreenComparison(beforeLabel: "One shared stack", afterLabel: "A stack per tab") { // The comparison.
                    SharedStackTabs() // The bug.
                } after: { // The fix.
                    StackPerTab() // Each tab keeps its own path.
                }
            }

            DemoCard(title: "The iOS 26 tab bar", caption: "The course's RootTabs: a search tab sits apart at the trailing end, and the bar shrinks while you scroll down the recipes.") { // Code step.
                Button("Open RootTabs", systemImage: "magnifyingglass") { showRootTabs = true } // Opens it.
                    .buttonStyle(.borderedProminent) // The card's main action.
                Text("Each tab owns its own NavigationStack. Scroll the Recipes list down to watch .tabBarMinimizeBehavior(.onScrollDown).") // What to try.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }
            .fullScreenCover(isPresented: $showRootTabs) { ClosableCover { RootTabs() } } // Full screen: it has its own TabView.

            DemoCard(title: "Pick the pattern", caption: "Eight real product scenarios. Your first pick counts toward the score; after it, tap the other options to see why they fit worse.") { // Widget step.
                PatternQuiz() // The interactive quiz.
            }
        }
    }
}

/// The eight-scenario quiz.
struct PatternQuiz: View { // From the course's "Pick the pattern" widget.
    @State private var quiz = NavQuiz() // Scenarios and first picks.
    @State private var index = 0 // Which scenario is showing.
    @State private var picked: NavPattern? // The pattern whose feedback is showing.

    private var scenario: NavScenario { quiz.scenarios[index] } // The current scenario.

    var body: some View { // Rebuilt after every pick.
        VStack(alignment: .leading, spacing: 10) { // Scenario, choices, feedback, navigation.
            Text("\(index + 1) of \(quiz.scenarios.count) · \(scenario.app)") // Progress.
                .font(.caption) // Small.
                .foregroundStyle(.secondary) // Quieter.
            Text(scenario.title).font(.headline) // The scenario's name.
            Text(scenario.prompt).font(.subheadline) // What people do.
            ForEach(NavPattern.allCases) { pattern in // The four choices.
                Button { // A pick.
                    _ = quiz.pick(pattern, for: scenario) // Grade it; only the first pick is recorded.
                    picked = pattern // Show its feedback.
                } label: { // The choice's look.
                    Label(pattern.title, systemImage: pattern.symbol) // Symbol plus words.
                        .frame(maxWidth: .infinity, alignment: .leading) // Full-width rows.
                }
                .buttonStyle(.bordered) // Real buttons.
                .tint(tint(for: pattern)) // Green for best, orange for close, once revealed.
            }
            if let picked { // After a pick.
                let grade = picked == scenario.best ? "Best fit" : (scenario.close.contains(picked) ? "Close" : "A poorer fit") // The grade in words.
                Text("\(grade): \(picked.title)").font(.subheadline.weight(.semibold)) // The grade.
                Text(scenario.feedback[picked] ?? "") // The reasoning.
                    .font(.footnote) // Compact.
                Text("SwiftUI: \(scenario.best.swiftTypes)") // The types to use.
                    .font(.footnote.monospaced()) // Code-like.
                    .foregroundStyle(.secondary) // Quieter.
            }
            HStack { // Navigation between scenarios.
                Button("Previous") { move(-1) }.disabled(index == 0) // Back one.
                Spacer() // Push apart.
                Text("Score \(quiz.score)/\(quiz.scenarios.count)").font(.subheadline.monospacedDigit()) // First picks that were best.
                Spacer() // Push apart.
                Button(index == quiz.scenarios.count - 1 ? "Start Over" : "Next") { // Forward, or reset at the end.
                    if index == quiz.scenarios.count - 1 { quiz.reset(); index = 0; picked = nil } else { move(1) } // Reset or advance.
                }
            }
        }
    }

    /// Moves between scenarios and clears the shown feedback.
    private func move(_ step: Int) { // -1 or +1.
        index = min(quiz.scenarios.count - 1, max(0, index + step)) // Stay in range.
        picked = nil // Fresh scenario, no feedback yet.
    }

    /// A choice's tint once a pick has been made.
    private func tint(for pattern: NavPattern) -> Color? { // nil keeps the default.
        guard picked != nil else { return nil } // Nothing revealed yet.
        if pattern == scenario.best { return .green } // The best fit.
        return scenario.close.contains(pattern) ? .orange : nil // Close, or default.
    }
}

/// Tabs at the root, a stack in each tab, a sheet for creating: the usual combination.
struct UsualCombination: View { // From the "Three ways" callout.
    @State private var showNew = false // The sheet.
    @State private var trips = ["Lisbon", "Kyoto", "Oaxaca"] // Content for the stack.

    var body: some View { // Tabs with stacks inside.
        TabView { // Flat: peer sections.
            Tab("Trips", systemImage: "airplane") { // Section one.
                NavigationStack { // Hierarchical: its own stack.
                    List(trips, id: \.self) { trip in // A list to drill into.
                        NavigationLink(trip) { Text("Plans for \(trip)").navigationTitle(trip) } // Push a detail.
                    }
                    .navigationTitle("Trips") // The tab's title.
                    .toolbar { Button("New Trip", systemImage: "plus") { showNew = true } } // Modal: a task from the toolbar.
                    .sheet(isPresented: $showNew) { NewTripForm { trips.append($0) } } // The sheet with Cancel and Save.
                }
            }
            Tab("Saved", systemImage: "heart") { // Section two.
                NavigationStack { Text("Places you saved").navigationTitle("Saved") } // Its own stack.
            }
            Tab("Profile", systemImage: "person") { // Section three.
                NavigationStack { Text("Your profile").navigationTitle("Profile") } // Its own stack.
            }
        }
    }
}

/// A sheet that refuses to vanish with unsaved edits and asks before discarding.
struct NoteEditor: View { // For "Every screen needs a way back".
    @Environment(\.dismiss) private var dismiss // Closes the sheet.
    @State private var text = "" // The draft.
    @State private var askDiscard = false // The discard question.

    var body: some View { // Rebuilt as the draft changes.
        NavigationStack { // Its own title and toolbar.
            Form { // A simple form.
                TextField("Write a note", text: $text, axis: .vertical) // Multi-line text.
                Text(text.isEmpty ? "Swipe down: the sheet closes, because nothing would be lost." : "Now try to swipe down: the sheet stays, because you have unsaved edits.") // Explains the behavior.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }
            .navigationTitle("New Note") // The title.
            .navigationBarTitleDisplayMode(.inline) // Small, as sheets usually have.
            .toolbar { // Cancel and Done.
                ToolbarItem(placement: .cancellationAction) { // Leading.
                    Button("Cancel") { if text.isEmpty { dismiss() } else { askDiscard = true } } // Ask first when there are edits.
                }
                ToolbarItem(placement: .confirmationAction) { // Trailing.
                    Button("Done") { dismiss() }.disabled(text.isEmpty) // Commits.
                }
            }
            .confirmationDialog("Discard this note?", isPresented: $askDiscard, titleVisibility: .visible) { // The question.
                Button("Discard Note", role: .destructive) { dismiss() } // A verb that repeats the action.
                Button("Keep Editing", role: .cancel) { } // The safe choice.
            }
        }
        .interactiveDismissDisabled(!text.isEmpty) // Block the swipe while there are edits.
    }
}

/// The common bug: one NavigationStack around the whole TabView.
struct SharedStackTabs: View { // The "before".
    var body: some View { // A stack outside the tabs.
        NavigationStack { // One shared path for every tab.
            TabView { // The tabs inside it.
                Tab("Trips", systemImage: "airplane") { // Section one.
                    List(["Lisbon", "Kyoto"], id: \.self) { trip in // A list.
                        NavigationLink(trip) { Text("Plans for \(trip)") } // Push: the detail covers the tab bar.
                    }
                }
                Tab("Saved", systemImage: "heart") { Text("Places you saved") } // Section two.
            }
            .navigationTitle("Shared title") // Both tabs fight over this one title.
        }
    }
}

/// The fix: a NavigationStack inside each Tab.
struct StackPerTab: View { // The "after".
    var body: some View { // Tabs outside, stacks inside.
        TabView { // The tabs.
            Tab("Trips", systemImage: "airplane") { // Section one.
                NavigationStack { // Its own path.
                    List(["Lisbon", "Kyoto"], id: \.self) { trip in // A list.
                        NavigationLink(trip) { Text("Plans for \(trip)").navigationTitle(trip) } // Push: the tab bar stays.
                    }
                    .navigationTitle("Trips") // Its own title.
                }
            }
            Tab("Saved", systemImage: "heart") { // Section two.
                NavigationStack { Text("Places you saved").navigationTitle("Saved") } // Its own title.
            }
        }
    }
}

// MARK: - The course's examples

/// The course's RecipesApp, with its three try-its.
struct RecipesApp: View { // From "Flat sections with a tab bar".
    var addSearch = false // Try it 1.
    var badge = 3 // Try it 2: 3 in the course.
    var longTitle = false // Try it 3.

    var body: some View { // Three tabs, or four.
        TabView { // The tab bar.
            Tab("Recipes", systemImage: "fork.knife") { // A short noun and a symbol.
                Text("Browse recipes") // The tab's screen.
            }
            Tab("Groceries", systemImage: "cart") { // Section two.
                Text("Your shopping list") // Its screen.
            }
            .badge(badge) // A count on the tab; 0 hides it.
            Tab(longTitle ? "Recipes You Have Saved" : "Saved", systemImage: "heart") { // Section three.
                Text("Recipes you saved") // Its screen.
            }
            if addSearch { // The try-it.
                Tab("Search", systemImage: "magnifyingglass") { // A fourth tab.
                    Text("Search recipes") // Its screen.
                }
            }
        }
    }
}

/// The course's RecipeList, with its two try-its.
struct RecipeList: View { // From "Drill down with a navigation stack".
    var extraRecipe = false // Try it 1: Banana Bread.
    var inlineDetail = true // Try it 2.
    private var recipes: [String] { ["Pancakes", "Tomato Soup", "Green Curry"] + (extraRecipe ? ["Banana Bread"] : []) } // The course's three, plus one.

    var body: some View { // A stack of screens.
        NavigationStack { // Remembers the path.
            List { // The root list.
                ForEach(recipes, id: \.self) { recipe in // One row per recipe.
                    NavigationLink(recipe) { // Pushes a more specific screen.
                        Text("Steps for \(recipe)") // The detail.
                            .navigationTitle(recipe) // Its title.
                            .navigationBarTitleDisplayMode(inlineDetail ? .inline : .automatic) // Small title in the course.
                    }
                }
            }
            .navigationTitle("Recipes") // The large root title.
        }
    }
}

/// The course's "New" tab mistake.
struct PoorTabs: View { // The "before" of "A tab is a place, not an action".
    @State private var draft = "" // Survives tab switches, unexplained.

    var body: some View { // A place and an action, mixed.
        TabView { // Two tabs.
            Tab("Inbox", systemImage: "tray") { // A real place.
                Text("Your messages") // Its screen.
            }
            Tab("New", systemImage: "square.and.pencil") { // An action pretending to be a place.
                TextField("Message", text: $draft) // No Cancel, no Send.
                    .padding() // Polish cannot fix the pattern.
            }
        }
    }
}

/// The course's toolbar-plus-sheet fix.
struct BetterInbox: View { // The "after".
    @State private var isComposing = false // Drives the sheet.

    var body: some View { // The inbox with its toolbar.
        NavigationStack { // Needed for the toolbar.
            Text("Your messages") // The inbox.
                .navigationTitle("Inbox") // Where you are.
                .toolbar { // Actions for this screen.
                    Button("Compose") { isComposing = true } // A verb that starts the task.
                }
                .sheet(isPresented: $isComposing) { // A separate task in progress.
                    Text("New Message") // Stand-in content; swipe down to dismiss.
                }
        }
    }
}

/// The course's NewTripForm, with its two try-its and a way to report the saved destination.
struct NewTripForm: View { // From "Inside the sheet: Cancel and Save".
    var swapPlacements = false // Try it 1.
    var confirmTitle = "Save" // Try it 2: "OK".
    var onSave: (String) -> Void = { _ in } // Demo only: tells the card what was saved.
    @Environment(\.dismiss) private var dismiss // Closes the sheet.
    @State private var destination = "" // The one field.

    var body: some View { // A small task in its own stack.
        NavigationStack { // Title and toolbar.
            Form { TextField("Destination", text: $destination) } // The input.
                .navigationTitle("New Trip") // The task's name.
                .navigationBarTitleDisplayMode(.inline) // Small title.
                .toolbar { // Cancel and Save.
                    ToolbarItem(placement: swapPlacements ? .confirmationAction : .cancellationAction) { // Leading in the course.
                        Button("Cancel") { dismiss() } // Leaves without changes.
                    }
                    ToolbarItem(placement: swapPlacements ? .cancellationAction : .confirmationAction) { // Trailing in the course.
                        Button(confirmTitle) { onSave(destination); dismiss() } // Commits.
                            .disabled(destination.isEmpty) // Prevents an empty trip.
                    }
                }
        }
    }
}

/// The course's iOS 26 tab bar.
struct RootTabs: View { // From "The iOS 26 tab bar".
    @State private var query = "" // The search text.

    var body: some View { // Two tabs, each with its own stack.
        TabView { // The floating glass tab bar.
            Tab("Recipes", systemImage: "fork.knife") { // A regular tab.
                NavigationStack { // Its own stack.
                    List(1...30, id: \.self) { Text("Recipe \($0)") } // Enough rows to scroll.
                        .navigationTitle("Recipes") // Its title.
                }
            }
            Tab(role: .search) { // The search tab, set apart at the trailing end.
                NavigationStack { // Its own stack.
                    Text("Results for \(query)") // Results.
                        .navigationTitle("Search") // Its title.
                }
                .searchable(text: $query) // The search field.
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown) // The bar shrinks while scrolling down.
    }
}

#Preview("Lesson 5.7") { // The whole lesson in Xcode's canvas.
    NavigationStack { NavigationPatternsLesson(lesson: ContentView.lessons[6]) } // Inside a stack, as in the app.
}

#Preview("RecipesApp") { RecipesApp() } // The course's preview.

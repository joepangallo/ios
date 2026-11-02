// Lesson_4_7_NavigationTabsSheets.swift
// Who: the student who opens lesson 4.7 from the home screen.
// What: the "Navigation, Tabs, and Sheets" page: choosing push, tabs, sheet or alert;
//       a NavigationStack with NavigationLinks; value-based navigation; the path
//       array behind a stack; a TabView; a sheet with dismiss; and an alert (plus a
//       confirmation dialog) before destroying data.
// Where: pushed onto the app's NavigationStack by ContentView. Because this page is
//        already inside a stack, every demo that brings its own NavigationStack or
//        TabView opens full screen or in a sheet, with a Close bar.
// When: each demo is built when you open it and thrown away when you close it.
// Why: people move between screens in a few familiar ways. Each one is coded
//      differently, and each one fits a different relationship between screens.

import SwiftUI // NavigationStack, NavigationLink, TabView, sheet, alert.

/// Lesson 4.7: navigation, tabs, and sheets.
struct NavigationTabsSheetsLesson: View { // One screen per lesson.
    let lesson: Lesson // Number, title and summary from the home screen.

    var body: some View { // The page: one card per course step.
        LessonPage(lesson: lesson) { // Scrolling page with the summary on top.
            PatternChooserCard() // Concept: Three ways to move between screens.
            RecipeBookCard() // Code: NavigationStack and NavigationLink.
            ValueNavigationCard() // Code: Navigate with values.
            PathLabCard() // Widget: Inside a NavigationStack.
            HabitTabsCard() // Code: Tabs for peer sections.
            HabitSheetCard() // Code: A sheet for a short task.
            StreakCard() // Code: Confirm before destroying data.
        }
    }
}

// MARK: - Three ways to move between screens

/// Concept: Three ways to move between screens.
private struct PatternChooserCard: View { // One card.
    @State private var index = 0 // Which situation is showing.
    @State private var choice: NavigationPattern? = nil // The answer picked, if any.

    var body: some View { // Redraws when the situation or the answer changes.
        let scenario = PatternScenario.all[index] // The current question.
        DemoCard(title: "Three ways to move between screens", caption: "Hierarchical (push): drill down from a list to a detail and back. Flat (tabs): switch between peer sections. Modal (sheet): a short, self-contained job. Alert: a question that must be answered now.") { // The card.
            Text("Situation \(index + 1) of \(PatternScenario.all.count)") // Progress.
                .font(.caption) // Small.
                .foregroundStyle(.secondary) // Quiet.
            Text(scenario.situation) // The question.
                .font(.headline) // Prominent.
            HStack { // One button per pattern.
                ForEach(NavigationPattern.allCases) { pattern in // Push, Tabs, Sheet, Alert.
                    Button(pattern.rawValue) { choice = pattern } // Records the answer.
                        .buttonStyle(.bordered) // Framed.
                        .tint(choice == pattern ? (pattern == scenario.answer ? .green : .red) : .accentColor) // Green if right, red if wrong.
                }
            }
            if let choice { // After an answer.
                Label(choice == scenario.answer ? "Yes: \(scenario.reason)" : "Not quite. Ask how the two screens relate.", systemImage: choice == scenario.answer ? "checkmark.circle.fill" : "xmark.circle") // Feedback.
                    .font(.footnote) // Small.
                    .foregroundStyle(choice == scenario.answer ? .green : .red) // Colored by result.
            }
            Button("Next situation") { // Moves on, wrapping around at the end.
                index = (index + 1) % PatternScenario.all.count // The next index, back to 0 after the last.
                choice = nil // Clear the answer.
            }
            .font(.footnote) // Secondary.
            Text("Match the pattern to the relationship: parent and child, push; peers, tabs; a side task that ends, sheet; a yes-or-no that cannot wait, alert.") // The callout.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - NavigationStack and NavigationLink

/// The course's RecipeBookView, with the challenges as inputs.
struct RecipeBookView: View { // `struct RecipeBookView: View`
    var includesSalad = false // Challenge 1: a third NavigationLink.
    var servesFour = false // Challenge 2: a VStack with "Serves 4".

    var body: some View { // A stack with a list of links.
        NavigationStack { // Gives the screen a bar and remembers what is pushed.
            List { // Rows.
                NavigationLink("Pancakes") { // A row that pushes its destination.
                    VStack { // Challenge 2 wraps the Text in a VStack.
                        Text("Whisk, pour, flip, serve.") // The destination.
                        if servesFour { Text("Serves 4") } // Challenge 2's second Text.
                    }
                    .navigationTitle("Pancakes") // The pushed screen's title.
                }
                NavigationLink("Tomato Soup") { // Second link.
                    Text("Roast, simmer, blend.") // Its destination.
                        .navigationTitle("Tomato Soup") // Its title.
                }
                if includesSalad { // Challenge 1.
                    NavigationLink("Green Salad") { // Third link.
                        Text("Wash, chop, toss.") // Its destination.
                            .navigationTitle("Green Salad") // Its title.
                    }
                }
            }
            .navigationTitle("Recipes") // The root screen's title.
        }
    }
}

/// Code: NavigationStack and NavigationLink.
private struct RecipeBookCard: View { // One card.
    @State private var showing = false // Whether the demo is open.
    @State private var includesSalad = false // Challenge 1.
    @State private var servesFour = false // Challenge 2.

    var body: some View { // Redraws when a choice changes.
        DemoCard(title: "NavigationStack and NavigationLink", caption: "NavigationStack gives the screen a navigation bar and remembers which screens are pushed. Each NavigationLink is a row that pushes its destination. Open it, tap a recipe, then use the back button.") { // The card.
            Toggle("A third link: Green Salad", isOn: $includesSalad) // Challenge 1.
            Toggle("Pancakes: VStack with \"Serves 4\"", isOn: $servesFour) // Challenge 2.
            Button("Open RecipeBookView") { showing = true } // Presents the demo.
                .buttonStyle(.borderedProminent) // The main action.
        }
        .fullScreenCover(isPresented: $showing) { // A stack of its own, so it covers the page.
            ClosableDemo(title: "RecipeBookView") { RecipeBookView(includesSalad: includesSalad, servesFour: servesFour) } // With a Close bar.
        }
    }
}

// MARK: - Navigate with values

/// The course's names for this step. They are nested here because lesson 4.6 already
/// has a Recipe and a RecipeListView, and one app cannot have two types with one name.
enum ValueNavigation { // A namespace.
    /// `enum Recipe: String, CaseIterable`, with challenge 2's third case already added.
    enum Recipe: String, CaseIterable { // Hashable for free, because it has a raw value.
        case pancakes = "Pancakes", soup = "Tomato Soup" // The course's two cases.
        case salad = "Green Salad" // Challenge 2: the list and the navigation pick it up with no other change.
    }

    /// The course's RecipeListView for value-based navigation.
    struct RecipeListView: View { // `struct RecipeListView: View`
        var showsTitle = true // Challenge 1: .navigationTitle("Recipes").

        var body: some View { // Rows from data, destinations from one modifier.
            NavigationStack { // The container.
                List { // Rows.
                    ForEach(Recipe.allCases, id: \.self) { recipe in // One row per case.
                        NavigationLink(recipe.rawValue, value: recipe) // The link carries a value, not a destination.
                    }
                }
                .navigationTitle(showsTitle ? "Recipes" : "") // Challenge 1.
                .navigationDestination(for: Recipe.self) { recipe in // Turns any Recipe value into a screen.
                    Text("How to make \(recipe.rawValue)") // The destination.
                }
            }
        }
    }
}

/// Code: Navigate with values.
private struct ValueNavigationCard: View { // One card.
    @State private var showing = false // Whether the demo is open.
    @State private var showsTitle = true // Challenge 1.

    var body: some View { // Redraws when a choice changes.
        DemoCard(title: "Navigate with values", caption: "A link can carry a value, and one navigationDestination(for:) turns any value of that type into a screen. Adding a recipe means adding one enum case; Green Salad was added that way.") { // The card.
            Toggle(".navigationTitle(\"Recipes\")", isOn: $showsTitle) // Challenge 1.
                .font(.footnote.monospaced()) // Code font.
            Button("Open RecipeListView") { showing = true } // Presents the demo.
                .buttonStyle(.borderedProminent) // The main action.
            Text("If tapping a row ever does nothing, look for the missing navigationDestination(for:) for that value's type. Values must be Hashable so the stack can store and compare them.") // The quiz's two points.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
        .fullScreenCover(isPresented: $showing) { // Its own stack, so it covers the page.
            ClosableDemo(title: "RecipeListView") { ValueNavigation.RecipeListView(showsTitle: showsTitle) } // With a Close bar.
        }
    }
}

// MARK: - Inside a NavigationStack

/// One pushed screen in the path lab.
private struct RouteScreen: View { // Built by navigationDestination for each value.
    let route: Route // The value this screen shows.

    var body: some View { // A list of next steps.
        List { // Rows.
            switch route { // Recipe overview or a single step.
            case .recipe(let recipe): // The overview.
                ForEach(1...recipe.stepCount, id: \.self) { number in // One link per step.
                    NavigationLink("Step \(number)", value: Route.step(recipe, number)) // Pushes .step(recipe, number).
                }
            case .step(let recipe, let number): // A step.
                Text("Step \(number) of \(recipe.stepCount) for \(recipe.rawValue).") // What this screen is.
                if number < recipe.stepCount { // Not the last step.
                    NavigationLink("Next step", value: Route.step(recipe, number + 1)) // Pushes the next step.
                }
            }
        }
        .navigationTitle(route.title) // "Tomato Soup" or "Step 3".
    }
}

/// The path lab: a NavigationStack driven by an array you can watch.
private struct PathLabView: View { // Shown full screen.
    @State private var model = RoutePath() // The path and the sheet flag.

    var body: some View { // Re-runs when the path or the sheet flag changes.
        NavigationStack(path: $model.path) { // The stack shows exactly what path holds.
            List(PathRecipe.allCases, id: \.self) { recipe in // The root screen: never in path.
                NavigationLink(recipe.rawValue, value: Route.recipe(recipe)) // Pushing appends .recipe(recipe).
            }
            .navigationTitle("Recipes") // Root title.
            .toolbar { // The bar's buttons.
                Button { model.showingNewRecipe = true } label: { Image(systemName: "plus") } // Opens the sheet.
                    .accessibilityLabel("New recipe") // VoiceOver name.
            }
            .navigationDestination(for: Route.self) { RouteScreen(route: $0) } // One rule for every pushed value.
        }
        .sheet(isPresented: $model.showingNewRecipe) { // A separate layer above the stack.
            NavigationStack { // The sheet's own small stack, for its title and Done button.
                Form { // A short form.
                    TextField("Recipe name", text: .constant("")) // A placeholder field; nothing is saved.
                    Text("This sheet is a separate layer. The stack underneath keeps its path: \(model.pathCode)") // The point of the sheet.
                }
                .navigationTitle("New Recipe") // Sheet title.
                .toolbar { Button("Done") { model.showingNewRecipe = false } } // Closes the sheet.
            }
            .presentationDetents([.medium]) // Half height, so the stack stays visible behind.
        }
        .safeAreaInset(edge: .bottom) { // The path readout, always visible under the stack.
            VStack(alignment: .leading, spacing: 8) { // Readout and buttons.
                Text("path = \(model.pathCode)") // The array itself.
                    .font(.footnote.monospaced()) // Code font.
                    .contentTransition(.numericText()) // Changes animate.
                Text(model.countText) // "2 values, 3 screens".
                    .font(.caption) // Small.
                    .foregroundStyle(.secondary) // Quiet.
                HStack { // The three path commands.
                    Button("Back") { model.back() } // path.removeLast()
                        .disabled(model.path.isEmpty) // Nothing to remove at the root.
                    Button("Pop to root") { model.popToRoot() } // path.removeAll()
                        .disabled(model.path.isEmpty) // Already at the root.
                    Button("Jump: Soup, Step 3") { model.jumpToSoupStep3() } // path = [ ... ], like a deep link.
                }
                .buttonStyle(.bordered) // Framed.
                .controlSize(.small) // Compact.
            }
            .padding() // Room inside the panel.
            .frame(maxWidth: .infinity, alignment: .leading) // Full width.
            .background(.bar) // The system bar material.
        }
    }
}

/// Widget: Inside a NavigationStack.
private struct PathLabCard: View { // One card.
    @State private var showing = false // Whether the lab is open.

    var body: some View { // Static until the lab opens.
        DemoCard(title: "Inside a NavigationStack", caption: "A NavigationStack is driven by an array called path. The root screen is never in path; each pushed value adds a screen on top. Push a few screens and watch path grow; go back and watch it shrink; open + and notice path does not change; then Jump, which replaces the whole array at once.") { // The card.
            CodeBlock(lines: ["enum Route: Hashable {", "    case recipe(Recipe), step(Recipe, Int)", "}", "@State private var path: [Route] = []", "NavigationStack(path: $path) { ... }"]) // The code behind the lab.
            Button("Open the path lab") { showing = true } // Presents the lab.
                .buttonStyle(.borderedProminent) // The main action.
        }
        .fullScreenCover(isPresented: $showing) { // A stack of its own, so it covers the page.
            ClosableDemo(title: "Path lab") { PathLabView() } // With a Close bar.
        }
    }
}

// MARK: - Tabs for peer sections

/// Which tab carries the badge (challenge 1).
enum BadgeTab: String, CaseIterable, Identifiable { // Shown as a segmented picker.
    case today = "Today", stats = "Stats" // The two places the challenge tries.
    var id: String { rawValue } // Identifiable for ForEach.
}

/// The course's HabitAppView, with the challenges as inputs.
struct HabitAppView: View { // `struct HabitAppView: View`
    var badgeCount = 3 // Challenge 1: 3 or 12.
    var badgeOn = BadgeTab.today // Challenge 1: move it onto Stats.
    var includesProfile = false // Challenge 2: a fourth tab.
    var orange = false // Challenge 3: .orange instead of .green.

    var body: some View { // Three (or four) peer sections.
        TabView { // Draws a tab bar; on iOS 26 it floats on Liquid Glass.
            Tab("Today", systemImage: "checklist") { // A title, a symbol, and the content.
                Label("3 habits left", systemImage: "flame") // Today's content.
            }
            .badge(badgeOn == .today ? badgeCount : 0) // A badge of 0 is hidden.
            Tab("Stats", systemImage: "chart.bar") { // Second tab.
                Label("Best streak: 12 days", systemImage: "star") // Its content.
            }
            .badge(badgeOn == .stats ? badgeCount : 0) // Challenge 1: the badge moved here.
            Tab("Settings", systemImage: "gear") { // Third tab.
                Label("Reminders on", systemImage: "bell") // Its content.
            }
            if includesProfile { // Challenge 2.
                Tab("Profile", systemImage: "person") { // Fourth tab.
                    Text("Your profile") // Its content.
                }
            }
        }
        .tint(orange ? .orange : .green) // .green in the course.
    }
}

/// Code: Tabs for peer sections.
private struct HabitTabsCard: View { // One card.
    @State private var showing = false // Whether the demo is open.
    @State private var twelve = false // Challenge 1: .badge(12).
    @State private var badgeOn = BadgeTab.today // Challenge 1: which tab.
    @State private var includesProfile = false // Challenge 2.
    @State private var orange = false // Challenge 3.

    var body: some View { // Redraws when a choice changes.
        DemoCard(title: "Tabs for peer sections", caption: "TabView draws a tab bar, and each Tab pairs a title and an SF Symbol with its content. Peer sections stay in place while you visit another. Open it and notice the badge.") { // The card.
            Toggle(".badge(12) instead of .badge(3)", isOn: $twelve) // Challenge 1.
            Text("Which tab carries the badge") // Heading for the picker below.
                .font(.footnote) // Small.
            Picker("Badge on", selection: $badgeOn) { // Challenge 1: which tab.
                ForEach(BadgeTab.allCases) { Text($0.rawValue).tag($0) } // Today or Stats.
            }
            .pickerStyle(.segmented) // Side by side.
            Toggle("A fourth Tab(\"Profile\")", isOn: $includesProfile) // Challenge 2.
            Toggle(".tint(.orange)", isOn: $orange) // Challenge 3.
            Button("Open HabitAppView") { showing = true } // Presents the demo.
                .buttonStyle(.borderedProminent) // The main action.
        }
        .fullScreenCover(isPresented: $showing) { // A TabView fills the screen, so it covers the page.
            ClosableDemo(title: "HabitAppView") { HabitAppView(badgeCount: twelve ? 12 : 3, badgeOn: badgeOn, includesProfile: includesProfile, orange: orange) } // With a Close bar.
        }
    }
}

// MARK: - A sheet for a short task

/// The course's HabitListView, with the challenge as an input.
struct HabitListView: View { // `struct HabitListView: View`
    var secondButton = false // Challenge 2: a second button that opens the same sheet.
    @State private var showingAdd = false // Decides whether the sheet is showing.

    var body: some View { // Re-runs when showingAdd changes.
        NavigationStack { // For the title and the toolbar.
            VStack(spacing: 16) { // Challenge 2 wraps the Text in a VStack.
                Text("Read 20 pages") // The one habit.
                if secondButton { // Challenge 2.
                    Button("Add from here") { showingAdd = true } // Changes the same state as the toolbar button.
                }
                Text(verbatim: "showingAdd = \(showingAdd)") // The state, made visible; verbatim because code is never translated.
                    .font(.caption.monospaced()) // Code font.
                    .foregroundStyle(.secondary) // Quiet.
            }
            .navigationTitle("Habits") // The bar's title.
            .toolbar { Button("Add") { showingAdd = true } } // Presents the sheet by changing state.
            .sheet(isPresented: $showingAdd) { AddHabitView() } // Shown while showingAdd is true.
        }
    }
}

/// The course's AddHabitView: closes itself with dismiss.
struct AddHabitView: View { // `struct AddHabitView: View`
    @Environment(\.dismiss) private var dismiss // Declared inside the sheet's own view, so it closes the sheet.
    var body: some View { // The sheet's content.
        Button("Save habit") { dismiss() } // Closes the sheet; SwiftUI sets showingAdd back to false.
            .buttonStyle(.borderedProminent) // The main action.
    }
}

/// Code: A sheet for a short task.
private struct HabitSheetCard: View { // One card.
    @State private var showing = false // Whether the demo is open.
    @State private var secondButton = true // Challenge 2, on by default.

    var body: some View { // Redraws when a choice changes.
        DemoCard(title: "A sheet for a short task", caption: "An Add button presents a sheet: a modal screen for a short, self-contained task. A Boolean in @State decides whether it shows. Inside, @Environment(\\.dismiss) closes it. Tap Add, then Save habit; or swipe the sheet down.") { // The card.
            Toggle("Button(\"Add from here\")", isOn: $secondButton) // Challenge 2.
                .font(.footnote.monospaced()) // Code font.
            Button("Open HabitListView") { showing = true } // Presents the demo.
                .buttonStyle(.borderedProminent) // The main action.
            Text("Watch showingAdd: it is true while the sheet is up and false again after Save or a swipe, which is why Add always works the next time.") // Challenge 1, explained.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
        .sheet(isPresented: $showing) { // The demo itself opens in a sheet.
            ClosableDemo(title: "HabitListView") { HabitListView(secondButton: secondButton) } // With a Close bar.
        }
    }
}

// MARK: - Confirm before destroying data

/// The course's StreakView, with the challenges as inputs.
struct StreakView: View { // `struct StreakView: View`
    var useDialog = false // The confirmation dialog version.
    var deleteWording = false // Challenge 2: "Delete all progress?" and "Delete".
    var resetToOne = false // Challenge 3: a third button.
    @State private var streak = 12 // The data at risk.
    @State private var confirmingReset = false // Shows the alert (or dialog) while true.

    private var question: String { deleteWording ? "Delete all progress?" : "Reset your streak?" } // The title.
    private var actionTitle: String { deleteWording ? "Delete" : "Reset" } // The destructive button's title.

    var body: some View { // Re-runs when streak or confirmingReset changes.
        VStack(spacing: 20) { // Number above button.
            Text("\(streak)-day streak") // The data.
                .font(.largeTitle) // Big.
            Button("Reset streak") { confirmingReset = true } // Asks first; changes nothing yet.
                .tint(.red) // Red: this destroys data.
            Button("Undo: back to 12") { streak = 12 } // Lets the demo run again.
                .font(.footnote) // Secondary.
        }
        .alert(question, isPresented: useDialog ? .constant(false) : $confirmingReset) { // The course's alert.
            Button(actionTitle) { streak = 0 } // The choice that destroys data.
            if resetToOne { Button("Reset to 1") { streak = 1 } } // Challenge 3.
            Button("Cancel") { } // Does nothing; tapping any button closes the alert.
        } message: { // The text under the title.
            Text("Your \(streak) days go back to zero.") // Says exactly what will be lost.
        }
        .confirmationDialog(question, isPresented: useDialog ? $confirmingReset : .constant(false), titleVisibility: .visible) { // The same question as a sheet of choices.
            Button(actionTitle, role: .destructive) { streak = 0 } // role: .destructive draws it in red.
            if resetToOne { Button("Reset to 1") { streak = 1 } } // Challenge 3.
            Button("Cancel", role: .cancel) { } // role: .cancel puts it apart from the others.
        } message: { // The text under the title.
            Text("Your \(streak) days go back to zero.") // Same message.
        }
    }
}

/// Code: Confirm before destroying data.
private struct StreakCard: View { // One card.
    @State private var useDialog = false // Alert or confirmation dialog.
    @State private var deleteWording = false // Challenge 2.
    @State private var resetToOne = false // Challenge 3.

    var body: some View { // Redraws when a choice changes.
        DemoCard(title: "Confirm before destroying data", caption: "Resetting a streak destroys data, so the app asks first. .alert shows a system alert whenever its Boolean binding is true; tapping any of its buttons also closes it. A confirmationDialog asks the same question from the bottom of the screen.") { // The card.
            StreakView(useDialog: useDialog, deleteWording: deleteWording, resetToOne: resetToOne) // The live view.
                .frame(maxWidth: .infinity) // Centered.
                .padding(.vertical) // Air.
                .demoPanel() // On a plain panel.
            Picker("Ask with", selection: $useDialog) { // Two ways to confirm.
                Text(".alert").tag(false) // The course's version.
                Text(".confirmationDialog").tag(true) // The bottom-of-screen version.
            }
            .pickerStyle(.segmented) // Side by side.
            Toggle("\"Delete all progress?\" and \"Delete\"", isOn: $deleteWording) // Challenge 2.
            Toggle("A third button: Reset to 1", isOn: $resetToOne) // Challenge 3.
        }
    }
}

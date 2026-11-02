// Lesson_4_6_ListsAndDynamicData.swift
// Who: the student who opens lesson 4.6 from the home screen.
// What: the "Lists and Dynamic Data" page: why rows need stable identities, a list
//       of recipes, sections, swipe to delete with an empty state, custom swipe
//       actions, and a searchable list that opens in a sheet.
// Where: pushed onto the app's NavigationStack by ContentView. The data rules live
//        in Models/ListModels.swift.
// When: built when the lesson opens; rows change whenever their data changes.
// Why: most apps show collections. A List only draws rows; which rows exist is
//      decided by the data, and SwiftUI tells rows apart by their identity.

import SwiftUI // List, ForEach, Section, swipe actions and searchable.

/// Lesson 4.6: lists and dynamic data.
struct ListsAndDynamicDataLesson: View { // One screen per lesson.
    let lesson: Lesson // Number, title and summary from the home screen.

    var body: some View { // The page: one card per course step.
        LessonPage(lesson: lesson) { // Scrolling page with the summary on top.
            IdentityCard() // Concept: Rows from data: List, ForEach, Identifiable.
            RecipeListCard() // Code: A list of recipes.
            MealPlanCard() // Code: Grouping rows with Section.
            ShoppingListCard() // Code: Swipe to delete, and the empty state.
            TodayCard() // Code: Custom swipe actions.
            RecipeSearchCard() // Code: Filtering with searchable.
        }
    }
}

extension View { // A helper for switching list styles at run time.
    /// `.listStyle(.plain)` or `.listStyle(.insetGrouped)`. Each style is a different type, so an if picks one.
    @ViewBuilder func listStyle(plain: Bool) -> some View { // @ViewBuilder lets the branches differ.
        if plain { listStyle(.plain) } else { listStyle(.insetGrouped) } // One style or the other.
    }
}

// MARK: - Rows from data: List, ForEach, Identifiable

/// A row with its own private state: a star you can tap.
private struct StarRow: View { // The state lives with the row's identity.
    let name: String // The recipe shown.
    @State private var starred = false // SwiftUI keeps this per row identity.

    var body: some View { // Re-runs when starred changes.
        HStack { // Name, then star.
            Text(name) // The recipe.
            Spacer() // Pushes the star right.
            Button { starred.toggle() } label: { // Tap to star or unstar.
                Image(systemName: starred ? "star.fill" : "star") // Filled when starred.
                    .foregroundStyle(.orange) // Star color.
            }
            .buttonStyle(.borderless) // Inside a List, borderless keeps the tap on the button, not the whole row.
            .accessibilityLabel(starred ? "Unstar \(name)" : "Star \(name)") // VoiceOver says which.
        }
    }
}

/// Concept: Rows from data: List, ForEach, Identifiable.
private struct IdentityCard: View { // One card.
    @State private var recipes = Recipe.starters // The rows' data.
    @State private var byPosition = false // Identify rows by index (the mistake) or by id.

    var body: some View { // Redraws when the data or the mode changes.
        DemoCard(title: "Rows from data: List, ForEach, Identifiable", caption: "SwiftUI must tell rows apart, so each element needs a stable identity: Identifiable means an id that is unique and never changes. Star Pancakes, then delete the first row, in each mode.") { // The card.
            Picker("Identify rows by", selection: $byPosition) { // The two ways to identify rows.
                Text("id (Identifiable)").tag(false) // The right way.
                Text("Position (index)").tag(true) // The mistake from the callout.
            }
            .pickerStyle(.segmented) // Side by side.
            List { // A scrolling container with system row styling.
                if byPosition { // Positions as identities.
                    ForEach(recipes.indices, id: \.self) { index in StarRow(name: recipes[index].name) } // Row 0 is "whatever is first".
                } else { // Real identities.
                    ForEach(recipes) { recipe in StarRow(name: recipe.name) } // Row identity is recipe.id.
                }
            }
            .embeddedForm(height: 190) // A List scrolls on its own, so it gets a fixed height inside this page.
            HStack { // The two actions.
                Button("Delete the first row") { if !recipes.isEmpty { recipes.removeFirst() } } // Removes Pancakes.
                    .buttonStyle(.bordered) // Framed.
                Button("Start over") { recipes = Recipe.starters } // Fresh rows.
                    .font(.footnote) // Secondary.
            }
            Text(byPosition ? "By position, the star stays on row 0, so it jumps to Tomato Soup: positions are not identities." : "By id, the star leaves with Pancakes: each row's state follows its own data.") // What to notice in each mode.
                .font(.footnote) // Small.
                .foregroundStyle(byPosition ? .red : .secondary) // Red for the mistake.
            Text("ForEach builds views from data and is re-evaluated whenever the data changes. id: \\.self uses the value itself as the identity: fine for unique strings, wrong if duplicates can appear.") // The remaining points.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - A list of recipes

/// The course's RecipeListView (lesson 4.6 version), with the challenges as inputs.
struct RecipeListView: View { // `struct RecipeListView: View`
    var recipes = Recipe.starters // The course's three recipes (challenge 1 adds more).
    var richRows = false // Challenge 2: an HStack row with a Spacer.
    var plain = false // Challenge 3: .listStyle(.plain).

    var body: some View { // One row per recipe.
        List(recipes) { recipe in // List can take Identifiable data directly.
            if richRows { // Challenge 2.
                HStack { Text(recipe.name); Spacer(); Text("\(recipe.minutes) min").foregroundStyle(.secondary) } // Name left, time right.
            } else { // The course's row.
                Text(recipe.rowText) // `Text("\(recipe.name), \(recipe.minutes) min")`
            }
        }
        .listStyle(plain: plain) // The default inset grouped style, or plain.
    }
}

/// Code: A list of recipes.
private struct RecipeListCard: View { // One card.
    @State private var recipes = Recipe.starters // Starts with three.
    @State private var richRows = false // Challenge 2.
    @State private var plain = false // Challenge 3.

    var body: some View { // Redraws when a choice changes.
        DemoCard(title: "A list of recipes", caption: "An array of Recipe values becomes a scrolling list. Each recipe gets a unique random id when it is created, so SwiftUI can track every row.") { // The card.
            RecipeListView(recipes: recipes, richRows: richRows, plain: plain) // The live list.
                .embeddedForm(height: 250) // Fixed height inside the page.
            Button("Add a recipe") { // Challenge 1: the list grows with no other change.
                if let next = Recipe.extras.first(where: { extra in !recipes.contains { $0.name == extra.name } }) { recipes.append(next) } // The next extra not yet in the list.
            }
            .disabled(recipes.count == Recipe.starters.count + Recipe.extras.count) // Every extra is already in.
            Toggle("HStack row with Spacer()", isOn: $richRows) // Challenge 2.
            Toggle(".listStyle(.plain)", isOn: $plain) // Challenge 3.
        }
    }
}

// MARK: - Grouping rows with Section

/// The course's MealPlanView, with the challenges as inputs.
struct MealPlanView: View { // `struct MealPlanView: View`
    var includesLunch = false // Challenge 1: a Lunch section.
    var plain = false // Challenge 2: .plain instead of .insetGrouped.
    var dinnerLabels = false // Challenge 3: Labels with "moon" for dinner.
    let breakfast = ["Oatmeal", "Pancakes", "Yogurt"] // Plain strings.
    let lunch = ["Salad", "Wrap"] // Challenge 1's data.
    let dinner = ["Tomato Soup", "Fried Rice"] // Plain strings.

    var body: some View { // Sections of rows.
        List { // A list with no data of its own; the sections supply rows.
            Section("Breakfast") { // A header and visual grouping.
                ForEach(breakfast, id: \.self) { meal in // The long form: a named parameter.
                    Label(meal, systemImage: "sun.max") // Each string is its own identity.
                }
            }
            if includesLunch { // Challenge 1.
                Section("Lunch") { // Between the other two.
                    ForEach(lunch, id: \.self) { Text($0) } // The short form.
                }
            }
            Section("Dinner") { // Second (or third) group.
                if dinnerLabels { // Challenge 3.
                    ForEach(dinner, id: \.self) { Label($0, systemImage: "moon") } // Matches the breakfast style.
                } else { // The course's rows.
                    ForEach(dinner, id: \.self) { Text($0) } // The short form: $0 is the element.
                }
            }
        }
        .listStyle(plain: plain) // .insetGrouped in the course.
    }
}

/// Code: Grouping rows with Section.
private struct MealPlanCard: View { // One card.
    @State private var includesLunch = false // Challenge 1.
    @State private var plain = false // Challenge 2.
    @State private var dinnerLabels = false // Challenge 3.

    var body: some View { // Redraws when a choice changes.
        DemoCard(title: "Grouping rows with Section", caption: "Section adds a header and visual grouping; ForEach with id: \\.self builds rows from plain strings. The two ForEach calls show the long and the short way to write the same closure.") { // The card.
            MealPlanView(includesLunch: includesLunch, plain: plain, dinnerLabels: dinnerLabels) // The live list.
                .embeddedForm(height: 400) // Fixed height inside the page.
            Toggle("A Lunch section", isOn: $includesLunch.animation()) // Challenge 1.
            Toggle(".plain instead of .insetGrouped", isOn: $plain) // Challenge 2.
            Toggle("Dinner rows as Labels with \"moon\"", isOn: $dinnerLabels) // Challenge 3.
        }
    }
}

// MARK: - Swipe to delete, and the empty state

/// The course's ShoppingListView. The card owns the list and passes a binding, so its
/// Refill button can reset it; in the course the array is @State inside this view.
struct ShoppingListView: View { // `struct ShoppingListView: View`
    @Binding var list: ShoppingList // The items, owned by the card.
    var allDone = false // Challenge 2: "checkmark.circle" and "All Done".

    var body: some View { // Re-runs when the items change.
        List { // The rows.
            ForEach(list.items, id: \.self) { Text($0) } // One row per item.
                .onDelete { list.delete(at: $0) } // Swipe left for Delete; remove the rows from the data.
        }
        .overlay { // Drawn on top of the list.
            if list.isEmpty { // Only when the last row is gone.
                ContentUnavailableView( // The system's standard empty state.
                    allDone ? "All Done" : "List Complete", // Title.
                    systemImage: allDone ? "checkmark.circle" : "cart", // Symbol.
                    description: Text("Everything is in the cart.") // Explanation.
                ) // End of the empty state.
            }
        }
    }
}

/// Code: Swipe to delete, and the empty state.
private struct ShoppingListCard: View { // One card.
    @State private var list = ShoppingList() // Eggs, Milk, Bread.
    @State private var allDone = false // Challenge 2.

    var body: some View { // Redraws when the list changes.
        DemoCard(title: "Swipe to delete, and the empty state", caption: "onDelete gives every row the standard swipe-left Delete button. When the last row goes, ContentUnavailableView appears in an overlay. Swipe all the items away.") { // The card.
            ShoppingListView(list: $list, allDone: allDone) // The live list.
                .embeddedForm(height: 230) // Fixed height inside the page.
            HStack { // Actions.
                Button("Add Coffee") { withAnimation { list.add("Coffee") } } // Challenge 1: then delete it.
                    .disabled(list.items.contains("Coffee")) // Only once, because rows use id: \.self.
                Button("Empty the list") { withAnimation { list.delete(at: IndexSet(list.items.indices)) } } // Challenge 3: see the empty state at once.
                Button("Refill") { withAnimation { list.restore() } } // Start again.
            }
            .buttonStyle(.bordered) // Framed buttons.
            .controlSize(.small) // Compact.
            Toggle("\"checkmark.circle\" and \"All Done\"", isOn: $allDone) // Challenge 2.
        }
    }
}

// MARK: - Custom swipe actions

/// The course's TodayView. The card owns the checklist and passes a binding.
struct TodayView: View { // `struct TodayView: View`
    @Binding var checklist: HabitChecklist // The habits and the done set.
    var undoFirst = false // Challenge 1: swap the order of the two buttons.
    var orangeDone = false // Challenge 2: .tint(.orange).

    var body: some View { // Re-runs when the done set changes.
        List(checklist.habits, id: \.self) { habit in // One row per habit.
            Label(habit, systemImage: checklist.symbol(for: habit)) // The icon follows the done set.
                .swipeActions { // Your own buttons behind the row.
                    if undoFirst { undoButton(habit); doneButton(habit) } // Challenge 1: the first button sits at the far edge.
                    else { doneButton(habit); undoButton(habit) } // The course's order.
                }
        }
    }

    /// The Done button: inserts the habit into the set.
    private func doneButton(_ habit: String) -> some View { // One definition for either order.
        Button("Done") { checklist.markDone(habit) } // `done.insert(habit)`
            .tint(orangeDone ? .orange : .green) // .green in the course.
    }

    /// The Undo button: removes the habit from the set.
    private func undoButton(_ habit: String) -> some View { // One definition for either order.
        Button("Undo") { checklist.undo(habit) } // `done.remove(habit)`
            .tint(.gray) // Gray.
    }
}

/// Code: Custom swipe actions.
private struct TodayCard: View { // One card.
    @State private var checklist = HabitChecklist() // Three habits, none done.
    @State private var undoFirst = false // Challenge 1.
    @State private var orangeDone = false // Challenge 2.

    var body: some View { // Redraws when the checklist changes.
        DemoCard(title: "Custom swipe actions", caption: "swipeActions puts your own buttons behind a row. Swipe a habit to the left and tap Done or Undo. Custom actions replace the automatic Delete, so add one yourself when you need it.") { // The card.
            TodayView(checklist: $checklist, undoFirst: undoFirst, orangeDone: orangeDone) // The live list.
                .embeddedForm(height: 230) // Fixed height inside the page.
            ValueRow(name: "done", value: checklist.done.isEmpty ? "[]" : checklist.done.sorted().joined(separator: ", ")) // The set, sorted for reading.
            Toggle("Swap the order of the two buttons", isOn: $undoFirst) // Challenge 1.
            Toggle(".tint(.orange) on Done", isOn: $orangeDone) // Challenge 2.
            Button("Add \"Meditate\"") { withAnimation { checklist.add("Meditate") } } // Challenge 3.
                .disabled(checklist.habits.contains("Meditate")) // Once only.
        }
    }
}

// MARK: - Filtering with searchable

/// The course's RecipeSearchView: a NavigationStack with a searchable list.
struct RecipeSearchView: View { // `struct RecipeSearchView: View`
    var recipes = RecipeSearch.recipes // The course's six (challenge 1 adds three).
    var prefixOnly = false // Challenge 2: hasPrefix instead of contains.
    @State private var query = "" // Ordinary state, bound to the search field.

    /// The visible rows: computed from the full array and the query.
    var results: [String] { RecipeSearch.results(in: recipes, matching: query, prefixOnly: prefixOnly) } // A derived value.

    var body: some View { // Re-runs on every keystroke.
        NavigationStack { // The search field lives in the navigation container.
            List(results, id: \.self) { Text($0) } // Only the matches.
                .navigationTitle("Recipes") // The bar's title.
                .searchable(text: $query) // The system search field, bound to query.
                .overlay { // When nothing matches...
                    if results.isEmpty { ContentUnavailableView.search(text: query) } // ...the system's "No Results" state.
                }
        }
    }
}

/// Code: Filtering with searchable.
private struct RecipeSearchCard: View { // One card.
    @State private var showingSearch = false // Whether the sheet is open.
    @State private var moreRecipes = false // Challenge 1.
    @State private var prefixOnly = false // Challenge 2.
    @State private var tryQuery = "pa" // A query to test the filter right here.

    /// The array the search uses, with the challenge's three extra recipes.
    private var recipes: [String] { RecipeSearch.recipes + (moreRecipes ? ["Lentil Soup", "Green Salad", "Pasta Bake"] : []) } // Derived.

    var body: some View { // Redraws when a choice changes.
        DemoCard(title: "Filtering with searchable", caption: "searchable adds the system search field, which lives in a navigation container, so RecipeSearchView brings its own NavigationStack and opens in a sheet here. The query is ordinary state; the rows come from a computed property.") { // The card.
            Button("Open RecipeSearchView") { showingSearch = true } // Presents the sheet.
                .buttonStyle(.borderedProminent) // The main action.
            Toggle("Three more recipes", isOn: $moreRecipes) // Challenge 1.
            Toggle("Match the start only (hasPrefix)", isOn: $prefixOnly) // Challenge 2.
            TextField("Try a query", text: $tryQuery) // The same filter, right here.
                .textFieldStyle(.roundedBorder) // A visible field.
                .autocorrectionDisabled() // Searching needs no autocorrect.
                .textInputAutocapitalization(.never) // Nor capitals.
            ConsoleView(lines: RecipeSearch.results(in: recipes, matching: tryQuery, prefixOnly: prefixOnly)) // The computed results.
        }
        .sheet(isPresented: $showingSearch) { // The search screen on top of the page.
            ClosableDemo(title: "RecipeSearchView") { // A Close bar above the demo.
                RecipeSearchView(recipes: recipes, prefixOnly: prefixOnly) // The course's view, with its own NavigationStack.
            }
        }
    }
}

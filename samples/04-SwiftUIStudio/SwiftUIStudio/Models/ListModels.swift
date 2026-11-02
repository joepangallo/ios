// ListModels.swift
// Who: lesson 4.6, Lists and Dynamic Data.
// What: the data behind the list cards: recipes with stable identities, the
//       shopping list you swipe to delete, the habit checklist with custom swipe
//       actions, and the search filter.
// Where: the Models folder; plain Swift, so the tests can check every rule.
// When: whenever a row is added, deleted, marked done or filtered.
// Why: a List only draws rows. Deciding which rows exist belongs to the data,
//      and data written in plain Swift can be tested without a screen.

import Foundation // UUID and IndexSet.

/// A recipe in lesson 4.6's list: `struct Recipe: Identifiable`.
struct Recipe: Identifiable, Equatable { // Identifiable: List needs a stable id for each row.
    let id = UUID() // A unique random identifier, made once when the recipe is created.
    let name: String // For example "Pancakes".
    let minutes: Int // How long it takes.

    /// The three recipes the course starts with.
    static let starters = [ // Read by the list cards and the tests.
        Recipe(name: "Pancakes", minutes: 20), // First row.
        Recipe(name: "Tomato Soup", minutes: 35), // Second row.
        Recipe(name: "Fried Rice", minutes: 15), // Third row.
    ] // End of the starters.

    /// More recipes for the "add a fourth recipe" challenge, used in turn.
    static let extras = [ // Picked one at a time by the Add button.
        Recipe(name: "Green Salad", minutes: 10), // Fourth.
        Recipe(name: "Lentil Soup", minutes: 40), // Fifth.
        Recipe(name: "Pad Thai", minutes: 25), // Sixth.
    ] // End of the extras.

    /// The row text from the course: "Pancakes, 20 min".
    var rowText: String { "\(name), \(minutes) min" } // `Text("\(recipe.name), \(recipe.minutes) min")`
}

/// The shopping list from "Swipe to delete, and the empty state".
struct ShoppingList { // A value type held in @State.
    static let startingItems = ["Eggs", "Milk", "Bread"] // `@State private var items = ["Eggs", "Milk", "Bread"]`
    private(set) var items = ShoppingList.startingItems // The rows on screen.

    /// true when the empty state should appear.
    var isEmpty: Bool { items.isEmpty } // Read by the overlay.

    /// Removes the rows at the given positions, the way onDelete reports them.
    mutating func delete(at offsets: IndexSet) { // `.onDelete { items.remove(atOffsets: $0) }`
        for index in offsets.sorted(by: >) where items.indices.contains(index) { // Highest first, so earlier positions do not shift.
            items.remove(at: index) // Take the row out of the array.
        }
    }

    /// Adds an item (the "add Coffee" challenge).
    mutating func add(_ item: String) { // Duplicates are refused because rows use id: \.self.
        guard !items.contains(item) else { return } // Two "Milk" rows would share one identity.
        items.append(item) // New row at the bottom.
    }

    /// Puts the starting items back so the demo can run again.
    mutating func restore() { // The Refill button.
        items = ShoppingList.startingItems // The same three items.
    }
}

/// The habits from "Custom swipe actions", with the set of habits done today.
struct HabitChecklist { // A value type held in @State.
    private(set) var habits = ["Read 10 pages", "Walk after lunch", "Stretch"] // `let habits = [...]`
    private(set) var done: Set<String> = [] // `@State private var done: Set<String> = []`

    /// The Done swipe button.
    mutating func markDone(_ habit: String) { // `done.insert(habit)`
        done.insert(habit) // A set ignores a second insert of the same habit.
    }

    /// The Undo swipe button.
    mutating func undo(_ habit: String) { // `done.remove(habit)`
        done.remove(habit) // Removing a habit that is not there does nothing.
    }

    /// The row's symbol follows the set: a filled check when done, an empty circle otherwise.
    func symbol(for habit: String) -> String { // `done.contains(habit) ? "checkmark.circle.fill" : "circle"`
        done.contains(habit) ? "checkmark.circle.fill" : "circle" // Derived, never stored.
    }

    /// Adds a habit (the "add Meditate" challenge); duplicates are refused.
    mutating func add(_ habit: String) { // Rows use id: \.self, so names must stay unique.
        guard !habits.contains(habit) else { return } // Already there.
        habits.append(habit) // New row at the bottom.
    }

    /// How many habits are done, for a summary line.
    var doneCount: Int { done.count } // Derived from the set.
}

/// The search filter from "Filtering with searchable".
enum RecipeSearch { // A namespace for one rule.
    /// The six recipes in the course's search example.
    static let recipes = ["Pancakes", "Tomato Soup", "Fried Rice", "Pad Thai", "Pasta Salad", "Tacos"] // The full array.

    /// The visible rows: everything when the query is empty, otherwise the matches.
    /// `prefixOnly` is the challenge that swaps contains for hasPrefix.
    static func results(in recipes: [String], matching query: String, prefixOnly: Bool = false) -> [String] { // A computed property in the course.
        if query.isEmpty { return recipes } // `if query.isEmpty { return recipes }`
        let needle = query.lowercased() // Compare in lowercase so "pa" finds "Pancakes".
        return recipes.filter { recipe in // Keep only the matches.
            let name = recipe.lowercased() // Lowercase the name too.
            return prefixOnly ? name.hasPrefix(needle) : name.contains(needle) // The challenge's variation, or the course's rule.
        }
    }
}

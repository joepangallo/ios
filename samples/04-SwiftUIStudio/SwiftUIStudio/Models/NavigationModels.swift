// NavigationModels.swift
// Who: lesson 4.7, Navigation, Tabs, and Sheets.
// What: the navigation-pattern chooser (push, tabs, sheet or alert), and the
//       NavigationStack path model: a plain array of values that grows when a
//       screen is pushed and shrinks when you go back.
// Where: the Models folder; plain Swift, so the tests can drive the path directly.
// When: whenever you push, go back, jump, or answer a pattern question.
// Why: a NavigationStack shows exactly what its path array holds. Because the
//      path is ordinary data, changing the array IS navigating, and a test can
//      check navigation without tapping anything.

import Foundation // Plain Swift.

// MARK: - Choosing a pattern

/// The four ways to move between screens that the lesson names.
enum NavigationPattern: String, CaseIterable, Identifiable { // Shown as answer buttons.
    case push = "Push", tabs = "Tabs", sheet = "Sheet", alert = "Alert" // Short button titles.
    var id: String { rawValue } // Identifiable for ForEach.
}

/// One situation and the pattern that fits it.
struct PatternScenario: Identifiable { // One question in the chooser.
    let situation: String // What the app needs to do.
    let answer: NavigationPattern // The pattern that matches the relationship.
    let reason: String // Why, in one sentence.
    var id: String { situation } // Situations are unique.

    /// The questions, taken from the lesson's own examples and quiz.
    static let all = [ // Read by the chooser card and the tests.
        PatternScenario(situation: "Open a recipe from the recipe list", answer: .push, reason: "Parent and child: drill down, then come back with the back button."), // Hierarchical.
        PatternScenario(situation: "Switch between Today, History and Settings all day", answer: .tabs, reason: "Peers of equal importance: each section stays in place while you visit another."), // Flat.
        PatternScenario(situation: "Add a new habit, then return to the list", answer: .sheet, reason: "A short side task that ends: it slides up and goes away when the job is done."), // Modal.
        PatternScenario(situation: "The person tapped Delete Account", answer: .alert, reason: "A yes-or-no that cannot wait, before data is destroyed."), // Alert.
    ] // End of the scenarios.
}

// MARK: - The path behind a NavigationStack

/// The recipes in the path lab.
enum PathRecipe: String, CaseIterable, Hashable { // Hashable: navigation values must be hashable.
    case pancakes = "Pancakes", soup = "Tomato Soup", lemonBars = "Lemon Bars" // The lab's three recipes.

    /// How many steps each recipe has.
    var stepCount: Int { 3 } // Every recipe in the lab has three steps.
}

/// One screen on the stack: a recipe, or one step of a recipe.
enum Route: Hashable { // `enum Route: Hashable { case recipe(Recipe), step(Recipe, Int) }`
    case recipe(PathRecipe) // The recipe's overview screen.
    case step(PathRecipe, Int) // Step n of that recipe.

    /// The value written the way Swift code would write it, for the path readout.
    var code: String { // For example ".step(.soup, 3)".
        switch self { // One spelling per case.
        case .recipe(let recipe): ".recipe(.\(recipe.caseName))" // A recipe screen.
        case .step(let recipe, let number): ".step(.\(recipe.caseName), \(number))" // A step screen.
        }
    }

    /// The navigation title for this screen.
    var title: String { // Shown in the pushed screen's bar.
        switch self { // One title per case.
        case .recipe(let recipe): recipe.rawValue // "Tomato Soup"
        case .step(_, let number): "Step \(number)" // "Step 3"
        }
    }
}

extension PathRecipe { // A helper used only by Route.code.
    /// The case name as written in code, for example "soup" for Tomato Soup.
    var caseName: String { // rawValue is the display name, so the case name is spelled out here.
        switch self { // One name per case.
        case .pancakes: "pancakes" // .pancakes
        case .soup: "soup" // .soup
        case .lemonBars: "lemonBars" // .lemonBars
        }
    }
}

/// The path lab's data: the array a NavigationStack is driven by, plus the sheet flag.
struct RoutePath { // Held in @State; the stack binds to `path`.
    var path: [Route] = [] // `@State private var path: [Route] = []`. The root screen is never in it.
    var showingNewRecipe = false // `@State private var showingNewRecipe = false`: the sheet's own state.

    /// Pushes one screen: append a value.
    mutating func push(_ route: Route) { // A NavigationLink(value:) tap does exactly this.
        path.append(route) // The new screen slides in on top.
    }

    /// The back button: remove the last value.
    mutating func back() { // `path.removeLast()`
        guard !path.isEmpty else { return } // The root cannot be popped.
        path.removeLast() // The top screen slides away.
    }

    /// Pop to root: empty the array.
    mutating func popToRoot() { // `path.removeAll()`
        path.removeAll() // Every pushed screen goes at once.
    }

    /// Jump straight to Tomato Soup, Step 3 by replacing the whole array, the way a deep link does.
    mutating func jumpToSoupStep3() { // `path = [.recipe(.soup), .step(.soup, 3)]`
        path = [.recipe(.soup), .step(.soup, 3)] // Two screens built in one assignment.
    }

    /// The path as code, for example "[.recipe(.soup), .step(.soup, 3)]".
    var pathCode: String { "[" + path.map(\.code).joined(separator: ", ") + "]" } // An empty path reads "[]".

    /// "2 values, 3 screens": the root is a screen but never a value.
    var countText: String { // Shown under the path readout.
        let values = path.count // Values in the array.
        let screens = values + 1 // Always one more screen than values: the root.
        return "\(values) value\(values == 1 ? "" : "s"), \(screens) screen\(screens == 1 ? "" : "s")" // "0 values, 1 screen".
    }
}

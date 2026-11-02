// NavigationModels.swift
// Who: the navigation lesson's "Pick the pattern" quiz (5.7) and its tests.
// What: the four navigation choices, eight real product scenarios with the
//       recommended pattern and the reasoning for every pick, and a quiz that
//       scores only the first pick for each scenario.
// Where: the Models folder; plain values and one small state struct.
// When: whenever the quiz card appears or the student picks a pattern.
// Why: choosing a pattern is a judgment with reasons. Keeping the scenarios as
//      data keeps the screen simple and lets tests check the scoring rules.

import Foundation // Basic types only.

/// The navigation patterns a student can pick.
nonisolated enum NavPattern: String, CaseIterable, Identifiable, Sendable { // CaseIterable lists the four buttons.
    case tabs, stack, sheet, combo // Tab bar, navigation stack, sheet, tabs with a stack in each.

    var id: String { rawValue } // Identifiable for ForEach.

    /// The button title.
    var title: String { // Plain words.
        switch self { // One title per pattern.
        case .tabs: "Tab bar" // Flat.
        case .stack: "Navigation stack" // Hierarchical.
        case .sheet: "Sheet" // Modal.
        case .combo: "Tab bar + stacks" // The usual combination.
        }
    }

    /// The SF Symbol on the button.
    var symbol: String { // Same symbols as the course figure.
        switch self { // One symbol per pattern.
        case .tabs: "square.grid.2x2" // Several peers.
        case .stack: "chevron.right" // Drill down.
        case .sheet: "arrow.up" // Slides up.
        case .combo: "square.stack.3d.up" // Layers.
        }
    }

    /// The SwiftUI types that build the pattern.
    var swiftTypes: String { // Shown after each pick.
        switch self { // One answer per pattern.
        case .tabs: "TabView + Tab" // Flat.
        case .stack: "NavigationStack + NavigationLink" // Hierarchical.
        case .sheet: ".sheet(isPresented:)" // Modal.
        case .combo: "TabView, with a NavigationStack inside each Tab" // Combined.
        }
    }
}

/// One product scenario.
nonisolated struct NavScenario: Identifiable, Sendable { // A value: the list never changes.
    let title: String // A short name for the scenario.
    let app: String // The kind of app.
    let prompt: String // What people do on these screens.
    let best: NavPattern // The recommended pattern.
    let close: [NavPattern] // Picks that are nearly right.
    let feedback: [NavPattern: String] // Why each pattern fits or not.
    var id: String { title } // Titles are unique.
}

/// What one pick earned.
nonisolated enum PickResult: Equatable, Sendable { // Three grades.
    case best // The recommended pattern.
    case close // Nearly right.
    case worse // A poor fit.
}

/// The quiz: the first pick for each scenario counts; later picks only explore.
nonisolated struct NavQuiz: Sendable { // A value: SwiftUI stores it in @State.
    let scenarios: [NavScenario] // The questions, in order.
    private(set) var firstPicks: [String: NavPattern] = [:] // Scenario title to the first pattern picked.

    init(scenarios: [NavScenario] = NavScenario.all) { self.scenarios = scenarios } // The course's eight by default.

    /// Grades a pick and records it if it is the first for that scenario.
    mutating func pick(_ pattern: NavPattern, for scenario: NavScenario) -> PickResult { // mutating: it changes firstPicks.
        if firstPicks[scenario.id] == nil { firstPicks[scenario.id] = pattern } // Only the first pick is recorded.
        if pattern == scenario.best { return .best } // Exactly right.
        return scenario.close.contains(pattern) ? .close : .worse // Nearly right, or not.
    }

    /// How many first picks were the recommended pattern.
    var score: Int { // Close picks earn no point, but their feedback says why.
        scenarios.filter { firstPicks[$0.id] == $0.best }.count // Count the exact first picks.
    }

    /// True once every scenario has a first pick.
    var isComplete: Bool { firstPicks.count == scenarios.count } // Used to show the summary.

    /// Starts over.
    mutating func reset() { firstPicks = [:] } // Forget every pick.
}

nonisolated extension NavScenario { // The scenarios themselves, kept apart from the logic; nonisolated like the type.
    /// The eight scenarios from the course's "Pick the pattern" step.
    static let all: [NavScenario] = [ // In course order.
        NavScenario(title: "Recipe details", app: "Cooking app", // Scenario 1.
                    prompt: "People scroll a list of recipes. Tapping a recipe opens its ingredients; tapping an ingredient shows possible substitutions.", // The task.
                    best: .stack, close: [], feedback: [ // A hierarchy.
                        .stack: "Each screen is a more specific view of the one before it: list, recipe, ingredient. That is a hierarchy, so a NavigationStack with a NavigationLink per row fits. The back button and the edge swipe step back one level at a time, so people never lose their place.", // Best.
                        .tabs: "Tabs are for peer sections that exist side by side. Ingredients are not a peer of the recipe list; they belong to one recipe. As tabs, people would lose track of which recipe they were reading.", // Worse.
                        .sheet: "A sheet suits a short task people finish or cancel. Reading a recipe is browsing, and opening the ingredient as a sheet on top of a recipe sheet creates a modal-on-modal trap.", // Worse.
                        .combo: "The app as a whole may have tabs, but the movement asked about here is the drill-down from list to recipe to ingredient, and that is a stack. A tab bar adds nothing to it.", // Worse.
                    ]),
        NavScenario(title: "Writing a message", app: "Mail app", // Scenario 2.
                    prompt: "From the inbox, people tap Compose, write a message, and then either send it or throw it away.", // The task.
                    best: .sheet, close: [], feedback: [ // A task with an end.
                        .sheet: "Writing a message is a focused task with a clear end: Send or Cancel. A sheet keeps the inbox visible behind it, and dismissing it returns people exactly where they were. SwiftUI: a toolbar button sets a Bool that drives .sheet(isPresented:).", // Best.
                        .stack: "Pushing the editor makes it look like a deeper level of the inbox, and the back button becomes ambiguous: does going back send, save, or discard? A task with Cancel and Send belongs in a sheet.", // Worse.
                        .tabs: "A \"New\" tab turns an action into a place. Tabs keep their state, so a half-written draft would linger there unexplained, and there is no clear Cancel.", // Worse.
                        .combo: "The app may use tabs and stacks for browsing mail, but composing is an action, not a section or a level. Present it as a sheet from the inbox toolbar.", // Worse.
                    ]),
        NavScenario(title: "Main areas of a music app", app: "Music app", // Scenario 3.
                    prompt: "Four equally important areas: Listen Now, Library, Radio, and Search. People jump between them all day. Inside Library they open an album, then a song's credits.", // The task.
                    best: .combo, close: [.tabs], feedback: [ // Peers with depth.
                        .combo: "Four peer areas used constantly call for a tab bar, and Library also has depth, so each tab gets its own NavigationStack. Switching to Radio and back leaves people on the same album, because every tab remembers its own path.", // Best.
                        .tabs: "Close. The top level is a tab bar, but Library drills into albums and credits. Without a NavigationStack inside each tab there is no back button for that hierarchy. Tabs with a stack in each cover both needs.", // Close.
                        .stack: "A single stack would make Radio a level \"inside\" another screen, and reaching Search would take several back taps. Peer areas belong side by side in tabs.", // Worse.
                        .sheet: "Sheets are for short, interrupting tasks, not for the main areas of an app that people live in. They would open and close screens all day.", // Worse.
                    ]),
        NavScenario(title: "A settings hierarchy", app: "Settings", // Scenario 4.
                    prompt: "A settings list shows General, Display, and Privacy. General opens Language & Region, which opens the list of languages.", // The task.
                    best: .stack, close: [], feedback: [ // A hierarchy.
                        .stack: "Each tap goes one level deeper into the same branch: the textbook hierarchy. A NavigationStack gives every level a back button, and a swipe from the left edge climbs back one level at a time.", // Best.
                        .tabs: "General, Display, and Privacy are categories inside one list, not places people switch between all day. Tabs would also leave nowhere to put the deeper levels.", // Worse.
                        .sheet: "Opening each level as a sheet stacks modal on modal. People lose track of where they are and must dismiss every layer by hand.", // Worse.
                        .combo: "If settings is one tab of a larger app, that tab contains exactly this stack. But the movement asked about is the drill-down, which is a NavigationStack.", // Worse.
                    ]),
        NavScenario(title: "Accounts and transactions", app: "Banking app", // Scenario 5.
                    prompt: "Accounts, Payments, and Profile are separate areas. Tapping an account lists its transactions; tapping a transaction shows its details.", // The task.
                    best: .combo, close: [.tabs], feedback: [ // Peers with depth.
                        .combo: "Three peer areas at the top and a clear hierarchy under Accounts: tabs at the root, a NavigationStack inside each tab. Switching to Payments and back keeps people on the same transaction.", // Best.
                        .tabs: "Close. Tabs fit the top level, but transactions and their details need a drill-down with a back button. Put a NavigationStack inside each tab.", // Close.
                        .stack: "Payments and Profile are not children of Accounts. Forcing everything into one stack hides them behind back buttons.", // Worse.
                        .sheet: "Accounts and transactions are places people browse and return to, not a short task to finish and dismiss.", // Worse.
                    ]),
        NavScenario(title: "Adding a calendar event", app: "Calendar", // Scenario 6.
                    prompt: "People tap + to add an event: a title, a start and end time, and a location. Then they either add it or cancel.", // The task.
                    best: .sheet, close: [], feedback: [ // A task with an end.
                        .sheet: "Creating an event is a short task with a finish line. A sheet with Cancel on the leading side and Add on the trailing side (disabled until there is a title) keeps the calendar in context; swiping down acts like Cancel.", // Best.
                        .stack: "Pushing the form suggests it is a deeper level of the calendar, and Back leaves people guessing whether the event was saved.", // Worse.
                        .tabs: "An \"Add\" tab is an action pretending to be a place. Tabs are sections people return to, and they never offer a Cancel.", // Worse.
                        .combo: "The calendar can use tabs and stacks for browsing, but adding an event is a modal task: present it as a sheet from a toolbar button.", // Worse.
                    ]),
        NavScenario(title: "Three views of the weather", app: "Weather app", // Scenario 7.
                    prompt: "Forecast, Radar, and Alerts. Each is a single screen with nothing deeper, and people flip between them often.", // The task.
                    best: .tabs, close: [.combo], feedback: [ // Flat peers.
                        .tabs: "Three peer views, used often, with no hierarchy below them: a TabView with three Tabs is all it needs. Short nouns and clear symbols keep the tab bar easy to scan.", // Best.
                        .combo: "Close, just more than needed. With no deeper screens, a NavigationStack in each tab only adds a title bar. Start with plain tabs and add a stack when a tab gains depth.", // Close.
                        .stack: "Radar is not a child of Forecast. In a stack, getting from Alerts back to Radar takes extra taps for no reason.", // Worse.
                        .sheet: "These are the main places in the app, not interruptions. Hiding them in sheets makes people open and close screens constantly.", // Worse.
                    ]),
        NavScenario(title: "Adjusting a photo", app: "Photo editor", // Scenario 8.
                    prompt: "While editing a photo, people open Adjust to change brightness and warmth, then close it and keep working on the same photo.", // The task.
                    best: .sheet, close: [], feedback: [ // A short task over content.
                        .sheet: "Adjusting is a quick, focused task on the current photo. A partial-height sheet (.presentationDetents([.medium])) keeps the photo visible above the sliders so people see each change live, and Done returns them to editing.", // Best.
                        .stack: "Pushing a new screen would hide the very photo people are adjusting, and Back would not say whether the change was kept.", // Worse.
                        .tabs: "Adjust is a tool for one photo, not a top-level section of the app. As a tab it would also lose the connection to the photo being edited.", // Worse.
                        .combo: "The app around it may use tabs and stacks, but the adjust panel is a short task over the current content: a sheet.", // Worse.
                    ]),
    ]
}

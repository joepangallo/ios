// UITestSupportTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: tests for lesson 9.3's query explorer: how a subscript query matches
//       identifiers or labels, which journeys survive translation, and which
//       need the -ui-testing launch argument.
// Where: the StudyBuddyTests target.
// When: on every test run. The explorer is pure, so no simulator UI is needed.
// Why: the explorer explains why the real UI tests use identifiers; these tests
//      keep that explanation correct.

import Testing // Swift Testing: @Suite, @Test and #expect.
@testable import StudyBuddy // Lets the tests see the app's internal types.

@Suite("Query explorer") // The widget from lesson 9.3.
struct QueryExplorerTests { // A fresh instance per test.
    @Test("Identifier queries match in both languages", arguments: [false, true]) // English, then Spanish.
    func identifiersSurvive(spanish: Bool) { // One case per language.
        let tree = QueryExplorer.tree(sessions: [], spanish: spanish) // Arrange.
        for key in ["addSessionButton", "saveSessionButton"] { // Two button identifiers.
            #expect(QueryExplorer.matches(TreeQuery(kind: .buttons, key: key), in: tree).count == 1) // Exactly one match.
        }
        #expect(QueryExplorer.matches(TreeQuery(kind: .textFields, key: "sessionTitleField"), in: tree).count == 1) // The field too.
    }

    @Test("Label queries stop matching in Spanish") // The fragile kind of query.
    func labelsBreak() { // English works, Spanish does not.
        let save = TreeQuery(kind: .buttons, key: "Save") // A label query.
        #expect(QueryExplorer.matches(save, in: QueryExplorer.tree(sessions: [], spanish: false)).count == 1) // English: found.
        #expect(QueryExplorer.matches(save, in: QueryExplorer.tree(sessions: [], spanish: true)).isEmpty) // Spanish: "Guardar".
    }

    @Test("The type must match too") // app.buttons never finds a text field.
    func typeMatters() { // Same key, wrong collection.
        let query = TreeQuery(kind: .buttons, key: "sessionTitleField") // A field's identifier, but searching buttons.
        #expect(QueryExplorer.matches(query, in: QueryExplorer.tree(sessions: [], spanish: false)).isEmpty) // No match.
    }

    @Test("The identifier journey passes in every setting", arguments: [false, true], [false, true]) // Two lists: every combination.
    func identifierJourney(seeded: Bool, spanish: Bool) { // Four cases.
        #expect(QueryExplorer.runTest(steps: QueryExplorer.identifierTest, seeded: seeded, spanish: spanish) == nil) // Green everywhere.
    }

    @Test("The label journey fails in Spanish with XCTest's message") // What the course quiz describes.
    func labelJourney() { // English passes, Spanish fails.
        #expect(QueryExplorer.runTest(steps: QueryExplorer.labelTest, seeded: true, spanish: false) == nil) // English.
        #expect(QueryExplorer.runTest(steps: QueryExplorer.labelTest, seeded: true, spanish: true) == "No matches found for app.buttons[\"Add Session\"]") // Spanish.
    }

    @Test("Seeded rows need -ui-testing") // Known data.
    func seededRows() { // With and without the flag.
        #expect(QueryExplorer.runTest(steps: QueryExplorer.seededRowsTest, seeded: true, spanish: true) == nil) // Present, in any language.
        #expect(QueryExplorer.runTest(steps: QueryExplorer.seededRowsTest, seeded: false, spanish: false) != nil) // Missing.
    }

    @Test("Query code reads like a UI test") // What the picker shows.
    func codeText() { // One query.
        #expect(TreeQuery(kind: .textFields, key: "sessionTitleField").code == "app.textFields[\"sessionTitleField\"]") // Exact text.
    }
}

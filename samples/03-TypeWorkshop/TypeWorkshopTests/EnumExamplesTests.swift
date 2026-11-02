// EnumExamplesTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks every program in lesson 3.3 against the course's expected
//       output, the switch helpers, the three-Bools figure and the song screen
//       model's journey through its LoadState cases.
// Where: the TypeWorkshopTests target; the code under test is Models/EnumExamples.swift.
// When: only when tests run.
// Why: the song screen draws whatever state the model holds, so the model must
//      move through exactly the states the course describes.

import Testing // Swift Testing: @Test and #expect.
@testable import TypeWorkshop // Lets the tests see the app's internal types.

@MainActor // The app's types are main-actor isolated by default.
struct EnumExamplesTests { // Lesson 3.3.
    @Test func coffeeSizesMapToOunces() { // Course step "Cases and an exhaustive switch".
        #expect(CasesAndExhaustiveSwitch.run().text == "medium 12\nlarge 16") // The expected output.
        #expect(CasesAndExhaustiveSwitch.ounces(for: .small) == 8) // The one branch the program does not print.
    }

    @Test func rawValuesAndFailableInit() { // Course step "Raw values and CaseIterable".
        #expect(RawValuesAndCaseIterable.run().text == "3 3\nhome\nErrands and shopping\nLoaded medium\n7 is not a priority") // The expected output.
        #expect(RawValuesAndCaseIterable.Priority.allCases.map(\.rawValue) == [1, 2, 3]) // Counting up from 1, in declaration order.
        #expect(RawValuesAndCaseIterable.load(saved: 1) == "Loaded low") // Each valid number maps to its case...
        #expect(RawValuesAndCaseIterable.load(saved: 3) == "Loaded high") // ...including the last one.
        #expect(RawValuesAndCaseIterable.load(saved: 0) == "0 is not a priority") // Below the range: nil.
        #expect(RawValuesAndCaseIterable.load(saved: 4) == "4 is not a priority") // Above the range: nil.
        #expect(RawValuesAndCaseIterable.Category.work.rawValue == "work") // The default String raw value.
    }

    @Test func paymentsDescribeThemselves() { // Course step "Associated values".
        #expect(AssociatedValues.run().text == "Cash at pickup\nCard ending in 4242\nGift card (low balance)\nGift card with $40.0") // The expected output.
        #expect(AssociatedValues.describe(.giftCard(balance: 4.99)) == "Gift card (low balance)") // Just under the where limit.
        #expect(AssociatedValues.describe(.giftCard(balance: 5)) == "Gift card with $5.0") // Exactly 5 is not low.
        #expect(AssociatedValues.matchedBranch(for: .cash) == ".cash") // Branch names for the screen...
        #expect(AssociatedValues.matchedBranch(for: .card(last4: "1")) == ".card(let last4)") // ...for cards...
        #expect(AssociatedValues.matchedBranch(for: .giftCard(balance: 1)).contains("where")) // ...the where branch...
        #expect(AssociatedValues.matchedBranch(for: .giftCard(balance: 9)) == ".giftCard(let balance)") // ...and the general one.
    }

    @Test func threeBoolsAllowEightCombinationsButOnlyFourMakeSense() { // Concept "Model screen state with one enum".
        #expect(ThreeBoolsOrOneEnum.allCombinations.count == 8) // 2 x 2 x 2.
        #expect(Set(ThreeBoolsOrOneEnum.allCombinations).count == 8) // All different.
        #expect(ThreeBoolsOrOneEnum.validCombinations.count == 4) // Only four are meaningful.
        let names = Set(ThreeBoolsOrOneEnum.validCombinations.compactMap(\.matchingState)) // The states they mean.
        #expect(names == ["idle", "loading", "loaded", "failed"]) // Exactly the enum's four cases.
        let broken = ThreeBoolsOrOneEnum.Flags(isLoading: true, hasError: true, hasData: false) // A spinner on top of an error.
        #expect(broken.matchingState == nil) // Not a real state.
        #expect(broken.drawnParts == ["spinner", "error"]) // Both parts would be drawn at once.
        #expect(ThreeBoolsOrOneEnum.Flags().drawnParts.isEmpty) // idle draws nothing.
    }

    @Test func loadStateMessages() { // Course step "Screen state as an enum".
        #expect(ScreenStateAsEnum.run().text == "Pull to refresh\nLoading...\n2 songs\nError: Offline") // The expected output.
        #expect(ScreenStateAsEnum.LoadState.loaded([]).message == "0 songs") // The empty list case.
    }

    @Test func songScreenLoadsSongs() async { // The real screen model, success path.
        let model = SongScreenModel(delay: .zero) // No waiting in tests.
        #expect(model.state == .idle) // Starts idle.
        await model.load() // loading, then loaded.
        #expect(model.state == .loaded(["Golden Hour", "Night Owl"])) // The songs travel with the case.
        model.reset() // Back to the start.
        #expect(model.state == .idle) // Idle again.
    }

    @Test func songScreenFailsWhenOffline() async { // The real screen model, failure path.
        let model = SongScreenModel(delay: .zero) // No waiting in tests.
        model.simulateOffline = true // The next load fails.
        await model.load() // loading, then failed.
        #expect(model.state == .failed("Offline")) // The reason travels with the case.
        #expect(model.state.message == "Error: Offline") // And becomes the screen's text.
    }

    @Test func songScreenShowsLoadingWhileWaiting() async throws { // The in-between state.
        let model = SongScreenModel(delay: .milliseconds(500)) // Long enough to look in the middle.
        let task = Task { await model.load() } // Start loading without waiting.
        try await Task.sleep(for: .milliseconds(50)) // Let the load begin.
        #expect(model.state == .loading) // Spinner state.
        await task.value // Let it finish.
        #expect(model.state == .loaded(["Golden Hour", "Night Owl"])) // Finished.
    }
}

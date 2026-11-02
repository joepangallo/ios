// StateAndModelTests.swift
// Who: the Swift Testing runner.
// What: checks the State lesson's math (4.4) and every model in the Observable Models
//       lesson (4.5): the coffee order's rules, the console program's exact output,
//       per-property observation, the checkout view model and the run counter.
// Where: the SwiftUIStudioTests target.
// When: whenever the tests run.
// Why: "the model runs without a screen" is the lesson's payoff, and these tests are
//      that payoff: the rules run here with no view at all.

import Testing // @Test, #expect.
import Observation // withObservationTracking.
import Synchronization // Mutex: a Sendable box for the observation callback.
@testable import SwiftUIStudio // The app's internal types.

@MainActor // The models live on the main actor.
struct StateMathTests { // Lesson 4.4.
    @Test func moneyHasTwoDecimals() { // String(format: "$%.2f", ...)
        #expect(Money.text(56.64) == "$56.64") // Already two decimals.
        #expect(Money.text(48) == "$48.00") // Padded.
        #expect(Money.text(4.5) == "$4.50") // A trailing zero is added.
    }

    @Test func tipAndTotalAreDerived() { // The course's starting values.
        #expect(abs(TipMath.tip(bill: 48, percent: 18) - 8.64) < 0.0001) // 48 * 18 / 100.
        #expect(Money.text(TipMath.total(bill: 48, percent: 18)) == "$56.64") // 48 + 8.64.
        #expect(Money.text(TipMath.total(bill: 48, percent: 25)) == "$60.00") // Challenge 1: drag to 25.
    }

    @Test func perPersonSplitsAndNeverDividesByLessThanOne() { // Challenge 3.
        #expect(Money.text(TipMath.perPerson(bill: 48, percent: 18, people: 2)) == "$28.32") // Two people.
        #expect(Money.text(TipMath.perPerson(bill: 48, percent: 18, people: 0)) == "$56.64") // Guarded: the whole total.
    }

    @Test func storedTotalGoesStaleUntilRecalculated() { // The duplicated-state bug.
        var model = StaleTotalModel() // bill 48, total 56.64.
        #expect(!model.isStale) // They agree at the start.
        model.bill = 100 // Drag the slider.
        #expect(model.total == 56.64) // The stored copy did not move.
        #expect(model.isStale) // Wrong.
        model.recalculate() // Tap Recalculate.
        #expect(Money.text(model.total) == "$118.00") // 100 * 1.18.
        #expect(!model.isStale) // Right again, until the next drag.
    }
}

@MainActor // The models live on the main actor.
struct CoffeeOrderTests { // Lesson 4.5's model.
    @Test func priceRule() { // 3.25 base, 75 cents a shot, 60 cents for oat milk.
        let order = CoffeeOrder() // Two shots, no oat milk.
        #expect(order.priceText == "$4.75") // 3.25 + 1.50.
        order.oatMilk = true // Oat milk.
        #expect(order.priceText == "$5.35") // Plus 0.60.
    }

    @Test func fourShotLimit() { // The rule lives in the model.
        let order = CoffeeOrder() // Two shots.
        for _ in 1...10 { order.addShot() } // Ten taps.
        #expect(order.shots == 4) // Never more than four.
    }

    @Test func removeShotNeverGoesBelowOne() { // The challenge's removeShot().
        let order = CoffeeOrder() // Two shots.
        for _ in 1...5 { order.removeShot() } // Five taps.
        #expect(order.shots == 1) // Never fewer than one.
    }

    @Test func summaryReadsNaturally() { // Used by the checkout messages.
        let order = CoffeeOrder() // Latte, two shots.
        #expect(order.summary == "Latte, 2 shots") // Plural.
        order.removeShot() // One shot.
        #expect(order.summary == "Latte, 1 shot") // Singular.
        order.oatMilk = true // Oat.
        order.drink = "Mocha" // Mocha.
        #expect(order.summary == "Oat Mocha, 1 shot") // Milk first.
    }

    @Test func programPrintsTheCoursesExpectedOutput() { // The course expects "$4.75\n4 $6.85".
        #expect(CoffeeOrderProgram.run() == ["$4.75", "4 $6.85"]) // Exactly.
    }

    @Test func programChallenges() { // The three challenges.
        #expect(CoffeeOrderProgram.run(loops: 10) == ["$4.75", "4 $6.85"]) // Shots never pass 4.
        #expect(CoffeeOrderProgram.run(oatMilk: false) == ["$4.75", "4 $6.25"]) // No oat milk.
        #expect(CoffeeOrderProgram.run(removeOneShot: true) == ["$4.75", "3 $6.10"]) // One shot removed.
    }

    @Test func readingDrinkTracksOnlyDrink() { // Per-property tracking, checked with the Observation framework itself.
        let order = CoffeeOrder() // The observed model.
        let fired = Mutex(false) // Set by the change callback.
        withObservationTracking { _ = order.drink } onChange: { fired.withLock { $0 = true } } // Like HeaderView's body: reads only drink.
        order.shots = 3 // A property the "body" did not read.
        #expect(fired.withLock { $0 } == false) // No re-run.
        order.drink = "Mocha" // The property it read.
        #expect(fired.withLock { $0 } == true) // Re-run.
    }

    @Test func readingPriceTracksShotsAndMilk() { // price reads shots and oatMilk.
        let order = CoffeeOrder() // The observed model.
        let fired = Mutex(false) // Set by the change callback.
        withObservationTracking { _ = order.price } onChange: { fired.withLock { $0 = true } } // Like PriceTagView's body.
        order.drink = "Mocha" // Not read by price.
        #expect(fired.withLock { $0 } == false) // No re-run.
        order.oatMilk = true // Read through price.
        #expect(fired.withLock { $0 } == true) // Re-run.
    }

    @Test func legacyOrderUsesTheSamePriceRule() { // The ObservableObject version.
        let order = LegacyCoffeeOrder() // Two shots.
        #expect(order.priceText == "$4.75") // Same base price.
        order.oatMilk = true // Oat milk.
        order.shots = 3 // Three shots.
        #expect(order.priceText == "$6.10") // 3.25 + 2.25 + 0.60.
    }

    @Test func studyPlannerCounts() { // The @Environment model.
        let planner = StudyPlanner() // Zero sessions.
        planner.sessionsDone += 1 // One SessionButton tap.
        planner.sessionsDone += 1 // Another button, same planner.
        #expect(planner.sessionsDone == 2) // Both writes landed on one object.
    }
}

@MainActor // The view model lives on the main actor.
struct CheckoutViewModelTests { // The view model from "Model, view, and view model".
    @Test func needsANameBeforeOrdering() { // The button's rule.
        let checkout = CheckoutViewModel(order: CoffeeOrder(), delay: .zero) // No waiting in tests.
        #expect(!checkout.canPlaceOrder) // Empty name.
        #expect(checkout.statusMessage == "Add a name for the cup.") // The hint.
        checkout.cupName = "   " // Only spaces.
        #expect(!checkout.canPlaceOrder) // Still no name.
        checkout.cupName = "Sam" // A name.
        #expect(checkout.canPlaceOrder) // Ready.
        #expect(checkout.statusMessage == "Ready to order Latte, 2 shots for Sam.") // A preview.
    }

    @Test func placingWithoutANameFails() async { // The guard in placeOrder().
        let checkout = CheckoutViewModel(order: CoffeeOrder(), delay: .zero) // Fresh.
        await checkout.placeOrder() // No name.
        #expect(checkout.status == .failed("Add a name for the cup first.")) // A clear error.
    }

    @Test func placingSucceedsWhenTheShopIsOpen() async { // The happy path.
        let checkout = CheckoutViewModel(order: CoffeeOrder(), delay: .zero) // Fresh.
        checkout.cupName = " Sam " // Spaces are trimmed.
        await checkout.placeOrder() // Place it.
        #expect(checkout.status == .placed("Order placed: Latte, 2 shots for Sam, $4.75. (Simulated)")) // The confirmation.
        #expect(checkout.statusMessage.hasPrefix("Order placed")) // The view shows it.
    }

    @Test func closedShopReportsAnError() async { // The error path.
        let checkout = CheckoutViewModel(order: CoffeeOrder(), delay: .zero) // Fresh.
        checkout.cupName = "Sam" // A name.
        checkout.shopIsOpen = false // Closed.
        await checkout.placeOrder() // Try.
        #expect(checkout.status == .failed("The shop is closed right now. Nothing was charged. (Simulated)")) // The error.
    }

    @Test func startOverClearsEverything() async { // Back to editing.
        let checkout = CheckoutViewModel(order: CoffeeOrder(), delay: .zero) // Fresh.
        checkout.cupName = "Sam" // A name.
        await checkout.placeOrder() // Placed.
        checkout.startOver() // Start over.
        #expect(checkout.status == .editing) // Editing again.
        #expect(checkout.cupName.isEmpty) // Name cleared.
    }

    @Test func viewModelSharesTheModel() { // The view model holds the model; it does not copy it.
        let order = CoffeeOrder() // The model.
        let checkout = CheckoutViewModel(order: order) // The view model.
        order.addShot() // Change the model directly.
        #expect(checkout.order.shots == 3) // The view model sees the same object.
    }
}

@MainActor // The counter lives on the main actor.
struct ObservationTrackingTests { // The re-run counter card's helpers.
    @Test func counterCountsPerView() { // tick and reset.
        let counter = BodyRunCounter() // Empty.
        #expect(counter.tick("HeaderView") == 1) // First run.
        #expect(counter.tick("HeaderView") == 2) // Second run.
        #expect(counter.tick("PriceTagView") == 1) // A different view starts at 1.
        counter.reset() // Forget.
        #expect(counter.counts.isEmpty) // Empty again.
        #expect(counter.tick("HeaderView") == 1) // Starts over.
    }

    @Test func predictionMatchesWhatEachViewReads() { // @Observable re-runs only readers.
        #expect(ObservationPrediction.viewsThatRerun(after: .drink, legacy: false) == ["HeaderView", "SummaryView"]) // Readers of drink.
        #expect(ObservationPrediction.viewsThatRerun(after: .shots, legacy: false) == ["PriceTagView", "SummaryView"]) // Readers of price.
        #expect(ObservationPrediction.viewsThatRerun(after: .oatMilk, legacy: false) == ["PriceTagView", "SummaryView"]) // Readers of price.
    }

    @Test func legacyPredictionReRunsEveryView() { // ObservableObject re-runs every observer.
        for property in TrackedProperty.allCases { // Any change at all.
            #expect(ObservationPrediction.viewsThatRerun(after: property, legacy: true).count == 3) // All three.
        }
    }
}

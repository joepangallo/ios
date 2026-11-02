// StatesAndAccessibilityTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks the trips loader's state machine with stand-in services, the
//       error copy, the copy checker against the lesson's quiz messages, the
//       VoiceOver sentence builder, the reading-order stops, and the status symbols.
// Where: the DesignGalleryTests target.
// When: only when tests run. No test touches the network.
// Why: lessons 5.8 and 5.9 are about getting the words and the states right;
//      these tests pin the exact words and transitions the course teaches.

import Testing // Swift Testing.
@testable import DesignGallery // The app's internal types.

/// A stand-in service that answers instantly with a fixed result.
struct InstantTripsService: TripsService { // Conforms to the app's protocol.
    let result: Result<[String], TripsError> // Success with trips, or a chosen failure.
    func fetchTrips() async throws -> [String] { try result.get() } // No waiting, no network.
}

@MainActor // TripsLoader is an app type on the main actor.
struct TripsLoaderTests { // The one-enum state machine.
    @Test func startsFailedLikeTheCourse() { // "The preview starts in the failed state."
        let loader = TripsLoader(service: InstantTripsService(result: .success([]))) // Default start.
        #expect(loader.state == .failed) // The course's starting state.
        #expect(loader.error == .offline) // With the offline copy.
    }

    @Test func tryAgainLoadsTrips() async { // Tap Try Again with a working service.
        let loader = TripsLoader(service: InstantTripsService(result: .success(["Lisbon", "Kyoto", "Oaxaca"]))) // Online.
        await loader.load() // One load.
        #expect(loader.state == .loaded) // Spinner replaced by content.
        #expect(loader.trips.count == 3) // "3 trips planned".
        #expect(loader.error == nil) // No leftover error.
    }

    @Test func offlineFailsWithClearCopy() async { // Tap Try Again while offline.
        let loader = TripsLoader(service: InstantTripsService(result: .failure(.offline)), startIn: .loaded) // Start from a loaded screen.
        await loader.load() // One load.
        #expect(loader.state == .failed) // Back to the error screen, never stuck loading.
        #expect(loader.error?.title == "Couldn’t Load Trips") // What happened, in the user's terms.
        #expect(loader.error?.message == "You’re offline. Check Wi-Fi, then try again.") // Why, and what to do.
    }

    @Test func resetReturnsToTheStart() async { // The demo's Reset button.
        let loader = TripsLoader(service: InstantTripsService(result: .success(["Lisbon"]))) // Online.
        await loader.load() // Load once.
        loader.reset() // Start over.
        #expect(loader.state == .failed && loader.trips.isEmpty) // Failed and empty again.
    }

    @Test func fiveStatesInCourseOrder() { // "Every screen has five states".
        #expect(ScreenState.allCases.map(\.label) == ["Empty", "Loading", "Error", "Partial", "Ideal"]) // Course order.
        #expect(ScreenState.empty.buildingBlock == "ContentUnavailableView") // The system empty layout.
    }
}

struct CopyCheckerTests { // "Words are interface too". Pure functions, so no actor needed.
    @Test func vagueButtonsAreFlagged() { // "Buttons are verbs".
        #expect(!CopyChecker.checkButton("OK").isEmpty) // OK names no action.
        #expect(!CopyChecker.checkButton(" yes ").isEmpty) // Case and spaces do not matter.
        #expect(!CopyChecker.checkButton("").isEmpty) // Empty says nothing.
        #expect(CopyChecker.checkButton("Try Again").isEmpty) // A verb phrase passes.
        #expect(CopyChecker.checkButton("Delete Trip").isEmpty) // So does this one.
    }

    @Test func onlyTheQuizAnswerPasses() { // The lesson's quiz: which message follows the guidance?
        #expect(!CopyChecker.checkMessage("Error -1009: The operation couldn’t be completed. Please try again later.").isEmpty) // A code and filler.
        #expect(!CopyChecker.checkMessage("Oops! Something went wrong. Please try again in a few minutes.").isEmpty) // Friendly but empty.
        #expect(!CopyChecker.checkMessage("You entered an invalid card. Please check your input and resubmit.").isEmpty) // Blames the user.
        #expect(CopyChecker.checkMessage("Couldn’t Add Card. The card has expired. Check it and try again.").isEmpty) // The right answer.
    }

    @Test func namesTheRuleThatBroke() { // Each finding says which guideline it breaks.
        let issues = CopyChecker.checkMessage("Operation failed (-1009).") // The vague error screen.
        #expect(issues.contains { $0.rule == "No blame, no codes" }) // The code.
        #expect(issues.contains { $0.rule == "Errors answer three questions" }) // No next step.
        #expect(CopyChecker.checkMessage("You’re offline. Check Wi-Fi, then try again.").isEmpty) // The clear version passes.
    }
}

struct VoiceOverTests { // "What VoiceOver says, in order". Pure values.
    @Test func spiceSliderSentence() { // The course's worked example.
        let slider = Announcement(label: "Spice level", value: "Medium", traits: [.adjustable]) // Label, value, trait.
        #expect(slider.spoken == "Spice level, Medium, adjustable") // Exactly the course's words.
    }

    @Test func unlabeledSliderSaysOnlyAPercentage() { // "Without a label or value..."
        let slider = Announcement(label: "", value: "50 percent", traits: [.adjustable]) // No label.
        #expect(slider.spoken == "50 percent, adjustable") // The empty label is skipped.
    }

    @Test func hintComesLastAfterAPause() { // The favorite button with all four parts.
        let favorite = Announcement(label: "Favorite", value: "Saved", traits: [.button], hint: "Adds or removes it from Favorites.") // All four.
        #expect(favorite.spoken == "Favorite, Saved, button. Adds or removes it from Favorites.") // Label, value, trait, hint.
    }

    @Test func labelsMustNotRepeatTheTrait() { // "Favorite button" makes VoiceOver say button twice.
        #expect(Announcement(label: "Favorite button", traits: [.button]).repeatsTrait) // Flagged.
        #expect(!Announcement(label: "Favorite", traits: [.button]).repeatsTrait) // Fine.
    }

    @Test func labeledRowSavesAStop() { // "From four guesses to three useful stops."
        #expect(RecipeRowReader.before.count == 4) // Icon, title, heart, plane.
        #expect(RecipeRowReader.after.count == 3) // Title and two named buttons.
        #expect(RecipeRowReader.after.allSatisfy { !$0.isProblem }) // Every stop is useful.
        #expect(RecipeRowReader.after[1].announcement.spoken == "Add to Favorites, button") // The course's spoken result.
    }

    @Test func fixedCardHasFewerStopsAndSpeaksState() { // The recipe card simulator.
        let before = RecipeCardReader.stops(fixed: false, isFavorite: true, isCooking: false) // As first built.
        let after = RecipeCardReader.stops(fixed: true, isFavorite: true, isCooking: false) // Fixed.
        #expect(before.count == 11) // Photo, divider, title, time, five stars, heart, button.
        #expect(after.count == 5) // Photo, heading, combined facts, favorite, button.
        #expect(before.first { $0.id == "favorite" }?.announcement.spoken == "icon-heart-outline, button") // The state change is invisible.
        #expect(after.first { $0.id == "favorite" }?.announcement.value == "Saved") // Now the state is spoken.
        #expect(after.first { $0.id == "title" }?.announcement.traits == [.heading]) // The title is a heading.
    }

    @Test func statusSymbolsDifferOnlyWhenAsked() { // Differentiate Without Color.
        let plain = Set(FlightStatusKind.allCases.map { $0.symbol(differentiateWithoutColor: false) }) // Setting off.
        let shaped = Set(FlightStatusKind.allCases.map { $0.symbol(differentiateWithoutColor: true) }) // Setting on.
        #expect(plain == ["circle.fill"]) // One dot for every status.
        #expect(shaped.count == 3) // A distinct shape per status.
    }
}

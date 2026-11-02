// ListNavigationFormMotionTests.swift
// Who: the Swift Testing runner.
// What: checks the rules behind lessons 4.6 to 4.9: list data and search, the
//       navigation pattern chooser and path model, form validation and pricing, and
//       the motion and adaptivity choices.
// Where: the SwiftUIStudioTests target.
// When: whenever the tests run.
// Why: each of these rules decides what a screen shows. Testing them here means a
//      screen can only go wrong in its layout, never in its logic.

import Testing // @Test, #expect.
import Foundation // IndexSet.
@testable import SwiftUIStudio // The app's internal types.

@MainActor // The models live on the main actor.
struct ListModelTests { // Lesson 4.6.
    @Test func recipesHaveUniqueIdsAndCourseRows() { // Identifiable with UUIDs.
        let recipes = Recipe.starters // The three starters.
        #expect(Set(recipes.map(\.id)).count == 3) // Every id is different.
        #expect(recipes.map(\.rowText) == ["Pancakes, 20 min", "Tomato Soup, 35 min", "Fried Rice, 15 min"]) // The course's rows.
    }

    @Test func sameNameStillGetsANewIdentity() { // let id = UUID() runs per value.
        #expect(Recipe(name: "Tacos", minutes: 5).id != Recipe(name: "Tacos", minutes: 5).id) // Two values, two ids.
    }

    @Test func shoppingListDeletesByOffsets() { // onDelete hands over an IndexSet.
        var list = ShoppingList() // Eggs, Milk, Bread.
        list.delete(at: IndexSet(integer: 0)) // Swipe Eggs away.
        #expect(list.items == ["Milk", "Bread"]) // Two left.
        list.delete(at: IndexSet([0, 1])) // Both at once.
        #expect(list.isEmpty) // The empty state shows.
        list.delete(at: IndexSet(integer: 5)) // A position that does not exist.
        #expect(list.isEmpty) // Nothing crashes.
    }

    @Test func shoppingListAddsUniqueItemsAndRestores() { // The challenges.
        var list = ShoppingList() // Fresh.
        list.add("Coffee") // Challenge 1.
        list.add("Milk") // A duplicate.
        #expect(list.items == ["Eggs", "Milk", "Bread", "Coffee"]) // Duplicates refused.
        list.delete(at: IndexSet(integer: 1)) // Delete from the middle.
        #expect(list.items == ["Eggs", "Bread", "Coffee"]) // Milk gone.
        list.restore() // Refill.
        #expect(list.items == ShoppingList.startingItems) // Back to the start.
    }

    @Test func habitSymbolFollowsTheDoneSet() { // Custom swipe actions.
        var checklist = HabitChecklist() // Nothing done.
        #expect(checklist.symbol(for: "Stretch") == "circle") // Empty circle.
        checklist.markDone("Stretch") // Swipe, Done.
        checklist.markDone("Stretch") // Again: a set ignores it.
        #expect(checklist.symbol(for: "Stretch") == "checkmark.circle.fill") // Filled check.
        #expect(checklist.doneCount == 1) // Counted once.
        checklist.undo("Stretch") // Swipe, Undo.
        #expect(checklist.symbol(for: "Stretch") == "circle") // Back to empty.
    }

    @Test func habitChecklistAddsMeditateOnce() { // Challenge 3.
        var checklist = HabitChecklist() // Three habits.
        checklist.add("Meditate") // Added.
        checklist.add("Meditate") // Refused.
        #expect(checklist.habits.count == 4) // Four habits.
        #expect(checklist.habits.last == "Meditate") // At the bottom.
    }

    @Test func searchFindsPaRecipes() { // The course's "pa" example.
        #expect(RecipeSearch.results(in: RecipeSearch.recipes, matching: "pa") == ["Pancakes", "Pad Thai", "Pasta Salad"]) // Three matches.
        #expect(RecipeSearch.results(in: RecipeSearch.recipes, matching: "PA") == ["Pancakes", "Pad Thai", "Pasta Salad"]) // Case does not matter.
    }

    @Test func emptyQueryShowsEverything() { // `if query.isEmpty { return recipes }`
        #expect(RecipeSearch.results(in: RecipeSearch.recipes, matching: "") == RecipeSearch.recipes) // All six.
    }

    @Test func prefixOnlyIsStricterThanContains() { // Challenge 2.
        #expect(RecipeSearch.results(in: RecipeSearch.recipes, matching: "ta") == ["Pasta Salad", "Tacos"]) // "ta" anywhere.
        #expect(RecipeSearch.results(in: RecipeSearch.recipes, matching: "ta", prefixOnly: true) == ["Tacos"]) // "ta" at the start.
        #expect(RecipeSearch.results(in: RecipeSearch.recipes, matching: "xyz").isEmpty) // No matches.
    }
}

@MainActor // The models live on the main actor.
struct NavigationModelTests { // Lesson 4.7.
    @Test func everyPatternHasAScenario() { // Push, tabs, sheet and alert each appear once.
        #expect(PatternScenario.all.map(\.answer) == [.push, .tabs, .sheet, .alert]) // In lesson order.
        #expect(Set(PatternScenario.all.map(\.answer)) == Set(NavigationPattern.allCases)) // All four covered.
    }

    @Test func routesWriteThemselvesAsCode() { // The path readout.
        #expect(Route.recipe(.lemonBars).code == ".recipe(.lemonBars)") // Recipe screen.
        #expect(Route.step(.soup, 3).code == ".step(.soup, 3)") // Step screen.
        #expect(Route.recipe(.soup).title == "Tomato Soup") // Navigation title.
        #expect(Route.step(.pancakes, 2).title == "Step 2") // Navigation title.
    }

    @Test func pushAppendsAndBackRemoves() { // A NavigationLink tap, then the back button.
        var model = RoutePath() // At the root.
        #expect(model.pathCode == "[]") // Empty.
        #expect(model.countText == "0 values, 1 screen") // The root is a screen but not a value.
        model.push(.recipe(.soup)) // Tap Tomato Soup.
        model.push(.step(.soup, 1)) // Tap Step 1.
        #expect(model.pathCode == "[.recipe(.soup), .step(.soup, 1)]") // Two values.
        #expect(model.countText == "2 values, 3 screens") // Three screens.
        model.back() // Back.
        #expect(model.countText == "1 value, 2 screens") // One value.
    }

    @Test func backAtTheRootDoesNothing() { // The root cannot be popped.
        var model = RoutePath() // At the root.
        model.back() // Back.
        #expect(model.path.isEmpty) // Still at the root.
    }

    @Test func jumpReplacesTheWholeArray() { // Like a deep link.
        var model = RoutePath() // At the root.
        model.push(.recipe(.pancakes)) // Somewhere else first.
        model.jumpToSoupStep3() // Jump.
        #expect(model.path == [.recipe(.soup), .step(.soup, 3)]) // Replaced, not appended.
        model.popToRoot() // Pop to root.
        #expect(model.path.isEmpty) // Empty.
    }

    @Test func sheetDoesNotChangeThePath() { // The sheet is a separate layer.
        var model = RoutePath() // At the root.
        model.push(.recipe(.soup)) // One screen pushed.
        model.showingNewRecipe = true // Open the sheet.
        #expect(model.path == [.recipe(.soup)]) // Path unchanged.
    }
}

@MainActor // The rules live on the main actor.
struct FormRuleTests { // Lesson 4.8.
    @Test func signUpSummaryNeverShowsThePassword() { // "What your state holds".
        let lines = SignUpSummary.lines(email: "sam@example.com", password: "secret", wantsTips: false, name: "Sam") // A filled form.
        #expect(lines == ["Name: Sam", "Email: sam@example.com", "Password: 6 characters", "Tips: off"]) // The course's wording.
        #expect(SignUpSummary.lines(email: "", password: "", wantsTips: true, name: "").last == "Tips: on") // The switch on.
    }

    @Test func sizeSentence() { // `Text("You picked \(size.rawValue).")`
        #expect(Size.medium.sentence == "You picked Medium.") // The default.
        #expect(Size.allCases.map(\.rawValue) == ["Small", "Medium", "Large"]) // Exactly three.
    }

    @Test func courseValidationRule() { // `email.contains("@") && password.count >= 8`
        #expect(AccountRules.isValid(email: "sam@example.com", password: "12345678")) // Valid.
        #expect(!AccountRules.isValid(email: "sam@example.com", password: "1234567")) // Seven characters.
        #expect(!AccountRules.isValid(email: "sam.example.com", password: "12345678")) // No @.
        #expect(AccountRules.isValid(email: " @", password: "12345678")) // The challenge's loophole passes the course's rule.
    }

    @Test func strictValidationClosesTheLoophole() { // Challenge 3.
        #expect(!AccountRules.isValid(email: " @", password: "12345678", strict: true)) // Refused.
        #expect(AccountRules.isValid(email: "sam@example.com", password: "12345678", strict: true)) // Still valid.
        #expect(AccountRules.looksLikeEmail("  sam@example.com ")) // Outer spaces are trimmed.
        #expect(!AccountRules.looksLikeEmail("sam@example")) // No dot after the @.
        #expect(!AccountRules.looksLikeEmail("@example.com")) // Nothing before the @.
        #expect(!AccountRules.looksLikeEmail("sam@@example.com")) // Two @ signs.
        #expect(!AccountRules.looksLikeEmail("s am@example.com")) // A space inside.
        #expect(!AccountRules.looksLikeEmail("sam@.com")) // Dot right after the @.
    }

    @Test func hintCountsDown() { // `"\(8 - password.count) more characters needed"`
        #expect(AccountRules.hint(password: "") == nil) // Nothing typed: no hint.
        #expect(AccountRules.hint(password: "abcdef") == "2 more characters needed") // Six of eight.
        #expect(AccountRules.hint(password: "abcdefgh") == nil) // Enough.
        #expect(AccountRules.hint(password: "abcdefgh", minimum: 12) == "4 more characters needed") // Challenge 2.
    }

    @Test func orderFormPricing() { // `3.0 + Double(shots) * 0.75`
        #expect(OrderFormRules.payTitle(total: OrderFormRules.total(shots: 2, oatMilk: false)) == "Pay $4.50") // The course's start.
        #expect(OrderFormRules.payTitle(total: OrderFormRules.total(shots: 6, oatMilk: false)) == "Pay $7.50") // Challenge 3: six shots.
        #expect(OrderFormRules.payTitle(total: OrderFormRules.total(shots: 2, oatMilk: true)) == "Pay $5.10") // Challenge 1: oat milk.
    }

    @Test func payNeedsAName() { // `.disabled(name.isEmpty)`
        #expect(!OrderFormRules.canPay(name: "")) // Empty.
        #expect(OrderFormRules.canPay(name: " ")) // The quiz: one space passes the course's rule...
        #expect(!OrderFormRules.canPay(name: " ", ignoringSpaces: true)) // ...and fails the trimmed one.
        #expect(OrderFormRules.canPay(name: "Sam", ignoringSpaces: true)) // A real name.
    }
}

@MainActor // The rules live on the main actor.
struct MotionModelTests { // Lesson 4.9.
    @Test func favoriteScaleFollowsTheCourse() { // `.scaleEffect(isFavorite ? 1.3 : 1.0)`
        #expect(FavoriteMotion.scale(isFavorite: false, bigScale: false, reduceMotion: false) == 1.0) // Not a favorite.
        #expect(FavoriteMotion.scale(isFavorite: true, bigScale: false, reduceMotion: false) == 1.3) // The course.
        #expect(FavoriteMotion.scale(isFavorite: true, bigScale: true, reduceMotion: false) == 2.0) // Challenge 3.
    }

    @Test func reduceMotionSkipsTheGrowth() { // Skip large motion when Reduce Motion is on.
        #expect(FavoriteMotion.scale(isFavorite: true, bigScale: true, reduceMotion: true) == 1.0) // No growth.
    }

    @Test func bannerWordingsGoLongestFirst() { // ViewThatFits picks the first that fits.
        let lengths = DeliveryBanner.wordings.map(\.count) // Character counts.
        #expect(lengths == lengths.sorted(by: >)) // Longest first.
        #expect(DeliveryBanner.wordings.last == "Free delivery") // The fallback.
    }

    @Test func sliderNeverOutgrowsTheCard() { // 80...340 in the course, capped by the card.
        #expect(DeliveryBanner.maximumWidth(available: 500) == 340) // The course's maximum.
        #expect(DeliveryBanner.maximumWidth(available: 300) == 300) // A narrower card.
        #expect(DeliveryBanner.maximumWidth(available: 50) == 120) // Always a usable range above 80.
    }

    @Test func onlyAccessibilitySizesTurnRowsIntoColumns() { // The adaptivity rule.
        #expect(TextSizeStep.allCases.filter(\.isAccessibilitySize) == [.accessibility3, .accessibility5]) // Just the two.
        #expect(TextSizeStep.allCases.allSatisfy { !$0.title.isEmpty }) // Every stop is named.
    }

    @Test func choicesCoverTheChallenges() { // The pickers' options.
        #expect(MotionCurve.allCases.count == 2) // Spring and ease in-out.
        #expect(EntranceTransition.allCases.map(\.rawValue) == ["Scale", "Opacity", "Slide"]) // The three transitions.
    }
}

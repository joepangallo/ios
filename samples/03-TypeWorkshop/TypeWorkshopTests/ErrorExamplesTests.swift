// ErrorExamplesTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks every program in lesson 3.6 against the course's expected
//       output, plus the photo sync model's defer behavior, Result lookups
//       and the sign-up checks with their readable messages.
// Where: the TypeWorkshopTests target; the code under test is Models/ErrorExamples.swift.
// When: only when tests run.
// Why: error paths are the ones nobody clicks by accident; tests make sure
//      each one prints and cleans up exactly as the lesson says.

import Foundation // localizedDescription comes from Foundation, and each file must import what it uses.
import Testing // Swift Testing: @Test, #expect and #require.
@testable import TypeWorkshop // Lets the tests see the app's internal types.

@MainActor // The app's types are main-actor isolated by default.
struct ErrorExamplesTests { // Lesson 3.6.
    @Test func withdrawalFailsAndTheProgramCarriesOn() { // Course step "Throwing and catching".
        #expect(ThrowingAndCatching.run().text == "Left: 30.0\nFailed: insufficientFunds(needed: 15.0)\nDone") // The expected output.
        #expect(ThrowingAndCatching.run(second: 25).text == "Left: 30.0\nNever printed: 5.0\nDone") // The course's try item: 25 instead of 45.
        #expect(ThrowingAndCatching.run(balance: 10).text == "Failed: insufficientFunds(needed: 10.0)\nDone") // The first call can fail too.
    }

    @Test func withdrawThrowsTheMissingAmount() throws { // The throwing function on its own.
        #expect(try ThrowingAndCatching.withdraw(20, from: 20) == 0) // Exactly the balance is allowed.
        let error = #expect(throws: ThrowingAndCatching.WithdrawalError.self) { try ThrowingAndCatching.withdraw(30, from: 20) } // Too much.
        guard case .insufficientFunds(let needed) = try #require(error) else { return } // Pull out the associated value.
        #expect(needed == 10) // 10 was missing.
    }

    @Test func specificCatchClausesMatchInOrder() { // Course step "Catching specific errors".
        #expect(CatchingSpecificErrors.run().text == "Other: cardDeclined\nSorry, Oat milk is sold out\nServer error 503. Try again.") // The expected output.
        #expect(CatchingSpecificErrors.handle(CatchingSpecificErrors.CheckoutError.outOfStock(item: "Tea")).clause == 1) // The pattern catch.
        #expect(CatchingSpecificErrors.handle(CatchingSpecificErrors.NetworkError(code: 404)).message == "Server error 404. Try again.") // The type-cast catch.
        #expect(CatchingSpecificErrors.handle(CatchingSpecificErrors.CheckoutError.cardDeclined).clause == 3) // The catch-all.
    }

    @Test func tryOptionalAndTryBang() throws { // Course step "try? and try!".
        #expect(TryQuestionAndTryBang.run().text == "15 0\nTip percent: 18\nPreset tip: 20") // The expected output.
        #expect(try TryQuestionAndTryBang.parseTip("7") == 7) // A plain number parses.
        #expect((try? TryQuestionAndTryBang.parseTip("15%")) == nil) // try? turns the error into nil.
        #expect(throws: TryQuestionAndTryBang.ParseError.self) { try TryQuestionAndTryBang.parseTip("") } // Empty text throws.
    }

    @Test func deferRunsOnBothPaths() { // Course step "Cleaning up with defer".
        #expect(CleaningUpWithDefer.run().text == "Show spinner\nUploaded 12 photos\nHide spinner\nShow spinner\nHide spinner\nError: offline") // The expected output.
    }

    @Test func photoSyncHidesTheSpinnerOnSuccessAndFailure() async { // The defer idea in the sync model.
        let model = PhotoSyncModel(delay: .zero) // No waiting in tests.
        await model.sync() // Online by default.
        #expect(model.status == "Uploaded 12 photos") // Success.
        #expect(!model.isSyncing) // Spinner hidden.
        model.online = false // Take the throwing path.
        await model.sync() // Throws inside upload().
        #expect(model.status == "Error: offline") // The error was caught.
        #expect(!model.isSyncing) // Spinner hidden by defer anyway.
    }

    @Test func photoSyncShowsTheSpinnerWhileWorking() async throws { // The in-between state.
        let model = PhotoSyncModel(delay: .milliseconds(500)) // Long enough to look in the middle.
        let task = Task { await model.sync() } // Start syncing without waiting.
        try await Task.sleep(for: .milliseconds(50)) // Let it begin.
        #expect(model.isSyncing) // Spinner showing.
        await task.value // Let it finish.
        #expect(!model.isSyncing) // Spinner hidden.
    }

    @Test func resultCarriesSuccessOrFailure() throws { // Course step "Result".
        #expect(ResultExample.run().text == "Oslo: high of 9 degrees\nNo forecast for Atlantis\n24") // The expected output.
        #expect(try ResultExample.forecast(for: "Lisbon").get() == 24) // get() returns the success value.
        #expect(throws: ResultExample.WeatherError.self) { try ResultExample.forecast(for: "Mars").get() } // get() throws the failure.
        #expect(ResultExample.describe(city: "Lisbon") == "Lisbon: high of 24 degrees") // The success line.
    }

    @Test func signUpErrorsAreReadable() throws { // Course step "Errors people can read".
        #expect(ErrorsPeopleCanRead.message() == "Use at least 12 characters.") // The course's program.
        let taken = #expect(throws: ErrorsPeopleCanRead.SignUpError.self) { try ErrorsPeopleCanRead.signUp(email: " Ana@Example.com ", password: "long enough password") } // Case and spaces do not matter.
        #expect(try #require(taken).localizedDescription == "ana@example.com already has an account.") // Names the email.
        let weak = #expect(throws: ErrorsPeopleCanRead.SignUpError.self) { try ErrorsPeopleCanRead.signUp(email: "new@example.com", password: "short") } // Too short.
        #expect(try #require(weak).localizedDescription == "Use at least 12 characters.") // Says what to do.
        #expect(try ErrorsPeopleCanRead.signUp(email: "new@example.com", password: "twelve chars") == "Account created for new@example.com.") // Exactly 12 characters passes.
    }
}

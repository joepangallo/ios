// ErrorExamples.swift
// Who: the 3.6 lesson screen runs these programs and uses the sync and sign-up
//      models; the unit tests check every program and both models.
// What: the error programs from the course lesson "Error Handling": a withdrawal
//       that throws, catch clauses that match patterns, try? and try!, cleanup
//       with defer, Result, and errors people can read through LocalizedError.
// Where: the Models folder; Lesson_3_6_ErrorHandling.swift is the screen that uses them.
// When: run() executes when the screen draws; the models change when the student
//       taps Sync or Create account.
// Why: errors are values that travel through the program. Changing the inputs
//      and watching which line prints, which catch runs and when cleanup happens
//      makes that flow visible.

import Foundation // LocalizedError and localizedDescription come from Foundation.
import Observation // Observation provides @Observable for the photo sync model.

/// Course step "Throwing and catching".
enum ThrowingAndCatching { // A caseless enum used as a namespace for this example.
    enum WithdrawalError: Error { // Conforming to Error makes the values throwable.
        case insufficientFunds(needed: Double) // Carries how much money was missing.
    }

    /// Takes amount out of balance and returns what is left, or throws when it is too much.
    static func withdraw(_ amount: Double, // The amount to take out comes first.
                         from balance: Double) throws -> Double { // throws sits before the return arrow.
        guard amount <= balance else { // Validate first; the success path stays unindented.
            let short = amount - balance // How much is missing.
            throw WithdrawalError.insufficientFunds(needed: short) // Leaves the function at once.
        }
        return balance - amount // The success path returns normally.
    }

    /// The course program, with its three numbers as parameters so the screen can change them.
    static func run(balance: Double = 50, first: Double = 20, second: Double = 45) -> Transcript { // Defaults are the course's numbers.
        var out = Transcript() // Collects the printed lines.
        do { // One catch handles every throwing call inside.
            let left = try withdraw(first, from: balance) // 20 from 50 succeeds: 30.0.
            out.print("Left:", left) // Left: 30.0
            let after = try withdraw(second, from: left) // 45 from 30.0 throws; the rest of do is skipped.
            out.print("Never printed:", after) // Runs only if the second withdrawal works.
        } catch { // error is bound automatically.
            out.print("Failed:", error) // Failed: insufficientFunds(needed: 15.0)
        }
        out.print("Done") // The program carries on after the error was handled.
        return out // Every printed line.
    }
}

/// Course step "Catching specific errors".
enum CatchingSpecificErrors { // Namespace for this step's example.
    enum CheckoutError: Error { // The errors checkout can produce.
        case outOfStock(item: String) // Carries the item name.
        case cardDeclined // No extra data.
    }

    struct NetworkError: Error { let code: Int } // A second, unrelated error type with an HTTP status code.

    /// Throws one error and lets the catch clauses sort it, exactly like the body of the course's loop.
    /// Returns which clause ran (1, 2 or 3) and what it printed, so the screen can highlight the clause.
    static func handle(_ problem: any Error) -> (clause: Int, message: String) { // One pass of the course's loop.
        do { // A fresh do/catch for each error.
            throw problem // In a real app this would be a try call to checkout code.
        } catch CheckoutError.outOfStock(let item) { // Matches one case and binds its item; tried first.
            return (1, "Sorry, \(item) is sold out") // Names the item.
        } catch let error as NetworkError { // Matches any NetworkError, typed as NetworkError.
            return (2, "Server error \(error.code). Try again.") // error.code compiles thanks to the cast.
        } catch { // Everything not matched above.
            return (3, "Other: \(error)") // Other: cardDeclined
        }
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        let problems: [any Error] = [CheckoutError.cardDeclined, // any Error is the box for any error value.
            CheckoutError.outOfStock(item: "Oat milk"), // Should match the first catch.
            NetworkError(code: 503)] // Should match the type-based catch.
        for problem in problems { // Three passes, one per error.
            out.print(handle(problem).message) // The line the matching catch printed.
        }
        return out // Three printed lines.
    }
}

/// Course step "try? and try!".
enum TryQuestionAndTryBang { // Namespace for this step's example.
    enum ParseError: Error { // The error for unreadable input.
        case notANumber(String) // Carries the text that could not be parsed.
    }

    /// Turns typed text into a tip percentage, or throws.
    static func parseTip(_ text: String) throws -> Int { // Text field input fails in ordinary ways.
        guard let value = Int(text) else { // Int(text) is nil for text like 15%.
            throw ParseError.notANumber(text) // Says which text failed.
        }
        return value // A plain Int: the guard unwrapped it.
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        let typed = try? parseTip("15") // Int? holding 15.
        let typo = try? parseTip("15%") // Int? holding nil; the error is discarded.
        out.print(typed ?? 0, typo ?? 0) // 15 0
        let tip = (try? parseTip("abc")) ?? 18 // Falls back to a default tip of 18.
        out.print("Tip percent:", tip) // Tip percent: 18
        let preset = try! parseTip("20") // Safe only because the text is a constant we wrote.
        out.print("Preset tip:", preset) // Preset tip: 20
        return out // Three printed lines.
    }
}

/// Course step "Cleaning up with defer".
enum CleaningUpWithDefer { // Namespace for this step's example.
    enum SyncError: Error { // The error for a failed photo sync.
        case offline // The device has no connection.
    }

    /// Simulates uploading photos. out stands in for the console; inout writes it back even when the function throws.
    static func syncPhotos(online: Bool, out: inout Transcript) throws { // Fails when offline.
        out.print("Show spinner") // Anything shown at the start must be hidden at the end.
        defer { // Registered now; runs when the function exits by any path.
            out.print("Hide spinner") // Runs after a success and after a throw.
        }
        guard online else { // An early exit that cannot skip the defer.
            throw SyncError.offline // Leaves with an error; the defer still runs.
        }
        out.print("Uploaded 12 photos") // The success path; the defer runs right after.
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        for online in [true, false] { // Once online, once offline.
            do { // Handles the offline error so the loop continues.
                try syncPhotos(online: online, out: &out) // & passes out so the function can add lines.
            } catch { // Only on the second pass.
                out.print("Error:", error) // By now the defer has already hidden the spinner.
            }
        }
        return out // Six printed lines.
    }
}

/// The defer idea in a real screen: the spinner is hidden on every exit path.
@Observable // The sync card redraws when isSyncing or status changes.
final class PhotoSyncModel { // A class: one model the card keeps and watches.
    private(set) var isSyncing = false // true while the spinner should show.
    private(set) var status = "Not synced yet" // The last result, shown under the button.
    var online = true // Flip off to see the error path.
    let delay: Duration // How long the pretend upload takes; tests pass .zero.

    init(delay: Duration = .seconds(1)) { self.delay = delay } // One second by default.

    /// Uploads, or throws when offline. defer turns the spinner off either way.
    func upload() async throws { // Called by sync() below.
        isSyncing = true // Show spinner.
        defer { isSyncing = false } // Hide spinner, whether the upload worked or threw.
        try await Task.sleep(for: delay) // Stands in for the real upload.
        guard online else { throw CleaningUpWithDefer.SyncError.offline } // The early exit; the defer still runs.
        status = "Uploaded 12 photos" // The success path.
    }

    /// What the Sync button runs: try the upload and report the outcome.
    func sync() async { // Errors are handled here, so the button needs no do/catch.
        do { // The throwing call.
            try await upload() // try before await, always.
        } catch { // offline, or cancellation.
            status = "Error: \(error)" // The spinner is already hidden by the defer.
        }
    }
}

/// Course step "Result: success or failure as a value".
enum ResultExample { // Namespace for this step's example.
    enum WeatherError: Error { // Result needs a concrete Error type.
        case cityNotFound(String) // Carries the unknown city name.
    }

    /// Returns either a high temperature or a WeatherError, wrapped in one value.
    static func forecast(for city: String) -> Result<Int, WeatherError> { // No throws: failure travels in the return value.
        let highs = ["Lisbon": 24, "Oslo": 9] // A tiny lookup table keeps the example offline.
        guard let high = highs[city] else { // The subscript returns nil for unknown cities.
            return .failure(.cityNotFound(city)) // The return type is known, so both dots resolve.
        }
        return .success(high) // The temperature, inside the success case.
    }

    /// The line the course's switch prints for one city.
    static func describe(city: String) -> String { // One pass of the course's loop.
        switch forecast(for: city) { // Result is an enum, so the switch covers both cases.
        case .success(let high): // Binds the Int on success.
            return "\(city): high of \(high) degrees" // Oslo: high of 9 degrees
        case .failure(.cityNotFound(let name)): // Patterns nest: failure, then the specific error.
            return "No forecast for \(name)" // No forecast for Atlantis
        }
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        for city in ["Oslo", "Atlantis"] { // One real and one imaginary city.
            out.print(describe(city: city)) // The switch's line.
        }
        let lisbon = try? forecast(for: "Lisbon").get() // get() returns the value or throws the failure.
        out.print(lisbon ?? 0) // 24
        return out // Three printed lines.
    }
}

/// Course step "Errors people can read".
enum ErrorsPeopleCanRead { // Namespace for this step's example.
    enum SignUpError: LocalizedError { // LocalizedError also makes these Errors.
        case emailTaken(String) // The email already belongs to an account.
        case weakPassword(minimum: Int) // The password is too short; carries the rule.

        var errorDescription: String? { // The human sentence for each case.
            switch self { // Exhaustive: a new case cannot ship without a message.
            case .emailTaken(let email): // Binds the email.
                return "\(email) already has an account." // Confirms what the user typed.
            case .weakPassword(let minimum): // Binds the minimum length.
                return "Use at least \(minimum) characters." // Says what to do next.
            }
        }
    }

    /// The course program: an error stored as any Error, read through localizedDescription.
    static func message() -> String { // The course step shows this rather than printing it.
        let error: any Error = SignUpError.weakPassword(minimum: 12) // How a catch clause would receive it.
        let message = error.localizedDescription // Foundation calls our errorDescription.
        return message // Use at least 12 characters.
    }

    static let takenEmails: Set<String> = ["ana@example.com", "ben@example.com"] // Pretend existing accounts.
    static let minimumPasswordLength = 12 // The rule weakPassword reports.

    /// Checks a sign-up form and throws the first problem it finds.
    static func signUp(email: String, password: String) throws -> String { // Returns a welcome line on success.
        let normalized = email.trimmingCharacters(in: .whitespaces).lowercased() // Compare emails without case or stray spaces.
        if takenEmails.contains(normalized) { // Already registered.
            throw SignUpError.emailTaken(normalized) // Carries the email for the message.
        }
        if password.count < minimumPasswordLength { // Too short.
            throw SignUpError.weakPassword(minimum: minimumPasswordLength) // Carries the rule, so the message can never disagree with it.
        }
        return "Account created for \(normalized)." // Both checks passed.
    }
}

// PrimeCounter.swift
// Who: lesson 0.2's race card and the tests that check the answers.
// What: the course's countPrimes function, word for word, plus a timed run
//       that measures it with ContinuousClock away from the main actor.
// Where: the Models folder; the lesson screen starts timed runs.
// When: each time the student presses Run on the race card.
// Why: this app is the third way Swift runs: compiled ahead of time into
//      native machine code. Timing the same function here makes that concrete.

import Foundation // Duration, ContinuousClock and number formatting.

/// Counts the primes at or below n with the Sieve of Eratosthenes, exactly as the course writes it.
/// `nonisolated` lets it run on any thread: the app's code is on the main actor by default,
/// and a long count must not freeze the screen.
nonisolated func countPrimes(_ n: Int) -> Int { // The course's function; only nonisolated is added.
    if n < 2 { return 0 } // There are no primes below 2.
    var isPrime = [Bool](repeating: true, count: n + 1) // One slot per number from 0 to n, all assumed prime.
    isPrime[0] = false // 0 is not prime.
    isPrime[1] = false // Neither is 1.
    var i = 2 // The first candidate.
    while i * i <= n { // Every composite up to n has a factor no larger than its square root.
        if isPrime[i] { // Only primes need to cross out their multiples.
            var multiple = i * i // Smaller multiples were crossed out by smaller primes.
            while multiple <= n { // Walk through the multiples of i.
                isPrime[multiple] = false // A multiple of i is not prime.
                multiple += i // On to the next multiple.
            }
        }
        i += 1 // Next candidate; without this the loop would never end.
    }
    return isPrime.filter { $0 }.count // Count the slots still marked true.
}

/// One timed run of countPrimes.
struct PrimeRun: Identifiable, Equatable { // Equatable so tests can compare runs.
    let id = UUID() // Each run is its own row, even when two runs use the same n.
    let limit: Int // The n that was passed in.
    let count: Int // How many primes were found.
    let duration: Duration // How long the call took, measured by ContinuousClock.

    /// The duration in a friendly unit: microseconds, milliseconds or seconds.
    var formattedDuration: String { PrimeRun.format(duration) } // Uses the shared formatter below.

    /// Formats a duration the way the race on the course page labels its lanes.
    nonisolated static func format(_ duration: Duration) -> String { // Pure, so tests can call it directly.
        let seconds = Double(duration.components.seconds) + Double(duration.components.attoseconds) / 1e18 // Whole seconds plus the fraction.
        if seconds < 0.001 { return String(format: "%.0f microseconds", seconds * 1_000_000) } // Tiny runs read best in microseconds.
        if seconds < 1 { return String(format: "%.1f ms", seconds * 1000) } // Most runs: milliseconds with one decimal.
        return String(format: "%.2f s", seconds) // Long runs: seconds with two decimals.
    }

    /// Runs countPrimes(limit) on a background thread and measures it.
    /// `@concurrent` sends the work off the main actor, so the screen stays responsive while it runs.
    @concurrent nonisolated static func measure(upTo limit: Int) async -> (count: Int, duration: Duration) { // Returns plain values the caller turns into a PrimeRun.
        let clock = ContinuousClock() // A clock that keeps ticking steadily, the right one for measuring elapsed time.
        var count = 0 // Filled in by the measured closure.
        let duration = clock.measure { // Times exactly the work inside the braces.
            count = countPrimes(limit) // The work being timed.
        }
        return (count, duration) // Both results go back to the caller.
    }
}

/// The course's whole console program for this example: it prints countPrimes(100).
enum RaceProgram { // A namespace for the program.
    /// Runs the program and returns what it prints.
    static func run() -> [String] { // The course expects exactly "25".
        var out = Transcript() // Collects the printed lines.
        out.print(countPrimes(100)) // The program's only top-level statement.
        return out.lines // ["25"].
    }
}

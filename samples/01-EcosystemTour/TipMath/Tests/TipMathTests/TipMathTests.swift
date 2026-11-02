// TipMathTests.swift
// Who: the Swift Testing runner, when you type `swift test` in the TipMath folder.
// What: checks the tip, split and format functions, including rounding and
//       the cases where the input cannot be split.
// Where: the TipMathTests target (Tests/TipMathTests) of the TipMath package.
// When: only when tests run; test code never ships inside a library or an app.
// Why: a package that others depend on must prove it still works after every change.

import Testing // Swift Testing: @Test and #expect.
import TipMath // The library under test, through its public API only.

struct TipTests { // A suite for tipCents.
    @Test func twentyPercentOfFiftyIsTen() { // The everyday case.
        #expect(TipMath.tipCents(billCents: 5000, percent: 20) == 1000) // 20% of 50.00 is 10.00.
    }

    @Test func roundsToTheNearestCent() { // 15% of 12.34 is 1.851.
        #expect(TipMath.tipCents(billCents: 1234, percent: 15) == 185) // Rounds down to 1.85.
    }

    @Test func halfACentRoundsUp() { // 50% of 0.01 is exactly half a cent.
        #expect(TipMath.tipCents(billCents: 1, percent: 50) == 1) // Half a cent rounds up.
    }

    @Test(arguments: [0, 10, 18, 25]) func zeroBillHasNoTip(percent: Int) { // One test, run once per percentage.
        #expect(TipMath.tipCents(billCents: 0, percent: percent) == 0) // Nothing to tip on.
    }
}

struct SplitTests { // A suite for split.
    @Test func leftoverCentsGoToTheFirstShares() { // 10.00 among 3 cannot split evenly.
        #expect(TipMath.split(1000, among: 3) == [334, 333, 333]) // One leftover cent goes to the first share.
    }

    @Test(arguments: [1, 2, 3, 4, 7, 12]) func sharesAlwaysAddUp(people: Int) { // Runs once per group size.
        let shares = TipMath.split(1234, among: people) // Split 12.34.
        #expect(shares.count == people) // One share each.
        #expect(shares.reduce(0, +) == 1234) // Not a cent lost or invented.
        #expect((shares.max() ?? 0) - (shares.min() ?? 0) <= 1) // Shares differ by at most one cent.
    }

    @Test func nobodyToSplitAmongGivesNoShares() { // Guards against dividing by zero.
        #expect(TipMath.split(1000, among: 0).isEmpty) // No people, no shares.
        #expect(TipMath.split(-5, among: 2).isEmpty) // A negative amount is refused too.
    }
}

struct FormatTests { // A suite for format.
    @Test func formatsDollarsAndCents() { // Two digits after the point, always.
        #expect(TipMath.format(cents: 1234) == "12.34") // A normal amount.
        #expect(TipMath.format(cents: 5) == "0.05") // One-digit cents get a leading zero.
        #expect(TipMath.format(cents: 100) == "1.00") // Whole amounts keep .00.
        #expect(TipMath.format(cents: -250) == "-2.50") // Negative amounts keep their sign.
    }
}

// TipMath.swift
// Who: any app or package that adds TipMath and writes `import TipMath`.
// What: the tip on a bill and an even split of an amount among people, both
//       in whole cents so no rounding error can creep in.
// Where: the TipMath library target (Sources/TipMath) of the TipMath package.
// When: whenever a caller asks; the functions keep no state.
// Why: a small, useful library is the clearest way to show what a Swift
//      package is: code with a manifest, a public API and its own tests.

/// Tip and split arithmetic in whole cents.
public enum TipMath { // public: code outside the package can see it. An enum with no cases is a namespace.
    /// The tip on a bill, in cents, rounded to the nearest cent (exactly half a cent rounds up).
    /// - Parameters:
    ///   - billCents: the bill before the tip, in cents. 5000 means 50.00.
    ///   - percent: the tip percentage, such as 15 or 20.
    public static func tipCents(billCents: Int, percent: Int) -> Int { // Whole cents in, whole cents out.
        precondition(billCents >= 0 && percent >= 0, "The bill and the percentage cannot be negative.") // Stops the program on nonsense input during development.
        return (billCents * percent + 50) / 100 // Adding 50 before dividing by 100 rounds to the nearest cent.
    }

    /// Splits an amount among people so the shares always add up to exactly the amount.
    /// Leftover cents go to the first shares, one each: 1000 among 3 is [334, 333, 333].
    public static func split(_ cents: Int, among people: Int) -> [Int] { // One share per person.
        guard people > 0, cents >= 0 else { return [] } // Nobody to split among, or a negative amount: no shares.
        let base = cents / people // Every share gets at least this much.
        let leftover = cents % people // The cents that do not divide evenly.
        return (0..<people).map { $0 < leftover ? base + 1 : base } // The first few shares take one leftover cent each.
    }

    /// Writes cents as dollars and cents, such as 1234 as "12.34".
    public static func format(cents: Int) -> String { // No currency symbol, so it suits any currency with cents.
        let sign = cents < 0 ? "-" : "" // Keeps the minus sign for negative amounts.
        let whole = abs(cents) / 100 // The part before the decimal point.
        let fraction = abs(cents) % 100 // The two digits after it.
        return "\(sign)\(whole).\(fraction < 10 ? "0" : "")\(fraction)" // Pads one-digit cents with a zero.
    }
}

// FormRules.swift
// Who: lesson 4.8, Forms and Input.
// What: the rules behind the forms: what the sign-up summary shows, which drink
//       sizes exist, when a new account is valid and what hint to show, and the
//       complete order form's price and pay rule.
// Where: the Models folder; plain Swift, so every rule is tested without a screen.
// When: every keystroke, switch flip and stepper tap re-reads these rules.
// Why: validation and pricing are business rules. Kept out of body, they can be
//      tested, and the view only describes the controls.

import Foundation // String(format:) and trimming.

/// The sign-up form's read-back section: "What your state holds".
enum SignUpSummary { // A namespace for one function.
    /// The rows under the form, exactly as the course words them.
    static func lines(email: String, password: String, wantsTips: Bool, name: String) -> [String] { // Everything the form's state holds.
        [ // One string per row.
            "Name: \(name)", // The challenge's extra field.
            "Email: \(email)", // `Text("Email: \(email)")`
            "Password: \(password.count) characters", // `Text("Password: \(password.count) characters")`: never the password itself.
            wantsTips ? "Tips: on" : "Tips: off", // `Text(wantsTips ? "Tips: on" : "Tips: off")`
        ] // End of the rows.
    }
}

/// A drink size: exactly one of three, so an invalid size cannot exist.
enum Size: String, CaseIterable { // `enum Size: String, CaseIterable`
    case small = "Small", medium = "Medium", large = "Large" // The raw values are the labels.

    /// The sentence under the picker.
    var sentence: String { "You picked \(rawValue)." } // `Text("You picked \(size.rawValue).")`
}

/// The create-account rules from "Validate input and disable the button".
enum AccountRules { // A namespace for the rules.
    /// The course's rule: an @ somewhere and at least `minimum` characters of password.
    /// `strict` is the third challenge: a space and an at sign should not pass as an email.
    static func isValid(email: String, password: String, minimum: Int = 8, strict: Bool = false) -> Bool { // `var isValid: Bool`
        let passwordOK = password.count >= minimum // `password.count >= 8`
        return passwordOK && (strict ? looksLikeEmail(email) : email.contains("@")) // The course's loose check, or the tightened one.
    }

    /// The hint under the password field, or nil when no hint should show.
    static func hint(password: String, minimum: Int = 8) -> String? { // nil means "show nothing".
        guard !password.isEmpty, password.count < minimum else { return nil } // `if !password.isEmpty && password.count < 8`
        return "\(minimum - password.count) more characters needed" // `Text("\(8 - password.count) more characters needed")`
    }

    /// A tighter email check: no spaces, text before the @, and a dot somewhere after it.
    static func looksLikeEmail(_ email: String) -> Bool { // Not perfect, but " @" no longer passes.
        let trimmed = email.trimmingCharacters(in: .whitespaces) // Ignore spaces at the ends.
        guard !trimmed.contains(" ") else { return false } // Spaces inside an address are not allowed.
        let parts = trimmed.split(separator: "@", omittingEmptySubsequences: false) // Split around the @.
        guard parts.count == 2 else { return false } // Exactly one @.
        return !parts[0].isEmpty && parts[1].contains(".") && !parts[1].hasPrefix(".") && !parts[1].hasSuffix(".") // name@domain.tld shape.
    }
}

/// The complete order form's rules.
enum OrderFormRules { // A namespace for the rules.
    /// The drinks the challenge's menu Picker offers.
    static let drinks = ["Latte", "Mocha", "Cold Brew"] // Three options, so a menu is fine.

    /// `var total: Double { 3.0 + Double(shots) * 0.75 }`, plus the oat milk challenge.
    static func total(shots: Int, oatMilk: Bool) -> Double { // Derived from state.
        3.0 + Double(shots) * 0.75 + (oatMilk ? 0.6 : 0) // Two shots, no oat: 4.50.
    }

    /// The pay button's title, for example "Pay $4.50".
    static func payTitle(total: Double) -> String { // `Button("Pay " + String(format: "$%.2f", total))`
        "Pay " + String(format: "$%.2f", total) // Two decimals.
    }

    /// `.disabled(name.isEmpty)`. With `ignoringSpaces`, a name of only spaces is also refused.
    static func canPay(name: String, ignoringSpaces: Bool = false) -> Bool { // The quiz's single-space case.
        let checked = ignoringSpaces ? name.trimmingCharacters(in: .whitespaces) : name // Trim only when asked.
        return !checked.isEmpty // A name exists.
    }
}

// FirstProgram.swift
// Who: lesson 0.1's "Your first Swift program" card, and the tests that check it.
// What: the course's first console program, run into a Transcript instead of
//       Xcode's console, so the screen can show the output and a test can check it.
// Where: the Models folder; the lesson screen calls FirstProgram.run.
// When: each time the student presses Run on that card.
// Why: the course promises an exact output; keeping the program here lets a
//      unit test prove the app prints exactly that.

import Foundation // Plain Swift only; Transcript comes from CourseKit.

/// The course's first Swift program.
enum FirstProgram { // An enum with no cases is a namespace: it groups code and can never be created by mistake.
    /// The compiler error the course shows when weeksLeft is declared with let instead of var.
    static let letError = "error: cannot assign to value: 'weeksLeft' is a 'let' constant" // The exact wording students will meet in Xcode.

    /// Runs the program and returns what it prints, line by line.
    /// - Parameter startingWeeks: the value on line 2, 4 in the course (the Try it suggests 10).
    static func run(startingWeeks: Int = 4) -> [String] { // Returns the printed lines instead of printing them.
        var out = Transcript() // Collects what print would have written to the console.
        let course = "iOS Development" // Line 1: a constant; it never changes.
        var weeksLeft = startingWeeks // Line 2: a variable, because line 4 changes it.
        weeksLeft -= 1 // Line 4: subtracts 1 and stores the result back.
        out.print("Welcome to \(course)!") // Line 5: interpolation puts course inside the text.
        out.print("Weeks left: \(weeksLeft)") // Line 6: prints the value after the subtraction.
        return out.lines // Hands the two printed lines back to the caller.
    }
}

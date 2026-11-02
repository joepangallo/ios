// Program.swift
// Who: every lesson screen in this app, and the unit tests that check them.
// What: the small data types the lessons share: a runnable course example
//       (its code plus a function that performs it), a mistake that does not
//       compile, a vocabulary term, and a print helper that understands
//       print's terminator argument.
// Where: the Models folder. The lesson files build these values; the views in
//        the Support folder display them.
// When: a Program is built whenever a lesson screen draws, and run only when
//       the student presses Run (or when a test calls run()).
// Why: keeping each example as plain data plus a pure function means the
//      screen and the tests use exactly the same code, so a passing test
//      proves the screen prints what the course says it prints.

import Foundation // ProcessInfo, used to read launch arguments.

/// One course example the app can show and run.
struct Program { // A value type: two programs never share state.
    let source: String // The Swift code exactly as the course shows it, with the student's current values filled in.
    let run: () -> Transcript // Performs the same steps and returns every line they printed.
}

/// One course example that the compiler refuses to build.
struct Mistake { // Plain data: there is nothing to run, by definition.
    let source: String // The broken program, exactly as the course shows it.
    let line: Int // The line the compiler points at, counting from 1.
    let error: String // The full message the Swift compiler prints for that line.
    let courseQuote: String // The words the course quotes; a test checks they appear inside error.
}

/// One vocabulary term from a concept step: the word and what it means.
struct Term: Identifiable { // Identifiable so ForEach can list terms.
    let term: String // The word or symbol being defined, such as "let".
    let text: String // Its definition, in the course's words.
    var id: String { term } // Terms never repeat within one list, so the word itself is the identity.
}

/// Imitates Swift's own print, including its separator and terminator
/// arguments, and hands back the finished lines as a Transcript.
/// Transcript records one whole line per call, so this helper is needed only
/// for programs that use terminator to keep a line open.
struct PrintStream { // A value type: each program run gets its own.
    private var text = "" // Everything printed so far, newlines included.

    /// Writes the items the way Swift's print does: joined by separator, then terminator.
    mutating func print(_ items: Any..., separator: String = " ", terminator: String = "\n") { // Same shape as Swift's print.
        text += items.map { "\($0)" }.joined(separator: separator) + terminator // Each item as text, joined, then the ending.
    }

    /// The printed text cut into lines, as the console would show them.
    var transcript: Transcript { // Computed fresh each time it is read.
        var result = Transcript() // An empty transcript to fill.
        var lines = text.split(separator: "\n", omittingEmptySubsequences: false) // Keep blank lines; they are real output.
        if lines.last == "" { lines.removeLast() } // The final newline ends the last line; it does not start a new one.
        for line in lines { result.print(String(line)) } // Copy each line into the transcript.
        return result // Ready for ConsoleView or a test.
    }
}

extension Transcript { // Adds a convenience to the shared Transcript type without editing it.
    /// All printed lines joined with newlines, the way a console shows them.
    var text: String { lines.joined(separator: "\n") } // Tests compare this with the course's expected output.
}

/// Launch arguments that change how lessons open. Teachers can set them in
/// Xcode under Product > Scheme > Edit Scheme > Arguments.
enum LaunchOptions { // An enum with no cases: just a home for these two settings.
    /// `-autorun` runs every example as soon as it appears, handy on a projector.
    static var autorun: Bool { ProcessInfo.processInfo.arguments.contains("-autorun") } // True when the flag was passed.

    /// `-scroll 0.5` opens a lesson page scrolled halfway down (0 is the top, 1 the bottom).
    static var scrollFraction: Double? { // nil when the flag is missing or not a number.
        let args = ProcessInfo.processInfo.arguments // The words the app was launched with.
        guard let flag = args.firstIndex(of: "-scroll"), flag + 1 < args.count else { return nil } // The number must follow the flag.
        return Double(args[flag + 1]) // nil if the text is not a number.
    }
}

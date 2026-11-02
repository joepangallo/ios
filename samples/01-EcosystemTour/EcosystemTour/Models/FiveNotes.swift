// FiveNotes.swift
// Who: lessons that show code with the course's five-part line notes.
// What: the note for one line (Who, What, Where, When, Why) and a numbered
//       line of code that may carry such a note.
// Where: the Models folder; AnnotatedCodeView in Support draws these values.
// When: created once, when a lesson screen builds its list of lines.
// Why: the course page explains every line in five parts; keeping the notes as
//      plain data lets a screen show them and a test check them.

import Foundation // Foundation is enough here: these are plain values, no views.

/// The five-part explanation the course page gives for one line of code.
struct FiveNotes: Hashable { // Hashable so a whole line value can be compared and stored in sets.
    let who: String // Which part of the system acts on the line.
    let what: String // Exactly what the line does.
    let `where`: String // Where it lives or runs. Backticks let a keyword be a property name.
    let when: String // When it runs.
    let why: String // Why it is written that way.

    /// The five parts with their labels, in the order the course's inspector lists them.
    var parts: [(label: String, text: String)] { // A computed list, so it can never fall out of step with the properties.
        [("Who", who), ("What", what), ("Where", `where`), ("When", when), ("Why", why)] // Same order as the course page.
    }
}

/// One line of code, numbered like an editor numbers it, with an optional note.
struct AnnotatedLine: Identifiable, Hashable { // Identifiable for ForEach; Hashable for selection.
    let number: Int // The line number, starting at 1.
    let code: String // The line's text, exactly as written.
    let notes: FiveNotes? // nil for blank lines and lone closing braces, which have no note.
    var id: Int { number } // Line numbers never repeat in one listing.

    /// Numbers a list of (code, notes) pairs from 1, the way the course writes its examples.
    static func listing(_ pairs: [(String, FiveNotes?)]) -> [AnnotatedLine] { // One pair per line of the example.
        pairs.enumerated().map { index, pair in // enumerated gives each pair its position, starting at 0.
            AnnotatedLine(number: index + 1, code: pair.0, notes: pair.1) // Editors count lines from 1, not 0.
        }
    }
}

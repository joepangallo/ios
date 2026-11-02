// SupportTests.swift
// Who: the Swift Testing runner.
// What: checks the shared model helpers: PrintStream (print with terminator),
//       Transcript.text, and every Mistake in the app.
// Where: the SwiftBasicsTests target.
// When: only when tests run.
// Why: every lesson relies on these helpers; a bug here would make every
//      console in the app wrong at once.

import Foundation // trimmingCharacters(in:), used to check a mistake's line.
import Testing // @Test, #expect and #require.
@testable import SwiftBasics // The app's internal types.

@MainActor // The app's types live on the main actor.
struct SupportTests { // Tests for Models/Program.swift.
    @Test func printStreamMatchesSwiftPrint() { // Same rules as Swift's print.
        var stream = PrintStream() // Empty.
        stream.print("a", "b") // Default separator and terminator.
        stream.print("c", "d", separator: "-") // Custom separator.
        #expect(stream.transcript.lines == ["a b", "c-d"]) // One line per call.
    }

    @Test func printStreamTerminatorKeepsTheLineOpen() { // terminator replaces the newline.
        var stream = PrintStream() // Empty.
        stream.print("Loading", terminator: "...") // No newline yet.
        stream.print("done") // Continues the same line.
        #expect(stream.transcript.lines == ["Loading...done"]) // One line, not two.
    }

    @Test func printStreamKeepsBlankLinesButNotTheFinalNewline() { // Blank output lines are real output.
        var stream = PrintStream() // Empty.
        stream.print("") // An empty line.
        stream.print("x") // Then text.
        #expect(stream.transcript.lines == ["", "x"]) // The blank line survives; no extra line at the end.
    }

    @Test func emptyPrintStreamHasNoLines() { // Nothing printed, nothing shown.
        #expect(PrintStream().transcript.lines.isEmpty) // No phantom blank line.
    }

    @Test func transcriptTextJoinsLines() { // The helper the lesson tests rely on.
        var transcript = Transcript() // Empty.
        transcript.print("one") // Line 1.
        transcript.print("two", 2) // Line 2, two items.
        #expect(transcript.text == "one\ntwo 2") // Joined with a newline.
    }

    /// Every mistake shown in the app.
    let mistakes: [Mistake] = [ // Collected from every lesson.
        ValuesExamples.changingConstant, // 2.1
        ValuesExamples.mixingNumbers, // 2.1
        OperatorsStringsExamples.lengthMistake, // 2.2
        OptionalsExamples.optionalAsNumber, // 2.3
        CollectionsExamples.letArrayMistake, // 2.4
        ControlFlowExamples.scopeMistake, // 2.5
        FunctionsExamples.missingLabel, // 2.6
        ClosuresExamples.missingEscaping, // 2.7
    ]

    @Test func everyMistakeQuotesTheCourse() { // Checks all eight mistakes.
        #expect(mistakes.count == 8) // One per mistake step, plus the @escaping experiment.
        for mistake in mistakes { // Each mistake in turn.
            #expect(mistake.error.contains(mistake.courseQuote)) // The full message contains the words the course quotes.
            let lines = mistake.source.split(separator: "\n", omittingEmptySubsequences: false) // The code's lines.
            #expect((1...lines.count).contains(mistake.line)) // The marked line exists...
            if (1...lines.count).contains(mistake.line) { // ...and only then can it be read safely.
                #expect(!lines[mistake.line - 1].trimmingCharacters(in: .whitespaces).isEmpty) // It is not a blank line.
            }
        }
    }

    @Test func wrappedCodeBreaksOnlyAtSpaces() { // CodeBlock's wrapping helper.
        let joined = CodeBlock.breakingOnlyAtSpaces("ab c") // Two letters, a space, a letter.
        #expect(joined == "a\u{2060}b c") // A joiner between a and b; none around the space.
        #expect(joined.replacingOccurrences(of: "\u{2060}", with: "") == "ab c") // Removing the joiners gives the line back.
        #expect(CodeBlock.breakingOnlyAtSpaces("") == "") // Empty stays empty.
        let indented = CodeBlock.breakingOnlyAtSpaces("    print(a) b") // Four spaces of indentation, then one space between tokens.
        #expect(indented.filter { $0 == " " }.count == 1) // Only the space between tokens can break.
        #expect(indented.replacingOccurrences(of: "\u{2060}", with: "").replacingOccurrences(of: "\u{00A0}", with: " ") == "    print(a) b") // Nothing else changed.
    }

    @Test func mistakesPointAtTheRightLines() { // Spot checks against the real compiler's positions.
        #expect(ValuesExamples.changingConstant.source.split(separator: "\n")[2] == "maxLives = 2") // Line 3.
        #expect(OperatorsStringsExamples.lengthMistake.source.split(separator: "\n")[1].contains("username.length")) // Line 2.
        #expect(FunctionsExamples.missingLabel.line == 5) // The call without drink:.
        #expect(ControlFlowExamples.scopeMistake.line == 7) // The print after the loop.
    }
}

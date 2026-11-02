// Lesson63Tests.swift
// Who: the Swift Testing runner.
// What: checks every encoder and decoder path in lesson 6.3 against the course's expected
//       output, including every DecodingError case and the date strategies.
// Where: the DataKeeperTests target.
// When: whenever tests run.
// Why: the course prints exact outputs; the app must produce exactly those.

import Foundation // JSONEncoder, JSONDecoder and Date.
import Testing // @Test, #expect and #require.
@testable import DataKeeper // The app's internal types.

@MainActor // The app's types are main-actor isolated.
struct EncodeDecodeTests { // The course's runnable examples.
    @Test func encodeMatchesTheCourse() throws { // "Encode a struct to JSON".
        let out = try EncodeExample.run() // Pretty-printed, sorted keys.
        // The course's expected output, line for line.
        let expected = """
        Bytes: 95
        {
          "author" : "Ana Ruiz",
          "isFavorite" : true,
          "pages" : 240,
          "title" : "Swift Basics"
        }
        """
        #expect(out.lines.joined(separator: "\n") == expected) // Exactly the course's output.
    }

    @Test func sortedKeysOnlyIsCompact() throws { // The course's first Try It.
        let out = try EncodeExample.run(formatting: [.sortedKeys]) // No pretty printing.
        #expect(out.lines == ["Bytes: 74", #"{"author":"Ana Ruiz","isFavorite":true,"pages":240,"title":"Swift Basics"}"#]) // Spaces and line breaks disappeared.
    }

    @Test func firstBytesAreHex() throws { // The concept card's byte dump.
        #expect(try EncodeExample.firstBytes(count: 2) == "7B 22") // { and the quote of the first key.
    }

    @Test func decodeMatchesTheCourse() throws { // "Decode JSON into Swift values".
        #expect(try DecodeExample.run().lines == ["Swift Basics - no subtitle", "Saving Data - Files to Cloud", "Total pages: 552"]) // Exactly.
    }

    @Test func codingKeysMatchTheCourse() throws { // "Nested types and CodingKeys".
        #expect(try CodingKeysExample.run().lines == ["swiftlang/swift: 69000 stars"]) // Exactly.
    }

    @Test func encodingBackUsesTheJSONKeyName() throws { // The CodingKeys Try It.
        #expect(try CodingKeysExample.encodeBack() == #"{"name":"swift","owner":{"login":"swiftlang"},"stargazers_count":69000}"#) // stargazers_count, and no language.
    }

    @Test func decodingErrorsMatchTheCourse() { // "Reading a decoding error".
        #expect(DecodingErrorExample.run().lines == ["Decoded Oslo 4.5", "Missing key: temperature", "Wrong type at: temperature", #"Not valid JSON: {"city": "Rome", "temp"#]) // Exactly.
    }

    @Test func fifthSampleIsATypeMismatchAtCity() { // The decoding-error Try It.
        #expect(DecodingErrorExample.run(includeFifth: true).lines.last == "Wrong type at: city") // The typeMismatch clause handles it.
    }
}

@MainActor // The app's types are main-actor isolated.
struct DateStrategyTests { // "Dates in JSON".
    @Test func iso8601DecodesTheMoment() throws { // The course's strategy.
        let event = try DatesExample.decode(DatesExample.isoJSON, strategy: .iso8601) // Text to Date.
        #expect(event.name == "Launch party") // The name.
        #expect(event.startsAt == DatesExample.expectedStart) // 2026-09-14 17:00 UTC.
    }

    @Test func secondsSince1970DecodesTheSameMoment() throws { // The Try It.
        #expect(try DatesExample.decode(DatesExample.secondsJSON, strategy: .secondsSince1970).startsAt == DatesExample.expectedStart) // Same instant.
    }

    @Test func defaultStrategyReadsSecondsSince2001() throws { // Why the default is a trap.
        let event = try DatesExample.decode(DatesExample.secondsJSON, strategy: .deferredToDate) // Decodes, but wrongly.
        #expect(event.startsAt == Date(timeIntervalSinceReferenceDate: 1_789_405_200)) // 31 years too late.
    }

    @Test func defaultStrategyRejectsISOText() { // A type mismatch, as the course says.
        #expect(throws: DecodingError.self) { try DatesExample.decode(DatesExample.isoJSON, strategy: .deferredToDate) } // Expected a number.
        let out = DatesExample.run(json: DatesExample.isoJSON, strategy: .deferredToDate) // The printed version.
        #expect(out.lines.first?.hasPrefix("typeMismatch at startsAt") == true) // Names the key.
    }

    @Test func badDateTextIsDataCorrupted() { // ISO strategy with text that is not a date.
        let out = DatesExample.run(json: #"{"name": "x", "startsAt": "next Tuesday"}"#, strategy: .iso8601) // Not ISO 8601.
        #expect(out.lines.first?.hasPrefix("dataCorrupted") == true) // The other error case.
        #expect(out.lines.first?.contains("ISO8601") == true) // Swift says what it expected.
    }

    @Test func missingNameIsReported() { // Any other error goes to the last catch.
        let out = DatesExample.run(json: #"{"startsAt": "2026-09-14T17:00:00Z"}"#, strategy: .iso8601) // No name key.
        #expect(out.lines.first?.hasPrefix("Error:") == true) // The general clause.
    }

    @Test func successfulRunPrintsThreeLines() { // Decode, format, encode.
        let out = DatesExample.run(json: DatesExample.isoJSON, strategy: .iso8601) // The happy path.
        #expect(out.lines.count == 3) // Three lines.
        #expect(out.lines[0] == "Decoded: Launch party") // The name.
        #expect(out.lines[2] == #"Back to JSON: {"name":"Launch party","startsAt":"2026-09-14T17:00:00Z"}"#) // ISO 8601 again.
    }
}

@MainActor // The app's types are main-actor isolated.
struct JSONLabTests { // "The JSON decoding lab".
    /// The JSON of a sample by name.
    private func sample(_ name: String) throws -> String { // Fails the test if the name is wrong.
        try #require(JSONLab.samples.first { $0.name == name }).json // The sample's JSON.
    }

    @Test func validDecodesInBothShapes() throws { // Required and optional subtitle.
        #expect(JSONLab.decode(try sample("Valid"), optionalSubtitle: false, useCodingKeys: false) == .decoded(#"Book(title: "Swift Basics", subtitle: "A first course", pages: 240)"#)) // Exactly what print shows.
        #expect(JSONLab.decode(try sample("Valid"), optionalSubtitle: true, useCodingKeys: false) == .decoded(#"Book(title: "Swift Basics", subtitle: Optional("A first course"), pages: 240)"#)) // Optionals print as Optional(...).
    }

    @Test func missingSubtitle() throws { // keyNotFound unless optional.
        let json = try sample("Missing subtitle") // No subtitle key.
        guard case .failed(let kind, let path, _) = JSONLab.decode(json, optionalSubtitle: false, useCodingKeys: false) else { Issue.record("expected an error"); return } // Must fail.
        #expect(kind == "keyNotFound" && path == "subtitle") // Names the key.
        #expect(JSONLab.decode(json, optionalSubtitle: true, useCodingKeys: false) == .decoded(#"Book(title: "Swift Basics", subtitle: nil, pages: 240)"#)) // Optional fixes it.
    }

    @Test func nullSubtitle() throws { // valueNotFound unless optional.
        let json = try sample("Null subtitle") // subtitle is null.
        guard case .failed(let kind, let path, _) = JSONLab.decode(json, optionalSubtitle: false, useCodingKeys: false) else { Issue.record("expected an error"); return } // Must fail.
        #expect(kind == "valueNotFound" && path == "subtitle") // Names the key.
        #expect(JSONLab.decode(json, optionalSubtitle: true, useCodingKeys: false) == .decoded(#"Book(title: "Swift Basics", subtitle: nil, pages: 240)"#)) // Optional turns null into nil.
    }

    @Test func wrongType() throws { // typeMismatch whatever the shape.
        guard case .failed(let kind, let path, let message) = JSONLab.decode(try sample("Wrong type"), optionalSubtitle: true, useCodingKeys: false) else { Issue.record("expected an error"); return } // Must fail.
        #expect(kind == "typeMismatch" && path == "pages") // The key with the wrong type.
        #expect(message.contains("Int")) // Swift names the expected type.
    }

    @Test func snakeCaseNeedsCodingKeys() throws { // page_count.
        let json = try sample("snake_case key") // Uses page_count.
        guard case .failed(let kind, let path, _) = JSONLab.decode(json, optionalSubtitle: false, useCodingKeys: false) else { Issue.record("expected an error"); return } // Without keys: fails.
        #expect(kind == "keyNotFound" && path == "pages") // Looks for "pages".
        #expect(JSONLab.decode(json, optionalSubtitle: false, useCodingKeys: true) == .decoded(#"Book(title: "Swift Basics", subtitle: "A first course", pages: 240)"#)) // With keys: works.
        guard case .failed(_, let keyedPath, _) = JSONLab.decode(try sample("Valid"), optionalSubtitle: true, useCodingKeys: true) else { Issue.record("expected an error"); return } // With keys, "pages" no longer works.
        #expect(keyedPath == "page_count") // Now it wants page_count.
    }

    @Test func notJSON() throws { // dataCorrupted at the top level.
        guard case .failed(let kind, let path, _) = JSONLab.decode(try sample("Not JSON"), optionalSubtitle: false, useCodingKeys: false) else { Issue.record("expected an error"); return } // Must fail.
        #expect(kind == "dataCorrupted" && path == "(top level)") // The whole document.
    }

    @Test func pathTextFormatsArrayIndexes() { // Coding paths read like Swift.
        struct Key: CodingKey { // A minimal key for the test.
            var stringValue: String // The name.
            var intValue: Int? // The position.
            init(stringValue: String) { self.stringValue = stringValue; intValue = nil } // A named key.
            init(intValue: Int) { stringValue = "\(intValue)"; self.intValue = intValue } // A position.
        }
        #expect(JSONLab.pathText([]) == "(top level)") // Empty.
        #expect(JSONLab.pathText([Key(intValue: 0), Key(stringValue: "title")]) == "[0].title") // Position, then name.
    }
}

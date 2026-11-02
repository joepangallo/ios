// ProtocolExamplesTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks every program in lesson 3.4 against the course's expected
//       output, plus the JSON helpers behind the live editor and the
//       Equatable, Hashable and Comparable behavior the screen shows.
// Where: the TypeWorkshopTests target; the code under test is Models/ProtocolExamples.swift.
// When: only when tests run.
// Why: the JSON editor accepts anything a student types, so its success and
//      failure messages must be predictable.

import Testing // Swift Testing: @Test, #expect and #require.
@testable import TypeWorkshop // Lets the tests see the app's internal types.

@MainActor // The app's types are main-actor isolated by default.
struct ProtocolExamplesTests { // Lesson 3.4.
    @Test func pricedCartPrintsBothItems() { // Course step "Defining and adopting a protocol".
        #expect(DefiningAndAdoptingAProtocol.run().text == "Flat white 4.5\nCroissant 3.25") // The expected output.
        let item: any DefiningAndAdoptingAProtocol.Priced = DefiningAndAdoptingAProtocol.Coffee(name: "Espresso", shots: 1) // Boxed as any Priced.
        #expect(item.price == 3.75) // The computed price, through the protocol.
    }

    @Test func protocolExtensionSuppliesTheDefault() { // Course step "Default behavior with protocol extensions".
        #expect(ProtocolExtensions.run().text == "Check out Night Owl\nPad thai, ready in 25 min") // The expected output.
        let song: any ProtocolExtensions.Shareable = ProtocolExtensions.Song(title: "Ocean Drive") // Default implementation.
        #expect(song.shareText == "Check out Ocean Drive") // Built from the title.
    }

    @Test func hashableAndComparableTodoItems() { // Course step "Equatable, Hashable and Comparable".
        #expect(EquatableHashableComparable.run().text == "true\n3\n[\"Pay rent\", \"Renew gym\", \"Call the bank\"]") // The expected output.
        typealias Item = EquatableHashableComparable.TodoItem // A short name.
        let early = Item(title: "A", dueDay: 1) // Due first.
        let late = Item(title: "B", dueDay: 5) // Due last.
        #expect(early < late) // Our < function.
        #expect(late > early) // Derived from <.
        #expect(Item(title: "A", dueDay: 1) != Item(title: "A", dueDay: 2)) // == compares every stored property.
        #expect([late, early].max()?.title == "B") // The course's try item: the latest due date is the maximum.
    }

    @Test func codableRoundTripMatchesTheCourse() throws { // Course step "Identifiable and Codable".
        #expect(IdentifiableAndCodable.run().text == "Night Owl by The Late Trains\n{\n  \"artist\" : \"The Late Trains\",\n  \"id\" : 7,\n  \"title\" : \"Night Owl\"\n}") // The expected output.
        let song = try IdentifiableAndCodable.decodeSong(from: IdentifiableAndCodable.sampleJSON) // Decode the sample.
        #expect(song.id == 7) // Identifiable's id.
        let again = try IdentifiableAndCodable.decodeSong(from: IdentifiableAndCodable.prettyJSON(for: song)) // Encode, then decode again.
        #expect(again.title == song.title && again.artist == song.artist && again.id == song.id) // Nothing lost on the round trip.
    }

    @Test func playlistJSONDecodesWithUniqueIDs() throws { // The Identifiable list on screen.
        let songs = try IdentifiableAndCodable.decodeSongs(from: IdentifiableAndCodable.playlistJSON) // Three songs.
        #expect(songs.count == 3) // All decoded.
        #expect(Set(songs.map(\.id)).count == 3) // Every id is unique, as Identifiable needs.
    }

    @Test func decodingErrorsAreExplained() throws { // The live editor's error messages.
        let missing = #expect(throws: (any Error).self) { try IdentifiableAndCodable.decodeSong(from: #"{"id": 7, "title": "Night Owl"}"#) } // No artist key.
        #expect(IdentifiableAndCodable.explain(try #require(missing)) == "Missing key: artist") // Names the key.
        let mismatch = #expect(throws: (any Error).self) { try IdentifiableAndCodable.decodeSong(from: #"{"id": "seven", "title": "a", "artist": "b"}"#) } // id is text.
        #expect(IdentifiableAndCodable.explain(try #require(mismatch)).hasPrefix("Wrong type at id")) // Names the path.
        let nullValue = #expect(throws: (any Error).self) { try IdentifiableAndCodable.decodeSong(from: #"{"id": null, "title": "a", "artist": "b"}"#) } // id is null.
        #expect(IdentifiableAndCodable.explain(try #require(nullValue)).hasPrefix("Missing value")) // A null where a value belongs.
        let broken = #expect(throws: (any Error).self) { try IdentifiableAndCodable.decodeSong(from: "{not json") } // Not JSON at all.
        #expect(IdentifiableAndCodable.explain(try #require(broken)) == "This is not valid JSON.") // Broken punctuation.
        #expect(IdentifiableAndCodable.explain(TryQuestionAndTryBang.ParseError.notANumber("x")) == "notANumber(\"x\")") // Other errors print as themselves.
    }

    @Test func someAndAnyShapes() { // Compare step "some versus any".
        #expect(SomeVersusAny.runSome().text == "9.0") // Left side.
        #expect(SomeVersusAny.runAny().text == "[9.0, 3.141592653589793]") // Right side.
        #expect(SomeVersusAny.makeBadge().area() == 9) // The hidden Square.
        let shapes: [any SomeVersusAny.Shape] = [SomeVersusAny.Circle(radius: 2), SomeVersusAny.Square(side: 2)] // Mixed types.
        #expect(shapes.map { $0.area() }.last == 4) // Each call reaches the right type.
    }
}

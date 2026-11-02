// ProtocolExamples.swift
// Who: the 3.4 lesson screen runs these programs and uses the JSON helpers;
//      the unit tests check the programs and the helpers.
// What: the protocol programs from the course lesson "Protocols and
//       Protocol-Oriented Design": a Priced cart, Shareable with a default
//       implementation, Hashable and Comparable to-do items, a Codable song,
//       and some versus any with shapes.
// Where: the Models folder; Lesson_3_4_Protocols.swift is the screen that uses them.
// When: run() executes when the screen draws; the JSON helpers run whenever the
//       student edits the JSON text.
// Why: a protocol is a contract. Watching unrelated types meet the same contract,
//      and code that works with any of them, is the heart of this lesson.

import Foundation // JSONDecoder, JSONEncoder, Data and DecodingError come from Foundation.

/// Course step "Defining and adopting a protocol".
enum DefiningAndAdoptingAProtocol { // A caseless enum used as a namespace for this example.
    protocol Priced { // A contract: what the cart needs from anything it holds.
        var name: String { get } // A readable name; a let, a var or a computed property all qualify.
        var price: Double { get } // A readable price; the protocol says what, not how.
    }

    struct Coffee: Priced { // Promises to meet every Priced requirement.
        let name: String // A stored let satisfies { get }.
        let shots: Int // Extra data the protocol does not mention.
        var price: Double { 3.0 + Double(shots) * 0.75 } // A computed property satisfies { get } too.
    }

    struct Pastry: Priced { // An unrelated type adopting the same protocol.
        let name: String // Satisfies the name requirement.
        let price: Double // A fixed price, stored.
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        let cart: [any Priced] = [Coffee(name: "Flat white", shots: 2), // any Priced: a box for any conforming type.
                                  Pastry(name: "Croissant", price: 3.25)] // A pastry beside a coffee in one array.
        for item in cart { // item has the type any Priced.
            out.print(item.name, item.price) // Only the protocol's requirements are available here.
        }
        return out // Two printed lines.
    }
}

/// Course step "Default behavior with protocol extensions".
enum ProtocolExtensions { // Namespace for this step's example.
    protocol Shareable { // A small capability: anything the app can share.
        var title: String { get } // Required: the default text needs a title.
        var shareText: String { get } // Required, so each type's own version is used even through any Shareable.
    }

    struct Song: Shareable { let title: String } // Adopts with the minimum: the extension supplies shareText.

    struct Recipe: Shareable { // Adopts and customizes.
        let title: String // Satisfies the title requirement.
        let minutes: Int // Extra data the protocol does not need.
        var shareText: String { "\(title), ready in \(minutes) min" } // Replaces the default for recipes.
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        let items: [any Shareable] = [Song(title: "Night Owl"), // One list, two types.
                                      Recipe(title: "Pad thai", minutes: 25)] // The recipe brings its own shareText.
        for item in items { // item has the type any Shareable.
            out.print(item.shareText) // Default for the song, custom for the recipe.
        }
        return out // Two printed lines.
    }
}

extension ProtocolExtensions.Shareable { // The protocol extension: code every Shareable type receives.
    var shareText: String { "Check out \(title)" } // The default implementation, built from the required title.
}

/// Course step "Equatable, Hashable and Comparable".
enum EquatableHashableComparable { // Namespace for this step's example.
    struct TodoItem: Hashable, Comparable { // The compiler writes == and hashing; < is ours.
        let title: String // Compared and hashed by the synthesized code.
        let dueDay: Int // The day of the month the task is due.

        static func < (lhs: TodoItem, rhs: TodoItem) -> Bool { // Comparable's one requirement.
            lhs.dueDay < rhs.dueDay // Earlier due dates come first.
        }
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        let rent = TodoItem(title: "Pay rent", dueDay: 1) // Due on day 1.
        let copy = TodoItem(title: "Pay rent", dueDay: 1) // A separate value with identical properties.
        let call = TodoItem(title: "Call the bank", dueDay: 5) // Due on day 5.
        let gym = TodoItem(title: "Renew gym", dueDay: 3) // Due on day 3.
        out.print(rent == copy) // true: every stored property matches.
        let unique: Set<TodoItem> = [rent, copy, call, gym] // The duplicate is stored only once.
        out.print(unique.count) // 3
        let ordered = [call, rent, gym].sorted() // sorted() works because TodoItem is Comparable.
        out.print(ordered.map { $0.title }) // The titles in due order.
        return out // Three printed lines.
    }
}

/// Course step "Identifiable and Codable".
enum IdentifiableAndCodable { // Namespace for this step's example.
    struct Song: Codable, Identifiable { // Encodable, decodable and identifiable.
        let id: Int // Satisfies Identifiable; read from the JSON key id.
        let title: String // Read from the key title.
        let artist: String // Read from the key artist.
    }

    /// The JSON text the course program decodes.
    static let sampleJSON = """
    {"id": 7, "title": "Night Owl", "artist": "The Late Trains"}
    """ // Triple quotes let JSON keep its own double quotes without escaping.

    /// A small array of songs in JSON, for the Identifiable list on screen.
    static let playlistJSON = """
    [{"id": 7, "title": "Night Owl", "artist": "The Late Trains"},
     {"id": 8, "title": "Ocean Drive", "artist": "The Late Trains"},
     {"id": 9, "title": "Golden Hour", "artist": "The Late Trains"}]
    """ // Three objects; each id is unique, which is what Identifiable promises.

    /// Decodes one song from JSON text; throws when the text does not match the struct.
    static func decodeSong(from text: String) throws -> Song { // Used by the live JSON editor.
        try JSONDecoder().decode(Song.self, from: Data(text.utf8)) // The synthesized Decodable code does the work.
    }

    /// Decodes an array of songs from JSON text.
    static func decodeSongs(from text: String) throws -> [Song] { // Used by the Identifiable list.
        try JSONDecoder().decode([Song].self, from: Data(text.utf8)) // Arrays of Codable values are Codable too.
    }

    /// Encodes a song as indented JSON with its keys in alphabetical order.
    static func prettyJSON(for song: Song) -> String { // The reverse trip: struct to JSON text.
        let encoder = JSONEncoder() // A JSON encoder.
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys] // Indented, and identical on every run.
        let data = try! encoder.encode(song) // A struct of strings and numbers cannot fail to encode.
        return String(decoding: data, as: UTF8.self) // Bytes to readable text.
    }

    /// A short, readable reason why JSON could not be decoded.
    static func explain(_ error: any Error) -> String { // Shown under the JSON editor.
        guard let decodingError = error as? DecodingError else { return "\(error)" } // Anything else prints as itself.
        switch decodingError { // DecodingError is an enum with associated values.
        case .keyNotFound(let key, _): return "Missing key: \(key.stringValue)" // A property had no matching key.
        case .typeMismatch(let type, let context): return "Wrong type at \(context.codingPath.map(\.stringValue).joined(separator: ".")): expected \(type)" // For example a String where an Int belongs.
        case .valueNotFound(let type, _): return "Missing value: expected \(type)" // A null where a value belongs.
        case .dataCorrupted: return "This is not valid JSON." // Broken punctuation or quotes.
        @unknown default: return "Could not decode the JSON." // Future cases Apple might add.
        }
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        let decoder = JSONDecoder() // One decoder can decode many values.
        let song = try! decoder.decode(Song.self, from: Data(sampleJSON.utf8)) // try! is acceptable only for known-good sample data.
        out.print(song.title, "by", song.artist) // Night Owl by The Late Trains
        let encoder = JSONEncoder() // Encoding is the reverse trip.
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys] // Indented, keys in alphabetical order.
        let data = try! encoder.encode(song) // Encoding a struct of strings and numbers cannot fail.
        out.print(String(decoding: data, as: UTF8.self)) // The pretty JSON; one printed item that spans several lines.
        return out // Two printed items; the second contains line breaks.
    }
}

/// Course compare "some versus any".
enum SomeVersusAny { // Namespace for both sides; also keeps Shape and Circle apart from SwiftUI's.
    protocol Shape { // Both sides use the same protocol, so only some and any differ.
        func area() -> Double // Method requirements have no body in the protocol.
    }

    struct Square: Shape { // A conforming struct.
        let side: Double // All the data a square needs.
        func area() -> Double { side * side } // Meets the contract.
    }

    struct Circle: Shape { // A second, different conforming struct.
        let radius: Double // Different data, same protocol.
        func area() -> Double { Double.pi * radius * radius } // Double.pi is the standard library's pi.
    }

    /// Returns one particular Shape type without revealing which: an opaque type.
    static func makeBadge() -> some Shape { // Every return path must produce the same concrete type.
        Square(side: 3) // The compiler knows it is a Square; callers only see Shape.
    }

    /// Runs the left-hand program: some Shape.
    static func runSome() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        let badge = makeBadge() // An opaque value; no box involved.
        out.print(badge.area()) // 9.0
        return out // One printed line.
    }

    /// Runs the right-hand program: an array of any Shape.
    static func runAny() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        var shapes: [any Shape] = [Square(side: 3)] // Each element is a box, so types may differ.
        shapes.append(Circle(radius: 1)) // Impossible with some: a some type is one fixed type.
        out.print(shapes.map { $0.area() }) // [9.0, 3.141592653589793]
        return out // One printed line.
    }
}

// JSONExamples.swift
// Who: lesson 6.3's cards show these outputs; the tests check them against the course.
// What: every Codable example from the course as a function that returns what it prints:
//       encoding a Book, decoding an array of books, CodingKeys with a nested type,
//       reading each DecodingError, and dates in JSON.
// Where: the Support folder. Each example sits in its own namespace enum, because the
//        course reuses names such as Book for different shapes.
// When: whenever lesson 6.3 draws or the student changes an option.
// Why: Codable turns Swift values into bytes and back; seeing the exact bytes and the exact
//      errors is how you learn to trust it.

import Foundation // JSONEncoder, JSONDecoder, Data and Date.

/// The course's "Encode a struct to JSON" example.
enum EncodeExample { // A namespace, so this Book does not clash with the next one.
    struct Book: Codable { // Codable and nothing more: the compiler writes the rest.
        var title: String // Encoded as "title".
        var author: String // Encoded as "author".
        var pages: Int // Encoded as a JSON number.
        var isFavorite: Bool // Encoded as true or false.
    }

    /// The book the course encodes.
    static let book = Book(title: "Swift Basics", author: "Ana Ruiz", // The course's values...
                           pages: 240, isFavorite: true) // ...on two lines, as in the course.

    /// Encodes the book and prints the byte count and the text.
    static func run(formatting: JSONEncoder.OutputFormatting = [.prettyPrinted, .sortedKeys]) throws -> Transcript { // The course's formatting by default.
        var out = Transcript() // Collects the printed lines.
        let encoder = JSONEncoder() // Turns Encodable values into JSON bytes.
        encoder.outputFormatting = formatting // Line breaks and sorted keys, unless the student turns them off.
        let data = try encoder.encode(book) // The JSON as raw bytes.
        out.print("Bytes:", data.count) // 95 with the course's formatting.
        out.print(String(decoding: data, as: UTF8.self)) // The bytes read as UTF-8 text.
        return out // Both lines.
    }

    /// The first bytes of the encoded book in hexadecimal, to show that Data is just bytes.
    static func firstBytes(count: Int = 8) throws -> String { // Used by the concept card.
        let data = try JSONEncoder().encode(book) // Compact JSON this time.
        return data.prefix(count).map { String(format: "%02X", $0) }.joined(separator: " ") // Each byte as two hex digits.
    }
}

/// The course's "Decode JSON into Swift values" example.
enum DecodeExample { // A separate namespace for a different Book.
    struct Book: Codable { // This Book has an optional subtitle.
        var title: String // Required.
        var subtitle: String? // Optional: a missing key becomes nil.
        var pages: Int // Required.
    }

    /// The course's JSON: the first book has no subtitle.
    static let json = """
    [
      {"title": "Swift Basics", "pages": 240},
      {"title": "Saving Data", "subtitle": "Files to Cloud",
       "pages": 312}
    ]
    """

    /// Decodes the array and prints each book and the total pages.
    static func run() throws -> Transcript { // Throws if the JSON does not fit.
        var out = Transcript() // Collects the printed lines.
        let data = Data(json.utf8) // The text as UTF-8 bytes.
        let books = try JSONDecoder().decode([Book].self, from: data) // An array of Book from the bytes.
        for book in books { // One line per book.
            out.print(book.title, "-", book.subtitle ?? "no subtitle") // ?? fills in for the missing subtitle.
        }
        out.print("Total pages:", books.reduce(0) { $0 + $1.pages }) // 240 + 312.
        return out // Three lines.
    }
}

/// The course's "Nested types and CodingKeys" example.
enum CodingKeysExample { // A namespace for Repo.
    struct Repo: Codable { // The outer type.
        struct Owner: Codable { // A nested type for the nested JSON object.
            var login: String // The owner's login name.
        }
        var name: String // Same name in JSON and Swift.
        var starCount: Int // Swift style; the JSON calls it stargazers_count.
        var owner: Owner // Decoded from the nested object.

        enum CodingKeys: String, CodingKey { // Maps each property to its JSON key.
            case name, owner // Same names on both sides.
            case starCount = "stargazers_count" // The one that differs.
        }
    }

    /// The course's JSON; the language key has no property, so it is ignored.
    static let json = """
    {"name": "swift", "stargazers_count": 69000,
     "owner": {"login": "swiftlang"}, "language": "C++"}
    """

    /// Decodes the repo and prints one line.
    static func run() throws -> Transcript { // Throws if a key is missing.
        var out = Transcript() // Collects the printed line.
        let repo = try JSONDecoder().decode(Repo.self, from: Data(json.utf8)) // Decodes with the CodingKeys mapping.
        out.print("\(repo.owner.login)/\(repo.name): \(repo.starCount) stars") // swiftlang/swift: 69000 stars.
        return out // One line.
    }

    /// The course's Try It: encodes the repo again to see which key name comes out.
    static func encodeBack() throws -> String { // Returns compact, sorted JSON.
        let repo = try JSONDecoder().decode(Repo.self, from: Data(json.utf8)) // Decodes first.
        let encoder = JSONEncoder() // A new encoder.
        encoder.outputFormatting = [.sortedKeys] // Sorted, so the output is always the same.
        return String(decoding: try encoder.encode(repo), as: UTF8.self) // stargazers_count comes back, and language is gone.
    }
}

/// The course's "Reading a decoding error" example.
enum DecodingErrorExample { // A namespace for Weather.
    struct Weather: Codable { // The shape every sample should have.
        var city: String // Required text.
        var temperature: Double // Required number.
    }

    /// The course's four samples: fine, missing a key, wrong type, not JSON.
    static let samples = [ // Plain strings with escaped quotes.
        "{\"city\": \"Oslo\", \"temperature\": 4.5}", // Fine.
        "{\"city\": \"Lima\"}", // Missing temperature.
        "{\"city\": \"Cairo\", \"temperature\": \"hot\"}", // Text where a number belongs.
        "{\"city\": \"Rome\", \"temp", // Cut off: not valid JSON.
    ]

    /// The course's Try It: a fifth sample where city is the number 7.
    static let fifthSample = "{\"city\": 7, \"temperature\": 20.0}" // A number where text belongs.

    /// Decodes each sample and prints what happened.
    static func run(includeFifth: Bool = false) -> Transcript { // Never throws: every error is caught.
        var out = Transcript() // Collects the printed lines.
        let decoder = JSONDecoder() // One decoder for every sample.
        for text in samples + (includeFifth ? [fifthSample] : []) { // Four samples, or five.
            do { // Try to decode.
                let w = try decoder.decode(Weather.self, from: Data(text.utf8)) // Succeeds only for good input.
                out.print("Decoded", w.city, w.temperature) // Decoded Oslo 4.5.
            } catch DecodingError.keyNotFound(let key, _) { // A required key is absent.
                out.print("Missing key:", key.stringValue) // Names the key.
            } catch DecodingError.typeMismatch(_, let context) { // A value has the wrong type.
                out.print("Wrong type at:", context.codingPath[0].stringValue) // Names the key where it happened.
            } catch { // Anything else, here: not JSON at all.
                out.print("Not valid JSON:", text) // Shows the broken input.
            }
        }
        return out // One line per sample.
    }
}

/// The course's "Dates in JSON" example, with the strategies side by side.
enum DatesExample { // A namespace for Event.
    struct Event: Codable { // An event with a start time.
        var name: String // The event's name.
        var startsAt: Date // JSON has no date type, so this needs a strategy.
    }

    /// The course's JSON, with an ISO 8601 date string.
    static let isoJSON = """
    {"name": "Launch party", "startsAt": "2026-09-14T17:00:00Z"}
    """

    /// The same moment written as seconds since 1970, for the course's Try It.
    static let secondsJSON = "{\"name\": \"Launch party\", \"startsAt\": 1789405200}" // 2026-09-14 17:00 UTC.

    /// The moment both samples describe.
    static let expectedStart = Date(timeIntervalSince1970: 1_789_405_200) // Used by the tests.

    /// The date decoding strategies the card compares.
    enum Strategy: String, CaseIterable, Identifiable { // String raw values are the picker labels.
        case iso8601 = ".iso8601" // Text such as 2026-09-14T17:00:00Z.
        case secondsSince1970 = ".secondsSince1970" // A plain number of seconds.
        case deferredToDate = "default" // Seconds since January 1, 2001: almost no server sends that.
        var id: String { rawValue } // Identifiable for ForEach.

        /// The JSONDecoder setting for this choice.
        var decoding: JSONDecoder.DateDecodingStrategy { // Applied before decoding.
            switch self { // One setting per choice.
            case .iso8601: .iso8601 // Parses ISO 8601 text.
            case .secondsSince1970: .secondsSince1970 // Reads a number as Unix time.
            case .deferredToDate: .deferredToDate // The default.
            }
        }
    }

    /// Decodes an event with the chosen strategy.
    static func decode(_ json: String, strategy: Strategy) throws -> Event { // Throws when the strategy does not fit the JSON.
        let decoder = JSONDecoder() // A new decoder.
        decoder.dateDecodingStrategy = strategy.decoding // Tells it how to read dates.
        return try decoder.decode(Event.self, from: Data(json.utf8)) // The decoded event.
    }

    /// Encodes an event back to JSON with ISO 8601 dates and sorted keys.
    static func encodeISO(_ event: Event) throws -> String { // The course's last two lines.
        let encoder = JSONEncoder() // A new encoder.
        encoder.dateEncodingStrategy = .iso8601 // Writes dates as ISO 8601 text.
        encoder.outputFormatting = [.sortedKeys] // Sorted, so the output is always the same.
        return String(decoding: try encoder.encode(event), as: UTF8.self) // Bytes back to text.
    }

    /// Runs a decode and prints the result, or the error.
    static func run(json: String, strategy: Strategy) -> Transcript { // Never throws.
        var out = Transcript() // Collects the printed lines.
        do { // Decoding can fail.
            let event = try decode(json, strategy: strategy) // Decodes with the chosen strategy.
            out.print("Decoded:", event.name) // The name always decodes.
            out.print("Starts:", event.startsAt.formatted(date: .long, time: .shortened)) // In the phone's own time zone and language.
            out.print("Back to JSON:", try encodeISO(event)) // The date as ISO 8601 text again.
        } catch DecodingError.typeMismatch(_, let context) { // The strategy expected a different JSON type.
            out.print("typeMismatch at", context.codingPath.map(\.stringValue).joined(separator: "."), "-", context.debugDescription) // Names the key and the problem.
        } catch DecodingError.dataCorrupted(let context) { // The text was not a valid date.
            let path = context.codingPath.map(\.stringValue).joined(separator: ".") // Foundation may leave this empty for dates.
            out.print("dataCorrupted" + (path.isEmpty ? "" : " at " + path), "-", context.debugDescription) // The problem, and the key when Swift names one.
        } catch { // Anything else.
            out.print("Error:", error.localizedDescription) // A general message.
        }
        return out // The lines to show.
    }
}

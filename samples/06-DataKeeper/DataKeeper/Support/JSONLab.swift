// JSONLab.swift
// Who: lesson 6.3's "The JSON decoding lab" card; the tests check every sample.
// What: decodes any JSON text into one of four versions of a Book struct (subtitle
//       required or optional, with or without CodingKeys) and reports either what
//       print(book) shows or the exact DecodingError with the path to the failing key.
// Where: the Support folder, plain Swift with no views.
// When: on every keystroke in the lab's JSON editor and every toggle change.
// Why: a struct is fixed at compile time, so "toggling the struct" means picking one of
//      four real types; each one shows which mismatches it fixes.

import Foundation // JSONDecoder and Data.

/// The four Book shapes and the decoder that tries them.
enum JSONLab { // A namespace for the lab.
    enum Strict { // subtitle is required.
        struct Book: Codable { // Every key must be present.
            var title: String // Required.
            var subtitle: String // Required: missing or null fails.
            var pages: Int // Required.
        }
    }
    enum Lenient { // subtitle may be missing.
        struct Book: Codable { // subtitle may be missing or null.
            var title: String // Required.
            var subtitle: String? // Optional: missing or null becomes nil.
            var pages: Int // Required.
        }
    }
    enum StrictKeyed { // subtitle required, pages read from page_count.
        struct Book: Codable { // Uses CodingKeys.
            var title: String // Required.
            var subtitle: String // Required.
            var pages: Int // Read from "page_count".
            enum CodingKeys: String, CodingKey { // The mapping.
                case title, subtitle // Same names.
                case pages = "page_count" // The snake_case key.
            }
        }
    }
    enum LenientKeyed { // subtitle optional, pages read from page_count.
        struct Book: Codable { // Both fixes at once.
            var title: String // Required.
            var subtitle: String? // Optional.
            var pages: Int // Read from "page_count".
            enum CodingKeys: String, CodingKey { // The mapping.
                case title, subtitle // Same names.
                case pages = "page_count" // The snake_case key.
            }
        }
    }

    /// What one decode attempt produced.
    enum Outcome: Equatable { // Equatable, so tests can compare outcomes.
        case decoded(String) // What print(book) would show.
        case failed(kind: String, path: String, message: String) // The DecodingError case, the key path, and Swift's description.
    }

    /// Ready-made inputs, including broken ones.
    static let samples: [(name: String, json: String)] = [ // Name for the menu, JSON for the editor.
        ("Valid", #"{"title": "Swift Basics", "subtitle": "A first course", "pages": 240}"#), // Fits the required shape.
        ("Missing subtitle", #"{"title": "Swift Basics", "pages": 240}"#), // keyNotFound unless subtitle is optional.
        ("Null subtitle", #"{"title": "Swift Basics", "subtitle": null, "pages": 240}"#), // valueNotFound unless optional.
        ("Wrong type", #"{"title": "Swift Basics", "subtitle": "A first course", "pages": "240"}"#), // typeMismatch: text, not a number.
        ("snake_case key", #"{"title": "Swift Basics", "subtitle": "A first course", "page_count": 240}"#), // Needs CodingKeys.
        ("Not JSON", #"{"title": "Swift Basics", "pag"#), // dataCorrupted.
    ]

    /// Decodes the text with the chosen struct shape.
    static func decode(_ json: String, optionalSubtitle: Bool, useCodingKeys: Bool) -> Outcome { // Pure: no state.
        switch (optionalSubtitle, useCodingKeys) { // Four combinations, four types.
        case (false, false): attempt(Strict.Book.self, json) // The strictest shape.
        case (true, false): attempt(Lenient.Book.self, json) // Optional subtitle.
        case (false, true): attempt(StrictKeyed.Book.self, json) // CodingKeys only.
        case (true, true): attempt(LenientKeyed.Book.self, json) // Both fixes.
        }
    }

    /// Tries one type and turns the result or the error into an Outcome.
    private static func attempt<T: Decodable>(_ type: T.Type, _ json: String) -> Outcome { // Generic over the Book shape.
        do { // Decoding can throw.
            let value = try JSONDecoder().decode(T.self, from: Data(json.utf8)) // The decode itself.
            return .decoded(String(describing: value)) // Exactly what print(value) shows.
        } catch let DecodingError.keyNotFound(key, context) { // A required key is missing.
            return .failed(kind: "keyNotFound", path: pathText(context.codingPath + [key]), message: context.debugDescription) // The path ends with the missing key.
        } catch let DecodingError.typeMismatch(_, context) { // A value has the wrong JSON type.
            return .failed(kind: "typeMismatch", path: pathText(context.codingPath), message: context.debugDescription) // The path to the bad value.
        } catch let DecodingError.valueNotFound(_, context) { // A required value is null.
            return .failed(kind: "valueNotFound", path: pathText(context.codingPath), message: context.debugDescription) // The path to the null.
        } catch let DecodingError.dataCorrupted(context) { // Not JSON, or a value that cannot be read.
            return .failed(kind: "dataCorrupted", path: pathText(context.codingPath), message: context.debugDescription) // Usually the top level.
        } catch { // Any other error.
            return .failed(kind: "other", path: "", message: error.localizedDescription) // A general description.
        }
    }

    /// Writes a coding path the way you would read it: title, pages, or [0].name.
    static func pathText(_ path: [any CodingKey]) -> String { // Coding keys can be names or array positions.
        guard !path.isEmpty else { return "(top level)" } // An empty path means the whole document.
        return path.map { key in key.intValue.map { "[\($0)]" } ?? key.stringValue }.joined(separator: ".") // Array positions in brackets, names as they are.
    }
}

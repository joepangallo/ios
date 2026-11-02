// JSONExamples.swift
// Who: Lesson 8.3's screen and its unit tests.
// What: the course's five decoding programs, each wrapped in a function that
//       prints into a Transcript instead of the console, plus the decoder lab
//       that explains any DecodingError in words.
// Where: the Models folder. Each example's types live inside a caseless enum
//        (a namespace), because two course examples both declare `User` and
//        two declare `Todo`, and one app cannot have two types with one name.
// When: when the student taps Run on a card, and when the tests run.
// Why: the course lists the exact output of each program, so the tests can
//      prove this app decodes JSON exactly the way the lesson says it does.

import Foundation // JSONDecoder, Data and DecodingError.

/// "Decode your first response": the JSON GET /todos/1 really returns, decoded into the shared Todo.
enum FirstDecodeExample { // A namespace for this example.
    /// The JSON text, embedded so the program runs without a network.
    static let json = """
    {"userId": 1, "id": 1,
     "title": "delectus aut autem", "completed": false}
    """ // The closing delimiter's indentation is stripped from every line.

    /// Runs the course program and returns what it printed.
    static func run() throws -> [String] { // Expected: "delectus aut autem", then "Still to do".
        var out = Transcript() // Collects the printed lines.
        let data = Data(json.utf8) // JSONDecoder reads bytes, not strings.
        let todo = try JSONDecoder().decode(Todo.self, from: data) // Turns the JSON into a typed Todo, or throws.
        out.print(todo.title) // Prints the decoded title.
        out.print(todo.completed ? "Done" : "Still to do") // Uses the decoded Bool.
        return out.lines // Everything printed, in order.
    }
}

/// "Rename keys with CodingKeys": a captured reply whose keys are poor Swift names.
enum CodingKeysExample { // A namespace for this example.
    /// The model, with CodingKeys mapping each property to its JSON key.
    struct Conditions: Decodable { // Decodable: the app only reads it.
        let time: String // Maps unchanged to "time".
        let temperature: Double // Comes from "temperature_2m".
        let windSpeed: Double // Comes from "wind_speed_10m".

        enum CodingKeys: String, CodingKey { // The generated decoder looks for exactly this name.
            case time // No raw value: the key is "time".
            case temperature = "temperature_2m" // The key exactly as the server spells it.
            case windSpeed = "wind_speed_10m" // Swift style is lowerCamelCase; the JSON's is not.
        }
    }

    /// The JSON text. The "interval" key has no property, so it is ignored.
    static let json = """
    {"time": "2026-10-20T14:15", "interval": 900,
     "temperature_2m": 25.7, "wind_speed_10m": 18.8}
    """ // Copied from the course.

    /// Runs the course program and returns what it printed.
    static func run() throws -> [String] { // Expected: "25.7 °C, wind 18.8 km/h", then "Measured at 2026-10-20T14:15".
        var out = Transcript() // Collects the printed lines.
        let data = Data(json.utf8) // Text to bytes.
        let now = try JSONDecoder().decode(Conditions.self, from: data) // CodingKeys guides the decoder.
        out.print("\(now.temperature) °C, wind \(now.windSpeed) km/h") // The clean Swift names.
        out.print("Measured at \(now.time)") // The timestamp string.
        return out.lines // Everything printed, in order.
    }
}

/// "Nested JSON, nested structs": /users/1 keeps the street and city inside "address".
enum NestedExample { // A namespace for this example.
    /// The outer model, matching the top-level JSON object.
    struct User: Decodable { // The generated decoder calls Address's decoder for the nested part.
        let name: String // The user's full name.
        let address: Address // The nested object, as its own struct.
    }

    /// The model for the inner "address" object.
    struct Address: Decodable { // Only the keys we need; suite and zipcode are ignored.
        let street: String // The street name.
        let city: String // The city name.
    }

    /// A trimmed copy of the /users/1 reply.
    static let json = """
    {"id": 1, "name": "Leanne Graham",
     "address": {"street": "Kulas Light", "city": "Gwenborough"}}
    """ // id is ignored because User has no id property.

    /// Runs the course program and returns what it printed.
    static func run() throws -> [String] { // Expected: "Leanne Graham lives on Kulas Light", then "in Gwenborough".
        try describe(Data(json.utf8)) // The same steps work for the live reply too.
    }

    /// Decodes any /users reply with these models and prints the course's two lines.
    static func describe(_ data: Data) throws -> [String] { // The live button passes the real reply here.
        var out = Transcript() // Collects the printed lines.
        let user = try JSONDecoder().decode(User.self, from: data) // Decodes the whole tree in one call.
        out.print("\(user.name) lives on \(user.address.street)") // Dot syntax reaches into the nested value.
        out.print("in \(user.address.city)") // The nested city.
        return out.lines // Everything printed, in order.
    }
}

/// "Flatten with a nested container": a flat Swift type for nested JSON.
enum FlattenExample { // A namespace for this example.
    /// A flat model: no Address type at all.
    struct User: Decodable { // Its decoder is written by hand below.
        let name: String // From the outer object.
        let city: String // From inside "address": this is the flattening.

        enum CodingKeys: String, CodingKey { case name, address } // The outer object's keys.
        enum AddressKeys: String, CodingKey { case city } // The inner object's only key we read.

        init(from decoder: Decoder) throws { // Replaces the compiler's automatic initializer.
            let root = try decoder.container(keyedBy: CodingKeys.self) // A keyed view of the outer object.
            name = try root.decode(String.self, forKey: .name) // Reads "name" as a String.
            let address = try root.nestedContainer( // Steps into the object stored under a key...
                keyedBy: AddressKeys.self, forKey: .address) // ...using the inner key enum.
            city = try address.decode(String.self, forKey: .city) // Reads "city" from inside address.
        }
    }

    /// The JSON text: city is nested inside address.
    static let json = """
    {"name": "Leanne Graham", "address": {"city": "Gwenborough"}}
    """ // The Swift type is flat; the JSON is not.

    /// Runs the course program and returns what it printed.
    static func run() throws -> [String] { // Expected: "Leanne Graham, Gwenborough".
        var out = Transcript() // Collects the printed lines.
        let user = try JSONDecoder().decode(User.self, from: Data(json.utf8)) // Calls our init(from:).
        out.print("\(user.name), \(user.city)") // Both properties read flat.
        return out.lines // Everything printed, in order.
    }
}

/// "When decoding fails": four JSON strings, four different outcomes.
enum DecodingFailureExample { // A namespace for this example.
    /// A small model with two required properties.
    struct Todo: Decodable { // Required properties make the failures easy to trigger.
        let id: Int // Must be a JSON number.
        let title: String // Must be present and a string.
    }

    /// The four inputs, in the course's order.
    static let inputs = [ // Each one triggers a different branch.
        "{\"id\": 1, \"title\": \"Walk the dog\"}", // Valid: decodes.
        "{\"id\": 2}", // No title: keyNotFound.
        "{\"id\": \"3\", \"title\": \"Read\"}", // A quoted id: typeMismatch.
        "{\"id\": 4, \"title\": ", // Cut off mid-way: not valid JSON.
    ]

    /// Tries to decode one JSON string and prints what happened. The course's check(_:).
    static func check(_ json: String, into out: inout Transcript) { // inout: it adds lines to the caller's transcript.
        do { // Errors thrown inside flow to the catch clauses.
            let data = Data(json.utf8) // Same first step as with a real response.
            let todo = try JSONDecoder().decode(Todo.self, from: data) // Returns a Todo or throws.
            out.print("Decoded:", todo.title) // Runs only on success.
        } catch DecodingError.keyNotFound(let key, _) { // A required key is missing.
            out.print("Missing key:", key.stringValue) // stringValue is the JSON key text.
        } catch DecodingError.typeMismatch(let type, let context) { // A value of the wrong JSON type.
            let path = context.codingPath.map { $0.stringValue } // The route to the bad value, as strings.
            out.print("Wrong type at \(path): expected \(type)") // For example: Wrong type at ["id"]: expected Int
        } catch { // Every other error, bound automatically as error.
            out.print("Not valid JSON") // The text could not be parsed at all.
        }
    }

    /// Runs all four calls and returns what they printed.
    static func run() -> [String] { // Never throws: check handles every error itself.
        var out = Transcript() // Collects the printed lines.
        for json in inputs { check(json, into: &out) } // & passes the transcript so check can add to it.
        return out.lines // Everything printed, in order.
    }
}

/// The decoder lab: decode any JSON text into a to-do model and explain the result.
enum DecoderLab { // A namespace for the lab.
    /// The model with a required title.
    struct RequiredTitle: Decodable { let userId: Int; let id: Int; let title: String; let completed: Bool } // Matches GET /todos/1.
    /// The same model with an optional title, so null or a missing title decodes as nil.
    struct OptionalTitle: Decodable { let userId: Int; let id: Int; let title: String?; let completed: Bool } // The only difference is String?.

    /// Ready-made edits of the sample JSON, one per kind of failure.
    enum Edit: String, CaseIterable, Identifiable { // The raw value labels the button.
        case original = "Original" // The real reply.
        case missingKey = "Delete title" // keyNotFound.
        case quotedNumber = "Quote the id" // typeMismatch.
        case nullValue = "Title is null" // valueNotFound, unless the property is optional.
        case array = "Wrap in [ ]" // typeMismatch: an array where an object was expected.
        case truncated = "Cut it short" // dataCorrupted: not valid JSON.
        var id: String { rawValue } // The label doubles as the identity.

        /// The JSON text for this edit.
        var json: String { // Each is a small change to the real reply.
            switch self { // One string per edit.
            case .original: #"{"userId": 1, "id": 1, "title": "delectus aut autem", "completed": false}"# // Unchanged.
            case .missingKey: #"{"userId": 1, "id": 1, "completed": false}"# // No title key.
            case .quotedNumber: #"{"userId": 1, "id": "1", "title": "delectus aut autem", "completed": false}"# // "1" is a string.
            case .nullValue: #"{"userId": 1, "id": 1, "title": null, "completed": false}"# // An explicit null.
            case .array: #"[{"userId": 1, "id": 1, "title": "delectus aut autem", "completed": false}]"# // A list of one.
            case .truncated: #"{"userId": 1, "id": 1, "title": "delec"# // Stops mid-string.
            }
        }
    }

    /// Decodes the text and returns a sentence that names the outcome exactly.
    static func decode(_ json: String, titleIsOptional: Bool) -> String { // Pure: same input, same sentence.
        let data = Data(json.utf8) // Text to bytes.
        do { // The decode may throw.
            if titleIsOptional { // The String? model.
                let todo = try JSONDecoder().decode(OptionalTitle.self, from: data) // nil is allowed for title.
                return "Decoded: id \(todo.id), title \(todo.title.map { "\"\($0)\"" } ?? "nil"), completed \(todo.completed)" // nil shows as nil.
            }
            let todo = try JSONDecoder().decode(RequiredTitle.self, from: data) // title must be a string.
            return "Decoded: id \(todo.id), title \"\(todo.title)\", completed \(todo.completed)" // Every field, typed.
        } catch let error as DecodingError { // Only decoding errors land here.
            return explain(error) // Names the case, the path and the message.
        } catch { // JSONDecoder throws only DecodingError, but Swift needs a complete catch.
            return "Unexpected error: \(error)" // Never seen in practice.
        }
    }

    /// Names a DecodingError's case, its coding path and its message, the way the course's lab does.
    static func explain(_ error: DecodingError) -> String { // Pure, so tests can check each case.
        func path(_ context: DecodingError.Context) -> String { // The route to the problem, such as ["id"].
            "[" + context.codingPath.map { "\"\($0.stringValue)\"" }.joined(separator: ", ") + "]" // Formatted like a Swift array of strings.
        }
        switch error { // One branch per DecodingError case.
        case .keyNotFound(let key, let context): // A required key is absent.
            return "keyNotFound: \"\(key.stringValue)\" at \(path(context)). \(context.debugDescription)" // Names the missing key.
        case .typeMismatch(let type, let context): // The value has the wrong JSON type.
            return "typeMismatch: expected \(type) at \(path(context)). \(context.debugDescription)" // Names the expected type.
        case .valueNotFound(let type, let context): // The key exists but holds null.
            return "valueNotFound: expected \(type) at \(path(context)). \(context.debugDescription)" // Names the type that was wanted.
        case .dataCorrupted(let context): // The text is not valid JSON.
            return "dataCorrupted at \(path(context)). The text is not valid JSON." // Foundation's own message lists details in a random order, so we keep ours fixed.
        @unknown default: // Cases Apple might add later.
            return "Another decoding error: \(error)" // Still says something.
        }
    }
}

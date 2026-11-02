// HTTPBasics.swift
// Who: Lesson 8.2's screen and its unit tests.
// What: URL building with URLComponents (and the string-gluing mistake it
//       prevents), facts about each HTTP method, status code families, the
//       course's POST request builder, a printer that shows a URLRequest as raw
//       HTTP text, and the presets of the request builder.
// Where: the Models folder; nothing here touches the network by itself.
// When: whenever the student types, picks a method or builds a request.
// Why: these are pure functions of their inputs, so the tests can check every
//      rule the lesson states, exactly.

import Foundation // URLComponents, URLQueryItem, URLRequest and JSONEncoder.

/// Builds a search URL for JSONPlaceholder's posts, the way the course's searchURL(for:) does.
/// The course example searches a weather service; this app uses the practice API instead.
func searchURL(for text: String) -> URL? { // Returns nil if the parts cannot form a URL.
    var parts = URLComponents() // An empty set of URL parts to fill in.
    parts.scheme = "https" // The encrypted form of HTTP; App Transport Security expects it.
    parts.host = "jsonplaceholder.typicode.com" // The server's name, which DNS turns into an address.
    parts.path = "/posts" // Which resource: the posts collection.
    parts.queryItems = [ // Name and value pairs after the ?.
        URLQueryItem(name: "q", value: text), // The user's text, percent-encoded by URLComponents.
        URLQueryItem(name: "_limit", value: "5"), // Asks for at most five matches.
    ]
    return parts.url // Assembles and encodes the final URL.
}

/// The mistake the lesson warns about: gluing user text onto a URL string.
func naiveSearchURL(for text: String) -> URL? { // Shown side by side with searchURL(for:).
    URL(string: "https://jsonplaceholder.typicode.com/posts?q=" + text) // An & in the text splits it into two items.
}

/// The query items a server would read from a URL, as "name = value" lines.
func queryPairs(of url: URL?) -> [String] { // Shows what actually arrives at the server.
    guard let url, let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems else { return [] } // No URL or no query: nothing to show.
    return items.map { "\($0.name) = \"\($0.value ?? "(no value)")\"" } // Quotes make stray spaces visible.
}

/// The five HTTP methods the lesson covers, with the two properties that matter for retries.
enum HTTPMethod: String, CaseIterable, Identifiable { // The raw value is the method's name on the wire.
    case get = "GET" // Read a resource.
    case post = "POST" // Create something or trigger an action.
    case put = "PUT" // Replace a resource.
    case patch = "PATCH" // Change some fields of a resource.
    case delete = "DELETE" // Remove a resource.
    var id: String { rawValue } // The name doubles as the identity.

    /// Safe: only reads; changes nothing on the server.
    var isSafe: Bool { self == .get } // Of these five, only GET is safe.

    /// Idempotent: the same effect whether it is sent once or five times.
    var isIdempotent: Bool { self == .get || self == .put || self == .delete } // POST and PATCH are not.

    /// Whether the request normally carries a body.
    var sendsBody: Bool { self == .post || self == .put || self == .patch } // GET and DELETE do not.

    /// The course's one-line description.
    var summary: String { // Shown under the picker.
        switch self { // One sentence per method.
        case .get: "Read a resource. Safe and idempotent, so retrying is always fine. No body." // GET.
        case .post: "Create something or trigger an action. Neither safe nor idempotent: sending it twice may place two orders." // POST.
        case .put: "Replace a resource with the body you send. Idempotent: the end state is the same however often it runs." // PUT.
        case .patch: "Change some fields of a resource. Not guaranteed to be idempotent (\"add 1 to the count\" is a patch)." // PATCH.
        case .delete: "Remove a resource. Idempotent: once it is gone, deleting again leaves it gone, even if the reply is 404." // DELETE.
        }
    }

    /// The lesson's rule of thumb: may an app resend this automatically after a timeout?
    var mayRetryAutomatically: Bool { isIdempotent } // Retry GET, PUT and DELETE; never blindly retry POST or PATCH.
}

/// The family a status code belongs to, decided by its first digit.
enum StatusFamily: String, Equatable { // The raw value is the family's heading.
    case informational = "1xx Informational" // Rare in app code.
    case success = "2xx Success" // It worked.
    case redirection = "3xx Redirection" // Look elsewhere, or use your cached copy.
    case clientError = "4xx Client error" // The request was wrong.
    case serverError = "5xx Server error" // The server failed.
    case unknown = "Not an HTTP status" // Anything outside 100...599.

    /// Classifies any code, even one the app has never seen.
    init(code: Int) { // The first digit is all that matters.
        switch code { // Ranges match whole families at once.
        case 100..<200: self = .informational // 1xx.
        case 200..<300: self = .success // 2xx.
        case 300..<400: self = .redirection // 3xx.
        case 400..<500: self = .clientError // 4xx.
        case 500..<600: self = .serverError // 5xx.
        default: self = .unknown // Not a valid status code.
        }
    }

    /// What an app should usually do for a code in this family.
    var appReaction: String { // Shown under the family heading.
        switch self { // One sentence per family.
        case .informational: "URLSession handles these for you; your code rarely sees them." // 1xx.
        case .success: "Read the body and show the result." // 2xx.
        case .redirection: "URLSession follows 301 and 302 for you; 304 means the cached copy is still good." // 3xx.
        case .clientError: "Fix the request or ask the user: sign in again for 401, slow down for 429." // 4xx.
        case .serverError: "Often temporary: show a calm message and retry later, honoring Retry-After." // 5xx.
        case .unknown: "Treat it as a failure; it is not a status the HTTP standard defines." // Anything else.
        }
    }

    /// Whether a retry later could reasonably succeed for this code.
    static func isWorthRetrying(_ code: Int) -> Bool { // 5xx, 408 and 429 are temporary by nature.
        StatusFamily(code: code) == .serverError || code == 408 || code == 429 // Everything else will fail the same way again.
    }
}

/// The JSON body of a new to-do: exactly the course's NewTodo.
struct NewTodo: Encodable { // Encodable is all a request body needs.
    let title: String // Becomes "title" in the JSON.
    let completed: Bool // Becomes "completed": true or false.
    let userId: Int // Becomes "userId": a JSON number.
}

/// Builds, but does not send, a POST request that creates a to-do. This is the course's makeCreateRequest(title:).
func makeCreateRequest(title: String) throws -> URLRequest { // throws because encoding can fail.
    let url = URL(string: "https://jsonplaceholder.typicode.com")! // The server's base URL, a literal we control.
        .appending(path: "todos") // Adds /todos: the collection URL.
    var request = URLRequest(url: url) // Defaults: GET, no headers, no body, 60-second timeout.
    request.httpMethod = "POST" // POST asks the collection to create a new member.
    request.setValue("application/json", // The body is JSON...
                     forHTTPHeaderField: "Content-Type") // ...so the server knows how to parse it.
    request.setValue("application/json", // We can read JSON...
                     forHTTPHeaderField: "Accept") // ...so please answer in JSON.
    let todo = NewTodo(title: title, completed: false, userId: 1) // A typed body: the compiler catches misspelled keys.
    request.httpBody = try JSONEncoder().encode(todo) // The body must be Data, and JSONEncoder produces exactly that.
    request.timeoutInterval = 15 // Gives up after 15 seconds of silence instead of 60.
    return request // A value: the caller gets its own copy.
}

/// Shows a URLRequest as the text an HTTP/1.1 client would send.
func rawRequestText(_ request: URLRequest) -> String { // The anatomy card prints this.
    guard let url = request.url else { return "(no URL)" } // A request without a URL cannot be printed.
    let components = URLComponents(url: url, resolvingAgainstBaseURL: false) // Splits the URL into its parts.
    var target = components?.percentEncodedPath ?? "/" // The path, still encoded, as it travels.
    if target.isEmpty { target = "/" } // An empty path means the root.
    if let query = components?.percentEncodedQuery { target += "?" + query } // The query travels after the path.
    var lines = ["\(request.httpMethod ?? "GET") \(target) HTTP/1.1"] // The request line: method, target, version.
    lines.append("Host: \(url.host() ?? "")") // Host is always the first header.
    let headers = (request.allHTTPHeaderFields ?? [:]).sorted { $0.key < $1.key } // Our headers, alphabetically.
    lines += headers.map { "\($0.key): \($0.value)" } // One "Name: value" line each.
    if let body = request.httpBody, !body.isEmpty { // Only POST, PUT and PATCH usually have a body.
        lines.append("") // A blank line separates headers from the body.
        lines.append(String(decoding: body, as: UTF8.self)) // The body as text.
    }
    return lines.joined(separator: "\n") // One string, one line per part.
}

/// The ready-made requests of the request builder card.
enum RequestPreset: String, CaseIterable, Identifiable { // The raw value is the label in the picker.
    case readTodo = "GET /todos/1" // One to-do.
    case missing = "GET /todos/99999" // A to-do that does not exist: 404.
    case create = "POST /todos" // Create a to-do: 201.
    case replace = "PUT /todos/1" // Replace to-do 1.
    case change = "PATCH /todos/1" // Change one field of to-do 1.
    case remove = "DELETE /todos/1" // Remove to-do 1.
    var id: String { rawValue } // The label doubles as the identity.

    /// The method of this preset.
    var method: HTTPMethod { // Read from the label's first word.
        switch self { // One method per preset.
        case .readTodo, .missing: .get // Reads.
        case .create: .post // Creates.
        case .replace: .put // Replaces.
        case .change: .patch // Changes.
        case .remove: .delete // Removes.
        }
    }

    /// The path after the base URL.
    var path: String { String(rawValue.split(separator: " ")[1].dropFirst()) } // "GET /todos/1" becomes "todos/1".

    /// The JSON body this preset sends, if any.
    var body: String? { // nil for GET and DELETE.
        switch self { // Only the three writing methods carry a body.
        case .create: #"{"title": "Read chapter 8", "completed": false, "userId": 1}"# // A whole new to-do.
        case .replace: #"{"id": 1, "title": "Replaced title", "completed": true, "userId": 1}"# // A whole replacement.
        case .change: #"{"completed": true}"# // Just the field that changes.
        default: nil // No body.
        }
    }

    /// The URLRequest this preset describes, with headers set the way the lesson recommends.
    var request: URLRequest { // Built fresh each time it is read.
        var request = URLRequest(url: Placeholder.url(path)) // The full URL.
        request.httpMethod = method.rawValue // The verb.
        request.setValue("application/json", forHTTPHeaderField: "Accept") // We read JSON.
        if let body { // Only when this preset sends a body.
            request.setValue("application/json", forHTTPHeaderField: "Content-Type") // Describes the body we send.
            request.httpBody = Data(body.utf8) // The body as bytes.
        }
        request.timeoutInterval = 15 // A user waiting on a button should not wait a minute.
        return request // The finished request.
    }
}

/// The Swift code that would build a request like this one, for the builder card.
func swiftCode(for request: URLRequest) -> String { // Mirrors the course's URLRequest examples.
    var lines = [#"var request = URLRequest(url: URL(string: "\#(request.url?.absoluteString ?? "")")!)"#] // Creates the request.
    lines.append(#"request.httpMethod = "\#(request.httpMethod ?? "GET")""#) // Sets the verb.
    for (name, value) in (request.allHTTPHeaderFields ?? [:]).sorted(by: { $0.key < $1.key }) { // One line per header.
        lines.append(#"request.setValue("\#(value)", forHTTPHeaderField: "\#(name)")"#) // setValue replaces any earlier value.
    }
    if let body = request.httpBody, !body.isEmpty { // Only when there is a body.
        lines.append("request.httpBody = Data(#\"\(String(decoding: body, as: UTF8.self))\"#.utf8)") // The body as a raw string literal.
    }
    lines.append("let (data, response) = try await URLSession.shared.data(for: request)") // Sends it.
    return lines.joined(separator: "\n") // One string, one line of code per line.
}

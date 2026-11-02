// Lesson82Tests.swift
// Who: the Swift Testing runner.
// What: checks lesson 8.2's rules: URL encoding with URLComponents (and the
//       string-gluing mistake), method properties, status families, the
//       course's POST builder, the raw request printer and the builder presets.
// Where: the NetworkLabTests target.
// When: only when tests run.
// Why: each rule the lesson states becomes an exact, checkable expectation.

import Testing // @Test, #expect and #require.
import Foundation // URL, URLRequest and JSONSerialization.
@testable import NetworkLab // The app's internal types.

@MainActor // The app's types are main-actor isolated.
struct Lesson82Tests { // Speaking HTTP.
    @Test(arguments: [ // Inputs from the course and its quiz, with the URLs URLComponents builds.
        ("São Paulo", "https://jsonplaceholder.typicode.com/posts?q=S%C3%A3o%20Paulo&_limit=5"), // Accents and spaces are percent-encoded.
        ("salt & pepper", "https://jsonplaceholder.typicode.com/posts?q=salt%20%26%20pepper&_limit=5"), // & becomes %26.
        ("rock+roll", "https://jsonplaceholder.typicode.com/posts?q=rock+roll&_limit=5"), // + is left alone.
        ("a=b", "https://jsonplaceholder.typicode.com/posts?q=a%3Db&_limit=5"), // = inside a value is encoded.
    ])
    func searchURLEncodesUserText(text: String, expected: String) { // One check per input.
        #expect(searchURL(for: text)?.absoluteString == expected) // Exactly the encoded URL.
        #expect(queryPairs(of: searchURL(for: text)).first == "q = \"\(text)\"") // The server reads the whole text back as one value.
    }

    @Test func gluingStringsSplitsTheQuery() { // The quiz's salt & pepper mistake.
        let pairs = queryPairs(of: naiveSearchURL(for: "salt & pepper")) // What the server would read.
        #expect(pairs == ["q = \"salt \"", " pepper = \"(no value)\""]) // q is "salt " and a stray second item appears.
        #expect(queryPairs(of: nil) == []) // No URL, nothing to read.
    }

    @Test func methodPropertiesMatchTheLesson() { // Safe, idempotent, body.
        #expect(HTTPMethod.allCases.filter(\.isSafe) == [.get]) // Only GET is safe.
        #expect(HTTPMethod.allCases.filter(\.isIdempotent) == [.get, .put, .delete]) // POST and PATCH are not idempotent.
        #expect(HTTPMethod.allCases.filter(\.sendsBody) == [.post, .put, .patch]) // The writing methods carry a body.
        #expect(HTTPMethod.allCases.filter(\.mayRetryAutomatically) == [.get, .put, .delete]) // The rule of thumb.
        #expect(HTTPMethod.post.summary.contains("two orders")) // The course's warning.
    }

    @Test(arguments: [(100, StatusFamily.informational), (204, .success), (304, .redirection), (404, .clientError), (422, .clientError), (503, .serverError), (600, .unknown), (42, .unknown)]) // Each family and both edges.
    func statusFamilies(code: Int, family: StatusFamily) { // The first digit decides.
        #expect(StatusFamily(code: code) == family) // Classified correctly.
    }

    @Test func onlyTemporaryStatusesAreWorthRetrying() { // 5xx, 408 and 429.
        #expect([500, 502, 503, 408, 429].allSatisfy(StatusFamily.isWorthRetrying)) // Temporary.
        #expect(![200, 400, 401, 404, 422].contains(where: StatusFamily.isWorthRetrying)) // Will fail the same way again.
        #expect(StatusFamily.serverError.rawValue == "5xx Server error") // The heading on screen.
    }

    @Test func makeCreateRequestBuildsTheCoursePOST() throws { // The course's function.
        let request = try makeCreateRequest(title: "Read chapter 8") // Build, do not send.
        #expect(request.url?.absoluteString == "https://jsonplaceholder.typicode.com/todos") // appending(path:) added /todos.
        #expect(request.httpMethod == "POST") // Changed from GET.
        #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json") // Describes the body.
        #expect(request.value(forHTTPHeaderField: "Accept") == "application/json") // Asks for JSON back.
        #expect(request.timeoutInterval == 15) // Shorter than the 60-second default.
        let body = try #require(request.httpBody) // The body exists.
        let json = try #require(try JSONSerialization.jsonObject(with: body) as? [String: Any]) // It is a JSON object.
        #expect(json["title"] as? String == "Read chapter 8") // The typed title.
        #expect(json["completed"] as? Bool == false) // A new to-do is not done.
        #expect(json["userId"] as? Int == 1) // The course's user.
    }

    @Test func rawRequestTextShowsTheCourseAnatomy() { // GET /todos/1 with Accept.
        var request = URLRequest(url: Placeholder.url("todos/1")) // One to-do.
        request.setValue("application/json", forHTTPHeaderField: "Accept") // We read JSON.
        #expect(rawRequestText(request) == "GET /todos/1 HTTP/1.1\nHost: jsonplaceholder.typicode.com\nAccept: application/json") // Exactly the course's three lines.
    }

    @Test func rawRequestTextIncludesQueryAndBody() throws { // The other parts.
        let search = URLRequest(url: try #require(searchURL(for: "a b"))) // A URL with a query.
        #expect(rawRequestText(search).hasPrefix("GET /posts?q=a%20b&_limit=5 HTTP/1.1")) // The query travels after the path, still encoded.
        let post = rawRequestText(try makeCreateRequest(title: "x")).components(separatedBy: "\n") // The POST, line by line.
        #expect(Array(post.prefix(5)) == ["POST /todos HTTP/1.1", "Host: jsonplaceholder.typicode.com", "Accept: application/json", "Content-Type: application/json", ""]) // Headers sorted, then a blank line.
        #expect(post.last?.contains("\"title\":\"x\"") == true) // Then the JSON body.
        #expect(rawRequestText(URLRequest(url: URL(string: "https://example.com")!)).hasPrefix("GET / HTTP/1.1")) // An empty path means the root.
    }

    @Test func requestPresetsBuildTheRightRequests() { // The builder card's six requests.
        #expect(RequestPreset.readTodo.path == "todos/1") // The path after the base.
        #expect(RequestPreset.missing.path == "todos/99999") // The 404.
        #expect(RequestPreset.create.method == .post) // Creates.
        #expect(RequestPreset.change.request.httpMethod == "PATCH") // The verb is set.
        #expect(RequestPreset.change.request.value(forHTTPHeaderField: "Content-Type") == "application/json") // A body needs Content-Type.
        #expect(RequestPreset.remove.request.httpBody == nil) // DELETE has no body.
        #expect(RequestPreset.remove.request.value(forHTTPHeaderField: "Content-Type") == nil) // So no Content-Type either.
        #expect(RequestPreset.replace.body?.contains("\"id\": 1") == true) // PUT replaces the whole to-do.
        #expect(RequestPreset.allCases.allSatisfy { $0.request.timeoutInterval == 15 }) // Short timeouts for buttons.
    }

    @Test func swiftCodeMirrorsTheRequest() { // The builder's code panel.
        let code = swiftCode(for: RequestPreset.change.request) // PATCH with a body.
        #expect(code.contains(#"request.httpMethod = "PATCH""#)) // The verb.
        #expect(code.contains(#"request.setValue("application/json", forHTTPHeaderField: "Content-Type")"#)) // A header.
        #expect(code.contains(##"request.httpBody = Data(#"{"completed": true}"#.utf8)"##)) // The body; ## lets the text contain "#.
        #expect(code.hasSuffix("let (data, response) = try await URLSession.shared.data(for: request)")) // Then it is sent.
    }
}

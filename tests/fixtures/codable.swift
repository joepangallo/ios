import Foundation
struct Todo: Codable {
    let id: Int
    var title: String
    var done: Bool
    var tags: [String]
    var note: String?
}
let todo = Todo(id: 1, title: "Learn Swift", done: false, tags: ["school"], note: nil)
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
let data = try encoder.encode(todo)
print(String(data: data, encoding: .utf8)!)
let json = """
{"id": 2, "title": "Ship app", "done": true, "tags": [], "note": "soon"}
"""
let decoded = try JSONDecoder().decode(Todo.self, from: Data(json.utf8))
print(decoded.title, decoded.done, decoded.note ?? "none")
struct Weather: Codable {
    let tempC: Double
    let windSpeed: Double
    enum CodingKeys: String, CodingKey {
        case tempC = "temperature_2m"
        case windSpeed = "wind_speed_10m"
    }
}
let w = try JSONDecoder().decode(Weather.self, from: Data(#"{"temperature_2m": 21.5, "wind_speed_10m": 9}"#.utf8))
print(w.tempC, w.windSpeed)
do {
    _ = try JSONDecoder().decode(Todo.self, from: Data(#"{"id": 3}"#.utf8))
} catch {
    print(error)
}
let list = try JSONDecoder().decode([Todo].self, from: Data("[]".utf8))
print(list.count)

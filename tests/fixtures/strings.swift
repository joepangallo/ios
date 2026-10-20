import Foundation
let s = "Hello, Swift"
print(s.count, s.uppercased(), s.lowercased(), s.hasPrefix("Hell"), s.contains("Swift"))
print(s.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) })
print(s.replacingOccurrences(of: "Swift", with: "World"))
print(String(s.reversed()), s.first!, s.last!)
let multi = """
    Line one
      indented
    Line three
    """
print(multi)
var greeting = "Hi"
greeting += " there"
greeting.append("!")
print(greeting, greeting.isEmpty)
let num = 42
print("\(num) is \(num % 2 == 0 ? "even" : "odd")")
print(String(format: "%.1f%%", 12.345), String(format: "%05d", 42))
let csv = "a,b,,c"
print(csv.components(separatedBy: ","))
print("swift".prefix(3), "swift".dropFirst(2), Array("abc"))
let idx = s.index(s.startIndex, offsetBy: 7)
print(s[idx], s[idx...])
print("A" < "B", "apple" < "banana", "Zed".lowercased())
for (i, c) in "abc".enumerated() { print(i, c) }
print("tab\there", "quote\"q\"")
let word = "level"
print(word == String(word.reversed()))
print("12".count, Int("12")! + 1, Double("2.5")! * 2)
let chars = "Hello World".filter { $0.isUppercase }
print(chars)
print("one two  three".split(separator: " ").count)

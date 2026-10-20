import Foundation
let name = "Ana"
var age = 20
age += 1
print("Hello, \(name)! You are \(age).")
let scores = [90, 85.5, 77]
print(scores, scores.count)
let avg = scores.reduce(0, +) / Double(scores.count)
print(String(format: "%.2f", avg))
for (i, s) in scores.enumerated() where s > 80 {
    print(i, s)
}
struct Point {
    var x: Int
    var y: Int
    mutating func move(by d: Int) {
        x += d
        y += d
    }
    var sum: Int { x + y }
}
var p = Point(x: 1, y: 2)
let q = p
p.move(by: 5)
print(p, q, p.sum)
enum Dir: String, CaseIterable {
    case north, south = "S"
}
print(Dir.north, Dir.south.rawValue, Dir.allCases.count, Dir(rawValue: "S") == .south)
let maybe: Int? = Int("42")
if let m = maybe {
    print("got", m)
}
print(maybe as Any, maybe ?? 0)
func greet(_ who: String, times: Int = 2) -> String {
    String(repeating: who, count: times)
}
print(greet("ab"), greet("x", times: 3))
let sorted = [3, 1, 2].sorted { $0 > $1 }
print(sorted, [1, 2, 3].map { $0 * 2 }.filter { $0 > 2 })
switch age {
case 0..<13: print("child")
case 13...19: print("teen")
default: print("adult")
}
class Animal {
    var name: String
    init(name: String) { self.name = name }
    func speak() -> String { "..." }
}
class Dog: Animal {
    override func speak() -> String { "\(name) says woof" }
}
let d = Dog(name: "Rex")
print(d.speak())
let a2 = d
a2.name = "Max"
print(d.name)

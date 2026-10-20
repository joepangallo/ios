func area(width: Double, height: Double) -> Double { width * height }
print(area(width: 3, height: 4.5))
func greet(_ name: String, from city: String = "Tampa") -> String {
    "Hi \(name) from \(city)"
}
print(greet("Ana"), greet("Bo", from: "Miami"))
func stats(_ values: Int...) -> (min: Int, max: Int, avg: Double) {
    let total = values.reduce(0, +)
    return (values.min()!, values.max()!, Double(total) / Double(values.count))
}
let s = stats(4, 8, 6)
print(s.min, s.max, s.avg, s)
func double(_ x: inout Int) { x *= 2 }
var v = 21
double(&v)
print(v)
func makeCounter() -> () -> Int {
    var count = 0
    return {
        count += 1
        return count
    }
}
let next = makeCounter()
print(next(), next(), next())
func apply(_ f: (Int) -> Int, to x: Int) -> Int { f(x) }
print(apply({ $0 * $0 }, to: 7))
func factorial(_ n: Int) -> Int { n <= 1 ? 1 : n * factorial(n - 1) }
print(factorial(10))
let add: (Int, Int) -> Int = (+)
print(add(2, 3))
func fib(_ n: Int) -> Int {
    if n < 2 { return n }
    return fib(n - 1) + fib(n - 2)
}
print((0..<10).map(fib))
let shout = { (s: String) -> String in s.uppercased() + "!" }
print(shout("hey"))
let sortedNames = ["bo", "Al", "cy"].sorted { a, b in a.lowercased() < b.lowercased() }
print(sortedNames)
func outer() -> Int {
    func inner(_ x: Int) -> Int { x + 1 }
    return inner(41)
}
print(outer())

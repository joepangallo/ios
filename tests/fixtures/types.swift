struct Account: CustomStringConvertible {
    let owner: String
    private(set) var balance: Double = 0
    static var count = 0
    init(owner: String) {
        self.owner = owner
        Account.count += 1
    }
    mutating func deposit(_ amount: Double) {
        guard amount > 0 else { return }
        balance += amount
    }
    var description: String { "\(owner): $\(balance)" }
}
var acct = Account(owner: "Ana")
acct.deposit(50)
acct.deposit(-5)
print(acct, Account.count)
class Shape {
    var name: String { "shape" }
    func area() -> Double { 0 }
    func describe() -> String { "\(name) with area \(area())" }
}
class Circle: Shape {
    let r: Double
    init(r: Double) { self.r = r }
    override var name: String { "circle" }
    override func area() -> Double { 3.0 * r * r }
}
final class Square: Shape {
    var side = 2.0
    override var name: String { "square" }
    override func area() -> Double { side * side }
}
let shapes: [Shape] = [Circle(r: 1), Square()]
for sh in shapes { print(sh.describe()) }
print(shapes[0] is Circle, shapes[1] as? Circle == nil)
enum Barcode {
    case upc(Int, Int)
    case qr(String)
}
let codes = [Barcode.upc(8, 85909), .qr("ABC")]
for code in codes {
    switch code {
    case .upc(let sys, let maker): print("UPC", sys, maker)
    case .qr(let text): print("QR", text)
    }
}
enum Planet: Int { case mercury = 1, venus, earth }
print(Planet.earth.rawValue, Planet(rawValue: 2) == .venus)
enum Status {
    case idle, loading, failed(message: String)
    var label: String {
        switch self {
        case .idle: return "Idle"
        case .loading: return "Loading"
        case .failed(let m): return "Failed: \(m)"
        }
    }
}
print(Status.failed(message: "timeout").label, Status.idle)
protocol Describable { var summary: String { get } }
extension Describable { func show() { print("[\(summary)]") } }
struct Book: Describable { var title: String; var summary: String { "Book: \(title)" } }
Book(title: "Swift").show()
extension Int { var squared: Int { self * self } }
print(7.squared)
struct Stack<Element> {
    private var items: [Element] = []
    mutating func push(_ x: Element) { items.append(x) }
    mutating func pop() -> Element? { items.popLast() }
    var isEmpty: Bool { items.isEmpty }
}
var st = Stack<String>()
st.push("a"); st.push("b")
print(st.pop() ?? "-", st.isEmpty)
func largest<T: Comparable>(_ xs: [T]) -> T? { xs.max() }
print(largest([3, 9, 2]) ?? 0, largest(["b", "a"]) ?? "")
struct Temp: Comparable {
    var c: Double
    static func < (a: Temp, b: Temp) -> Bool { a.c < b.c }
}
print([Temp(c: 30), Temp(c: 10)].sorted().map { $0.c })

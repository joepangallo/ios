var nickname: String? = nil
print(nickname as Any)
nickname = "Ace"
print(nickname as Any)
if let nickname {
    print("Nickname is \(nickname)")
}
func lookup(_ id: Int) -> String? {
    id == 1 ? "Ana" : nil
}
let names = [1, 2].map { lookup($0) ?? "unknown" }
print(names)
struct User { var email: String? }
let u: User? = User(email: "a@b.com")
print(u?.email?.count ?? 0)
let none: User? = nil
print(none?.email?.count as Any)
guard let first = lookup(1) else { fatalError() }
print(first.uppercased())
let parsed = ["1", "x", "3"].compactMap { Int($0) }
print(parsed)
let dict = ["a": 1]
print(dict["a"] as Any, dict["z"] as Any, dict["z", default: 0])
var count: Int? = 5
count? += 1
print(count!)
if case .some(let c) = count, c > 3 { print("big", c) }
let opt: Int? = nil
switch opt {
case .none: print("none")
case .some(let v): print(v)
}
print(Optional(3).map { $0 * 2 } as Any)

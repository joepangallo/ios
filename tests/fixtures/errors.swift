enum VendingError: Error {
    case invalidSelection
    case insufficientFunds(coinsNeeded: Int)
    case outOfStock
}
struct Machine {
    var stock = ["chips": 2]
    var coins = 5
    mutating func vend(_ item: String) throws -> String {
        guard let count = stock[item] else { throw VendingError.invalidSelection }
        guard count > 0 else { throw VendingError.outOfStock }
        guard coins >= 3 else { throw VendingError.insufficientFunds(coinsNeeded: 3 - coins) }
        coins -= 3
        stock[item] = count - 1
        return item
    }
}
var m = Machine()
for item in ["chips", "chips", "soda"] {
    do {
        let got = try m.vend(item)
        print("Got", got)
    } catch VendingError.insufficientFunds(let need) {
        print("Need \(need) more coins")
    } catch {
        print("Error:", error)
    }
}
let r = try? m.vend("soda")
print(r as Any)
func parse(_ s: String) throws -> Int {
    guard let n = Int(s) else { throw VendingError.invalidSelection }
    return n
}
let results: [Result<Int, Error>] = ["1", "x"].map { s in Result { try parse(s) } }
for res in results {
    switch res {
    case .success(let n): print("ok", n)
    case .failure(let e): print("fail", e)
    }
}
func work() {
    defer { print("cleanup") }
    print("working")
}
work()
do {
    throw VendingError.outOfStock
} catch let e as VendingError {
    print("caught", e)
}

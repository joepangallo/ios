func fetch(_ name: String, seconds: Int) async -> String {
    try? await Task.sleep(for: .seconds(seconds))
    print("finished \(name)")
    return name.uppercased()
}
func sequential() async {
    let a = await fetch("a", seconds: 2)
    let b = await fetch("b", seconds: 1)
    print("sequential:", a, b)
}
func parallel() async {
    async let a = fetch("c", seconds: 2)
    async let b = fetch("d", seconds: 1)
    let results = await [a, b]
    print("parallel:", results)
}
actor Counter {
    private var value = 0
    func increment() -> Int {
        value += 1
        return value
    }
}
await sequential()
await parallel()
let counter = Counter()
for _ in 1...3 { _ = await counter.increment() }
print(await counter.increment())
let task = Task { () -> Int in
    try? await Task.sleep(for: .milliseconds(100))
    return 99
}
print(await task.value)
let total = await withTaskGroup(of: Int.self) { group in
    for i in 1...3 {
        group.addTask { i * 10 }
    }
    var sum = 0
    for await v in group { sum += v }
    return sum
}
print(total)

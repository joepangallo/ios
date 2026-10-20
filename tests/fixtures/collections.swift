var fruits = ["apple", "banana"]
fruits.append("cherry")
fruits.insert("kiwi", at: 0)
print(fruits, fruits.count, fruits[1], fruits.first!, fruits.last ?? "")
let removed = fruits.remove(at: 1)
print(removed, fruits)
print(fruits.contains("kiwi"), fruits.firstIndex(of: "cherry") ?? -1)
var copy = fruits
copy.append("date")
print(fruits.count, copy.count)
var stock = ["apples": 3, "pears": 0]
stock["plums"] = 7
stock["pears"] = nil
for key in stock.keys.sorted() {
    print(key, stock[key]!)
}
print(stock.count, stock.values.reduce(0, +))
let letters: Set = ["a", "b", "c"]
let more: Set = ["b", "c", "d"]
print(letters.intersection(more).sorted(), letters.union(more).count, letters.contains("a"))
let nums = Array(1...10)
print(nums.filter { $0.isMultiple(of: 2) }, nums.prefix(3), nums.suffix(2), nums.dropFirst(8))
print(nums.min()!, nums.max()!, Array(nums.reversed().prefix(2)))
let words = ["swift", "is", "fun"]
print(words.joined(separator: " "), words.map { $0.count }, words.sorted())
let grouped = Dictionary(grouping: words, by: { $0.count })
print(grouped.keys.sorted(), grouped[2]!)
var matrix = [[1, 2], [3, 4]]
matrix[1][0] = 9
print(matrix, matrix.flatMap { $0 })
let pairs = zip(["a", "b"], [1, 2]).map { "\($0)\($1)" }
print(pairs)
var stack: [Int] = []
stack.append(1)
stack.append(2)
print(stack.popLast() as Any, stack)
print(nums.reduce(into: 0) { $0 += $1 }, [3, 1, 2].sorted(by: >))
let total = [1.5, 2.5].reduce(0, +)
print(total)
print(Array(repeating: 0, count: 3), [Int](), [String: Int]().isEmpty)
print(nums.first(where: { $0 > 4 }) as Any, nums.allSatisfy { $0 > 0 }, nums.contains(where: { $0 > 9 }))
var arr = [5, 3, 8]
arr.sort()
arr.swapAt(0, 2)
print(arr, arr.indices, arr.enumerated().map { "\($0.offset):\($0.element)" })

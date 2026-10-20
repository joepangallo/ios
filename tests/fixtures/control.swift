for i in 1...3 { print(i, terminator: " ") }
print()
for i in stride(from: 10, to: 0, by: -3) { print(i, terminator: ",") }
print("")
var n = 0
while n < 3 { n += 1 }
repeat { n -= 1 } while n > 1
print(n)
let point = (2, 0)
switch point {
case (0, 0): print("origin")
case (_, 0): print("on x axis")
case (0, _): print("on y axis")
default: print("elsewhere")
}
let score = 87
let grade: String
switch score {
case 90...: grade = "A"
case 80..<90: grade = "B"
default: grade = "C"
}
print(grade)
let ch: Character = "e"
switch ch {
case "a", "e", "i", "o", "u": print("vowel")
default: print("consonant")
}
outer: for i in 0..<3 {
    for j in 0..<3 {
        if j == 2 { continue outer }
        if i == 2 { break outer }
        print(i, j)
    }
}
let temp = 30
let feel = temp > 25 ? "hot" : "mild"
print(feel)
let x = 5
switch x {
case let v where v % 2 == 0: print("even", v)
case let v: print("odd", v)
}
for c in "hey" { print(c, terminator: "") }
print()
var total = 0
for i in 1...100 where i % 2 == 0 { total += i }
print(total)
let message = if total > 100 { "big" } else { "small" }
print(message)

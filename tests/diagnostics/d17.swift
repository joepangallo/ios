struct Counter {
    var n = 0
    mutating func inc() { n += 1 }
}
let c = Counter()
c.inc()

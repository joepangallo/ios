// GenericExamples.swift
// Who: the 3.5 lesson screen runs these programs and keeps a live Stack;
//      the unit tests check the programs and the Stack's behavior.
// What: the generic programs from the course lesson "Generics: Write It Once,
//       Keep the Types": recent<Item>, Stack<Element>, largest and countMatches
//       with constraints, and Maybe<Wrapped>, a rebuilt Optional.
// Where: the Models folder; Lesson_3_5_Generics.swift is the screen that uses them.
// When: run() executes when the screen draws; the live Stack changes when the
//       student taps push or pop.
// Why: a type parameter lets one piece of code serve many types while the
//      compiler still checks every use. Running the same code with Strings and
//      Ints side by side shows that nothing is lost.

/// Course step "A generic function".
enum AGenericFunction { // A caseless enum used as a namespace for this example.
    /// The newest items first, at most limit of them. Item is the type parameter.
    static func recent<Item>(_ history: [Item], limit: Int) -> [Item] { // Whatever type goes in comes back out.
        history.suffix(limit).reversed() // The last limit items, newest first; never inspects an Item.
    }

    static let searches = ["tacos", "sushi", "pho", "ramen"] // An array of Strings, oldest first.
    static let songIDs = [101, 205, 309, 412, 515] // An array of Ints, oldest first.

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        out.print(recent(searches, limit: 2)) // Item is String: ["ramen", "pho"]
        out.print(recent(songIDs, limit: 3)) // Item is Int: [515, 412, 309]
        return out // Two printed lines.
    }
}

/// Course step "A generic type: Stack". Written at the top level so the screen can keep one in @State.
struct Stack<Element> { // Element is the conventional name for a collection's item type.
    private var items: [Element] = [] // Hidden storage: callers must use push and pop.

    var top: Element? { items.last } // The newest element, or nil when empty.
    var isEmpty: Bool { items.isEmpty } // A question, not the array, so the storage stays private.

    mutating func push(_ item: Element) { // Adds an element on top.
        items.append(item) // The end of the array is the top of the stack.
    }

    mutating func pop() -> Element? { // Removes and returns the top element, or nil.
        items.popLast() // popLast already behaves exactly like a stack's pop.
    }
}

extension Stack { // Two read-only helpers for this app's screen; same file, so they may read the private array.
    var count: Int { items.count } // The course's try item: how many elements are stacked.
    var bottomToTop: [Element] { items } // A copy of the elements for drawing; changing it cannot change the stack.
}

enum AGenericTypeStack { // Namespace for this step's program.
    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        var screens = Stack<String>() // Element is fixed to String for this stack.
        screens.push("Inbox") // The bottom of the stack.
        screens.push("Message") // On top of Inbox.
        screens.push("Attachment") // Now the top.
        out.print(screens.pop() ?? "none") // Attachment: last in, first out.
        out.print(screens.top ?? "none") // Message is on top again.
        var edits = Stack<Int>() // A separate type: a stack of Ints. var, because pop is mutating.
        out.print(edits.isEmpty, edits.pop() == nil) // true true: empty, and popping returns nil.
        return out // Three printed lines.
    }
}

/// Course step "Constraints and where clauses".
enum ConstraintsAndWhereClauses { // Namespace for this step's example.
    /// The largest value, or nil for an empty array. T must be Comparable so > works.
    static func largest<T: Comparable>(_ values: [T]) -> T? { // The constraint sits in the angle brackets.
        guard var best = values.first else { return nil } // An empty array has no largest value.
        for value in values where value > best { // > compiles only because of T: Comparable.
            best = value // A new running maximum.
        }
        return best // The winner, wrapped in an optional.
    }

    /// How many items equal target. The Equatable constraint is written in a where clause.
    static func countMatches<T>(of target: T, in items: [T]) -> Int // The signature, without its constraint...
        where T: Equatable { // ...which follows here, so == is available.
        items.filter { $0 == target }.count // Keep the matches, then count them.
    }

    static let temperatures = [72.5, 88.0, 64.25] // Doubles: T becomes Double.
    static let fruit = ["kiwi", "apple", "mango"] // Strings: T becomes String.
    static let ratings = [5, 4, 5, 3, 5] // Ints: T becomes Int.

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        out.print(largest(temperatures) ?? 0) // 88.0; the fallback 0 is inferred as a Double.
        out.print(largest(fruit) ?? "none") // mango: Strings compare alphabetically.
        out.print(countMatches(of: 5, in: ratings)) // 3 five-star ratings.
        return out // Three printed lines.
    }
}

/// Course step "Optional is a generic enum".
enum OptionalIsAGenericEnum { // Namespace for this step's example.
    enum Maybe<Wrapped> { // The standard library's Optional, rebuilt.
        case none // No value; nil is shorthand for Optional's none.
        case some(Wrapped) // A value is present, carried as an associated value.

        func or(_ fallback: Wrapped) -> Wrapped { // The ?? operator, written as a method.
            switch self { // Unwrapping is pattern matching underneath.
            case .none: return fallback // No value: use the fallback.
            case .some(let value): return value // A value: hand it back.
            }
        }
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        let nickname: Maybe<String> = .none // Wrapped is String; no value.
        let rating: Maybe<Int> = .some(5) // Wrapped is Int; holds 5.
        out.print(nickname.or("Guest"), rating.or(0)) // Guest 5
        let realNickname: Optional<String> = nil // The same as String?.
        let ratings: Array<Int> = [5, 4] // The same as [Int].
        out.print(realNickname ?? "Guest", ratings) // Guest [5, 4]
        return out // Two printed lines.
    }
}

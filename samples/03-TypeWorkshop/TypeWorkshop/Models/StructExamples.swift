// StructExamples.swift
// Who: the 3.1 lesson screen runs these programs and shows what they print;
//      the unit tests run the same programs and check the output.
// What: the six struct programs from the course lesson "Structs: Your Own Value
//       Types", each kept inside a namespace named after its course step.
// Where: the Models folder; Lesson_3_1_Structs.swift is the screen that uses them.
// When: each run() executes when the lesson screen draws its console boxes, and
//       again whenever a test calls it.
// Why: the course examples reuse names such as TodoItem and Playlist. A caseless
//      enum per step keeps each example's types apart, so every program can stay
//      exactly as the course wrote it. The only change: print(...) becomes
//      out.print(...), so the screen and the tests can read what was printed.

import Foundation // String(format:), used by CoffeeOrder.receipt(), lives in Foundation.

/// Course step "Defining a struct": a to-do item with a title, a done flag and an estimate.
enum DefiningAStruct { // A caseless enum is only a namespace: it groups this example and can never be created.
    struct TodoItem { // The course's struct: one named type that groups three values.
        var title: String // Users rename tasks, so the title can change.
        var isDone: Bool // Flipped when the task is checked off.
        let minutes: Int // A let: fixed for the item's whole life.
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines instead of writing to Xcode's console.
        var chore = TodoItem(title: "Buy oat milk", isDone: false, // The memberwise initializer Swift wrote for us.
                             minutes: 15) // The last argument; labels follow the property order.
        out.print(chore.title) // Dot syntax reads one property: Buy oat milk.
        chore.isDone = true // Allowed because chore is a var and isDone is a var.
        out.print(chore.isDone) // The updated flag: true.
        out.print(chore) // Swift's default description: the type name and every stored property.
        return out // Hands the printed lines back to the caller.
    }
}

/// Course step "Computed properties and methods": a coffee order whose price is computed.
enum ComputedPropertiesAndMethods { // Namespace for this step's example.
    struct CoffeeOrder { // Plain data that gets copied around: a natural struct.
        var drink: String // The drink name, such as Latte.
        var shots: Int // The number of espresso shots.
        var hasOatMilk: Bool // Named as an assertion, so order.hasOatMilk reads naturally.

        var price: Double { // A computed property: no storage, the body runs on every read.
            let base = 3.50 // The base price, named so the formula explains itself.
            let extraShots = Double(shots - 1) * 0.75 // 0.75 for every shot after the first; Double(...) converts the Int.
            return base + extraShots + (hasOatMilk ? 0.60 : 0) // The ternary adds 0.60 only with oat milk.
        }

        func receipt() -> String { // A method: a function that belongs to the type.
            let total = String(format: "%.2f", price) // Reads price and keeps exactly two decimals.
            return "\(drink), \(shots) shots: $\(total)" // Interpolation mixes the values into the text.
        }
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        let order = CoffeeOrder(drink: "Latte", shots: 2, hasOatMilk: true) // No price argument: computed properties are not stored.
        out.print(order.price) // Runs the getter: 4.85.
        out.print(order.receipt()) // Calls the method: Latte, 2 shots: $4.85.
        return out // The two printed lines.
    }
}

/// Course step "Mutating methods": a playlist whose add method changes the value it is called on.
enum MutatingMethods { // Namespace for this step's example.
    struct Playlist { // A playlist is data the app copies, saves and shows.
        var name: String // No default, so every caller must supply a name.
        var songs: [String] = [] // A default value makes the songs argument optional in the memberwise init.

        mutating func add(_ song: String) { // mutating: this method changes a stored property.
            songs.append(song) // The line that makes mutating necessary.
        }

        var summary: String { // A read-only computed property; reading never needs mutating.
            "\(name): \(songs.count) songs" // A single-expression body returns its value without return.
        }
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        var roadTrip = Playlist(name: "Road Trip") // Must be a var: the next lines call a mutating method.
        roadTrip.add("Golden Hour") // Changes the value stored in roadTrip.
        roadTrip.add("Ocean Drive") // Builds on the value the first call left behind.
        out.print(roadTrip.summary) // Road Trip: 2 songs.
        out.print(roadTrip.songs) // The array in Swift's array format, quotes included.
        return out // The two printed lines.
    }
}

/// Course step "When mutating meets let": the program that fails with let, after the fix.
enum MutatingMeetsLet { // Namespace for this step's example.
    struct Playlist { // The same playlist shape, reduced to the parts the error needs.
        var songs: [String] = [] // The default gives the struct a no-argument initializer, Playlist().

        mutating func add(_ song: String) { // Changes the playlist, so it is marked mutating.
            songs.append(song) // Modifying a stored property is what makes the method mutating.
        }
    }

    /// Runs the fixed program: favorites is a var, so the mutating call compiles.
    static func runFixed() -> Transcript { // With let favorites the program would not compile at all.
        var out = Transcript() // Collects the printed lines.
        var favorites = Playlist() // The fix: var instead of let.
        favorites.add("Golden Hour") // Now allowed, because favorites can change.
        out.print(favorites.songs) // ["Golden Hour"]
        return out // The one printed line.
    }
}

/// Course step "Custom init, static members and didSet": one temperature reading.
enum CustomInitStaticDidSet { // Namespace for this step's example.
    struct WeatherReading { // A small piece of data, a natural struct.
        static let freezingPoint = 0.0 // Belongs to the type itself, shared by every reading.
        let city: String // A reading never moves to another city, so let.
        var log = Transcript() // Where didSet "prints"; in a playground this would be the console.
        var celsius: Double { // A stored property with an observer attached.
            didSet { // Runs right after every assignment, but not during init.
                log.print("\(city): \(oldValue) -> \(celsius)") // oldValue is provided automatically.
            }
        }

        init(city: String, fahrenheit: Double) { // A custom init replaces the free memberwise one.
            self.city = city // self.city is the property; city alone is the parameter.
            celsius = (fahrenheit - 32) * 5 / 9 // Store Celsius; didSet stays silent during init.
        }

        var isFreezing: Bool { // A named yes-or-no question about the reading.
            celsius <= WeatherReading.freezingPoint // Static members are reached through the type name.
        }
    }

    /// Runs the course program and returns everything it printed, didSet's line included.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var denver = WeatherReading(city: "Denver", fahrenheit: 41) // 41 Fahrenheit becomes 5.0 Celsius; nothing prints.
        denver.celsius = -2.5 // Triggers didSet, which logs Denver: 5.0 -> -2.5.
        var out = denver.log // Starts the output with what didSet printed.
        out.print(denver.isFreezing) // true, because -2.5 is at or below 0.0.
        return out // Both printed lines, in the order they happened.
    }
}

/// Course step "Choosing how a value prints": TodoItem adopts CustomStringConvertible.
enum ChoosingHowAValuePrints { // Namespace for this step's example.
    struct TodoItem: CustomStringConvertible { // Promises to provide a description property.
        var title: String // No default, so the title is always required.
        var isDone = false // New tasks start unfinished; the type Bool is inferred.

        var description: String { // The protocol's one requirement, with this exact name and type.
            let box = isDone ? "[x]" : "[ ]" // A text checkbox for the task.
            return "\(box) \(title)" // For example: [x] Book flights.
        }
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        var items = [ // A var array: the program edits one element and appends another.
            TodoItem(title: "Book flights"), // Uses the default isDone, false.
            TodoItem(title: "Pack charger", isDone: true), // Created already done.
        ]
        items[0].isDone = true // Changes the struct stored inside the array.
        items.append(TodoItem(title: "Water plants")) // Adds a third, unfinished task.
        for item in items { // Visits each task in order.
            out.print(item) // print now uses our description.
        }
        out.print("Open: \(items.filter { !$0.isDone }.count)") // Keeps the open tasks and counts them: Open: 1.
        return out // All four printed lines.
    }
}

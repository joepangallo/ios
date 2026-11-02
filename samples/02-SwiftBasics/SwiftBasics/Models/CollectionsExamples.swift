// CollectionsExamples.swift
// Who: the lesson 2.4 screen ("Arrays, Dictionaries and Sets") and its tests.
// What: the lesson's vocabulary, a "which collection fits?" helper, every code
//       step as a runnable Program, and the "changing a let array" mistake.
// Where: the Models folder; ArraysDictionariesSetsLesson in Lessons/ shows them.
// When: rebuilt whenever the student changes a control; run on Run.
// Why: arrays crash on a bad index just as ! crashes on nil. These programs
//      check the index first and report the crash as text, so the student can
//      try a bad index without the app closing.

/// Lesson 2.4's examples.
enum CollectionsExamples { // A namespace for the lesson's programs.

    /// The message Swift prints when an array index does not exist.
    static let indexCrashMessage = "Fatal error: Index out of range" // Shown instead of crashing.

    // MARK: Three ways to hold many values

    /// The three terms from the "Three ways to hold many values" step.
    static let terms: [Term] = [ // In the course's order.
        Term(term: "Array", text: "An ordered list. Items keep their position and are read by index, counting from 0. Duplicates are allowed."), // [String]
        Term(term: "Dictionary", text: "Pairs each unique key with one value, like a word and its definition. Lookups are by key, and there is no fixed order."), // [String: Int]
        Term(term: "Set", text: "Unique items with no order, built for fast questions such as \"is ios one of the tags?\""), // Set<String>
    ]

    /// The three needs from the course's "Which one should I pick?" tip.
    enum Need: String, CaseIterable, Identifiable { // CaseIterable so a picker can list them.
        case order // Order matters, or the same item can appear twice.
        case lookup // Find a value by a name or ID.
        case unique // Each item once, with fast "contains" checks.
        var id: String { rawValue } // Identifiable for the picker.

        /// The need, in the course's words.
        var question: String { // Shown on the picker.
            switch self { // One answer per case.
            case .order: "Order, or the same item twice" // Playlist songs.
            case .lookup: "Find a value by a name or ID" // Drink stock.
            case .unique: "Uniqueness, fast contains" // Photo tags.
            }
        }

        /// The collection the course recommends for this need, with an example.
        var recommendation: String { // Shown under the picker.
            switch self { // One answer per case.
            case .order: "Use an array: var playlist: [String] = [\"Intro\", \"Sunrise\", \"Drive\"]" // From the arrays step.
            case .lookup: "Use a dictionary: var stock: [String: Int] = [\"latte\": 12, \"mocha\": 5]" // From the dictionaries step.
            case .unique: "Use a set: var tags: Set<String> = [\"swift\", \"ios\", \"xcode\"]" // From the sets step.
            }
        }
    }

    // MARK: Arrays

    /// "Arrays: an ordered list". The student picks which index line 4 reads
    /// (index 3 is one past the end) and the song that is appended.
    static func arrays(readIndex: Int = 0, appendedSong: String = "Night Bus") -> Program { // Defaults match the course.
        // The program as the course shows it, with the student's values filled in.
        let source = #"""
            var playlist: [String] = ["Intro", "Sunrise", "Drive"]
            print(playlist.count)
            print(playlist.isEmpty)
            print(playlist[\#(readIndex)])
            print(playlist[playlist.count - 1])
            playlist.append("\#(appendedSong)")
            print(playlist)
            if let opener = playlist.first {
                print("Opens with \(opener)")
            }
            print(playlist.last ?? "No songs")
            """#
        return Program(source: source) { // The same statements, run safely.
            var out = Transcript() // Collects the printed lines.
            var playlist: [String] = ["Intro", "Sunrise", "Drive"] // var, because a song is appended later.
            out.print(playlist.count) // 3
            out.print(playlist.isEmpty) // false
            guard playlist.indices.contains(readIndex) else { // A real subscript here would crash the app...
                out.print(indexCrashMessage) // ...so report what Swift would print...
                return out // ...and stop, the way a crash ends the program.
            }
            out.print(playlist[readIndex]) // Safe: the guard checked the index.
            out.print(playlist[playlist.count - 1]) // The last index is always count - 1.
            playlist.append(appendedSong) // Adds to the end.
            out.print(playlist) // Prints with brackets and quotes.
            if let opener = playlist.first { // first is optional: an empty array has no first item.
                out.print("Opens with \(opener)") // Opens with Intro
            }
            out.print(playlist.last ?? "No songs") // last is optional too, so ?? supplies a default.
            return out // The finished output.
        }
    }

    /// "Looping and searching an array". The student picks the song to find
    /// and the index to read.
    static func searching(findSong: String = "Drive", wanted: Int = 10) -> Program { // Defaults match the course.
        // The program as the course shows it, with the student's values filled in.
        let source = #"""
            let songs = ["Intro", "Sunrise", "Drive", "Night Bus"]
            for (index, song) in songs.enumerated() {
                print("\(index + 1). \(song)")
            }
            print(songs.contains("Drive"))
            print(songs.contains("Encore"))
            if let position = songs.firstIndex(of: "\#(findSong)") {
                print("\#(findSong) is at index \(position)")
            }
            let wanted = \#(wanted)
            if songs.indices.contains(wanted) {
                print(songs[wanted])
            } else {
                print("No song at index \(wanted)")
            }
            """#
        return Program(source: source) { // The same statements, run for real.
            var out = Transcript() // Collects the printed lines.
            let songs = ["Intro", "Sunrise", "Drive", "Night Bus"] // A let: this program only reads it.
            for (index, song) in songs.enumerated() { // Each position together with its element.
                out.print("\(index + 1). \(song)") // People count from 1, so add 1 to the index.
            }
            out.print(songs.contains("Drive")) // true
            out.print(songs.contains("Encore")) // false
            if let position = songs.firstIndex(of: findSong) { // firstIndex returns Int?: the song may be missing.
                out.print("\(findSong) is at index \(position)") // Drive is at index 2
            }
            if songs.indices.contains(wanted) { // Check before you read.
                out.print(songs[wanted]) // Safe: the index exists.
            } else { // The index is out of range.
                out.print("No song at index \(wanted)") // A message instead of a crash.
            }
            return out // The finished output.
        }
    }

    /// "Mistake: changing a let array" from the course.
    static let letArrayMistake = Mistake( // The compiler stops at line 2.
        // The broken program, exactly as the course shows it.
        source: """
            let groceries = ["milk", "bread"]
            groceries.append("eggs")
            print(groceries)
            """, // The broken program, line for line.
        line: 2, // append is a mutating method; groceries is a constant.
        error: "cannot use mutating member on immutable value: 'groceries' is a 'let' constant", // The full message.
        courseQuote: "cannot use mutating member on immutable value" // What the course quotes.
    )

    /// "The fix: var, then add, insert and remove". The student can insert
    /// "tea" at index 1 instead of "coffee" at index 0, and choose which index
    /// remove(at:) takes out.
    static func mutating(insertTea: Bool = false, removeIndex: Int = 2) -> Program { // Defaults match the course.
        let insertLine = insertTea ? #"groceries.insert("tea", at: 1)"# : #"groceries.insert("coffee", at: 0)"# // Line 3.
        // The program as the course shows it, with the student's choices filled in.
        let source = #"""
            var groceries = ["milk", "bread"]
            groceries.append("eggs")
            \#(insertLine)
            print(groceries)
            let removed = groceries.remove(at: \#(removeIndex))
            print("Removed \(removed)")
            if let lastItem = groceries.popLast() {
                print("Took off \(lastItem)")
            }
            groceries.append("apples")
            groceries.swapAt(0, 1)
            print(groceries)
            print(groceries.sorted())
            """#
        return Program(source: source) { // The same changes, made for real.
            var out = Transcript() // Collects the printed lines.
            var groceries = ["milk", "bread"] // var makes the array mutable.
            groceries.append("eggs") // Adds to the end.
            if insertTea { // The "Try it" version of line 3.
                groceries.insert("tea", at: 1) // Squeezes tea in at position 1.
            } else { // The course's line 3.
                groceries.insert("coffee", at: 0) // Puts coffee first.
            }
            out.print(groceries) // Four items now.
            let removed = groceries.remove(at: removeIndex) // Takes one item out and returns it; 0 to 3 are always valid here.
            out.print("Removed \(removed)") // Which item went.
            if let lastItem = groceries.popLast() { // popLast returns nil instead of crashing on an empty array.
                out.print("Took off \(lastItem)") // The old last item.
            }
            groceries.append("apples") // Back up to three items.
            groceries.swapAt(0, 1) // Swaps the first two.
            out.print(groceries) // The array after every change.
            out.print(groceries.sorted()) // A sorted copy; groceries itself is unchanged.
            return out // The finished output.
        }
    }

    // MARK: Dictionaries

    /// "Dictionaries: look things up by key". The student picks the key
    /// looked up with ?? on line 5 and can add chai before the loop.
    static func dictionaries(lookupKey: String = "tea", addChai: Bool = false) -> Program { // Defaults match the course.
        let chaiLine = addChai ? "\nstock[\"chai\"] = 7" : "" // The "Try it" line, placed just before the loop.
        // The program as the course shows it, with the student's choices filled in.
        let source = #"""
            var stock: [String: Int] = ["latte": 12, "mocha": 5]
            if let lattes = stock["latte"] {
                print("Lattes left: \(lattes)")
            }
            let teas = stock["\#(lookupKey)"] ?? 0
            print("Teas left: \(teas)")
            print(stock["mocha", default: 0])
            stock["mocha"] = 4
            stock["tea"] = 20
            stock.removeValue(forKey: "latte")
            print(stock.count)\#(chaiLine)
            for item in stock.keys.sorted() {
                print("\(item): \(stock[item, default: 0])")
            }
            """#
        return Program(source: source) { // The same lookups and changes, run for real.
            var out = Transcript() // Collects the printed lines.
            var stock: [String: Int] = ["latte": 12, "mocha": 5] // Drink name to number in stock.
            if let lattes = stock["latte"] { // A lookup returns Int?: the key may be missing.
                out.print("Lattes left: \(lattes)") // Lattes left: 12
            }
            let teas = stock[lookupKey] ?? 0 // A missing key gives nil, so ?? supplies 0.
            out.print("Teas left: \(teas)") // Teas left: 0 with the course's key.
            out.print(stock["mocha", default: 0]) // The default: form returns a plain Int.
            stock["mocha"] = 4 // Assigning to an existing key replaces its value.
            stock["tea"] = 20 // Assigning to a new key adds a pair.
            stock.removeValue(forKey: "latte") // Removes a pair. The returned old value is not needed here.
            out.print(stock.count) // 2 pairs left.
            if addChai { stock["chai"] = 7 } // The "Try it" line.
            for item in stock.keys.sorted() { // Dictionaries have no order, so sort the keys first.
                out.print("\(item): \(stock[item, default: 0])") // One line per drink, alphabetically.
            }
            return out // The finished output.
        }
    }

    /// "Counting with a dictionary". The student can edit the sentence and
    /// uppercase it before splitting, as the course's "Try it" asks.
    static func counting(sentence: String = "the cat saw the dog and the cat ran", uppercaseFirst: Bool = false) -> Program { // Defaults match the course.
        let splitLine = uppercaseFirst ? #"let words = sentence.uppercased().split(separator: " ")"# : #"let words = sentence.split(separator: " ")"# // Line 2.
        // The program as the course shows it, with the student's choices filled in.
        let source = #"""
            let sentence = "\#(sentence)"
            \#(splitLine)
            var counts: [String: Int] = [:]
            for word in words {
                counts[String(word), default: 0] += 1
            }
            print("\(counts.count) different words")
            for word in counts.keys.sorted() {
                print("\(word): \(counts[word] ?? 0)")
            }
            """#
        return Program(source: source) { // The same counting, run for real.
            var out = Transcript() // Collects the printed lines.
            let text = uppercaseFirst ? sentence.uppercased() : sentence // The "Try it" uppercases first.
            let words = text.split(separator: " ") // Cuts the sentence at every space.
            var counts: [String: Int] = [:] // An empty dictionary: [:] is its literal.
            for word in words { // Visit each word once.
                counts[String(word), default: 0] += 1 // Read the count (0 if new), add one, write it back.
            }
            out.print("\(counts.count) different words") // How many distinct keys.
            for word in counts.keys.sorted() { // Alphabetical order.
                out.print("\(word): \(counts[word] ?? 0)") // Each word and how often it appeared.
            }
            return out // The finished output.
        }
    }

    // MARK: Sets

    /// "Sets: unique members". The student can insert "ios" again and swap
    /// the subtraction, as the course's "Try it" asks.
    static func sets(insertIosAgain: Bool = false, swapSubtraction: Bool = false) -> Program { // Defaults match the course.
        let extraInsert = insertIosAgain ? "\ntags.insert(\"ios\")" : "" // The first "Try it", just before the count.
        let subtractLine = swapSubtraction ? "print(otherTags.subtracting(tags).sorted())" : "print(tags.subtracting(otherTags).sorted())" // Line 9.
        // The program as the course shows it, with the student's choices filled in.
        let source = #"""
            var tags: Set<String> = ["swift", "ios", "xcode"]
            tags.insert("swift")
            tags.insert("design")\#(extraInsert)
            print(tags.count)
            print(tags.contains("ios"))
            let otherTags: Set<String> = ["design", "android", "swift"]
            print(tags.union(otherTags).sorted())
            print(tags.intersection(otherTags).sorted())
            \#(subtractLine)
            """#
        return Program(source: source) { // The same set operations, run for real.
            var out = Transcript() // Collects the printed lines.
            var tags: Set<String> = ["swift", "ios", "xcode"] // The annotation makes this a Set, not an array.
            tags.insert("swift") // Already there: nothing changes.
            tags.insert("design") // New: added.
            if insertIosAgain { tags.insert("ios") } // Also already there.
            out.print(tags.count) // 4: every member counts once.
            out.print(tags.contains("ios")) // Sets answer contains almost instantly.
            let otherTags: Set<String> = ["design", "android", "swift"] // A second set to combine with.
            out.print(tags.union(otherTags).sorted()) // Everything in either set.
            out.print(tags.intersection(otherTags).sorted()) // Only what both share.
            if swapSubtraction { // The "Try it" order.
                out.print(otherTags.subtracting(tags).sorted()) // In otherTags but not in tags.
            } else { // The course's order.
                out.print(tags.subtracting(otherTags).sorted()) // In tags but not in otherTags.
            }
            return out // The finished output.
        }
    }

    // MARK: Collections are values

    /// "Collections are values". The student picks what is appended to the
    /// copy and the rest-day step count.
    static func valueSemantics(appended: String = "stretch", restDaySteps: Int = 4000) -> Program { // Defaults match the course.
        // The program as the course shows it, with the student's values filled in.
        let source = #"""
            let weekday = ["warm-up", "run"]
            var weekend = weekday
            weekend.append("\#(appended)")
            print(weekday)
            print(weekend)
            let dailyGoal = ["steps": 8000, "minutes": 30]
            var restDay = dailyGoal
            restDay["steps"] = \#(restDaySteps)
            print(dailyGoal["steps"] ?? 0)
            print(restDay["steps"] ?? 0)
            """#
        return Program(source: source) { // The same copies, made for real.
            var out = Transcript() // Collects the printed lines.
            let weekday = ["warm-up", "run"] // The original.
            var weekend = weekday // An independent copy, not a second name for the same array.
            weekend.append(appended) // Changes only the copy.
            out.print(weekday) // Unchanged.
            out.print(weekend) // One item longer.
            let dailyGoal = ["steps": 8000, "minutes": 30] // A dictionary is a value too.
            var restDay = dailyGoal // Another independent copy.
            restDay["steps"] = restDaySteps // Changes only restDay.
            out.print(dailyGoal["steps"] ?? 0) // Still 8000.
            out.print(restDay["steps"] ?? 0) // The new number.
            return out // The finished output.
        }
    }
}

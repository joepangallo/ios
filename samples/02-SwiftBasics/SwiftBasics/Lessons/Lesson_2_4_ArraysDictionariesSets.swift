// Lesson_2_4_ArraysDictionariesSets.swift
// Who: the student who taps "2.4 Arrays, Dictionaries and Sets".
// What: one card per course step: choosing a collection, arrays, looping and
//       searching, the let-array mistake and the var fix, dictionaries,
//       counting with a dictionary, sets, and collections as values.
// Where: pushed by ContentView; the programs live in
//        Models/CollectionsExamples.swift.
// When: whenever the lesson is opened.
// Why: each card lets the student change the course's own data and see how
//      each collection reacts, including a bad index, safely.

import SwiftUI // View, State and the controls.

/// The lesson 2.4 screen.
struct ArraysDictionariesSetsLesson: View { // One screen, one card per course step.
    let lesson: Lesson // From ContentView.

    var body: some View { // Cards in the course's step order.
        LessonPage(lesson: lesson) { // The scrolling page from CourseKit.
            ChooseCollectionDemo() // Step 1.
            ArraysDemo() // Step 2.
            SearchingDemo() // Step 3.
            DemoCard(title: "Mistake: changing a let array", caption: "A let array is frozen. Methods that change a value in place are mutating methods, and the compiler refuses to call them on a constant.") { // Step 4.
                MistakeView(mistake: CollectionsExamples.letArrayMistake) // The broken code and the message.
            }
            MutatingDemo() // Step 5.
            DictionariesDemo() // Step 6.
            CountingDemo() // Step 7.
            SetsDemo() // Step 8.
            ValuesDemo() // Step 9.
        }
        .launchScrollPosition() // Honors the -scroll launch argument.
    }
}

/// "Three ways to hold many values".
private struct ChooseCollectionDemo: View { // Vocabulary plus the course's picking tip.
    @State private var need = CollectionsExamples.Need.order // The first need in the tip.

    var body: some View { // Rebuilt when the need changes.
        DemoCard(title: "Three ways to hold many values", caption: "Every collection is typed: [String] is an array of strings, [String: Int] a dictionary from strings to integers, Set<String> a set of strings. Collections are values: assigning one makes an independent copy.") { // Step 1.
            TermList(terms: CollectionsExamples.terms) // Array, dictionary, set.
            Text("Which one should I pick? I need...") // The course's tip, as a question.
                .font(.subheadline.bold()) // Reads as a heading.
            ForEach(CollectionsExamples.Need.allCases) { choice in // One radio-style button per need, in the tip's order.
                Button { need = choice } label: { // Tapping selects this need.
                    Label(choice.question, systemImage: need == choice ? "largecircle.fill.circle" : "circle") // A filled circle marks the choice.
                }
                .accessibilityAddTraits(need == choice ? .isSelected : []) // VoiceOver says which one is chosen.
            }
            CalloutBox(title: "The pick", text: need.recommendation, systemImage: "checkmark.circle") // The recommended collection.
        }
    }
}

/// "Arrays: an ordered list".
private struct ArraysDemo: View { // An index to read and a song to add.
    @State private var readIndex = 0 // The course reads index 0.
    @State private var song = "Night Bus" // The course appends "Night Bus".

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Arrays: an ordered list", caption: "Each item has an index counted from 0, so the last index is always count - 1. first and last return optionals, because an empty array has neither.") { // Step 2.
            Stepper(value: $readIndex, in: 0...3) { Text(verbatim: "Read playlist[\(readIndex)]") } // Index 3 is one past the end of three songs.
            CodeTextField(label: "append(", text: $song, maxLength: 16) // Line 6's song.
            ProgramRunner(program: CollectionsExamples.arrays(readIndex: readIndex, appendedSong: song)) // Code, Run, console.
            ControlHint(text: "Index 3 is one past the end. A real app would crash with Index out of range; this sample stops the program and prints the message instead.") // How the crash is shown safely.
        }
    }
}

/// "Looping and searching an array".
private struct SearchingDemo: View { // A song to find and an index to check.
    @State private var findSong = "Drive" // The course searches for "Drive"; try "Sunrise".
    @State private var wanted = 10 // The course asks for index 10; try 3.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Looping and searching an array", caption: "enumerated() hands you each index and element together. contains answers yes or no, and firstIndex(of:) returns an optional index. Check an index before you read it.") { // Step 3.
            Picker("firstIndex(of:)", selection: $findSong) { // Line 7's search.
                ForEach(["Intro", "Sunrise", "Drive", "Encore"], id: \.self) { Text(verbatim: $0).tag($0) } // Encore is not in the list.
            }
            .pickerStyle(.segmented) // All choices visible.
            Stepper(value: $wanted, in: 0...10) { Text(verbatim: "let wanted = \(wanted)") } // Line 10.
            ProgramRunner(program: CollectionsExamples.searching(findSong: findSong, wanted: wanted)) // Code, Run, console.
        }
    }
}

/// "The fix: var, then add, insert and remove".
private struct MutatingDemo: View { // Two of the course's "Try it" changes.
    @State private var insertTea = false // The course inserts coffee at 0.
    @State private var removeIndex = 2 // The course removes index 2.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "The fix: var, then add, insert and remove", caption: "With var, append adds to the end, insert(_:at:) adds at a position, remove(at:) takes one item out and returns it, and popLast() safely removes the last. sorted() returns a sorted copy.") { // Step 5.
            Toggle("Insert \"tea\" at 1 instead of \"coffee\" at 0", isOn: $insertTea) // Line 3.
            Stepper(value: $removeIndex, in: 0...3) { Text(verbatim: "remove(at: \(removeIndex))") } // Line 5; four items, so 0 to 3.
            ProgramRunner(program: CollectionsExamples.mutating(insertTea: insertTea, removeIndex: removeIndex)) // Code, Run, console.
        }
    }
}

/// "Dictionaries: look things up by key".
private struct DictionariesDemo: View { // A key to look up and an extra pair.
    @State private var lookupKey = "tea" // The course looks up "tea"; try "Latte".
    @State private var addChai = false // The course's first "Try it".

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Dictionaries: look things up by key", caption: "Each unique key maps to one value. A lookup returns an optional, because the key may not exist. Dictionaries have no order, so sort the keys before printing.") { // Step 6.
            CodeTextField(label: "stock[", text: $lookupKey, maxLength: 12) // Line 5's key; keys are case-sensitive.
            Toggle("Add stock[\"chai\"] = 7 before the loop", isOn: $addChai) // The first "Try it".
            ProgramRunner(program: CollectionsExamples.dictionaries(lookupKey: lookupKey, addChai: addChai)) // Code, Run, console.
        }
    }
}

/// "Counting with a dictionary".
private struct CountingDemo: View { // A sentence to count.
    @State private var sentence = "the cat saw the dog and the cat ran" // The course's sentence.
    @State private var uppercaseFirst = false // The course's second "Try it".

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Counting with a dictionary", caption: "counts[word, default: 0] += 1 reads the current count (0 for a new word), adds one, and writes the result back, all in one line.") { // Step 7.
            CodeTextField(label: "sentence:", text: $sentence, maxLength: 60) // Line 1; try adding " the dog".
            Toggle("Call uppercased() before splitting", isOn: $uppercaseFirst) // Line 2's "Try it".
            ProgramRunner(program: CollectionsExamples.counting(sentence: sentence, uppercaseFirst: uppercaseFirst)) // Code, Run, console.
        }
    }
}

/// "Sets: unique members".
private struct SetsDemo: View { // Two "Try it" toggles.
    @State private var insertIosAgain = false // The first "Try it".
    @State private var swapSubtraction = false // The second "Try it".

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Sets: unique members", caption: "A set holds each value at most once, with no order; inserting a duplicate does nothing. contains is fast, and two sets combine like the circles of a Venn diagram.") { // Step 8.
            Toggle("Insert \"ios\" again before the count", isOn: $insertIosAgain) // Adds a line.
            Toggle("Swap to otherTags.subtracting(tags)", isOn: $swapSubtraction) // Changes the last line.
            ProgramRunner(program: CollectionsExamples.sets(insertIosAgain: insertIosAgain, swapSubtraction: swapSubtraction)) // Code, Run, console.
        }
    }
}

/// "Collections are values".
private struct ValuesDemo: View { // What changes in the copy.
    @State private var appended = "stretch" // The course appends "stretch".
    @State private var restDaySteps = 4000 // The course's rest-day steps.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Collections are values", caption: "Assigning an array, dictionary or set to another variable gives an independent copy, and changing the copy never touches the original. Copy-on-write keeps this cheap.") { // Step 9.
            CodeTextField(label: "weekend.append(", text: $appended, maxLength: 16) // Line 3.
            Stepper(value: $restDaySteps, in: 0...10000, step: 500) { Text(verbatim: "restDay[\"steps\"] = \(restDaySteps)") } // Line 8.
            ProgramRunner(program: CollectionsExamples.valueSemantics(appended: appended, restDaySteps: restDaySteps)) // Code, Run, console.
        }
    }
}

#Preview { // Shows the lesson in Xcode's canvas.
    NavigationStack { ArraysDictionariesSetsLesson(lesson: ContentView.lessons[3]) } // Inside a stack, so the title shows.
}

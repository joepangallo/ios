// StructExamplesTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks every program in lesson 3.1 against the output the course page
//       expects, plus the computed properties, mutating methods and didSet
//       behavior the screen relies on.
// Where: the TypeWorkshopTests target; the code under test is Models/StructExamples.swift.
// When: only when tests run.
// Why: if the app's version of a course program ever printed something
//      different, students would see two different answers for one example.

import Testing // Swift Testing: @Test and #expect.
@testable import TypeWorkshop // Lets the tests see the app's internal types.

@MainActor // The app's types are main-actor isolated by default.
struct StructExamplesTests { // Lesson 3.1.
    @Test func definingAStructPrintsTheCourseOutput() { // Course step "Defining a struct".
        #expect(DefiningAStruct.run().text == "Buy oat milk\ntrue\nTodoItem(title: \"Buy oat milk\", isDone: true, minutes: 15)") // The expected output, character for character.
    }

    @Test func computedPriceAndReceiptMatchTheCourse() { // Course step "Computed properties and methods".
        #expect(ComputedPropertiesAndMethods.run().text == "4.85\nLatte, 2 shots: $4.85") // The expected output.
    }

    @Test(arguments: [ // Several orders, each with the price and receipt it must produce.
        (1, false, 3.50, "Latte, 1 shots: $3.50"), // No extra shots, no oat milk.
        (3, false, 5.00, "Latte, 3 shots: $5.00"), // The course's first try item.
        (4, true, 6.35, "Latte, 4 shots: $6.35"), // Three extra shots plus oat milk.
    ])
    func priceFollowsTheOptions(shots: Int, oat: Bool, price: Double, receipt: String) { // A parameterized test runs once per tuple.
        let order = ComputedPropertiesAndMethods.CoffeeOrder(drink: "Latte", shots: shots, hasOatMilk: oat) // Build the order.
        #expect(abs(order.price - price) < 0.0001) // Doubles are compared with a tolerance.
        #expect(order.receipt() == receipt) // Two decimals, always.
    }

    @Test func mutatingAddAppendsSongs() { // Course step "Mutating methods".
        #expect(MutatingMethods.run().text == "Road Trip: 2 songs\n[\"Golden Hour\", \"Ocean Drive\"]") // The expected output.
        var playlist = MutatingMethods.Playlist(name: "Focus") // The default songs argument is used.
        #expect(playlist.summary == "Focus: 0 songs") // Empty at first.
        playlist.add("Rain") // A mutating call on a var.
        #expect(playlist.songs == ["Rain"]) // Appended.
        #expect(playlist.summary == "Focus: 1 songs") // The summary follows.
    }

    @Test func fixedLetProgramPrintsOneSong() { // Course step "When mutating meets let", after the fix.
        #expect(MutatingMeetsLet.runFixed().text == "[\"Golden Hour\"]") // What the fixed program prints.
    }

    @Test func didSetLogsChangesButNotInit() { // Course step "Custom init, static members and didSet".
        #expect(CustomInitStaticDidSet.run().text == "Denver: 5.0 -> -2.5\ntrue") // The expected output.
        var reading = CustomInitStaticDidSet.WeatherReading(city: "Oslo", fahrenheit: 50) // 50 F is 10 C.
        #expect(reading.celsius == 10.0) // The custom init converted.
        #expect(reading.log.lines.isEmpty) // didSet does not run during init.
        reading.celsius = 10.0 // The same value again.
        #expect(reading.log.lines == ["Oslo: 10.0 -> 10.0"]) // didSet still runs.
        reading.celsius = 0.0 // Exactly freezing.
        #expect(reading.isFreezing) // At or below 0.0 counts.
        reading.celsius = 0.5 // Just above.
        #expect(!reading.isFreezing) // Not freezing.
        #expect(reading.log.lines.count == 3) // One line per assignment.
        #expect(CustomInitStaticDidSet.WeatherReading.freezingPoint == 0.0) // The static constant.
    }

    @Test func customDescriptionUsesCheckboxes() { // Course step "Choosing how a value prints".
        #expect(ChoosingHowAValuePrints.run().text == "[x] Book flights\n[x] Pack charger\n[ ] Water plants\nOpen: 1") // The expected output.
        let item = ChoosingHowAValuePrints.TodoItem(title: "Call home") // isDone defaults to false.
        #expect("\(item)" == "[ ] Call home") // Interpolation uses description.
        #expect(String(describing: ChoosingHowAValuePrints.TodoItem(title: "Done", isDone: true)) == "[x] Done") // So does String(describing:).
    }
}

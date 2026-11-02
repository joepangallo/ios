// ParadigmExamplesTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks every program in lesson 3.8 against the course's expected
//       output, and that all five styles agree for every combination of done
//       flags, as the lesson's overview card promises.
// Where: the TypeWorkshopTests target; the code under test is Models/ParadigmExamples.swift.
// When: only when tests run.
// Why: the lesson's claim is "same problem, same answer, different style";
//      this suite proves the answer really is the same.

import Testing // Swift Testing: @Test and #expect.
@testable import TypeWorkshop // Lets the tests see the app's internal types.

@MainActor // The app's types are main-actor isolated by default.
struct ParadigmExamplesTests { // Lesson 3.8.
    @Test func everyCourseProgramPrintsForty() { // The five code steps.
        #expect(Imperative.run().text == "Completed: 40 min") // Imperative.
        #expect(ObjectOriented.run().text == "Completed: 40 min, 1 open") // Object-oriented.
        #expect(ProtocolOriented.run().text == "Completed: 40 min") // Protocol-oriented.
        #expect(LoopOrPipeline.runLoop().text == "Completed: 40 min") // Compare, left.
        #expect(LoopOrPipeline.runPipeline().text == "Completed: 40 min") // Compare, right.
        #expect(DeclarativeExample.sum(of: DeclarativeExample.today) == 40) // Declarative, as first drawn.
    }

    @Test func taskListGuardsItsState() { // The object refuses double counting.
        let list = ObjectOriented.TaskList() // One object.
        list.add("Gym", minutes: 45) // One open chore.
        list.complete("Gym") // Done.
        list.complete("Gym") // The course's try item: a second time changes nothing.
        list.complete("Swim") // Unknown chores are ignored.
        #expect(list.report == "Completed: 45 min, 0 open") // Counted once.
    }

    @Test func trackableWorksForWorkoutsToo() { // The protocol extension, reused.
        let workouts = [ProtocolOriented.Workout(minutes: 20, isDone: true), ProtocolOriented.Workout(minutes: 35, isDone: false)] // A second Trackable type.
        #expect(workouts.completedMinutes == 20) // Only the finished workout.
        #expect([ProtocolOriented.Workout]().completedMinutes == 0) // Empty sequence.
    }

    @Test func gymToggleMakesEightyFive() { // The declarative try item.
        var chores = DeclarativeExample.today // The view's starting state.
        chores[1].isDone = true // Flip the Gym toggle.
        #expect(DeclarativeExample.sum(of: chores) == 85) // The total the course predicts.
    }

    @Test func allFiveStylesAgreeForEveryCombination() { // The overview card's promise.
        for mask in 0..<8 { // Every combination of three done flags.
            var records = FiveStyles.today // Start from the course's data.
            for index in records.indices { records[index].isDone = mask & (1 << index) != 0 } // Set the flags from the mask's bits.
            let expected = records.filter(\.isDone).map(\.minutes).reduce(0, +) // The right answer, computed directly.
            let line = "Completed: \(expected) min" // What every style should print.
            #expect(FiveStyles.imperative(records) == line) // Imperative.
            #expect(FiveStyles.objectOriented(records).hasPrefix(line + ",")) // Object-oriented adds the open count.
            #expect(FiveStyles.protocolOriented(records) == line) // Protocol-oriented.
            #expect(FiveStyles.functional(records) == line) // Functional.
            #expect(FiveStyles.declarative(records) == line) // Declarative.
            #expect(LoopOrPipeline.loopTotal(records.map { LoopOrPipeline.Chore(title: $0.title, minutes: $0.minutes, isDone: $0.isDone) }) == expected) // The loop agrees too.
        }
    }
}

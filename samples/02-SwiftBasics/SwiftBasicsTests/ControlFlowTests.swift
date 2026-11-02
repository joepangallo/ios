// ControlFlowTests.swift
// Who: the Swift Testing runner.
// What: checks every lesson 2.5 program against the course's expected output,
//       the branches the controls reach, and the loop tracer's snapshots.
// Where: the SwiftBasicsTests target.
// When: only when tests run.
// Why: if a test here passes, the 2.5 screen prints exactly what the course
//      says, and the tracer agrees with the real loops.

import Testing // @Test and #expect.
@testable import SwiftBasics // The app's internal types.

@MainActor // The app's types live on the main actor.
struct ControlFlowTests { // Lesson 2.5.
    @Test func batteryMatchesTheCourse() { // "if, else if and else".
        #expect(output(of: ControlFlowExamples.battery()) == "Low battery: 18%\nCheck finished") // The course's expect.
    }

    // Each tuple holds the inputs and the line the program must print.
    @Test(arguments: [(3, false, "Shutting down"), (35, false, "Battery below half"), (90, false, "Battery fine"), (18, true, "Battery below half"), (20, false, "Low battery: 20%"), (5, true, "Shutting down")])
    func batteryBranches(level: Int, charging: Bool, message: String) { // The course's "Try it" values, plus the edges.
        #expect(ControlFlowExamples.battery(level: level, isCharging: charging).run().lines == [message, "Check finished"]) // One branch, then the final line.
    }

    @Test func switchVocabulary() { // "switch: every case covered".
        #expect(ControlFlowExamples.switchTerms.map(\.term) == ["Exhaustive", "No fallthrough", "Rich patterns", "where"]) // The course's four points.
    }

    @Test func statusMatchesTheCourse() { // "switch with values and ranges".
        #expect(output(of: ControlFlowExamples.status()) == "Not found") // The course's expect.
    }

    // Each tuple holds the inputs and the line the program must print.
    @Test(arguments: [(200, "Success"), (201, "Success"), (204, "Success"), (302, "Redirect: follow the new address"), (418, "Client error: check the request"), (503, "Server error: try again later"), (599, "Server error: try again later"), (202, "Unexpected status 202"), (600, "Unexpected status 600")])
    func statusCases(code: Int, message: String) { // The course's "Try it" codes and the range edges.
        #expect(output(of: ControlFlowExamples.status(code: code)) == message) // The first matching case wins.
    }

    @Test func everyPickerCodeGivesOneLine() { // The picker's codes all work.
        for code in ControlFlowExamples.interestingStatusCodes { // Every code offered.
            #expect(ControlFlowExamples.status(code: code).run().lines.count == 1) // Exactly one case runs.
        }
    }

    @Test func tapMatchesTheCourse() { // "switch with tuples and where".
        #expect(output(of: ControlFlowExamples.tap()) == "On the diagonal at 3, 3") // The course's expect.
    }

    // Each tuple holds the inputs and the line the program must print.
    @Test(arguments: [(0, 0, "Tapped the center"), (4, 0, "On the horizontal axis"), (0, 7, "On the vertical axis"), (5, -5, "On the other diagonal at 5, -5"), (-2, -2, "On the diagonal at -2, -2"), (2, 5, "Somewhere else: 2, 5")])
    func tapCases(x: Int, y: Int, message: String) { // The course's "Try it" points and more.
        #expect(output(of: ControlFlowExamples.tap(x: x, y: y)) == message) // The first matching pattern wins.
    }

    @Test func loopsMatchesTheCourse() { // "for-in with ranges and stride".
        // The expected text is the course's expected output, line for line.
        #expect(output(of: ControlFlowExamples.loops()) == """
            Lap 1
            Lap 2
            Lap 3
            Beep
            Beep
            Stretch at minute 0
            Stretch at minute 20
            Stretch at minute 40
            3...
            2...
            1...
            4 is a multiple of 4
            8 is a multiple of 4
            """) // The course's expect.
    }

    @Test func loopsFollowsTheControls() { // The course's "Try it" changes.
        let halfOpen = ControlFlowExamples.loops(closedRange: false).run().lines // 1..<3.
        #expect(halfOpen.filter { $0.hasPrefix("Lap") } == ["Lap 1", "Lap 2"]) // One lap fewer.
        #expect(ControlFlowExamples.loops(closedRange: false).source.contains("1..<3")) // The code shows it.
        #expect(ControlFlowExamples.loops(countdownStart: 5).run().lines.filter { $0.hasSuffix("...") }.count == 5) // 5... down to 1...
        #expect(ControlFlowExamples.loops(strideStep: 15).run().lines.filter { $0.hasPrefix("Stretch") }.count == 4) // 0, 15, 30, 45.
        #expect(ControlFlowExamples.loops(lapEnd: 1, closedRange: false).run().lines.first == "Beep") // 1..<1 is empty: no laps.
    }

    @Test func sensorMatchesTheCourse() { // "Skipping and stopping: continue and break".
        #expect(output(of: ControlFlowExamples.sensor()) == "Skipping bad reading at index 2\nHeat alert at index 4: 31\nAveraged 3 readings: 23") // The course's expect.
    }

    @Test func sensorFollowsTheControls() { // The course's "Try it" changes.
        #expect(output(of: ControlFlowExamples.sensor(hotReading: 29)) == "Skipping bad reading at index 2\nAveraged 5 readings: 24") // No alert.
        #expect(output(of: ControlFlowExamples.sensor(useBreak: false)) == "Skipping bad reading at index 2\nHeat alert at index 4: 31\nAveraged 4 readings: 22") // continue keeps going.
        #expect(ControlFlowExamples.sensor(useBreak: false).source.contains("        continue\n    }\n    total")) // The code shows continue on line 12.
    }

    @Test func outerScopeMatchesTheCourse() { // "The fix: declare it before the loop".
        #expect(output(of: ControlFlowExamples.outerScope()) == "Last round trip: 4 km\n4 weeks to pass 1000: 1600\nVolume 4") // The course's expect.
    }

    @Test func outerScopeFollowsTheControls() { // The course's "Try it" values.
        #expect(ControlFlowExamples.outerScope(followers: 1000).run().lines[1] == "0 weeks to pass 1000: 1000") // while may never run.
        #expect(ControlFlowExamples.outerScope(volume: 80).run().lines.suffix(3) == ["Volume 40", "Volume 20", "Volume 10"]) // repeat runs until 10.
        #expect(ControlFlowExamples.outerScope(volume: 0).run().lines.last == "Volume 0") // repeat always runs once.
        #expect(ControlFlowExamples.outerScope(followers: 0).run().lines[1] == "10 weeks to pass 1000: 1024") // 0 is treated as 1, so the loop ends.
    }

    @Test func tracerSumRecordsEveryLine() { // The for-in sum.
        let steps = LoopTracer.steps(for: .forInSum) // Every snapshot.
        #expect(steps.count == 12) // Start, line 1, four passes of two lines, the end check, the print.
        #expect(steps.first?.line == nil) // Nothing has run yet.
        #expect(steps.last?.output == ["10"]) // 1 + 2 + 3 + 4.
        #expect(steps.last?.variables == [ // total survives; n is gone.
            LoopTracer.Variable(name: "total", type: "Int", value: "10", exists: true), // Declared outside the loop.
            LoopTracer.Variable(name: "n", type: "Int", value: "no longer exists", exists: false), // Lived only inside.
        ])
        #expect(steps[1].variables[1].value == "not created yet") // n before the loop.
        #expect(steps.last?.items.allSatisfy { $0.state == .used } == true) // The whole range was used.
    }

    @Test func tracerWhileCountsChecksAndRuns() { // The while loop.
        let steps = LoopTracer.steps(for: .whileDoubling) // Every snapshot.
        #expect(steps.count == 20) // Start, two declarations, five passes of three lines, the failing check, the print.
        #expect(steps.last?.output == ["5 steps, value 32"]) // The real loop's result.
        #expect(steps.last?.progress.contains("checks so far: 6, body runs: 5") == true) // One more check than runs.
        #expect(steps.allSatisfy { $0.items.isEmpty }) // A while loop has no sequence.
    }

    @Test func tracerContinueBreakMarksEveryWord() { // The loop with continue and break.
        let steps = LoopTracer.steps(for: .continueBreak) // Every snapshot.
        #expect(steps.count == 22) // As counted in the course's widget.
        #expect(steps.last?.output == ["swift", "is", "fun", "done"]) // skip skipped; stop stops.
        #expect(steps.last?.items.map(\.state) == [.printed, .printed, .skipped, .printed, .stopped, .never]) // Each word's fate.
        #expect(steps[1].span == [1, 2]) // The array literal spans two lines.
        #expect(steps.contains { $0.line == 5 } && steps.contains { $0.line == 8 }) // continue and break both ran.
    }

    @Test func tracerLinesAlwaysExist() { // Every highlighted line is in the program.
        for loop in LoopTracer.Loop.allCases { // All three loops.
            let lineCount = loop.source.split(separator: "\n").count // The program's length.
            for step in LoopTracer.steps(for: loop) { // Every snapshot.
                #expect(step.span.allSatisfy { (1...lineCount).contains($0) }) // No highlight past the end.
                #expect(step.variables.count == loop.variables.count) // Every variable is always listed.
            }
            #expect(!loop.label.isEmpty) // The picker has a label.
        }
    }

    @Test func tracerOutputOnlyGrows() { // The console never loses lines while stepping forward.
        for loop in LoopTracer.Loop.allCases { // All three loops.
            let steps = LoopTracer.steps(for: loop) // Every snapshot.
            for (earlier, later) in zip(steps, steps.dropFirst()) { // Each neighboring pair.
                #expect(later.output.starts(with: earlier.output)) // Output is only ever appended.
            }
        }
    }
}

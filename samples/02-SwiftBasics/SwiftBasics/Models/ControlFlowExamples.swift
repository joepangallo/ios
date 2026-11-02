// ControlFlowExamples.swift
// Who: the lesson 2.5 screen ("Decisions and Loops") and its tests.
// What: the switch vocabulary, every code step as a runnable Program
//       (if/else, switch on values, ranges and tuples, for-in with ranges and
//       stride, continue and break, while and repeat-while) and the scope
//       mistake.
// Where: the Models folder; DecisionsLoopsLesson in Lessons/ shows them.
//        The step-by-step loop tracer lives in LoopTracer.swift.
// When: rebuilt whenever the student changes a control; run on Run.
// Why: decisions and loops are easiest to understand by changing one value
//      and watching a different branch run.

/// Lesson 2.5's examples.
enum ControlFlowExamples { // A namespace for the lesson's programs.

    // MARK: if, else if and else

    /// "if, else if and else". The student sets the battery level and charging state.
    static func battery(level: Int = 18, isCharging: Bool = false) -> Program { // Defaults match the course.
        // The program as the course shows it, with the student's values filled in.
        let source = #"""
            let batteryLevel = \#(level)
            let isCharging = \#(isCharging)

            if batteryLevel <= 5 {
                print("Shutting down")
            } else if batteryLevel <= 20 && !isCharging {
                print("Low battery: \(batteryLevel)%")
            } else if batteryLevel <= 50 {
                print("Battery below half")
            } else {
                print("Battery fine")
            }
            print("Check finished")
            """#
        return Program(source: source) { // The same chain, run for real.
            var out = Transcript() // Collects the printed lines.
            if level <= 5 { // Checked first.
                out.print("Shutting down") // Only the first true branch runs.
            } else if level <= 20 && !isCharging { // Checked only if the first test was false.
                out.print("Low battery: \(level)%") // Low and not charging.
            } else if level <= 50 { // Checked only if both tests above were false.
                out.print("Battery below half") // Between 21 and 50, or low but charging.
            } else { // Everything left over.
                out.print("Battery fine") // Above 50.
            }
            out.print("Check finished") // After the chain, this always runs.
            return out // The finished output.
        }
    }

    // MARK: switch

    /// The four points from the "switch: every case covered" step.
    static let switchTerms: [Term] = [ // In the course's order.
        Term(term: "Exhaustive", text: "Every possible value must be handled. For an Int or a String that means ending with default; the compiler rejects a switch that could miss a value."), // Rule 1.
        Term(term: "No fallthrough", text: "A case never runs on into the next one, so you never write break at the end of a case. Forgetting break is a classic C and Java bug that Swift removes."), // Rule 2.
        Term(term: "Rich patterns", text: "A case can match a list (200, 201), a range (400..<500), or a tuple ((0, _)), and it can copy parts into constants with let."), // Rule 3.
        Term(term: "where", text: "Adds an extra condition to a pattern: case let (x, y) where x == y matches only points on the diagonal."), // Rule 4.
    ]

    /// The status codes the course mentions, for the picker.
    static let interestingStatusCodes = [200, 201, 202, 204, 301, 302, 404, 418, 500, 503, 599, 600] // In numeric order.

    /// "switch with values and ranges". The student picks the status code.
    static func status(code: Int = 404) -> Program { // Default matches the course.
        // The program as the course shows it, with the student's code filled in.
        let source = #"""
            let statusCode = \#(code)

            switch statusCode {
            case 200, 201, 204:
                print("Success")
            case 301, 302:
                print("Redirect: follow the new address")
            case 404:
                print("Not found")
            case 400..<500:
                print("Client error: check the request")
            case 500...599:
                print("Server error: try again later")
            default:
                print("Unexpected status \(statusCode)")
            }
            """#
        return Program(source: source) { // The same switch, run for real.
            var out = Transcript() // Collects the printed lines.
            switch code { // Compares code with each case, top to bottom.
            case 200, 201, 204: // A list: any of these values matches.
                out.print("Success") // 2xx means it worked.
            case 301, 302: // Two redirect codes.
                out.print("Redirect: follow the new address") // 3xx.
            case 404: // One exact value, listed before the range that also contains it.
                out.print("Not found") // The most famous status code.
            case 400..<500: // A half-open range: 400 up to, not including, 500.
                out.print("Client error: check the request") // Any other 4xx.
            case 500...599: // A closed range: includes 599.
                out.print("Server error: try again later") // 5xx.
            default: // Every other Int; required, because Int has far more values than these cases.
                out.print("Unexpected status \(code)") // For example 202 or 600.
            }
            return out // The finished output.
        }
    }

    /// "switch with tuples and where". The student moves the tap on the grid.
    static func tap(x: Int = 3, y: Int = 3) -> Program { // Defaults match the course.
        // The program as the course shows it, with the student's point filled in.
        let source = #"""
            let tap = (x: \#(x), y: \#(y))

            switch tap {
            case (0, 0):
                print("Tapped the center")
            case (_, 0):
                print("On the horizontal axis")
            case (0, _):
                print("On the vertical axis")
            case let (x, y) where x == y:
                print("On the diagonal at \(x), \(y)")
            case let (x, y) where x == -y:
                print("On the other diagonal at \(x), \(y)")
            default:
                print("Somewhere else: \(tap.x), \(tap.y)")
            }
            """#
        return Program(source: source) { // The same switch, run for real.
            var out = Transcript() // Collects the printed lines.
            let tap = (x: x, y: y) // A labeled tuple: two values in one.
            switch tap { // Matches both parts at once.
            case (0, 0): // Both parts are zero.
                out.print("Tapped the center") // Listed first, so it wins over both axis cases.
            case (_, 0): // _ means any x; y must be 0.
                out.print("On the horizontal axis") // Anywhere on the x axis.
            case (0, _): // x must be 0; any y.
                out.print("On the vertical axis") // Anywhere on the y axis.
            case let (x, y) where x == y: // Copies both parts, then checks the extra condition.
                out.print("On the diagonal at \(x), \(y)") // For example 3, 3.
            case let (x, y) where x == -y: // The other diagonal.
                out.print("On the other diagonal at \(x), \(y)") // For example 5, -5.
            default: // Every other point.
                out.print("Somewhere else: \(tap.x), \(tap.y)") // Labels read the tuple's parts.
            }
            return out // The finished output.
        }
    }

    // MARK: for-in, ranges and stride

    /// "for-in with ranges and stride". The student can change the range's
    /// end and kind, the countdown start, and the stride step.
    static func loops(lapEnd: Int = 3, closedRange: Bool = true, countdownStart: Int = 3, strideStep: Int = 20) -> Program { // Defaults match the course.
        let rangeText = closedRange ? "1...\(lapEnd)" : "1..<\(lapEnd)" // ... includes the end; ..< stops before it.
        // The program as the course shows it, with the student's values filled in.
        let source = #"""
            for lap in \#(rangeText) {
                print("Lap \(lap)")
            }

            for _ in 0..<2 {
                print("Beep")
            }

            for minute in stride(from: 0, to: 60, by: \#(strideStep)) {
                print("Stretch at minute \(minute)")
            }

            for count in stride(from: \#(countdownStart), through: 1, by: -1) {
                print("\(count)...")
            }

            for n in 1...10 where n.isMultiple(of: 4) {
                print("\(n) is a multiple of 4")
            }
            """#
        return Program(source: source) { // The same loops, run for real.
            var out = Transcript() // Collects the printed lines.
            let end = max(lapEnd, 1) // A range like 1...0 would crash, so the end is at least 1.
            if closedRange { // The course's closed range.
                for lap in 1...end { // Includes end: 1, 2, 3.
                    out.print("Lap \(lap)") // Lap 1, Lap 2, Lap 3
                }
            } else { // The "Try it" half-open range.
                for lap in 1..<end { // Stops before end: 1, 2.
                    out.print("Lap \(lap)") // One lap fewer.
                }
            }
            for _ in 0..<2 { // _ : the loop does not need the number itself.
                out.print("Beep") // Twice.
            }
            for minute in stride(from: 0, to: 60, by: strideStep) { // to: stops before 60.
                out.print("Stretch at minute \(minute)") // 0, 20, 40 with the course's step.
            }
            for count in stride(from: countdownStart, through: 1, by: -1) { // through: includes 1; a negative step counts down.
                out.print("\(count)...") // 3... 2... 1...
            }
            for n in 1...10 where n.isMultiple(of: 4) { // where filters which numbers reach the body.
                out.print("\(n) is a multiple of 4") // 4 and 8.
            }
            return out // The finished output.
        }
    }

    // MARK: continue and break

    /// "Skipping and stopping: continue and break". The student can change the
    /// hot reading and swap break for continue, as the course's "Try it" asks.
    static func sensor(hotReading: Int = 31, useBreak: Bool = true) -> Program { // Defaults match the course.
        let stopWord = useBreak ? "break" : "continue" // Line 12's keyword.
        // The program as the course shows it, with the student's choices filled in.
        let source = #"""
            let readings = [21, 23, -999, 25, \#(hotReading), 22]
            var total = 0
            var validCount = 0

            for (index, reading) in readings.enumerated() {
                if reading == -999 {
                    print("Skipping bad reading at index \(index)")
                    continue
                }
                if reading > 30 {
                    print("Heat alert at index \(index): \(reading)")
                    \#(stopWord)
                }
                total += reading
                validCount += 1
            }
            print("Averaged \(validCount) readings: \(total / validCount)")
            """#
        return Program(source: source) { // The same loop, run for real.
            var out = Transcript() // Collects the printed lines.
            let readings = [21, 23, -999, 25, hotReading, 22] // -999 marks a failed reading.
            var total = 0 // Sum of the valid readings.
            var validCount = 0 // How many were added.
            for (index, reading) in readings.enumerated() { // Each reading with its position.
                if reading == -999 { // A failed reading.
                    out.print("Skipping bad reading at index \(index)") // Say so...
                    continue // ...and jump to the next reading.
                }
                if reading > 30 { // Too hot.
                    out.print("Heat alert at index \(index): \(reading)") // Say so...
                    if useBreak { break } else { continue } // ...then leave the loop, or just skip this reading.
                }
                total += reading // Count this reading.
                validCount += 1 // One more valid reading.
            }
            out.print("Averaged \(validCount) readings: \(total / validCount)") // Integer average; at least three readings always count.
            return out // The finished output.
        }
    }

    // MARK: Scope

    /// "Mistake: using a loop's value after the loop" from the course.
    static let scopeMistake = Mistake( // The compiler stops at line 7.
        // The broken program, exactly as the course shows it.
        source: #"""
            let distances = [3, 5, 2]

            for distance in distances {
                let doubled = distance * 2
                print("Round trip: \(doubled) km")
            }
            print("Last round trip: \(doubled) km")
            """#, // The broken program, line for line.
        line: 7, // doubled only exists inside the loop's braces.
        error: "cannot find 'doubled' in scope", // The full message.
        courseQuote: "cannot find 'doubled' in scope" // What the course quotes.
    )

    /// "The fix: declare it before the loop". The student can change the
    /// starting followers and volume, as the course's "Try it" asks.
    static func outerScope(followers startFollowers: Int = 100, volume startVolume: Int = 8) -> Program { // Defaults match the course.
        // The program as the course shows it, with the student's values filled in.
        let source = #"""
            let distances = [3, 5, 2]
            var lastRoundTrip = 0
            for distance in distances {
                lastRoundTrip = distance * 2
            }
            print("Last round trip: \(lastRoundTrip) km")

            var followers = \#(startFollowers)
            var weeks = 0
            while followers < 1000 {
                followers *= 2
                weeks += 1
            }
            print("\(weeks) weeks to pass 1000: \(followers)")

            var volume = \#(startVolume)
            repeat {
                volume /= 2
                print("Volume \(volume)")
            } while volume > 10
            """#
        return Program(source: source) { // The same loops, run for real.
            var out = Transcript() // Collects the printed lines.
            let distances = [3, 5, 2] // Three trips.
            var lastRoundTrip = 0 // Declared outside the loop, so it outlives the loop.
            for distance in distances { // Each trip.
                lastRoundTrip = distance * 2 // Updates the outer variable.
            }
            out.print("Last round trip: \(lastRoundTrip) km") // Visible here: 4 km.
            var followers = max(startFollowers, 1) // At least 1: doubling 0 would never reach 1000.
            var weeks = 0 // Counts trips through the loop.
            while followers < 1000 { // Checked before every pass, so the body may never run.
                followers *= 2 // Doubles each week.
                weeks += 1 // One more week.
            }
            out.print("\(weeks) weeks to pass 1000: \(followers)") // 4 weeks with the course's start.
            var volume = startVolume // The repeat loop changes it.
            repeat { // The body runs first...
                volume /= 2 // Halves the volume (integer division).
                out.print("Volume \(volume)") // Volume 4 with the course's start.
            } while volume > 10 // ...and the condition is checked after, so it always runs at least once.
            return out // The finished output.
        }
    }
}

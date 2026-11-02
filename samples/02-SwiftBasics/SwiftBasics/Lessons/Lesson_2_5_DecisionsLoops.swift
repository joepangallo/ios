// Lesson_2_5_DecisionsLoops.swift
// Who: the student who taps "2.5 Decisions and Loops".
// What: one card per course step: if/else if/else, the switch rules, switch
//       on values and ranges, switch on tuples with where, for-in with ranges
//       and stride, continue and break, the scope mistake and the fix with
//       while and repeat-while, and a step-by-step loop tracer.
// Where: pushed by ContentView; the programs live in
//        Models/ControlFlowExamples.swift and Models/LoopTracer.swift.
// When: whenever the lesson is opened.
// Why: changing one value and watching a different branch or a different
//      number of passes is the fastest way to understand control flow.

import SwiftUI // View, State, Canvas and the controls.

/// The lesson 2.5 screen.
struct DecisionsLoopsLesson: View { // One screen, one card per course step.
    let lesson: Lesson // From ContentView.

    var body: some View { // Cards in the course's step order.
        LessonPage(lesson: lesson) { // The scrolling page from CourseKit.
            BatteryDemo() // Step 1.
            DemoCard(title: "switch: every case covered", caption: "A switch compares one value with a list of patterns, top to bottom. The first case that matches runs, and then the whole switch ends.") { // Step 2.
                TermList(terms: ControlFlowExamples.switchTerms) // Exhaustive, no fallthrough, rich patterns, where.
                CalloutBox(title: "Why strictness helps", text: "Soon you will switch over enums, types with a fixed list of cases. If you handle every case without default, adding a new case later makes the compiler point at every switch you still need to update.", systemImage: "pencil.and.ruler") // The course's design note.
            }
            StatusDemo() // Step 3.
            TapDemo() // Step 4.
            RangesDemo() // Step 5.
            SensorDemo() // Step 6.
            DemoCard(title: "Mistake: using a loop's value after the loop", caption: "A name declared inside braces exists only inside those braces: that region is its scope. doubled is created inside the loop body and used after the loop has ended.") { // Step 7.
                MistakeView(mistake: ControlFlowExamples.scopeMistake) // The broken code and the message.
            }
            OuterScopeDemo() // Step 8.
            LoopTracerDemo() // Step 9.
        }
        .launchScrollPosition() // Honors the -scroll launch argument.
    }
}

/// "if, else if and else".
private struct BatteryDemo: View { // A level and a charging switch.
    @State private var level = 18 // The course's level; try 3, 35 and 90.
    @State private var isCharging = false // The course's value; try true.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "if, else if and else", caption: "Swift checks the conditions from top to bottom and runs only the first branch whose condition is true. Every condition must be a Bool.") { // Step 1.
            Stepper(value: $level, in: 0...100) { Text(verbatim: "batteryLevel = \(level)") } // Line 1.
            Toggle("isCharging", isOn: $isCharging) // Line 2.
            ProgramRunner(program: ControlFlowExamples.battery(level: level, isCharging: isCharging)) // Code, Run, console.
        }
    }
}

/// "switch with values and ranges".
private struct StatusDemo: View { // One status code.
    @State private var code = 404 // The course's code; try 201, 418 and 503.

    var body: some View { // Rebuilt when the code changes.
        DemoCard(title: "switch with values and ranges", caption: "Every reply from a web server carries an HTTP status code. Each case lists the values or ranges it matches, and Swift runs the first case that fits.") { // Step 3.
            HStack { // The code being changed, then the menu.
                Text(verbatim: "let statusCode =") // Line 1, as code.
                    .font(.system(.footnote, design: .monospaced)) // Looks like code.
                    .foregroundStyle(.secondary) // Quieter than the menu.
                Picker("statusCode", selection: $code) { // Line 1's value.
                    ForEach(ControlFlowExamples.interestingStatusCodes, id: \.self) { Text(verbatim: "\($0)").tag($0) } // Codes worth trying.
                }
                .pickerStyle(.menu) // A compact pop-up list.
            }
            ProgramRunner(program: ControlFlowExamples.status(code: code)) // Code, Run, console.
        }
    }
}

/// "switch with tuples and where".
private struct TapDemo: View { // A point on a grid.
    @State private var x = 3 // The course's point is (3, 3).
    @State private var y = 3 // Try (0, 7), (5, -5) and (0, 0).

    var body: some View { // Rebuilt when the point moves.
        DemoCard(title: "switch with tuples and where", caption: "A switch can match every part of a tuple at once. _ means any value here, case let (x, y) copies the parts into constants, and where adds an extra condition.") { // Step 4.
            Stepper(value: $x, in: -7...7) { Text(verbatim: "x = \(x)") } // The tap's x.
            Stepper(value: $y, in: -7...7) { Text(verbatim: "y = \(y)") } // The tap's y.
            TapGrid(x: x, y: y) // A picture of the board and the tap.
            ProgramRunner(program: ControlFlowExamples.tap(x: x, y: y)) // Code, Run, console.
        }
    }
}

/// Draws the game board: both axes, both diagonals, and the tapped point.
private struct TapGrid: View { // A small picture; the switch itself is in the program.
    let x: Int // The tap's x, from -7 to 7.
    let y: Int // The tap's y, from -7 to 7.

    var body: some View { // Redrawn when the point moves.
        Canvas { context, size in // Canvas draws shapes directly.
            let cell = min(size.width, size.height) / 16 // 15 grid lines plus a margin.
            let center = CGPoint(x: size.width / 2, y: size.height / 2) // (0, 0) sits in the middle.
            func point(_ gx: Int, _ gy: Int) -> CGPoint { // Grid position to screen position.
                CGPoint(x: center.x + CGFloat(gx) * cell, y: center.y - CGFloat(gy) * cell) // Screen y grows downward, so subtract.
            }
            var axes = Path() // The two axes.
            axes.move(to: point(-7, 0)); axes.addLine(to: point(7, 0)) // Horizontal axis: y is 0.
            axes.move(to: point(0, -7)); axes.addLine(to: point(0, 7)) // Vertical axis: x is 0.
            context.stroke(axes, with: .color(.secondary), lineWidth: 1.5) // Solid lines.
            var diagonals = Path() // The two diagonals.
            diagonals.move(to: point(-7, -7)); diagonals.addLine(to: point(7, 7)) // x == y.
            diagonals.move(to: point(-7, 7)); diagonals.addLine(to: point(7, -7)) // x == -y.
            context.stroke(diagonals, with: .color(.secondary.opacity(0.6)), style: StrokeStyle(lineWidth: 1, dash: [4, 4])) // Dashed lines.
            let dot = point(x, y) // Where the tap landed.
            context.fill(Path(ellipseIn: CGRect(x: dot.x - 6, y: dot.y - 6, width: 12, height: 12)), with: .color(.accentColor)) // A filled circle.
        }
        .frame(height: 160) // A small square-ish board.
        .accessibilityLabel("A grid with the tap at x \(x), y \(y)") // Describes the picture for VoiceOver.
    }
}

/// "for-in with ranges and stride".
private struct RangesDemo: View { // Four of the course's "Try it" changes.
    @State private var lapEnd = 3 // The course loops 1...3.
    @State private var closedRange = true // ... rather than ..<.
    @State private var countdownStart = 3 // The course counts down from 3; try 5.
    @State private var strideStep = 20 // The course strides by 20; try 15.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "for-in with ranges and stride", caption: "A for-in loop runs its body once per item. 1...3 includes 3; 0..<2 stops before 2. stride counts in steps of any size, even backward, and where filters which items reach the body.") { // Step 5.
            Stepper(value: $lapEnd, in: 1...6) { Text(verbatim: "Range end: \(lapEnd)") } // The first loop's end.
            Toggle("Closed range ... (off: half-open ..<)", isOn: $closedRange) // The first "Try it".
            Stepper(value: $countdownStart, in: 1...10) { Text(verbatim: "Countdown from \(countdownStart)") } // The second "Try it".
            Stepper(value: $strideStep, in: 5...30, step: 5) { Text(verbatim: "stride by \(strideStep)") } // The third "Try it".
            ProgramRunner(program: ControlFlowExamples.loops(lapEnd: lapEnd, closedRange: closedRange, countdownStart: countdownStart, strideStep: strideStep)) // Code, Run, console.
        }
    }
}

/// "Skipping and stopping: continue and break".
private struct SensorDemo: View { // The hot reading and the keyword.
    @State private var hotReading = 31 // The course's reading; try 29.
    @State private var useBreak = true // The course uses break; try continue.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Skipping and stopping: continue and break", caption: "continue skips the rest of the current pass. break leaves the loop completely. Here -999 marks a failed sensor reading.") { // Step 6.
            Stepper(value: $hotReading, in: 20...40) { Text(verbatim: "Fifth reading: \(hotReading)") } // The reading at index 4.
            Picker("Line 12", selection: $useBreak) { // break or continue.
                Text(verbatim: "break").tag(true) // The course's keyword.
                Text(verbatim: "continue").tag(false) // The "Try it" keyword.
            }
            .pickerStyle(.segmented) // Both choices visible.
            ProgramRunner(program: ControlFlowExamples.sensor(hotReading: hotReading, useBreak: useBreak)) // Code, Run, console.
        }
    }
}

/// "The fix: declare it before the loop".
private struct OuterScopeDemo: View { // Two starting values.
    @State private var followers = 100 // The course's start; try 1000.
    @State private var volume = 8 // The course's start; try 80.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "The fix: declare it before the loop", caption: "Declare a value before the loop, in the outer scope, to use it afterward. A while loop checks its condition before every pass; repeat-while checks at the end, so its body always runs at least once.") { // Step 8.
            Stepper(value: $followers, in: 100...2000, step: 100) { Text(verbatim: "followers = \(followers)") } // Line 8.
            Stepper(value: $volume, in: 0...120, step: 4) { Text(verbatim: "volume = \(volume)") } // Line 16.
            ProgramRunner(program: ControlFlowExamples.outerScope(followers: followers, volume: volume)) // Code, Run, console.
        }
    }
}

/// "Trace a loop step by step": the course's loop tracer widget.
private struct LoopTracerDemo: View { // Step forward and back through a loop.
    @State private var loop = LoopTracer.Loop.forInSum // Which loop is traced.
    @State private var position = 0 // Which snapshot is showing; 0 is "nothing has run".

    var body: some View { // Rebuilt when the loop or position changes.
        let steps = LoopTracer.steps(for: loop) // Every snapshot of the chosen loop.
        let step = steps[min(position, steps.count - 1)] // The current one; min guards against a stale position.
        DemoCard(title: "Trace a loop step by step", caption: "Press Step to run one line at a time and Back to rewind. Watch the highlighted line, every variable's value and the console. A while checks its condition before every pass, and continue and break jump to different places.") { // Step 9.
            Picker("Loop", selection: $loop) { // Three loops.
                ForEach(LoopTracer.Loop.allCases) { Text($0.label).tag($0) } // for-in, while, continue/break.
            }
            .pickerStyle(.segmented) // All choices visible.
            CodeBlock(source: loop.source, highlighted: Set(step.span)) // The program, with the running line tinted.
            HStack { // Back, position, Step.
                Button { position -= 1 } label: { Label("Back", systemImage: "chevron.left") } // Rewinds one snapshot.
                    .disabled(position == 0) // Nothing before the start.
                Spacer() // Pushes the counter to the middle.
                Text(verbatim: "Step \(position) of \(steps.count - 1)") // Where we are.
                    .font(.caption.monospacedDigit()) // Digits that do not jiggle.
                Spacer() // Pushes Step to the right.
                Button { position += 1 } label: { HStack { Text("Step"); Image(systemName: "chevron.right") } } // Runs one more line; the arrow points forward.
                    .disabled(position >= steps.count - 1) // Nothing after the end.
            }
            .buttonStyle(.bordered) // Both buttons look alike.
            Text(step.note) // What just happened.
                .font(.subheadline) // Body-sized.
            Text(step.progress) // Where the loop is.
                .font(.caption.bold()) // Small but clear.
            if !step.items.isEmpty { // The for-in loops show their sequence.
                Grid(horizontalSpacing: 6, verticalSpacing: 6) { // Three chips per row; not lazy, so the page height is known up front.
                    ForEach(Array(stride(from: 0, to: step.items.count, by: 3)), id: \.self) { start in // The first index of each row.
                        GridRow { // One row of up to three chips.
                            ForEach(start..<min(start + 3, step.items.count), id: \.self) { index in // The chips in this row.
                                let item = step.items[index] // The item this chip shows.
                                VStack(spacing: 2) { // Item over its state.
                                    Text(verbatim: item.text) // The item as code.
                                        .font(.system(.footnote, design: .monospaced)) // Looks like code.
                                    Text(item.state.rawValue) // Its state in words.
                                        .font(.caption2) // Tiny.
                                        .foregroundStyle(.secondary) // Quiet.
                                }
                                .padding(6) // Room inside the chip.
                                .frame(maxWidth: .infinity) // Chips share each row evenly.
                                .background(item.state == .current ? Color.accentColor.opacity(0.25) : Color.secondary.opacity(0.12), in: .rect(cornerRadius: 8)) // The current item stands out.
                            }
                        }
                    }
                }
            }
            ForEach(step.variables, id: \.name) { variable in // One row per variable.
                HStack { // Name and type, then value.
                    Text(verbatim: "\(variable.name): \(variable.type)") // For example total: Int.
                        .font(.system(.footnote, design: .monospaced)) // Looks like code.
                    Spacer() // Pushes the value right.
                    Text(verbatim: variable.value) // The value, or a phrase.
                        .font(.system(.footnote, design: .monospaced).bold()) // The value stands out.
                        .foregroundStyle(variable.exists ? .primary : .secondary) // Phrases are quieter than values.
                }
            }
            ConsoleView(lines: step.output) // The console so far.
        }
        .onChange(of: loop) { position = 0 } // A new loop starts from the beginning.
    }
}

#Preview { // Shows the lesson in Xcode's canvas.
    NavigationStack { DecisionsLoopsLesson(lesson: ContentView.lessons[4]) } // Inside a stack, so the title shows.
}

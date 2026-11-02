// Lesson_5_5_LayoutSpacing.swift
// Who: the home screen opens this when the student taps 5.5.
// What: layout, spacing and touch targets, live: this phone's real safe areas
//       and 16 pt margins, a background that bleeds while content stays safe,
//       a three-value spacing scale and a proximity test, the course's event
//       card, cramped versus grouped summaries with a grid audit, the thumb zone,
//       glyph-sized versus 44-point buttons, and a tap tester with finger scatter.
// Where: the Lessons folder; the course's example views sit below the lesson.
// When: SwiftUI builds it when lesson 5.5 is pushed onto the home screen's stack.
// Why: spacing is information and hit areas are invisible. Measuring both,
//      and simulating a real thumb, makes the rules concrete.

import SwiftUI // SwiftUI views, gestures and geometry.

struct LayoutSpacingLesson: View { // The screen for lesson 5.5.
    let lesson: Lesson // The number, title and summary from the home screen.
    @State private var showSafeAreas = false // The safe-area overlay cover.
    @State private var showWelcome = false // The WelcomeView cover.
    @State private var welcomeBleeds = true // Try it: delete .ignoresSafeArea().
    @State private var welcomeSpacer = true // Try it: delete Spacer().
    @State private var insideGap = 4.0 // Proximity demo: space inside a group.
    @State private var betweenGap = 24.0 // Proximity demo: space between groups.
    @State private var tightOuter = false // Try it: outer spacing 24 to 4.
    @State private var centered = false // Try it: center alignment.
    @State private var summary = Version.before // Cramped or grouped summary.
    @State private var actions = Version.before // Glyph-sized or 44-point buttons.
    @State private var showHitAreas = true // Outlines what responds to touch.
    @State private var lastTap = "Nothing yet" // Which icon action ran last.
    @State private var remember = false // The whole-row toggle demo.

    var body: some View { // Rebuilt whenever a control changes.
        LessonPage(lesson: lesson) { // The shared scrolling page layout.
            DemoCard(title: "Safe areas and margins", caption: "A safe area is the part of the screen nothing covers. Layout margins are the standard gap to the screen edge: 16 pt on iPhone in portrait.") { // Concept step 1.
                Button("Show this phone's safe areas", systemImage: "rectangle.dashed") { showSafeAreas = true } // Opens the overlay.
                    .buttonStyle(.borderedProminent) // The card's main action.
                ConceptPoints(points: [ // The step's term and facts.
                    ("Point (pt)", "Apple's layout unit. One point is 2 or 3 pixels depending on the screen, so a 44 pt button is about the same physical size on every iPhone."), // Points.
                    ("Never hard-code insets", "The top inset changes from model to model (status bar, notch, Dynamic Island). The home indicator takes 34 pt on Face ID iPhones. SwiftUI keeps content inside the safe area for you."), // Insets.
                    ("Margins", "16 pt on iPhone in portrait, 20 pt on iPad and some wider layouts. Lists, navigation titles and a bare .padding() all line up on that margin."), // Margins.
                ])
            }
            .fullScreenCover(isPresented: $showSafeAreas) { SafeAreaOverlay() } // Full screen: the insets are the point.

            DemoCard(title: "Backgrounds bleed, content stays safe", caption: "The course's WelcomeView: the indigo runs edge to edge, the title and button stay inside the safe area. Get Started closes it.") { // Code step.
                Toggle("Try it: delete .ignoresSafeArea()", isOn: Binding(get: { !welcomeBleeds }, set: { welcomeBleeds = !$0 })) // What appears at the edges?
                Toggle("Try it: delete Spacer()", isOn: Binding(get: { !welcomeSpacer }, set: { welcomeSpacer = !$0 })) // Where does the button go?
                Button("Open WelcomeView", systemImage: "iphone") { showWelcome = true } // Opens it full screen.
                    .buttonStyle(.borderedProminent) // The card's main action.
                Text(!welcomeBleeds ? "Without .ignoresSafeArea() white bands appear above and below the indigo, where the status bar and home indicator live." : (!welcomeSpacer ? "Without the Spacer the button rides up under the title, far from the thumb." : "The Spacer pushes the only action to the bottom, where a thumb reaches it easily.")) // Explains the state.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }
            .fullScreenCover(isPresented: $showWelcome) { // Full screen, so the safe areas are real.
                WelcomeView(bleeds: welcomeBleeds, hasSpacer: welcomeSpacer) { showWelcome = false } // Get Started closes it.
            }

            DemoCard(title: "Spacing rhythm, alignment and grouping", caption: "Name your scale once and use the names everywhere. This app's Spacing enum is the course's: tight 4, item 8, group 24.") { // Concept step 2.
                ForEach(Spacing.allCases, id: \.self) { token in // One bar per design token.
                    HStack { // Name, then a bar as long as the value.
                        Text("Spacing.\(String(describing: token))").font(.caption.monospaced()).frame(width: 120, alignment: .leading) // The token's name.
                        RoundedRectangle(cornerRadius: 2).fill(.tint).frame(width: token.points * 4, height: 10) // Four screen points per spacing point, to see the ratio.
                        Text("\(Int(token.points)) pt").font(.caption) // The value.
                    }
                    .accessibilityElement(children: .combine) // One stop per token for VoiceOver.
                }
                Divider() // Then the proximity test.
                Text("Proximity: drag the two gaps.").font(.subheadline.weight(.semibold)) // A small heading.
                ProximitySample(inside: insideGap, between: betweenGap) // Two groups of two lines.
                Text("Inside a group: \(Int(insideGap)) pt").font(.subheadline) // The slider's visible label.
                Slider(value: $insideGap, in: 0...32, step: 4) { Text("Inside a group") } // The small gap.
                    .accessibilityValue("\(Int(insideGap)) points") // VoiceOver hears points.
                Text("Between groups: \(Int(betweenGap)) pt").font(.subheadline) // The slider's visible label.
                Slider(value: $betweenGap, in: 0...32, step: 4) { Text("Between groups") } // The large gap.
                    .accessibilityValue("\(Int(betweenGap)) points") // VoiceOver hears points.
                Text("Inside \(Int(insideGap)) pt, between \(Int(betweenGap)) pt: \(Grouping(inside: insideGap, between: betweenGap).verdict)") // The verdict.
                    .font(.footnote.weight(.semibold)) // Stands out a little.
                ConceptPoints(points: [ // The step's four points.
                    ("Proximity", "Things close together read as one group. Keep space inside a group clearly smaller than space between groups, for example 4 to 8 pt inside and 24 pt between."), // Proximity.
                    ("Alignment", "Line content up on a few shared edges, usually the 16 pt leading margin. A clean left edge lets the eye scan straight down."), // Alignment.
                    ("Consistency", "The same relationship always gets the same space. If a title sits 4 pt above its subtitle once, it does everywhere."), // Consistency.
                    ("Breathing room", "Cramped padding of 2 to 4 pt around text makes a screen feel unfinished and pushes tap targets into each other."), // Breathing room.
                ])
            }

            DemoCard(title: "Three spacing values build a hierarchy", caption: "The course's EventCard: 4 pt binds the title to its time, 8 pt separates the details, 24 pt separates the groups. Squint: two clumps.") { // Code step.
                PreviewSurface { // A piece of screen.
                    EventCard(outerSpacing: tightOuter ? 4 : 24, alignment: centered ? .center : .leading) // The course's card with its try-its.
                }
                Toggle("Try it: outer spacing 24 → 4", isOn: $tightOuter) // Can you still tell the groups apart?
                Toggle("Try it: outer alignment .center", isOn: $centered) // What happens to the left edge?
            }

            DemoCard(title: "Cramped and ragged versus grouped and aligned", caption: "Same four facts. Find the total in under a second in each version.") { // Compare step.
                BeforeAfterPicker(version: $summary, beforeLabel: "One gap, no edge", afterLabel: "Grouped on one edge") // Flip the version.
                PreviewSurface { // A piece of screen.
                    Group { // Either summary.
                        if summary == .before { PoorSummary() } else { BetterSummary() } // The two versions.
                    }
                    .padding() // Room around the card.
                }
                ConsoleView(lines: summary == .before // The spacing values each version uses, audited.
                    ? LayoutMetric.audit([("stack spacing", 2), ("one-off nudge", 11), ("card padding", 3)]) // The cramped values.
                    : LayoutMetric.audit([("inside a group", 4), ("extra top padding", 20), ("card padding", 16)]) + ["20 + 4 = 24 pt between the groups"]) // The scale values.
                VerdictBox(text: "Spacing is information. Small gaps say \"these belong together\", large gaps say \"new topic\", and a shared leading edge says \"read down here\". Arbitrary values like 11 pt and 3 pt make a screen feel unfinished.") // The verdict.
            }

            DemoCard(title: "44 points and the thumb", caption: "The minimum hit target is 44 × 44 pt, roughly 7 mm. The visual can be smaller than the hit area.") { // Concept step 3.
                ThumbZoneSketch() // Where a thumb reaches easily.
                ConceptPoints(points: [ // The step's three points.
                    ("Thumb zone", "People often hold the phone in one hand and tap with a thumb. The lower middle of the screen is easiest to reach; the top corners are hardest."), // Reach.
                    ("Primary actions", "Put frequent actions within easy reach, such as tab bars, bottom toolbars and a bottom button. Put rare or destructive ones farther away."), // Placement.
                    ("Whole rows", "In a list row, or a checkbox with a label, the whole row should respond, not just the small box. Tap the words below."), // Whole rows.
                ])
                Toggle("Remember me", isOn: $remember) // A Toggle with a label: the whole row responds.
            }

            DemoCard(title: "Tiny tap areas versus 44-point buttons", caption: "The icons look almost the same; what you can hit does not. Outlines show what responds to touch.") { // Compare step.
                BeforeAfterPicker(version: $actions, beforeLabel: "Glyph-sized", afterLabel: "44 pt buttons") // Flip the version.
                Toggle("Show hit areas", isOn: $showHitAreas) // Outline the responding areas.
                PreviewSurface(minHeight: 90) { // A piece of screen.
                    Group { // Either row of actions.
                        if actions == .before { // Bare images with tap gestures.
                            PoorActions(showHitAreas: showHitAreas) { lastTap = $0 } // The course's "before".
                        } else { // Real buttons framed to 44 pt.
                            BetterActions(showHitAreas: showHitAreas) { lastTap = $0 } // The course's "after".
                        }
                    }
                }
                Text("Last tap: \(lastTap)") // Feedback for each tap.
                    .font(.footnote.monospaced()) // Code-like.
                VerdictBox(text: "Keep the visual small if you like, but make every hit area at least 44 × 44 pt and space neighbors apart. Use a real Button, not a tap gesture, so it gets a pressed state and VoiceOver announces it as a button.") // The verdict.
            }

            DemoCard(title: "Touch target tester", caption: "Tap the sign-in screen: each tap lands where you aim plus a little random scatter, like a real finger. Or run 50 taps per target.") { // Widget step.
                TouchTargetTester() // The interactive tester.
            }
        }
    }
}

/// Two groups of two lines, spaced by the proximity sliders.
struct ProximitySample: View { // Shows grouping by proximity.
    let inside: CGFloat // Gap inside each group.
    let between: CGFloat // Gap between the groups.

    var body: some View { // Rebuilt when a slider moves.
        PreviewSurface { // A piece of screen.
            VStack(alignment: .leading, spacing: between) { // The between-group gap.
                VStack(alignment: .leading, spacing: inside) { // Group one.
                    Text("Design Review").font(.headline) // Title.
                    Text("Thursday, 3 PM").foregroundStyle(.secondary) // Its time.
                }
                VStack(alignment: .leading, spacing: inside) { // Group two.
                    Text("Room 4B").font(.headline) // A detail.
                    Text("6 people").foregroundStyle(.secondary) // Another detail.
                }
            }
            .padding(LayoutMetric.margin) // The standard 16 pt margin.
            .frame(maxWidth: .infinity, alignment: .leading) // Leading-aligned.
        }
    }
}

/// A phone outline shaded by how easy each region is to reach with one thumb.
struct ThumbZoneSketch: View { // For "44 points and the thumb".
    var body: some View { // Built once.
        ZStack { // The phone, then the zones.
            RoundedRectangle(cornerRadius: 24).stroke(.secondary, lineWidth: 2) // The phone's outline.
            VStack(spacing: 0) { // Three horizontal bands.
                zone("Hard: top corners", .red.opacity(0.18)) // The top third.
                zone("Okay: middle", .orange.opacity(0.18)) // The middle third.
                zone("Easy: lower middle", .green.opacity(0.22)) // The bottom third.
            }
            .clipShape(.rect(cornerRadius: 24)) // Inside the phone.
        }
        .frame(width: 150, height: 260) // A small phone.
        .frame(maxWidth: .infinity) // Centered.
        .accessibilityElement(children: .combine) // One stop for VoiceOver.
    }

    /// One labeled band.
    private func zone(_ label: String, _ color: Color) -> some View { // Shared by the three bands.
        color.overlay { Text(label).font(.caption.weight(.semibold)).multilineTextAlignment(.center).padding(4) } // Color with its label.
    }
}

/// This phone's real safe areas and 16 pt margins, measured with GeometryReader.
struct SafeAreaOverlay: View { // Shown full screen from "Safe areas and margins".
    @Environment(\.dismiss) private var dismiss // Closes the cover.

    var body: some View { // Rebuilt if the phone rotates.
        GeometryReader { proxy in // Reads the size and the safe-area insets.
            let insets = proxy.safeAreaInsets // Top, bottom, leading, trailing, in points.
            ZStack(alignment: .top) { // The bands and guides, layered.
                Color.red.opacity(0.25).frame(height: insets.top) // The unsafe top area.
                    .overlay(alignment: .bottom) { Text("Top inset: \(Int(insets.top)) pt").font(.caption.bold()).padding(4) } // Its size.
                Color.red.opacity(0.25).frame(height: insets.bottom) // The unsafe bottom area.
                    .overlay(alignment: .top) { Text("Bottom inset: \(Int(insets.bottom)) pt").font(.caption.bold()).padding(4) } // Its size.
                    .offset(y: insets.top + proxy.size.height) // Below the safe area.
                HStack { // The two margin guides.
                    Rectangle().fill(.blue).frame(width: 1) // Leading margin line.
                    Spacer() // Room between the guides.
                    Rectangle().fill(.blue).frame(width: 1) // Trailing margin line.
                }
                .padding(.horizontal, LayoutMetric.margin) // 16 pt from each edge.
                .frame(height: proxy.size.height) // The safe height.
                .offset(y: insets.top) // Starts at the safe area.
                VStack(spacing: 12) { // The explanation in the middle.
                    Text("Safe area: \(Int(proxy.size.width)) × \(Int(proxy.size.height)) pt").font(.headline) // The usable size.
                    Text("Red: covered by the status bar, Dynamic Island or home indicator. Blue: the 16 pt layout margins.").font(.subheadline).multilineTextAlignment(.center) // A key.
                    Button("Close") { dismiss() } // The way out.
                        .buttonStyle(.borderedProminent) // Easy to find.
                }
                .padding(.horizontal, 32) // Inside the margins.
                .offset(y: insets.top + proxy.size.height / 2 - 60) // Near the middle of the safe area.
            }
            .ignoresSafeArea() // Draw over the whole screen, including the unsafe parts.
        }
        .background(Color(.systemBackground)) // A plain screen.
    }
}

/// The tap tester: the course's sign-in screen, drawn to scale, tapped with finger scatter.
struct TouchTargetTester: View { // From the course's "Touch target tester" widget.
    @State private var showAreas = true // Outline what responds.
    @State private var fixed = false // Grow every hit area to 44 × 44 pt.
    @State private var generator = SeededGenerator(seed: 2026) // Repeatable scatter.
    @State private var lastLanding: CGPoint? // Where the last tap landed, in points.
    @State private var message = "Tap anything on the screen." // Feedback for the last tap.
    @State private var results: [String] = [] // The 50-tap report.
    private let simulator = TapSimulator() // 8 pt of finger scatter.
    private let scale: CGFloat = 0.6 // Draws the 393 pt wide screen 236 pt wide.

    var body: some View { // Rebuilt after every tap.
        VStack(alignment: .leading, spacing: 10) { // Controls, screen, report.
            Toggle("Hit areas", isOn: $showAreas) // Show what responds.
            Toggle("Fix targets (44 × 44 pt)", isOn: $fixed) // Grow the small ones.
            screen // The scaled sign-in screen.
                .frame(maxWidth: .infinity) // Centered.
            Text(message).font(.footnote.weight(.semibold)) // What the last tap did.
            Button("Run 50 taps per target", systemImage: "hand.tap") { runBatch() } // The keyboard-free batch.
                .buttonStyle(.bordered) // Secondary action.
            if !results.isEmpty { ConsoleView(lines: results) } // The report.
        }
    }

    /// The sign-in screen at 60 percent scale, with optional hit-area outlines.
    private var screen: some View { // One drawing, many taps.
        ZStack(alignment: .topLeading) { // Everything placed by its point coordinates.
            RoundedRectangle(cornerRadius: 24).fill(Color(.systemBackground)) // The screen.
            RoundedRectangle(cornerRadius: 24).stroke(.secondary) // Its edge.
            ForEach(SignInScreen.targets) { target in // Each control, drawn at its visual size.
                visual(for: target) // What people see.
                    .frame(width: target.rect.width * scale, height: target.rect.height * scale) // Its size, scaled.
                    .offset(x: target.rect.minX * scale, y: target.rect.minY * scale) // Its position, scaled.
                if showAreas { // The responding area.
                    let area = fixed ? target.fixedRect : target.rect // Before or after the fix.
                    Rectangle().stroke(target.meetsMinimum || fixed ? Color.green : Color.red, style: StrokeStyle(lineWidth: 1, dash: [3])) // Dashed outline.
                        .frame(width: area.width * scale, height: area.height * scale) // Scaled size.
                        .offset(x: area.minX * scale, y: area.minY * scale) // Scaled position.
                }
            }
            if let lastLanding { // Where the finger last landed.
                Circle().fill(.blue.opacity(0.5)).frame(width: 8, height: 8) // A dot.
                    .offset(x: lastLanding.x * scale - 4, y: lastLanding.y * scale - 4) // Centered on the point.
            }
        }
        .frame(width: SignInScreen.size.width * scale, height: SignInScreen.size.height * scale) // The scaled screen.
        .contentShape(Rectangle()) // The whole screen accepts taps.
        .onTapGesture(coordinateSpace: .local) { location in // Where the student aimed.
            let aim = CGPoint(x: location.x / scale, y: location.y / scale) // Back to screen points.
            let landing = simulator.landingPoint(aimingAt: aim, using: &generator) // Add finger scatter.
            lastLanding = landing // Remember for the dot.
            let aimed = TapSimulator.area(at: aim, in: SignInScreen.targets, fixed: fixed) // What the student meant.
            let landed = TapSimulator.area(at: landing, in: SignInScreen.targets, fixed: fixed) // What actually responded.
            switch (aimed, landed) { // Compare intention and result.
            case let (a?, l?) where a.id == l.id: message = "Hit: \(l.name)." // Exactly what was meant.
            case let (a?, l?): message = "Meant \(a.name), but \(l.name) responded!" // A neighbor stole the tap.
            case let (a?, nil): message = "Missed \(a.name): the finger landed outside its hit area." // A miss.
            case let (nil, l?): message = "\(l.name) responded." // Aimed at empty space, hit something.
            case (nil, nil): message = "Nothing there." // Empty space.
            }
        }
        .accessibilityElement(children: .ignore) // The scaled drawing is one picture for VoiceOver...
        .accessibilityLabel("Sign-in screen drawn at 60 percent; use Run 50 taps per target for results.") // ...with an alternative.
    }

    /// The visual look of one control.
    @ViewBuilder private func visual(for target: HitArea) -> some View { // Different controls look different.
        switch target.id { // Pick by id.
        case "email", "password": RoundedRectangle(cornerRadius: 4).fill(.fill.tertiary) // Text fields.
        case "signin": RoundedRectangle(cornerRadius: 6).fill(.tint) // The big button.
        case "forgot": Rectangle().fill(.tint.opacity(0.35)) // A text link.
        case "remember": RoundedRectangle(cornerRadius: 2).stroke(.secondary) // A checkbox.
        default: Circle().fill(.secondary.opacity(0.5)) // Small round icons.
        }
    }

    /// Fifty simulated taps per target, as built or fixed.
    private func runBatch() { // Called by the button.
        results = SignInScreen.targets.map { target in // One report line per target.
            let rate = simulator.hitRate(for: target, among: SignInScreen.targets, fixed: fixed, taps: 50, seed: 2026) // Repeatable.
            let size = fixed ? target.fixedRect.size : target.rect.size // The size being tested.
            return "\(target.name): \(Int(size.width))×\(Int(size.height)) pt, \(Int((rate * 100).rounded()))% hits" // The finding.
        }
        message = fixed ? "Fixed: every target is at least 44 × 44 pt." : "As built: the small targets miss often." // A summary.
    }
}

// MARK: - The course's examples

/// The course's WelcomeView, with its two try-its and a way to close it.
struct WelcomeView: View { // From "Backgrounds bleed, content stays safe".
    var bleeds = true // The course uses .ignoresSafeArea().
    var hasSpacer = true // The course pushes the button down with a Spacer.
    var onStart: () -> Void = {} // In this app, Get Started closes the screen.

    var body: some View { // Background behind, content in front.
        ZStack { // Layers.
            if bleeds { // The course's version.
                Color.indigo.ignoresSafeArea() // Fills the whole screen, edge to edge.
            } else { // The try-it.
                Color.indigo // Stops at the safe area, leaving bands.
            }
            VStack(spacing: 16) { // The content stays in the safe area.
                Text("Welcome") // The title.
                    .font(.largeTitle) // 34 pt by default.
                    .foregroundStyle(.white) // Readable on indigo.
                if hasSpacer { Spacer() } // Pushes the button to the bottom.
                Button("Get Started") { onStart() } // The only action.
                    .buttonStyle(.borderedProminent) // Filled.
                    .tint(.white) // A white fill...
                    .foregroundStyle(.indigo) // ...with indigo text.
            }
            .padding() // Standard margins.
        }
    }
}

/// The course's EventCard, with its try-its as parameters.
struct EventCard: View { // From "Three spacing values build a hierarchy".
    var outerSpacing: CGFloat = 24 // 24 in the course (Spacing.group).
    var alignment: HorizontalAlignment = .leading // Leading in the course.

    var body: some View { // Two groups, three spacing values.
        VStack(alignment: alignment, spacing: outerSpacing) { // 24 pt between groups.
            VStack(alignment: .leading, spacing: 4) { // 4 pt binds the title to its time.
                Text("Design Review") // The title.
                    .font(.title2) // 22 pt by default.
                Text("Thursday, 3 PM") // Its time.
                    .foregroundStyle(.secondary) // Quieter.
            }
            VStack(alignment: .leading, spacing: 8) { // 8 pt between details.
                Label("Room 4B", systemImage: "mappin") // Where.
                Label("6 people", systemImage: "person.2") // Who.
            }
        }
        .padding(16) // The standard margin.
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .center) // Full width.
    }
}

/// The course's cramped summary.
struct PoorSummary: View { // The "before".
    var body: some View { // One gap for everything.
        VStack(spacing: 2) { // 2 pt everywhere, centered.
            Text("Order #1042") // Same style as everything else.
            Text("Arrives Friday") // Belongs with the order, but nothing says so.
            Text("2 items").padding(.leading, 11) // An arbitrary nudge.
            Text("Total $48.00") // The key number, unemphasized.
        }
        .padding(3) // Text crowds the edge.
        .background(.thinMaterial) // The card.
    }
}

/// The course's grouped summary.
struct BetterSummary: View { // The "after".
    var body: some View { // Grouped on one edge.
        VStack(alignment: .leading, spacing: 4) { // 4 pt inside groups, one leading edge.
            Text("Order #1042").font(.headline) // Where reading starts.
            Text("Arrives Friday").foregroundStyle(.secondary) // Attached to the order.
            Text("2 items").padding(.top, 20) // 20 + 4 = 24 pt: a new group.
            Text("Total $48.00").bold() // Found at a glance.
        }
        .padding(16) // The iPhone margin.
        .frame(maxWidth: .infinity, alignment: .leading) // Full width.
        .background(.thinMaterial) // Same card.
    }
}

extension LayoutSpacingLesson { // Nested here because lesson 5.6 has its own PoorActions and BetterActions.
    /// The course's glyph-sized tap targets.
    struct PoorActions: View { // The "before" of "Tiny tap areas versus 44-point buttons".
        var showHitAreas = false // Demo only: outline what responds.
        var onTap: (String) -> Void = { _ in } // Demo only: report which action ran.

        var body: some View { // Two bare images.
            HStack(spacing: 6) { // 6 pt apart.
                Image(systemName: "heart") // About 20 pt across.
                    .border(showHitAreas ? Color.red : .clear) // The hit area is the glyph.
                    .onTapGesture { onTap("Favorite") } // Not a button.
                Image(systemName: "trash") // The destructive action...
                    .font(.caption) // ...is the smallest target.
                    .border(showHitAreas ? Color.red : .clear) // A tiny hit area.
                    .onTapGesture { onTap("Delete") } // Not a button.
            }
        }
    }

    /// The course's 44-point buttons.
    struct BetterActions: View { // The "after".
        var showHitAreas = false // Demo only: outline what responds.
        var onTap: (String) -> Void = { _ in } // Demo only: report which action ran.

        var body: some View { // Two real buttons.
            HStack(spacing: 24) { // 24 pt apart.
                Button { onTap("Favorite") } label: { // A real Button.
                    Label("Favorite", systemImage: "heart") // The title is the spoken label.
                        .frame(width: 44, height: 44) // A 44 × 44 pt hit area.
                        .border(showHitAreas ? Color.green : .clear) // Shows the whole responding square.
                }
                Button { onTap("Delete") } label: { // A second real Button.
                    Label("Delete", systemImage: "trash") // Back at normal size.
                        .frame(width: 44, height: 44) // The same hit area.
                        .border(showHitAreas ? Color.green : .clear) // Shows the responding square.
                }
            }
            .labelStyle(.iconOnly) // Icons on screen, words for VoiceOver.
        }
    }
}

#Preview("Lesson 5.5") { // The whole lesson in Xcode's canvas.
    NavigationStack { LayoutSpacingLesson(lesson: ContentView.lessons[4]) } // Inside a stack, as in the app.
}

#Preview("EventCard") { EventCard() } // The course's preview.

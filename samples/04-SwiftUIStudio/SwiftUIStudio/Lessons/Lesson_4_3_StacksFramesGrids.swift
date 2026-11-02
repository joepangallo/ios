// Lesson_4_3_StacksFramesGrids.swift
// Who: the student who opens lesson 4.3 from the home screen.
// What: the "Stacks, Frames, and Grids" page: the propose, choose, place conversation,
//       HStack and VStack alignment and spacing, a ZStack badge, Spacer and full-width
//       frames, the layout lab, and a scrolling LazyVGrid (plus a small Grid).
// Where: pushed onto the app's NavigationStack by ContentView.
// When: built when the lesson opens; each card redraws when its own controls change.
// Why: layout in SwiftUI is described, not computed by hand. Moving the controls and
//      watching which views hug their content and which take the leftover space is
//      the fastest way to learn the rules.

import SwiftUI // Stacks, Spacer, frames, grids and ScrollView.

/// Lesson 4.3: stacks, frames, and grids.
struct StacksFramesGridsLesson: View { // One screen per lesson.
    let lesson: Lesson // Number, title and summary from the home screen.

    var body: some View { // The page: one card per course step.
        LessonPage(lesson: lesson) { // Scrolling page with the summary on top.
            LayoutConversationCard() // Concept: How SwiftUI lays out a screen.
            ContactHeaderCard() // Code: Stacks, alignment, and spacing.
            InboxIconCard() // Code: ZStack: views on top of views.
            WorkoutCardCard() // Code: Spacer and full-width frames.
            LayoutLabCard() // Widget: Layout lab.
            PhotoGridCard() // Code: Scrolling grids with LazyVGrid.
        }
    }
}

// MARK: - Turning the lab's choices into SwiftUI alignments

extension LabHorizontal { // The model stays SwiftUI-free; the conversion lives with the views.
    /// The SwiftUI alignment for a VStack.
    var alignment: HorizontalAlignment { // VStack(alignment:) takes a HorizontalAlignment.
        switch self { // One per case.
        case .leading: .leading // Left edges line up.
        case .center: .center // Middles line up.
        case .trailing: .trailing // Right edges line up.
        }
    }
}

extension LabVertical { // Same idea for HStack.
    /// The SwiftUI alignment for an HStack.
    var alignment: VerticalAlignment { // HStack(alignment:) takes a VerticalAlignment.
        switch self { // One per case.
        case .top: .top // Top edges line up.
        case .center: .center // Middles line up.
        case .bottom: .bottom // Bottom edges line up.
        }
    }
}

extension LabCorner { // Same idea for ZStack.
    /// The SwiftUI alignment for a ZStack.
    var alignment: Alignment { // ZStack(alignment:) takes a two-way Alignment.
        switch self { // One per case.
        case .topLeading: .topLeading // Top left.
        case .top: .top // Top middle.
        case .topTrailing: .topTrailing // Top right.
        case .leading: .leading // Middle left.
        case .center: .center // Center.
        case .trailing: .trailing // Middle right.
        case .bottomLeading: .bottomLeading // Bottom left.
        case .bottom: .bottom // Bottom middle.
        case .bottomTrailing: .bottomTrailing // Bottom right.
        }
    }
}

// MARK: - How SwiftUI lays out a screen

/// Concept: How SwiftUI lays out a screen.
private struct LayoutConversationCard: View { // One card.
    @State private var offered = 240.0 // 1. Propose: the width the parent offers.
    @State private var place = LabHorizontal.leading // 3. Place: where the parent puts a narrower child.
    @State private var textWidth = 0.0 // 2. Choose: what the Text picked, measured after layout.
    @State private var colorWidth = 0.0 // 2. Choose: what the Color picked.
    @Environment(\.displayScale) private var displayScale // Pixels per point on this screen.

    var body: some View { // Redraws when the slider or the measurements change.
        DemoCard(title: "How SwiftUI lays out a screen", caption: "1. Propose: the parent offers each child a size. 2. Choose: the child picks its own size; Text takes just enough for its words, Color takes everything offered. 3. Place: the parent positions the child using its alignment.") { // The card.
            VStack(alignment: place.alignment, spacing: 8) { // The parent: offers a width, then places.
                Text("Hug") // A Text hugs its words.
                    .padding(6) // A little room so the background is visible.
                    .background(.yellow) // Shows the Text's chosen size.
                    .onGeometryChange(for: Double.self) { $0.size.width } action: { textWidth = $0 } // Reads the width it chose.
                Color.teal // A Color takes all the width it is offered.
                    .frame(height: 24) // Only the height is fixed.
                    .onGeometryChange(for: Double.self) { $0.size.width } action: { colorWidth = $0 } // Reads the width it chose.
            }
            .frame(width: offered) // The proposal: this many points wide.
            .border(.gray) // Outlines the space offered.
            .frame(maxWidth: .infinity) // Center the experiment in the card.
            Slider(value: $offered, in: 80...280, step: 10) // Change the proposal.
            Picker("Place", selection: $place) { // Change how the parent places the narrower child.
                ForEach(LabHorizontal.allCases) { Text($0.rawValue).tag($0) } // leading, center, trailing.
            }
            .pickerStyle(.segmented) // Side by side.
            ValueRow(name: "offered", value: "\(Int(offered)) pt") // 1. The proposal.
            ValueRow(name: "Text chose", value: "\(Int(textWidth.rounded())) pt") // 2. The Text's choice, which ignores the offer.
            ValueRow(name: "Color chose", value: "\(Int(colorWidth.rounded())) pt") // 2. The Color's choice, which is the offer.
            Text("Point: the unit of layout. On this screen one point is \(Int(displayScale)) by \(Int(displayScale)) physical pixels. Let content decide size: stacks, Spacer, padding and .frame(maxWidth: .infinity) fit every device.") // The Point term and the callout.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - Stacks, alignment, and spacing

/// The course's ContactHeaderView, with the challenges as inputs.
struct ContactHeaderView: View { // `struct ContactHeaderView: View`
    var textAlignment = LabHorizontal.leading // Challenge 1: the VStack's alignment.
    var rowAlignment = LabVertical.top // Challenge 2: the HStack's alignment.
    var spacing: CGFloat = 16 // Challenge 3: the HStack's spacing.

    var body: some View { // An avatar beside a column of text.
        HStack(alignment: rowAlignment.alignment, spacing: spacing) { // .top and 16 in the course.
            Image(systemName: "person.circle") // The avatar.
                .font(.system(size: 56)) // Big.
                .foregroundStyle(.tint) // Accent color.
            VStack(alignment: textAlignment.alignment, spacing: 4) { // A stack inside a stack.
                Text("Mia Chen") // The name.
                    .font(.title2) // Large.
                    .bold() // Heavy.
                Text("Study group: Mobile Apps") // The group.
                    .foregroundStyle(.secondary) // Softer.
                Text("3 unread messages").font(.footnote) // Small detail.
            }
        }
        .padding() // Space around the header.
    }
}

/// Code: Stacks, alignment, and spacing.
private struct ContactHeaderCard: View { // One card.
    @State private var textAlignment = LabHorizontal.leading // Starts like the course.
    @State private var rowAlignment = LabVertical.top // Starts like the course.
    @State private var wide = false // Challenge 3: 16 or 48 points.

    var body: some View { // Redraws when a choice changes.
        DemoCard(title: "Stacks, alignment, and spacing", caption: "An HStack places the avatar beside a VStack of text. alignment lines children up across the stack; spacing is the gap between them.") { // The card.
            ContactHeaderView(textAlignment: textAlignment, rowAlignment: rowAlignment, spacing: wide ? 48 : 16) // The live header.
                .frame(maxWidth: .infinity, alignment: .leading) // Leading, full width.
                .demoPanel() // On a plain panel.
            Text("VStack(alignment:)") // Heading for challenge 1.
                .font(.footnote.monospaced()) // Code font.
            Picker("VStack alignment", selection: $textAlignment.animation()) { // Challenge 1, animated.
                ForEach(LabHorizontal.allCases) { Text("." + $0.rawValue).tag($0) } // .leading, .center, .trailing.
            }
            .pickerStyle(.segmented) // Side by side.
            Text("HStack(alignment:)") // Heading for challenge 2.
                .font(.footnote.monospaced()) // Code font.
            Picker("HStack alignment", selection: $rowAlignment.animation()) { // Challenge 2: watch the avatar move.
                ForEach(LabVertical.allCases) { Text("." + $0.rawValue).tag($0) } // .top, .center, .bottom.
            }
            .pickerStyle(.segmented) // Side by side.
            Toggle("spacing: 48 instead of 16", isOn: $wide.animation()) // Challenge 3.
        }
    }
}

// MARK: - ZStack: views on top of views

/// The course's InboxIconView, with the challenges as inputs.
struct InboxIconView: View { // `struct InboxIconView: View`
    var unread = "3" // Challenge 1: "128" stretches the capsule.
    var corner = LabCorner.topTrailing // Challenge 2: .bottomLeading.
    var badgeFirst = false // Challenge 3: the badge written above the Image.

    var body: some View { // Children layered back to front.
        ZStack(alignment: corner.alignment) { // .topTrailing in the course.
            if badgeFirst { badge } // Written first, so drawn underneath.
            Image(systemName: "envelope") // The mail icon.
                .font(.system(size: 64)) // Big.
                .padding(8) // Room for the badge to overlap the corner.
            if !badgeFirst { badge } // Written last, so drawn on top (the course's order).
        }
    }

    /// The red unread badge.
    private var badge: some View { // One definition used in either position.
        Text(unread) // The count.
            .font(.caption) // Small.
            .bold() // Heavy.
            .foregroundStyle(.white) // White on red.
            .padding(.horizontal, 6) // Room at the sides.
            .frame(minWidth: 24, minHeight: 24) // Never smaller than a circle.
            .background(.red) // The badge color.
            .clipShape(Capsule()) // A circle for one digit, a pill for more.
    }
}

/// Code: ZStack: views on top of views.
private struct InboxIconCard: View { // One card.
    @State private var manyUnread = false // Challenge 1.
    @State private var corner = LabCorner.topTrailing // Challenge 2.
    @State private var badgeFirst = false // Challenge 3.

    var body: some View { // Redraws when a choice changes.
        DemoCard(title: "ZStack: views on top of views", caption: "A ZStack layers its children back to front; the last child is drawn on top. Its alignment decides where smaller children sit.") { // The card.
            InboxIconView(unread: manyUnread ? "128" : "3", corner: corner, badgeFirst: badgeFirst) // The live icon.
                .frame(maxWidth: .infinity) // Centered.
                .padding(.vertical) // Air above and below.
                .demoPanel() // On a plain panel.
            Toggle("Change \"3\" to \"128\"", isOn: $manyUnread) // Challenge 1.
            LabeledContent("ZStack(alignment:)") { // A label beside the menu, so it is clear what the menu sets.
                Picker("ZStack alignment", selection: $corner) { // Challenge 2: any of the nine positions.
                    ForEach(LabCorner.allCases) { Text("." + $0.rawValue).tag($0) } // Code names.
                }
                .pickerStyle(.menu) // Nine options: a menu.
            }
            Toggle("Write the badge above the Image", isOn: $badgeFirst) // Challenge 3: later children draw on top.
            Text("With the badge written first, the envelope is drawn over it where they overlap.") // What challenge 3 shows.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - Spacer and full-width frames

/// The course's WorkoutCardView, with the challenges as inputs.
struct WorkoutCardView: View { // `struct WorkoutCardView: View`
    var spacer = true // Challenge 1: delete Spacer().
    var fullWidth = true // Challenge 2: delete .frame(maxWidth: .infinity).
    var leadingSpacer = false // Challenge 3: a second Spacer() before the name.
    @State private var isRunning = false // Started or paused.

    var body: some View { // A row and a button.
        VStack(spacing: 20) { // Row above button.
            HStack { // Name and status.
                if leadingSpacer { Spacer() } // Challenge 3: the two spacers split the free space.
                Text("Upper body") // The workout's name.
                if spacer { Spacer() } // Takes all free space, pushing the status to the trailing edge.
                Text(isRunning ? "Running" : "45 min") // The status, derived from isRunning.
            }
            Button { isRunning.toggle() } label: { // Start or pause.
                Text(isRunning ? "Pause" : "Start workout") // The title, derived from isRunning.
                    .frame(maxWidth: fullWidth ? .infinity : nil) // As wide as the parent allows, or just the title.
            }
            .buttonStyle(.borderedProminent) // Filled.
        }
        .padding() // Space around the card.
    }
}

/// Code: Spacer and full-width frames.
private struct WorkoutCardCard: View { // One card.
    @State private var spacer = true // Challenge 1.
    @State private var fullWidth = true // Challenge 2.
    @State private var leadingSpacer = false // Challenge 3.

    var body: some View { // Redraws when a choice changes.
        DemoCard(title: "Spacer and full-width frames", caption: "A Spacer is a flexible empty view that takes the free space along its stack. .frame(maxWidth: .infinity) lets a view grow as wide as its parent allows. Tap the button to start and pause.") { // The card.
            WorkoutCardView(spacer: spacer, fullWidth: fullWidth, leadingSpacer: leadingSpacer) // The live card.
                .demoPanel() // On a plain panel.
            Toggle("Spacer() between name and status", isOn: $spacer.animation()) // Challenge 1.
            Toggle(".frame(maxWidth: .infinity) on the title", isOn: $fullWidth.animation()) // Challenge 2.
            Toggle("A second Spacer() before the name", isOn: $leadingSpacer.animation()) // Challenge 3.
        }
    }
}

// MARK: - Layout lab

/// Widget: Layout lab.
private struct LayoutLabCard: View { // One card.
    @State private var settings = LayoutLabSettings() // Every choice, in one value.

    var body: some View { // Redraws whenever a setting changes.
        DemoCard(title: "Layout lab", caption: "Choose a stack, alignment, spacing and padding, add a Spacer, or stretch a child. Watch which views hug their content and which take the leftover space; the yellow shows the stack's final size.") { // The card.
            labStack // The live result.
                .frame(maxWidth: .infinity, maxHeight: .infinity) // The pretend screen offers all its space...
                .frame(height: 200) // ...which is 200 points tall.
                .demoPanel() // On a plain panel.
            Picker("Stack", selection: $settings.stack.animation()) { // VStack, HStack or ZStack.
                ForEach(LabStack.allCases) { Text($0.rawValue).tag($0) } // One segment each.
            }
            .pickerStyle(.segmented) // Side by side.
            alignmentPicker // The alignment that fits the chosen stack.
            if settings.stack != .zStack { // A ZStack overlaps its children: no spacing, no Spacer.
                Stepper("spacing: \(settings.spacing)", value: $settings.spacing.animation(), in: 0...48, step: 4) // Gap between children.
                LabeledContent("Spacer()") { // A label beside the menu.
                    Picker("Spacer", selection: $settings.spacer.animation()) { // Where a Spacer goes.
                        ForEach(LabSpacer.allCases) { Text($0.rawValue).tag($0) } // Three positions.
                    }
                    .pickerStyle(.menu) // A compact pop-up.
                }
            }
            Stepper("padding: \(settings.padding)", value: $settings.padding.animation(), in: 0...32, step: 4) // Padding around the stack.
            Toggle("Stretch the name: .frame(maxWidth: .infinity)", isOn: $settings.stretchName.animation()) // One flexible child.
            Picker("Frame", selection: $settings.frame.animation()) { // How the whole stack is framed.
                ForEach(LabFrame.allCases) { Text($0.rawValue).tag($0) } // Hug, fill, fill leading.
            }
            .pickerStyle(.segmented) // Side by side.
            CodeBlock(lines: settings.codeLines) // The code these settings stand for.
        }
    }

    /// The alignment control for the chosen stack type.
    @ViewBuilder private var alignmentPicker: some View { // Each stack takes a different kind of alignment.
        switch settings.stack { // One picker per stack type.
        case .vStack: // A column lines children up horizontally.
            Picker("VStack alignment", selection: $settings.vStackAlignment.animation()) { // leading, center, trailing.
                ForEach(LabHorizontal.allCases) { Text($0.rawValue).tag($0) } // One segment each.
            }
            .pickerStyle(.segmented) // Side by side.
        case .hStack: // A row lines children up vertically.
            Picker("HStack alignment", selection: $settings.hStackAlignment.animation()) { // top, center, bottom.
                ForEach(LabVertical.allCases) { Text($0.rawValue).tag($0) } // One segment each.
            }
            .pickerStyle(.segmented) // Side by side.
        case .zStack: // Layers line up in two directions.
            LabeledContent("alignment") { // A label beside the menu.
                Picker("ZStack alignment", selection: $settings.zStackAlignment.animation()) { // Nine positions.
                    ForEach(LabCorner.allCases) { Text($0.rawValue).tag($0) } // One option each.
                }
                .pickerStyle(.menu) // Nine options: a menu.
            }
        }
    }

    /// The stack described by the settings, built for real.
    private var labStack: some View { // Mirrors settings.codeLines line for line.
        let layout: AnyLayout = switch settings.stack { // AnyLayout lets one view switch between stack types.
        case .vStack: AnyLayout(VStackLayout(alignment: settings.vStackAlignment.alignment, spacing: CGFloat(settings.spacing))) // A column.
        case .hStack: AnyLayout(HStackLayout(alignment: settings.hStackAlignment.alignment, spacing: CGFloat(settings.spacing))) // A row.
        case .zStack: AnyLayout(ZStackLayout(alignment: settings.zStackAlignment.alignment)) // Layers.
        }
        let showsSpacers = settings.stack != .zStack // Spacers only mean something in a row or a column.
        return layout { // The three children.
            Image(systemName: "cup.and.saucer") // Child one.
                .font(.largeTitle) // Big.
            if showsSpacers && settings.spacer == .afterFirst { Spacer() } // Spacer after the cup.
            Text("Cappuccino") // Child two.
                .frame(maxWidth: settings.stretchName ? .infinity : nil) // Stretched, or hugging its words.
                .background(settings.stretchName ? Color.orange.opacity(0.25) : Color.clear) // Shows the stretched width.
            if showsSpacers && settings.spacer == .afterSecond { Spacer() } // Spacer after the name.
            Text("Large, oat milk") // Child three.
                .font(.caption) // Small.
        }
        .padding(CGFloat(settings.padding)) // Padding around the stack.
        .frame(maxWidth: settings.frame == .hug ? nil : .infinity, alignment: settings.frame == .leading ? .leading : .center) // The frame choice.
        .background(.yellow.opacity(0.3)) // The stack's final size.
    }
}

// MARK: - Scrolling grids with LazyVGrid

/// The course's PhotoGridView, with the challenges as inputs and a count of built cells.
struct PhotoGridView: View { // `struct PhotoGridView: View`
    var columnCount = 2 // Challenge 1: a third GridItem.
    var cellHeight: CGFloat = 100 // Challenge 2: 180.
    var photoCount = 40 // Challenge 3: 1..<201.
    @Binding var built: Set<Int> // The numbers of cells built so far, reported to the card.

    var body: some View { // A scrolling grid.
        let columns = Array(repeating: GridItem(.flexible()), count: columnCount) // `[GridItem(.flexible()), GridItem(.flexible())]`
        ScrollView { // Content taller than its frame scrolls.
            LazyVGrid(columns: columns, spacing: 12) { // Builds each cell only when it is about to scroll into view.
                ForEach(1..<(photoCount + 1), id: \.self) { number in // `ForEach(1..<41)`
                    Text("Photo \(number)") // A placeholder for a photo.
                        .frame(maxWidth: .infinity, minHeight: cellHeight) // Fills its column, at least this tall.
                        .background(.teal) // Colored tile.
                        .clipShape(RoundedRectangle(cornerRadius: 10)) // Rounded corners.
                        .onAppear { built.insert(number) } // Runs when the lazy grid builds this cell.
                }
            }
            .padding() // Space around the grid.
        }
    }
}

/// Code: Scrolling grids with LazyVGrid.
private struct PhotoGridCard: View { // One card.
    @State private var threeColumns = false // Challenge 1.
    @State private var tall = false // Challenge 2.
    @State private var many = false // Challenge 3.
    @State private var built: Set<Int> = [] // Cells the lazy grid has built.

    var body: some View { // Redraws when a choice or the built count changes.
        DemoCard(title: "Scrolling grids with LazyVGrid", caption: "ScrollView lets content taller than its frame scroll. LazyVGrid arranges items in columns and creates each cell only when it is about to scroll into view. Scroll inside the grid.") { // The card.
            PhotoGridView(columnCount: threeColumns ? 3 : 2, cellHeight: tall ? 180 : 100, photoCount: many ? 200 : 40, built: $built) // The live grid.
                .frame(height: 300) // A window onto the grid.
                .demoPanel() // On a plain panel.
            ValueRow(name: "cells built so far", value: "\(built.count) of \(many ? 200 : 40)") // Laziness, made visible.
            Toggle("A third GridItem(.flexible())", isOn: $threeColumns) // Challenge 1.
            Toggle("minHeight: 180", isOn: $tall) // Challenge 2.
            Toggle("1..<201 photos", isOn: $many) // Challenge 3.
            Text("For a small table that never scrolls, Grid with GridRow lines up columns:") // The step's last sentence.
                .font(.footnote) // Small.
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 6) { // A non-lazy grid.
                GridRow { Text("Day").bold(); Text("Minutes studied").bold() } // Header row.
                GridRow { Text("Monday"); Text("30") } // Row 1.
                GridRow { Text("Tuesday"); Text("45") } // Row 2: columns line up with the row above.
            }
            .font(.footnote) // Small table.
            .demoPanelPadding() // On a plain panel.
        }
    }
}

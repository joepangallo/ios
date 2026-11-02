// ViewLabsTests.swift
// Who: the Swift Testing runner.
// What: checks the code the labs generate: ProfileCardView's tree outline (4.1), the
//       modifier stack lab (4.2) and the layout lab (4.3).
// Where: the SwiftUIStudioTests target.
// When: whenever the tests run.
// Why: the generated code must match what the preview draws; these tests pin the
//      exact lines a student would type.

import Testing // @Test, #expect.
@testable import SwiftUIStudio // The app's internal types.

@MainActor // The models live on the main actor.
struct ViewTreeOutlineTests { // Lesson 4.1.
    @Test func courseTreeHasPaddingAtTheRoot() { // The course's ProfileCardView.
        let lines = ViewTreeOutline.lines(name: "Ada Lovelace", horizontal: false, includesCity: false) // The default card.
        #expect(lines == [ // Outermost first.
            "padding", // Root.
            "  VStack(spacing: 8)", // Container.
            "    Image(systemName: \"person.circle\")", // Child 1.
            "    Text(\"Ada Lovelace\")", // Child 2.
            "    Text(\"Mathematician and writer\")", // Child 3.
        ]) // End.
    }

    @Test func challengesReshapeTheTree() { // HStack and a fourth child.
        let lines = ViewTreeOutline.lines(name: "Sam", horizontal: true, includesCity: true) // All challenges on.
        #expect(lines[1] == "  HStack(spacing: 8)") // VStack became HStack.
        #expect(lines[3] == "    Text(\"Sam\")") // Your own name.
        #expect(lines.last == "    Text(\"London\")") // A fourth branch at the children's depth.
        #expect(lines.count == 6) // One more node.
    }
}

@MainActor // The models live on the main actor.
struct ModifierStackTests { // Lesson 4.2's lab.
    @Test func startingCodeMatchesTheLab() { // The lab's starting chips.
        let stack = ModifierStack() // Fresh.
        #expect(stack.codeLines == ["Text(\"Order up\")", "    .font(.title2)", "    .padding()", "    .background(.orange)", "    .clipShape(Capsule())"]) // On chips only, in order.
    }

    @Test func wrappingOrderPutsTheLastModifierOutside() { // Each modifier wraps everything above it.
        let stack = ModifierStack() // Fresh.
        #expect(stack.wrappingOrder == [ // Outermost first.
            "clipShape(Capsule())", // The last modifier is the outermost layer.
            "  background(.orange)", // Next in.
            "    padding()", // Next in.
            "      font(.title2)", // Next in.
            "        Text(\"Order up\")", // The Text at the center.
        ]) // End.
    }

    @Test func startingStackSolvesThePillGoal() throws { // padding, orange, clip. throws: #require can stop the test.
        let stack = ModifierStack() // Fresh.
        let pill = try #require(ModifierStack.goals.first { $0.title == "Pill button" }) // The goal; the test stops if it is missing.
        #expect(stack.meets(pill)) // Already a pill.
    }

    @Test func tightHighlightNeedsColorBeforePadding() { // Goal 1.
        var stack = ModifierStack() // Fresh.
        stack.toggle(.clip) // Clip off.
        stack.moveUp(.orange) // Orange above padding.
        let goal = ModifierStack.goals[0] // "Tight highlight".
        #expect(stack.activeKinds == [.font, .orange, .padding]) // The new order.
        #expect(stack.meets(goal)) // Solved.
    }

    @Test func squarePillBugComesFromClippingFirst() { // Goal 4.
        var stack = ModifierStack() // Fresh.
        stack.moveUp(.clip) // Clip above the color.
        #expect(stack.meets(ModifierStack.goals[3])) // "Why is it square?"
        #expect(!stack.meets(ModifierStack.goals[1])) // No longer the pill.
    }

    @Test func blueCardGoalAddsTwoLayers() { // Goal 3.
        var stack = ModifierStack() // Fresh.
        stack.toggle(.padding8) // On.
        stack.toggle(.blue) // On.
        #expect(stack.meets(ModifierStack.goals[2])) // "Pill on a blue card".
        #expect(stack.codeLines.last == "    .background(.blue)") // The outermost line.
    }

    @Test func movesStopAtTheEnds() { // The top chip cannot go up; the bottom cannot go down.
        var stack = ModifierStack() // Fresh.
        stack.moveUp(.font) // Already first.
        stack.moveDown(.border) // Already last.
        #expect(stack.chips == ModifierStack().chips) // Nothing moved.
        stack.moveDown(.font) // Now it can move.
        #expect(stack.chips[1].kind == .font) // Second place.
    }

    @Test func resetRestoresTheStart() { // Start over.
        var stack = ModifierStack() // Fresh.
        stack.toggle(.font) // Change something.
        stack.moveDown(.padding) // And something else.
        stack.reset() // Start over.
        #expect(stack.chips == ModifierStack().chips) // Same as fresh.
    }

    @Test func everyChipHasCode() { // Seven chips, each with a leading dot.
        #expect(ModifierChipKind.allCases.count == 7) // The lab's seven modifiers.
        #expect(ModifierChipKind.allCases.allSatisfy { $0.code.hasPrefix(".") }) // All written as modifiers.
    }
}

@MainActor // The models live on the main actor.
struct LayoutLabTests { // Lesson 4.3's lab.
    @Test func startingCodeMatchesTheLab() { // The lab's starting settings.
        #expect(LayoutLabSettings().codeLines == [ // Line for line.
            "VStack(alignment: .leading, spacing: 12) {", // Leading is not the default, so it is written.
            "    Image(systemName: \"cup.and.saucer\")", // Child 1.
            "        .font(.largeTitle)", // Its font.
            "    Text(\"Cappuccino\")", // Child 2.
            "    Text(\"Large, oat milk\")", // Child 3.
            "        .font(.caption)", // Its font.
            "}", // End of the stack.
            ".padding(16)", // Padding.
            ".background(.yellow.opacity(0.3))", // The size marker.
        ]) // End.
    }

    @Test func centerAlignmentIsLeftOut() { // center is the default.
        var settings = LayoutLabSettings() // Fresh.
        settings.stack = .hStack // A row.
        #expect(settings.codeLines[0] == "HStack(spacing: 12) {") // No alignment argument.
        settings.hStackAlignment = .bottom // Not the default.
        #expect(settings.codeLines[0] == "HStack(alignment: .bottom, spacing: 12) {") // Written out.
    }

    @Test func zStackHasNoSpacingOrSpacer() { // A ZStack overlaps its children.
        var settings = LayoutLabSettings() // Fresh.
        settings.stack = .zStack // Layers.
        settings.spacer = .afterFirst // Ignored.
        #expect(settings.codeLines[0] == "ZStack {") // No spacing, centered.
        #expect(!settings.codeLines.contains("    Spacer()")) // No Spacer.
        settings.zStackAlignment = .bottomTrailing // A corner.
        #expect(settings.codeLines[0] == "ZStack(alignment: .bottomTrailing) {") // Written out.
    }

    @Test func spacersStretchAndFramesAppear() { // The remaining controls.
        var settings = LayoutLabSettings() // Fresh.
        settings.spacer = .afterSecond // After the name.
        settings.stretchName = true // Stretch the name.
        settings.padding = 0 // No padding.
        settings.frame = .leading // Fill, leading.
        let lines = settings.codeLines // Generate.
        #expect(lines.firstIndex(of: "    Spacer()") == 5) // After the name and its frame.
        #expect(lines[4] == "        .frame(maxWidth: .infinity)") // The stretched child.
        #expect(!lines.contains { $0.hasPrefix(".padding") }) // No padding line.
        #expect(lines.contains(".frame(maxWidth: .infinity, alignment: .leading)")) // The frame.
    }

    @Test func fillFrameAndFirstSpacer() { // The other frame and spacer choices.
        var settings = LayoutLabSettings() // Fresh.
        settings.spacer = .afterFirst // After the cup.
        settings.frame = .fill // Fill, centered.
        let lines = settings.codeLines // Generate.
        #expect(lines[3] == "    Spacer()") // Right after the cup's font line.
        #expect(lines.contains(".frame(maxWidth: .infinity)")) // The fill frame.
    }
}

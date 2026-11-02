// ViewLabs.swift
// Who: lessons 4.1, 4.2 and 4.3, whose cards let you rearrange views and modifiers.
// What: the plain Swift models behind three labs: the outline of ProfileCardView's
//       view tree, the modifier stack lab, and the layout lab. Each one turns your
//       choices into the exact SwiftUI code those choices stand for.
// Where: the Models folder; no SwiftUI import, so the code generation can be tested.
// When: whenever a switch, picker or arrow button in one of those labs changes.
// Why: the generated code is the bridge between what you see and what you would
//      type in Xcode, so it must always match the preview. Tests keep it honest.

import Foundation // Plain Swift: strings, arrays and enums.

// MARK: - Lesson 4.1: the view tree

/// Builds the indented outline of ProfileCardView's view tree.
enum ViewTreeOutline { // An enum with no cases: just a place to keep a function.
    /// One line per node, indented two spaces per level, outermost first.
    static func lines(name: String, horizontal: Bool, includesCity: Bool) -> [String] { // The three things the card lets you change.
        var lines = [ // The tree always starts like this.
            "padding", // .padding() wraps everything, so it is the root.
            "  \(horizontal ? "HStack" : "VStack")(spacing: 8)", // The container under it.
            "    Image(systemName: \"person.circle\")", // First child.
            "    Text(\"\(name)\")", // Second child: the name.
            "    Text(\"Mathematician and writer\")", // Third child: the description.
        ] // End of the fixed part.
        if includesCity { // The "add a fourth child" challenge.
            lines.append("    Text(\"London\")") // A new branch at the same depth as its siblings.
        }
        return lines // Outermost first, like the code reads.
    }
}

// MARK: - Lesson 4.2: the modifier stack lab

/// One modifier the lab can switch on, off, up and down.
enum ModifierChipKind: String, CaseIterable, Identifiable { // The seven chips from the course's lab.
    case font, padding, orange, clip, padding8, blue, border // In the lab's starting order.
    var id: String { rawValue } // Identifiable, so ForEach can tell the chips apart.

    /// The line of code this chip adds to the chain.
    var code: String { // Exactly what you would type.
        switch self { // One answer per chip.
        case .font: ".font(.title2)" // Makes the text bigger.
        case .padding: ".padding()" // Standard space on every side.
        case .orange: ".background(.orange)" // Paints behind everything above it.
        case .clip: ".clipShape(Capsule())" // Cuts everything above it into a pill.
        case .padding8: ".padding(8)" // A smaller margin.
        case .blue: ".background(.blue)" // A second background.
        case .border: ".border(.red)" // A thin outline around everything above it.
        }
    }
}

/// A chip in the lab: which modifier, and whether it is switched on.
struct ModifierChip: Identifiable, Equatable { // Equatable so tests can compare whole stacks.
    let kind: ModifierChipKind // The modifier.
    var isOn: Bool // Off chips stay in the list but are left out of the code.
    var id: ModifierChipKind { kind } // Each kind appears once, so it is the identity.
}

/// A target arrangement the lab challenges you to build.
struct ModifierGoal: Identifiable { // Shown as a picker of challenges.
    let title: String // The challenge's name.
    let hint: String // What to aim for.
    let target: [ModifierChipKind] // The switched-on chips, top to bottom, that solve it (after .font).
    var id: String { title } // Titles are unique.
}

/// The modifier stack lab: one Text, and a list of modifiers you can reorder and switch.
struct ModifierStack { // A value type held in @State by the lab card.
    /// The starting chips: font, padding, orange and clip on; the rest off.
    private(set) var chips: [ModifierChip] = [ // The same start as the course's lab.
        ModifierChip(kind: .font, isOn: true), // .font(.title2)
        ModifierChip(kind: .padding, isOn: true), // .padding()
        ModifierChip(kind: .orange, isOn: true), // .background(.orange)
        ModifierChip(kind: .clip, isOn: true), // .clipShape(Capsule())
        ModifierChip(kind: .padding8, isOn: false), // .padding(8)
        ModifierChip(kind: .blue, isOn: false), // .background(.blue)
        ModifierChip(kind: .border, isOn: false), // .border(.red)
    ] // End of the starting chips.

    /// The four challenges from the course's lab.
    static let goals: [ModifierGoal] = [ // Read by the picker and by the check below.
        ModifierGoal(title: "Tight highlight", hint: "Make the orange hug the letters, with clear space around it.", target: [.orange, .padding]), // Color first, then space.
        ModifierGoal(title: "Pill button", hint: "Make room around the text, color that area, then cut it into a capsule.", target: [.padding, .orange, .clip]), // The classic pill.
        ModifierGoal(title: "Pill on a blue card", hint: "Start from the pill, add space around it, then color the new area blue.", target: [.padding, .orange, .clip, .padding8, .blue]), // Two layers.
        ModifierGoal(title: "Why is it square?", hint: "Clip is on, yet the orange is a plain rectangle. Recreate that bug.", target: [.padding, .clip, .orange]), // Clip before the color exists.
    ] // End of the goals.

    /// The switched-on modifiers, in the order they wrap the Text.
    var activeKinds: [ModifierChipKind] { chips.filter(\.isOn).map(\.kind) } // Off chips are skipped.

    /// The full code the current chips stand for.
    var codeLines: [String] { // One string per line.
        ["Text(\"Order up\")"] + activeKinds.map { "    " + $0.code } // The view, then each modifier indented under it.
    }

    /// The same chain drawn as nested layers: the last modifier is the outermost box.
    var wrappingOrder: [String] { // Outermost first, each layer indented inside the one before.
        let outsideIn = activeKinds.reversed().map { String($0.code.dropFirst()) } // The last modifier wraps everything, so it comes first; dropFirst removes the dot.
        var layers: [String] = [] // The lines being built.
        for (depth, name) in outsideIn.enumerated() { // depth 0 is the outermost layer.
            layers.append(String(repeating: "  ", count: depth) + name) // Two spaces per level of nesting.
        }
        layers.append(String(repeating: "  ", count: outsideIn.count) + "Text(\"Order up\")") // The Text sits at the very center.
        return layers // Outermost first.
    }

    /// true when the switched-on chips, ignoring .font, match a goal's target.
    func meets(_ goal: ModifierGoal) -> Bool { // Font only changes the letters, so goals ignore it.
        activeKinds.filter { $0 != .font } == goal.target // Same modifiers in the same order.
    }

    /// Switches one chip on or off.
    mutating func toggle(_ kind: ModifierChipKind) { // Called by the chip's switch.
        guard let index = chips.firstIndex(where: { $0.kind == kind }) else { return } // Find the chip.
        chips[index].isOn.toggle() // Flip it.
    }

    /// Moves one chip a place earlier in the chain.
    mutating func moveUp(_ kind: ModifierChipKind) { // The up arrow.
        guard let index = chips.firstIndex(where: { $0.kind == kind }), index > 0 else { return } // The top chip cannot go higher.
        chips.swapAt(index, index - 1) // Trade places with the chip above.
    }

    /// Moves one chip a place later in the chain.
    mutating func moveDown(_ kind: ModifierChipKind) { // The down arrow.
        guard let index = chips.firstIndex(where: { $0.kind == kind }), index < chips.count - 1 else { return } // The bottom chip cannot go lower.
        chips.swapAt(index, index + 1) // Trade places with the chip below.
    }

    /// Puts the chips back the way the lab started.
    mutating func reset() { // The Start over button.
        self = ModifierStack() // A fresh value has the starting chips.
    }
}

// MARK: - Lesson 4.3: the layout lab

/// The three stack types the layout lab offers.
enum LabStack: String, CaseIterable, Identifiable { // Shown as a segmented picker.
    case vStack = "VStack", hStack = "HStack", zStack = "ZStack" // Raw values are the code names.
    var id: String { rawValue } // Identifiable for ForEach.
}

/// A VStack's alignment: how children line up across a column.
enum LabHorizontal: String, CaseIterable, Identifiable { // VStack(alignment:) takes one of these.
    case leading, center, trailing // Left, middle, right (in left-to-right languages).
    var id: String { rawValue } // Identifiable for ForEach.
}

/// An HStack's alignment: how children line up across a row.
enum LabVertical: String, CaseIterable, Identifiable { // HStack(alignment:) takes one of these.
    case top, center, bottom // Top edges, middles or bottom edges in line.
    var id: String { rawValue } // Identifiable for ForEach.
}

/// A ZStack's alignment: where smaller children sit inside the biggest one.
enum LabCorner: String, CaseIterable, Identifiable { // ZStack(alignment:) takes one of these.
    case topLeading, top, topTrailing, leading, center, trailing, bottomLeading, bottom, bottomTrailing // Nine positions.
    var id: String { rawValue } // Identifiable for ForEach.
}

/// Where a Spacer sits, if anywhere.
enum LabSpacer: String, CaseIterable, Identifiable { // Shown as a picker.
    case none = "No Spacer", afterFirst = "After the cup", afterSecond = "After the name" // Readable picker titles.
    var id: String { rawValue } // Identifiable for ForEach.
}

/// How the whole stack is framed.
enum LabFrame: String, CaseIterable, Identifiable { // Shown as a picker.
    case hug = "Hug", fill = "Fill width", leading = "Fill, leading" // Three framing choices.
    var id: String { rawValue } // Identifiable for ForEach.
}

/// Every setting of the layout lab, and the code those settings stand for.
struct LayoutLabSettings: Equatable { // Equatable so tests can compare settings.
    var stack: LabStack = .vStack // Which container.
    var vStackAlignment: LabHorizontal = .leading // Used when stack is VStack.
    var hStackAlignment: LabVertical = .center // Used when stack is HStack.
    var zStackAlignment: LabCorner = .center // Used when stack is ZStack.
    var spacing = 12 // Points between children (stacks only; ZStack has none).
    var padding = 16 // Points of padding around the stack; 0 means none.
    var spacer: LabSpacer = .none // Where a Spacer goes, if anywhere.
    var stretchName = false // .frame(maxWidth: .infinity) on the name.
    var frame: LabFrame = .hug // How the whole stack is framed.

    /// The body of CoffeeLabelView for these settings, one line per element.
    var codeLines: [String] { // Mirrors the course's lab line for line.
        var args: [String] = [] // The stack's arguments.
        switch stack { // Alignment is spelled differently for each stack.
        case .vStack where vStackAlignment != .center: args.append("alignment: .\(vStackAlignment.rawValue)") // center is the default, so it is left out.
        case .hStack where hStackAlignment != .center: args.append("alignment: .\(hStackAlignment.rawValue)") // Same rule.
        case .zStack where zStackAlignment != .center: args.append("alignment: .\(zStackAlignment.rawValue)") // Same rule.
        default: break // Centered: nothing to write.
        }
        if stack != .zStack { args.append("spacing: \(spacing)") } // A ZStack overlaps its children, so it has no spacing.
        var lines = ["\(stack.rawValue)\(args.isEmpty ? "" : "(\(args.joined(separator: ", ")))") {"] // For example VStack(alignment: .leading, spacing: 12) {
        lines.append("    Image(systemName: \"cup.and.saucer\")") // Child one.
        lines.append("        .font(.largeTitle)") // Sized like large text.
        if stack != .zStack && spacer == .afterFirst { lines.append("    Spacer()") } // A Spacer means nothing inside a ZStack.
        lines.append("    Text(\"Cappuccino\")") // Child two.
        if stretchName { lines.append("        .frame(maxWidth: .infinity)") } // The stretched child.
        if stack != .zStack && spacer == .afterSecond { lines.append("    Spacer()") } // The other Spacer position.
        lines.append("    Text(\"Large, oat milk\")") // Child three.
        lines.append("        .font(.caption)") // Smaller.
        lines.append("}") // End of the stack.
        if padding > 0 { lines.append(".padding(\(padding))") } // Padding around the whole stack.
        switch frame { // The frame on the whole stack.
        case .hug: break // No frame: the stack hugs its content.
        case .fill: lines.append(".frame(maxWidth: .infinity)") // As wide as offered, content centered.
        case .leading: lines.append(".frame(maxWidth: .infinity, alignment: .leading)") // As wide as offered, content on the leading edge.
        }
        lines.append(".background(.yellow.opacity(0.3))") // Shows the stack's final size.
        return lines // Ready to show in a console box.
    }
}

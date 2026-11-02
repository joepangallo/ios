// FocusLengthControl.swift
// Who: the Today screen (lesson 9.7) to pick a focus length, and lesson 9.5 to
//      show how a custom control speaks to VoiceOver.
// What: a custom slider-like control for minutes: a track you can drag, minus
//       and plus buttons, and full VoiceOver support: a label, a value that
//       follows the state, and an adjustable action (swipe up or down).
// Where: Features/Focus, beside the timer screen that uses it.
// When: rebuilt whenever its minutes binding changes.
// Why: custom controls are exactly where accessibility gets forgotten. Without
//      these modifiers VoiceOver would stop on three separate, unlabeled parts.

import SwiftUI // SwiftUI provides shapes, gestures and the accessibility modifiers.

/// A custom minutes control that VoiceOver can read and adjust.
struct FocusLengthControl: View { // A custom control, not a built-in Slider.
    @Binding var minutes: Int // The value lives with the parent; this view only edits it.
    var range: ClosedRange<Int> = FocusTimer.lengthRange // The allowed lengths.
    var step = 5 // Each adjustment moves five minutes.
    @Environment(\.isEnabled) private var isEnabled // Dims the control when the parent disables it.

    /// The next value after one adjustment, kept inside the range. Pure, so a test can check it.
    static func adjusted(_ value: Int, up: Bool, range: ClosedRange<Int>, step: Int) -> Int { // static: no instance needed.
        let next = up ? value + step : value - step // One step in the chosen direction.
        return min(max(next, range.lowerBound), range.upperBound) // Never outside the range.
    }

    /// What VoiceOver announces for the value, such as "25 minutes".
    static func spokenValue(_ minutes: Int) -> String { // Shared by the control and the lesson's readout.
        String(localized: "\(minutes) minutes", comment: "Spoken value of the focus length control") // Translatable: "%lld minutes".
    }

    var body: some View { // Rebuilt when minutes changes.
        HStack(spacing: 12) { // Minus, track, plus.
            Button { minutes = Self.adjusted(minutes, up: false, range: range, step: step) } label: { // One step down.
                Image(systemName: "minus.circle.fill").font(.title2) // A clear minus symbol.
            }
            .frame(minWidth: 44, minHeight: 44) // At least 44 by 44 points, Apple's minimum target.
            GeometryReader { proxy in // The track needs its own width to place the fill.
                let fraction = Double(minutes - range.lowerBound) / Double(range.upperBound - range.lowerBound) // 0 at the minimum, 1 at the maximum.
                ZStack(alignment: .leading) { // The fill sits on top of the track, from the left.
                    Capsule().fill(.fill.secondary) // The empty track.
                    Capsule().fill(.tint) // The filled part, in the accent colour.
                        .frame(width: max(proxy.size.width * fraction, 24)) // Never narrower than a dot.
                    Text(verbatim: "\(minutes)") // The number on the track.
                        .font(.caption.bold().monospacedDigit()) // Small, bold and steady digits.
                        .padding(.horizontal, 8) // Off the edge of the capsule.
                        .foregroundStyle(.white) // Readable on the accent fill.
                }
                .contentShape(.rect) // The whole track responds to touches, not just the fill.
                .gesture(DragGesture(minimumDistance: 0).onChanged { drag in // Dragging along the track picks a value.
                    let picked = Double(range.lowerBound) + drag.location.x / proxy.size.width * Double(range.upperBound - range.lowerBound) // Position to minutes.
                    let snapped = Int((picked / Double(step)).rounded()) * step // Snap to the nearest step.
                    minutes = min(max(snapped, range.lowerBound), range.upperBound) // Stay inside the range.
                })
            }
            .frame(height: 28) // A comfortable track height.
            Button { minutes = Self.adjusted(minutes, up: true, range: range, step: step) } label: { // One step up.
                Image(systemName: "plus.circle.fill").font(.title2) // A clear plus symbol.
            }
            .frame(minWidth: 44, minHeight: 44) // The same minimum target.
        }
        .opacity(isEnabled ? 1 : 0.5) // Looks disabled when it is disabled.
        .accessibilityElement(children: .ignore) // One element for VoiceOver instead of three parts.
        .accessibilityLabel("Focus length") // What it is.
        .accessibilityValue(Self.spokenValue(minutes)) // Its current state, re-read after each change.
        .accessibilityHint("Swipe up or down to change the length") // What to do with it.
        .accessibilityAdjustableAction { direction in // VoiceOver's swipe up and swipe down.
            switch direction { // Which way the user swiped.
            case .increment: minutes = Self.adjusted(minutes, up: true, range: range, step: step) // Swipe up: longer.
            case .decrement: minutes = Self.adjusted(minutes, up: false, range: range, step: step) // Swipe down: shorter.
            @unknown default: break // Future directions are ignored safely.
            }
        }
        .accessibilityIdentifier("focusLengthControl") // A stable name for UI tests.
    }
}

#Preview { // The control on its own, with a value it can change.
    @Previewable @State var minutes = 25 // @Previewable lets a preview own state.
    FocusLengthControl(minutes: $minutes).padding() // Drag it, or use Accessibility Inspector to adjust it.
}

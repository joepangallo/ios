// Lesson_4_9_MotionAdaptivityGlass.swift
// Who: the student who opens lesson 4.9 from the home screen.
// What: the "Motion, Adaptivity, and Liquid Glass" page: explicit and implicit
//       animation and Reduce Motion, the favorite button, transitions, Dynamic Type
//       and size classes, ViewThatFits, and a first look at Liquid Glass.
// Where: pushed onto the app's NavigationStack by ContentView. The choices and the
//        Reduce Motion rule live in Models/MotionModels.swift.
// When: built when the lesson opens; animations run whenever a change of state
//       happens inside an animation.
// Why: in SwiftUI you do not animate views; you animate changes of state. And one
//      layout must fit every device and every text size.

import SwiftUI // withAnimation, transitions, ViewThatFits, glassEffect.

/// Lesson 4.9: motion, adaptivity, and Liquid Glass.
struct MotionAdaptivityGlassLesson: View { // One screen per lesson.
    let lesson: Lesson // Number, title and summary from the home screen.

    var body: some View { // The page: one card per course step.
        LessonPage(lesson: lesson) { // Scrolling page with the summary on top.
            AnimateStateCard() // Concept: Animate changes of state.
            FavoriteButtonCard() // Code: Explicit animation with withAnimation.
            RecipeCardCard() // Code: Transitions for views that come and go.
            ManySizesCard() // Concept: One layout, many sizes.
            DeliveryBannerCard() // Code: ViewThatFits picks the layout that fits.
            LiquidGlassCard() // Code: A first look at Liquid Glass.
        }
    }
}

// MARK: - Turning the model's choices into SwiftUI values

extension MotionCurve { // The model stays SwiftUI-free; the conversion lives with the views.
    /// The SwiftUI animation for this curve.
    var animation: Animation { self == .spring ? .spring : .easeInOut } // `.spring` or `.easeInOut`.
}

extension EntranceTransition { // Same idea for transitions.
    /// The SwiftUI transition for this choice.
    var transition: AnyTransition { // AnyTransition can hold any of the three.
        switch self { // One per case.
        case .scale: .scale // Grows from nothing.
        case .opacity: .opacity // Fades.
        case .slide: .slide // Slides in from the leading edge, out the trailing edge.
        }
    }
}

extension TextSizeStep { // Same idea for text sizes.
    /// The SwiftUI Dynamic Type size for this stop.
    var dynamicTypeSize: DynamicTypeSize { // Used with .dynamicTypeSize(_:).
        switch self { // One per case.
        case .xSmall: .xSmall // Smallest.
        case .large: .large // Default.
        case .xxxLarge: .xxxLarge // Largest standard.
        case .accessibility3: .accessibility3 // Accessibility.
        case .accessibility5: .accessibility5 // Largest of all.
        }
    }
}

// MARK: - Animate changes of state

/// Concept: Animate changes of state.
private struct AnimateStateCard: View { // One card.
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion // The real setting, read from the environment.
    @State private var pretendReduceMotion = false // Lets you see the reduced version without changing Settings.
    @State private var moved = false // The state the dot's position is computed from.

    private var reduceMotion: Bool { systemReduceMotion || pretendReduceMotion } // Either source turns it on.

    var body: some View { // Re-runs when moved or the setting changes.
        DemoCard(title: "Animate changes of state", caption: "When a value changes inside an animation, SwiftUI compares the view tree before and after and smoothly interpolates every difference: position, size, color and opacity.") { // The card.
            Text("Implicit animation: .animation(.easeInOut, value: moved) on the dot. The button changes moved with no withAnimation, yet the dot animates, because it animates whenever moved changes.") // The implicit term.
                .font(.footnote) // Small.
            Circle() // The dot.
                .fill(moved ? .orange : .teal) // Color comes from state.
                .frame(width: 44, height: 44) // Its size.
                .offset(x: reduceMotion ? 0 : (moved ? 100 : -100)) // Large motion only when Reduce Motion is off.
                .opacity(reduceMotion && moved ? 0.5 : 1) // With Reduce Motion, a gentle fade stands in for the slide.
                .animation(.easeInOut, value: moved) // Implicit: animates every change of moved.
                .frame(maxWidth: .infinity, minHeight: 60) // Room to travel.
                .demoPanel() // On a plain panel.
            Button(moved ? "Move back" : "Move the dot") { moved.toggle() } // A plain state change.
                .buttonStyle(.bordered) // Framed.
            ValueRow(name: "accessibilityReduceMotion", value: "\(systemReduceMotion)") // The real setting on this device.
            Toggle("Pretend Reduce Motion is on", isOn: $pretendReduceMotion) // See the reduced version.
            Text("Explicit animation: wrap a change in withAnimation { }; the next card does. Transition: how a view enters or leaves; the card after that. Motion should explain cause and effect; keep it short.") // The other terms and the callout.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - Explicit animation with withAnimation

/// The course's FavoriteButtonView, with the challenges as inputs.
struct FavoriteButtonView: View { // `struct FavoriteButtonView: View`
    var animated = true // Challenge 1: remove withAnimation.
    var curve = MotionCurve.spring // Challenge 2: .easeInOut.
    var bigScale = false // Challenge 3: 2.0 instead of 1.3.
    @Environment(\.accessibilityReduceMotion) private var reduceMotion // Respect the setting.
    @State private var isFavorite = false // The one Boolean that drives three changes.

    var body: some View { // Re-runs when isFavorite changes.
        VStack(spacing: 24) { // Heart above button.
            Image(systemName: isFavorite ? "heart.fill" : "heart") // Change 1: the symbol.
                .font(.system(size: 72)) // Big.
                .foregroundStyle(isFavorite ? .pink : .gray) // Change 2: the color.
                .scaleEffect(FavoriteMotion.scale(isFavorite: isFavorite, bigScale: bigScale, reduceMotion: reduceMotion)) // Change 3: the size (1.3 in the course).
            Button(isFavorite ? "Unfavorite" : "Favorite") { // The title reads the state too.
                if animated { // The course's version.
                    withAnimation(curve.animation) { // Explicit: everything that changes because of this animates.
                        isFavorite.toggle() // The one state change.
                    }
                } else { // Challenge 1.
                    isFavorite.toggle() // Same change, applied instantly.
                }
            }
            .buttonStyle(.borderedProminent) // Filled.
        }
        .frame(height: 230) // Room for the biggest heart, so the card does not jump.
    }
}

/// Code: Explicit animation with withAnimation.
private struct FavoriteButtonCard: View { // One card.
    @State private var animated = true // Challenge 1.
    @State private var curve = MotionCurve.spring // Challenge 2.
    @State private var bigScale = false // Challenge 3.

    var body: some View { // Redraws when a challenge changes.
        DemoCard(title: "Explicit animation with withAnimation", caption: "Tapping flips one Boolean inside withAnimation, and three things change because of it: the symbol, the color and the size. SwiftUI animates all of them together.") { // The card.
            FavoriteButtonView(animated: animated, curve: curve, bigScale: bigScale) // The live button.
                .frame(maxWidth: .infinity) // Centered.
                .demoPanel() // On a plain panel.
            Toggle("Wrap the change in withAnimation", isOn: $animated) // Challenge 1.
            Picker("Curve", selection: $curve) { // Challenge 2.
                ForEach(MotionCurve.allCases) { Text($0.rawValue).tag($0) } // Spring or ease in-out.
            }
            .pickerStyle(.segmented) // Side by side.
            Toggle("scaleEffect 2.0 instead of 1.3", isOn: $bigScale) // Challenge 3.
            Text("With Reduce Motion on, the heart changes symbol and color but does not grow.") // The rule from FavoriteMotion.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - Transitions for views that come and go

/// The course's RecipeCardView, with the challenges as inputs.
struct RecipeCardView: View { // `struct RecipeCardView: View`
    var transition = EntranceTransition.scale // Challenge 1: .opacity or .slide.
    var animated = true // Challenge 2: delete the .animation line.
    var backgroundFirst = false // Challenge 3: swap .padding() and .background(Color.mint).
    @State private var showNutrition = false // The facts exist only while this is true.

    var body: some View { // Re-runs when showNutrition changes.
        VStack(spacing: 16) { // Title, switch, facts.
            Text("Lentil Soup").font(.title) // The recipe.
            Toggle("Show nutrition", isOn: $showNutrition) // Inserts and removes the facts.
            if showNutrition { // The facts are inserted and removed, not hidden.
                facts // The facts view, padded and colored.
                    .transition(transition.transition) // How they enter and leave: .scale in the course.
            }
        }
        .padding() // Space around the stack.
        .animation(animated ? .easeInOut : nil, value: showNutrition) // Animates every change of showNutrition; nil means no animation.
    }

    /// The nutrition facts, with the padding and background in either order.
    @ViewBuilder private var facts: some View { // @ViewBuilder lets the branches differ.
        if backgroundFirst { // Challenge 3.
            Text("320 calories, 18 g protein").background(Color.mint).padding() // Mint hugs the letters.
        } else { // The course's order.
            Text("320 calories, 18 g protein").padding().background(Color.mint) // Mint fills the padded area.
        }
    }
}

/// Code: Transitions for views that come and go.
private struct RecipeCardCard: View { // One card.
    @State private var transition = EntranceTransition.scale // Challenge 1.
    @State private var animated = true // Challenge 2.
    @State private var backgroundFirst = false // Challenge 3.

    var body: some View { // Redraws when a challenge changes.
        DemoCard(title: "Transitions for views that come and go", caption: "The facts exist only while showNutrition is true, so they are inserted and removed. .transition says how they enter and leave, and .animation(_:value:) on the stack animates every change. Flip the switch.") { // The card.
            RecipeCardView(transition: transition, animated: animated, backgroundFirst: backgroundFirst) // The live card.
                .frame(minHeight: 190, alignment: .top) // Room for the facts, so the page does not jump.
                .demoPanel() // On a plain panel.
            Picker("Transition", selection: $transition) { // Challenge 1.
                ForEach(EntranceTransition.allCases) { Text($0.rawValue).tag($0) } // Scale, opacity, slide.
            }
            .pickerStyle(.segmented) // Side by side.
            Toggle(".animation(.easeInOut, value: showNutrition)", isOn: $animated) // Challenge 2: without it, no motion.
                .font(.footnote.monospaced()) // Code font.
            Toggle("Swap .padding() and .background(Color.mint)", isOn: $backgroundFirst) // Challenge 3.
        }
    }
}

// MARK: - One layout, many sizes

/// Concept: One layout, many sizes.
private struct ManySizesCard: View { // One card.
    @Environment(\.horizontalSizeClass) private var sizeClass // compact on an iPhone in portrait, regular on a full-screen iPad.
    @Environment(\.dynamicTypeSize) private var systemSize // The reader's real text size.
    @State private var step = TextSizeStep.large // The size previewed below.

    var body: some View { // Re-runs when the preview size changes.
        DemoCard(title: "One layout, many sizes", caption: "Dynamic Type lets people pick their text size, from extra small to five accessibility sizes. Text styles such as .body follow it; fixed point sizes do not. Step through the sizes.") { // The card.
            ValueRow(name: "horizontalSizeClass", value: sizeClass == .regular ? ".regular" : ".compact") // Size classes.
            ValueRow(name: "your text size", value: "\(systemSize)") // The real setting.
            Stepper("Preview: \(step.title)", value: Binding(get: { step.rawValue }, set: { step = TextSizeStep(rawValue: $0) ?? .large }), in: 0...(TextSizeStep.allCases.count - 1)) // Steps through the five stops.
            VStack(alignment: .leading, spacing: 10) { // The previewed content.
                Text(".font(.body) follows the setting") // A text style.
                    .font(.body) // Scales.
                Text(".font(.system(size: 17)) never changes") // A fixed size.
                    .font(.system(size: 17)) // Does not scale.
                    .foregroundStyle(.secondary) // Quieter.
                let layout = step.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading)) : AnyLayout(HStackLayout()) // A row becomes a column at accessibility sizes.
                layout { // The same two children either way.
                    Label("Delivery", systemImage: "shippingbox") // Child one.
                    Text("Arrives Tuesday") // Child two: wraps instead of being cut off.
                        .foregroundStyle(.secondary) // Quieter.
                }
            }
            .dynamicTypeSize(step.dynamicTypeSize) // Previews the content at the chosen size.
            .frame(maxWidth: .infinity, alignment: .leading) // Flexible frame: full width, never a fixed one.
            .padding(12) // Room inside.
            .demoPanel() // On a plain panel.
            Text("Never truncate meaning: let text wrap, or switch a row to a column. Test the extremes: the smallest device and the largest accessibility size.") // The callout and the last point.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - ViewThatFits picks the layout that fits

/// The course's DeliveryBannerView, with the challenges as inputs.
struct DeliveryBannerView: View { // `struct DeliveryBannerView: View`
    var buttons = false // Challenge 2: two button candidates instead of three texts.
    var largeTitle = false // Challenge 3: .largeTitle instead of .headline.
    @State private var width = 340.0 // The width the slider offers.
    @State private var available = 0.0 // How wide the card really is, measured from the slider; 0 until measured.

    /// The width actually offered to the banner: never wider than the card.
    private var offered: Double { min(width, DeliveryBanner.maximumWidth(available: available)) } // Clamped.

    var body: some View { // Re-runs when width changes.
        VStack(spacing: 30) { // Slider above banner.
            Slider(value: $width, in: 80...DeliveryBanner.maximumWidth(available: available)) // 80...340 in the course, capped at the card's width.
                .onGeometryChange(for: Double.self) { $0.size.width } action: { newWidth in // A Slider takes exactly the width it is offered, so it measures the card.
                    available = newWidth // Remember it for the slider's range.
                    width = min(width, DeliveryBanner.maximumWidth(available: newWidth)) // Never wider than the card.
                }
            ViewThatFits { // Shows the first child that fits, measured at its natural size.
                if buttons { // Challenge 2's two candidates.
                    HStack { Button("Keep shopping") { }; Button("Check out") { } } // Two buttons side by side.
                        .buttonStyle(.bordered) // Framed.
                    Button("Check out") { } // One button.
                        .buttonStyle(.bordered) // Framed.
                } else { // The course's three wordings, longest first.
                    ForEach(DeliveryBanner.wordings, id: \.self) { Text($0) } // Each one is a candidate.
                }
            }
            .font(largeTitle ? .largeTitle : .headline) // .headline in the course.
            .frame(width: offered) // The available width.
            .border(Color.gray) // Shows that width.
            Text("Offered width: \(Int(offered)) points") // The number behind the slider.
                .font(.caption.monospacedDigit()) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
        .padding() // Space around the stack.
    }
}

/// Code: ViewThatFits picks the layout that fits.
private struct DeliveryBannerCard: View { // One card.
    @State private var buttons = false // Challenge 2.
    @State private var largeTitle = false // Challenge 3.

    var body: some View { // Redraws when a challenge changes.
        DemoCard(title: "ViewThatFits picks the layout that fits", caption: "Three wordings, longest first. ViewThatFits shows the first one that fits. The slider changes the available width, standing in for a smaller phone, split view or larger text. Drag it slowly left.") { // The card.
            DeliveryBannerView(buttons: buttons, largeTitle: largeTitle) // The live banner.
                .demoPanel() // On a plain panel.
            Toggle("Candidates: two buttons, then one", isOn: $buttons) // Challenge 2.
            Toggle(".largeTitle instead of .headline", isOn: $largeTitle) // Challenge 3: each wording gives up at a wider width.
            Text("Past the shortest candidate, ViewThatFits still shows the last child, even though it does not fit.") // The quiz's answer.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - A first look at Liquid Glass

/// The course's PlayerControlsView, with the challenges as inputs.
struct PlayerControlsView: View { // `struct PlayerControlsView: View`
    var plainGlassButton = false // Challenge 1: .glass instead of .glassProminent.
    var clearGlass = false // Challenge 2: .glassEffect(.clear, in: .rect(cornerRadius: 16)).
    var orange = false // Challenge 3: Color.orange instead of Color.teal.
    @State private var isPlaying = false // Playing or paused.
    var title: String { isPlaying ? "Pause" : "Play" } // Derived from state.

    var body: some View { // Glass controls floating over color.
        ZStack { // Background, then controls on top.
            (orange ? Color.orange : Color.teal).ignoresSafeArea() // The content the glass floats over.
            GlassEffectContainer { // Lets nearby glass shapes render and blend together.
                HStack(spacing: 16) { // Icon beside button.
                    symbol // The music note on glass.
                    playButton // The glass button.
                }
            }
        }
    }

    /// The music note, on regular glass or clear glass.
    @ViewBuilder private var symbol: some View { // @ViewBuilder lets the branches differ.
        if clearGlass { // Challenge 2.
            Image(systemName: "music.note").padding().glassEffect(.clear, in: .rect(cornerRadius: 16)) // Clear glass, rounded rectangle.
        } else { // The course's version.
            Image(systemName: "music.note").padding().glassEffect() // Regular glass, capsule shape.
        }
    }

    /// The Play button, in the prominent or the plain glass style.
    @ViewBuilder private var playButton: some View { // @ViewBuilder lets the branches differ.
        if plainGlassButton { // Challenge 1.
            Button(title) { isPlaying.toggle() }.buttonStyle(.glass) // Plain glass.
        } else { // The course's version.
            Button(title) { isPlaying.toggle() }.buttonStyle(.glassProminent) // Tinted glass.
        }
    }
}

/// Code: A first look at Liquid Glass.
private struct LiquidGlassCard: View { // One card.
    @State private var plainGlassButton = false // Challenge 1.
    @State private var clearGlass = false // Challenge 2.
    @State private var orange = false // Challenge 3.

    var body: some View { // Redraws when a challenge changes.
        DemoCard(title: "A first look at Liquid Glass", caption: "iOS 26's Liquid Glass is a translucent material for controls that float above content. .glassEffect() puts any view on glass, .buttonStyle(.glassProminent) makes a glass button, and GlassEffectContainer lets nearby glass blend. Use it for controls, not for content.") { // The card.
            PlayerControlsView(plainGlassButton: plainGlassButton, clearGlass: clearGlass, orange: orange) // The live controls.
                .frame(height: 150) // A window onto the color.
                .clipShape(.rect(cornerRadius: 12)) // Rounded.
            Toggle(".glass instead of .glassProminent", isOn: $plainGlassButton) // Challenge 1.
            Toggle(".glassEffect(.clear, in: .rect(cornerRadius: 16))", isOn: $clearGlass) // Challenge 2.
                .font(.footnote.monospaced()) // Code font.
            Toggle("Color.orange instead of Color.teal", isOn: $orange) // Challenge 3: the glass picks up the new color.
        }
    }
}

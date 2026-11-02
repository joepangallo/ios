// Lesson_5_2_LiquidGlass.swift
// Who: the home screen opens this when the student taps 5.2.
// What: Liquid Glass, live: glass over moving content, the content and
//       navigation layers, .glassEffect() with regular and clear variants and
//       shapes, glass button styles in a GlassEffectContainer, the glass-on-glass
//       mistake next to its fix, tint, interactive glass and morphing with
//       glassEffectID, and a lab to drag a glass toolbar over different content.
// Where: the Lessons folder; the course's example views sit below the lesson.
// When: SwiftUI builds it when lesson 5.2 is pushed onto the home screen's stack.
// Why: glass is a material that reacts to what is behind it, so it has to be
//      seen moving over real content, not described.

import SwiftUI // SwiftUI provides the glass APIs (iOS 26 and later).

struct LiquidGlassLesson: View { // The screen for lesson 5.2.
    let lesson: Lesson // The number, title and summary from the home screen.
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency // A display setting glass responds to.
    @Environment(\.colorSchemeContrast) private var contrast // Increase Contrast, another one.
    @State private var showLayers = true // Labels the two layers in the layer demo.
    @State private var paddingAfterGlass = false // Try it: move .padding(16) below .glassEffect().
    @State private var captionIcons = false // Try it: shrink the icons to .caption.
    @State private var backdrop = VariantBackdrop.indigo // The background behind the two variants.
    @State private var whiteOnClear = true // Try it: remove .foregroundStyle(.white).
    @State private var cancelProminent = false // Try it: give Cancel .glassProminent too.
    @State private var tintSaveGreen = false // Try it: .tint(.green) on Save.
    @State private var showRunCard = false // The glass-on-glass comparison cover.
    @State private var useContainer = true // The predict question for RecordControls.

    var body: some View { // Rebuilt whenever a switch changes.
        LessonPage(lesson: lesson) { // The shared scrolling page layout.
            DemoCard(title: "What Liquid Glass is", caption: "Scroll the strip sideways: the capsule bends and picks up the colors passing beneath it while its icons stay readable.") { // Concept step 1.
                LensingStrip() // Live glass over moving content.
                ConceptPoints(points: [ // The step's four terms.
                    ("Material", "A reusable surface with consistent, physical-feeling rules that the system draws for you, like frosted glass in the real world."), // Material.
                    ("Lensing", "Bending the light from content behind the glass instead of just scattering it, so the edges of a control stay crisp."), // Lensing.
                    ("Adaptive", "Small glass elements flip between light and dark appearances as bright or dark content scrolls beneath them, to stay legible."), // Adaptive.
                    ("Interactive", "Glass can brighten and flex under a finger, which confirms that a press landed."), // Interactive.
                ])
                Text("One design language: Liquid Glass shipped across iOS, iPadOS, macOS, watchOS and tvOS 26 at the same time, so the same SwiftUI code gets a consistent look on Apple's devices. Standard bars, toolbars, sheets, menus, toggles and sliders adopt it automatically.") // The ecosystem callout.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }

            DemoCard(title: "Content below, controls above", caption: "Every iOS 26 screen is two layers. Glass belongs only on the navigation layer.") { // Concept step 2.
                LayerSketch(showLayers: showLayers) // Solid content with a floating glass toolbar.
                Toggle("Label the two layers", isOn: $showLayers) // Shows or hides the layer labels.
                ConceptPoints(points: [ // The step's four rules.
                    ("Glass is for controls", "Toolbars, tab bars, floating buttons and sheets. Never put lists, cards or paragraphs of text on glass."), // Rule 1.
                    ("No glass on glass", "A glass button inside a glass card looks muddy, and glass cannot sample other glass. Keep one glass layer."), // Rule 2.
                    ("Use it sparingly", "When everything is glass, nothing stands out. A few floating controls create hierarchy."), // Rule 3.
                    ("Tint with purpose", "Tint only the primary or meaningful action, such as a red record button, never every button."), // Rule 4.
                ])
                Label("Legibility comes first. On this device right now: Reduce Transparency is \(reduceTransparency ? "On" : "Off"), Increase Contrast is \(contrast == .increased ? "On" : "Off"). System glass turns frostier or higher-contrast for these settings automatically.", systemImage: "eye") // Reads the real settings.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }

            DemoCard(title: "Float a control on glass", caption: "The course's GalleryView. Scroll the tiles under the capsule and watch it take on each color.") { // Code step.
                PreviewSurface { // A piece of screen.
                    GalleryView(paddingAfterGlass: paddingAfterGlass, captionIcons: captionIcons) // The course's view, with its two try-its.
                        .frame(height: 300) // A window onto the scrolling gallery.
                        .clipShape(.rect(cornerRadius: 12)) // Matches the surface's corners.
                }
                Toggle("Try it: .padding(16) below .glassEffect()", isOn: $paddingAfterGlass) // The capsule then hugs the icons.
                Toggle("Try it: .caption instead of .title2", isOn: $captionIcons) // Is it still easy to tap?
                Text(paddingAfterGlass ? "The glass is drawn around whatever the view is when .glassEffect() runs. Padding added afterwards only adds empty space outside the capsule." : (captionIcons ? "Caption-size icons in a small capsule make a target far below 44 points." : "Padding first, then glass: the capsule includes the padding, so it is comfortable to look at and to tap.")) // Explains the current state.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }

            DemoCard(title: "Regular or clear, capsule or rectangle", caption: "Regular glass adapts to stay readable; clear glass is far more transparent and is meant for controls over photos and video.") { // Code step.
                Picker("Background", selection: $backdrop) { // Try it: change the background.
                    ForEach(VariantBackdrop.allCases) { Text($0.rawValue).tag($0) } // Indigo, yellow, photo.
                }
                .pickerStyle(.segmented) // Three side-by-side choices.
                PreviewSurface { // A piece of screen.
                    VariantsView(backdrop: backdrop, whiteOnClear: whiteOnClear) // The course's view.
                        .frame(height: 220) // Room for both samples.
                        .clipShape(.rect(cornerRadius: 12)) // Matches the surface.
                }
                Toggle("Try it: keep .foregroundStyle(.white) on clear", isOn: $whiteOnClear) // The second try-it.
                Text(backdrop == .yellow ? "On yellow, the clear label struggles while regular glass adapts its tone to keep text readable." : "Switch to Yellow and to Photo, then turn off white text: clear glass needs bold, bright content on it.") // Guides the experiment.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }

            DemoCard(title: "Glass buttons in a shared container", caption: "Use .glass for secondary actions and .glassProminent for the one primary action. Tap Save and Cancel.") { // Code step.
                PreviewSurface { // A piece of screen.
                    EditorBar(cancelProminent: cancelProminent, tintSaveGreen: tintSaveGreen) // The course's view.
                        .padding(.vertical, 24) // Room around the bar.
                }
                Toggle("Try it: give Cancel .glassProminent too", isOn: $cancelProminent) // Which would a hurried person press?
                Toggle("Try it: .tint(.green) on Save", isOn: $tintSaveGreen) // What does green now suggest?
                Text(cancelProminent ? "Two prominent buttons: a hurried person can no longer tell which one is the main action." : (tintSaveGreen ? "Green now suggests success or go. Tint carries meaning, so use it on purpose." : "One prominent button, tinted with the app's accent color, marks the primary action.")) // Explains the state.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }

            DemoCard(title: "Glass on glass, or one layer of glass", caption: "Below, live: the course's GlassCard puts content on glass and a glass button inside it.") { // Compare step.
                PreviewSurface { // A piece of screen.
                    ZStack { // The card over a colorful scene, like a real background.
                        PhotoBackdrop() // A busy, colorful backdrop from the asset catalog.
                        GlassCard() // The mistake.
                    }
                    .frame(height: 220) // A fixed window.
                    .clipShape(.rect(cornerRadius: 12)) // Matches the surface.
                }
                Button("Compare with the fix", systemImage: "rectangle.split.2x1") { showRunCard = true } // Opens the comparison.
                    .buttonStyle(.bordered) // A secondary-looking action.
                VerdictBox(text: "Glass is for the controls that float above content, not for the content itself. The fix removes glass: the summary sits on a solid background and Share moves into the system toolbar, one layer of glass.") // The verdict.
            }
            .fullScreenCover(isPresented: $showRunCard) { // Full screen, because RunCard has its own NavigationStack.
                FullScreenComparison(beforeLabel: "Glass on glass", afterLabel: "One glass layer") { // The comparison container.
                    ZStack { // The mistake over the same busy scene.
                        LinearGradient(colors: [.orange, .pink, .purple, .indigo], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea() // A vivid full-bleed backdrop for the glass to bend.
                        GlassCard() // Content on glass, glass inside glass.
                    }
                } after: { // The fix.
                    RunCard() // Solid content, Share in the toolbar.
                }
            }

            DemoCard(title: "Tint, touch response, and morphing", caption: "The course's RecordControls, running. Tap Record: Pause grows out of the same glass. Press and hold to feel the interactive glass.") { // Code step.
                PreviewSurface { // A piece of screen.
                    ZStack { // Colorful content behind the glass.
                        LinearGradient(colors: [.orange, .pink, .purple], startPoint: .topLeading, endPoint: .bottomTrailing) // Something for the glass to bend.
                        RecordControls(useContainer: useContainer) // The course's view.
                    }
                    .frame(height: 140) // Room for the controls.
                    .clipShape(.rect(cornerRadius: 12)) // Matches the surface.
                }
                Toggle("Wrap in GlassEffectContainer", isOn: $useContainer) // The step's predict question.
                Text(useContainer ? "Inside one container the shapes share a surface, so Pause morphs out of Record and they can blend when close." : "Without the container each button is its own glass: Pause simply appears next to Record, with no morph, and neighbors cannot blend.") // The answer to the prediction.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }

            DemoCard(title: "Liquid Glass lab", caption: "Drag on the content to move the glass toolbar over the photo, the text, the tiles and the dark and bright blocks. Change the variant and tint, then turn on the glass-on-glass mistake.") { // Widget step.
                GlassLab() // The interactive lab.
            }
        }
    }
}

/// A horizontally scrolling strip of colorful content under one fixed glass capsule.
struct LensingStrip: View { // Shows lensing and adaptivity.
    private let tiles: [(Color, String)] = [(.orange, "sun.max"), (.white, "cloud"), (.teal, "drop"), (.black, "moon.stars"), (.pink, "heart"), (.yellow, "bolt"), (.indigo, "sparkles")] // Bright, dark and colorful content.

    var body: some View { // Built once; the scroll position lives in the ScrollView.
        ScrollView(.horizontal) { // Scroll sideways under the capsule.
            HStack(spacing: 0) { // Tiles edge to edge.
                ForEach(tiles.indices, id: \.self) { index in // One tile per color.
                    tiles[index].0 // The tile's color.
                        .frame(width: 120, height: 120) // Square tiles.
                        .overlay { Image(systemName: tiles[index].1).font(.largeTitle).foregroundStyle(.gray) } // A shape to see bent by the glass.
                }
            }
        }
        .scrollIndicators(.hidden) // A clean strip.
        .overlay { // The control floats above the content.
            HStack(spacing: 24) { // Two icons, like the course's example.
                Image(systemName: "heart") // An icon on glass.
                Image(systemName: "square.and.arrow.up") // Another one.
            }
            .font(.title2) // Comfortable icon size.
            .padding(14) // Padding first...
            .glassEffect() // ...then glass, so the capsule includes the padding.
            .accessibilityElement(children: .ignore) // One description for the decorative capsule...
            .accessibilityLabel("Glass capsule with two icons") // ...in words.
            .allowsHitTesting(false) // Let drags pass through to the strip.
        }
        .clipShape(.rect(cornerRadius: 12)) // Rounded edges like the other previews.
    }
}

/// Solid content rows with a floating glass toolbar, optionally labeling the two layers.
struct LayerSketch: View { // "Content below, controls above".
    let showLayers: Bool // Whether to show the layer labels.

    var body: some View { // Rebuilt when the toggle changes.
        PreviewSurface { // A piece of screen.
            VStack(alignment: .leading, spacing: 8) { // The content layer: solid rows.
                ForEach(0..<3, id: \.self) { index in // Three content rows.
                    Label(["Morning Run", "Evening Ride", "Pool Laps"][index], systemImage: ["figure.run", "figure.outdoor.cycle", "figure.pool.swim"][index]) // Readable text on a solid background.
                        .padding(.vertical, 6) // Row height.
                }
                if showLayers { // Optional label.
                    Text("Content layer: solid and readable").font(.caption).foregroundStyle(.secondary) // Names the layer.
                }
                Spacer(minLength: 60) // Leaves room for the floating toolbar.
            }
            .padding() // Standard margins.
            .frame(maxWidth: .infinity, alignment: .leading) // Full width.
            .overlay(alignment: .bottom) { // The navigation layer floats above.
                VStack(spacing: 4) { // Toolbar plus optional label.
                    if showLayers { // Optional label.
                        Text("Navigation layer: glass").font(.caption).foregroundStyle(.secondary) // Names the layer.
                    }
                    HStack(spacing: 28) { // The floating controls.
                        Image(systemName: "plus") // Add.
                        Image(systemName: "line.3.horizontal.decrease") // Filter.
                        Image(systemName: "square.and.arrow.up") // Share.
                    }
                    .font(.title3) // Comfortable size.
                    .padding(.horizontal, 20).padding(.vertical, 12) // Room inside the capsule.
                    .glassEffect() // One layer of glass.
                    .accessibilityHidden(true) // Decorative in this sketch.
                }
                .padding(.bottom, 12) // Off the bottom edge.
            }
        }
    }
}

/// The lemon pasta photo from the asset catalog, filling exactly the space it is offered.
struct PhotoBackdrop: View { // Used wherever glass needs busy content behind it.
    var body: some View { // Built once.
        Color.clear // Takes exactly the offered size...
            .overlay { // ...and the photo is drawn on top of it...
                Image("lemon-pasta") // ...from Assets.xcassets...
                    .resizable() // ...allowed to change size...
                    .scaledToFill() // ...covering the whole area...
            }
            .clipped() // ...with the overflow trimmed, so it never widens the layout.
            .accessibilityHidden(true) // A decorative backdrop for the demos.
    }
}

/// The three backgrounds for the regular-versus-clear comparison.
enum VariantBackdrop: String, CaseIterable, Identifiable { // Drives the segmented picker.
    case indigo = "Indigo" // The course's background.
    case yellow = "Yellow" // The course's try-it.
    case photo = "Photo" // Clear glass's intended home.
    var id: String { rawValue } // Identifiable for ForEach.
}

/// The draggable glass toolbar lab.
struct GlassLab: View { // From the course's "Liquid Glass lab" widget.
    @State private var barY: CGFloat = 40 // The toolbar's vertical center, in points from the top.
    @State private var variant = Version.before // before = Regular, after = Clear (reuses the two-way picker type).
    @State private var tint = LabTint.none // The toolbar's tint.
    @State private var glassOnGlass = false // The mistake.
    private let rowHeight: CGFloat = 80 // Height of each content region.

    /// The region under the toolbar's center.
    private var region: LabRegion { // Computed from barY.
        let index = Int(barY / rowHeight) // Which band the center is in.
        return LabRegion.allCases[min(LabRegion.allCases.count - 1, max(0, index))] // Clamped into range.
    }

    var body: some View { // Rebuilt when the bar moves or a setting changes.
        VStack(alignment: .leading, spacing: 10) { // Controls, lab, meter.
            BeforeAfterPicker(version: $variant, beforeLabel: "Regular", afterLabel: "Clear") // The variant.
            Picker("Tint", selection: $tint) { // The tint.
                ForEach(LabTint.allCases) { Text($0.rawValue).tag($0) } // None, Blue, Red.
            }
            .pickerStyle(.segmented) // Side-by-side choices.
            Toggle("Glass on glass (the mistake)", isOn: $glassOnGlass) // Wraps the toolbar in a glass panel.
            ZStack(alignment: .top) { // Content, with the toolbar on top.
                VStack(spacing: 0) { // The content regions, top to bottom.
                    ForEach(LabRegion.allCases) { band in // One band per region.
                        band.content.frame(height: rowHeight) // Each band's drawing.
                    }
                }
                toolbar // The glass toolbar.
                    .frame(maxWidth: .infinity) // Centered horizontally.
                    .offset(y: barY - 32) // Its center sits at barY.
            }
            .frame(height: rowHeight * CGFloat(LabRegion.allCases.count)) // All six bands.
            .clipShape(.rect(cornerRadius: 12)) // Rounded like the other previews.
            .contentShape(Rectangle()) // The whole lab responds to drags.
            .gesture(DragGesture(minimumDistance: 0).onChanged { value in // Follow the finger.
                barY = min(rowHeight * CGFloat(LabRegion.allCases.count) - 1, max(0, value.location.y)) // Keep the bar inside the lab.
            })
            .accessibilityElement(children: .ignore) // VoiceOver sees one adjustable control.
            .accessibilityLabel("Glass toolbar position") // What it is.
            .accessibilityValue("Over \(region.description)") // Where it is.
            .accessibilityAdjustableAction { direction in // Swipe up or down to move it.
                let step = direction == .increment ? rowHeight : -rowHeight // One region per swipe.
                barY = min(rowHeight * CGFloat(LabRegion.allCases.count) - 1, max(0, barY + step)) // Clamped.
            }
            meter // The legibility readout.
        }
    }

    /// The toolbar: three icons on glass, optionally inside a second glass panel.
    @ViewBuilder private var toolbar: some View { // ViewBuilder: the if/else returns different shapes.
        let glass = (variant == .before ? Glass.regular : Glass.clear).tint(tint.color) // The chosen variant and tint.
        let icons = HStack(spacing: 26) { // The three toolbar icons.
            Image(systemName: "heart") // Favorite.
            Image(systemName: "bookmark") // Save.
            Image(systemName: "square.and.arrow.up") // Share.
        }
        .font(.title3.weight(.semibold)) // Bold icons, as clear glass needs.
        .foregroundStyle(variant == .after ? AnyShapeStyle(.white) : AnyShapeStyle(.primary)) // Clear glass gets bright icons; regular adapts.
        .padding(.horizontal, 22).padding(.vertical, 14) // Padding first...
        .glassEffect(glass, in: .capsule) // ...then glass.
        if glassOnGlass { // The mistake: a glass panel around the glass toolbar.
            icons.padding(12).glassEffect(.regular, in: .rect(cornerRadius: 26)) // Glass that can only sample other glass.
        } else { // One layer.
            icons // Just the toolbar.
        }
    }

    /// The readout under the lab.
    private var meter: some View { // Uses the same contrast math as lesson 5.4.
        let base = region.baseColor // The main color behind the bar.
        let white = Contrast.ratio(.white, base) // Light icons on it.
        let black = Contrast.ratio(.black, base) // Dark icons on it.
        let text: String // The message for the current settings.
        if glassOnGlass { // The mistake wins over everything else.
            text = "Glass on glass: the inner capsule samples the outer glass, not the content, so it flattens and turns muddy and the two layers compete." // Why the mistake fails.
        } else if variant == .after { // Clear glass does not adapt.
            text = "Clear glass does not adapt. White icons against \(region.description) (\(base.hexString)) measure \(Contrast.label(white)):1 before the glass softens anything. \(white < 3 ? "Too low: clear glass here needs a dimming layer, or regular glass." : "Bold, bright icons can work here.")" // The course's rule for clear.
        } else { // Regular glass adapts.
            text = "Regular glass adapts its icons to the content: over \(region.description) (\(base.hexString)) it leans \(black > white ? "dark" : "light"), \(Contrast.label(max(white, black))):1 against the base color, instead of \(Contrast.label(min(white, black))):1 the other way." // Why adaptivity matters.
        }
        return Text(text) // The readout.
            .font(.footnote) // A caption.
            .foregroundStyle(.secondary) // Quieter.
            .fixedSize(horizontal: false, vertical: true) // Wrap instead of truncating.
    }
}

/// The tints the lab offers.
enum LabTint: String, CaseIterable, Identifiable { // Drives the segmented picker.
    case none = "No tint" // Plain glass.
    case blue = "Blue" // A calm tint.
    case red = "Red" // A meaningful tint, like a record button.
    var id: String { rawValue } // Identifiable for ForEach.
    var color: Color? { self == .none ? nil : (self == .blue ? .blue : .red) } // nil means "no tint".
}

/// The six kinds of content the lab's toolbar can float over.
enum LabRegion: String, CaseIterable, Identifiable { // In order, top to bottom.
    case photo, text, tiles, dark, bright, busy // As in the course widget.
    var id: String { rawValue } // Identifiable for ForEach.

    /// Words for the readout and VoiceOver.
    var description: String { // Plain names.
        switch self { // One phrase per region.
        case .photo: "the warm photo" // Region 1.
        case .text: "the article text" // Region 2.
        case .tiles: "the colored tiles" // Region 3.
        case .dark: "the dark night block" // Region 4.
        case .bright: "the bright snow block" // Region 5.
        case .busy: "the busy confetti" // Region 6.
        }
    }

    /// The dominant color of the region, for the contrast readout.
    var baseColor: RGB { // A representative color, not a pixel measurement.
        switch self { // One color per region.
        case .photo: RGB(hex: 0xC4986C) // The warm table in the photo.
        case .text: RGB(hex: 0xFFFFFF) // A white page.
        case .tiles: RGB(hex: 0x30B0C7) // Teal tiles.
        case .dark: RGB(hex: 0x101830) // Night.
        case .bright: RGB(hex: 0xF4F7FA) // Snow.
        case .busy: RGB(hex: 0x9A7BB0) // The average of the confetti.
        }
    }

    /// The drawing of the region.
    @ViewBuilder var content: some View { // ViewBuilder: each case returns a different view type.
        switch self { // One drawing per region.
        case .photo: // A real image from the asset catalog.
            PhotoBackdrop() // Fill the band.
        case .text: // A paragraph on white.
            Text("Liquid Glass reflects and refracts what is behind it. Over text, every letter passing beneath the bar competes with the icons on it.") // Body copy.
                .font(.footnote).foregroundStyle(.black).padding(10) // Dark text on white.
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading).background(.white) // A white page.
        case .tiles: // Colored tiles.
            HStack(spacing: 0) { ForEach([Color.teal, .mint, .cyan, .blue], id: \.self) { $0 } } // Four colors side by side.
        case .dark: // A dark night block.
            Color(red: 0.06, green: 0.09, blue: 0.19).overlay { Image(systemName: "moon.stars.fill").font(.title).foregroundStyle(.yellow.opacity(0.6)) } // Night sky.
        case .bright: // A bright snow block.
            Color(red: 0.96, green: 0.97, blue: 0.98) // Snow.
        case .busy: // Busy confetti.
            Canvas { context, size in // Draws many small dots.
                var generator = SeededGenerator(seed: 11) // The same confetti every time.
                for _ in 0..<160 { // 160 dots.
                    let x = CGFloat.random(in: 0...size.width, using: &generator), y = CGFloat.random(in: 0...size.height, using: &generator) // A position.
                    let colors: [Color] = [.red, .yellow, .green, .blue, .purple, .orange] // Party colors.
                    let color = colors[Int.random(in: 0..<colors.count, using: &generator)] // One of them.
                    context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: 8, height: 8)), with: .color(color)) // A dot.
                }
            }
            .background(Color(red: 0.6, green: 0.48, blue: 0.69)) // A purple base.
        }
    }
}

// MARK: - The course's examples

/// The course's GalleryView, with its two try-its as parameters.
struct GalleryView: View { // From "Float a control on glass".
    var paddingAfterGlass = false // Try it 1.
    var captionIcons = false // Try it 2.
    let tiles: [Color] = [.orange, .pink, .teal, .indigo] // The scrolling content.

    var body: some View { // Rebuilt when a try-it changes.
        ScrollView { // The content layer scrolls.
            ForEach(tiles, id: \.self) { tile in // One tile per color.
                tile.frame(height: 180) // A tall colored block.
            }
            .padding() // Standard margins.
        }
        .overlay(alignment: .bottom) { // The control floats above.
            let icons = HStack(spacing: 28) { // The two icons.
                Image(systemName: "heart") // Favorite.
                Image(systemName: "square.and.arrow.up") // Share.
            }
            .font(captionIcons ? .caption : .title2) // .title2 in the course; .caption for the try-it.
            if paddingAfterGlass { // The try-it order.
                icons.glassEffect().padding(16) // Glass hugs the icons; padding only adds space outside.
            } else { // The course's order.
                icons.padding(16).glassEffect() // Padding first, so the capsule includes it.
            }
        }
    }
}

/// The course's VariantsView, with a choice of background and the white-text try-it.
struct VariantsView: View { // From "Regular or clear, capsule or rectangle".
    var backdrop = VariantBackdrop.indigo // Indigo in the course.
    var whiteOnClear = true // The course sets white text on clear glass.

    var body: some View { // Rebuilt when a choice changes.
        ZStack { // Background, then the two samples.
            switch backdrop { // The chosen background.
            case .indigo: Color.indigo.ignoresSafeArea() // The course's background.
            case .yellow: Color.yellow.ignoresSafeArea() // The try-it.
            case .photo: PhotoBackdrop() // Media, clear glass's home.
            }
            VStack(spacing: 24) { // The two samples.
                Text("Regular glass") // Sample 1.
                    .font(.headline) // Bold enough to read on glass.
                    .padding() // Room inside the glass.
                    .glassEffect(.regular, in: .rect(cornerRadius: 16)) // Regular glass, rounded rectangle.
                Text("Clear glass") // Sample 2.
                    .font(.headline) // Same style.
                    .foregroundStyle(whiteOnClear ? AnyShapeStyle(.white) : AnyShapeStyle(.primary)) // White in the course.
                    .padding() // Room inside the glass.
                    .glassEffect(.clear, in: .capsule) // Clear glass, capsule.
            }
        }
    }
}

/// The course's EditorBar, with its two try-its.
struct EditorBar: View { // From "Glass buttons in a shared container".
    var cancelProminent = false // Try it 1.
    var tintSaveGreen = false // Try it 2.
    @State private var saved = false // Saved or draft.

    var body: some View { // Rebuilt when saved changes.
        VStack(spacing: 32) { // Status above the buttons.
            Text(saved ? "Saved" : "Draft") // The document's state.
                .font(.title2) // A clear status.
            GlassEffectContainer(spacing: 16) { // Neighboring glass shares one surface.
                HStack(spacing: 16) { // Two buttons side by side.
                    if cancelProminent { // The try-it.
                        Button("Cancel") { saved = false }.buttonStyle(.glassProminent) // Now just as loud as Save.
                    } else { // The course's version.
                        Button("Cancel") { saved = false }.buttonStyle(.glass) // A secondary action.
                    }
                    Button("Save") { saved = true } // The primary action.
                        .buttonStyle(.glassProminent) // Tinted with the accent color.
                        .tint(tintSaveGreen ? Color.green : nil) // nil keeps the accent color.
                }
            }
        }
    }
}

/// The course's flawed card: content on glass, and a glass button inside it.
struct GlassCard: View { // The "before" of "Glass on glass, or one layer of glass".
    var body: some View { // Compiles cleanly; the problem is design.
        VStack(spacing: 12) { // Centered lines.
            Text("Morning Run") // Content, on glass: mistake one.
                .font(.headline) // Fine type, on a shifting surface.
            Text("5.2 km in 28 minutes") // Regular text on glass loses contrast.
            Button("Share") { } // A button inside a content card.
                .buttonStyle(.glass) // Glass on glass: mistake two.
        }
        .padding() // Room inside the card.
        .glassEffect(.regular, in: .rect(cornerRadius: 24)) // The whole card is glass.
    }
}

/// The course's fixed screen: solid content, one glass layer in the toolbar.
struct RunCard: View { // The "after".
    var body: some View { // Content and controls in their own layers.
        NavigationStack { // Brings the bar and its glass.
            VStack(alignment: .leading, spacing: 8) { // The content layer.
                Text("Morning Run") // The title.
                    .font(.headline) // Weight separates it from the detail.
                Text("5.2 km in 28 minutes") // The detail.
                    .foregroundStyle(.secondary) // One step down the hierarchy.
            }
            .navigationTitle("Activity") // Where you are.
            .toolbar { Button("Share") { } } // Glass automatically, on the navigation layer.
        }
    }
}

/// The course's RecordControls, with a switch for the container.
struct RecordControls: View { // From "Tint, touch response, and morphing".
    var useContainer = true // The predict question: what if there were no container?
    @Namespace private var glassSpace // Ties the glass IDs together so shapes can morph.
    @State private var isRecording = false // Recording or not.

    var body: some View { // Rebuilt when isRecording changes.
        if useContainer { // The course's version.
            GlassEffectContainer(spacing: 24) { buttons } // One shared glass surface.
        } else { // The prediction.
            buttons // Each button is separate glass.
        }
    }

    /// Record, and Pause while recording.
    private var buttons: some View { // Shared by both versions.
        HStack(spacing: 24) { // Side by side.
            Button(isRecording ? "Stop" : "Record") { // The main control.
                withAnimation { isRecording.toggle() } // Animate the change so the glass can morph.
            }
            .padding() // Room inside the glass.
            .glassEffect(.regular.tint(.red).interactive()) // Red carries meaning; interactive reacts to touch.
            .glassEffectID("record", in: glassSpace) // A stable identity for morphing.
            if isRecording { // Only while recording.
                Button("Pause") { } // The secondary control.
                    .padding() // Room inside the glass.
                    .glassEffect(.regular.interactive()) // Untinted, interactive glass.
                    .glassEffectID("pause", in: glassSpace) // Grows out of Record inside a container.
            }
        }
        .foregroundStyle(.primary) // Readable labels on the glass.
    }
}

#Preview("Lesson 5.2") { // The whole lesson in Xcode's canvas.
    NavigationStack { LiquidGlassLesson(lesson: ContentView.lessons[1]) } // Inside a stack, as in the app.
}

#Preview("GalleryView") { GalleryView() } // The course's preview.

// Lesson_1_1_ManyScreens.swift
// Who: the student who opens lesson 1.1 from the home screen.
// What: Apple's platforms, adaptive controls and platform checks, this
//       device's own points, scale and size classes, the course's device table
//       and converter, and the two adaptive layouts (AnyLayout and ViewThatFits).
// Where: pushed by ContentView when the "1.1" row is tapped.
// When: built when the lesson opens; redrawn on rotation and on every control change.
// Why: one Swift codebase runs on many screens, and the way to handle them is
//      to measure in points and ask how much space there is, never which model.

import SwiftUI // SwiftUI provides the views, layouts and environment values.

struct ManyScreensLesson: View { // The screen for lesson 1.1.
    let lesson: Lesson // The catalog entry: number, title and summary.
    @Environment(\.horizontalSizeClass) private var widthClass // The real width class SwiftUI gives this screen.
    @Environment(\.verticalSizeClass) private var heightClass // The real height class.
    @Environment(\.displayScale) private var displayScale // Pixels per point on this screen.
    @State private var demoToggle = true // A Toggle that shows the platform's native control.
    @State private var device = DeviceSpec.all[0] // The device picked in the explorer.
    @State private var iconPoints = 30 // The converter's input, 30 pt as in the quiz.
    @State private var widthChoice = WidthChoice.device // Which width class the AnyLayout demo uses.
    @State private var badgeTitle = "Runs on iPhone, iPad and Mac" // DeviceBadge's title; the course's default.
    @State private var badgeWidth: CGFloat = 330 // The space offered to ViewThatFits, in points.

    /// The choices for the size-class demo: the real class, or a forced one.
    enum WidthChoice: String, CaseIterable, Identifiable { // CaseIterable feeds the picker.
        case device = "This screen", compact = "Compact", regular = "Regular" // The labels shown in the segments.
        var id: String { rawValue } // Labels are unique.
    }

    var body: some View { // Rebuilt on rotation and on every change.
        LessonPage(lesson: lesson) { // The shared scrolling page from CourseKit.
            DemoCard(title: "Six platforms, one family", caption: "A platform is an operating system plus the frameworks Apple ships with it. All six share the same kernel, the same Swift language and the same SwiftUI framework.") { // Step 1.
                TermList([ // The step's points.
                    ("iOS and iPadOS", "iPhone and iPad. The largest audience, and the focus of this course."), // Point 1.
                    ("macOS", "Mac. Resizable windows, menus, keyboard and pointer."), // Point 2.
                    ("watchOS", "Apple Watch. Glanceable information, used a few seconds at a time."), // Point 3.
                    ("tvOS", "Apple TV. Viewed from across the room and driven by a remote."), // Point 4.
                    ("visionOS", "Apple Vision Pro. Windows and 3D content placed in the room around you."), // Point 5.
                ])
                LabeledContent("This device runs", value: DeviceInfo.system) // The live platform and version, such as iOS 26.1.
                    .font(.subheadline.weight(.semibold)) // Stands out from the list.
                Callout(tone: .ecosystem, title: "One version number for everything", text: "Since 2025 every Apple platform shares a version number named for the year ahead: iOS 26, iPadOS 26, macOS Tahoe 26, watchOS 26, tvOS 26 and visionOS 26, all built with Xcode 26. Before that, iOS was at 18 while watchOS was at 11.") // The step's callout.
            }

            DemoCard(title: "Write once, then adapt", caption: "SwiftUI draws each control in the native style of the platform it runs on. Good apps share the logic and adjust layout and controls for each device's input and viewing distance.") { // Step 2.
                Toggle("Adaptive controls: a Toggle", isOn: $demoToggle) // On iPhone this is a switch.
                Text("On iPhone this Toggle is a switch. The same line of code draws a checkbox on a Mac.") // Says what the other platform would show.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // Quieter than the control.
                CodeBlock("#if os(watchOS)\n    Text(\"Glance at your wrist\")\n#else\n    Text(\"\(PlatformCheck.message)\")\n#endif") // A platform check, written out as code.
                Text(PlatformCheck.message) // The line the compiler actually kept for this build.
                    .font(.subheadline.weight(.semibold)) // Stands out as the live result.
                TermList([ // The step's points.
                    ("Multiplatform target", "One Xcode target can build for several platforms, for example iPhone, iPad, Mac and Vision Pro, from the same Swift files."), // Point 1.
                    ("Adaptive controls", "SwiftUI chooses the native look and behavior of each control for the current platform."), // Point 2.
                    ("Platform checks", "Code between #if os(watchOS) and #endif is compiled only when building for that platform."), // Point 3.
                ])
            }

            DemoCard(title: "Points, not pixels", caption: "Layout is measured in points, which stay about the same physical size on every device. The scale factor says how many pixels make up one point along each side. These are this screen's own numbers.") { // Step 3.
                if let screen = DeviceInfo.screen() { // Only when the app can see its screen.
                    LabeledContent("Screen size", value: PixelMath.describe(Int(screen.points.width), Int(screen.points.height)) + " pt") // For example 402 x 874 pt.
                    LabeledContent("Scale factor", value: "@\(Int(displayScale))x") // For example @3x.
                    LabeledContent("Pixels", value: PixelMath.describe(PixelMath.pixels(points: Int(screen.points.width), scale: Int(screen.scale)), PixelMath.pixels(points: Int(screen.points.height), scale: Int(screen.scale))) + " px") // Points times scale.
                }
                HStack(spacing: 12) { // The square beside its explanation.
                    Rectangle() // The 44-point tap target.
                        .fill(.orange) // The course's orange square.
                        .frame(width: TapTarget.minimum, height: TapTarget.minimum) // Exactly 44 x 44 points.
                    Text("This square is 44 x 44 points: \(PixelMath.pixels(points: 44, scale: Int(displayScale))) x \(PixelMath.pixels(points: 44, scale: Int(displayScale))) pixels on this @\(Int(displayScale))x screen.") // The same square in pixels.
                        .font(.footnote) // Small print.
                }
                TermList([ // The step's points.
                    ("@1x", "1 point is 1 pixel. Older, non-Retina screens and Apple TV in HD."), // Point 1.
                    ("@2x", "1 point is 2 x 2 pixels. iPad, Mac Retina displays, Apple Watch, iPhone SE."), // Point 2.
                    ("@3x", "1 point is 3 x 3 pixels. Most current iPhones."), // Point 3.
                ])
                Callout(tone: .design, title: "The 44-point rule", text: "Apple's Human Interface Guidelines recommend tap targets of at least 44 x 44 points. That is 88 x 88 pixels at @2x and 132 x 132 pixels at @3x, yet it feels about the same size under your finger on every iPhone.") // The step's callout.
            }

            DemoCard(title: "Explore the devices", caption: "Pick a device to see its screen in points, its scale factor and the pixels behind it, plus how people hold and navigate it.") { // Step 4, the explorer widget.
                LabeledContent("Device") { // The label on the left, the menu on the right.
                    Picker("Device", selection: $device) { // A menu of the course's devices.
                        ForEach(DeviceSpec.all) { Text($0.name).tag($0) } // One item per device.
                    }
                    .labelsHidden() // LabeledContent already shows the label.
                }
                LabeledContent("Platform", value: device.os) // The device's platform.
                LabeledContent("Points", value: PixelMath.describe(device.points.width, device.points.height) + " pt") // Its size in points.
                LabeledContent("Scale", value: device.scale.map { "@\($0)x" } ?? "None fixed") // Its scale factor.
                LabeledContent("Pixels", value: device.pixels.map { PixelMath.describe($0.width, $0.height) + " px" } ?? "Drawn sharply at any size") // Points times scale.
                TermList([("Size classes", device.sizeClasses), ("Input", device.input), ("Navigation", device.navigation)]) // The rest of the device's card.
            }

            DemoCard(title: "Explore the devices: the converter", caption: "Turn a size in points into the pixel sizes your image assets need. The quiz asks about a 30-point icon.") { // The explorer's converter.
                Stepper("Icon size: \(iconPoints) pt", value: $iconPoints, in: 1...200) // The size in points.
                ForEach(PixelMath.assetSizes(points: iconPoints), id: \.scale) { size in // One row per scale factor.
                    LabeledContent("@\(size.scale)x image", value: PixelMath.describe(size.pixels, size.pixels) + " px") // For example @2x: 60 x 60 px.
                }
            }

            DemoCard(title: "Explore the devices: compare at true scale", caption: "The touch devices drawn at the same scale in points. The orange square is 44 x 44 points on every one, so it is the same size on all four.") { // The explorer's comparison view.
                TrueScaleComparison() // The four outlines.
            }

            DemoCard(title: "Size classes: design for space, not for models", caption: "iOS describes the space a view has with two size classes, one for width and one for height. Rotate the Simulator (Command-Left Arrow) and watch these change.") { // Step 5.
                LabeledContent("Width (horizontal) class", value: DeviceInfo.name(of: widthClass)) // Live from the environment.
                LabeledContent("Height (vertical) class", value: DeviceInfo.name(of: heightClass)) // Live from the environment.
                TermList([ // The step's points.
                    ("iPhone, portrait", "Compact width, regular height."), // Point 1.
                    ("iPhone, landscape", "Compact height. Width is compact on most models and regular on the largest ones, such as the Pro Max."), // Point 2.
                    ("iPad, full screen", "Regular width and regular height, in both orientations."), // Point 3.
                    ("iPad, narrow window", "Compact width when the user makes your window narrow, so an iPad app may need its iPhone layout."), // Point 4.
                ])
                Callout(tone: .tip, title: "Reading it in SwiftUI", text: "@Environment(\\.horizontalSizeClass) gives a view the current width class. SwiftUI updates it, and redraws your view, whenever the user rotates the device or resizes a window.") // The step's callout.
            }

            DemoCard(title: "A layout that follows the size class", caption: "The course's WelcomeView: icon above title when width is compact, side by side when it is regular. Force either class to see both layouts without an iPad.") { // Step 6.
                Picker("Width class", selection: $widthChoice) { // Real, compact or regular.
                    ForEach(WidthChoice.allCases) { Text($0.rawValue).tag($0) } // One segment per choice.
                }
                .pickerStyle(.segmented) // All three visible.
                WelcomeView() // The course's view, unchanged.
                    .environment(\.horizontalSizeClass, chosenWidthClass) // Hands it the chosen width class.
                    .frame(maxWidth: .infinity) // Centered in the card.
                SourceNote("WelcomeView in Lesson_1_1_ManyScreens.swift") // Where to read its code.
            }

            DemoCard(title: "Let SwiftUI pick what fits", caption: "ViewThatFits shows the first child that fits. Change the title or the space and watch the badge switch between a row and a column. The dashed box is the space offered.") { // Step 7.
                TextField("Badge title", text: $badgeTitle) // Try it 1: edit the title.
                    .textFieldStyle(.roundedBorder) // A visible box to type in.
                HStack { // Quick presets from the Try it list.
                    Button("Course title") { badgeTitle = "Runs on iPhone, iPad and Mac" } // The original.
                    Button("Runs everywhere") { badgeTitle = "Runs everywhere" } // The Try it's shorter title.
                }
                .buttonStyle(.bordered) // Secondary actions.
                Slider(value: $badgeWidth, in: 140...330, step: 10) { Text("Space") } // The width offered to the badge.
                Text("Space offered: \(Int(badgeWidth)) pt") // Says the current width.
                    .font(.footnote.monospacedDigit()) // Small, with even digits.
                DeviceBadge(title: badgeTitle) // The course's view.
                    .frame(width: badgeWidth) // Offers it exactly this much width.
                    .border(.tint.opacity(0.5)) // Shows the offered space.
                    .frame(maxWidth: .infinity) // Centered in the card.
                SourceNote("DeviceBadge in Lesson_1_1_ManyScreens.swift") // Where to read its code.
            }
        }
    }

    /// The width class handed to WelcomeView: the real one, or the forced one.
    private var chosenWidthClass: UserInterfaceSizeClass? { // Optional, like the environment value itself.
        switch widthChoice { // One answer per choice.
        case .device: widthClass // Whatever SwiftUI says this screen has.
        case .compact: .compact // Forced compact.
        case .regular: .regular // Forced regular.
        }
    }
}

/// Which branch of a platform check the compiler kept for this build.
enum PlatformCheck { // A namespace for one fact.
    static var message: String { // Decided at compile time.
        #if os(watchOS) // Only when building for Apple Watch.
        return "Glance at your wrist" // The watch branch.
        #else // Every other platform, including this iOS build.
        return "Open the full app" // The branch this build compiled.
        #endif // Ends the conditional block.
    }
}

/// The course's size-class layout, exactly as written on the course page.
struct WelcomeView: View { // Icon and title that rearrange with the width class.
    @Environment(\.horizontalSizeClass) private var widthClass // The current width class.

    var body: some View { // Re-run when widthClass changes.
        let layout = widthClass == .compact // Chooses the layout in one place.
            ? AnyLayout(VStackLayout(spacing: 16)) // Compact: a column, 16 points apart.
            : AnyLayout(HStackLayout(spacing: 32)) // Regular: a row, 32 points apart.

        layout { // The chosen layout holds the same two children either way.
            Image(systemName: "swift") // The Swift bird.
                .font(.system(size: 80)) // Sized like text, at 80 points.
                .foregroundStyle(.orange) // Swift orange.
            Text("One codebase, every screen") // The title.
                .font(.title) // The title text style, which follows Dynamic Type.
        }
        .padding() // Standard space around the layout.
    }
}

/// The course's ViewThatFits badge, exactly as written on the course page.
struct DeviceBadge: View { // A label that becomes a column when a row does not fit.
    var title = "Runs on iPhone, iPad and Mac" // The default title; callers may pass their own.

    var body: some View { // Re-run when the title or the space changes.
        ViewThatFits { // Shows the first child whose ideal size fits.
            Label(title, systemImage: "swift") // First choice: icon and title on one line.
            VStack(spacing: 8) { // Fallback: icon above title.
                Image(systemName: "swift") // The icon.
                Text(title) // The title, which may wrap.
            }
        }
        .font(.title) // Both candidates use the title style.
        .padding() // Padding also shrinks the space ViewThatFits can use.
    }
}

/// The four touch devices outlined at the same scale, each with a 44-point square.
struct TrueScaleComparison: View { // Drawn from the course's device table.
    static let pointsToDrawing: CGFloat = 0.16 // Every device is drawn at 16 percent of its size in points.

    var body: some View { // Drawn once; it has no state.
        HStack(alignment: .bottom, spacing: 14) { // Devices stand side by side on one baseline.
            ForEach(DeviceSpec.comparison) { device in // iPhone SE, 17 Pro, 17 Pro Max, Watch.
                VStack(spacing: 6) { // The outline above its name.
                    RoundedRectangle(cornerRadius: device.id == "iphone-se" ? 6 : 12) // The screen's outline; the SE has squarer corners.
                        .stroke(.secondary, lineWidth: 1.5) // A thin gray outline.
                        .frame(width: CGFloat(device.points.width) * Self.pointsToDrawing, height: CGFloat(device.points.height) * Self.pointsToDrawing) // Scaled from the real size in points.
                        .overlay(alignment: .top) { // The tap target sits near the top of each screen.
                            Rectangle() // The 44-point square, scaled the same way.
                                .fill(.orange) // The course's orange.
                                .frame(width: TapTarget.minimum * Self.pointsToDrawing, height: TapTarget.minimum * Self.pointsToDrawing) // 44 points at the same scale.
                                .padding(.top, 8) // A little below the top edge.
                        }
                    Text(device.name.replacingOccurrences(of: " (3rd generation)", with: "").replacingOccurrences(of: "Apple Watch Series 11 (46 mm)", with: "Watch")) // Short names fit under the outlines.
                        .font(.caption2) // Tiny labels.
                        .multilineTextAlignment(.center) // Centered under each outline.
                        .frame(width: 64) // The same width for every label.
                }
            }
        }
        .frame(maxWidth: .infinity) // Centered in the card.
    }
}

#Preview { // The lesson in Xcode's canvas.
    NavigationStack { ManyScreensLesson(lesson: ContentView.lessons[2]) } // Wrapped in a stack so the title shows.
}

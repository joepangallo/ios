// Module 1: The Apple Platform and Its Ecosystem.
// Platforms and screens, the developer toolbox, the anatomy of a SwiftUI app,
// the app lifecycle, the software development life cycle, the kinds of apps
// and extensions, and where else Swift runs.

const r = String.raw;
const n = (who, what, where, when, why) => ({ who, what, where, when, why });

// ---------------------------------------------------------------------------
// Lesson 1: platforms, form factors, points and size classes
// ---------------------------------------------------------------------------
const platforms = {
  id: 'ecosystem-platforms',
  title: 'One Swift Codebase, Many Screens',
  steps: [
    {
      kind: 'concept',
      title: 'Six platforms, one family',
      body: '<p>Apple makes six software <strong>platforms</strong>. A platform is an operating system plus the frameworks Apple ships with it. Each one runs on its own kind of device, yet all of them share the same core: the same kernel underneath, the same Swift language, and the same SwiftUI framework for building interfaces.</p><p>When you build "an iOS app," you build for the iOS platform. Most of what you learn here carries straight over to the others.</p>',
      points: [
        { term: 'iOS and iPadOS', text: 'iPhone and iPad. The largest audience, and the focus of this course.' },
        { term: 'macOS', text: 'Mac. Resizable windows, menus, keyboard and pointer.' },
        { term: 'watchOS', text: 'Apple Watch. Glanceable information, used a few seconds at a time.' },
        { term: 'tvOS', text: 'Apple TV. Viewed from across the room and driven by a remote.' },
        { term: 'visionOS', text: 'Apple Vision Pro. Windows and 3D content placed in the room around you.' },
      ],
      callout: {
        tone: 'ecosystem',
        title: 'One version number for everything',
        html: '<p>Since 2025 every Apple platform shares a version number named for the year ahead: iOS 26, iPadOS 26, macOS Tahoe 26, watchOS 26, tvOS 26 and visionOS 26, all built with Xcode 26. Before that, iOS was at 18 while watchOS was at 11.</p>',
      },
    },
    {
      kind: 'concept',
      title: 'Write once, then adapt',
      body: '<p>With SwiftUI you describe your interface once, and the framework draws each control in the native style of the platform it runs on. A <code>Toggle</code> is a switch on iPhone and a checkbox on Mac. A list in the first column of a <code>NavigationSplitView</code> becomes a sidebar on iPad and Mac, and collapses into a list you drill into on iPhone.</p><p>Sharing code is not the same as sharing a design. Each device has a different <strong>input method</strong> (finger, pointer, Digital Crown, remote, eyes and hands) and sits at a different distance from the eye. Good apps keep the logic shared and adjust layout and controls for each device.</p>',
      points: [
        { term: 'Multiplatform target', text: 'One Xcode target can build for several platforms, for example iPhone, iPad, Mac and Vision Pro, from the same Swift files.' },
        { term: 'Adaptive controls', text: 'SwiftUI chooses the native look and behavior of each control for the current platform.' },
        { term: 'Platform checks', text: 'Code between #if os(watchOS) and #endif is compiled only when building for that platform.' },
      ],
    },
    {
      kind: 'concept',
      title: 'Points, not pixels',
      body: '<p>A <strong>pixel</strong> is one physical dot of light on a display. Screens differ in how many pixels they pack into an inch, so a layout measured in pixels would make a button tiny on a sharp screen and huge on an older one.</p><p>Instead, Apple platforms measure layout in <strong>points</strong>: an abstract unit that stays roughly the same physical size on every device. The <strong>scale factor</strong> says how many pixels make up one point along each side.</p>',
      points: [
        { term: '@1x', text: '1 point is 1 pixel. Older, non-Retina screens and Apple TV in HD.' },
        { term: '@2x', text: '1 point is 2 x 2 pixels. iPad, Mac Retina displays, Apple Watch, iPhone SE.' },
        { term: '@3x', text: '1 point is 3 x 3 pixels. Most current iPhones.' },
      ],
      callout: {
        tone: 'design',
        title: 'The 44-point rule',
        html: '<p>Apple\'s Human Interface Guidelines recommend tap targets of at least 44 x 44 points. That is 88 x 88 pixels at @2x and 132 x 132 pixels at @3x, yet it feels about the same size under your finger on every iPhone.</p>',
      },
    },
    {
      kind: 'widget',
      title: 'Explore the devices',
      intro: '<p>Pick a device to see its screen size in points, its scale factor and the pixels behind it, plus how people hold it and navigate it. Switch to <strong>Compare at true scale</strong> to line the touch devices up side by side: the orange square is 44 x 44 points on every one. Then use the converter to turn a size in points into the pixel sizes your image assets need.</p>',
      widget: 'ecosystem-device-explorer',
      props: {},
    },
    {
      kind: 'concept',
      title: 'Size classes: design for space, not for models',
      body: '<p>New devices arrive every year, so code that asks "is this an iPhone 17 Pro?" breaks quickly. Instead, iOS describes the space your view has with two <strong>size classes</strong>, one for width and one for height. Each is either <em>compact</em> (constrained) or <em>regular</em> (roomy).</p>',
      points: [
        { term: 'iPhone, portrait', text: 'Compact width, regular height.' },
        { term: 'iPhone, landscape', text: 'Compact height. Width is compact on most models and regular on the largest ones, such as the Pro Max.' },
        { term: 'iPad, full screen', text: 'Regular width and regular height, in both orientations.' },
        { term: 'iPad, narrow window', text: 'Compact width when the user makes your window narrow, so an iPad app may need its iPhone layout.' },
      ],
      callout: {
        tone: 'tip',
        title: 'Reading it in SwiftUI',
        html: '<p><code>@Environment(\\.horizontalSizeClass)</code> gives a view the current width class. SwiftUI updates it, and redraws your view, whenever the user rotates the device or resizes a window. Module 04 (SwiftUI) explains <code>@Environment</code> in full; for now read it as a value SwiftUI hands to your view.</p>',
      },
    },
    {
      kind: 'code',
      title: 'A layout that follows the size class',
      intro: '<p>This view stacks its icon above its title when width is compact, and places them side by side when width is regular. It never mentions a device model, so it adapts to a narrow iPad window as well as to a phone. Size classes come from the environment, which the browser preview does not model, so this example is explained rather than run.</p>',
      run: 'static',
      lines: [
        ['import SwiftUI', n(
          'The Swift compiler, while it builds the app.',
          'Makes SwiftUI available in this file, including View, AnyLayout, the stack layouts and the environment values.',
          'At the top of the file; an import applies only to the file it appears in.',
          'While the compiler builds WelcomeView\'s file, before any of the views below exist.',
          'Frameworks are separate modules, so each file names the ones it uses; that keeps name lookup and build times predictable.')],
        ['', null],
        ['struct WelcomeView: View {', n(
          'Your code declares it; SwiftUI creates and re-creates instances of it.',
          'Declares a value type named WelcomeView that conforms to the View protocol, so SwiftUI knows how to draw it.',
          'A top-level type in this file, visible to the rest of the app.',
          'The type exists from compile time; SwiftUI makes a new instance whenever a parent view rebuilds.',
          'Views are small structs that are cheap to create and discard, which lets SwiftUI rebuild them freely.')],
        [r`    @Environment(\.horizontalSizeClass) private var widthClass`, n(
          'SwiftUI\'s environment, which passes values down the view tree.',
          'Reads the current width class, .compact or .regular, into a property named widthClass.',
          'A property of WelcomeView; the value comes from the window that contains the view.',
          'Read each time body runs; SwiftUI re-runs body when the class changes, such as on rotation or a window resize.',
          'Asking how much space there is, instead of which device this is, keeps the layout right on devices that do not exist yet. Module 04 (SwiftUI) explains @Environment in full; for now read it as "ask SwiftUI for a value it shares with every view".')],
        ['', null],
        ['    var body: some View {', n(
          'SwiftUI calls this computed property; you never call it yourself.',
          'Returns the content of the view; some View means one specific view type that the compiler works out for you.',
          'The one requirement of the View protocol, inside WelcomeView.',
          'When the view first appears and again whenever a value it reads, here widthClass, changes.',
          'An opaque some View type tells SwiftUI the exact shape of your UI at compile time, which makes updates fast.')],
        ['        let layout = widthClass == .compact', n(
          'Your code, running inside body.',
          'Starts a constant named layout whose value depends on whether the width class is compact.',
          'A local constant inside body; it exists only while body runs.',
          'Each time SwiftUI evaluates body.',
          'Making the choice in one place keeps the views below it identical in both cases.')],
        ['            ? AnyLayout(VStackLayout(spacing: 16))', n(
          'The ternary operator picks this branch; SwiftUI\'s layout system uses the result.',
          'For a compact width, chooses a vertical stack layout with 16 points between items, wrapped in AnyLayout.',
          'The true branch of the expression that began on the line above.',
          'During body evaluation, when widthClass is .compact.',
          'AnyLayout erases the concrete layout type so both branches of the ternary have the same type and the code compiles.')],
        ['            : AnyLayout(HStackLayout(spacing: 32))', n(
          'The ternary operator, choosing its false branch.',
          'For a regular width, chooses a horizontal stack layout with a wider 32-point gap.',
          'The false branch of the same expression.',
          'During body evaluation, whenever the width class is not compact.',
          'A full-screen iPad has room for content side by side, so the icon and title sit in a row.')],
        ['', null],
        ['        layout {', n(
          'SwiftUI\'s layout engine, running whichever AnyLayout the ternary chose.',
          'Uses the chosen layout as a container and places the views between its braces.',
          'The root of this view\'s content, inside body.',
          'Every time body runs; the actual positions are computed in SwiftUI\'s layout pass just after.',
          'Only the layout changes while the children stay the same, so SwiftUI can animate from column to row and keep any state the children hold.')],
        ['            Image(systemName: "swift")', n(
          'SwiftUI, drawing from Apple\'s SF Symbols icon library.',
          'Shows the Swift bird symbol as a vector image.',
          'The first child of the layout container.',
          'Created during body and drawn in the next frame.',
          'SF Symbols are vector icons that scale cleanly at any size and on any scale factor, so you rarely need icon image files.')],
        ['                .font(.system(size: 80))', n(
          'A SwiftUI view modifier, applied to the Swift symbol Image.',
          'Sizes the symbol by giving it an 80-point system font.',
          'Applies to the Image on the line above, and only to it.',
          'Applied each time body builds the Image.',
          'Symbols are sized like text, so you control them with font rather than a frame.')],
        ['                .foregroundStyle(.orange)', n(
          'A SwiftUI view modifier on the already-sized Image.',
          'Colors the symbol with the system orange.',
          'Wraps the already-sized Image.',
          'Each time body runs, after .font sizes the symbol; the color is resolved when the frame is drawn.',
          'foregroundStyle is the modern replacement for foregroundColor; it also accepts gradients and semantic styles like .secondary.')],
        ['            Text("One codebase, every screen")', n(
          'SwiftUI\'s Text view, which lays out and draws the title string.',
          'Shows the title string as a label.',
          'The second child of the layout container, after the icon.',
          'Created during body; drawn in the next frame.',
          'Text handles fonts, wrapping, right-to-left languages and VoiceOver for you.')],
        ['                .font(.title)', n(
          'A SwiftUI view modifier on the title Text.',
          'Uses the built-in title text style.',
          'Applies to the Text above it.',
          'Applied each time body runs; the actual size is resolved from the user\'s settings.',
          'Text styles grow and shrink with the user\'s Dynamic Type setting, unlike a fixed point size.')],
        ['        }', null],
        ['        .padding()', n(
          'A SwiftUI view modifier wrapping the whole layout container.',
          'Adds the standard amount of space around the whole layout.',
          'Wraps the layout container, so it pads the icon and title together.',
          'Each time body runs, after the layout container and both children are built.',
          'Default padding uses a platform-appropriate amount, so it looks right on iPhone, iPad and Mac without hard-coded numbers.')],
        ['    }', null],
        ['}', null],
      ],
      try: [
        'In Xcode, preview this view on an iPhone and on an iPad. Which device gets the row, and why?',
        'Which line would you change to make the compact layout use 24 points of spacing?',
      ],
    },
    {
      kind: 'code',
      title: 'Let SwiftUI pick what fits',
      intro: '<p>Sometimes the right layout depends on the content, not on the size class. <code>ViewThatFits</code> tries each child in order and shows the first one that fits in the space available. Edit the title in the phone preview and watch the layout switch between a row and a column.</p>',
      run: 'swiftui',
      lines: [
        ['import SwiftUI', n(
          'The Swift compiler, while it builds DeviceBadge\'s file.',
          'Brings in SwiftUI so the file can use ViewThatFits, HStack, VStack, Image and Text.',
          'The first line of the file; it covers this file only.',
          'At compile time, before DeviceBadge or its preview exists.',
          'Every Swift file states the frameworks it depends on.')],
        ['', null],
        ['struct DeviceBadge: View {', n(
          'Your code defines it; SwiftUI draws it.',
          'Declares a view type named DeviceBadge.',
          'A top-level struct in this file.',
          'Defined at compile time; instantiated by the #Preview block below.',
          'Small, named views are easier to read, preview and reuse than one giant body.')],
        ['    var title = "Runs on iPhone, iPad and Mac"', n(
          'Your struct, storing the text it displays.',
          'Declares the badge text with a default value that callers may override.',
          'A stored property of DeviceBadge, kept inside each instance.',
          'Set when SwiftUI creates the view; read every time body runs.',
          'A var with a default appears as an optional argument in the generated initializer, so DeviceBadge() and DeviceBadge(title:) both work.')],
        ['', null],
        ['    var body: some View {', n(
          'SwiftUI calls it; you only write what it returns.',
          'Describes what DeviceBadge looks like.',
          'The required property of the View protocol.',
          'On first appearance and whenever the view\'s inputs change.',
          'Returning some View lets the compiler keep the full structure of the UI as one precise type.')],
        ['        ViewThatFits {', n(
          'SwiftUI\'s layout system measures each candidate child.',
          'Offers two alternative layouts and shows the first one whose ideal size fits the space available.',
          'The root of body; its children are the candidates, in order of preference.',
          'During layout, and again whenever the available space or the content changes.',
          'It adapts to the real content, such as a long translation, instead of a guessed screen width.')],
        ['            Label(title, systemImage: "swift")', n(
          'SwiftUI\'s Label view, which pairs a title with an SF Symbol.',
          'The first choice: the Swift icon and the title side by side on one line.',
          'The first candidate inside ViewThatFits.',
          'Measured first during every layout pass.',
          'A label in a row is the most compact design, so it is preferred whenever its one-line width fits.')],
        ['            VStack(spacing: 8) {', n(
          'SwiftUI\'s VStack layout, which stacks the icon above the title.',
          'The fallback: icon above title, 8 points apart.',
          'The second and last candidate inside ViewThatFits.',
          'Measured only if the row does not fit; used as-is if nothing fits.',
          'ViewThatFits always shows its last child when no option fits, so the most flexible layout goes last.')],
        ['                Image(systemName: "swift")', n(
          'SwiftUI, with the SF Symbols library.',
          'Shows the Swift symbol on top.',
          'First child of the VStack.',
          'Created each time body runs, but measured only if ViewThatFits rejects the one-line Label.',
          'Repeating the icon in each candidate keeps each layout complete on its own.')],
        ['                Text(title)', n(
          'SwiftUI\'s Text view, drawing the same title string the Label used.',
          'Shows the title under the icon, wrapping onto more lines if needed.',
          'Second child of the VStack.',
          'Created each time body runs; drawn only when the column layout is the one shown.',
          'In a column the text gets the full width, so long titles still read well.')],
        ['            }', null],
        ['        }', null],
        ['        .font(.title)', n(
          'A SwiftUI modifier that passes a value down the environment.',
          'Gives every text and symbol inside the badge the title text style.',
          'Applied to ViewThatFits, so both candidates inherit it.',
          'Applied each time body runs, before ViewThatFits measures.',
          'Setting the font once on a container avoids repeating it on every child.')],
        ['        .padding()', n(
          'A SwiftUI modifier that wraps the entire ViewThatFits.',
          'Adds standard space around the badge.',
          'Wraps the whole ViewThatFits.',
          'Each time body runs, before ViewThatFits measures its candidates against the remaining space.',
          'Padding also shrinks the space ViewThatFits can use, which affects which candidate fits.')],
        ['    }', null],
        ['}', null],
        ['', null],
        ['#Preview {', n(
          'Xcode\'s preview canvas, and this page\'s phone preview.',
          'Declares a preview that renders a DeviceBadge.',
          'A top-level macro in the file, outside any type.',
          'Whenever the canvas refreshes after you edit the file.',
          'Previews let you see a view without launching the whole app.')],
        ['    DeviceBadge()', n(
          'The preview, creating your view.',
          'Makes a DeviceBadge using the default title.',
          'Inside the #Preview closure.',
          'Each time the preview renders.',
          'Using the default keeps the preview identical to what the app would show.')],
        ['}', null],
      ],
      try: [
        'Change the title to "Runs everywhere". Which layout does the phone show now?',
        'Change .font(.title) to .font(.largeTitle). Does the row still fit?',
      ],
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>A designer gives you an icon that should appear at 30 x 30 points. Which image sizes do you add to the asset catalog for @2x and @3x screens?</p>',
          choices: ['30 x 30 for both @2x and @3x', '60 x 60 for @2x and 90 x 90 for @3x', '15 x 15 for @2x and 10 x 10 for @3x', '120 x 120 for @2x and 180 x 180 for @3x'],
          answer: 1,
          explain: '<p>Multiply the size in points by the scale factor: 30 x 2 = 60 and 30 x 3 = 90. Supplying 30 x 30 pixels for both would look blurry, because the system would have to stretch the image to fill twice or three times as many pixels, and 120 and 180 would be four and six times too large.</p>',
        },
        {
          q: '<p>A button measures 132 pixels wide in a screenshot from an iPhone 17 Pro, a @3x device. How wide is it in your SwiftUI code?</p>',
          choices: ['132 points', '66 points', '44 points', '396 points'],
          answer: 2,
          explain: '<p>Divide pixels by the scale factor: 132 / 3 = 44 points, the minimum recommended tap target. 66 points would be the answer on a @2x screen; you always need the scale factor of the device the screenshot came from.</p>',
        },
        {
          q: '<p>Your iPad app shows a sidebar beside its content. A user drags your app into a narrow window next to another app. What should your layout code check to decide whether the sidebar still fits?</p>',
          choices: ['The device model name', 'The screen size in pixels', 'Whether the device is an iPad', 'The horizontal size class'],
          answer: 3,
          explain: '<p>The narrow window gets a compact horizontal size class even though the device is still an iPad, so checking "is this an iPad" would keep a sidebar that no longer fits. Size classes describe the space your view actually has.</p>',
        },
        {
          q: '<p>Which statement about SwiftUI across Apple platforms is accurate?</p>',
          choices: ['Every view must be rewritten by hand for each platform the app supports', 'One set of views adapts per platform, but layout still needs tuning', 'SwiftUI apps look and behave identically on every Apple platform, by design', 'SwiftUI runs only on iPhone and iPad; the Mac and Watch need other frameworks'],
          answer: 1,
          explain: '<p>SwiftUI gives each control its native look per platform, so much of the code is shared and nothing has to be rewritten by hand. It does not make a design right for a watch face and a TV at the same time; that part is still your job.</p>',
        },
        {
          q: '<p>A <code>ViewThatFits</code> holds an <code>HStack</code> first and a <code>VStack</code> second, and neither fits the available width. What does SwiftUI show?</p>',
          choices: ['Nothing; the view renders empty', 'The HStack, clipped at the trailing edge', 'The VStack, because the last child is the fallback', 'A runtime error, because no candidate fits the width'],
          answer: 2,
          explain: '<p>When no candidate fits, ViewThatFits uses its last child. That is why the most flexible layout goes last. It never shows an empty view or crashes because of size.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 2: Xcode, Simulator, the build, and the rest of the toolbox
// ---------------------------------------------------------------------------
const tools = {
  id: 'ecosystem-tools',
  title: 'Xcode and the Developer Toolbox',
  steps: [
    {
      kind: 'concept',
      title: 'Xcode: one workshop for every Apple app',
      body: '<p><strong>Xcode</strong> is Apple\'s integrated development environment (IDE): one app that holds the code editor, the Swift compiler, a live preview canvas, a debugger, the Simulator, and the tools that package an app for the App Store. It is free, and it runs only on a Mac.</p><p>Each Xcode release bundles <strong>SDKs</strong> (software development kits): the frameworks for one platform version. Xcode 26 ships the iOS 26 SDK, which is what lets your code call iOS 26 APIs.</p>',
      points: [
        { term: 'Project', text: 'The .xcodeproj file that lists your source files, targets and build settings.' },
        { term: 'Target', text: 'One product to build: the app itself, its tests, or an extension such as a widget.' },
        { term: 'Scheme', text: 'Which target to build, and how to run, test, profile or archive it.' },
        { term: 'Run destination', text: 'Where the build runs: a simulated device or a real one plugged in or on the same network.' },
      ],
    },
    {
      kind: 'widget',
      title: 'Tour the Xcode window',
      intro: '<p>This is a working model of an Xcode 26 window. Click any region, or press <strong>Next</strong> to tour the regions in order. Then try the real interactions: pick a different file in the navigator, change the font in the inspector and watch both the code and the canvas update, and press <strong>Run</strong> to see the console come alive.</p>',
      widget: 'ecosystem-xcode-tour',
      props: {},
    },
    {
      kind: 'concept',
      title: 'Simulator or a real device?',
      body: '<p>The <strong>Simulator</strong> is a Mac app that runs your iOS app as a Mac process, compiled for a simulated iPhone or iPad. It starts quickly, offers every screen size, and can fake a location, switch to dark appearance or change the text size in a click.</p><p>A <strong>real device</strong> runs your app on actual hardware, with the real camera, sensors, memory limits, battery and network. Everything you ship should be tried on one.</p>',
      points: [
        { term: 'Simulator limits', text: 'No camera, and speed and memory come from your Mac, not from a phone.' },
        { term: 'Free provisioning', text: 'A free Apple Account can run apps on your own iPhone; the signing profile expires after 7 days.' },
        { term: 'Developer Mode', text: 'An iPhone needs Developer Mode turned on, in Settings > Privacy & Security, before Xcode can run apps on it.' },
      ],
      callout: {
        tone: 'warn',
        title: 'Fast in the Simulator is not fast on a phone',
        html: '<p>The Simulator borrows your Mac\'s processor and memory, which are far larger than a phone\'s. Measure performance on a real device with Instruments.</p>',
      },
    },
    {
      kind: 'widget',
      title: 'What happens when you press Run',
      intro: '<p>Press <strong>Run</strong> and follow your code from Swift source files to a running app. Switch between Simulator and a real device, or between Debug and Release, and notice which stages change. Then choose a problem from the menu and run again: the build stops at the exact stage that catches it, with the message Xcode would show.</p>',
      widget: 'ecosystem-build-pipeline',
      props: {},
    },
    {
      kind: 'concept',
      title: 'The rest of the toolbox',
      body: '<p>Xcode sits at the center, but a few more tools show up in almost every iOS developer\'s week.</p>',
      points: [
        { term: 'Swift Playgrounds', text: 'An app for iPad and Mac for learning Swift and sketching ideas; it can even build and publish small SwiftUI apps.' },
        { term: 'Swift Package Manager', text: 'Swift\'s built-in tool for adding and sharing libraries, called packages, each described by a Package.swift file.' },
        { term: 'Instruments', text: 'Xcode\'s profiler. It records CPU time, memory, energy, network traffic and, in Xcode 26, SwiftUI view updates.' },
        { term: 'Developer documentation', text: 'Every API with articles and sample code, in Xcode under Help > Developer Documentation and on developer.apple.com.' },
        { term: 'Apple Developer Program', text: 'The paid membership needed for TestFlight betas and App Store distribution.' },
      ],
      callout: {
        tone: 'ecosystem',
        title: 'Free account or paid program?',
        html: '<p>A free Apple Account is enough to learn, use the Simulator and run apps on your own devices. The Apple Developer Program costs 99 USD per year and is required to distribute through TestFlight and the App Store.</p>',
      },
    },
    {
      kind: 'code',
      title: 'A Swift package manifest',
      intro: '<p>Every Swift package describes itself in a <code>Package.swift</code> manifest, and the manifest is itself Swift code. This one declares a small library, TipMath, that depends on Apple\'s open-source swift-algorithms package. Xcode uses the same system when you choose File &gt; Add Package Dependencies.</p>',
      run: 'static',
      verify: 'skip',
      verifyReason: 'A Package.swift manifest compiles only inside Swift Package Manager against the PackageDescription module, which is not in the iOS SDK. It was checked separately with swift package dump-package.',
      lines: [
        ['// swift-tools-version: 6.2', n(
          'Swift Package Manager reads this comment before anything else.',
          'Declares the minimum version of the package tools, and of the PackageDescription API, this manifest needs.',
          'The very first line of Package.swift; it must stay first.',
          'When Xcode or the swift command loads the package, before compiling the manifest.',
          'Pinning the tools version lets the manifest use newer APIs, like .v26 platforms, and tells older tools to refuse it clearly.')],
        ['import PackageDescription', n(
          'The Swift compiler, compiling the manifest.',
          'Loads the types used to describe a package: Package, Product, Target and dependency requirements.',
          'Second line of the manifest, at file scope.',
          'When Swift Package Manager compiles and runs the manifest to read its settings.',
          'A manifest is a real Swift program, so it imports its vocabulary like any other file.')],
        ['', null],
        ['let package = Package(', n(
          'Swift Package Manager looks for this constant by name.',
          'Creates the Package value that describes everything below.',
          'A top-level constant; the name must be exactly package.',
          'Evaluated each time the package is resolved or built.',
          'A plain Swift initializer gives you type checking and autocompletion for the whole configuration.')],
        ['    name: "TipMath",', n(
          'Swift Package Manager and Xcode, for display.',
          'Names the package.',
          'The first argument of Package(...).',
          'Read when the package is loaded.',
          'The name appears in Xcode\'s Package Dependencies list and in error messages.')],
        ['    platforms: [.iOS(.v26), .macOS(.v26)],', n(
          'The compiler, when building the package for each platform.',
          'Sets the oldest iOS and macOS versions the package supports: version 26 of each.',
          'An argument of Package(...), applied to every target in the package.',
          'Checked when an app adds the package and on every build.',
          'Raising the minimum lets the code use iOS 26 APIs without availability checks; apps targeting older systems are told up front.')],
        ['    products: [.library(name: "TipMath", targets: ["TipMath"])],', n(
          'Swift Package Manager, and any app that adds this package.',
          'Publishes a library product, built from the TipMath target, that other code can import.',
          'An argument of Package(...); products are the public face of a package.',
          'Read when an app picks which products to link from the package.',
          'Targets are internal building blocks; only products are visible to the apps that depend on the package.')],
        ['    dependencies: [', n(
          'Swift Package Manager\'s dependency resolver.',
          'Starts the list of other packages this package needs.',
          'An argument of Package(...).',
          'Read when packages are resolved, before anything compiles.',
          'Declaring dependencies lets the tool download, version and cache them for you.')],
        ['        .package(', n(
          'Swift Package Manager\'s dependency resolver, reading this entry.',
          'Begins one dependency on a remote package.',
          'The first entry in the dependencies array.',
          'When packages are resolved: on the first build, and again whenever you update packages.',
          'Each entry pairs a location with a version rule.')],
        ['            url: "https://github.com/apple/swift-algorithms",', n(
          'Swift Package Manager, which clones the repository with Git.',
          'Says where the dependency\'s source code lives.',
          'The first argument of .package(...).',
          'The first time packages are resolved, and when you ask Xcode to update them.',
          'Packages are distributed as Git repositories, so any public or private repository URL works.')],
        ['            from: "1.2.0"', n(
          'Swift Package Manager\'s version resolver.',
          'Accepts version 1.2.0 or any newer version below 2.0.0.',
          'The second argument of .package(...).',
          'At resolution time; the exact version chosen is recorded in Package.resolved.',
          'Semantic versioning promises no breaking changes within a major version, so updates inside 1.x are safe to take.')],
        ['        )', null],
        ['    ],', null],
        ['    targets: [', n(
          'Swift Package Manager, which builds each target as a module.',
          'Starts the list of modules in this package.',
          'An argument of Package(...).',
          'Read when the package is built.',
          'Each target maps to a folder of source files, by default Sources/TargetName.')],
        ['        .target(name: "TipMath", dependencies: [', n(
          'The Swift compiler, which builds this target as a module named TipMath.',
          'Declares the library code target and starts its list of dependencies.',
          'The first entry in targets; its files live in Sources/TipMath.',
          'Compiled whenever an app or test that uses TipMath builds.',
          'Listing dependencies per target keeps each module\'s imports explicit and its build order correct.')],
        ['            .product(name: "Algorithms", package: "swift-algorithms")', n(
          'Swift Package Manager links the product; the compiler makes it importable.',
          'Lets TipMath\'s code write import Algorithms.',
          'Inside the TipMath target\'s dependency list.',
          'At build time, before TipMath compiles.',
          'A package can offer several products, so you name the exact one you use.')],
        ['        ]),', null],
        ['        .testTarget(name: "TipMathTests", dependencies: ["TipMath"])', n(
          'Swift Package Manager and the Swift Testing runner.',
          'Declares a test target whose files can import TipMath and test it.',
          'The second entry in targets; its files live in Tests/TipMathTests.',
          'Built and run only when you run tests, for example with Command-U in Xcode.',
          'Keeping tests in their own target means test code never ships inside an app.')],
        ['    ]', null],
        [')', null],
      ],
      try: [
        'Which line would you change to accept only 1.2.x versions of the dependency, and what rule might you use instead of from:?',
        'If an app targets iOS 18, can it add this package? Which line decides?',
      ],
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>You want to see how your layout looks on an iPad mini, but you only own an iPhone. What is the quickest way?</p>',
          choices: ['Borrow or buy an iPad mini and run the app on it', 'Choose an iPad mini in the Simulator', 'Rotate your iPhone to landscape to get a wider layout', 'Upload a TestFlight build and ask an iPad owner to try it'],
          answer: 1,
          explain: '<p>The Simulator includes every current device size, so you can switch the run destination to an iPad mini in seconds, without a device or a TestFlight upload. Rotating an iPhone gives you a different shape, but still an iPhone\'s size classes and dimensions.</p>',
        },
        {
          q: '<p>Your app runs in the Simulator, but when you choose your new iPhone as the destination, Xcode refuses to run it and mentions Developer Mode. What fixes it?</p>',
          choices: ['Join the paid Apple Developer Program', 'Switch the build configuration to Release', 'Turn on Developer Mode in Settings on the iPhone', 'Reinstall Xcode and its iOS platform support'],
          answer: 2,
          explain: '<p>iPhones block apps installed from Xcode until Developer Mode is on, under Settings > Privacy & Security. A paid membership is not needed to run on your own device; a free Apple Account can sign apps for personal testing.</p>',
        },
        {
          q: '<p>Xcode reports <code>cannot find \'greeting\' in scope</code>. At which stage of the build did this happen?</p>',
          choices: ['Code signing, when the identity was checked', 'The linker, when it joined the object files', 'Installing the app on the device', 'The Swift compiler, while type-checking'],
          answer: 3,
          explain: '<p>Name lookup and type checking happen in the Swift compiler, the first stage after your source files. The build stops there, so the linker and code signing never run. Linker errors mention missing symbols, not names in scope.</p>',
        },
        {
          q: '<p>You want to use an open-source charting library in your app and keep it updated. Which tool manages it?</p>',
          choices: ['Add it with Swift Package Manager', 'Copy its source files into your project', 'Open it in Swift Playgrounds', 'Profile it with Instruments'],
          answer: 0,
          explain: '<p>Swift Package Manager downloads the library, resolves a compatible version, links it into your build and can update it later. Copied files go stale the moment the library changes. Instruments measures performance; it does not manage code.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 3: anatomy of a new SwiftUI app project
// ---------------------------------------------------------------------------
const anatomy = {
  id: 'ecosystem-anatomy',
  title: 'Anatomy of a SwiftUI App',
  steps: [
    {
      kind: 'concept',
      title: 'What the App template gives you',
      body: '<p>In Xcode, <strong>File &gt; New &gt; Project</strong>, then <strong>iOS &gt; App</strong> with the SwiftUI interface, creates a project that already builds and runs. Every item in it has a job. Click the items in the project navigator to see what each one is, who reads it and when.</p>',
      callout: {
        tone: 'tip',
        title: 'Where the bundle identifier comes from',
        html: '<p>The new-project dialog joins your organization identifier and product name: <code>com.example</code> plus <code>HelloWorld</code> becomes <code>com.example.HelloWorld</code>.</p>',
      },
      figure: { widget: 'ecosystem-project-navigator', props: {} },
    },
    {
      kind: 'concept',
      title: 'Identity, metadata and permissions',
      body: '<p>Three pieces of configuration travel with every app. iOS reads them before any of your Swift code runs.</p>',
      points: [
        { term: 'Bundle identifier', text: 'The app\'s unique ID in reverse-domain form, such as com.example.HelloWorld. It cannot change after you upload a build to App Store Connect.' },
        { term: 'Info.plist', text: 'A property list (a key-value file) of metadata: display name, version, supported orientations, and the purpose strings shown in permission prompts. Xcode generates it from your target\'s Info tab.' },
        { term: 'Capabilities', text: 'Protected services your app opts into under Signing & Capabilities, such as iCloud, Push Notifications or App Groups.' },
        { term: 'Entitlements', text: 'The signed list of those capabilities, kept in a .entitlements file and sealed into the code signature so iOS can check what the app may do.' },
      ],
      callout: {
        tone: 'warn',
        title: 'A missing purpose string ends the app',
        html: '<p>If your app asks for the camera without an <code>NSCameraUsageDescription</code> entry in Info.plist, iOS terminates the app instead of showing the permission prompt.</p>',
      },
    },
    {
      kind: 'code',
      title: 'The app\'s entry point',
      intro: '<p>This is the whole entry point of a new SwiftUI app. There is no <code>main()</code> function to write: the <code>@main</code> attribute tells Swift where the program starts, and the <code>App</code> protocol tells SwiftUI which scenes to create.</p>',
      run: 'static',
      context: 'import SwiftUI\nstruct ContentView: View { var body: some View { Text("Hello, world!") } }',
      lines: [
        ['import SwiftUI', n(
          'The Swift compiler, while it builds HelloWorldApp.swift.',
          'Brings in SwiftUI, which defines the App and Scene protocols and WindowGroup.',
          'The top of HelloWorldApp.swift.',
          'At compile time, before the @main entry point is generated.',
          'The app\'s structure is described with SwiftUI types, so this file needs the framework too, not just the view files.')],
        ['', null],
        ['@main', n(
          'The Swift compiler at build time, then iOS at launch.',
          'Marks the type below as the program\'s entry point; the compiler generates the real main function, which hands control to SwiftUI.',
          'An attribute on the struct declared on the next line. Exactly one type in an app may carry it.',
          'Code is generated at build time; that generated main runs once, first, when the user launches the app.',
          'It removes start-up boilerplate and makes a second, conflicting entry point a compile error.')],
        ['struct HelloWorldApp: App {', n(
          'Your code declares it; SwiftUI creates one instance.',
          'Declares the app type and conforms it to the App protocol, which requires a body of scenes.',
          'A top-level struct, by convention in a file named after the product.',
          'SwiftUI creates the single instance at launch, before any window appears.',
          'Describing the app as a value, like a view, keeps start-up declarative: you state what exists, SwiftUI does the work.')],
        ['    var body: some Scene {', n(
          'SwiftUI reads it at launch; you never call it yourself.',
          'Lists the scenes the app offers to the system.',
          'The one requirement of the App protocol.',
          'At launch, and again if state the app body reads changes.',
          'Scenes, not views, are what the system shows, hides and duplicates, so the app declares scenes and each scene holds views.')],
        ['        WindowGroup {', n(
          'SwiftUI together with the system\'s scene manager.',
          'Declares a scene that presents windows whose content is ContentView.',
          'The only scene inside body.',
          'At launch the system asks for one window; on iPad, Mac and Vision Pro it creates more whenever the user opens a new window.',
          'One declaration covers a single full-screen iPhone window and multiple side-by-side windows on larger devices.')],
        ['            ContentView()', n(
          'SwiftUI creates it inside each window.',
          'Makes ContentView the root view of every window in the group.',
          'The content closure of WindowGroup.',
          'Each time a window is created for this group.',
          'Keeping the UI in its own view file leaves the entry point tiny and lets you preview ContentView on its own.')],
        ['        }', null],
        ['    }', null],
        ['}', null],
      ],
      try: [
        'Suppose you add @main to a second struct as well. Predict whether the app still builds, and why.',
      ],
    },
    {
      kind: 'code',
      title: 'The template\'s first view',
      intro: '<p>This is the <code>ContentView.swift</code> file exactly as the App template creates it. It runs live in the phone beside the code: edit the text or the symbol name and the preview updates as you type.</p>',
      run: 'swiftui',
      lines: [
        ['import SwiftUI', n(
          'The Swift compiler, while it builds ContentView.swift.',
          'Makes View, VStack, Image and Text available in this file.',
          'The first line of ContentView.swift.',
          'At compile time, before ContentView is type-checked.',
          'Each file imports exactly the frameworks it uses.')],
        ['', null],
        ['struct ContentView: View {', n(
          'Your code declares it; SwiftUI creates and redraws it.',
          'Declares the first screen of the app as a struct conforming to View.',
          'A top-level type, used by the WindowGroup in the app\'s entry point.',
          'Created when the window opens and re-created whenever its parent rebuilds.',
          'A view is a lightweight description of UI, not the pixels themselves, so creating one is cheap.')],
        ['    var body: some View {', n(
          'SwiftUI calls it whenever it needs to know what ContentView shows.',
          'Returns what this screen shows.',
          'The required property of the View protocol.',
          'When the view appears and whenever its data changes.',
          'All of a view\'s appearance lives in one computed property, so reading it tells you the whole screen.')],
        ['        VStack {', n(
          'SwiftUI\'s vertical stack layout.',
          'Arranges its children top to bottom, centered, with default spacing.',
          'The root view inside body.',
          'Laid out each time body runs.',
          'Stacks are the basic building block of SwiftUI layout; most screens are stacks inside stacks.')],
        ['            Image(systemName: "globe")', n(
          'SwiftUI, using the SF Symbols library built into iOS.',
          'Shows the globe symbol.',
          'First child of the VStack.',
          'Created each time ContentView\'s body runs, before the Text below it.',
          'A system symbol needs no image file and matches the weight of nearby text.')],
        ['                .imageScale(.large)', n(
          'A SwiftUI modifier for symbol images.',
          'Draws the symbol at its large scale, relative to the current font.',
          'Applies to the globe image.',
          'Each time body runs, right after the globe Image is created.',
          'Symbol scales keep icons proportional to text, so they grow with Dynamic Type.')],
        ['                .foregroundStyle(.tint)', n(
          'A SwiftUI modifier, reading the app\'s accent color.',
          'Colors the globe with the tint, which comes from AccentColor in the asset catalog.',
          'Applies to the globe image.',
          'Applied each time body runs; the tint is resolved at draw time.',
          'Using the tint instead of a fixed color means one change in Assets restyles the whole app.')],
        ['            Text("Hello, world!")', n(
          'SwiftUI\'s Text view, drawing the template\'s greeting.',
          'Shows the greeting under the globe.',
          'Second child of the VStack.',
          'Created each time body runs, as the second child of the VStack.',
          'A string literal passed to Text is looked up for translation automatically when the app is localized.')],
        ['        }', null],
        ['        .padding()', n(
          'A SwiftUI modifier applied to the whole VStack.',
          'Adds standard space around the stack.',
          'Wraps the VStack that holds the globe and the greeting, so it is the outermost view in body.',
          'Each time body runs, after the VStack and both children are built.',
          'Default padding keeps content away from the screen edges without hard-coded numbers.')],
        ['    }', null],
        ['}', null],
        ['', null],
        ['#Preview {', n(
          'Xcode\'s canvas, and the phone preview on this page.',
          'Declares a preview of ContentView. #Preview is a macro: code that generates more code at compile time.',
          'At file scope, after the view.',
          'Each time the canvas refreshes after an edit.',
          'You see the view as you type, without building and launching the whole app.')],
        ['    ContentView()', n(
          'The #Preview block, creating one ContentView to display.',
          'Creates the view to display.',
          'Inside the #Preview closure.',
          'Each time the preview renders.',
          'A preview can create a view with sample data, which is how you check edge cases quickly.')],
        ['}', null],
      ],
      try: [
        'Change "globe" to "iphone". What appears?',
        'Change .foregroundStyle(.tint) to .foregroundStyle(.green). Which parts of the screen change color?',
      ],
    },
    {
      kind: 'concept',
      title: 'App, scenes and views',
      body: '<p>A SwiftUI app is a tree with three layers. The <strong>App</strong> is the whole program, and there is exactly one. It declares one or more <strong>scenes</strong>: units of interface that the system can show, hide and duplicate on its own. Each scene holds a hierarchy of <strong>views</strong>.</p><p>On iPhone a WindowGroup shows one window filling the screen. On iPad, Mac and Vision Pro the same WindowGroup lets people open several windows of your app at once, each with its own state.</p>',
      points: [
        { term: 'WindowGroup', text: 'The standard scene: one or more windows showing the same kind of view.' },
        { term: 'DocumentGroup', text: 'Windows tied to files the user creates, opens and saves.' },
        { term: 'Settings, MenuBarExtra', text: 'Mac scenes for a settings window and a menu bar item.' },
        { term: 'ImmersiveSpace', text: 'A visionOS scene that surrounds the user with 3D content.' },
      ],
    },
    {
      kind: 'code',
      title: 'A first screen of your own',
      intro: '<p>Here is a slightly richer first screen: a large symbol, a title and a Liquid Glass button. Tapping the button flips a piece of <code>@State</code>, a value SwiftUI stores for the view, and the screen redraws to match. Module 04 (SwiftUI) explains <code>@State</code> in full; for now read it as a value that survives redraws. Tap it in the phone, then edit the code.</p>',
      run: 'swiftui',
      lines: [
        ['import SwiftUI', n(
          'The Swift compiler, while it builds FirstScreen\'s file.',
          'Brings in SwiftUI, including the @State property wrapper and the glass button styles.',
          'The first line of the file; it covers FirstScreen and the preview below.',
          'At compile time, before FirstScreen or its @State is checked.',
          'Without it, none of the view types or modifiers below would be found.')],
        ['', null],
        ['struct FirstScreen: View {', n(
          'Your code declares it; SwiftUI draws it.',
          'Declares a view named FirstScreen.',
          'A top-level struct in this file.',
          'Created by the preview, and re-created whenever SwiftUI rebuilds its parent.',
          'A descriptive type name tells the next reader what the screen is for.')],
        ['    @State private var isGreeting = false', n(
          'SwiftUI owns the storage; this view reads and writes it.',
          'Creates a Boolean that remembers whether the greeting is showing, starting as false.',
          'Stored by SwiftUI outside the struct, so it survives when the struct is re-created.',
          'Created once when the view first appears; changing it makes SwiftUI run body again.',
          'A view struct is rebuilt often, so values that must persist between rebuilds live in @State. It is private because only this view owns it.')],
        ['', null],
        ['    var body: some View {', n(
          'SwiftUI calls it; your code only describes what it returns.',
          'Describes the screen for the current value of isGreeting.',
          'The View protocol\'s required property.',
          'On first appearance and after every change to isGreeting.',
          'The screen is a function of its state: change the state and SwiftUI works out what to redraw.')],
        ['        VStack(spacing: 20) {', n(
          'SwiftUI\'s VStack layout, holding the symbol, title and button.',
          'Stacks the symbol, title and button with 20 points between each.',
          'The root view of body.',
          'Laid out each time body runs.',
          'A single explicit spacing value gives the screen an even rhythm.')],
        ['            Image(systemName: "swift")', n(
          'SwiftUI, with SF Symbols.',
          'Shows the Swift bird.',
          'First child of the stack.',
          'Created each time FirstScreen\'s body runs, including after each tap.',
          'A vector symbol looks sharp at any size and on any scale factor.')],
        ['                .font(.system(size: 72))', n(
          'A SwiftUI modifier on the Swift symbol Image.',
          'Makes the symbol 72 points tall.',
          'Applies to the image.',
          'Each time body runs, right after the Image is created.',
          'A large, fixed size suits a decorative hero symbol that should not grow with text settings.')],
        ['                .foregroundStyle(.orange)', n(
          'A SwiftUI modifier on the already-sized Image.',
          'Colors the bird orange.',
          'Applies to the sized image.',
          'Each time body runs, after .font sizes the symbol.',
          'Orange is the color of the Swift logo, so the screen reads as a Swift welcome.')],
        ['            Text(isGreeting ? "Welcome aboard" : "Hello, world")', n(
          'SwiftUI\'s text view, fed by a ternary expression.',
          'Shows "Welcome aboard" when isGreeting is true and "Hello, world" when it is false.',
          'Second child of the stack.',
          'Re-evaluated every time body runs, so it always matches the state.',
          'Deriving the text from state means there is no separate step that could forget to update the label.')],
        ['                .font(.largeTitle)', n(
          'A SwiftUI modifier on the title Text.',
          'Uses the largest standard text style.',
          'Applies to the title text.',
          'Each time body runs, after the ternary picks which title to show.',
          'Text styles respect Dynamic Type, so the title grows for people who use larger text.')],
        ['            Button(isGreeting ? "Start over" : "Say hello") {', n(
          'SwiftUI creates the button; the user triggers it.',
          'Creates a button whose title also depends on isGreeting, and opens its action closure.',
          'Third child of the stack.',
          'Created when body runs; its closure runs later, on each tap.',
          'The title tells the user what tapping will do next, which changes with the state.')],
        ['                isGreeting.toggle()', n(
          'Your code, running on the main thread when the user taps.',
          'Flips isGreeting from false to true, or back.',
          'Inside the button\'s action closure.',
          'Only when the button is tapped, never while body is being built.',
          'Changing state is the only thing the button does; SwiftUI notices and redraws the text and the title for you.')],
        ['            }', null],
        ['            .buttonStyle(.glassProminent)', n(
          'A SwiftUI modifier using the iOS 26 Liquid Glass design.',
          'Draws the button as prominent tinted glass.',
          'Applies to the button.',
          'Each time body runs, when the Button is rebuilt with its current title.',
          'The prominent glass style marks the screen\'s main action in the current system design language.')],
        ['        }', null],
        ['        .padding()', n(
          'A SwiftUI modifier applied to the outermost VStack.',
          'Adds standard space around the whole stack.',
          'Wraps the VStack that holds the symbol, title and button, as the last modifier in body.',
          'Each time body runs, after all three children are built.',
          'It keeps the content clear of the screen edges on every device size.')],
        ['    }', null],
        ['}', null],
        ['', null],
        ['#Preview { FirstScreen() }', n(
          'Xcode\'s canvas, and the phone preview on this page.',
          'Previews a FirstScreen on a single line.',
          'At file scope, after the view.',
          'Each time the preview refreshes.',
          'Short previews fit on one line; longer ones use braces across several lines.')],
      ],
      try: [
        'Tap the button twice in the phone. What are the two titles you see?',
        'Change .glassProminent to .glass. How does the button change?',
        'Make the stack spacing 40. Which line do you edit?',
      ],
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>You delete the <code>@main</code> line from <code>HelloWorldApp.swift</code> and build. What happens?</p>',
          choices: ['The app still launches ContentView, because Xcode finds the App struct', 'The build fails, because the app has no entry point', 'Xcode adds the attribute back for you the next time you build', 'The app launches to a black screen with no window content'],
          answer: 1,
          explain: '<p>Without @main, nothing tells Swift where the program starts, so the build fails and there is no app to launch at all, black screen or otherwise. Xcode does not guess an entry point for you.</p>',
        },
        {
          q: '<p>Your trail app needs the user\'s location. Where does the sentence "Shows trails near you" belong so iOS can display it in the permission prompt?</p>',
          choices: ['In ContentView, as a Text above the map', 'In the Signing & Capabilities tab of the target', 'In the asset catalog, next to the app icon', 'In Info.plist, as the location purpose string'],
          answer: 3,
          explain: '<p>iOS shows the purpose string from Info.plist (NSLocationWhenInUseUsageDescription) inside its own prompt. A Text in your view appears only in your interface, Capabilities lists services rather than wording, and the system will not ask for permission without the Info.plist entry.</p>',
        },
        {
          q: '<p>In the template, you change <code>.foregroundStyle(.tint)</code> to <code>.foregroundStyle(.green)</code>. What changes on screen?</p>',
          choices: ['Only the globe turns green', 'The globe and the text turn green', 'The whole background turns green', 'Nothing, because the tint overrides it'],
          answer: 0,
          explain: '<p>The modifier is attached to the Image only, so only the globe changes. To color the text as well, the modifier would have to wrap the VStack.</p>',
        },
        {
          q: '<p>You are building a sketching app where every drawing is a file the user can open from the Files app. Which scene type fits?</p>',
          choices: ['WindowGroup', 'Settings', 'DocumentGroup', 'ImmersiveSpace'],
          answer: 2,
          explain: '<p>DocumentGroup ties each window to a file and provides open, save and Files integration for you. A WindowGroup could work, but you would have to build all the file handling yourself.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 4: app and scene lifecycle, scenePhase, restoration, the sandbox
// ---------------------------------------------------------------------------
const lifecycle = {
  id: 'ecosystem-lifecycle',
  title: 'The App Lifecycle',
  steps: [
    {
      kind: 'concept',
      title: 'Five states every app moves through',
      body: '<p>On iOS the system, not your app, decides when your code runs. To protect battery life and memory, iOS moves every app through a small set of states and tells the app about the transitions it can observe.</p>',
      points: [
        { term: 'Not running', text: 'Never launched, or terminated. No code runs.' },
        { term: 'Inactive', text: 'On screen but not receiving touches: briefly during launch, or while a system alert or the app switcher covers it.' },
        { term: 'Active', text: 'On screen and receiving events. The normal state while someone uses your app.' },
        { term: 'Background', text: 'Off screen but still running code for a short time, for example to finish saving.' },
        { term: 'Suspended', text: 'Kept in memory but frozen; no code runs. iOS can remove it at any moment to free memory.' },
      ],
      callout: {
        tone: 'warn',
        title: 'Termination is silent',
        html: '<p>When iOS reclaims a suspended app\'s memory, the app gets no warning and runs no code. Anything not saved before it was suspended is gone. Save when you move to the background, not later.</p>',
      },
    },
    {
      kind: 'widget',
      title: 'Drive an app through its lifecycle',
      intro: '<p>Type a draft into the notes app, then use the system events to move the app between states. The log shows which SwiftUI callbacks fire. Turn <strong>Save when backgrounded</strong> off, go to the Home Screen, apply memory pressure and relaunch: is your draft still there? Then turn saving on and repeat the experiment.</p>',
      widget: 'ecosystem-lifecycle-sim',
      props: {},
    },
    {
      kind: 'concept',
      title: 'scenePhase: the part SwiftUI lets you see',
      body: '<p>SwiftUI reports the lifecycle through <code>scenePhase</code>, an environment value with three cases. You read it with <code>@Environment(\\.scenePhase)</code> and react to changes with the <code>.onChange(of:)</code> modifier.</p>',
      points: [
        { term: '.active', text: 'In the foreground and interactive. Start timers and resume live updates.' },
        { term: '.inactive', text: 'Visible but not interactive, or in transition. Pause anything the user should not miss.' },
        { term: '.background', text: 'Not visible. Save data and release resources now; suspension may come next.' },
      ],
      callout: {
        tone: 'tip',
        title: 'One scene, or the whole app?',
        html: '<p>Read inside a view, scenePhase describes that view\'s scene. Read in your App struct, it summarizes every scene: .active if any scene is active. Suspended and not running never appear, because no code runs in those states. Module 04 (SwiftUI) explains <code>@Environment</code> and <code>.onChange</code> in full; for now read them as a value SwiftUI hands you and a block that runs when it changes.</p>',
      },
    },
    {
      kind: 'code',
      title: 'Save when the app leaves the screen',
      intro: '<p>The safest moment to save is when the app goes to the background, the last point where it reliably gets to run code before it may be suspended. This App struct watches the app-wide phase and saves the draft at exactly that moment. Module 04 (SwiftUI) explains <code>@Environment</code>, <code>@State</code> and <code>@Observable</code> in full; for now read along. The simulator beside the code lets you test the idea.</p>',
      run: 'static',
      context: 'import SwiftUI\n@Observable final class DraftStore {\n    var text = ""\n    func save() {}\n}\nstruct DraftScreen: View {\n    let store: DraftStore\n    var body: some View { Text(store.text) }\n}',
      simulate: { widget: 'ecosystem-lifecycle-sim', props: {} },
      lines: [
        ['import SwiftUI', n(
          'The Swift compiler, while it builds NotesApp\'s file.',
          'Brings in SwiftUI, which defines App, scenes, @Environment, @State and the ScenePhase type.',
          'The top of the app\'s entry-point file.',
          'At compile time, before the @main entry point is generated.',
          'Lifecycle handling is part of SwiftUI\'s app model, so no extra framework is needed.')],
        ['', null],
        ['@main', n(
          'The compiler, then iOS at launch.',
          'Makes NotesApp the entry point of the program.',
          'On the struct below; only one type in the app has it.',
          'Code is generated at build time and runs first at launch.',
          'Putting lifecycle code on the App struct means it covers every window the app opens.')],
        ['struct NotesApp: App {', n(
          'Your code declares it; SwiftUI creates it once.',
          'Declares the notes app.',
          'A top-level struct conforming to App.',
          'Created at launch, before the first window.',
          'The App struct lives as long as the process, so it is a natural owner for app-wide data.')],
        [r`    @Environment(\.scenePhase) private var scenePhase`, n(
          'SwiftUI\'s environment, fed by iOS lifecycle events.',
          'Reads the app-wide scene phase: active, inactive or background.',
          'A property of the App struct, so it summarizes all of the app\'s scenes.',
          'Updated by SwiftUI each time the system moves the app between states.',
          'Reading the phase at the app level saves once for the whole app instead of once per window.')],
        ['    @State private var store = DraftStore()', n(
          'SwiftUI keeps the storage alive; DraftStore is your @Observable model class.',
          'Creates the single store that holds the draft text in memory.',
          'Owned by the App struct and passed down to the screen.',
          'Created once at launch and kept until the process ends.',
          'Without @State, a new, empty store could be created whenever the App struct is re-created. Module 04 (SwiftUI) explains @State and @Observable in full; for now read this line as "keep one store alive for the whole app".')],
        ['', null],
        ['    var body: some Scene {', n(
          'SwiftUI reads it at launch; you never call it yourself.',
          'Declares the app\'s scenes.',
          'The App protocol\'s required property.',
          'At launch, and when state the body reads changes.',
          'Scene-level modifiers, like the onChange below, attach here.')],
        ['        WindowGroup {', n(
          'SwiftUI and the system scene manager.',
          'Declares the window that shows the draft screen.',
          'Inside NotesApp\'s body, as its only scene.',
          'When the system creates a window, at launch or when the user opens another.',
          'Every window gets the same shared store, so drafts stay consistent across windows.')],
        ['            DraftScreen(store: store)', n(
          'SwiftUI creates the view in each window.',
          'Shows the editing screen and hands it the shared store.',
          'The content of the WindowGroup.',
          'When a window is created and whenever the scene rebuilds.',
          'Passing the model in explicitly makes the dependency visible and easy to preview with sample data.')],
        ['        }', null],
        ['        .onChange(of: scenePhase) { oldPhase, newPhase in', n(
          'SwiftUI calls the closure.',
          'Watches scenePhase and runs the closure with the previous and the new value whenever it changes.',
          'A modifier on the WindowGroup scene.',
          'On every lifecycle transition, such as active to inactive, or inactive to background.',
          'Reacting to transitions, not polling, means the code runs exactly when the state changes. Module 02 (Swift Fundamentals) explains closures with parameters in full; for now read oldPhase, newPhase in as "the two values SwiftUI hands to this block".')],
        [r`            print("Phase: \(oldPhase) -> \(newPhase)")`, n(
          'Your code; the output goes to the Xcode debug console.',
          'Logs each transition, for example from inactive to background.',
          'The first statement in the onChange closure.',
          'On every phase change while the debugger is attached.',
          'Logging transitions while you develop shows you the real order of events on a device.')],
        ['            if newPhase == .background {', n(
          'You, the app author, inside the onChange closure.',
          'Checks whether the app has just gone to the background.',
          'Inside the onChange closure.',
          'On each phase change; true only when the app leaves the screen.',
          'Background is the last reliable chance to run code before suspension, and a suspended app may be terminated silently.')],
        ['                store.save()', n(
          'Your DraftStore model object, which owns the draft text.',
          'Writes the in-memory draft to permanent storage.',
          'Runs inside the if, on the main thread.',
          'Once each time the app moves to the background.',
          'Saving here means the draft survives even if iOS later terminates the suspended app without warning.')],
        ['            }', null],
        ['        }', null],
        ['    }', null],
        ['}', null],
      ],
      try: [
        'In the simulator, turn saving off, go home, apply memory pressure and relaunch. Then turn it on and repeat. What differs?',
        'Why would saving in .inactive alone be a poor choice? Hint: think about what makes an app inactive.',
      ],
    },
    {
      kind: 'code',
      title: 'Restore where the user left off',
      intro: '<p>Data is not the only thing worth keeping. If iOS terminates your app in the background, people expect to come back to the same tab and the same half-typed text. <code>@SceneStorage</code> saves small pieces of interface state for each scene and restores them automatically. Module 04 (SwiftUI) explains property wrappers and the <code>$</code> binding syntax in full; for now read <code>$draft</code> as a two-way link to the stored text.</p>',
      run: 'static',
      lines: [
        ['import SwiftUI', n(
          'The Swift compiler, while it builds ComposeView\'s file.',
          'Brings in SwiftUI, which provides @SceneStorage, TabView and TextEditor.',
          'The top of the file that holds ComposeView.',
          'At compile time, before ComposeView is type-checked.',
          'Scene storage is a SwiftUI feature; nothing else needs importing.')],
        ['', null],
        ['struct ComposeView: View {', n(
          'Your code; SwiftUI draws it.',
          'Declares a two-tab compose screen.',
          'A top-level view type.',
          'Created when its window opens.',
          'A compact, realistic screen shows restoration of both text and navigation.')],
        ['    @SceneStorage("compose.draft") private var draft = ""', n(
          'SwiftUI saves and restores the value for this scene.',
          'Keeps the draft text under the key "compose.draft", starting empty.',
          'Stored per scene, so two windows of the app keep two separate drafts.',
          'Saved by the system as the scene goes to the background; restored when the scene is recreated after termination.',
          'The user\'s unfinished text reappears after a silent termination. Scene storage is for interface state; it can be discarded, for example when the user closes the window.')],
        ['    @SceneStorage("compose.tab") private var tab = 0', n(
          'SwiftUI\'s scene storage, the same system that keeps the draft.',
          'Remembers which tab is selected, starting at tab 0.',
          'Stored alongside the draft, for this scene only.',
          'Saved and restored with the scene, like the draft.',
          'Restoring navigation makes a terminated app feel as if it never left.')],
        ['', null],
        ['    var body: some View {', n(
          'SwiftUI calls it whenever the scene needs drawing.',
          'Describes the tab view.',
          'The View protocol\'s requirement.',
          'On appearance and whenever draft or tab changes.',
          'The view reads the stored values like ordinary properties.')],
        ['        TabView(selection: $tab) {', n(
          'SwiftUI\'s TabView container, which shows one tab at a time.',
          'Shows tabs and binds the selected tab to the stored tab value.',
          'The root view of body.',
          'Built when body runs; the binding writes back each time the user switches tabs.',
          'The $ prefix passes a binding, so switching tabs updates scene storage automatically.')],
        ['            Tab("Write", systemImage: "pencil", value: 0) {', n(
          'SwiftUI\'s Tab API, which declares the first tab.',
          'Declares the first tab, labeled Write with a pencil icon, identified by the value 0.',
          'First child of the TabView.',
          'Built when body runs.',
          'The value ties this tab to the stored selection.')],
        ['                TextEditor(text: $draft)', n(
          'SwiftUI\'s multi-line text editor; the user types into it.',
          'Edits the draft, writing every keystroke back to scene storage through the binding.',
          'The content of the Write tab.',
          'Updates on every keystroke.',
          'Binding straight to scene storage means there is no separate save step to forget.')],
        ['                    .padding()', n(
          'A SwiftUI modifier on the TextEditor.',
          'Insets the editor from the edges.',
          'Applies to the TextEditor.',
          'Each time body runs, right after the TextEditor is created.',
          'Text that touches the screen edge is harder to read and select.')],
        ['            }', null],
        ['            Tab("Preview", systemImage: "doc.text", value: 1) {', n(
          'SwiftUI\'s Tab API, which declares the second tab.',
          'Declares the second tab, identified by the value 1.',
          'Second child of the TabView.',
          'Built when body runs.',
          'Two tabs make the restored selection visible when you test termination.')],
        ['                Text(draft)', n(
          'SwiftUI\'s Text view, showing the stored draft read-only.',
          'Shows the current draft read-only.',
          'The content of the Preview tab.',
          'Re-rendered whenever draft changes.',
          'Both tabs read the same stored value, so they always agree.')],
        ['                    .padding()', n(
          'A SwiftUI modifier on the preview Text.',
          'Adds space around the preview text.',
          'Applies to the Text.',
          'Each time body runs, right after the preview Text is created.',
          'Matching the editor\'s inset makes switching tabs feel steady.')],
        ['            }', null],
        ['        }', null],
        ['    }', null],
        ['}', null],
      ],
      try: [
        'Scene storage keeps the draft, so why does the previous example still save to a store? What kind of data belongs in each?',
      ],
    },
    {
      kind: 'concept',
      title: 'Every app lives in a sandbox',
      body: '<p>Each iOS app runs in a <strong>sandbox</strong>: a private container of folders that only that app can read and write. Your app cannot open another app\'s files, and other apps cannot open yours. Shared resources such as photos, contacts and location go through system frameworks that ask the user first.</p>',
      points: [
        { term: 'Documents', text: 'Files the user creates. Backed up, and can be exposed in the Files app.' },
        { term: 'Library/Application Support', text: 'Your app\'s own data, such as a SwiftData store. Backed up.' },
        { term: 'Library/Caches', text: 'Data you can download again. Not backed up; iOS may delete it when storage runs low.' },
        { term: 'tmp', text: 'Short-lived scratch files that the system can delete when your app is not running.' },
      ],
      callout: {
        tone: 'ecosystem',
        title: 'Sharing with your own extensions',
        html: '<p>An app and its extensions, such as a widget, each get a separate sandbox. Adding the App Groups capability creates a shared container that both can read and write.</p>',
      },
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>A user types a note, swipes up to the Home Screen and forgets about the app. An hour later iOS reclaims its memory. Which of your code ran last?</p>',
          choices: ['A termination callback, just before iOS removed the app', 'The onChange closure reporting .background, as the user swiped home', 'onDisappear on the note view, when the memory was reclaimed', 'Nothing ran after the user started typing the note'],
          answer: 1,
          explain: '<p>The app was suspended shortly after it reached the background, and suspended apps run no code, so the background transition was the last chance. iOS removes suspended apps silently; no termination callback runs.</p>',
        },
        {
          q: '<p>A system alert, such as a permission prompt, appears over your app. What is the scene phase while it is on screen?</p>',
          choices: ['.active', '.background', 'Suspended', '.inactive'],
          answer: 3,
          explain: '<p>Your app is still visible behind the alert but cannot receive touches, which is exactly the inactive phase. It does not go to the background, because it never left the screen.</p>',
        },
        {
          q: '<p>Your workout app runs a stopwatch with a timer. When should it pause the timer?</p>',
          choices: ['When scenePhase leaves .active', 'Only when the app is terminated', 'Never; timers keep running while suspended', 'When the view\'s body runs'],
          answer: 0,
          explain: '<p>Leaving .active means the user can no longer see or interact with the app, so pause there and record the time. Timers do not fire while an app is suspended, and termination gives no callback at all.</p>',
        },
        {
          q: '<p>Your app shows thumbnails it downloads from a server and can download again at any time. Which sandbox folder fits them best?</p>',
          choices: ['Documents', 'Library/Caches', 'Library/Application Support', 'Another app\'s container'],
          answer: 1,
          explain: '<p>Caches holds re-creatable data. It is not backed up and iOS may clear it when space is low, which is fine for thumbnails. Documents is backed up and meant for files the user creates, so caches there waste the user\'s backup space.</p>',
        },
        {
          q: '<p>Your Home Screen widget cannot read the data file the main app writes. What is the cause?</p>',
          choices: ['Widgets cannot read files from disk, only values passed in', 'The file name is wrong, or the path differs in the widget', 'They have separate sandboxes and need an App Group', 'The widget runs only on the Lock Screen, outside the app'],
          answer: 2,
          explain: '<p>An extension is a separate program with its own sandbox. Both targets must join the same App Group and use its shared container. A correct file name does not help if the widget cannot reach the folder, and widgets read files fine once they share one.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 5: the software development life cycle for an iOS app
// ---------------------------------------------------------------------------
const sdlc = {
  id: 'ecosystem-sdlc',
  title: 'The Software Development Life Cycle',
  steps: [
    {
      kind: 'concept',
      title: 'A loop, not a line',
      body: '<p>The <strong>Software Development Life Cycle</strong> (SDLC) names the phases a software product passes through, from the first idea to its last update. For an iOS app the cycle never really ends: users send feedback, Apple ships a new iOS every year, and each update starts the cycle again.</p>',
      points: [
        { term: 'Requirements', text: 'What the app must do, written so that you can test it.' },
        { term: 'Design', text: 'Screens, flows and architecture, often prototyped as SwiftUI previews.' },
        { term: 'Implementation and testing', text: 'Writing Swift with automated tests alongside it.' },
        { term: 'Deployment', text: 'TestFlight betas, App Review, then release.' },
        { term: 'Maintenance', text: 'Crash fixes, OS updates and new features, which feed the next cycle.' },
      ],
      callout: {
        tone: 'history',
        title: 'Waterfall and agile',
        html: '<p>The classic <em>waterfall</em> model runs each phase once, in order. Most app teams work in an <em>agile</em> way instead: short iterations, often one or two weeks long, that pass through every phase and end with something people can test.</p>',
      },
    },
    {
      kind: 'widget',
      title: 'Follow one app through the cycle',
      intro: '<p>Follow PlantPal, a plant-watering reminder app, through the life cycle. Select a phase to see its artifacts, the people involved, the Apple tools they use and a common failure. Press <strong>Skip this phase</strong> to see where the damage surfaces later. Then open <strong>Waterfall vs agile</strong> to compare when real user feedback first arrives.</p>',
      widget: 'ecosystem-sdlc-pipeline',
      props: {},
    },
    {
      kind: 'concept',
      title: 'Requirements you can test',
      body: '<p>A requirement is useful only if you can tell whether the app meets it. Agile teams often write <strong>user stories</strong>, each with <strong>acceptance criteria</strong> that spell out exactly what "done" means.</p>',
      points: [
        { term: 'User story', text: '"As a plant owner, I want a reminder when a plant needs water, so that it stays healthy."' },
        { term: 'Acceptance criterion', text: '"Given a fern watered on day 10 with a 3-day interval, when day 13 arrives, then it shows as due."' },
        { term: 'Non-functional requirement', text: 'A quality rather than a feature: launches quickly, works offline, supports Dynamic Type and VoiceOver.' },
      ],
      callout: {
        tone: 'design',
        title: 'Criteria become tests',
        html: '<p>The Given / When / Then shape maps straight onto an automated test: set up the data, perform the action, check the result. The next step turns this criterion into one.</p>',
      },
    },
    {
      kind: 'code',
      title: 'An acceptance criterion as a test',
      intro: '<p>Here the fern criterion becomes a Swift Testing test. If someone later breaks the watering rule, this test fails before the change ever reaches a tester. Module 09 (Architecture, Testing and Shipping) explains <code>@Test</code> and <code>#expect</code> in full; for now read <code>@Test</code> as "this function is a test" and <code>#expect</code> as "this must be true", and notice how directly the requirement maps onto code.</p>',
      run: 'swifttest',
      expectTests: 1,
      lines: [
        ['import Testing', n(
          'The Swift compiler, linking Apple\'s Swift Testing library.',
          'Makes the @Test macro and the #expect macro available.',
          'The top of a file in the app\'s test target.',
          'At compile time; the tests run later, when you run the test target.',
          'Test code lives in a separate target, so this import never ships in the app.')],
        ['', null],
        ['struct WateringSchedule {', n(
          'Your app\'s model code (shown here so the test is self-contained).',
          'Declares the rule that decides when a plant needs water.',
          'Normally in the app target; the test target would import it.',
          'Defined at compile time.',
          'Keeping rules in a plain struct, separate from views, makes them easy to test.')],
        ['    let intervalDays: Int', n(
          'Each WateringSchedule value, which owns this stored constant.',
          'Stores how many days may pass between waterings.',
          'A constant stored property of WateringSchedule.',
          'Set when a schedule is created; never changes afterwards.',
          'A let property cannot be changed by accident later on.')],
        ['    let lastWatered: Int', n(
          'Each WateringSchedule value, alongside intervalDays.',
          'Stores the day number of the last watering.',
          'A constant stored property.',
          'Set once, when WateringSchedule(intervalDays:lastWatered:) is called.',
          'Day numbers keep the example simple; the real app would store a Date.')],
        ['', null],
        ['    func isDue(onDay day: Int) -> Bool {', n(
          'Your model; called by the app and by the test.',
          'Declares a method that answers whether the plant needs water on a given day.',
          'An instance method of WateringSchedule.',
          'Whenever someone asks, such as when the plant list refreshes.',
          'The argument label onDay makes call sites read like a sentence: isDue(onDay: 13).')],
        ['        day - lastWatered >= intervalDays', n(
          'Swift\'s integer subtraction and comparison, inside isDue.',
          'Returns true when at least intervalDays have passed since the last watering.',
          'The single expression in the method body, returned implicitly.',
          'Each time isDue is called.',
          'Using >= means the plant is due on the boundary day itself, which is what the criterion says.')],
        ['    }', null],
        ['}', null],
        ['', null],
        ['@Test("Fern watered on day 10 is due on day 13")', n(
          'Swift Testing finds and runs functions marked with @Test.',
          'Marks the function below as a test and gives it a readable name.',
          'At file scope in the test target.',
          'Discovered at build time; run each time you run the tests, for example with Command-U.',
          'The display name repeats the acceptance criterion, so a failure report reads like the requirement.')],
        ['func fernIsDueAfterInterval() {', n(
          'Swift Testing calls it.',
          'Declares the test function.',
          'A global function in the test file.',
          'When the test runner reaches it.',
          'A descriptive function name helps when tests are listed in Xcode\'s Test navigator.')],
        ['    let fern = WateringSchedule(intervalDays: 3, lastWatered: 10)', n(
          'You, the test author, inside fernIsDueAfterInterval.',
          'Creates the "Given": a fern watered on day 10 that needs water every 3 days.',
          'A local constant inside the test.',
          'At the start of each run of the test.',
          'Building the exact scenario from the criterion makes the test easy to check against the requirement.')],
        ['    #expect(fern.isDue(onDay: 13))', n(
          'The #expect macro from Swift Testing.',
          'Checks the "Then": on day 13 the fern must be due. A false result is recorded as a failure.',
          'Inside the test function.',
          'When the test runs.',
          'On failure, #expect shows the values involved, so you see exactly what went wrong.')],
        ['    #expect(!fern.isDue(onDay: 12))', n(
          'The #expect macro from Swift Testing, checking the opposite case.',
          'Checks the boundary: on day 12 the fern must not be due yet.',
          'Inside the test function, after the first expectation.',
          'When the test runs; both checks run even if the first one fails.',
          'Testing the day just before the boundary catches off-by-one mistakes, such as writing > instead of >=.')],
        ['}', null],
      ],
      try: [
        'Change >= to > in isDue. Which expectation would fail, and what would the failure say about the requirement?',
      ],
    },
    {
      kind: 'concept',
      title: 'Version numbers and build numbers',
      body: '<p>Every upload carries two numbers. The <strong>version</strong> (CFBundleShortVersionString) is what people see on the App Store, usually <em>major.minor.patch</em>, such as 2.1.0. The <strong>build</strong> (CFBundleVersion) identifies one specific upload, and it must go up each time you upload a build for the same version.</p><p>You set both on the target\'s General tab in Xcode. Use the lab to upload builds and ship versions, and try uploading a build number twice.</p>',
      figure: { widget: 'ecosystem-version-lab', props: {} },
    },
    {
      kind: 'concept',
      title: 'Beta testing and App Review',
      body: '<p>Before release, builds go through <strong>TestFlight</strong>, Apple\'s beta-testing service. Internal testers on your team, up to 100, get builds right away. External testers, up to 10,000 people invited by email or public link, get them after a brief Beta App Review. Each build stays testable for 90 days.</p><p>Every App Store release then passes <strong>App Review</strong>, which checks the app against the App Store Review Guidelines.</p>',
      points: [
        { term: 'Safety', text: 'No objectionable content; apps with user-generated content need ways to report and block.' },
        { term: 'Performance', text: 'The build must be complete: no crashes, no placeholder text, no broken links.' },
        { term: 'Business', text: 'Digital content and features are generally sold through In-App Purchase, with some regional exceptions.' },
        { term: 'Design', text: 'An app must offer real functionality, not just a repackaged website.' },
        { term: 'Legal', text: 'A privacy policy, honest privacy labels, and consent before collecting data.' },
      ],
    },
    {
      kind: 'concept',
      title: 'Privacy labels and phased release',
      body: '<p>On every App Store product page, <strong>privacy labels</strong> summarize what data an app collects and whether it is linked to the user or used for tracking. You fill them in on App Store Connect, and they must match what your code and every third-party library in it actually do.</p><p>Once an update is approved, a <strong>phased release</strong> rolls it out to people with automatic updates over seven days: 1%, 2%, 5%, 10%, 20%, 50%, then 100%. If crash reports spike, you can pause the rollout, fix the bug and ship a new build. Anyone can still update by hand from the App Store.</p>',
      points: [
        { term: 'Privacy manifest', text: 'A PrivacyInfo.xcprivacy file, in your app and in each third-party SDK, declaring the data used and the reasons for calling certain sensitive APIs.' },
        { term: 'App Tracking Transparency', text: 'Tracking people across other companies\' apps and websites requires asking their permission first.' },
      ],
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>A user story says "Watering should be easy." What is the main problem with it?</p>',
          choices: ['It is too short to count as a requirement', 'It has no acceptance criteria, so it cannot be tested', 'It does not name the SwiftUI views that will implement it', 'User stories belong only to waterfall projects, not agile ones'],
          answer: 1,
          explain: '<p>"Easy" cannot be checked. Acceptance criteria such as "a plant can be marked watered with one tap from the list" make it testable. Length is not the issue, and a story describes what the user needs, not which views implement it.</p>',
        },
        {
          q: '<p>You uploaded version 1.2.0, build 14, to TestFlight and then found a typo. What should the next upload be?</p>',
          choices: ['1.2.0, build 14, replacing the first upload', '1.2.1, build 14', '1.2.0, build 15', '2.0.0, build 1'],
          answer: 2,
          explain: '<p>The release users will see has not changed, so the version stays 1.2.0, but every upload needs a higher build number. Uploading build 14 again is rejected as a duplicate.</p>',
        },
        {
          q: '<p>Your update is in a phased release, and at the 5% stage crash reports jump. What is the best move?</p>',
          choices: ['Pause the rollout, fix the crash, submit a new build', 'Release to 100% right away so the crash data becomes clearer', 'Remove the app from sale until a fixed version is approved', 'Wait the full seven days for the phased release to finish'],
          answer: 0,
          explain: '<p>Pausing stops automatic updates from reaching more people while you fix the bug. Releasing to everyone would spread the crash to the other 95%, and pulling the app from sale punishes the people who are not affected.</p>',
        },
        {
          q: '<p>Your app includes an analytics library that collects device identifiers, but your privacy label says "Data Not Collected." What is wrong?</p>',
          choices: ['Nothing, because the library collects the data, not your code', 'Only the privacy policy needs to mention what the library collects', 'Privacy labels apply only to paid apps, so it can stay', 'The label must cover all data the app collects, including through libraries'],
          answer: 3,
          explain: '<p>You are responsible for everything your app ships, including third-party code. The label must declare that data, and the library\'s privacy manifest helps you find out what it collects.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 6: kinds of iOS apps and app extensions
// ---------------------------------------------------------------------------
const appTypes = {
  id: 'ecosystem-app-types',
  title: 'Kinds of Apps and Extensions',
  steps: [
    {
      kind: 'concept',
      title: 'Apps and app extensions',
      body: '<p>An <strong>app</strong> is what people launch from the Home Screen. An <strong>app extension</strong> is a separate, smaller program bundled inside your app that the system runs somewhere else: on the Home Screen as a widget, in another app\'s share sheet, or as a custom keyboard.</p>',
      points: [
        { term: 'Separate process', text: 'An extension runs in its own process, with its own sandbox and tight memory limits.' },
        { term: 'Launched by the system', text: 'People never open an extension directly; iOS starts it when the place that hosts it needs it.' },
        { term: 'Shared data', text: 'The app and its extensions share data through an App Group container.' },
        { term: 'Shipped together', text: 'Each extension is a target in your Xcode project and ships inside the same app bundle.' },
      ],
      callout: {
        tone: 'ecosystem',
        title: 'App Intents connect the pieces',
        html: '<p>Siri, Shortcuts, Spotlight, widgets and Control Center controls all learn what your app can do through one framework, App Intents. Describe an action once and it shows up in all of them.</p>',
      },
    },
    {
      kind: 'concept',
      title: 'Common shapes of apps',
      body: '<p>Most apps fit one of a few well-known shapes, and each shape has a matching SwiftUI structure. Recognizing the shape early tells you which frameworks to reach for.</p>',
      points: [
        { term: 'Utility', text: 'One focused task on one or two screens: a tip calculator, a unit converter, a timer.' },
        { term: 'List-detail data app', text: 'Browse a collection and drill into items: notes, recipes, contacts. NavigationStack or NavigationSplitView over SwiftData.' },
        { term: 'Document-based', text: 'Each window edits a file the user owns, with Files app integration, built on DocumentGroup.' },
        { term: 'Game', text: 'Real-time graphics and input: SpriteKit for 2D, RealityKit for 3D, Metal for custom rendering, Game Center for leaderboards.' },
        { term: 'Companion', text: 'A watchOS, iPadOS or macOS app that works alongside the iPhone app and shares its data.' },
      ],
    },
    {
      kind: 'concept',
      title: 'Experiences outside your app',
      body: '<p>Some of the most-used parts of an app appear where people already are, without opening it at all.</p>',
      points: [
        { term: 'Widgets (WidgetKit)', text: 'Glanceable views on the Home Screen, Lock Screen and in StandBy, drawn from a timeline of snapshots rather than live code.' },
        { term: 'Live Activities (ActivityKit)', text: 'The changing status of an event in progress, such as a delivery or a game score, on the Lock Screen and in the Dynamic Island.' },
        { term: 'App Clips', text: 'A small part of your app that opens instantly from an NFC tag, a QR code, an App Clip Code or a link, without a full install.' },
        { term: 'App Intents', text: 'Actions your app offers to Siri, Shortcuts, Spotlight and the Action button.' },
        { term: 'Share extensions', text: 'Your app\'s entry in the share sheet of other apps.' },
      ],
    },
    {
      kind: 'code',
      title: 'An action Siri and Shortcuts can run',
      intro: '<p>An App Intent describes one action your app can perform. The provider below publishes a phrase, so people can say "Log water in" plus your app\'s name, or run it from Shortcuts, without opening your app. A small <code>WaterLog</code> actor that stores the count lives elsewhere in the app. Module 03 (Types, Protocols and Programming Paradigms) explains <code>actor</code> and <code>await</code> in full; for now read <code>await</code> as "wait here for the answer".</p>',
      run: 'static',
      context: 'import AppIntents\nactor WaterLog {\n    static let shared = WaterLog()\n    private var glasses = 0\n    func addGlass() -> Int { glasses += 1; return glasses }\n}',
      lines: [
        ['import AppIntents', n(
          'The Swift compiler, while it builds this file in the app target.',
          'Brings in the App Intents framework: AppIntent, AppShortcut and the dialog types.',
          'The top of the file, inside the app target.',
          'At compile time. Xcode also extracts intent metadata at build time so the system knows about the action before the app ever runs.',
          'Intents are discovered from your compiled code, so there is no separate configuration file to keep in sync.')],
        ['', null],
        ['struct LogWaterIntent: AppIntent {', n(
          'Your code declares it; the system creates and runs it.',
          'Declares an action that logs one glass of water.',
          'A top-level struct in the app target.',
          'Created by the system each time someone triggers the action through Siri, Shortcuts or Spotlight.',
          'Each intent is a small value type with one job, which makes it easy to reuse across system features.')],
        ['    static let title: LocalizedStringResource = "Log a Glass of Water"', n(
          'The Shortcuts app, Spotlight and Siri display it.',
          'Gives the action a human-readable, translatable name.',
          'A static property of the intent type, shared by every instance.',
          'Read at build time for the metadata, and whenever the system shows the action.',
          'A let constant of a Sendable type is safe under Swift 6 concurrency checking; LocalizedStringResource lets the title be translated.')],
        ['', null],
        ['    func perform() async throws -> some IntentResult & ProvidesDialog {', n(
          'The system calls it when the action runs.',
          'Declares the work of the intent; it can await, can throw, and returns a result that includes something to say.',
          'The required method of AppIntent.',
          'Each time the action is triggered, possibly while your app is not on screen.',
          'async lets the action await other work, and throws lets it report failure; the result type promises a spoken or shown reply.')],
        ['        let total = await WaterLog.shared.addGlass()', n(
          'Your WaterLog actor, which serializes access to its data.',
          'Adds a glass to today\'s count and gets back the new total.',
          'Inside perform(), waiting on the actor.',
          'Each time the intent runs.',
          'An actor keeps the count safe even if Siri and the app update it at the same moment; await marks the point where this code may wait its turn.')],
        [r`        return .result(dialog: "Logged. That is \(total) today.")`, n(
          'The system, which speaks or shows the dialog.',
          'Finishes the action and tells the person the new total.',
          'The last line of perform().',
          'When the work is done.',
          'Confirming the result builds trust, especially when the person cannot see your app.')],
        ['    }', null],
        ['}', null],
        ['', null],
        ['struct WaterShortcuts: AppShortcutsProvider {', n(
          'The system reads it when the app is installed.',
          'Declares the App Shortcuts the app offers with no setup by the user.',
          'A top-level type in the app target; an app has one provider.',
          'Read when the app is installed or updated, so the phrases work immediately.',
          'Without a provider, people would have to build the shortcut themselves in the Shortcuts app.')],
        ['    static var appShortcuts: [AppShortcut] {', n(
          'The system reads this list.',
          'Lists every App Shortcut the app offers.',
          'The provider\'s required static property, built with a result builder.',
          'Read at install and update time.',
          'The result builder lets you list shortcuts one after another, like views in a stack.')],
        ['        AppShortcut(', n(
          'The App Intents framework, building the shortcut value.',
          'Creates one shortcut.',
          'The only entry in the list.',
          'Read with the list.',
          'Each shortcut pairs an intent with the phrases and look that expose it.')],
        ['            intent: LogWaterIntent(),', n(
          'The App Intents framework, pairing the shortcut with your intent.',
          'Says which action the shortcut runs.',
          'The first argument of AppShortcut.',
          'Read at install time; a fresh intent is created on each run.',
          'Connecting phrases to an intent value keeps the action\'s code in one place.')],
        [r`            phrases: ["Log water in \(.applicationName)"],`, n(
          'Siri matches what people say against these phrases.',
          'Defines the spoken phrase; the placeholder becomes the app\'s actual name.',
          'An argument of AppShortcut.',
          'Read at install time; matched every time someone speaks to Siri.',
          'Every phrase must contain the app name, so Siri knows which app should handle the request.')],
        ['            shortTitle: "Log Water",', n(
          'The Shortcuts app and Spotlight.',
          'Gives a short label for the shortcut tile.',
          'An argument of AppShortcut.',
          'Shown whenever the shortcut is displayed.',
          'Tiles have little room, so they get their own short title.')],
        ['            systemImageName: "drop"', n(
          'The Shortcuts app and Spotlight.',
          'Uses the drop SF Symbol as the shortcut\'s icon.',
          'The last argument of AppShortcut.',
          'Shown with the tile.',
          'A matching symbol makes the action recognizable at a glance.')],
        ['        )', null],
        ['    }', null],
        ['}', null],
      ],
      try: [
        'Write a second phrase that would also work, such as one starting with "Add a glass". What must it contain?',
      ],
    },
    {
      kind: 'code',
      title: 'A Home Screen widget',
      intro: '<p>A widget is a configuration plus a SwiftUI view for each moment in a timeline. The <code>WaterProvider</code> referenced here, defined in another file, supplies dated entries, and WidgetKit renders each one ahead of time. Your code is not running while the widget sits on the Home Screen.</p>',
      run: 'static',
      context: 'import WidgetKit\nimport SwiftUI\nstruct WaterEntry: TimelineEntry {\n    let date: Date\n    let glasses: Int\n}\nstruct WaterProvider: TimelineProvider {\n    func placeholder(in context: Context) -> WaterEntry { WaterEntry(date: .now, glasses: 0) }\n    func getSnapshot(in context: Context, completion: @escaping (WaterEntry) -> Void) { completion(placeholder(in: context)) }\n    func getTimeline(in context: Context, completion: @escaping (Timeline<WaterEntry>) -> Void) { completion(Timeline(entries: [placeholder(in: context)], policy: .atEnd)) }\n}',
      lines: [
        ['import WidgetKit', n(
          'The Swift compiler, while it builds the widget extension target.',
          'Brings in WidgetKit: Widget, StaticConfiguration and the widget families.',
          'The top of a file in the widget extension target, not the app target.',
          'At compile time, before WaterWidget is type-checked.',
          'Widgets are an extension, a separate program with its own target and imports.')],
        ['import SwiftUI', n(
          'The Swift compiler, building the same widget file.',
          'Brings in SwiftUI for the widget\'s views.',
          'The second import of the file.',
          'At compile time, right after WidgetKit is imported.',
          'Widget content is always drawn with SwiftUI.')],
        ['', null],
        ['struct WaterWidget: Widget {', n(
          'Your code declares it; WidgetKit reads it.',
          'Declares a widget type.',
          'A top-level struct in the widget extension.',
          'Read when someone adds the widget, and when WidgetKit renders it.',
          'Like App and View, a widget is described declaratively with a body.')],
        ['    var body: some WidgetConfiguration {', n(
          'WidgetKit reads it when it loads the extension.',
          'Returns the widget\'s configuration rather than a view.',
          'The Widget protocol\'s required property.',
          'When the system loads the extension.',
          'The configuration bundles identity, data source, view and supported sizes in one place.')],
        ['        StaticConfiguration(', n(
          'WidgetKit, which builds the widget from this configuration.',
          'Creates a widget with no options for the user to configure.',
          'The root of body.',
          'When the extension loads.',
          'A static configuration is the simplest kind; an AppIntentConfiguration would let users pick options.')],
        ['            kind: "WaterWidget",', n(
          'WidgetKit, and your app when it asks for a reload.',
          'Gives the widget a stable identifier.',
          'The first argument of StaticConfiguration.',
          'Used whenever the widget is reloaded or looked up.',
          'Your app can call WidgetCenter.shared.reloadTimelines(ofKind: "WaterWidget") after logging water to refresh it right away.')],
        ['            provider: WaterProvider()', n(
          'WidgetKit asks this provider for entries.',
          'Supplies the timeline of dated WaterEntry values.',
          'The second argument of StaticConfiguration.',
          'Called when the widget is added and whenever the timeline expires or is reloaded.',
          'Separating data (the provider) from appearance (the closure below) lets WidgetKit render entries ahead of time.')],
        ['        ) { entry in', n(
          'WidgetKit calls the closure for each entry.',
          'Opens the trailing closure that turns one timeline entry into a view.',
          'The content closure of StaticConfiguration.',
          'Once per entry, ahead of the moment it will be shown.',
          'Each entry becomes a snapshot, which is why widgets cost so little battery. Module 02 (Swift Fundamentals) explains closures in full; for now read { entry in as "a block of code that receives one entry".')],
        ['            VStack {', n(
          'SwiftUI\'s VStack layout, inside the widget\'s content closure.',
          'Stacks the icon above the count.',
          'The root view of the widget\'s content.',
          'Rendered for each entry.',
          'Simple stacks render predictably at every widget size.')],
        ['                Image(systemName: "drop.fill")', n(
          'SwiftUI, with SF Symbols.',
          'Shows a filled water drop.',
          'First child of the VStack.',
          'Rendered for each entry.',
          'An icon identifies the widget at a glance on a busy Home Screen.')],
        [r`                Text("\(entry.glasses) glasses")`, n(
          'SwiftUI\'s Text view, reading one timeline entry.',
          'Shows the count from this entry, such as "3 glasses".',
          'Second child of the VStack.',
          'Rendered once per entry, not continuously.',
          'The view reads only the entry, so a snapshot can be drawn ahead of time.')],
        ['            }', null],
        ['            .containerBackground(.blue.gradient, for: .widget)', n(
          'WidgetKit and SwiftUI together, drawing the widget\'s background.',
          'Sets the widget\'s background to a blue gradient.',
          'Applies to the content view inside the widget.',
          'Rendered with each entry.',
          'Declaring the background this way lets the system replace it where needed, such as on the Lock Screen or in StandBy.')],
        ['        }', null],
        ['        .configurationDisplayName("Water Today")', n(
          'The widget gallery, the picker people open when adding widgets.',
          'Names the widget in the gallery people browse when adding widgets.',
          'A modifier on the configuration.',
          'Shown while choosing a widget.',
          'A clear name helps people find the right widget among many apps.')],
        ['        .description("Shows how many glasses you logged.")', n(
          'The widget gallery, below the display name.',
          'Explains in one sentence what the widget shows.',
          'A modifier on the configuration.',
          'Shown while choosing a widget.',
          'People decide in seconds; one sentence of purpose is enough.')],
        ['        .supportedFamilies([.systemSmall, .accessoryCircular])', n(
          'WidgetKit, which offers only the sizes named here.',
          'Offers a small Home Screen size and a circular Lock Screen size.',
          'The last modifier on the configuration.',
          'Read when the gallery lists sizes.',
          'Listing only sizes you have designed for avoids cramped or empty layouts.')],
        ['    }', null],
        ['}', null],
      ],
      try: [
        'Which line would you change to also offer a medium Home Screen widget?',
      ],
    },
    {
      kind: 'widget',
      title: 'Match the idea to the app type',
      intro: '<p>Read each product idea and choose the kind of app or extension that fits it best. The feedback explains the match, names the framework you would use, and says why the most tempting wrong answer falls short. There are ten ideas, shuffled each time you start over.</p>',
      widget: 'ecosystem-app-type-matcher',
      props: {},
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>A widget shows "Next watering: fern, tomorrow." How does it stay up to date on the Home Screen?</p>',
          choices: ['Your SwiftUI code keeps running on the Home Screen to redraw it', 'Your provider supplies dated entries; WidgetKit shows each on time', 'The person has to open the app, which refreshes every widget', 'It reloads itself every second, like a view with a timer'],
          answer: 1,
          explain: '<p>Widgets are snapshots drawn from a timeline. Your app can ask for a reload after its data changes, but no widget code runs between entries, which is why widgets barely touch the battery.</p>',
        },
        {
          q: '<p>A ride-sharing app wants to show the car\'s approach, updating as it gets closer, on the Lock Screen and in the Dynamic Island. Which feature fits?</p>',
          choices: ['A Home Screen widget', 'An App Clip', 'A Live Activity', 'A share extension'],
          answer: 2,
          explain: '<p>Live Activities show an event in progress on the Lock Screen and in the Dynamic Island, and can be updated as it changes. A widget shows glanceable information but is not designed for a live, short-lived event.</p>',
        },
        {
          q: '<p>Why must every App Shortcut phrase include the <code>.applicationName</code> placeholder?</p>',
          choices: ['So Siri knows which app handles the request', 'So the app name is translated into the user\'s language', 'It is optional decoration that makes the phrase read well', 'So the app name is passed into perform() as a parameter'],
          answer: 0,
          explain: '<p>Many apps could offer "log water." The app name tells Siri which one you mean. The placeholder does not pass any value to your code.</p>',
        },
        {
          q: '<p>Your share extension loads the user\'s entire photo library into memory and keeps getting terminated. What is the most likely reason?</p>',
          choices: ['Share extensions are not allowed to read photos at all', 'The app is not signed with a valid identity', 'The host app crashed and took the extension with it', 'Extensions run under much tighter memory limits than apps'],
          answer: 3,
          explain: '<p>Extensions run in their own process with tight memory limits, and the system terminates one that exceeds them. Load only what was shared and do heavy work in the main app.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 7: Swift beyond the iPhone, including the WebAssembly in this page
// ---------------------------------------------------------------------------
const swiftEverywhere = {
  id: 'ecosystem-swift-everywhere',
  title: 'Swift Beyond the iPhone',
  steps: [
    {
      kind: 'concept',
      title: 'Swift is open source',
      body: '<p>Apple released Swift as open source in 2015, a year after introducing it. Today the language is developed in public at swift.org, and it runs well beyond Apple devices.</p>',
      points: [
        { term: 'Servers', text: 'Back ends on Linux, built with frameworks such as Vapor and Hummingbird, can share model code with the iOS app.' },
        { term: 'Linux and Windows', text: 'Official toolchains build command-line tools and services.' },
        { term: 'WebAssembly', text: 'Swift 6.2 compiles to WebAssembly, a portable binary format that web browsers run at close to native speed.' },
        { term: 'Embedded Swift', text: 'A compact compilation mode for microcontrollers and other very small targets.' },
      ],
      callout: {
        tone: 'history',
        title: 'From Objective-C to Swift',
        html: '<p>Apple introduced Swift in 2014 to succeed Objective-C, a language from the 1980s built on top of C. Many system frameworks still contain Objective-C, and Swift calls into it seamlessly.</p>',
      },
    },
    {
      kind: 'concept',
      title: 'This page runs compiled Swift',
      body: '<p>Not everything on this page is simulated. A small Swift file, <code>SwiftCore.swift</code>, was compiled in Embedded Swift mode into a WebAssembly module, and your browser downloaded it with the page. When a widget checks a color\'s contrast or measures the distance between two map points, it calls those Swift functions directly.</p><p>The race beside this text times the same prime-counting job in that compiled Swift and in other ways of running code on this page. Compiled code does its analysis once, ahead of time, instead of while it runs.</p>',
      figure: { widget: 'swift-wasm-race', props: {} },
    },
    {
      kind: 'code',
      title: 'A Swift function the browser calls',
      intro: '<p>These are the exact lines of <code>contrastRatio</code> from SwiftCore.swift. Widgets in the design lessons pass two colors and get back the WCAG contrast ratio, computed by Swift running as WebAssembly. Two underscored attributes, unusual in app code, export the function to JavaScript.</p>',
      run: 'static',
      context: 'func relativeLuminance(_ rgb: Int32) -> Double { Double(rgb & 0xFF) / 255.0 }',
      lines: [
        ['/// WCAG contrast ratio between two colors: 1.0 (none) to 21.0 (black on white).', n(
          'Xcode\'s Quick Help and documentation tools read it; the compiler skips it.',
          'Documents what the function returns and the range of possible values.',
          'Directly above the declaration it describes.',
          'Never executed; read when someone Option-clicks the function in Xcode or generates documentation.',
          'Three slashes make a documentation comment, so the 1-to-21 range appears wherever the function is used.')],
        ['@_expose(wasm, "contrastRatio")', n(
          'The Swift compiler, when it targets WebAssembly.',
          'Exports the function from the WebAssembly module under the name contrastRatio, so JavaScript can call it.',
          'An attribute on the declaration below.',
          'At compile time; it adds an entry to the module\'s export table.',
          'Module functions are hidden from JavaScript unless exported. The leading underscore marks an attribute that is not yet a stable, official part of the language.')],
        ['@_cdecl("contrastRatio")', n(
          'The Swift compiler, when it emits the function\'s symbol.',
          'Gives the function a plain C symbol name and C calling convention.',
          'A second attribute on the same declaration.',
          'At compile time, as the function\'s name and calling convention are fixed.',
          'Swift normally mangles names and uses its own calling convention; a C-style function with simple number types is what WebAssembly hosts expect.')],
        ['public func contrastRatio(_ foreground: Int32, _ background: Int32) -> Double {', n(
          'JavaScript on this page calls it through the WebAssembly export.',
          'Declares a function that takes two colors packed as 0xRRGGBB integers and returns the ratio as a Double.',
          'A public, top-level function in SwiftCore.swift.',
          'Each time a widget asks for a contrast ratio, such as when you drag a color slider.',
          'Int32 and Double map directly onto WebAssembly\'s 32-bit integer and 64-bit float types, so no conversion layer sits between JavaScript and Swift.')],
        ['    let l1 = relativeLuminance(foreground)', n(
          'Swift code inside the WebAssembly module.',
          'Computes how bright the foreground color appears, from 0 for black to 1 for white.',
          'A local constant inside the function.',
          'On every call from JavaScript, before l2 is computed.',
          'Contrast depends on perceived brightness, not raw RGB numbers; the WCAG formula weights green most because human eyes are most sensitive to it.')],
        ['    let l2 = relativeLuminance(background)', n(
          'Swift code inside the module.',
          'Computes the background\'s relative luminance the same way.',
          'A second local constant.',
          'On every call, right after the first.',
          'Computing both values first lets the next line order them without caring which color is lighter.')],
        ['    return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)', n(
          'Swift\'s floating-point arithmetic, running inside the WebAssembly module.',
          'Divides the lighter luminance by the darker one, each plus 0.05, giving a ratio from 1 to 21.',
          'The last line of the function; the result goes back to JavaScript as a number.',
          'On every call, after both luminance values are ready.',
          'max and min make the argument order irrelevant, and the 0.05 term, part of the WCAG definition, also prevents dividing by zero for pure black.')],
        ['}', null],
      ],
      try: [
        'Predict: does contrastRatio(0xFFFFFF, 0x000000) return the same value as contrastRatio(0x000000, 0xFFFFFF)? Which line guarantees it?',
      ],
    },
    {
      kind: 'code',
      title: 'Run the same math yourself',
      intro: '<p>This is the same contrast formula as plain Swift, with each color given as three 0-255 channels. Run it in the console. Gray #767676 on white is the darkest gray that still passes the 4.5:1 minimum for normal text.</p>',
      run: 'swift',
      lines: [
        ['import Foundation', n(
          'The Swift compiler, while it builds this program.',
          'Brings in Foundation, which provides pow and String(format:).',
          'The first line of the program.',
          'At compile time, before pow or String(format:) is looked up.',
          'pow and formatted strings come from Foundation, not from the core language.')],
        ['', null],
        ['func linear(_ channel: Int) -> Double {', n(
          'Your program defines it; luminance calls it.',
          'Declares a function that converts one 0-255 color channel to linear light.',
          'A top-level function, defined before luminance so that function can call it.',
          'Called three times per color.',
          'Screens store color with a gamma curve; brightness math needs linear values.')],
        ['    let c = Double(channel) / 255.0', n(
          'Swift\'s floating-point division, inside linear.',
          'Scales the channel from 0-255 down to 0-1.',
          'A local constant inside linear.',
          'On each call to linear, before the gamma expression below.',
          'Converting to Double first avoids integer division, which would round everything to 0 or 1.')],
        ['    return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)', n(
          'Foundation\'s pow and the ternary operator.',
          'Undoes the sRGB gamma curve: a straight line for very dark values, a 2.4 power curve for the rest.',
          'The result of linear.',
          'On each call to linear, after c is computed.',
          'These constants come straight from the sRGB standard, so the result matches the WCAG definition.')],
        ['}', null],
        ['', null],
        ['func luminance(_ r: Int, _ g: Int, _ b: Int) -> Double {', n(
          'You, the program author, defining luminance.',
          'Declares a function that turns red, green and blue channels into a single brightness value.',
          'A top-level function, between linear and contrast.',
          'Called once per color.',
          'Unlabeled parameters keep calls short, like luminance(255, 255, 255).')],
        ['    0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)', n(
          'Swift arithmetic, calling linear three times.',
          'Weights each channel by how sensitive the eye is to it and adds them up.',
          'The single expression in the function, returned implicitly.',
          'On each call to luminance, calling linear three times.',
          'Green contributes most and blue least, matching human vision.')],
        ['}', null],
        ['', null],
        ['func contrast(_ a: Double, _ b: Double) -> Double {', n(
          'You, the program author, defining contrast.',
          'Declares the contrast ratio between two luminance values.',
          'A top-level function, the last one before the constants.',
          'Called once per comparison.',
          'Taking luminance values keeps this function independent of how colors are stored.')],
        ['    (max(a, b) + 0.05) / (min(a, b) + 0.05)', n(
          'Swift\'s floating-point arithmetic, with max and min from the standard library.',
          'Divides the lighter value by the darker one, each plus 0.05.',
          'The implicit return of contrast.',
          'On each call to contrast, as its single expression.',
          'Identical to the WebAssembly version, so both always agree.')],
        ['}', null],
        ['', null],
        ['let white = luminance(255, 255, 255)', n(
          'Your program\'s top-level code.',
          'Computes the luminance of pure white, which is 1.0.',
          'A global constant, the first of three colors.',
          'When the program starts, in order from top to bottom.',
          'Naming each color makes the comparisons below read clearly.')],
        ['let gray = luminance(118, 118, 118)', n(
          'Top-level code, calling luminance with the gray channels.',
          'Computes the luminance of the gray #767676 (118 is 0x76).',
          'A global constant, the second of three colors.',
          'Next, as the program runs.',
          'This gray sits just above the accessibility threshold for normal text.')],
        ['let black = luminance(0, 0, 0)', n(
          'Top-level code, calling luminance with zeros.',
          'Computes the luminance of pure black, which is 0.',
          'A global constant, the last of the three.',
          'Right after gray, as the program runs from top to bottom.',
          'Black on white is the maximum possible contrast, a useful sanity check.')],
        ['print("Gray on white:", String(format: "%.2f", contrast(gray, white)))', n(
          'print, writing to standard output.',
          'Prints the gray-on-white ratio rounded to two decimal places.',
          'Top-level code, after the three constants.',
          'After the constants are computed.',
          'print separates its items with a space, and %.2f rounds to two decimals, so the output reads cleanly.')],
        ['print("Black on white:", String(format: "%.2f", contrast(black, white)))', n(
          'print, writing to standard output.',
          'Prints the black-on-white ratio.',
          'The last line of the program.',
          'Last, after the gray line has printed.',
          'It should print the maximum, 21.00, confirming the formula.')],
      ],
      expect: 'Gray on white: 4.54\nBlack on white: 21.00',
      try: [
        'Try a lighter gray: change 118 to 130 everywhere it appears. Does it still reach 4.5?',
        'Compare white with itself. What is the lowest ratio the formula can produce?',
      ],
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>Why does compiled Swift in WebAssembly usually beat an interpreter running the same algorithm?</p>',
          choices: ['WebAssembly hands the arithmetic to the graphics card instead of the CPU', 'The code was translated ahead of time, so nothing is interpreted as it runs', 'Interpreters cannot run loops, so they fall back to slower code', 'The browser caches the interpreter\'s answers between runs'],
          answer: 1,
          explain: '<p>An interpreter reads and dispatches each operation while the program runs. A compiler does that work once, ahead of time, producing low-level instructions the browser runs directly. Both run on the CPU; no graphics card is involved, and interpreters run loops fine, just more slowly.</p>',
        },
        {
          q: '<p>What does <code>contrastRatio(0x767676, 0xFFFFFF)</code> return compared with <code>contrastRatio(0xFFFFFF, 0x767676)</code>?</p>',
          choices: ['The second is the reciprocal of the first', 'The second is negative', 'The same value, about 4.54', 'The second always returns 1.0'],
          answer: 2,
          explain: '<p>The function puts the larger luminance on top with max and the smaller on the bottom with min, so argument order never matters. Without that, swapping the colors would give a reciprocal below 1.</p>',
        },
        {
          q: '<p>Your team wants the iOS app and its server to use the same Swift model types. What makes that possible?</p>',
          choices: ['Rewriting the models in JavaScript for the server', 'Copying the model files by hand before each release', 'Running the server code on a spare iPhone', 'Swift on Linux, with the models in a package both depend on'],
          answer: 3,
          explain: '<p>Swift runs on Linux servers, so a shared package can hold the models for both. Copying files by hand works once, then drifts out of sync.</p>',
        },
        {
          q: '<p>Why does <code>contrastRatio</code> take <code>Int32</code> parameters instead of a Swift <code>Color</code>?</p>',
          choices: ['Int32 maps onto a WebAssembly number type JavaScript can pass', 'Color cannot be marked public, so it cannot be exported to JavaScript', 'Int32 is the fastest type for every kind of arithmetic', 'Int32 uses less memory, which keeps the module tiny'],
          answer: 0,
          explain: '<p>WebAssembly functions exchange plain numbers. A packed 0xRRGGBB integer crosses the boundary with no conversion, while a Swift Color has no representation JavaScript understands, whatever its access level. Speed and size are not the reason.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson: Worked Examples (shared five-part notes for its steps)
// ---------------------------------------------------------------------------
const PP_PLAN = n('Your console model, narrating the first pipeline stage.', 'Prints the Plan stage line, naming the app and the run destination.', 'The first line of the program in frame 1; later frames keep it as the opening line of the log.', 'First, before any other stage line prints.', 'Every Run starts with a plan: Xcode reads the scheme and target before compiling anything.');
const PP_FUNC = n('Your code declares it; the console model calls it below.', 'Declares greeting, a function that returns the greeting text the app would show.', 'At the top of the program, before the stage lines that use it.', 'Compiled first; the function runs only when the last line calls it.', 'Keeping the greeting in one function means the Launch stage prints exactly what the app shows.');
const PP_RETURN = n('The greeting function, when the last line calls it.', 'Returns the fixed greeting text, Hello, world!, to the caller.', 'The only line inside greeting.', 'At the moment print(greeting()) runs, at the end of the program.', 'Returning the text, instead of printing inside the function, lets the caller decide when it appears.');
const PP_COMPILE = n('Your console model, narrating the compiler stage.', 'Prints that ContentView.swift passed the Swift compiler stage.', 'After the greeting function, as the first stage line of the log.', 'After the Plan line, in pipeline order.', 'The Swift compiler checks names and types before any machine code exists.');
const PP_GREET = n('The print function, calling greeting() for its text.', 'Prints the greeting the app itself would show on screen.', 'The last line of the program.', 'Last, after every stage line.', 'Ending with the app output proves the whole pipeline delivered the one thing the user sees.');
const PP_LLVM = n('Your console model, narrating the LLVM stage.', 'Prints that LLVM produced the ContentView.o object file.', 'The second stage line of the log, under the compile line.', 'After compiling, in pipeline order.', 'LLVM turns the checked Swift code into machine code, one object file per source file.');
const PP_LINK = n('Your console model, narrating the Link stage.', 'Prints that the linker assembled the object files into HelloWorld.app.', 'The third stage line of the log.', 'After LLVM, in pipeline order.', 'Linking joins the object files into one app bundle the system can install.');
const PP_INSTALL = n('Your console model, narrating the Install stage.', 'Prints that the app was installed on the simulated iPhone destination.', 'The fourth stage line of the log.', 'After linking, in pipeline order.', 'Install copies the signed bundle into the destination, here the iPhone 17 Pro Simulator.');
const PP_LAUNCH = n('Your console model, narrating the Launch stage.', 'Prints that the installed app launched and its first view appeared.', 'The last stage line, just before the greeting itself prints.', 'After install, at the end of the pipeline.', 'Launch is the payoff stage: the system starts the process and SwiftUI shows ContentView.');
const PP_HELLO = n('The print function, showing the app output line.', 'Prints Hello, world!, the greeting the launched app would show.', 'The last line of the program.', 'Last, after the compile lines.', 'The tryIt ends with the user-visible result, like the frames do.');
const PP_SETTINGS = n('Your console model, narrating the compiler stage.', 'Prints that the second file, SettingsView.swift, also passed the compiler stage.', 'Between the ContentView compile line and the greeting.', 'Second, once both files are planned.', 'A second file is a second compile task in the plan; both must pass before linking.');
const DG_FUNC = n('You declare it; the call sites below run it.', 'Declares greet, a function that takes one name and prints a greeting for it.', 'At the top of the program, before any call to it.', 'Compiled first; the body runs only when a call site runs it.', 'A function names the greeting once, so every call greets the same way.');
const DG_BODY = n('The greet function, each time a call runs it.', 'Prints Hello, then the name it was given, using interpolation.', 'The only line inside greet.', 'Once per call, at the moment of the call.', 'Interpolation inserts the parameter, so one body serves every name.');
const DG_TYPO = n('Your code at the call site; the compiler stops here.', 'Calls greett, but the function is named greet: one extra t makes a different, unknown name.', 'The first call site, under the function.', 'Caught at compile time, so nothing in this frame prints.', 'This is the frame to repair: name lookup fails in the Swift compiler stage, before the program can run.');
const DG_CALL = n('Your top-level code, calling the repaired function.', 'Calls greet with the name Ana, so the body prints one greeting.', 'The first call site, under the function.', 'At run time, after the function is declared.', 'With the spelling fixed, the call matches the declaration and the program runs.');
const DG_FUNC2 = n('You declare it; the call sites below run it.', 'Declares greet with two parameters: a name and a day, so the greeting can wish a happy day.', 'At the top of the program, replacing the one-parameter version.', 'Compiled first; the body runs once per call.', 'A second parameter carries the day in, instead of the function guessing or hard-coding it.');
const DG_BODY2 = n('The greet function, each time a call runs it.', 'Prints the greeting with both parameters interpolated: name first, then the day.', 'The only line inside greet.', 'Once per call, at the moment of the call.', 'Both facts come from the caller, so the same body greets anyone on any day.');
const DG_CALL2 = n('Your top-level code, calling the two-parameter version.', 'Calls greet for Ana on Friday, passing the day with its label.', 'The first call site, under the function.', 'At run time, after the function is declared.', 'The labeled second argument shows the parameter list and the call site growing together.');
const DG_FRIENDS = n('Your top-level code; the loop below reads it.', 'Stores three names in an array, in greeting order.', 'Under the function, before the loop.', 'At run time, before the loop starts.', 'An array turns three separate calls into one loop the compiler can check.');
const DG_FOR = n('The for-in loop, visiting each name in friends.', 'Starts a loop that binds each name in friends to friend, one at a time.', 'Top-level code, under the array.', 'At run time; the body runs three times, once per name.', 'Looping over the array means adding a name later adds a greeting with no new code.');
const DG_CALL_LOOP = n('The loop body, calling greet once per name.', 'Calls greet for the current friend, always on Friday.', 'Inside the loop, indented under it.', 'Three times, once for each name in friends.', 'The day stays fixed here; only the name changes per visit, which is what the loop is for.');
const DG_COUNT = n('Your top-level code, reading the array after the loop.', 'Prints how many friends were greeted, counted from the array itself.', 'The last line of the program, after the loop.', 'After the loop finishes all three greetings.', 'Counting from friends.count keeps the summary honest if the list grows.');
const DG_CALL_BEN = n('Your top-level code, calling greet a second time.', 'Calls greet with the name Ben, printing a second greeting.', 'Under the first call site.', 'At run time, right after Ana is greeted.', 'Each call reuses the same body; only the argument changes.');
const DG_CALL_CLEO = n('Your top-level code, calling greet a third time.', 'Calls greet with the name Cleo, printing a third greeting.', 'Under the second call site.', 'At run time, right after Ben is greeted.', 'A third call costs one line, because the greeting logic lives in the function.');
const LC_ENUM = n('You declare it; the program compares phase against its cases.', 'Declares ScenePhase, an enum naming the five lifecycle states from this module.', 'At the top of the program, before the variables that use it.', 'Compiled first; declaring it runs no code.', 'An enum makes the phase one of five known values, never a misspelled string.');
const LC_CASES = n('The ScenePhase type, listing its possibilities.', 'Names the five cases in day order: notRunning, inactive, active, background, suspended.', 'The only line inside the enum.', 'Compile time; the list is fixed for the whole program.', 'Grouping the cases on one line keeps this small model compact.');
const LC_PHASE = n('Your top-level code; later lines reassign it.', 'Starts phase at notRunning: the app has not launched yet.', 'The first variable of the model, under the enum.', 'First, before any transition line runs.', 'Every day in this model starts from not running, matching a fresh launch.');
const LC_EDITS = n('Your top-level code; the Active stage adds to it.', 'Starts the unsaved-edit counter at zero.', 'Under phase, as part of the model state.', 'At the start, before the app becomes active.', 'Counting edits in the model, not in a view, lets the Background stage save them.');
const LC_PENDING = n('Your top-level code; the Background stage appends to it.', 'Starts the pending list empty: edits waiting for the app to return to Active.', 'Under edits, as part of the model state.', 'At the start, before anything is deferred.', 'A list, not a flag, so several deferred edits could queue in order.');
const LC_P_NOTRUN = n('The print function, narrating the model.', 'Prints the opening phase line: the app is not running.', 'The first action line of the script.', 'First, while phase is still notRunning.', 'Each stage prints as it happens, so the console reads as the day log.');
const LC_TO_INACTIVE = n('Your top-level code, moving the model.', 'Moves phase to inactive: the app is launching, on screen but not yet interactive.', 'After the not-running line.', 'Second, at the start of the launch.', 'Launch passes through Inactive briefly before the app can receive touches.');
const LC_P_INACTIVE = n('The print function, narrating the model.', 'Prints the inactive phase line as the app finishes launching.', 'Right after the move to inactive.', 'While phase is inactive.', 'The log line matches the diagram phase beside it, frame by frame.');
const LC_TO_ACTIVE = n('Your top-level code, moving the model.', 'Moves phase to active: the app is on screen and receiving events.', 'After the inactive line, and again at the end of the day.', 'When launch completes, and again when the user returns.', 'Active is the only phase where editing makes sense, so the edits happen there.');
const LC_EDIT = n('Your top-level code, doing the user work of the model.', 'Adds one unsaved edit to the counter.', 'In the Active stage, twice in a row.', 'While phase is active, before any save.', 'Each increment is one change the user made and has not saved yet.');
const LC_P_ACTIVE = n('The print function, reading the counter.', 'Prints how many unsaved edits the Active stage produced: two.', 'After both edit lines.', 'While phase is still active.', 'Printing the count proves the edits landed in the model before the app backgrounds.');
const LC_TO_BG = n('Your top-level code, moving the model.', 'Moves phase to background: the user left the app, but it is still resident.', 'After the Active stage lines.', 'Fourth, when the user goes home.', 'Background is the last reliable chance to run code, which is why saving happens here.');
const LC_P_SAVED = n('The print function, reporting the autosave.', 'Prints that the model saved both edits as the app entered the background.', 'Right after the move to background.', 'While phase is background, before suspension.', 'Saving on entering Background means a later silent termination loses nothing.');
const LC_IF = n('Your top-level code, testing the current phase.', 'Checks that the app really is in the background before deferring the edit.', 'In the Background stage, after the save line.', 'Once, while phase is background.', 'The same edit during Active would apply at once; the phase decides the behavior.');
const LC_APPEND = n('The if body, queuing the work.', 'Appends the Fix title edit to the pending list instead of applying it.', 'Inside the if, in the Background stage.', 'While phase is background.', 'Background code should finish quickly; real editing waits for the user to return.');
const LC_P_DEFER = n('The print function, inside the if body.', 'Prints that the title fix is deferred until the app is active again.', 'Inside the if, after the append.', 'While phase is background.', 'Naming the deferral in the log makes the model behavior visible, not silent.');
const LC_TO_SUSP = n('Your top-level code, moving the model.', 'Moves phase to suspended: the app is frozen in memory and runs no code.', 'After the Background stage.', 'Fifth, some time after backgrounding.', 'Suspension is the system decision, not the app choice; the model just records it.');
const LC_P_SUSP = n('The print function, narrating the model.', 'Prints the suspended line: the last line the model can print until it thaws.', 'Right after the move to suspended.', 'While phase is suspended.', 'A suspended app prints nothing more, so the log pauses here until the return.');
const LC_FOR = n('The for-in loop, draining the pending list.', 'Visits each deferred edit in pending and prints it as applied, all on one line.', 'In the final Active stage, after phase returns to active.', 'Last stage, when the user comes back.', 'Applying the queue on return makes the deferred title fix actually happen.');
const LT_PHASE = n('Your top-level code; the last lines change it.', 'Stores the phase as a plain string starting at active.', 'The first line of the program.', 'First, before the edits are counted.', 'The tryIt keeps the model tiny: a string stands in for the enum from the frames.');
const LT_EDITS = n('Your top-level code; the lines below add to it.', 'Starts the edit counter at zero.', 'Under the phase line.', 'Before any edit is counted.', 'Starting at zero makes the printed save count come only from the edit lines.');
const LT_EDIT = n('Your top-level code, recording user work.', 'Adds one edit to the counter.', 'In the starter once; the solution adds a second copy under it.', 'While the phase is active.', 'Each line is one edit, so the final count is easy to predict.');
const LT_P_EARLY = n('The print function, reporting progress.', 'Prints the edit count so far, before any save happens.', 'The last line of the starter.', 'After the single edit line.', 'The starter stops mid-story: the task asks you to finish the save.');
const LT_TOBG = n('Your top-level code, moving the tiny model.', 'Changes the phase string to background.', 'After the edit lines, before the save print.', 'When the imagined user leaves the app.', 'The save line reads the phase, so the move must come before it.');
const LT_PRINT = n('The print function, reporting the save.', 'Prints how many edits were saved and the phase they were saved in.', 'The last line of the program.', 'Last, after the move to background.', 'One line confirms both the count and the phase at save time.');

const workedExamples = {
  id: 'ecosystem-worked-examples',
  title: 'Worked Examples',
  steps: [
    {
      kind: 'example',
      title: 'Press Run: follow one build from plan to launch',
      problem: '<p>Pressing Run in Xcode carries one tiny app, HelloWorld, through six stages. Follow a console model of that journey: each frame grows the program by one stage line, and the diagram advances beside it until the app launches and greets.</p>',
      adapter: 'diagram',
      diagram: 'pipeline',
      frames: [
        {
          caption: 'Plan stage: the whole program is one print line naming the app and its destination, the iPhone 17 Pro Simulator. The diagram marks Plan as the active stage; nothing has been compiled yet.',
          diagram: { at: 0, dest: 'iPhone 17 Pro (Simulator)', note: 'Console model only: the print line stands for the Plan stage.' },
          claims: ['Plan: build HelloWorld for iPhone 17 Pro Simulator'],
          lines: [
            ['print("Plan: build HelloWorld for iPhone 17 Pro Simulator")', PP_PLAN],
          ],
        },
        {
          caption: 'Swift compiler stage: a greeting function joins the program and a compile line prints. The function returns the text the app would show, and the last line prints it after the stage line.',
          diagram: { at: 1, dest: 'iPhone 17 Pro (Simulator)', note: 'The greeting function is the code being compiled in this model.' },
          claims: ['Compile: ContentView.swift checked', 'Hello, world!'],
          lines: [
            ['func greeting() -> String {', PP_FUNC],
            ['    return "Hello, world!"', PP_RETURN],
            ['}', null],
            ['print("Plan: build HelloWorld for iPhone 17 Pro Simulator")', PP_PLAN],
            ['print("Compile: ContentView.swift checked")', PP_COMPILE],
            ['print(greeting())', PP_GREET],
          ],
        },
        {
          caption: 'LLVM stage: one more stage line prints, reporting the object file for ContentView. The greeting still prints last, unchanged, because later stages only transform what the compiler already checked.',
          diagram: { at: 2, dest: 'iPhone 17 Pro (Simulator)', note: 'One object file per source file comes out of LLVM.' },
          claims: ['LLVM: object file ContentView.o ready', 'Hello, world!'],
          lines: [
            ['func greeting() -> String {', PP_FUNC],
            ['    return "Hello, world!"', PP_RETURN],
            ['}', null],
            ['print("Plan: build HelloWorld for iPhone 17 Pro Simulator")', PP_PLAN],
            ['print("Compile: ContentView.swift checked")', PP_COMPILE],
            ['print("LLVM: object file ContentView.o ready")', PP_LLVM],
            ['print(greeting())', PP_GREET],
          ],
        },
        {
          caption: 'Link stage: the log adds the assembled app bundle, HelloWorld.app. The diagram advances to Link; the program itself only narrates the stage, it does not really link anything.',
          diagram: { at: 3, dest: 'iPhone 17 Pro (Simulator)', note: 'Link joins the object files into HelloWorld.app.' },
          claims: ['Link: HelloWorld.app assembled', 'Hello, world!'],
          lines: [
            ['func greeting() -> String {', PP_FUNC],
            ['    return "Hello, world!"', PP_RETURN],
            ['}', null],
            ['print("Plan: build HelloWorld for iPhone 17 Pro Simulator")', PP_PLAN],
            ['print("Compile: ContentView.swift checked")', PP_COMPILE],
            ['print("LLVM: object file ContentView.o ready")', PP_LLVM],
            ['print("Link: HelloWorld.app assembled")', PP_LINK],
            ['print(greeting())', PP_GREET],
          ],
        },
        {
          caption: 'Install stage: the log reports the app installed on the iPhone 17 Pro Simulator, the destination named since the Plan frame. One stage remains before the app can launch.',
          diagram: { at: 4, dest: 'iPhone 17 Pro (Simulator)', note: 'Install copies the bundle into the simulated iPhone.' },
          claims: ['Install: HelloWorld on iPhone 17 Pro (Simulator)', 'Hello, world!'],
          lines: [
            ['func greeting() -> String {', PP_FUNC],
            ['    return "Hello, world!"', PP_RETURN],
            ['}', null],
            ['print("Plan: build HelloWorld for iPhone 17 Pro Simulator")', PP_PLAN],
            ['print("Compile: ContentView.swift checked")', PP_COMPILE],
            ['print("LLVM: object file ContentView.o ready")', PP_LLVM],
            ['print("Link: HelloWorld.app assembled")', PP_LINK],
            ['print("Install: HelloWorld on iPhone 17 Pro (Simulator)")', PP_INSTALL],
            ['print(greeting())', PP_GREET],
          ],
        },
        {
          caption: 'Launch stage: the final stage line prints, then the greeting itself, exactly what the launched app would show. The diagram sits at Launch with every earlier stage marked done.',
          diagram: { at: 5, dest: 'iPhone 17 Pro (Simulator)', note: 'Launch: the greeting below is what the app would show.' },
          claims: ['Launch: ContentView appeared', 'Hello, world!'],
          lines: [
            ['func greeting() -> String {', PP_FUNC],
            ['    return "Hello, world!"', PP_RETURN],
            ['}', null],
            ['print("Plan: build HelloWorld for iPhone 17 Pro Simulator")', PP_PLAN],
            ['print("Compile: ContentView.swift checked")', PP_COMPILE],
            ['print("LLVM: object file ContentView.o ready")', PP_LLVM],
            ['print("Link: HelloWorld.app assembled")', PP_LINK],
            ['print("Install: HelloWorld on iPhone 17 Pro (Simulator)")', PP_INSTALL],
            ['print("Launch: ContentView appeared")', PP_LAUNCH],
            ['print(greeting())', PP_GREET],
          ],
        },
      ],
      tryIt: {
        task: '<p>The app gains a second file, SettingsView.swift. The starter plans the build and compiles ContentView, then prints the greeting. Add the compile line for SettingsView.swift between the ContentView line and the greeting, so both files are checked before the app output.</p>',
        lines: [
          ['print("Plan: build HelloWorld for iPhone 17 Pro Simulator")', PP_PLAN],
          ['print("Compile: ContentView.swift checked")', PP_COMPILE],
          ['print("Hello, world!")', PP_HELLO],
        ],
        solution: [
          ['print("Plan: build HelloWorld for iPhone 17 Pro Simulator")', PP_PLAN],
          ['print("Compile: ContentView.swift checked")', PP_COMPILE],
          ['print("Compile: SettingsView.swift checked")', PP_SETTINGS],
          ['print("Hello, world!")', PP_HELLO],
        ],
        expect: 'Plan: build HelloWorld for iPhone 17 Pro Simulator\nCompile: ContentView.swift checked\nCompile: SettingsView.swift checked\nHello, world!',
      },
    },
    {
      kind: 'example',
      title: 'Diagnose and repair a compiler error',
      problem: '<p>A greeting program fails to build, and the error names a function that looks almost right. Diagnose the failure from the compiler message, repair it with the smallest change, then grow the fixed program with a parameter and a loop.</p>',
      adapter: 'trace',
      expect: 'Hello, Ana! Happy Friday.\nHello, Ben! Happy Friday.\nHello, Cleo! Happy Friday.\nGreeted 3 friends',
      frames: [
        {
          caption: 'The program starts with just the function: greet takes a name and prints a greeting for it. Nothing calls it yet, so this frame runs and prints nothing at all.',
          expect: '',
          lines: [
            ['func greet(_ name: String) {', DG_FUNC],
            ['    print("Hello, \\(name)!")', DG_BODY],
            ['}', null],
          ],
        },
        {
          caption: 'A call site appears, but it calls greett with an extra t. The compiler cannot find that name, so the build stops here: this frame is the failure to diagnose.',
          partial: true,
          reason: 'The call site misspells greet as greett, so the compiler stops the build.',
          expectError: 'cannot find \'greett\' in scope',
          lines: [
            ['func greet(_ name: String) {', DG_FUNC],
            ['    print("Hello, \\(name)!")', DG_BODY],
            ['}', null],
            ['greett("Ana")', DG_TYPO],
          ],
        },
        {
          caption: 'The repair is one letter: the call now spells greet exactly as declared. The program runs and prints the first greeting, Hello, Ana!, proving the diagnosis was right.',
          expect: 'Hello, Ana!',
          lines: [
            ['func greet(_ name: String) {', DG_FUNC],
            ['    print("Hello, \\(name)!")', DG_BODY],
            ['}', null],
            ['greet("Ana")', DG_CALL],
          ],
        },
        {
          caption: 'The working program grows: greet gains a day parameter, and the call passes Friday with its label. The greeting now uses both pieces of information the caller supplies.',
          expect: 'Hello, Ana! Happy Friday.',
          lines: [
            ['func greet(_ name: String, day: String) {', DG_FUNC2],
            ['    print("Hello, \\(name)! Happy \\(day).")', DG_BODY2],
            ['}', null],
            ['greet("Ana", day: "Friday")', DG_CALL2],
          ],
        },
        {
          caption: 'Three names move into an array and a loop calls greet for each one. The output triples without tripling the code: one call site now serves the whole list.',
          expect: 'Hello, Ana! Happy Friday.\nHello, Ben! Happy Friday.\nHello, Cleo! Happy Friday.',
          lines: [
            ['func greet(_ name: String, day: String) {', DG_FUNC2],
            ['    print("Hello, \\(name)! Happy \\(day).")', DG_BODY2],
            ['}', null],
            ['let friends = ["Ana", "Ben", "Cleo"]', DG_FRIENDS],
            ['for friend in friends {', DG_FOR],
            ['    greet(friend, day: "Friday")', DG_CALL_LOOP],
            ['}', null],
          ],
        },
        {
          caption: 'A final line counts the greetings from the array itself and prints the total. The finished program greets three friends and reports exactly how many it greeted.',
          expect: 'Hello, Ana! Happy Friday.\nHello, Ben! Happy Friday.\nHello, Cleo! Happy Friday.\nGreeted 3 friends',
          lines: [
            ['func greet(_ name: String, day: String) {', DG_FUNC2],
            ['    print("Hello, \\(name)! Happy \\(day).")', DG_BODY2],
            ['}', null],
            ['let friends = ["Ana", "Ben", "Cleo"]', DG_FRIENDS],
            ['for friend in friends {', DG_FOR],
            ['    greet(friend, day: "Friday")', DG_CALL_LOOP],
            ['}', null],
            ['print("Greeted \\(friends.count) friends")', DG_COUNT],
          ],
        },
      ],
      tryIt: {
        task: '<p>The starter greets only Ana. Add two more calls so the program also greets Ben and Cleo, in that order, reusing the same greet function for each name.</p>',
        lines: [
          ['func greet(_ name: String) {', DG_FUNC],
          ['    print("Hello, \\(name)!")', DG_BODY],
          ['}', null],
          ['greet("Ana")', DG_CALL],
        ],
        solution: [
          ['func greet(_ name: String) {', DG_FUNC],
          ['    print("Hello, \\(name)!")', DG_BODY],
          ['}', null],
          ['greet("Ana")', DG_CALL],
          ['greet("Ben")', DG_CALL_BEN],
          ['greet("Cleo")', DG_CALL_CLEO],
        ],
        expect: 'Hello, Ana!\nHello, Ben!\nHello, Cleo!',
      },
    },
    {
      kind: 'example',
      title: 'Follow an app through its day: launch, work, background, gone',
      problem: '<p>Model one day in an app life: launch, two edits, a trip to the background with an autosave, a deferred edit, suspension, and a return that applies what waited. The diagram tracks memory and disk beside the console log.</p>',
      adapter: 'diagram',
      diagram: 'lifecycle',
      frames: [
        {
          caption: 'Not running: the model declares its phase enum and counters, starts at notRunning, and prints the opening line. The diagram shows the app absent from memory and disk alike.',
          diagram: { phase: 'Not running', note: 'Console model of one day; nothing has launched.' },
          claims: ['Phase: not running'],
          lines: [
            ['enum ScenePhase {', LC_ENUM],
            ['    case notRunning, inactive, active, background, suspended', LC_CASES],
            ['}', null],
            ['var phase = ScenePhase.notRunning', LC_PHASE],
            ['var edits = 0', LC_EDITS],
            ['var pending: [String] = []', LC_PENDING],
            ['print("Phase: not running")', LC_P_NOTRUN],
          ],
        },
        {
          caption: 'Launch begins: phase moves to inactive and the log adds its line. The app is loaded and on screen, but not yet receiving touches, so no edits happen yet.',
          diagram: { phase: 'Inactive', memory: 'App loaded, draft empty', note: 'Launch passes through Inactive on its way to Active.' },
          claims: ['Phase: inactive'],
          lines: [
            ['enum ScenePhase {', LC_ENUM],
            ['    case notRunning, inactive, active, background, suspended', LC_CASES],
            ['}', null],
            ['var phase = ScenePhase.notRunning', LC_PHASE],
            ['var edits = 0', LC_EDITS],
            ['var pending: [String] = []', LC_PENDING],
            ['print("Phase: not running")', LC_P_NOTRUN],
            ['phase = .inactive', LC_TO_INACTIVE],
            ['print("Phase: inactive")', LC_P_INACTIVE],
          ],
        },
        {
          caption: 'Active: two edits accumulate in the counter and the log prints the count. The diagram shows the draft living only in memory; nothing has reached the disk yet.',
          diagram: { phase: 'Active', memory: 'Draft: 2 unsaved edits', disk: 'Nothing saved yet', note: 'Edits live in memory only until the app backgrounds.' },
          claims: ['Active: 2 unsaved edits'],
          lines: [
            ['enum ScenePhase {', LC_ENUM],
            ['    case notRunning, inactive, active, background, suspended', LC_CASES],
            ['}', null],
            ['var phase = ScenePhase.notRunning', LC_PHASE],
            ['var edits = 0', LC_EDITS],
            ['var pending: [String] = []', LC_PENDING],
            ['print("Phase: not running")', LC_P_NOTRUN],
            ['phase = .inactive', LC_TO_INACTIVE],
            ['print("Phase: inactive")', LC_P_INACTIVE],
            ['phase = .active', LC_TO_ACTIVE],
            ['edits += 1', LC_EDIT],
            ['edits += 1', LC_EDIT],
            ['print("Active: \\(edits) unsaved edits")', LC_P_ACTIVE],
          ],
        },
        {
          caption: 'Background: the user leaves, and the model autosaves at exactly this moment, printing that both edits are saved. The diagram now shows the saved state on disk.',
          diagram: { phase: 'Background', memory: 'App resident: 2 edits', disk: 'Saved: 2 edits', note: 'Autosave on entering Background protects the draft.' },
          claims: ['Saved 2 edits'],
          lines: [
            ['enum ScenePhase {', LC_ENUM],
            ['    case notRunning, inactive, active, background, suspended', LC_CASES],
            ['}', null],
            ['var phase = ScenePhase.notRunning', LC_PHASE],
            ['var edits = 0', LC_EDITS],
            ['var pending: [String] = []', LC_PENDING],
            ['print("Phase: not running")', LC_P_NOTRUN],
            ['phase = .inactive', LC_TO_INACTIVE],
            ['print("Phase: inactive")', LC_P_INACTIVE],
            ['phase = .active', LC_TO_ACTIVE],
            ['edits += 1', LC_EDIT],
            ['edits += 1', LC_EDIT],
            ['print("Active: \\(edits) unsaved edits")', LC_P_ACTIVE],
            ['phase = .background', LC_TO_BG],
            ['print("Saved \\(edits) edits")', LC_P_SAVED],
          ],
        },
        {
          caption: 'Still in Background, an edit arrives: the phase check defers it into the pending list and the log says it will apply on return, instead of editing now.',
          diagram: { phase: 'Background', memory: 'App resident: 2 edits, 1 deferred', disk: 'Saved: 2 edits', note: 'The new edit waits in the pending list.' },
          claims: ['Deferred: Fix title until active'],
          lines: [
            ['enum ScenePhase {', LC_ENUM],
            ['    case notRunning, inactive, active, background, suspended', LC_CASES],
            ['}', null],
            ['var phase = ScenePhase.notRunning', LC_PHASE],
            ['var edits = 0', LC_EDITS],
            ['var pending: [String] = []', LC_PENDING],
            ['print("Phase: not running")', LC_P_NOTRUN],
            ['phase = .inactive', LC_TO_INACTIVE],
            ['print("Phase: inactive")', LC_P_INACTIVE],
            ['phase = .active', LC_TO_ACTIVE],
            ['edits += 1', LC_EDIT],
            ['edits += 1', LC_EDIT],
            ['print("Active: \\(edits) unsaved edits")', LC_P_ACTIVE],
            ['phase = .background', LC_TO_BG],
            ['print("Saved \\(edits) edits")', LC_P_SAVED],
            ['if phase == .background {', LC_IF],
            ['    pending.append("Fix title")', LC_APPEND],
            ['    print("Deferred: Fix title until active")', LC_P_DEFER],
            ['}', null],
          ],
        },
        {
          caption: 'Suspended: the system freezes the app in memory. The log prints its suspended line, and after this frame no model code runs until the user returns.',
          diagram: { phase: 'Suspended', memory: 'Frozen: 2 edits', disk: 'Saved: 2 edits', note: 'A suspended app runs no code and may be removed silently.' },
          claims: ['Phase: suspended'],
          lines: [
            ['enum ScenePhase {', LC_ENUM],
            ['    case notRunning, inactive, active, background, suspended', LC_CASES],
            ['}', null],
            ['var phase = ScenePhase.notRunning', LC_PHASE],
            ['var edits = 0', LC_EDITS],
            ['var pending: [String] = []', LC_PENDING],
            ['print("Phase: not running")', LC_P_NOTRUN],
            ['phase = .inactive', LC_TO_INACTIVE],
            ['print("Phase: inactive")', LC_P_INACTIVE],
            ['phase = .active', LC_TO_ACTIVE],
            ['edits += 1', LC_EDIT],
            ['edits += 1', LC_EDIT],
            ['print("Active: \\(edits) unsaved edits")', LC_P_ACTIVE],
            ['phase = .background', LC_TO_BG],
            ['print("Saved \\(edits) edits")', LC_P_SAVED],
            ['if phase == .background {', LC_IF],
            ['    pending.append("Fix title")', LC_APPEND],
            ['    print("Deferred: Fix title until active")', LC_P_DEFER],
            ['}', null],
            ['phase = .suspended', LC_TO_SUSP],
            ['print("Phase: suspended")', LC_P_SUSP],
          ],
        },
        {
          caption: 'Active again: the loop drains the pending list and prints the title fix being applied. The day ends with every edit either saved or applied, none lost.',
          diagram: { phase: 'Active', memory: 'Draft: 2 edits, title fix applied', disk: 'Saved: 2 edits', note: 'The deferred edit applied as soon as the app returned.' },
          claims: ['Applied on return: Fix title'],
          lines: [
            ['enum ScenePhase {', LC_ENUM],
            ['    case notRunning, inactive, active, background, suspended', LC_CASES],
            ['}', null],
            ['var phase = ScenePhase.notRunning', LC_PHASE],
            ['var edits = 0', LC_EDITS],
            ['var pending: [String] = []', LC_PENDING],
            ['print("Phase: not running")', LC_P_NOTRUN],
            ['phase = .inactive', LC_TO_INACTIVE],
            ['print("Phase: inactive")', LC_P_INACTIVE],
            ['phase = .active', LC_TO_ACTIVE],
            ['edits += 1', LC_EDIT],
            ['edits += 1', LC_EDIT],
            ['print("Active: \\(edits) unsaved edits")', LC_P_ACTIVE],
            ['phase = .background', LC_TO_BG],
            ['print("Saved \\(edits) edits")', LC_P_SAVED],
            ['if phase == .background {', LC_IF],
            ['    pending.append("Fix title")', LC_APPEND],
            ['    print("Deferred: Fix title until active")', LC_P_DEFER],
            ['}', null],
            ['phase = .suspended', LC_TO_SUSP],
            ['print("Phase: suspended")', LC_P_SUSP],
            ['phase = .active', LC_TO_ACTIVE],
            ['for item in pending { print("Applied on return: \\(item)") }', LC_FOR],
          ],
        },
      ],
      tryIt: {
        task: '<p>The starter counts one edit while active and stops. Finish the day: count a second edit, move the phase to background, and print the save line showing how many edits were saved and in which phase.</p>',
        lines: [
          ['var phase = "active"', LT_PHASE],
          ['var edits = 0', LT_EDITS],
          ['edits += 1', LT_EDIT],
          ['print("Edits so far: \\(edits)")', LT_P_EARLY],
        ],
        solution: [
          ['var phase = "active"', LT_PHASE],
          ['var edits = 0', LT_EDITS],
          ['edits += 1', LT_EDIT],
          ['edits += 1', LT_EDIT],
          ['phase = "background"', LT_TOBG],
          ['print("Saved \\(edits) edits in \\(phase)")', LT_PRINT],
        ],
        expect: 'Saved 2 edits in background',
      },
    },
  ],
};

export default {
  id: 'ecosystem',
  number: 1,
  title: 'The Apple Platform and Its Ecosystem',
  short: 'Ecosystem',
  summary: 'Know the Apple platforms and their screens, find your way around Xcode, explain how an app is built, launched and suspended, apply the development life cycle to an iOS app, and choose the right kind of app or extension for an idea.',
  objectives: ['CLO1', 'CLO3'],
  outcomes: ['SLO1', 'SLO2'],
  lessons: [platforms, tools, anatomy, lifecycle, sdlc, appTypes, swiftEverywhere, workedExamples],
};

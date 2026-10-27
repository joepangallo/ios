// Module 0: orientation. How the page works and the three ways Swift runs in it.
const n = (who, what, where, when, why) => ({ who, what, where, when, why });

const STUDY_BUDDY = `import SwiftUI

struct StudyBuddyView: View {
    @State private var minutes = 25
    @State private var sessions = 2

    var body: some View {
        NavigationStack {
            List {
                Section("Today") {
                    Label("\\(sessions) study sessions", systemImage: "book")
                    Label("\\(sessions * minutes) minutes focused", systemImage: "timer")
                }
                Section("Next session") {
                    Stepper("Length: \\(minutes) min", value: $minutes, in: 5...60, step: 5)
                    Button("Start focusing", systemImage: "play.fill") {
                        sessions += 1
                    }
                }
            }
            .navigationTitle("Study Buddy")
        }
    }
}

#Preview {
    StudyBuddyView()
}
`;

// Five-part notes shared by the worked examples at the end of this module:
// the same line appears in many frames, so its note is written once here.
// Example 1: your first program, line by line (prefix WG_)
const WG_PRINT_HELLO = n(
  'The print function from the Swift standard library, which every program gets for free.',
  'Prints the word Hello! to the console and ends the line.',
  'Top-level code: this short program is nothing but top-level lines, run in order.',
  'When the program runs; in the first frame it is the only line, in later frames it runs after the constants above it.',
  'Printing is how a program talks back. This first version keeps the greeting fixed so there is only one idea on screen.');
const WG_VISITOR = n(
  'You, the programmer, declare it; the Swift compiler records its type as String.',
  'Creates a constant named visitor that holds the text Ada, the name of the person being greeted.',
  'At the top level of the program, above the print lines, so every later line can use it.',
  'When the program starts, before any line below it runs.',
  'let makes a value that never changes. Storing the name in a constant means the greeting lines never repeat the name itself.');
const WG_PRINT_GREET = n(
  'The print function, with Swift string interpolation filling in the visitor value.',
  'Prints Hello, Ada! by placing the value of visitor inside the text where the interpolation marker sits.',
  'Top-level code; its output appears in the console panel beside the editor.',
  'After the visitor constant exists, when the program reaches this line.',
  'Interpolation builds text from values, so changing the stored name changes the greeting without touching this line.');
const WG_COURSE = n(
  'You declare it; the compiler infers its type, String, from the quoted text.',
  'Creates a constant named course that holds the text iOS Development, the name of this course.',
  'At the top level, next to visitor, with the other values the program will use.',
  'When the program starts, after visitor and before the greeting is printed.',
  'The second printed line will need this name, so it is stored now, before that line exists, ready to be interpolated.');
const WG_PROJECT = n(
  'You declare it; the compiler infers String from the quoted text.',
  'Creates a constant named project that holds the text your first iPhone app.',
  'At the top level, beside visitor and course, the last of the three stored values.',
  'When the program starts, after course and before the greeting is printed.',
  'Storing what the course builds in its own constant keeps the final line short and makes the promise of the course one value.');
const WG_PRINT_BUILD = n(
  'The print function, with interpolation filling in both course and project.',
  'Prints In iOS Development, you will build your first iPhone app. as the second line of output.',
  'Top-level code, directly under the greeting line, so its output lands on the next console line.',
  'Last, after the greeting, when all three constants hold their values.',
  'A greeting alone only says hello. This line says what happens next, and it is built entirely from the stored values.');
const WG_TRY_NAME = n(
  'You declare the try-it name; the compiler infers String from the quoted text.',
  'Creates a constant named name that holds the text Sam.',
  'Top-level code, the first line of the try-it program.',
  'First, before the print line below reads it.',
  'The task is to greet this stored name, so the value lives in a constant the print can interpolate.');
const WG_TRY_PRINT_HELLO = n(
  'The print function from the standard library.',
  'Prints Hello! with no name in it at all; the starter never uses the name constant above.',
  'The last line of the starter program; its output is the only output.',
  'Last, after the name is stored, which is exactly the gap the task asks you to close.',
  'The starter shows the starting point plainly: a greeting that ignores its own data is the thing to fix.');
const WG_TRY_PRINT_GREET = n(
  'The print function, with interpolation filling in the name constant.',
  'Prints Hello, Sam! by placing the value of name inside the greeting text.',
  'The last line of the solution program; its output is the only output.',
  'Last, after the name exists, when the program reaches this line.',
  'Using the stored value is the whole fix: change the name once and the greeting follows on its own.');

// Example 2: change the greeting, then make it yours (prefix WP_)
const WP_IMPORT = n(
  'The Swift compiler, which loads the SwiftUI framework for this file.',
  'Makes View, Text, VStack, Image, Button and @State available in this file.',
  'The first line of the file; an import covers only its own file.',
  'At compile time, before any of the code below is checked.',
  'SwiftUI is a separate framework, so every file that describes a screen imports it.');
const WP_STRUCT = n(
  'You declare it; SwiftUI creates values of it whenever the greeting screen is shown.',
  'Declares WelcomeView, a struct that conforms to View and describes the greeting screen.',
  'At the top level of the file, so the preview at the bottom can create it.',
  'Compiled once; a fresh value is created whenever a parent or the preview asks for the screen.',
  'A screen in SwiftUI is a value that describes an interface, which is why the whole example is one struct.');
const WP_STATE = n(
  'SwiftUI, which stores the value outside the struct, tied to this screen while it is shown.',
  'Declares greeting, the text the screen shows, starting as Hello, Ada!; @State makes SwiftUI keep and watch it.',
  'Inside WelcomeView, marked private because only this screen changes it.',
  'Created when the screen first appears and kept across every redraw.',
  'The text below is read from this one value, so when the button changes it, the screen and the data can never disagree.');
const WP_BODY = n(
  'SwiftUI calls this property; your code never calls body directly.',
  'Returns the description of the greeting screen for the current greeting text.',
  'A computed property inside WelcomeView.',
  'When the screen appears, and again after every change to the greeting state.',
  'Describing the screen from the data is the whole SwiftUI idea: change the greeting and the screen follows.');
const WP_VSTACK = n(
  'SwiftUI layout system, which measures the children and stacks them.',
  'Stacks the picture and the greeting text vertically, with 12 points of space between them.',
  'The root view returned by body, wrapping everything the screen shows.',
  'Measured and placed again every time body produces a new description.',
  'A stack states the arrangement once, so the picture sits above the words without any coordinates to manage.');
const WP_IMAGE = n(
  'SwiftUI, which looks the name up in the SF Symbols library built into the system.',
  'Shows the sun.max.fill symbol, a filled sun, as a picture above the greeting.',
  'The first child of the VStack, so it sits at the top of the screen.',
  'Drawn every time body runs; the symbol is a template picture the system can size and recolor.',
  'A symbol gives the screen a picture with no image files to manage, matching the friendly tone of a greeting.');
const WP_IMAGE_FONT = n(
  'The font modifier, applied to the Image view directly above it.',
  'Sets the picture size with the largeTitle text style, so the sun renders big.',
  'Chained under the Image; modifiers apply to the view written before them.',
  'Read while body builds the description, before layout measures the picture.',
  'SF Symbols are drawn like a font, so a text style sizes them, and the size follows the text-size setting of the reader.');
const WP_TEXT_LITERAL = n(
  'SwiftUI, which draws the string as a Text view with the system font.',
  'Shows the fixed greeting text Hello, Ada! exactly as written in the code.',
  'Inside body; in the early frames it is the only view, later it becomes a child of the VStack.',
  'Rebuilt every time body runs, although the words never change in these frames.',
  'Text is the simplest view there is, so the example starts here and adds one idea per frame around it.');
const WP_TEXT_STATE = n(
  'SwiftUI, which reads the greeting state while building this Text view.',
  'Shows whatever the greeting state currently holds, starting with Hello, Ada!, with no words written in this line at all.',
  'A child of the VStack, under the picture, in the same position the fixed text occupied.',
  'Rebuilt after every change to greeting, so it always shows the current value.',
  'Reading the state instead of a fixed string is what lets one button press change the words on screen.');
const WP_FONT = n(
  'The font modifier, applied to the Text view directly above it.',
  'Sets the greeting in the largeTitle text style, the biggest standard style, so it reads as the headline of the screen.',
  'Chained under the greeting Text; it affects that text and nothing else.',
  'Applied while the description is built, before the text is measured.',
  'A greeting is the point of this screen, so it gets the loudest type on it; styles also scale with accessibility settings.');
const WP_FG = n(
  'The foregroundStyle modifier, applied to the Text view above it in the chain.',
  'Colors the greeting blue, so the headline stands apart from plain body text.',
  'Chained under the font modifier on the greeting Text.',
  'Applied while the description is built, each time body runs.',
  'Color is the second half of emphasis: size said the greeting matters most, and color now makes it the first thing seen.');
const WP_BUTTON = n(
  'You declare it; the person using the app triggers its action by tapping.',
  'Creates the Surprise me button; the closure after the title is its action, the code that runs on a tap.',
  'The last child of the VStack, under the greeting text.',
  'The button is created each time body runs; its action runs only at the moment of a tap.',
  'The tap check for this example presses exactly this button, so its title is the promise the screen makes.');
const WP_ASSIGN = n(
  'Your code, run by SwiftUI when the button is tapped.',
  'Replaces the greeting state with the new text Welcome back, Ada!, storing it in the same single place the Text reads.',
  'Inside the button action closure, the only line in this screen that changes data.',
  'Once per tap, at the moment of the tap, and never while body is being built.',
  'Changing the state is the whole action: SwiftUI notices, runs body again, and the greeting text updates by itself.');
const WP_PREVIEW = n(
  'Xcode and this page, which render the screen without running a whole app.',
  'Starts a preview block that shows WelcomeView while you work on it.',
  'At the bottom of the file, outside the struct.',
  'Whenever the file is opened or edited; previews are not part of a shipped app.',
  'Seeing the screen while you build it is how each frame of this example was checked.');
const WP_CALL = n(
  'The preview renderer, which creates the view value to display.',
  'Creates one WelcomeView for the preview to show.',
  'The only line inside the preview block.',
  'Each time the preview refreshes.',
  'The preview needs a value to render; this is the same creation a real app screen would do.');
const WP_TRY_NAME = n(
  'You declare the try-it name; the compiler infers String from the quoted text.',
  'Creates a constant named name that holds the text Ada.',
  'Top-level code, the first line of the try-it program; this is console Swift, not SwiftUI.',
  'First, before the print line below reads it.',
  'The try-it task is the console twin of the screen: a personalized greeting built from a stored name.');
const WP_TRY_PRINT_HELLO = n(
  'The print function from the standard library.',
  'Prints Hello! with no name in it; the starter stores a name and then ignores it.',
  'The last line of the starter program; its output is the only output.',
  'Last, after the name is stored, showing the gap the task asks you to close.',
  'A greeting that could belong to anyone is the starting point; making it personal is the exercise.');
const WP_TRY_PRINT_GREET = n(
  'The print function, with interpolation filling in the name constant.',
  'Prints Hello, Ada! Ready to build? by placing the value of name inside the sentence.',
  'The last line of the solution program; its output is the only output.',
  'Last, after the name exists, when the program reaches this line.',
  'One stored name now drives the whole line, so changing the constant changes the greeting everywhere it appears.');

export default {
  id: 'welcome',
  number: 0,
  title: 'Start Here',
  short: 'Start Here',
  summary: 'Learn how this interactive course works, run your first Swift program and your first SwiftUI screen, and meet the three Swift engines inside the page.',
  objectives: ['CLO1', 'CLO3'],
  outcomes: ['SLO1'],
  lessons: [
    {
      id: 'welcome-hello',
      title: 'Welcome to iOS Development',
      steps: [
        {
          kind: 'concept',
          title: 'Build real iPhone apps, one line at a time',
          body: `<p>This course teaches you to design and build apps for iPhone and the rest of Apple's platforms with <strong>Swift</strong>, Apple's programming language, and <strong>SwiftUI</strong>, its framework for building user interfaces. The phone on the right is not a picture. It is a live SwiftUI app running in this page: tap <em>Start focusing</em> or change the session length.</p><p>By the end you will be able to:</p>`,
          points: [
            { term: 'Navigate the ecosystem', text: 'Use Xcode, the Simulator, and Apple’s platforms, and follow an app from idea to the App Store.' },
            { term: 'Design reactive interfaces', text: 'Build SwiftUI screens whose controls and properties update automatically when data changes.' },
            { term: 'Write Swift apps', text: 'Create different kinds of iOS apps in Swift, a modern, safe, industry-standard language.' },
            { term: 'Store data', text: 'Save data locally and in an on-device database, and sync it through the cloud.' },
            { term: 'Use device and network APIs', text: 'Add location, maps, and cloud storage, and talk to servers over HTTP and other protocols.' },
          ],
          figure: { widget: 'phone-preview', props: { code: STUDY_BUDDY } },
        },
        {
          kind: 'concept',
          title: 'How this page works',
          body: `<p>Move through the course with the <strong>Next</strong> and <strong>Previous</strong> buttons or the <kbd>←</kbd> and <kbd>→</kbd> keys. The outline on the left lists every module and lesson; your progress is saved in this browser.</p><p>Every code example is editable and every line has a note. Click a line (or use <kbd>↑</kbd> and <kbd>↓</kbd>) and the inspector explains it in five parts:</p>`,
          points: [
            { term: 'Who', text: 'Which part of the system acts: the compiler, SwiftUI, iOS, your own type, or the person tapping the screen.' },
            { term: 'What', text: 'Exactly what that one line does.' },
            { term: 'Where', text: 'Where it lives or runs: which type or scope, which thread, the device or a server.' },
            { term: 'When', text: 'When it runs: at compile time, at launch, every time a screen redraws, or on a tap.' },
            { term: 'Why', text: 'The reason it is written that way: a design rule, a best practice, or the bug it prevents.' },
          ],
          callout: { tone: 'tip', title: 'Break things on purpose', html: '<p>Edit any example. Programs re-run and previews redraw as you type. <strong>Reset</strong> restores the original, so experiments are free.</p>' },
        },
        {
          kind: 'concept',
          title: 'Five kinds of steps',
          body: `<p>Every screen in this course is one of five kinds. Each has its own layout, so you always know what to do.</p>`,
          points: [
            { term: 'Concept', text: 'An explanation, sometimes with an interactive figure beside it, like the phone on the first screen.' },
            { term: 'Code', text: 'An annotated example. The editor sits on the left with its Try it list. The five-part notes sit beside it, with a console under them for programs, or a live phone or a simulation in a third pane.' },
            { term: 'Compare', text: 'Two annotated snippets side by side, A and B, with a verdict naming the lesson.' },
            { term: 'Widget', text: 'A full-screen interactive. Its intro says what to try and what to notice.' },
            { term: 'Quiz', text: 'A self-check that ends every lesson. Pick an answer and the explanation appears at once. A wrong answer gets a Try again button; a right one locks the question. The dots below jump between questions, and your answers stay in this browser.' },
          ],
          callout: { tone: 'tip', title: 'Try it prompts', html: '<p>Under each code example, <strong>Try it</strong> lists edits to make in the editor. Make them, watch the result, then press <strong>Reset</strong> to restore the original.</p>' },
        },
        {
          kind: 'code',
          title: 'Your first Swift program',
          run: 'swift',
          intro: '<p>This program runs right here in your browser. Read the note for each line, then press <strong>Run</strong> or edit a value: the output updates as you type. <strong>Real compiler</strong> sends the same code to Apple’s open-source Swift compiler on a server and shows its answer.</p>',
          lines: [
            ['let course = "iOS Development"', n(
              'You, the programmer, declare it; the Swift compiler records its type.',
              'Creates a constant named course that holds the text "iOS Development".',
              'At the top level of the program, so every later line can use it.',
              'When the program starts, before any line below it runs.',
              'let makes a value that never changes. Swift style is to prefer let and switch to var only when a value must change.')],
            ['var weeksLeft = 4', n(
              'You declare it; the compiler infers its type, Int, from the whole number 4.',
              'Creates a variable named weeksLeft with the starting value 4.',
              'At the top level, next to course.',
              'Right after line 1 runs.',
              'var is for values that will change. No type is written because Swift infers Int from the literal.')],
            ['', null],
            ['weeksLeft -= 1', n(
              'The Swift runtime, following your instruction.',
              'Subtracts 1 from weeksLeft and stores the result back, so it becomes 3.',
              'It changes the variable declared on line 2.',
              'After lines 1 and 2, in order from top to bottom.',
              'Compound operators like -= update a var in place. Trying this on a let would be a compile error, which is exactly why constants are safer.')],
            ['print("Welcome to \\(course)!")', n(
              'The Swift standard library function print writes to the console.',
              'Prints Welcome to iOS Development! by inserting course into the text with \\( ).',
              'The output appears in the panel on the right; in a real app it goes to Xcode’s debug console.',
              'Each time this line runs: once, here.',
              'String interpolation, \\(value), builds text from values without manual conversion or + chains.')],
            ['print("Weeks left: \\(weeksLeft)")', n(
              'print, called with the current value of weeksLeft.',
              'Prints Weeks left: 3, because line 4 already subtracted 1.',
              'The console panel beside the editor, on the line right after the welcome message.',
              'After line 5. Swift runs top-level statements in order.',
              'Printing values is the quickest way to check what your program is doing while you learn and debug.')],
          ],
          expect: 'Welcome to iOS Development!\nWeeks left: 3',
          try: ['Change 4 on line 2 to 10 and watch the output update.', 'Change let on line 1 to var, then try assigning a new course name on a new line.', 'Change var on line 2 to let. Read the error, then change it back.'],
        },
        {
          kind: 'code',
          title: 'Your first SwiftUI screen',
          run: 'swiftui',
          intro: '<p>This is a complete SwiftUI view. The phone on the right runs it live: tap the button. Then edit the text or the color and watch the screen redraw.</p>',
          lines: [
            ['import SwiftUI', n(
              'The Swift compiler, while it builds your app.',
              'Makes SwiftUI’s types available in this file: View, Text, Button, VStack and @State.',
              'The first line of the file; it applies to this whole file.',
              'While the compiler builds this file, before GreetingView or its preview exists.',
              'SwiftUI is a framework, not part of the language, so each file imports what it uses.')],
            ['', null],
            ['struct GreetingView: View {', n(
              'You define the type; SwiftUI will create and display it.',
              'Declares a structure named GreetingView that conforms to the View protocol.',
              'At the top level of the file, so other views and the preview can use it.',
              'The type is checked at compile time; SwiftUI creates instances whenever it needs this screen.',
              'SwiftUI views are lightweight structs, values that describe UI. Conforming to View means "I can describe something to draw."')],
            ['    @State private var taps = 0', n(
              'SwiftUI owns the storage; this view reads and writes it.',
              'Declares a piece of state named taps that starts at 0.',
              'Inside GreetingView; private means only this view can touch it.',
              'Created when the view first appears and kept while it stays on screen.',
              '@State is the single source of truth for data this view owns. When it changes, SwiftUI redraws the parts of the screen that depend on it. Module 04 (SwiftUI) explains it in full; for now read it as "a value that survives redraws".')],
            ['', null],
            ['    var body: some View {', n(
              'SwiftUI calls this property; you write what it returns.',
              'Declares body, the description of what this view shows.',
              'Inside GreetingView; every View must provide body.',
              'Every time SwiftUI needs to draw the view, including after taps changes.',
              'Describing the screen as a function of state is what makes SwiftUI reactive: you never update labels by hand.')],
            ['        VStack(spacing: 16) {', n(
              'SwiftUI’s layout system, which measures the stack and positions its three children.',
              'Stacks its child views vertically with 16 points of space between them.',
              'Inside body: it is the single view that body returns.',
              'Every time SwiftUI evaluates GreetingView’s body, including right after taps changes.',
              'Stacks are the basic building blocks of layout. Spacing in multiples of 4 or 8 points keeps screens visually consistent.')],
            ['            Text("Hello, Swift!")', n(
              'SwiftUI draws the text with the system font.',
              'Shows the words Hello, Swift!',
              'First child of the VStack, so it appears at the top.',
              'Each time body runs, although the words never change, so there is nothing new to draw.',
              'Text is the simplest view. It uses Dynamic Type by default, so it respects the user’s preferred text size.')],
            ['                .font(.largeTitle)', n(
              'A modifier, applied by SwiftUI to the Text above.',
              'Uses the Large Title text style (34 points at the default size).',
              'Attached to the Text on line 8.',
              'Each time body runs, right after the Text above it is created and before the stack lays it out.',
              'Semantic text styles such as .largeTitle scale with accessibility settings; fixed point sizes do not.')],
            ['            Text("Button tapped \\(taps) times")', n(
              'SwiftUI reads taps while building this Text.',
              'Shows how many times the button was tapped, using string interpolation.',
              'Second child of the VStack.',
              'Every time body runs, so the number is always current.',
              'Because this text depends on taps, SwiftUI updates it automatically when taps changes.')],
            ['                .foregroundStyle(.secondary)', n(
              'SwiftUI applies a semantic color.',
              'Draws the text in the secondary label color, a softer gray.',
              'Attached to the Text on line 10.',
              'Each time body runs; the actual gray is resolved when the text is drawn, so it follows Light or Dark Mode.',
              'Semantic colors adapt to Light and Dark Mode automatically, so you never pick grays by hand.')],
            ['            Button("Tap me") {', n(
              'The person using the app triggers it; SwiftUI runs the closure.',
              'Creates a button titled Tap me whose action is the code in the braces.',
              'Third child of the VStack.',
              'The button is created each time body runs; its action runs only on a tap.',
              'Buttons separate what they look like (the title) from what they do (the action closure).')],
            ['                taps += 1', n(
              'Your code, run by SwiftUI when the button is tapped.',
              'Adds 1 to the taps state.',
              'Inside the button’s action closure.',
              'Once per tap on the button, after the finger lifts, and never while body is being evaluated.',
              'Changing @State is all you do. SwiftUI notices the change, runs body again, and updates the text on line 10.')],
            ['            }', null],
            ['            .buttonStyle(.borderedProminent)', n(
              'SwiftUI styles the button.',
              'Gives the button a filled, tinted capsule, the style for a screen’s main action.',
              'Attached to the Button that starts on line 12.',
              'Each time body runs, when the Button on line 12 is rebuilt; the style itself never changes.',
              'A prominent style signals the primary action. Use it for one button per screen so the hierarchy stays clear.')],
            ['        }', null],
            ['    }', null],
            ['}', null],
            ['', null],
            ['#Preview {', n(
              'Xcode (and this page) reads the #Preview macro.',
              'Declares a preview that shows GreetingView on a simulated device.',
              'At the top level of the file, outside the struct.',
              'At design time, while you edit; it is not part of the shipped app.',
              'Previews give instant visual feedback, so you see each change without building and launching the whole app.')],
            ['    GreetingView()', n(
              'SwiftUI creates an instance of your view.',
              'Makes a GreetingView to display in the preview.',
              'Inside the #Preview block.',
              'Each time the preview refreshes.',
              'Creating views is cheap because they are structs, so SwiftUI can rebuild them freely.')],
            ['}', null],
          ],
          try: ['Change "Hello, Swift!" to your own name.', 'Change .borderedProminent to .bordered, then to .glassProminent (the Liquid Glass style).', 'Change taps += 1 to taps += 10.'],
        },
        {
          kind: 'quiz',
          title: 'Check your understanding',
          questions: [
            {
              q: '<p>When does a line of SwiftUI code such as <code>Text("Button tapped \\(taps) times")</code> run?</p>',
              choices: ['Once, when the app launches, and then never again', 'Each time SwiftUI runs body, such as after a tap', 'Only when the person taps that Text on the screen', 'At compile time, when Xcode checks the file'],
              answer: 1,
              explain: '<p>body is re-run whenever the state it reads changes, so this Text is rebuilt with the new count. That is the heart of reactive UI. It is not a launch-only line, Text has no tap behavior of its own, and compile time is when code is checked, not run.</p>',
            },
            {
              q: '<p>In <em>Your first Swift program</em>, what would happen if <code>var weeksLeft = 4</code> were changed to <code>let weeksLeft = 4</code>?</p>',
              choices: ['It prints Weeks left: 4, because the subtraction is skipped', 'It prints Weeks left: 3, exactly as before', 'The compiler rejects weeksLeft -= 1', 'It builds, then crashes at the subtraction'],
              answer: 2,
              explain: '<p>A let constant can never be changed, and the compiler catches that before the program runs: "cannot assign to value: \'weeksLeft\' is a \'let\' constant". Nothing is printed and nothing crashes, because the program never builds. Catching mistakes at compile time, instead of crashing later, is one of Swift’s safety features.</p>',
            },
            {
              q: '<p>Why does the SwiftUI example store the tap count in <code>@State</code> instead of a plain <code>var</code>?</p>',
              choices: ['@State makes adding to the number faster', 'Changing @State makes SwiftUI redraw views that read it', '@State keeps the number on disk between app launches', 'A plain var inside a View struct cannot hold an Int at all'],
              answer: 1,
              explain: '<p>@State is SwiftUI-managed storage. When it changes, SwiftUI re-runs body and updates the screen. It is no faster than a plain var, and it does not persist across app launches (that is @AppStorage or a database, covered in the Data module). A plain var can hold an Int; it just cannot trigger a redraw.</p>',
            },
          ],
        },
      ],
    },
    {
      id: 'welcome-engines',
      title: 'Three Ways Swift Runs Here',
      steps: [
        {
          kind: 'concept',
          title: 'Engine 1: a Swift interpreter in your browser',
          body: `<p>Browsers cannot run Swift directly. This page carries its own <strong>Swift interpreter</strong>, a program that reads Swift source code and carries it out step by step. It supports the language features this course teaches: types, optionals, collections, functions, closures, structs, classes, enums, protocols, generics, errors, and async/await.</p><p>Every console example in the course was run on the real Swift compiler, and the interpreter produces the same output. It also reproduces the compiler errors beginners meet most, word for word.</p>`,
          points: [
            { term: 'Step through', text: 'Console examples have a Step through tab: move line by line and watch every variable change.' },
            { term: 'Real compiler', text: 'The Real compiler button sends your code to Compiler Explorer (godbolt.org), which compiles it with Swift on a Linux server.' },
          ],
          callout: { tone: 'warn', title: 'Know the limits', html: '<p>An interpreter is slower than compiled code and covers the language, not every Apple framework. When an example needs a real iPhone (location, maps, cloud), it is marked <em>Read-along</em>, explained line by line, and paired with a simulation.</p>' },
        },
        {
          kind: 'concept',
          title: 'Engine 2: a live SwiftUI preview',
          body: `<p>SwiftUI examples render on a simulated iPhone, much like the canvas in Xcode. The preview supports stacks, text, images and SF Symbols, buttons, lists, navigation, tabs, sheets, alerts, forms and controls, animation, and Liquid Glass, along with <code>@State</code>, <code>@Binding</code>, <code>@Observable</code> models, <code>@Environment</code>, and <code>@AppStorage</code>.</p><p>Use the buttons above each phone to switch devices, toggle Dark Mode, change the Dynamic Type text size, and turn on the accessibility inspector, which outlines every tap target and flags any smaller than Apple’s 44-point minimum.</p>`,
          callout: { tone: 'design', title: 'Test like a designer', html: '<p>Check every screen in Dark Mode, at a large text size, and on the small iPhone SE. Most layout bugs show up in one of those three.</p>' },
          figure: { widget: 'phone-preview', props: { code: STUDY_BUDDY } },
        },
        {
          kind: 'concept',
          title: 'Engine 3: real Swift compiled to WebAssembly',
          body: `<p><strong>WebAssembly</strong> (WASM) is a compact machine-code format that every modern browser can run at near-native speed. Since Swift 6.2, the official toolchain ships a Swift SDK for WebAssembly, so it can compile Swift into WebAssembly.</p><p>This page includes a small module of real Swift, compiled ahead of time with that SDK. Its functions power the color-contrast checker in the Design module and the distance calculator in the Location lesson. Race it on the right against JavaScript and against the interpreter.</p>`,
          callout: { tone: 'ecosystem', title: 'Swift beyond the iPhone', html: '<p>The same language runs on iPhone, iPad, Mac, Apple Watch, Apple TV, Vision Pro, Linux servers, Windows, and now the web. Learning Swift opens all of them.</p>' },
          figure: { widget: 'swift-wasm-race', props: {} },
        },
        {
          kind: 'code',
          title: 'The Swift behind the race',
          run: 'swift',
          intro: '<p>This is the prime-counting function that runs as WebAssembly in the race. In the compiled module it also carries two attributes, <code>@_expose(wasm)</code> and <code>@_cdecl</code>, that export it to JavaScript. Here it runs in the interpreter so you can step through it.</p>',
          lines: [
            ['func countPrimes(_ n: Int) -> Int {', n(
              'You define the function; callers (here, the last line) run it.',
              'Declares countPrimes, which takes a whole number n and returns how many primes are at or below it.',
              'At the top level of the program.',
              'Defined at compile time; its body runs each time it is called.',
              'The underscore means callers write countPrimes(100) rather than countPrimes(n: 100), which reads naturally.')],
            ['    if n < 2 { return 0 }', n(
              'The function itself, guarding against small inputs.',
              'Returns 0 right away when n is less than 2, since there are no primes below 2.',
              'First line of the function body.',
              'At the start of every call.',
              'Handling edge cases first keeps the main algorithm simple and prevents an invalid array size below.')],
            ['    var isPrime = [Bool](repeating: true, count: n + 1)', n(
              'The function allocates the array; Swift manages its memory.',
              'Creates an array of n + 1 Booleans, all true, one slot for each number from 0 to n.',
              'A local variable inside the function.',
              'Once per call, after the guard.',
              'The Sieve of Eratosthenes starts by assuming every number is prime, then crosses out the ones that are not.')],
            ['    isPrime[0] = false', n(
              'The function updates the array.',
              'Marks 0 as not prime.',
              'Inside the function, changing slot 0 of isPrime.',
              'Once per call to countPrimes, immediately after the array is created.',
              'By definition 0 and 1 are not prime numbers.')],
            ['    isPrime[1] = false', n(
              'The function updates the array.',
              'Marks 1 as not prime.',
              'Inside the function, changing slot 1.',
              'Once per call, right after slot 0 is cleared on the line above.',
              'Same reason as the line above.')],
            ['    var i = 2', n(
              'The function keeps a counter.',
              'Starts the candidate number i at 2, the first prime.',
              'A local variable inside the function.',
              'Once per call, before the loop.',
              'var because the loop increases i.')],
            ['    while i * i <= n {', n(
              'The Swift runtime repeats the block while the condition holds.',
              'Loops while i squared is at most n.',
              'Inside countPrimes, after the array and the counter i are set up; it encloses the crossing-out code.',
              'Checked before every pass of the loop.',
              'Any composite number up to n has a factor no larger than its square root, so the loop can stop early.')],
            ['        if isPrime[i] {', n(
              'The loop checks the array.',
              'Continues only if i has not been crossed out, meaning i is prime.',
              'Inside the while loop.',
              'Once per value of i.',
              'Only primes need to cross out their multiples; multiples of a composite were already crossed out by its factors.')],
            ['            var multiple = i * i', n(
              'The function starts a second counter.',
              'Begins crossing out at i squared.',
              'Inside the if block.',
              'Each time a prime i is found.',
              'Smaller multiples of i were already crossed out by smaller primes, so starting at i * i saves work.')],
            ['            while multiple <= n {', n(
              'The runtime repeats the inner block.',
              'Walks through the multiples of i up to n.',
              'Nested inside the outer loop.',
              'Repeatedly, for each prime i.',
              'This inner loop does most of the sieve’s work.')],
            ['                isPrime[multiple] = false', n(
              'The function updates the array.',
              'Crosses out the current multiple, since it has i as a factor.',
              'Inside the inner loop.',
              'Once for every multiple of the current prime i, from i squared up to n.',
              'A number with a factor other than 1 and itself is not prime.')],
            ['                multiple += i', n(
              'The function advances the counter.',
              'Moves to the next multiple of i.',
              'Inside the inner loop.',
              'After each crossing out.',
              'Adding i each time visits exactly the multiples of i.')],
            ['            }', null],
            ['        }', null],
            ['        i += 1', n(
              'The function advances the outer counter.',
              'Moves on to the next candidate number.',
              'At the end of the outer loop body.',
              'Once per pass of the outer loop.',
              'Without this line the loop would never end. An infinite loop is a common bug, and the interpreter stops one for you.')],
            ['    }', null],
            ['    return isPrime.filter { $0 }.count', n(
              'The function hands its answer back to the caller.',
              'Keeps only the true slots and counts them: the number of primes.',
              'The last line of the function.',
              'Once per call, after the sieve finishes.',
              'filter with the closure { $0 } keeps the elements that are true. Functional tools like filter express "count the trues" in one readable line.')],
            ['}', null],
            ['', null],
            ['print(countPrimes(100))', n(
              'Top-level code calls the function and print shows the result.',
              'Counts the primes up to 100 and prints 25.',
              'At the top level, after the function definition.',
              'After countPrimes is defined, when the program reaches its only top-level statement.',
              'A small known answer (there are 25 primes below 100) is a quick way to check an algorithm before trusting it with bigger inputs.')],
          ],
          expect: '25',
          try: ['Change 100 to 1000. There are 168 primes below 1,000.', 'Open the Step through tab and watch isPrime, i, and multiple change.', 'Delete the line i += 1 and run it to see how the interpreter stops an infinite loop.'],
        },
        {
          kind: 'concept',
          title: 'What you need for the rest of the course',
          body: `<p>Everything in this page runs in a web browser. To build and ship real apps you also need:</p>`,
          points: [
            { term: 'A Mac with Xcode', text: 'Xcode 26 or later, free from the Mac App Store. It includes Swift, the iOS SDK, the Simulator, Instruments, and the SwiftUI canvas.' },
            { term: 'An Apple Account', text: 'Sign in to Xcode to run apps on your own iPhone for free. Publishing on the App Store requires the paid Apple Developer Program.' },
            { term: 'Optional: an iPhone', text: 'The Simulator covers most work, but sensors, the camera, and real performance need a device.' },
            { term: 'Optional: Swift Playgrounds', text: 'A free iPad and Mac app for experimenting with Swift and building simple SwiftUI apps.' },
          ],
          callout: { tone: 'tip', title: 'Use both together', html: '<p>Learn a concept here, then rebuild the example in Xcode. Typing it yourself, running it, and fixing your own mistakes is how the knowledge sticks.</p>' },
        },
        {
          kind: 'quiz',
          title: 'Check your understanding',
          questions: [
            {
              q: '<p>Which statement about the in-browser Swift interpreter is accurate?</p>',
              choices: ['It runs every Apple framework, including Core Location', 'It reads the Swift source and carries it out step by step', 'It translates the Swift into JavaScript, then runs that', 'It runs faster than Swift compiled for a real device'],
              answer: 1,
              explain: '<p>An interpreter executes source code directly, step by step, which is why it can show a Step through view. Nothing is translated to JavaScript first. Interpreting is slower than running compiled machine code, as the race shows, and it does not include device frameworks such as Core Location.</p>',
            },
            {
              q: '<p>What is WebAssembly?</p>',
              choices: ['A JavaScript library that lets web pages call Swift code', 'A binary format browsers run at near-native speed', 'Apple’s framework for building iOS apps with web technologies', 'A server-side service that compiles Swift for the web'],
              answer: 1,
              explain: '<p>WebAssembly is a portable binary format, not a library, a framework or a service. The Swift toolchain can compile Swift into it, and the browser runs the result much faster than interpreted code.</p>',
            },
            {
              q: '<p>A friend’s SwiftUI screen looks fine on their iPhone 17 Pro. Which checks would most likely reveal a layout bug?</p>',
              choices: ['Check it in Light Mode at the default text size on another iPhone 17 Pro', 'Check it in Dark Mode, at a large text size, and on an iPhone SE', 'Check it on the newest Pro Max model at the default text size', 'Take a screenshot and zoom in to inspect the pixel alignment'],
              answer: 1,
              explain: '<p>Color assumptions break in Dark Mode, fixed sizes break at large text sizes, and tight layouts break on small screens. Repeating the same conditions on another large phone, or zooming into a screenshot of them, shows you the same healthy layout. The preview toolbar lets you test all three in seconds.</p>',
            },
          ],
        },
      ],
    },
    {
      id: 'welcome-worked-examples',
      title: 'Worked Examples',
      steps: [
        {
          kind: 'example',
          title: 'Your first program, line by line',
          problem: '<p>Your very first program prints a greeting. Step through the frames first: each one adds a single line or a single idea. Then press Play and watch the finished run greet Ada by name and say what she will build.</p>',
          adapter: 'trace',
          expect: 'Hello, Ada!\nIn iOS Development, you will build your first iPhone app.',
          frames: [
            {
              caption: 'The whole program is one line: print shows Hello! in the console. There is nothing else yet, no stored values and no name, which is exactly why it is a good place to start.',
              expect: 'Hello!',
              lines: [
                ['print("Hello!")', WG_PRINT_HELLO],
              ],
            },
            {
              caption: 'A constant named visitor now stores the name Ada above the print. The greeting has not changed yet, because no line uses the new value; storing a value and using it are two separate steps.',
              expect: 'Hello!',
              lines: [
                ['let visitor = "Ada"', WG_VISITOR],
                ['', null],
                ['print("Hello!")', WG_PRINT_HELLO],
              ],
            },
            {
              caption: 'The print line now builds its text from the stored name: interpolation places the value of visitor inside the greeting, so the console shows Hello, Ada! without the name being typed twice.',
              expect: 'Hello, Ada!',
              lines: [
                ['let visitor = "Ada"', WG_VISITOR],
                ['', null],
                ['print("Hello, \\(visitor)!")', WG_PRINT_GREET],
              ],
            },
            {
              caption: 'A second constant stores the course name, iOS Development, ready for the line that is coming. The output still shows only the greeting, because storing a value never prints anything by itself.',
              expect: 'Hello, Ada!',
              lines: [
                ['let visitor = "Ada"', WG_VISITOR],
                ['let course = "iOS Development"', WG_COURSE],
                ['', null],
                ['print("Hello, \\(visitor)!")', WG_PRINT_GREET],
              ],
            },
            {
              caption: 'A third constant stores what the course will build: your first iPhone app. All three values the finished program needs are now in place, and the greeting line still works exactly as before.',
              expect: 'Hello, Ada!',
              lines: [
                ['let visitor = "Ada"', WG_VISITOR],
                ['let course = "iOS Development"', WG_COURSE],
                ['let project = "your first iPhone app"', WG_PROJECT],
                ['', null],
                ['print("Hello, \\(visitor)!")', WG_PRINT_GREET],
              ],
            },
            {
              caption: 'A second print line joins the program and uses the two stored values at once. The finished run prints both lines in order: the greeting first, then what Ada will build in this course.',
              expect: 'Hello, Ada!\nIn iOS Development, you will build your first iPhone app.',
              lines: [
                ['let visitor = "Ada"', WG_VISITOR],
                ['let course = "iOS Development"', WG_COURSE],
                ['let project = "your first iPhone app"', WG_PROJECT],
                ['', null],
                ['print("Hello, \\(visitor)!")', WG_PRINT_GREET],
                ['print("In \\(course), you will build \\(project).")', WG_PRINT_BUILD],
              ],
            },
          ],
          tryIt: {
            task: '<p>The starter stores the name Sam, then prints a plain Hello! that ignores it. Change the print line so it greets the stored name by interpolation, and the program prints Hello, Sam!</p>',
            lines: [
              ['let name = "Sam"', WG_TRY_NAME],
              ['print("Hello!")', WG_TRY_PRINT_HELLO],
            ],
            solution: [
              ['let name = "Sam"', WG_TRY_NAME],
              ['print("Hello, \\(name)!")', WG_TRY_PRINT_GREET],
            ],
            expect: 'Hello, Sam!',
          },
        },
        {
          kind: 'example',
          title: 'Change the greeting, then make it yours',
          problem: '<p>Make a greeting screen you can change. Start with one line of text, style it, add a picture above it, then store the greeting in state so a button can swap in a brand-new greeting.</p>',
          adapter: 'phone',
          check: { tap: 'Surprise me', expectText: 'Welcome back, Ada!' },
          frames: [
            {
              caption: 'The screen starts as a single line of text: the greeting, drawn by a Text view inside body. A preview at the bottom shows the struct, and every later frame adds one idea to this view.',
              lines: [
                ['import SwiftUI', WP_IMPORT],
                ['', null],
                ['struct WelcomeView: View {', WP_STRUCT],
                ['    var body: some View {', WP_BODY],
                ['        Text("Hello, Ada!")', WP_TEXT_LITERAL],
                ['    }', null],
                ['}', null],
                ['', null],
                ['#Preview {', WP_PREVIEW],
                ['    WelcomeView()', WP_CALL],
                ['}', null],
              ],
            },
            {
              caption: 'A font modifier goes under the text and makes the greeting a large title. Modifiers wrap the view written above them, so this one changes only the greeting and nothing else on the screen.',
              lines: [
                ['import SwiftUI', WP_IMPORT],
                ['', null],
                ['struct WelcomeView: View {', WP_STRUCT],
                ['    var body: some View {', WP_BODY],
                ['        Text("Hello, Ada!")', WP_TEXT_LITERAL],
                ['            .font(.largeTitle)', WP_FONT],
                ['    }', null],
                ['}', null],
                ['', null],
                ['#Preview {', WP_PREVIEW],
                ['    WelcomeView()', WP_CALL],
                ['}', null],
              ],
            },
            {
              caption: 'A second modifier joins the chain and colors the greeting blue. The text is now big and colored, the two halves of emphasis, while the words themselves have not changed at all.',
              lines: [
                ['import SwiftUI', WP_IMPORT],
                ['', null],
                ['struct WelcomeView: View {', WP_STRUCT],
                ['    var body: some View {', WP_BODY],
                ['        Text("Hello, Ada!")', WP_TEXT_LITERAL],
                ['            .font(.largeTitle)', WP_FONT],
                ['            .foregroundStyle(.blue)', WP_FG],
                ['    }', null],
                ['}', null],
                ['', null],
                ['#Preview {', WP_PREVIEW],
                ['    WelcomeView()', WP_CALL],
                ['}', null],
              ],
            },
            {
              caption: 'A VStack now wraps the screen, and an Image showing a sun from SF Symbols takes the top spot. The greeting keeps its size and color, and the stack places the picture above the words.',
              lines: [
                ['import SwiftUI', WP_IMPORT],
                ['', null],
                ['struct WelcomeView: View {', WP_STRUCT],
                ['    var body: some View {', WP_BODY],
                ['        VStack(spacing: 12) {', WP_VSTACK],
                ['            Image(systemName: "sun.max.fill")', WP_IMAGE],
                ['                .font(.largeTitle)', WP_IMAGE_FONT],
                ['            Text("Hello, Ada!")', WP_TEXT_LITERAL],
                ['                .font(.largeTitle)', WP_FONT],
                ['                .foregroundStyle(.blue)', WP_FG],
                ['        }', null],
                ['    }', null],
                ['}', null],
                ['', null],
                ['#Preview {', WP_PREVIEW],
                ['    WelcomeView()', WP_CALL],
                ['}', null],
              ],
            },
            {
              caption: 'The greeting text moves into @State, and the Text view now shows that state instead of fixed words. The screen looks identical, but the words now live in one stored value the screen reads.',
              lines: [
                ['import SwiftUI', WP_IMPORT],
                ['', null],
                ['struct WelcomeView: View {', WP_STRUCT],
                ['    @State private var greeting = "Hello, Ada!"', WP_STATE],
                ['    var body: some View {', WP_BODY],
                ['        VStack(spacing: 12) {', WP_VSTACK],
                ['            Image(systemName: "sun.max.fill")', WP_IMAGE],
                ['                .font(.largeTitle)', WP_IMAGE_FONT],
                ['            Text(greeting)', WP_TEXT_STATE],
                ['                .font(.largeTitle)', WP_FONT],
                ['                .foregroundStyle(.blue)', WP_FG],
                ['        }', null],
                ['    }', null],
                ['}', null],
                ['', null],
                ['#Preview {', WP_PREVIEW],
                ['    WelcomeView()', WP_CALL],
                ['}', null],
              ],
            },
            {
              caption: 'A Button joins the bottom of the stack. Its action replaces the greeting state with Welcome back, Ada!, and because the Text reads that same state, tapping Surprise me redraws the greeting on its own.',
              lines: [
                ['import SwiftUI', WP_IMPORT],
                ['', null],
                ['struct WelcomeView: View {', WP_STRUCT],
                ['    @State private var greeting = "Hello, Ada!"', WP_STATE],
                ['    var body: some View {', WP_BODY],
                ['        VStack(spacing: 12) {', WP_VSTACK],
                ['            Image(systemName: "sun.max.fill")', WP_IMAGE],
                ['                .font(.largeTitle)', WP_IMAGE_FONT],
                ['            Text(greeting)', WP_TEXT_STATE],
                ['                .font(.largeTitle)', WP_FONT],
                ['                .foregroundStyle(.blue)', WP_FG],
                ['            Button("Surprise me") {', WP_BUTTON],
                ['                greeting = "Welcome back, Ada!"', WP_ASSIGN],
                ['            }', null],
                ['        }', null],
                ['    }', null],
                ['}', null],
                ['', null],
                ['#Preview {', WP_PREVIEW],
                ['    WelcomeView()', WP_CALL],
                ['}', null],
              ],
            },
          ],
          tryIt: {
            task: '<p>Back in plain console Swift, the starter stores the name Ada and prints a greeting that ignores it. Change the print line so it uses the stored name and prints Hello, Ada! Ready to build?</p>',
            lines: [
              ['let name = "Ada"', WP_TRY_NAME],
              ['print("Hello!")', WP_TRY_PRINT_HELLO],
            ],
            solution: [
              ['let name = "Ada"', WP_TRY_NAME],
              ['print("Hello, \\(name)! Ready to build?")', WP_TRY_PRINT_GREET],
            ],
            expect: 'Hello, Ada! Ready to build?',
          },
        },
      ],
    },
  ],
};

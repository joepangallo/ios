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
              'The console panel.',
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
              'At compile time, before any of your code runs.',
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
              '@State is the single source of truth for data this view owns. When it changes, SwiftUI redraws the parts of the screen that depend on it.')],
            ['', null],
            ['    var body: some View {', n(
              'SwiftUI calls this property; you write what it returns.',
              'Declares body, the description of what this view shows.',
              'Inside GreetingView; every View must provide body.',
              'Every time SwiftUI needs to draw the view, including after taps changes.',
              'Describing the screen as a function of state is what makes SwiftUI reactive: you never update labels by hand.')],
            ['        VStack(spacing: 16) {', n(
              'SwiftUI’s layout system.',
              'Stacks its child views vertically with 16 points of space between them.',
              'Inside body: it is the single view that body returns.',
              'Each time body runs.',
              'Stacks are the basic building blocks of layout. Spacing in multiples of 4 or 8 points keeps screens visually consistent.')],
            ['            Text("Hello, Swift!")', n(
              'SwiftUI draws the text with the system font.',
              'Shows the words Hello, Swift!',
              'First child of the VStack, so it appears at the top.',
              'Each time body runs.',
              'Text is the simplest view. It uses Dynamic Type by default, so it respects the user’s preferred text size.')],
            ['                .font(.largeTitle)', n(
              'A modifier, applied by SwiftUI to the Text above.',
              'Uses the Large Title text style (34 points at the default size).',
              'Attached to the Text on line 8.',
              'Each time body runs.',
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
              'Each time body runs.',
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
              'Once per tap.',
              'Changing @State is all you do. SwiftUI notices the change, runs body again, and updates the text on line 10.')],
            ['            }', null],
            ['            .buttonStyle(.borderedProminent)', n(
              'SwiftUI styles the button.',
              'Gives the button a filled, tinted capsule, the style for a screen’s main action.',
              'Attached to the Button that starts on line 12.',
              'Each time body runs.',
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
              q: '<p>In the five-part line notes, which part tells you <em>when</em> a line of SwiftUI code such as <code>Text("Button tapped \\(taps) times")</code> runs?</p>',
              choices: ['Only once, when the app launches', 'Every time SwiftUI runs body, for example after taps changes', 'Only when the person taps the text', 'At compile time'],
              answer: 1,
              explain: '<p>body is re-run whenever the state it reads changes, so this Text is rebuilt with the new count. That is the heart of reactive UI. It is not a launch-only line, and Text has no tap behavior of its own.</p>',
            },
            {
              q: '<p>In <em>Your first Swift program</em>, what would happen if <code>var weeksLeft = 4</code> were changed to <code>let weeksLeft = 4</code>?</p>',
              choices: ['It prints Weeks left: 4', 'It prints Weeks left: 3 as before', 'The compiler reports an error on weeksLeft -= 1', 'It crashes when it runs'],
              answer: 2,
              explain: '<p>A let constant can never be changed, and the compiler catches that before the program runs: "cannot assign to value: \'weeksLeft\' is a \'let\' constant". Catching mistakes at compile time, instead of crashing later, is one of Swift’s safety features.</p>',
            },
            {
              q: '<p>Why does the SwiftUI example store the tap count in <code>@State</code> instead of a plain <code>var</code>?</p>',
              choices: ['@State makes the number faster to add', 'Changes to @State make SwiftUI redraw the views that read it', '@State saves the number permanently on the device', 'A plain var cannot hold an Int'],
              answer: 1,
              explain: '<p>@State is SwiftUI-managed storage. When it changes, SwiftUI re-runs body and updates the screen. It does not persist across app launches (that is @AppStorage or a database, covered in the Data module).</p>',
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
          body: `<p><strong>WebAssembly</strong> (WASM) is a compact machine-code format that every modern browser can run at near-native speed. Since Swift 6, the official Swift toolchain can compile Swift into WebAssembly.</p><p>This page includes a small module of real Swift, compiled ahead of time with the Swift SDK for WebAssembly. Its functions power the color-contrast checker in the Design module and the distance calculator in the Location lesson. Race it on the right against JavaScript and against the interpreter.</p>`,
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
              'Once per call.',
              'By definition 0 and 1 are not prime numbers.')],
            ['    isPrime[1] = false', n(
              'The function updates the array.',
              'Marks 1 as not prime.',
              'Inside the function, changing slot 1.',
              'Once per call.',
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
              'Inside the function.',
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
              'Once per multiple.',
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
              'When the program runs.',
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
              choices: ['It runs every Apple framework, including Core Location', 'It runs Swift by reading the source code and carrying it out step by step', 'It turns Swift into JavaScript before running it', 'It is faster than compiled Swift'],
              answer: 1,
              explain: '<p>An interpreter executes source code directly, step by step, which is why it can show a Step through view. Interpreting is slower than running compiled machine code, as the race shows, and it does not include device frameworks such as Core Location.</p>',
            },
            {
              q: '<p>What is WebAssembly?</p>',
              choices: ['A JavaScript library for Swift', 'A compact machine-code format that browsers run at near-native speed', 'Apple’s web framework for iOS apps', 'A server that compiles Swift'],
              answer: 1,
              explain: '<p>WebAssembly is a portable binary format. The Swift toolchain can compile Swift into it, and the browser runs the result much faster than interpreted code.</p>',
            },
            {
              q: '<p>A friend’s SwiftUI screen looks fine on their iPhone 17 Pro. Which checks would most likely reveal a layout bug?</p>',
              choices: ['Check it in Light Mode only', 'Check it in Dark Mode, at a large Dynamic Type size, and on a small screen such as iPhone SE', 'Rotate the Mac', 'Increase the screen brightness'],
              answer: 1,
              explain: '<p>Color assumptions break in Dark Mode, fixed sizes break at large text sizes, and tight layouts break on small screens. The preview toolbar lets you test all three in seconds.</p>',
            },
          ],
        },
      ],
    },
  ],
};

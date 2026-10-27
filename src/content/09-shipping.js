// Module 9: Architecture, Testing and Shipping.
// Every code line is [code, note]; n(who, what, where, when, why) builds the
// five-part note. Code strings use String.raw so Swift's \( and \. survive.
const n = (who, what, where, when, why) => ({ who, what, where, when, why });
const r = String.raw;

// Five-part notes shared by the worked examples at the end of this module:
// the same line appears in many frames, so its note is written once here.
const RC_PILOT_CLASS = n("You declare it; ARC manages every instance.", "Declares the Pilot class, one half of the pair in this example.", "At file scope, above the Ship class it refers to.", "Compiled once; an instance is created near the bottom.", "Classes are reference types, so ARC counts the references to each instance.");
const RC_PILOT_SHIP = n("Each Pilot instance, holding its ship strongly.", "Stores an optional strong reference from the pilot to its ship.", "A stored property inside Pilot, on the heap with the instance.", "Set after both objects exist, when the link is made.", "A plain var property is strong: it keeps the ship alive.");
const RC_PILOT_DEINIT = n("ARC, at the moment the last strong reference goes.", "Prints a line when a Pilot instance is destroyed.", "Inside Pilot; a class can have at most one deinit.", "Exactly when the pilot strong reference count reaches zero.", "A print in deinit is the leak detector used in the debugging lesson.");
const RC_SHIP_CLASS = n("You declare it; ARC manages every instance.", "Declares the Ship class, the other half of the pair.", "At file scope, below the Pilot class it refers to.", "Compiled once; an instance is created near the bottom.", "Two classes that can point at each other are all a cycle needs.");
const RC_SHIP_PILOT_STRONG = n("Each Ship instance, holding its pilot strongly.", "Stores an optional strong reference from the ship back to its pilot.", "A stored property inside Ship, on the heap with the instance.", "Set after both objects exist, when the cycle closes.", "This strong arrow back is the one that will close the loop.");
const RC_SHIP_DEINIT = n("ARC, at the moment the last strong reference goes.", "Prints a line when a Ship instance is destroyed.", "Inside Ship; a class can have at most one deinit.", "Exactly when the ship strong reference count reaches zero.", "Watching for this line, or its absence, is the whole experiment.");
const RC_VAR_PILOT = n("Top-level code, playing the screen that owns the pilot.", "Creates a Pilot and holds it in an optional variable.", "Top-level code below both class declarations.", "When the program reaches this line, before any linking.", "Optional variables can later be set to nil to release the object.");
const RC_VAR_SHIP = n("Top-level code, playing the screen that owns the ship.", "Creates a Ship and holds it in an optional variable.", "Top-level code, right after the pilot variable.", "When the program reaches this line, before any linking.", "Each object starts with exactly one strong reference: its variable.");
const RC_PRINT_CREATED = n("The print function from the Swift standard library.", "Prints the marker that both objects now exist.", "Top-level code, after both variables are created.", "After creation, before any links are made.", "A marker line makes the output order easy to follow.");
const RC_LINK1 = n("Top-level code, wiring the first direction.", "Stores the ship in the pilot property, creating the first strong arrow.", "Top-level code, after both objects exist.", "After creation, as the first link between the pair.", "One direction of reference is normal ownership and leaks nothing.");
const RC_PRINT_HOLDS = n("The print function from the Swift standard library.", "Prints the marker that the first link is in place.", "Top-level code, right after the first link line.", "After the first link, before the second direction exists.", "The marker separates the one-way stage from the cycle stage.");
const RC_LINK2 = n("Top-level code, wiring the second direction.", "Stores the pilot in the ship property, closing the reference loop.", "Top-level code, after the first link is in place.", "After the first link, as the moment the cycle forms.", "Now each object holds the other strongly: the cycle is complete.");
const RC_PRINT_CYCLE = n("The print function from the Swift standard library.", "Prints the marker that both directions of reference now exist.", "Top-level code, right after the second link line.", "After the second link, before any release is tried.", "From here, releasing the variables is the test that matters.");
const RC_NIL_PILOT = n("Top-level code, releasing its pilot reference.", "Drops the outside strong reference to the pilot object.", "Top-level code, in the release section of the program.", "After the links are made, as the first release step.", "Whether anything is freed now depends entirely on the links.");
const RC_NIL_SHIP = n("Top-level code, releasing its ship reference.", "Drops the outside strong reference to the ship object.", "Top-level code, right after the pilot release.", "After the pilot release, as the second release step.", "After this line no outside reference to either object remains.");
const RC_PRINT_AFTER = n("The print function from the Swift standard library.", "Prints the marker that both releases have happened.", "The last line of the program, after both nil assignments.", "Last, after every release step has run.", "Any freed lines before this marker prove the release worked.");
const RC_SHIP_PILOT_WEAK = n("Each Ship instance, referring without owning.", "Stores an optional weak reference from the ship back to its pilot.", "A stored property inside Ship, replacing the strong version.", "Set after both objects exist, when the link is made.", "weak does not add to the count, so this arrow cannot keep the pilot alive.");
const RC_TRY_DRIVER_CLASS = n("You declare it; ARC manages every instance.", "Declares the Driver class for the practice cycle.", "At file scope, above the Car class it refers to.", "Compiled once; an instance is created near the bottom.", "The practice pair mirrors the pilot and ship pair.");
const RC_TRY_DRIVER_CAR = n("Each Driver instance, holding its car strongly.", "Stores an optional strong reference from the driver to the car.", "A stored property inside Driver, on the heap.", "Set after both objects exist, when the link is made.", "This strong arrow is ordinary ownership and stays strong.");
const RC_TRY_DRIVER_DEINIT = n("ARC, at the moment the last strong reference goes.", "Prints a line when a Driver instance is destroyed.", "Inside Driver; a class can have at most one deinit.", "Exactly when the driver strong count reaches zero.", "This line is the success signal the practice asks for.");
const RC_TRY_CAR_CLASS = n("You declare it; ARC manages every instance.", "Declares the Car class for the practice cycle.", "At file scope, below the Driver class it refers to.", "Compiled once; an instance is created near the bottom.", "The car pointing back at its driver is what can close a loop.");
const RC_TRY_CAR_DRIVER_STRONG = n("Each Car instance, holding its driver strongly.", "Stores an optional strong reference from the car back to its driver.", "A stored property inside Car, on the heap.", "Set after both objects exist, when the cycle closes.", "In the starter this strong arrow back is the bug to fix.");
const RC_TRY_CAR_DEINIT = n("ARC, at the moment the last strong reference goes.", "Prints a line when a Car instance is destroyed.", "Inside Car; a class can have at most one deinit.", "Exactly when the car strong count reaches zero.", "This line should follow the driver line in a fixed program.");
const RC_TRY_VAR_DRIVER = n("Top-level code, holding the driver for the practice run.", "Creates a Driver and holds it in an optional variable.", "Top-level code below both class declarations.", "When the program reaches this line, before linking.", "The optional variable is the outside reference to release later.");
const RC_TRY_VAR_CAR = n("Top-level code, holding the car for the practice run.", "Creates a Car and holds it in an optional variable.", "Top-level code, right after the driver variable.", "When the program reaches this line, before linking.", "Each practice object starts with one outside strong reference.");
const RC_TRY_LINK1 = n("Top-level code, wiring the first direction.", "Stores the car in the driver property, the first strong arrow.", "Top-level code, after both objects exist.", "After creation, as the first practice link.", "Driver to car stays strong in both starter and solution.");
const RC_TRY_LINK2 = n("Top-level code, wiring the second direction.", "Stores the driver in the car property, closing the loop.", "Top-level code, after the first link is in place.", "After the first link, as the moment the cycle forms.", "Whether this arrow owns or merely refers decides the outcome.");
const RC_TRY_NIL_DRIVER = n("Top-level code, releasing its driver reference.", "Drops the outside strong reference to the driver object.", "Top-level code, in the release section.", "After the links are made, as the first release step.", "In the fixed version this is the line that frees the driver.");
const RC_TRY_NIL_CAR = n("Top-level code, releasing its car reference.", "Drops the outside strong reference to the car object.", "Top-level code, right after the driver release.", "After the driver release, as the second release step.", "After this line the car has no strong references in the fix.");
const RC_TRY_PRINT_AFTER = n("The print function from the Swift standard library.", "Prints the marker that both releases have happened.", "The last line of the practice program.", "Last, after every release step has run.", "Freed lines before this marker prove the fix worked.");
const RC_TRY_CAR_DRIVER_WEAK = n("Each Car instance, referring without owning.", "Stores an optional weak reference from the car back to its driver.", "A stored property inside Car, replacing the strong version.", "Set after both objects exist, when the link is made.", "weak keeps the reference usable without keeping the driver alive.");
const FB_ITEMS = n("Your code, fixing the workload size.", "Stores the number of list items one frame must handle: twenty.", "The first line of the program, above every cost line.", "First, before any segment cost is computed.", "Every segment cost below is computed from this one count.");
const FB_FUNC = n("Your code, formatting durations for display.", "Declares a helper that turns tenths of a millisecond into text.", "At file scope, above the cost lines that use it.", "Compiled once; called by every print below.", "Working in integer tenths keeps every printed total exact.");
const FB_FUNC_BODY = n("The helper function, building its return text.", "Returns whole milliseconds, a dot, then the tenths digit.", "The only statement inside the ms helper function.", "Each time a print formats a segment or a total.", "Dividing and taking the remainder formats tenths with no fractions.");
const FB_INPUT = n("Your model of one frame, costing the input stage.", "Computes input cost: one tenth of a millisecond per item, twenty total.", "With the segment cost lines, after the item count.", "When the frame model is built, before totals are summed.", "Input is cheap per item, which the printed two milliseconds shows.");
const FB_TOTAL_INPUT = n("Your code, starting the running frame total.", "Starts the total with the input cost alone.", "After the segment lines written so far, before the prints.", "After the input cost exists, before later segments are added.", "A var total can grow as each new segment joins the model.");
const FB_PRINT_INPUT = n("The print function, formatting through the ms helper.", "Prints the input segment cost with one decimal place.", "In the output section, after the totals are summed.", "After the model is built, as the first printed segment.", "Each segment prints so the diagram can be checked against code.");
const FB_PRINT_TOTAL = n("The print function, formatting through the ms helper.", "Prints the total frame cost with one decimal place.", "In the output section, after every segment line.", "After the totals are summed, as the verdict input.", "Sixteen point seven is the budget this total is judged against.");
const FB_UPDATE = n("Your model of one frame, costing the update stage.", "Computes update cost: two tenths per item, forty total.", "With the segment cost lines, below the input cost.", "When the frame model is built, before totals are summed.", "Update costs more than input because every item changes state.");
const FB_TOTAL_IU = n("Your code, starting the running frame total.", "Starts the total with the input and update costs added.", "After the input and update lines, before the prints.", "After both costs exist, before layout joins the model.", "Starting from the segments present keeps each frame total honest.");
const FB_PRINT_UPDATE = n("The print function, formatting through the ms helper.", "Prints the update segment cost with one decimal place.", "In the output section, after the input line.", "After the model is built, as the second printed segment.", "Update at four milliseconds is the second largest honest cost.");
const FB_LAYOUT_NAIVE = n("Your model of one frame, costing layout the naive way.", "Computes layout cost when every item re-lays out every item: one hundred twenty tenths.", "With the segment cost lines, in place of the cached line.", "When the frame model is built, before totals are summed.", "The items times items term is the repeated work that busts the budget.");
const FB_ADD_LAYOUT = n("Your code, extending the running frame total.", "Adds the layout cost into the total for this frame.", "After the total starts, before the print lines.", "After the layout cost exists, in segment order.", "Adding segments one by one mirrors how a frame spends its budget.");
const FB_PRINT_LAYOUT = n("The print function, formatting through the ms helper.", "Prints the layout segment cost with one decimal place.", "In the output section, after the update line.", "After the model is built, as the third printed segment.", "This is the line that changes when caching replaces recomputation.");
const FB_RENDER = n("Your model of one frame, costing the render stage.", "Computes render cost: the item count plus ten, thirty tenths total.", "With the segment cost lines, below the layout cost.", "When the frame model is built, before totals are summed.", "Render is a fixed cost plus a small per item cost here.");
const FB_ADD_RENDER = n("Your code, extending the running frame total.", "Adds the render cost into the total for this frame.", "After the layout addition, before the print lines.", "After the render cost exists, as the final segment.", "Render is the last segment, so this completes the frames cost.");
const FB_PRINT_RENDER = n("The print function, formatting through the ms helper.", "Prints the render segment cost with one decimal place.", "In the output section, after the layout line.", "After the model is built, as the last printed segment.", "Render stays the same in both versions; layout was the problem.");
const FB_CACHED_DECL = n("Your code, keeping the layout result for reuse.", "Stores the layout cost computed once: thirty tenths, three milliseconds.", "With the segment cost lines, above the layout cost line.", "Computed once, before the frame costs are summed.", "Caching means paying the layout cost a single time, not per item.");
const FB_LAYOUT_CACHED = n("Your model of one frame, costing layout the cached way.", "Takes the layout cost from the cached value instead of recomputing it.", "With the segment cost lines, right after the cached value.", "When the frame model is built, before totals are summed.", "Reuse is the repair: same layout result, a quarter of the cost.");
const FB_VERDICT = n("Your code, judging the total against the budget.", "Prints the on-time verdict when the total is at most one hundred sixty-seven tenths.", "The last line of the program, after the total print.", "Last, once the final total is known.", "Comparing in tenths keeps the budget check exact, with no rounding.");
const FB_TRY_ITEMS = n("Your code, fixing the practice workload.", "Stores the number of items in the practice frame: ten.", "The first line of the practice program.", "First, before any practice cost is computed.", "Ten items keeps the practice arithmetic easy to check by hand.");
const FB_TRY_INPUT = n("Your model of the practice frame, costing input.", "Stores the input cost directly: twenty tenths, two milliseconds.", "With the practice cost lines, after the item count.", "When the practice model is built, before the total.", "A fixed input cost keeps the practice focused on layout.");
const FB_TRY_LAYOUT_NAIVE = n("Your model, costing layout the wasteful way.", "Computes layout as items times items: one hundred tenths.", "With the practice cost lines, in place of the cached line.", "When the practice model is built, before the total.", "The squared term is the repeated work to remove.");
const FB_TRY_RENDER = n("Your model of the practice frame, costing render.", "Stores the render cost directly: thirty tenths, three milliseconds.", "With the practice cost lines, below the layout cost.", "When the practice model is built, before the total.", "Render does not change between starter and solution.");
const FB_TRY_TOTAL = n("Swift integer arithmetic, adding the three segment costs.", "Computes the practice frame total from its three segments.", "After all three segment lines, before the print.", "After every segment exists, as the summed cost.", "The total is only ever the sum of the printed segments.");
const FB_TRY_PRINT = n("The print function from the Swift standard library.", "Prints the practice total with one decimal place, from tenths.", "The last line of the practice program.", "Last, after the total has been summed.", "Tenths arithmetic prints exactly, so the total can be trusted.");
const FB_TRY_LAYOUT_CACHED = n("Your model, costing layout the cached way.", "Stores the layout cost computed once: thirty tenths.", "With the practice cost lines, replacing the naive line.", "When the practice model is built, before the total.", "One stored cost replaces a per item recomputation.");
const RL_FUNC = n("Your code, formatting one release gate result.", "Declares a helper that turns a gate name and its result into a report line.", "At file scope, above the release facts it reports on.", "Compiled once; called once per gate below.", "One formatter means every gate line has the same shape.");
const RL_FUNC_IF = n("The gate helper, handling a passed gate.", "Returns the PASS report for the named gate when its fact is true.", "The first statement inside the gate helper function.", "Each time the helper is called with a true result.", "PASS lines are how the checklist shows a gate was cleared.");
const RL_FUNC_RETURN = n("The gate helper, handling a failed gate.", "Returns the FAIL report for the named gate when its fact is false.", "The last statement inside the gate helper function.", "Each time the helper is called with a false result.", "A FAIL line must be just as visible as a PASS line.");
const RL_BUILD = n("Your checklist model, recording the build fact.", "Stores that the release build compiled successfully.", "With the release facts, after the gate helper.", "Set before the gate lines are printed below.", "Each gate in this model is one fact the release depends on.");
const RL_PRINT_BUILD = n("The print function, reporting through the gate helper.", "Prints the Build gate line using the build fact.", "In the output section, after the facts written so far.", "As the first gate line, in release order.", "Gates are reported in the order the release pipeline runs them.");
const RL_SIGNED = n("Your checklist model, recording the signing fact.", "Stores that the archive was signed with the distribution certificate.", "With the release facts, below the build fact.", "Set before the gate lines are printed below.", "Unsigned builds cannot be archived for distribution at all.");
const RL_PRINT_SIGN = n("The print function, reporting through the gate helper.", "Prints the Signing gate line using the signing fact.", "In the output section, after the build line.", "As the second gate line, in release order.", "Signing follows building in the pipeline and in this output.");
const RL_ARCHIVED = n("Your checklist model, recording the archive fact.", "Stores that the archive was created from the release build.", "With the release facts, below the signing fact.", "Set before the gate lines are printed below.", "Archiving is the stage the release lesson builds toward.");
const RL_PRINT_ARCH = n("The print function, reporting through the gate helper.", "Prints the Archive gate line using the archive fact.", "In the output section, after the signing line.", "As the third gate line, in release order.", "An archive exists only when the first two gates passed.");
const RL_PRIVACY_BAD = n("Your checklist model, recording the missing entry.", "Stores that the required privacy entry is missing: false.", "With the release facts, below the archive fact.", "Set before validation is reported below.", "A missing privacy entry is a real validation failure, not a warning.");
const RL_PRINT_VAL = n("The print function, reporting through the gate helper.", "Prints the Validation gate line using the privacy fact.", "In the output section, after the archive line.", "As the fourth gate line, in release order.", "Validation is the gate this example watches fail, then pass.");
const RL_REASON = n("The print function from the Swift standard library.", "Prints the reason validation failed: a required privacy entry is missing.", "In the output section, right after the validation line.", "Only in the version where the privacy fact is false.", "A gate that fails must say why, or the fix is guesswork.");
const RL_PRINT_BLOCKED = n("The print function from the Swift standard library.", "Prints that distribution cannot start while validation fails.", "In the output section, after the failure reason line.", "Only in the version where validation has failed.", "Later stages do not run around a failed gate; they wait.");
const RL_PRIVACY_OK = n("Your checklist model, recording the added entry.", "Stores that the required privacy entry is now present: true.", "With the release facts, replacing the false version.", "Set before validation is reported below.", "Adding the entry is the whole fix; no other fact changes.");
const RL_DIST = n("Your code, opening the final stage after validation.", "Prints that distribution is ready, but only when validation passed.", "The last line of the program, after the validation print.", "Last, after every earlier gate has been reported.", "Distribution is the reward at the end of a clean pipeline.");
const RL_TRY_SIGNED = n("Your practice checklist, recording the signing fact.", "Stores that the practice build is signed: true.", "The first line of the practice program.", "First, before readiness is computed below.", "Signing is one of the two facts readiness needs here.");
const RL_TRY_ICON_BAD = n("Your practice checklist, recording the icon fact.", "Stores that the app icon is missing: false.", "The second line of the practice program.", "Second, before readiness is computed below.", "A missing icon blocks a release just like a missing entry.");
const RL_TRY_READY = n("Swift logic, combining the two release facts.", "Stores readiness: true only when the build is signed and has its icon.", "After both facts, before the verdict print.", "Once both facts exist, as the combined check.", "A release is ready only when every required fact holds.");
const RL_TRY_PRINT = n("The print function, choosing with the ternary operator.", "Prints the ready verdict or the blocked verdict for the practice release.", "The last line of the practice program.", "Last, after readiness has been computed.", "One verdict line is what a release checklist finally produces.");
const RL_TRY_ICON_OK = n("Your practice checklist, recording the icon fact.", "Stores that the app icon is now present: true.", "The second line of the practice program, replacing false.", "Second, before readiness is computed below.", "Supplying the missing asset is the whole practice fix.");


// ---------------------------------------------------------------------------
// Lesson 1: architecture
// ---------------------------------------------------------------------------
const architecture = {
  id: 'shipping-architecture',
  title: 'Architecture That Survives Change',
  steps: [
    {
      kind: 'concept',
      title: 'Give every piece one job',
      body: `<p>An app that works today still has to survive new features, a redesign and a second developer. <strong>Architecture</strong> is how you divide code so each piece has one job and one reason to change: <strong>separation of concerns</strong>.</p><p><strong>MVVM</strong> (Model, View, View Model) is one common way to organise a SwiftUI app: the view model is a plain <code>@Observable</code> class that holds a screen's state and logic so the view stays simple. Small screens do not need one; screens with loading, errors, or several sources of data usually do. Each layer talks only to its neighbor, so you can redesign a screen without touching networking.</p>`,
      points: [
        { term: 'View', text: 'A SwiftUI struct that draws the screen from current data and forwards taps. No rules, no networking.' },
        { term: 'View model', text: 'An @Observable class that holds screen state, applies the rules (limits, validation, formatting) and calls services.' },
        { term: 'Model', text: 'Plain data such as a StudySession struct. It knows nothing about screens.' },
        { term: 'Service', text: 'Code that talks to the outside world (network, location, storage) behind a protocol, so tests can replace it.' },
      ],
      callout: { tone: 'history', title: 'Where this came from', html: `<p>UIKit apps used MVC, and view controllers often grew into thousand-line files. Before iOS 17, SwiftUI view models used <code>ObservableObject</code> and <code>@Published</code>. The <code>@Observable</code> macro replaces both with less code and more precise updates.</p>` },
    },
    {
      kind: 'code',
      title: 'A view model is plain Swift',
      intro: `<p>The rules of a focus timer live in a class that does not import SwiftUI. It ignores bad input, caps the total and turns numbers into a status message. Nothing here draws pixels, so it runs anywhere: in the console below, in a test, or behind any screen.</p>`,
      run: 'swift',
      lines: [
        [r`final class FocusModel {`, n(
          'You declare it; the Swift compiler checks it and the runtime allocates each instance on the heap.',
          'Declares FocusModel, the view model that owns the focus timer\'s state and rules.',
          'At file scope, so any view or test in the app module can create one.',
          'Compiled once; an instance appears later, when a screen or a test calls FocusModel().',
          'A class gives one shared instance that a view can observe. final says no subclass will override it, which documents intent and lets the compiler call methods directly.')],
        [r`    let goal = 60`, n(
          'Each FocusModel instance stores its own copy.',
          'A constant goal of 60 minutes for the session.',
          'A stored property inside the object, on the heap with the rest of the instance.',
          'Set when the instance is created and never changed afterwards.',
          'let documents that the goal is fixed for this screen. A later version could pass it in through an initializer.')],
        [r`    private(set) var logged = 0`, n(
          'FocusModel alone may write it; any other code may read it.',
          'Minutes logged so far, starting at zero, with a private setter.',
          'A stored property of the instance; private(set) restricts writes to code inside this class.',
          'Read whenever something asks for status; changed only inside log(_:).',
          'Forcing every change through one method means a view can never bypass the rules by writing logged = 999.')],
        ['', null],
        [r`    var status: String {`, n(
          'Whoever reads model.status, usually a SwiftUI view\'s body.',
          'A computed property that builds the message from the current numbers.',
          'Inside FocusModel. It stores nothing; its body runs on every read.',
          'Each time status is read, so it can never be stale.',
          'Formatting is presentation logic. Keeping it here means the view only displays a string and the rule can be tested without a screen.')],
        [r`        logged >= goal ? "Goal reached" : "\(goal - logged) min left"`, n(
          'The ternary operator, evaluated by the running program.',
          'Returns "Goal reached" once the goal is met, otherwise the remaining minutes inserted into text with interpolation.',
          'The single expression of the computed property, so Swift returns it without a return keyword.',
          'Each time something reads status, so the message always matches the current numbers.',
          'One side-effect-free expression is easy to read and easy to cover with one test per branch.')],
        ['    }', null],
        ['', null],
        [r`    func log(_ minutes: Int) {`, n(
          'Called by the view when the user taps a button, or by a test.',
          'Declares the only way to add minutes. The underscore lets callers write log(25) without a label.',
          'An instance method of FocusModel. Classes are reference types, so it can change logged without the mutating keyword.',
          'Once per call, synchronously, before the caller\'s next line runs.',
          'A single entry point is where validation lives, so every caller gets the same rules.')],
        [r`        guard minutes > 0 else { return }`, n(
          'The guard statement, checked at run time.',
          'Leaves the method immediately when the input is zero or negative.',
          'First line of log(_:), before any state changes.',
          'On every call, before logged is touched.',
          'Rejecting bad input first keeps the main path unindented and makes the invalid case explicit, and therefore testable.')],
        [r`        logged = min(logged + minutes, goal)`, n(
          'FocusModel, updating its own stored property.',
          'Adds the minutes but caps the total at the goal with min.',
          'Inside log(_:), after validation passed.',
          'Only for positive input.',
          'Capping is a business rule. Enforcing it here means no screen can ever show "-15 min left".')],
        ['    }', null],
        ['}', null],
        ['', null],
        [r`let model = FocusModel()`, n(
          'Top-level code, standing in for a screen or a test.',
          'Creates one FocusModel and keeps a reference to it in model.',
          'At the top level of this program; the object itself lives on the heap.',
          'When the program reaches this line.',
          'let fixes the reference, not the object, so the object\'s var properties can still change through its methods.')],
        [r`model.log(25)`, n(
          'The caller, simulating a tap on a "Log 25 minutes" button.',
          'Logs 25 valid minutes, so logged becomes 25.',
          'A method call on the single shared instance.',
          'Right after the model is created.',
          'Calling the method directly is exactly what a unit test does in the next lesson.')],
        [r`print(model.status)`, n(
          'Swift\'s print function, writing to standard output.',
          'Prints "35 min left", because 60 minus 25 is 35.',
          'The console panel below the code.',
          'After the first log call.',
          'Reading the computed property checks the formatting rule with no user interface at all.')],
        [r`model.log(-10)`, n(
          'The caller, simulating bad input such as a typo.',
          'Asks to log negative minutes; the guard rejects it, so nothing changes.',
          'The same instance, so a change here would be visible to every reader.',
          'Third statement of the program.',
          'Trying invalid input on purpose is how you confirm a rule actually protects the data.')],
        [r`print(model.status)`, n(
          'print again, reading the same computed property.',
          'Prints "35 min left" a second time, proving the negative value was ignored.',
          'Standard output: the first line in the console panel below the code.',
          'After the rejected call.',
          'Printing the same value twice is a tiny regression check: if someone deletes the guard, this line changes.')],
        [r`model.log(50)`, n(
          'The caller, logging more minutes than remain.',
          'Asks for 50 more minutes; 25 plus 50 is 75, which min caps to 60.',
          'The same shared instance that already holds 25 logged minutes.',
          'Fifth statement, after the rejected negative input.',
          'Testing just past a limit (a boundary value) is where off-by-one bugs usually hide.')],
        [r`print(model.status, model.logged)`, n(
          'print with two items, which it separates with a space.',
          'Prints "Goal reached 60": the message and the capped total.',
          'Standard output: the third and last line in the console panel.',
          'Last line of the program.',
          'Showing both the message and the raw number confirms the cap and the message agree.')],
      ],
      expect: '35 min left\n35 min left\nGoal reached 60',
      try: [
        'Change goal to 90 and predict all three lines before you run it.',
        'Delete the guard line. What does the second line print now, and which rule broke?',
      ],
    },
    {
      kind: 'code',
      title: 'Connect the view model to a view',
      intro: `<p>The same model now carries <code>@Observable</code>, and a view shows it. The view reads <code>status</code> and forwards the tap; it contains no rules. Tap the button in the phone: SwiftUI sees that <code>logged</code> changed and redraws only what reads it.</p>`,
      run: 'swiftui',
      lines: [
        [r`import SwiftUI`, n(
          'The Swift compiler, while it builds the app.',
          'Loads SwiftUI, which also re-exports the Observation framework that provides @Observable.',
          'First line of the file; it applies only to this file.',
          'At compile time, before any of your code runs.',
          'Views, @State and the @Observable macro are framework features, not part of the core language.')],
        ['', null],
        [r`@Observable final class FocusModel {`, n(
          'The @Observable macro, which rewrites the class at compile time.',
          'Turns every stored property into a tracked property so SwiftUI knows exactly which views read it.',
          'Attached to the class declaration at file scope.',
          'Expanded during compilation; tracking happens at run time on each property read.',
          'Fine-grained tracking means a change to logged redraws only views that read logged or status, not the whole screen.')],
        [r`    let goal = 60`, n(
          'Each FocusModel instance, which stores its own constant goal.',
          'The fixed 60-minute goal.',
          'Stored property; let properties are not tracked because they cannot change.',
          'Set once when the instance is created; @Observable has nothing to track.',
          'Constants need no observation, so the macro leaves them alone.')],
        [r`    private(set) var logged = 0`, n(
          'The model owns writes; the view may only read.',
          'Minutes logged, now observable.',
          'Tracked stored property of the class.',
          'Read during body; written by log(_:).',
          'private(set) keeps the rule from the previous step: views cannot change the total directly.')],
        [r`    var status: String {`, n(
          'The view\'s body, which reads it.',
          'The computed message, unchanged from the console version.',
          'A computed property; SwiftUI records that it reads logged underneath.',
          'Every time body runs, because the Text below reads status.',
          'Because status reads logged, any change to logged invalidates every view that showed status.')],
        [r`        logged >= goal ? "Goal reached" : "\(goal - logged) min left"`, n(
          'The ternary operator, evaluated by the running app.',
          'Chooses the finished message or the minutes remaining.',
          'Body of the computed property.',
          'On each read of status, which happens during each body call.',
          'The rule is identical to the tested console version; only the observation wrapper is new.')],
        ['    }', null],
        [r`    func log(_ minutes: Int) { logged = min(logged + minutes, goal) }`, n(
          'Called from the button\'s action closure.',
          'Adds minutes with the cap; the guard from the previous step is left out here to save space.',
          'An instance method of the model.',
          'On every tap of the button, after SwiftUI runs its action closure.',
          'Assigning logged triggers observation, so SwiftUI schedules a redraw automatically. No manual refresh call exists or is needed.')],
        ['}', null],
        ['', null],
        [r`struct FocusView: View {`, n(
          'You declare it; SwiftUI calls it.',
          'A view type that describes the focus screen.',
          'File scope; a lightweight struct that SwiftUI may create many times.',
          'Created whenever a parent view\'s body runs.',
          'Views are cheap value descriptions. Long-lived state belongs in the model, not in the struct itself.')],
        [r`    @State private var model = FocusModel()`, n(
          'SwiftUI, which stores the value outside the struct.',
          'Creates the model once and keeps it alive for as long as this view is on screen.',
          'Inside the view; @State storage lives in SwiftUI\'s memory, not in the struct.',
          'Initialized the first time the view appears; reused on every later body call.',
          '@State is the right owner for an @Observable model the view creates itself. Without it, each redraw could create a fresh model and lose progress.')],
        [r`    var body: some View {`, n(
          'SwiftUI calls it whenever tracked data it read last time changes.',
          'Describes what the screen should look like right now.',
          'The View protocol\'s only requirement.',
          'At first appearance and after each relevant change.',
          'body must be fast and free of side effects because SwiftUI may call it often.')],
        [r`        VStack(spacing: 16) {`, n(
          'SwiftUI\'s layout system, arranging the text and the button.',
          'Stacks the text and the button vertically, 16 points apart.',
          'The root of this view\'s content.',
          'Rebuilt on each body call (cheaply).',
          'Layout is the view\'s real job; it is the only kind of decision left in this struct.')],
        [r`            Text(model.status).font(.title2)`, n(
          'SwiftUI renders the string; Observation records the read.',
          'Shows the model\'s message in a large font.',
          'First child of the VStack, above the button.',
          'On every body call; Observation re-runs body after logged changes.',
          'The view displays a ready-made string instead of computing it, so there is nothing here to test.')],
        [r`            Button("Log 25 minutes") { model.log(25) }`, n(
          'The user taps; SwiftUI runs the closure.',
          'A button whose action forwards the intent to the model.',
          'Inside the stack, below the text.',
          'Every time the user taps it, which then triggers one redraw.',
          'The view says what happened (a tap); the model decides what it means. That split is what a view model is for.')],
        [r`                .buttonStyle(.borderedProminent)`, n(
          'SwiftUI\'s styling system, applied to this one button.',
          'Draws the button as a filled, prominent button.',
          'A modifier applied to the Button.',
          'Applied on every render; it has no effect on the model or its rules.',
          'Styling is a view concern, so it sits here and never in the model.')],
        ['        }', null],
        ['    }', null],
        ['}', null],
        ['', null],
        [r`#Preview { FocusView() }`, n(
          'Xcode\'s preview canvas (here, the phone beside the code).',
          'Registers a preview that shows FocusView.',
          'File scope; previews are compiled only for development tools, never shipped as a screen.',
          'Whenever you open the canvas or edit the file.',
          'A preview is a fast visual check of one view in isolation, which is only easy when the view does not create its own network or database.')],
      ],
      try: [
        'Tap the button three times. Why does the text stop at "Goal reached" instead of going negative?',
        'Add a second button that logs 5 minutes. Which type did you change, and which did you not need to touch?',
      ],
    },
    {
      kind: 'compare',
      title: 'Rules in the view vs. rules in the model',
      intro: `<p>Both versions draw the same screen. On the left, the 60-minute rule and the message format live inside <code>body</code>. On the right, the view only displays and forwards. Ask yourself what you would edit to change the goal, and how you would test the rule.</p>`,
      left: {
        label: 'Before: rules buried in the view',
        run: 'static',
        lines: [
          [r`import SwiftUI`, n(
            'The Swift compiler, while it builds this file.',
            'Imports SwiftUI for View, Text, Button and @State.',
            'First line of the view\'s file; it applies to this file only.',
            'At compile time, before the app ever runs.',
            'Needed for any SwiftUI view.')],
          ['', null],
          [r`struct FocusView: View {`, n(
            'You declare it; SwiftUI renders it.',
            'A focus screen that will also hold the rules.',
            'At file scope, alongside nothing else: the rules live here too.',
            'Created by its parent view each time the parent\'s body runs.',
            'It looks harmless, but this one struct is about to take on three jobs.')],
          [r`    @State private var logged = 0`, n(
            'SwiftUI owns the storage.',
            'Keeps the minute total as view state.',
            'Inside the view, in storage that SwiftUI manages for this screen only.',
            'Lives while the view is on screen.',
            'The data now belongs to one screen, so a second screen or a widget cannot share it.')],
          ['', null],
          [r`    var body: some View {`, n(
            'SwiftUI calls it on each change.',
            'Describes the screen, and here also decides what the message says.',
            'The View protocol\'s only requirement, inside FocusView.',
            'On every redraw, which happens after each tap changes logged.',
            'Everything below runs inside rendering code, the hardest place to test.')],
          [r`        VStack {`, n(
            'SwiftUI\'s layout system, arranging the children.',
            'Stacks the text and the button.',
            'The root of body\'s content, holding both the text and the button.',
            'Rebuilt on each redraw; cheap, because views are value descriptions.',
            'Layout is the legitimate part of this view.')],
          [r`            Text(logged >= 60 ? "Goal reached"`, n(
            'The view, computing a business message.',
            'Starts a ternary that decides the message, with the goal hard-coded as 60.',
            'Inside Text\'s argument, in the middle of layout code.',
            'On every redraw, so the rule is re-decided inside rendering code.',
            'A rule hidden in an argument cannot be unit tested; you would have to render the view to check it.')],
          [r`                 : "\(60 - logged) min left")`, n(
            'The same expression, continued.',
            'Formats the remaining minutes, repeating the magic number 60.',
            'Second half of the ternary.',
            'On every redraw, together with the first half of the expression.',
            'The goal now appears twice. Change one and forget the other and the screen lies.')],
          [r`            Button("Log 25 minutes") {`, n(
            'The user taps; SwiftUI runs the closure.',
            'A button whose action holds the update rule itself.',
            'Second child of the VStack, below the message.',
            'On each tap; the closure body runs on the main thread.',
            'Rules in action closures get copied into every screen that needs them.')],
          [r`                logged = min(logged + 25, 60)`, n(
            'The view, changing state directly.',
            'Adds 25 and caps at 60, the third copy of the goal.',
            'Inside the button\'s action closure.',
            'On each tap, before SwiftUI schedules the next redraw.',
            'Validation, limits and formatting are now scattered across body, invisible to tests.')],
          ['            }', null],
          ['        }', null],
          ['    }', null],
          ['}', null],
        ],
      },
      right: {
        label: 'After: the view only displays',
        run: 'static',
        context: r`import Observation
@Observable final class FocusModel {
    let goal = 60
    private(set) var logged = 0
    var status: String { logged >= goal ? "Goal reached" : "\(goal - logged) min left" }
    func log(_ minutes: Int) { logged = min(logged + max(minutes, 0), goal) }
}`,
        lines: [
          [r`import SwiftUI`, n(
            'The Swift compiler, while it builds this file.',
            'Imports SwiftUI for View, Text, Button and @State.',
            'First line of the view\'s file.',
            'At compile time, before the app runs.',
            'The model file imports only Observation; only the view needs SwiftUI.')],
          ['', null],
          [r`struct FocusView: View {`, n(
            'You declare it; SwiftUI renders it.',
            'The same screen with a single job: layout.',
            'At file scope; the model lives in its own file next to it.',
            'Created by its parent view each time the parent\'s body runs.',
            'A view with one job stays small as the app grows.')],
          [r`    @State private var model = FocusModel()`, n(
            'SwiftUI keeps the model alive.',
            'Owns one FocusModel for the life of the screen.',
            'View state storage managed by SwiftUI.',
            'Created on first appearance.',
            'The state lives in a type that other screens or tests can also create.')],
          ['', null],
          [r`    var body: some View {`, n(
            'SwiftUI calls it when status or logged changes.',
            'Describes the screen using only values the model provides.',
            'The View protocol\'s only requirement.',
            'On every relevant change.',
            'No decisions remain here, only arrangement.')],
          [r`        VStack {`, n(
            'SwiftUI\'s layout system, arranging the two children.',
            'Stacks the two controls.',
            'The root of body\'s content.',
            'Rebuilt on each redraw; cheap, because it is only a description.',
            'Arranging views is the one job left for this struct, and it does nothing else.')],
          [r`            Text(model.status)`, n(
            'SwiftUI renders; Observation tracks the read.',
            'Shows whatever message the model computed.',
            'First child of the VStack.',
            'Each redraw; Observation records that this view read status.',
            'The format rule is tested once, in the model, and every screen reuses it.')],
          [r`            Button("Log 25 minutes") { model.log(25) }`, n(
            'The user taps; the model decides.',
            'Forwards the intent to log 25 minutes.',
            'Second child of the VStack.',
            'On each tap; the model changes logged and SwiftUI redraws.',
            'Changing the goal or the cap is now a one-line edit in one file.')],
          ['        }', null],
          ['    }', null],
          ['}', null],
        ],
      },
      verdict: `<p>The left view does three jobs: storing state, enforcing rules and laying out controls. The goal appears three times, and nothing can test the rule without rendering a screen. The right view does one job. Its rules live in one tested place, so changing the goal is a one-line edit.</p>`,
    },
    {
      kind: 'concept',
      title: 'Dependency injection with protocols',
      body: `<p>Module 08 (Networking) introduced protocol-backed services with a stub; here the same idea becomes the testing seam for a whole screen. A view model that builds its own <code>URLSession</code> is welded to the network: previews need Wi-Fi, and tests become slow and flaky. <strong>Dependency injection</strong> means an object receives what it depends on from outside, usually as an initializer argument.</p><p>Describe the dependency with a <strong>protocol</strong>, then inject a live, mock or failing version. Try each one in the figure. The view and the view model never change.</p>`,
      points: [
        { term: 'Protocol', text: 'The contract: what the service can do, not how it does it.' },
        { term: 'Mock', text: 'A stand-in that returns fixed data instantly, for previews and tests.' },
      ],
      figure: { widget: 'shipping-di-swap', props: {} },
    },
    {
      kind: 'code',
      title: 'The contract and the view model',
      intro: `<p>The protocol names one ability: report the current temperature. The view model stores <em>any</em> type that has that ability and never learns whether it talks to a server, a file or a test.</p>`,
      run: 'static',
      lines: [
        [r`import Observation`, n(
          'The Swift compiler, while it builds the view model\'s file.',
          'Imports the framework that provides the @Observable macro, without importing SwiftUI.',
          'Top of the view model\'s file.',
          'At compile time, before the app runs.',
          'A view model that does not import SwiftUI cannot accidentally depend on views, which keeps it testable on any platform.')],
        ['', null],
        [r`protocol WeatherService: Sendable {`, n(
          'You define the contract; the compiler enforces it on every conforming type.',
          'Declares a protocol, a list of requirements any weather source must meet.',
          'File scope, usually in a Services folder.',
          'Checked at compile time; no code runs here.',
          'Sendable promises conforming types are safe to share across concurrent tasks, which Swift 6 data-race checking requires.')],
        [r`    func currentTemperature() async throws -> Double`, n(
          'Every conforming type must implement it.',
          'Requires an asynchronous method that may fail and returns degrees Celsius.',
          'Inside the protocol; there is no body here, only a signature.',
          'Called later by the view model when the screen loads.',
          'async allows a network wait without freezing the screen; throws lets a failure travel to a do/catch instead of crashing.')],
        ['}', null],
        ['', null],
        [r`@MainActor @Observable`, n(
          'The compiler (for @MainActor) and the Observation macro.',
          'Pins every property and method to the main thread and makes properties observable.',
          'Attributes on the class below.',
          'Enforced at compile time; observation works at run time.',
          'SwiftUI reads the model on the main thread. @MainActor makes Swift prove that every write happens there too.')],
        [r`final class WeatherViewModel {`, n(
          'You declare it; a screen creates it.',
          'The view model for a weather card.',
          'File scope in the feature\'s folder.',
          'Instantiated by the app or by a test.',
          'final plus a class: one shared, observable instance that nobody subclasses.')],
        [r`    private let service: any WeatherService`, n(
          'The view model owns this reference privately.',
          'Stores whichever WeatherService was handed in.',
          'A stored property; any marks an existential box that can hold any conforming type.',
          'Set once in init; used in load().',
          'The view model depends on the contract, not a concrete type. That single word is what makes swapping possible.')],
        [r`    private(set) var summary = "Not loaded"`, n(
          'The view reads it; only the view model writes it.',
          'The text the card shows, starting with a neutral message.',
          'An observable stored property.',
          'Read on every redraw; written during load().',
          'Exposing ready-to-show text keeps the view free of formatting decisions.')],
        [r`    init(service: any WeatherService) { self.service = service }`, n(
          'Whoever creates the view model: the app, a preview or a test.',
          'Receives the dependency as an argument and stores it.',
          'The class\'s only initializer.',
          'Once, when the app, a preview or a test creates the view model.',
          'Initializer injection makes the dependency impossible to forget: you cannot create the view model without choosing a service.')],
        ['', null],
        [r`    func load() async {`, n(
          'Called by the view, typically from .task when the card appears.',
          'Fetches the temperature and updates summary.',
          'An async method on the main actor.',
          'Each time the screen asks to load.',
          'async lets the method pause at await while the main thread keeps drawing frames.')],
        [r`        summary = "Loading…"`, n(
          'The view model, on the main actor.',
          'Shows a loading message right away.',
          'First statement of load().',
          'Before the request starts.',
          'Immediate feedback tells the user something is happening; the view updates automatically.')],
        [r`        do {`, n(
          'Swift\'s error-handling syntax, inside load().',
          'Starts a block whose thrown errors jump to catch.',
          'Inside load(), wrapping the one call that can throw.',
          'Each time load() runs.',
          'The protocol method throws, so the call must be handled here or passed upward.')],
        [r`            let t = try await service.currentTemperature()`, n(
          'Whatever service was injected; the view model does not know which.',
          'Suspends until the service answers, then stores the reading in t.',
          'Inside the do block; the main thread is free while suspended.',
          'After the loading message is set.',
          'try marks the call that may throw; await marks the place the function may pause.')],
        [r`            summary = "Now: \(t) °C"`, n(
          'The view model, back on the main actor.',
          'Formats the reading, for example "Now: 21.5 °C".',
          'Inside do, after a successful call.',
          'When the service returns.',
          'Assigning summary triggers observation, so the card redraws with no extra code.')],
        [r`        } catch {`, n(
          'Swift\'s catch clause, paired with the do block in load().',
          'Catches any error the service threw.',
          'Paired with the do block.',
          'Only when currentTemperature() throws.',
          'Every failure becomes a visible, friendly state instead of a crash.')],
        [r`            summary = "Could not load weather"`, n(
          'The view model, back on the main actor.',
          'Shows a failure message.',
          'Inside the catch block, the failure path of load().',
          'After an error, such as no network.',
          'A failure path you can trigger on purpose, with a failing service, is a failure path you can test.')],
        ['        }', null],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'code',
      title: 'Prove it with a stand-in',
      intro: `<p>A mock conforms to the same protocol and returns a fixed value. The function at the bottom plays the view model's role: it accepts <em>any</em> <code>WeatherService</code>. Run it and watch one function produce two results without a network.</p>`,
      run: 'swift',
      lines: [
        [r`protocol WeatherService {`, n(
          'You define the contract.',
          'The same requirement as before, minus Sendable to keep this console example short.',
          'At file scope; in a real project, Core/Services/WeatherService.swift.',
          'Checked at compile time.',
          'Code that depends on this protocol works with every type that conforms to it.')],
        [r`    func currentTemperature() async throws -> Double`, n(
          'Each conforming type implements it.',
          'Requires an async, throwing method that returns a Double.',
          'Inside the protocol; a requirement has a signature but no body.',
          'Called by summary(from:) each time it runs, twice in this program.',
          'Matching the app\'s real contract means a mock that passes here would also plug into the real view model.')],
        ['}', null],
        ['', null],
        [r`struct MockWeatherService: WeatherService {`, n(
          'You write it for previews and tests; the compiler checks the conformance.',
          'A mock type that promises to meet the WeatherService contract.',
          'File scope; in a real project it often lives in the test target or a Preview Content folder.',
          'Compiled with the program.',
          'A struct is a simple value with no network, no disk and no timing surprises.')],
        [r`    var reading = 21.5`, n(
          'Each mock instance, which stores its own reading.',
          'The temperature the mock will report, with a default.',
          'A stored property; the memberwise initializer accepts reading: as an optional argument.',
          'Set when the mock is created.',
          'A configurable value lets one mock type produce many scenarios: hot, cold or freezing.')],
        [r`    func currentTemperature() async throws -> Double { reading }`, n(
          'The mock, satisfying the protocol.',
          'Returns the stored reading immediately.',
          'Inside the mock, fulfilling the protocol requirement.',
          'Whenever a caller awaits it.',
          'It is still marked async throws to match the contract, even though it never waits or fails.')],
        ['}', null],
        ['', null],
        [r`func summary(from service: any WeatherService) async -> String {`, n(
          'Code that consumes the dependency, playing the view model\'s part.',
          'Takes any conforming service and returns the text to display.',
          'A top-level function, standing in for the view model\'s load().',
          'Each time it is called below.',
          'The parameter type is the protocol, so the caller chooses the implementation. That is dependency injection in one line.')],
        [r`    do {`, n(
          'Swift\'s error-handling syntax, inside summary(from:).',
          'Begins a block that can throw.',
          'Inside summary(from:), around the call that can throw.',
          'Each time summary(from:) is called, twice in this program.',
          'Same shape as the real view model, so the logic you see here is the logic you ship.')],
        [r`        let t = try await service.currentTemperature()`, n(
          'Whichever service was passed in.',
          'Awaits the temperature; here the mock answers instantly.',
          'Inside the do block, the success path.',
          'At each call; execution pauses here until the service answers.',
          'This line cannot tell a mock from a live server, which is the point.')],
        [r`        return "Now: \(t) °C"`, n(
          'summary(from:), producing its result.',
          'Returns formatted text such as "Now: 21.5 °C".',
          'Inside the do block, reached only on success.',
          'After the service returns.',
          'Swift prints whole Doubles with .0, so 30 shows as 30.0. A test would catch that if you wanted "30".')],
        [r`    } catch {`, n(
          'Swift\'s catch clause, paired with the do block in summary(from:).',
          'Handles any thrown error.',
          'Right after the do block, pairing with it.',
          'Only if currentTemperature() throws.',
          'Keeps the function total: it always returns a string.')],
        [r`        return "Could not load weather"`, n(
          'summary(from:), producing its failure result.',
          'Returns the failure message.',
          'Inside the catch block.',
          'Only when the service throws, which this mock never does.',
          'A failing stand-in, built in the next lesson, exercises this branch on purpose.')],
        ['    }', null],
        ['}', null],
        ['', null],
        [r`print(await summary(from: MockWeatherService()))`, n(
          'Top-level code, acting as a preview or a test.',
          'Injects a default mock and prints "Now: 21.5 °C".',
          'Program entry; top-level code may use await directly.',
          'Runs first, producing the first output line.',
          'Choosing the dependency at the call site is what lets tests and previews avoid the network.')],
        [r`print(await summary(from: MockWeatherService(reading: 30)))`, n(
          'Top-level code, acting as a second preview or test.',
          'Injects a mock configured to 30 and prints "Now: 30.0 °C".',
          'The program\'s top level, where await is allowed directly.',
          'Runs second, producing the second output line.',
          'Same consumer, different scenario, no code changes inside summary(from:).')],
      ],
      expect: 'Now: 21.5 °C\nNow: 30.0 °C',
      try: [
        'Add a third line that injects MockWeatherService(reading: -4). Predict the output first.',
        'Write a FailingWeatherService whose method throws, inject it, and make the catch branch print.',
      ],
    },
    {
      kind: 'code',
      title: 'The live implementation',
      intro: `<p>The real service calls the free Open-Meteo forecast API with <code>URLSession</code>. It conforms to the same protocol, so the view model accepts it without a single change. Only this file knows that HTTP and JSON exist.</p>`,
      run: 'static',
      context: r`protocol WeatherService: Sendable {
    func currentTemperature() async throws -> Double
}`,
      lines: [
        [r`import Foundation`, n(
          'The Swift compiler, while it builds the service\'s file.',
          'Imports Foundation for URL, URLSession and JSONDecoder.',
          'Top of the service\'s file.',
          'At compile time, before the app runs.',
          'Networking types live in Foundation; the view model never imports them.')],
        ['', null],
        [r`struct LiveWeatherService: WeatherService {`, n(
          'You write it; the compiler checks it meets the contract.',
          'The production weather source.',
          'File scope, in a Services folder shared by features.',
          'Created once, when the app starts.',
          'A struct with no mutable state is automatically Sendable, which the protocol demands.')],
        [r`    let latitude, longitude: Double`, n(
          'Each service instance, which carries its own coordinates.',
          'The location to ask about, declared as two constants of the same type.',
          'Stored properties; the memberwise initializer takes them as arguments.',
          'Set once, when the composition root creates the service.',
          'Configuration is injected too, so tests could point the service at any place.')],
        [r`    var session: URLSession = .shared`, n(
          'The service holds a URLSession, Foundation\'s HTTP client.',
          'Uses the shared session unless a different one is passed in.',
          'A stored property with a default value.',
          'Set once at creation; the default applies unless a test passes another.',
          'A test can inject a session configured with a fake URLProtocol, so even this live code is testable offline.')],
        ['', null],
        [r`    private struct Reply: Decodable { let current: Current }`, n(
          'JSONDecoder fills it in.',
          'A private type that mirrors the top level of the API\'s JSON.',
          'Nested inside the service, invisible to the rest of the app.',
          'Used only while JSONDecoder converts the downloaded bytes.',
          'The server\'s JSON shape stays an internal detail; the app only ever sees a Double.')],
        [r`    private struct Current: Decodable { let temperature_2m: Double }`, n(
          'JSONDecoder, which matches property names to JSON keys.',
          'Mirrors the "current" object and its temperature_2m field.',
          'Nested inside the service and private, like Reply.',
          'Used only during decoding.',
          'The property name matches the JSON key exactly. Setting keyDecodingStrategy to convertFromSnakeCase would allow a Swift-style name instead.')],
        ['', null],
        [r`    func currentTemperature() async throws -> Double {`, n(
          'The view model calls it through the protocol.',
          'Implements the requirement with a real network request.',
          'Inside LiveWeatherService, fulfilling the protocol.',
          'Each time the view model\'s load() runs.',
          'Same signature as the mock, which is why the two are interchangeable.')],
        [r`        let url = URL(string: "https://api.open-meteo.com/v1/forecast"`, n(
          'Foundation\'s URL parser, through URL(string:).',
          'Starts building the request address from the API\'s base URL.',
          'Inside currentTemperature(), the first step of the request.',
          'On each call, before any network traffic.',
          'Splitting the string over three lines keeps each line short and readable.')],
        [r`            + "?latitude=\(latitude)&longitude=\(longitude)"`, n(
          'String concatenation and interpolation.',
          'Adds the coordinates as query parameters.',
          'Continues the URL expression.',
          'On each call, while the URL string is assembled.',
          'Values come from injected configuration, not hard-coded numbers.')],
        [r`            + "&current=temperature_2m")!`, n(
          'URL(string:), which returns an optional.',
          'Asks only for the current temperature and force-unwraps the URL.',
          'Ends the URL expression.',
          'On each call; a malformed constant would crash at the first run in development.',
          'The force unwrap is acceptable only because this string is a constant you control; never force-unwrap user input.')],
        [r`        let (data, response) = try await session.data(from: url)`, n(
          'URLSession performs the HTTPS request on a background system queue.',
          'Downloads the response body (data) and metadata (response).',
          'Inside the method; the caller\'s thread is free while it waits.',
          'When the server replies, typically within a second.',
          'The async data(from:) API replaces completion handlers and throws on transport errors such as no connection.')],
        [r`        guard (response as? HTTPURLResponse)?.statusCode == 200 else {`, n(
          'Your code, inspecting the reply.',
          'Checks that the server answered with HTTP status 200 OK.',
          'Right after the download.',
          'On every reply, before any decoding.',
          'A server error page is still "data"; checking the status stops you from decoding an error message as weather.')],
        [r`            throw URLError(.badServerResponse)`, n(
          'Your code raising an error.',
          'Throws a standard URLError when the status was not 200.',
          'Inside the guard\'s else branch.',
          'Only when the status code was not 200.',
          'The view model\'s catch turns this into "Could not load weather".')],
        ['        }', null],
        [r`        let reply = try JSONDecoder().decode(Reply.self, from: data)`, n(
          'JSONDecoder, Foundation\'s JSON parser.',
          'Parses the JSON bytes into the private Reply type.',
          'Inside currentTemperature(), after the status check.',
          'After a successful status check.',
          'Decoding throws if the shape is wrong, so malformed data becomes an error, not garbage on screen.')],
        [r`        return reply.current.temperature_2m`, n(
          'The service, handing its answer back through the protocol.',
          'Returns just the number the protocol promised.',
          'Last line of currentTemperature().',
          'After decoding succeeds, as the last step of each call.',
          'The rest of the app sees a Double and never learns what JSON looked like.')],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'code',
      title: 'Choose the implementation at the edges',
      intro: `<p>The <strong>composition root</strong> is the one place where concrete types are chosen. The app injects the live service; the preview injects the mock. <code>WeatherView</code> (a <code>Text</code> that calls <code>load()</code> in <code>.task</code>) is the same in both.</p>`,
      run: 'static',
      context: r`import Observation
import Foundation
protocol WeatherService: Sendable { func currentTemperature() async throws -> Double }
@MainActor @Observable final class WeatherViewModel {
    private let service: any WeatherService
    private(set) var summary = "Not loaded"
    init(service: any WeatherService) { self.service = service }
    func load() async { summary = (try? await service.currentTemperature()).map { "Now: \($0) °C" } ?? "Could not load weather" }
}
struct LiveWeatherService: WeatherService { let latitude, longitude: Double; func currentTemperature() async throws -> Double { 0 } }
struct MockWeatherService: WeatherService { var reading = 21.5; func currentTemperature() async throws -> Double { reading } }
import SwiftUI
struct WeatherView: View {
    let model: WeatherViewModel
    var body: some View { Text(model.summary).task { await model.load() } }
}`,
      lines: [
        [r`import SwiftUI`, n(
          'The Swift compiler, while it builds the app file.',
          'Imports SwiftUI for App, Scene, WindowGroup and #Preview.',
          'Top of StudyBuddyApp.swift, the app\'s entry file.',
          'At compile time, before the app runs.',
          'The app entry point is a SwiftUI type.')],
        ['', null],
        [r`@main`, n(
          'The Swift compiler, which generates the entry point, and iOS, which calls it.',
          'Marks the type below as the program\'s entry point.',
          'On the app struct; exactly one per app.',
          'At launch, iOS starts the app here.',
          'There is no main.swift or storyboard; @main tells Swift where execution begins.')],
        [r`struct StudyBuddyApp: App {`, n(
          'You declare it; SwiftUI runs it.',
          'The app itself, conforming to the App protocol.',
          'File scope, in the app target.',
          'Created once, when iOS launches the app.',
          'The app struct is the natural composition root because everything else is created beneath it.')],
        [r`    @State private var weather = WeatherViewModel(`, n(
          'SwiftUI keeps this model alive for the app\'s lifetime.',
          'Creates the single production view model.',
          'App-level state storage inside StudyBuddyApp, managed by SwiftUI.',
          'Once, at launch; SwiftUI then keeps the instance alive.',
          '@State at the app level means one shared model, not a new one every time a scene is rebuilt.')],
        [r`        service: LiveWeatherService(latitude: 25.77, longitude: -80.19)`, n(
          'The composition root, choosing the concrete type.',
          'Injects the live service configured for Miami.',
          'The initializer argument of WeatherViewModel, inside the App struct.',
          'Once, at launch, before the first screen appears.',
          'This is the only line in the app that names LiveWeatherService. Replacing the weather provider means editing one line.')],
        [r`    )`, n(
          'The Swift compiler, matching the opening parenthesis.',
          'Closes the initializer call.',
          'End of the property declaration.',
          'At compile time; no code runs for punctuation.',
          'Splitting the call keeps the line under the width limit.')],
        ['', null],
        [r`    var body: some Scene {`, n(
          'SwiftUI, which builds the app\'s scenes from it.',
          'Describes the app\'s scenes (windows).',
          'The App protocol\'s requirement.',
          'At launch and when scenes change.',
          'Scenes are to apps what views are to screens.')],
        [r`        WindowGroup {`, n(
          'iOS and SwiftUI, which manage the app\'s windows.',
          'Creates the main window, or several on iPad.',
          'Inside the app\'s body.',
          'At launch, and again if iPadOS opens another window.',
          'WindowGroup is the standard scene for a phone app.')],
        [r`            WeatherView(model: weather)`, n(
          'SwiftUI, which renders the root view.',
          'Shows the weather screen and passes it the live model.',
          'Root view of the window.',
          'At launch, as the window\'s first content.',
          'The view receives its model too; it never creates services itself.')],
        ['        }', null],
        ['    }', null],
        ['}', null],
        ['', null],
        [r`#Preview("Mock data") {`, n(
          'Xcode\'s preview canvas, which compiles and renders it.',
          'Declares a named preview for the same view.',
          'File scope; compiled only for development.',
          'Each time the canvas refreshes.',
          'A named preview lets you keep several scenarios side by side, such as mock, failing and empty.')],
        [r`    let model = WeatherViewModel(service: MockWeatherService())`, n(
          'The preview, acting as a second composition root.',
          'Builds a view model around the mock.',
          'Inside the preview body.',
          'Each time the preview refreshes after an edit.',
          'The preview renders instantly, offline and with predictable data.')],
        [r`    WeatherView(model: model)`, n(
          'SwiftUI, rendering the view inside the canvas.',
          'Renders the unchanged view with mock data.',
          'The preview\'s body, the content the canvas shows.',
          'Each time the preview refreshes.',
          'Same view, different dependency: the payoff of injection.')],
        ['}', null],
      ],
    },
    {
      kind: 'concept',
      title: 'Organize by feature',
      body: `<p>Group files by <strong>feature</strong> (what the user does), not by kind (all views in one folder). When you change "Sessions", everything you need sits together. Shared services and models live in one core area, and tests mirror the app's structure.</p>`,
      points: [
        { term: 'Features/Sessions/', text: 'SessionListView.swift, SessionListViewModel.swift and any views only this feature uses.' },
        { term: 'Features/Spots/', text: 'The map, list and view model for nearby study spots.' },
        { term: 'Core/', text: 'Models (StudySession), Services (WeatherService and its live version) and shared helpers.' },
        { term: 'Resources/', text: 'Assets, the String Catalog (Localizable.xcstrings) and the privacy manifest (PrivacyInfo.xcprivacy).' },
        { term: 'Tests', text: 'A unit-test target (Swift Testing) and a UI-test target (XCTest), each mirroring the feature folders.' },
      ],
      callout: { tone: 'tip', title: 'Rule of thumb', html: `<p>If deleting a feature means hunting through five folders, organize by feature. Xcode 16 and later use folders that stay in sync with disk, so moving a file in Finder or Xcode keeps both views identical.</p>` },
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>Which line belongs in the view model rather than the view?</p>',
          choices: ['<code>Text(model.status).font(.title2)</code>', '<code>logged = min(logged + minutes, goal)</code>', '<code>.buttonStyle(.borderedProminent).padding()</code>', '<code>VStack(spacing: 16) { Text(model.status) }</code>'],
          answer: 1,
          explain: '<p>Capping the total is a business rule, so it belongs in the model where one test covers it. Displaying text, styling a button and stacking views are layout jobs that stay in the view.</p>',
        },
        {
          q: '<p>A <code>FocusModel</code> has a goal of 60. You call <code>log(40)</code>, <code>log(-5)</code>, then <code>log(30)</code>. What does <code>status</code> return?</p>',
          choices: ['"Goal reached"', '"20 min left"', '"-10 min left"', '"25 min left"'],
          answer: 0,
          explain: '<p>40 is logged, -5 is rejected by the guard, and 40 + 30 = 70 is capped at 60, so the goal is reached. "-10 min left" is what you would see without the cap.</p>',
        },
        {
          q: '<p>Why does <code>WeatherViewModel</code> take <code>any WeatherService</code> in its initializer instead of creating <code>LiveWeatherService</code> itself?</p>',
          choices: ['Calls through a protocol are faster than calls on a concrete type', 'Swift forbids a class from creating a struct in its own initializer', 'So tests and previews can inject a mock or failing service', 'So the view can swap the service for another one while running'],
          answer: 2,
          explain: '<p>Injection lets the caller choose the implementation: live in the app, mock in previews, failing in tests. The view never chooses services; the composition root does.</p>',
        },
        {
          q: '<p>Your team adds a "Flashcards" feature. Where should <code>FlashcardDeckViewModel.swift</code> go?</p>',
          choices: ['ViewModels/, next to every other view model in the app', 'Core/Services/', 'Resources/', 'Features/Flashcards/, beside the views it serves'],
          answer: 3,
          explain: '<p>Organizing by feature keeps everything a change touches in one folder. A folder of all view models scatters each feature across the project.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 2: Swift Testing
// ---------------------------------------------------------------------------
const shareFunction = r`func share(of bill: Double, tip: Int, people: Int) -> Double? {
    guard people > 0, bill >= 0 else { return nil }
    let total = bill * (1 + Double(tip) / 100)
    let each = total / Double(people)
    return (each * 100).rounded() / 100
}`;

const weatherContext = r`import Observation
protocol WeatherService: Sendable {
    func currentTemperature() async throws -> Double
}
@MainActor @Observable
final class WeatherViewModel {
    private let service: any WeatherService
    private(set) var summary = "Not loaded"
    init(service: any WeatherService) { self.service = service }
    func load() async {
        summary = "Loading…"
        do {
            let t = try await service.currentTemperature()
            summary = "Now: \(t) °C"
        } catch {
            summary = "Could not load weather"
        }
    }
}
struct MockWeatherService: WeatherService {
    var reading = 21.5
    func currentTemperature() async throws -> Double { reading }
}`;

const testingBasics = {
  id: 'shipping-testing-basics',
  title: 'Testing with Swift Testing',
  steps: [
    {
      kind: 'concept',
      title: 'Verification and validation',
      body: `<p>Testing answers two different questions. <strong>Verification</strong> asks "did we build it right?": does the code do what the requirement says? <strong>Validation</strong> asks "did we build the right thing?": does it actually solve the user's problem?</p><p>Automated tests are verification. They compare behavior with requirements you wrote down, every time you build. Validation needs people: usability sessions, TestFlight feedback and analytics. A perfectly verified feature still fails validation if students never use it.</p>`,
      points: [
        { term: 'Requirement', text: 'When a bill is split, each share includes the tip and is rounded to the cent.' },
        { term: 'Verification', text: 'A unit test checks that a $100 bill with a 20% tip split four ways gives exactly 30.' },
        { term: 'Validation', text: 'Five students split a real dinner bill with the app while you watch where they hesitate.' },
      ],
      callout: { tone: 'tip', title: 'Find bugs early', html: `<p>A bug caught by a test costs seconds. The same bug found in TestFlight costs a new build, and in the App Store it costs a review cycle and one-star reviews. That is why tests run on every build.</p>` },
    },
    {
      kind: 'concept',
      title: 'The testing pyramid',
      body: `<p>Tests differ in speed, cost and what they can catch. The <strong>testing pyramid</strong> recommends many fast unit tests, fewer integration tests and a handful of UI tests for the journeys that matter most.</p><p>Select each layer in the figure, then switch to the ice-cream cone, a suite that leans on UI tests, and compare how long you wait for an answer.</p>`,
      points: [
        { term: 'Unit test', text: 'Checks one function or type in isolation, in milliseconds.' },
        { term: 'Integration test', text: 'Checks real pieces working together, such as a view model with an in-memory store.' },
        { term: 'UI test', text: 'Drives the built app like a person would, through the accessibility layer.' },
      ],
      figure: { widget: 'shipping-test-pyramid', props: {} },
    },
    {
      kind: 'code',
      title: 'Your first tests',
      intro: `<p>Swift Testing marks tests with <code>@Test</code> and checks results with <code>#expect</code>. In a real project the function lives in the app target and tests sit in a separate test target that starts with <code>@testable import StudyBuddy</code>. Here both share one file. Press Command-U in Xcode to run every test.</p>`,
      run: 'swifttest',
      expectTests: 2,
      lines: [
        [r`import Testing`, n(
          'The compiler, building the test target.',
          'Imports Swift Testing, the framework that provides @Test, #expect and #require.',
          'Top of the test file; test targets link the framework automatically in Xcode 16 and later.',
          'At compile time, when Xcode builds the test target.',
          'Swift Testing is the modern framework for unit tests. XCTest remains for UI tests and older code.')],
        ['', null],
        [r`func share(of bill: Double, tip: Int, people: Int) -> Double? {`, n(
          'App code, the code under test.',
          'Declares a function that returns one person\'s share, or nil for invalid input.',
          'Normally in the app target; shown here so the example is complete.',
          'Called once by each test that exercises it.',
          'Returning an optional makes "invalid input" a value the caller must handle and a test can check.')],
        [r`    guard people > 0, bill >= 0 else { return nil }`, n(
          'The function, validating its input.',
          'Returns nil for zero or negative people, or a negative bill.',
          'First line of the function.',
          'On every call, before any arithmetic happens.',
          'Two separate conditions means two behaviors worth a test each.')],
        [r`    let total = bill * (1 + Double(tip) / 100)`, n(
          'share(of:tip:people:), doing the arithmetic.',
          'Adds the tip, converting the whole-number percent into a fraction.',
          'Inside the function, after the guard.',
          'Only for input that passed the guard.',
          'Double(tip) is required because Swift never mixes Int and Double silently.')],
        [r`    let each = total / Double(people)`, n(
          'share(of:tip:people:), still on valid input.',
          'Divides the total among the people.',
          'Inside the function, on the line after the tip.',
          'After the tip has been added to the bill.',
          'Splitting after tipping is the requirement; doing it the other way round is a classic bug.')],
        [r`    return (each * 100).rounded() / 100`, n(
          'The function, using Double\'s rounding.',
          'Rounds the share to the nearest cent, so 6.666 becomes 6.67.',
          'Last line of the function.',
          'Last, for valid input only; invalid input already returned nil.',
          'Rounding is a requirement too; without it equality checks on money fail on tiny binary fractions.')],
        ['}', null],
        ['', null],
        [r`@Test func splitsTotalWithTip() {`, n(
          'The @Test macro, which registers the function with the test runner.',
          'Declares a test; its name describes the behavior it checks.',
          'Global function in the test file; tests can also live inside a type.',
          'Discovered at build time and run when you press Command-U or click the diamond in the gutter.',
          'A name that reads like a sentence tells you what broke when it turns red, without opening the file.')],
        [r`    #expect(share(of: 100, tip: 20, people: 4) == 30)`, n(
          'The #expect macro, evaluated by the test runner.',
          'Checks that $100 plus 20%, split four ways, is exactly 30.',
          'Inside splitsTotalWithTip(), its only statement.',
          'When the runner executes this test.',
          'If it fails, #expect records the actual value of each side, such as "→ 525.0", so you see why, not just that it failed.')],
        ['}', null],
        ['', null],
        [r`@Test func rejectsZeroPeople() {`, n(
          'The @Test macro, registering a second test.',
          'Declares a second test for the invalid-input branch.',
          'A global function in the test file.',
          'Runs in parallel with the other tests by default.',
          'Every branch of the guard deserves its own test, because each can break independently.')],
        [r`    #expect(share(of: 50, tip: 10, people: 0) == nil)`, n(
          'The #expect macro, comparing the result with nil.',
          'Checks that splitting among zero people returns nil instead of a number.',
          'Inside rejectsZeroPeople(), its only statement.',
          'When the runner executes this test.',
          'Without the guard, 55 divided by 0 is infinity, a value that would appear on screen as "inf".')],
        ['}', null],
      ],
      try: [
        'Change 30 to 25 in the first test. Read the failure message: which value does it show for the left side?',
        'Add a test that a negative bill returns nil.',
      ],
    },
    {
      kind: 'code',
      title: 'Suites, readable names and #require',
      intro: `<p>A <code>@Suite</code> groups related tests under one heading in the Test navigator. Display names describe behavior in plain words. <code>#require</code> unwraps an optional and stops the test immediately if it is <code>nil</code>, so later lines never run on bad data. The <code>share</code> function from the previous step is compiled with this file.</p>`,
      run: 'swifttest',
      expectTests: 2,
      context: shareFunction,
      lines: [
        [r`import Testing`, n(
          'The Swift compiler, building the test target.',
          'Imports Swift Testing for @Suite, @Test, #expect and #require.',
          'Top of the test file.',
          'At compile time, when the test target builds.',
          'Every test file imports it.')],
        ['', null],
        [r`@Suite("Splitting a bill")`, n(
          'The @Suite macro, read by Xcode\'s test discovery.',
          'Gives the type below a readable name in Xcode\'s Test navigator and in reports.',
          'Attached to the struct on the next line.',
          'Read when tests are discovered.',
          'Grouping by behavior makes a long list of tests scannable, and you can run one suite on its own.')],
        [r`struct BillSplitTests {`, n(
          'You declare it; the runner creates a fresh instance for every test.',
          'A struct that holds related tests.',
          'Test target, file scope.',
          'A new instance is made before each test runs.',
          'A fresh instance per test means tests cannot leak state into each other, which keeps them isolated and repeatable.')],
        [r`    @Test("Zero tip splits only the bill")`, n(
          'The @Test macro with a display name.',
          'Registers the method below and shows this sentence instead of the method name.',
          'Inside the suite, attached to the method below.',
          'Read at discovery, when Xcode builds the list of tests.',
          'A display name can include spaces and punctuation, so the report reads like a specification.')],
        [r`    func zeroTip() throws {`, n(
          'The test runner calls it.',
          'A test method that is allowed to throw.',
          'An instance method of the suite.',
          'When the runner executes this test, on a fresh suite instance.',
          'throws is required because #require throws to stop the test early.')],
        [r`        let each = try #require(share(of: 90, tip: 0, people: 3))`, n(
          'The #require macro, which throws on failure.',
          'Unwraps the optional result; if it is nil, records a failure and ends the test right here.',
          'First line of zeroTip().',
          'As soon as the test starts.',
          'The next lines need a real number. Stopping early avoids confusing follow-on failures and force-unwrap crashes.')],
        [r`        #expect(each == 30)`, n(
          'The #expect macro, comparing the share with 30.',
          'Checks the unwrapped share is 30.',
          'Inside the test, after the unwrap.',
          'Only if #require succeeded.',
          'Unlike #require, a failing #expect records the problem and keeps going, so you see every failure at once.')],
        [r`        #expect(each * 3 == 90)`, n(
          'The #expect macro, checking a property of the result.',
          'Checks the shares add back up to the bill.',
          'Inside zeroTip(), the last check.',
          'After the first expectation, pass or fail.',
          'Checking a property (shares sum to the total) catches bugs that a single example might miss.')],
        ['    }', null],
        ['', null],
        [r`    @Test("Shares round to the nearest cent")`, n(
          'The @Test macro, registering the rounding test.',
          'Names the rounding behavior.',
          'Inside the suite, attached to the method below.',
          'Read at discovery, when Xcode lists the tests.',
          'Each requirement gets its own test, so a failure points at exactly one rule.')],
        [r`    func roundsToCents() {`, n(
          'The test runner, which calls it on a fresh suite instance.',
          'A test that cannot throw, because it uses only #expect.',
          'An instance method of the suite.',
          'When the runner executes this test, possibly in parallel with zeroTip().',
          'Only mark a test throws when it really calls something that throws.')],
        [r`        #expect(share(of: 20, tip: 0, people: 3) == 6.67)`, n(
          'The #expect macro, comparing the share with 6.67.',
          'Checks that $20 split three ways rounds 6.666… up to 6.67.',
          'Inside roundsToCents(), its only statement.',
          'When this test runs.',
          'Choosing an input that needs rounding up catches a function that truncates instead of rounding.')],
        ['    }', null],
        ['}', null],
      ],
      try: [
        'Change people to 0 in the #require line. How many failures are reported, and why not three?',
      ],
    },
    {
      kind: 'code',
      title: 'One test, many inputs',
      intro: `<p>A <strong>parameterized test</strong> runs the same check for every element of <code>arguments</code>. Each element becomes its own test case, reported separately with its inputs, so one bad row never hides the others. Adding a case is one line of data instead of a new function.</p>`,
      run: 'swifttest',
      expectTests: 7,
      context: shareFunction,
      lines: [
        [r`import Testing`, n(
          'The Swift compiler, building the test target.',
          'Imports Swift Testing for @Test and #expect.',
          'Top of the test file.',
          'At compile time, before the parameterized tests are discovered.',
          'Parameterized tests use the same @Test macro, with an arguments label added.')],
        ['', null],
        [r`@Test("Each share includes the tip", arguments: [`, n(
          'The @Test macro, given a collection of inputs.',
          'Declares a parameterized test and starts the list of cases.',
          'Global test function in the test target.',
          'At discovery, the runner creates one test case per element.',
          'A table of cases states the requirement as data, which is easier to review than four near-identical functions.')],
        [r`    (bill: 100.0, tip: 20, people: 4, expected: 30.0),`, n(
          'The test runner passes this tuple to the function.',
          'The standard case: 100 plus 20%, split four ways, is 30.',
          'First element of the arguments array.',
          'Run as its own test case.',
          'Labels make each row self-explanatory; they line up with the parameter names below.')],
        [r`    (bill: 60.0, tip: 15, people: 2, expected: 34.5),`, n(
          'The test runner, which passes this tuple to the function.',
          'A case with an odd percentage: 69 split two ways is 34.5.',
          'Second element of the arguments array.',
          'Run as its own case, in parallel with the others.',
          'Different numbers exercise the percent-to-fraction conversion, where a bug would show up.')],
        [r`    (bill: 10.0, tip: 0, people: 3, expected: 3.33),`, n(
          'The test runner, which passes this tuple to the function.',
          'A case that needs rounding down: 3.333… becomes 3.33.',
          'Third element of the arguments array.',
          'Runs as its own separately reported test case.',
          'Pairs with the earlier rounding-up test, so both directions are covered.')],
        [r`    (bill: 0.0, tip: 18, people: 5, expected: 0.0),`, n(
          'The test runner, which passes this tuple to the function.',
          'A boundary case: a zero bill is valid and gives zero.',
          'Fourth and last element of the arguments array.',
          'Runs as its own separately reported test case.',
          'Boundary values (zero, one, the maximum) are where off-by-one and validation bugs hide.')],
        [r`])`, n(
          'The Swift compiler, matching the brackets.',
          'Closes the arguments array and the @Test attribute.',
          'End of the @Test attribute, just above the function it marks.',
          'At compile time; the macro reads the whole list then.',
          'The trailing comma on the last row is legal Swift and makes adding a row a one-line change.')],
        [r`func shareIncludesTip(bill: Double, tip: Int, people: Int,`, n(
          'The test runner calls it once per case.',
          'Declares parameters that receive each tuple\'s values in order.',
          'A global function in the test file, marked by the attribute above.',
          'Four times, once per row.',
          'Parameter types must match the tuple elements or the macro reports a compile error.')],
        [r`                      expected: Double) {`, n(
          'The Swift compiler, reading the rest of the signature.',
          'Finishes the parameter list with the expected result.',
          'Continuation of the signature, aligned for readability.',
          'At compile time; the macro checks it against the tuple type.',
          'Passing the expected value as data keeps the assertion line identical for every case.')],
        [r`    #expect(share(of: bill, tip: tip, people: people) == expected)`, n(
          'The #expect macro, run once for every row.',
          'Compares each computed share with that row\'s expected value.',
          'Body of the parameterized test.',
          'Once per case: four times in total.',
          'A failure report names the exact arguments, such as bill → 60.0, so you know which row broke.')],
        ['}', null],
        ['', null],
        [r`@Test("Invalid party sizes are rejected", arguments: [0, -1, -12])`, n(
          'The @Test macro with a simple array.',
          'Runs the test three times, once for each bad party size.',
          'A global test function, below the first one.',
          'Three cases at discovery.',
          'A single parameter needs no tuple; any collection of Sendable values works.')],
        [r`func rejectsBadPeople(people: Int) {`, n(
          'The test runner, which calls it once per argument.',
          'Receives one party size per case.',
          'A global function marked by the attribute above.',
          'Three times: with 0, then -1, then -12.',
          'Testing several invalid values guards against a check like people != 0 that lets -1 through.')],
        [r`    #expect(share(of: 50, tip: 10, people: people) == nil)`, n(
          'The #expect macro, run once for every argument.',
          'Expects nil for every invalid party size.',
          'The body of rejectsBadPeople(people:), its only statement.',
          'Once per case: three times in total.',
          'The same expectation over many inputs documents the whole invalid range, not one example.')],
        ['}', null],
      ],
      try: [
        'Add a row (bill: 45.0, tip: 10, people: 3, expected: 16.5) and predict whether it passes.',
        'Change -1 to 1 in the second test. Which case fails, and what does its failure message name?',
      ],
    },
    {
      kind: 'widget',
      title: 'Bug lab: what do your tests catch?',
      intro: `<p>Here is the same <code>share</code> function with its test suite. Switch on one bug at a time and watch which tests turn red and what each failure message reports. Then turn on bug D by itself: every test stays green. Finish by choosing the expectation that would have caught it.</p>`,
      widget: 'shipping-test-lab',
      props: {},
    },
    {
      kind: 'code',
      title: 'Test a view model with stand-ins',
      intro: `<p>The <code>WeatherViewModel</code>, its protocol and <code>MockWeatherService</code> from the architecture lesson are compiled with this file. A failing stand-in drives the error branch on purpose. These tests run in milliseconds, offline, with the same result every time.</p>`,
      run: 'swifttest',
      expectTests: 2,
      context: weatherContext,
      lines: [
        [r`import Testing`, n(
          'The Swift compiler, building the test target.',
          'Imports Swift Testing for @Test and #expect.',
          'Top of the test file.',
          'At compile time, before the suite is discovered.',
          'The view-model tests use @Test and #expect like the pure-function tests; only the setup differs.')],
        ['', null],
        [r`struct FailingWeatherService: WeatherService {`, n(
          'You write it in the test target.',
          'A stand-in that always fails, conforming to the same protocol as the live service.',
          'File scope in the tests; the app never ships it.',
          'Created inside the failure test, then thrown away when it ends.',
          'Real outages are rare and random. A stand-in makes the failure path happen on demand.')],
        [r`    struct Offline: Error {}`, n(
          'Swift\'s error-handling system, which accepts any Error type.',
          'Declares a tiny error type to throw.',
          'Nested inside the stand-in.',
          'Defined at compile time; an instance is created on each throw.',
          'Any type that conforms to Error can be thrown; an empty struct is enough for a test.')],
        [r`    func currentTemperature() async throws -> Double {`, n(
          'The view model calls it through the protocol.',
          'Implements the protocol requirement for the failing stand-in.',
          'Inside the failing stand-in, fulfilling the protocol.',
          'When load() runs in the test.',
          'Matching the signature is what makes this type injectable.')],
        [r`        throw Offline()`, n(
          'The failing stand-in, raising the error.',
          'Throws immediately instead of returning a temperature.',
          'The method\'s only statement.',
          'On every call, with no delay.',
          'Simulates no connection without touching Wi-Fi settings.')],
        ['    }', null],
        ['}', null],
        ['', null],
        [r`@MainActor`, n(
          'The Swift compiler, which enforces actor isolation.',
          'Runs every test in this suite on the main actor.',
          'Attribute on the suite, so it applies to every test inside.',
          'Enforced at compile time; applied when tests run.',
          'WeatherViewModel is main-actor isolated, so tests that touch it must be too.')],
        [r`struct WeatherViewModelTests {`, n(
          'The test runner, which discovers the @Test methods inside.',
          'A suite for the view model; without @Suite its name is the type name.',
          'The test target, at file scope.',
          'A new instance per test.',
          '@Suite is optional; any type containing @Test methods is a suite.')],
        [r`    @Test func showsReadingFromService() async {`, n(
          'The test runner, which awaits the async method.',
          'An async test for the success path.',
          'Inside WeatherViewModelTests, the first test method.',
          'When the runner executes it, on the main actor.',
          'Tests can be async, so you await the real load() rather than sleeping and hoping.')],
        [r`        let model = WeatherViewModel(service: MockWeatherService())`, n(
          'The test, acting as composition root.',
          'Builds the view model around the mock that reports 21.5.',
          'First line of the success test.',
          'At the start of the test.',
          'Arrange: set up exactly the world this test needs and nothing more.')],
        [r`        await model.load()`, n(
          'The view model, running its real load() logic.',
          'Runs the real load logic against the mock.',
          'Second line of the success test.',
          'After the view model is created; the test waits here until load() finishes.',
          'Act: perform the one behavior under test. await finishes only when load() has completed.')],
        [r`        #expect(model.summary == "Now: 21.5 °C")`, n(
          'The #expect macro, reading the observable property.',
          'Checks the exact text the screen will show.',
          'Last line of the success test.',
          'After load() has returned.',
          'Assert: verify the outcome. Testing the summary string verifies the formatting rule too.')],
        ['    }', null],
        ['', null],
        [r`    @Test func showsMessageWhenServiceFails() async {`, n(
          'The test runner, which awaits the async method.',
          'An async test for the failure path.',
          'Inside the suite, below the success test.',
          'When run, possibly in parallel with the first test.',
          'Error paths are where real users get stuck, so they deserve their own tests.')],
        [r`        let model = WeatherViewModel(service: FailingWeatherService())`, n(
          'The test, acting as its own composition root.',
          'Injects the failing stand-in instead of the mock.',
          'First line of the failure test.',
          'At the start of the failure test.',
          'Only the injected dependency differs between the two tests.')],
        [r`        await model.load()`, n(
          'The view model, whose catch block now runs.',
          'Calls the service, which throws, so the catch branch runs.',
          'Second line of the failure test.',
          'After setup; the error never escapes load().',
          'The view model handles the error itself; the test only observes the result.')],
        [r`        #expect(model.summary == "Could not load weather")`, n(
          'The #expect macro, reading the failure message.',
          'Checks the friendly failure message appears.',
          'Last line of the failure test.',
          'After load() has returned.',
          'If someone later deletes the catch block, this test fails before users see a blank card.')],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'concept',
      title: 'The test-driven loop',
      body: `<p><strong>Test-driven development</strong> (TDD) writes the test before the code. Each loop is small: one behavior at a time. The failing test proves the test can fail, the passing test proves the code works, and the suite becomes a safety net for every later change.</p><p>Good unit tests are <strong>F.I.R.S.T.</strong>: fast, isolated (no shared state), repeatable (same result every run), self-validating (pass or fail with no reading of logs) and timely (written with the code, not months later).</p>`,
      points: [
        { term: 'Red', text: 'Write a test for the next small behavior. Run it and watch it fail.' },
        { term: 'Green', text: 'Write the simplest code that makes it pass. No extra features.' },
        { term: 'Refactor', text: 'Clean up names and duplication while the tests stay green.' },
      ],
      callout: { tone: 'tip', title: 'In Xcode', html: `<p>Command-U runs every test. The diamond beside a test runs just that one. Command-6 opens the Test navigator, where red marks failures. A breakpoint in a test pauses it like app code.</p>` },
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>Every unit test passes, but in a hallway session three of five students cannot find how to start a study session. What kind of problem is this?</p>',
          choices: ['A verification failure: the tests check the wrong thing', 'A validation finding: the app misses a real need', 'An integration failure between the view and the view model', 'A flaky test that passes only on some machines'],
          answer: 1,
          explain: '<p>Tests verified that the code matches its specification. Watching real users is validation, and it found that the specification itself misses a need. Neither the tests nor the integration are broken.</p>',
        },
        {
          q: '<p>A test runs <code>let each = try #require(share(of: 90, tip: 0, people: 0))</code> followed by two <code>#expect</code> lines. How many issues are recorded?</p>',
          choices: ['Three: #require and both #expect lines fail', 'Two: #require passes and both #expect lines fail', 'Zero: #require only warns, and the #expect lines pass', 'One: #require fails and ends the test'],
          answer: 3,
          explain: '<p><code>share</code> returns nil for zero people. <code>#require</code> records one issue and throws, so the expectations below never run. That is its job: stop before later lines work on bad data.</p>',
        },
        {
          q: '<p>In the bug lab, bug D (negative bills allowed) left all four tests green. What does a green suite prove?</p>',
          choices: ['The function has no bugs, because every test exercised it', 'The tests are poorly written and should be replaced', 'The function is correct for the cases the tests check, and nothing more', 'Bug D cannot affect real users, because the tests cover the real inputs'],
          answer: 2,
          explain: '<p>Tests only check what they ask about. No test tried a negative bill, so the bug was invisible. Adding the missing edge case turns it red.</p>',
        },
        {
          q: '<p><code>@Test(arguments: [0, -1, -12])</code> marks a test that receives one <code>Int</code>. How does Xcode report it?</p>',
          choices: ['As three separate test cases, each showing its argument', 'As one test that stops at the first failing value', 'As three copies of the test function you must write', 'It does not compile, because arguments must be tuples'],
          answer: 0,
          explain: '<p>Each argument becomes its own test case with its value in the report, and the cases can run in parallel. A failing value never hides the others.</p>',
        },
        {
          q: '<p>A view-model test calls the live weather API and fails some mornings when the network is slow. What is the best fix?</p>',
          choices: ['Retry the test up to three times before reporting a failure', 'Inject a mock service so the test never touches the network', 'Add a two-second sleep before the expectation', 'Move the test to the UI-test target, which allows slow tests'],
          answer: 1,
          explain: '<p>A unit test must be fast and repeatable. Injecting a stand-in removes the network, so the result depends only on your code. Retries and sleeps hide the flakiness without curing it.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 3: UI tests, previews and accessibility checks
// ---------------------------------------------------------------------------
const storeContext = r`import Foundation
import Observation
@Observable final class SessionStore {
    private(set) var titles: [String]
    init(titles: [String]) { self.titles = titles }
    func add(_ title: String) { titles.insert(title, at: 0) }
}`;

const listContext = storeContext + '\n' + r`import SwiftUI
struct NewSessionView: View {
    let store: SessionStore
    var body: some View { Text("New") }
}
struct SessionListView: View {
    let store: SessionStore
    @State private var isAdding = false
    var body: some View {
        NavigationStack {
            List(store.titles, id: \.self) { Text($0) }
                .navigationTitle("Sessions")
                .toolbar {
                    Button("Add Session", systemImage: "plus") { isAdding = true }
                        .accessibilityIdentifier("addSessionButton")
                }
                .sheet(isPresented: $isAdding) { NewSessionView(store: store) }
        }
    }
}`;

const uiTesting = {
  id: 'shipping-ui-testing',
  title: 'UI Tests, Previews and Accessibility Checks',
  steps: [
    {
      kind: 'concept',
      title: 'How a UI test sees your app',
      body: `<p>A <strong>UI test</strong> launches your real app in the simulator and drives it from a separate process, the test runner. It cannot call your functions or read your variables. It sees only what VoiceOver sees: the <strong>accessibility tree</strong>, a list of elements with a type (button, text field), a label and an identifier.</p><p>A UI test finds elements with <strong>queries</strong> such as <code>app.buttons["addSessionButton"]</code>, then taps, types and swipes like a person. Each test takes seconds, so save UI tests for journeys that must never break.</p>`,
      points: [
        { term: 'Good at', text: 'Proving that critical journeys work end to end: launch, add a session, see it in the list.' },
        { term: 'Poor at', text: 'Checking business rules, every edge case or exact pixels. Unit tests and previews do those better.' },
      ],
      callout: { tone: 'ecosystem', title: 'Two frameworks, one project', html: `<p>Swift Testing does not drive user interfaces. UI tests use XCTest's <code>XCUIApplication</code> in a separate UI-testing target. Both frameworks live happily in one project.</p>` },
    },
    {
      kind: 'code',
      title: 'Give elements stable identifiers',
      intro: `<p>An <strong>accessibility identifier</strong> is a name only tests can see. Unlike the visible label, it does not change when you translate the app or reword a button. This sheet tags its text field and Save button; the list screen's plus button gets <code>addSessionButton</code> the same way.</p>`,
      run: 'static',
      context: storeContext,
      lines: [
        [r`import SwiftUI`, n(
          'The Swift compiler, building the app target.',
          'Imports SwiftUI for Form, TextField, Button and modifiers.',
          'Top of the view\'s file.',
          'At compile time, before NewSessionView can be built.',
          'Identifiers are ordinary SwiftUI modifiers; no test framework is imported into the app.')],
        ['', null],
        [r`struct NewSessionView: View {`, n(
          'You declare it; SwiftUI presents it as a sheet.',
          'The form for adding a study session.',
          'In the app target, under Features/Sessions/.',
          'Created when the user taps the plus button.',
          'A small, focused view is easy to tag and easy to test.')],
        [r`    let store: SessionStore`, n(
          'The list screen passes it in.',
          'The shared store that receives the new session.',
          'A stored property of the view.',
          'Set when the sheet is created.',
          'Injecting the store means a test or preview can supply a seeded or empty one.')],
        [r`    @Environment(\.dismiss) private var dismiss`, n(
          'SwiftUI provides it from the environment.',
          'An action that closes the sheet.',
          'Inside the view, read from the environment SwiftUI passes down.',
          'Read when the view is built; called after saving.',
          'The sheet closes itself without knowing who presented it.')],
        [r`    @State private var title = ""`, n(
          'SwiftUI, which keeps the value alive between redraws.',
          'The text the user is typing, starting empty.',
          'View state owned by this sheet only.',
          'Changes on each keystroke.',
          'Local, temporary input belongs in @State, not in the shared store.')],
        ['', null],
        [r`    var body: some View {`, n(
          'SwiftUI, which calls it to describe the sheet.',
          'Describes the sheet\'s form.',
          'The View protocol\'s only requirement.',
          'On appearance and each keystroke.',
          'Each redraw also refreshes the accessibility tree that UI tests read.')],
        [r`        Form {`, n(
          'SwiftUI, which styles the container as a grouped list.',
          'Groups the controls in the standard grouped style.',
          'Root of the sheet\'s content.',
          'On each redraw, including after every keystroke.',
          'Standard containers give correct accessibility behavior for free.')],
        [r`            TextField("Title", text: $title)`, n(
          'SwiftUI, and the user typing.',
          'A text field whose placeholder (and accessibility label) is "Title".',
          'First row of the form.',
          'Updates title on every keystroke through the binding.',
          'The label "Title" will become "Título" in Spanish, which is why tests should not search for it.')],
        [r`                .accessibilityIdentifier("sessionTitleField")`, n(
          'SwiftUI, writing into the accessibility tree.',
          'Attaches an identifier that tests can query: app.textFields["sessionTitleField"].',
          'Modifier on the text field.',
          'Applied on every render; invisible to users and VoiceOver.',
          'An identifier is a contract with your tests that survives translation and copy edits.')],
        [r`            Button("Save") {`, n(
          'The user taps; SwiftUI runs the closure.',
          'A button labeled Save; the label is also its accessibility label.',
          'Second row of the form.',
          'Its action runs when the user (or a UI test) taps it.',
          'A clear verb as the label helps VoiceOver users; the identifier below helps tests.')],
        [r`                store.add(title)`, n(
          'The shared SessionStore, through its add(_:) method.',
          'Adds the new title to the top of the list.',
          'Inside the button\'s action.',
          'On tap, before the sheet closes.',
          'The view forwards the intent; the store owns the data.')],
        [r`                dismiss()`, n(
          'SwiftUI, through the dismiss action from the environment.',
          'Closes the sheet and returns to the list.',
          'Inside the action, after saving.',
          'On tap, right after the store is updated.',
          'The UI test will look for the new row on the list after this.')],
        ['            }', null],
        [r`            .disabled(title.isEmpty)`, n(
          'SwiftUI, which grays out the button and ignores taps.',
          'Dims the button and blocks taps until something is typed.',
          'Modifier on the Save button.',
          'Re-evaluated on each keystroke.',
          'Prevents empty sessions. A unit test on the store could check this rule too.')],
        [r`            .accessibilityIdentifier("saveSessionButton")`, n(
          'SwiftUI, writing into the accessibility tree.',
          'Tags the button for app.buttons["saveSessionButton"].',
          'Modifier on the Save button.',
          'Applied on every render.',
          'Identifiers use lowerCamelCase names that describe purpose, not appearance.')],
        ['        }', null],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'code',
      title: 'Known data through launch arguments',
      intro: `<p>A UI test must start from data it knows, not whatever was left in the simulator. The test passes a <strong>launch argument</strong>, a string handed to the app at launch, and the app checks for it before choosing its data.</p>`,
      run: 'static',
      lines: [
        [r`import Foundation`, n(
          'The Swift compiler, building the store\'s file.',
          'Imports Foundation for ProcessInfo.',
          'Top of the store\'s file.',
          'At compile time, before the store\'s file can use ProcessInfo.',
          'Launch arguments are read through Foundation.')],
        [r`import Observation`, n(
          'The Swift compiler, building the store\'s file.',
          'Imports the @Observable macro.',
          'Top of the store\'s file, after Foundation.',
          'At compile time, before the @Observable macro can expand.',
          'The store is observable so the list redraws when a session is added.')],
        ['', null],
        [r`@Observable final class SessionStore {`, n(
          'You declare it; the app creates one.',
          'The shared, observable list of session titles.',
          'In Core/Models/, shared by every feature.',
          'Created once at launch by forCurrentLaunch().',
          'One store shared by the list and the sheet keeps both screens consistent.')],
        [r`    private(set) var titles: [String]`, n(
          'The store, which owns every write.',
          'The session titles, newest first.',
          'A tracked stored property of the store.',
          'Read by the list on each redraw.',
          'A real app would store full StudySession models in SwiftData; strings keep this example short.')],
        ['', null],
        [r`    init(titles: [String]) { self.titles = titles }`, n(
          'Callers that create a store.',
          'Accepts the starting titles.',
          'The store\'s only initializer.',
          'Once, whenever a store is created.',
          'Seeding through init makes every scenario (empty, seeded, huge) one line in a test or preview.')],
        ['', null],
        [r`    func add(_ title: String) {`, n(
          'The sheet\'s Save button.',
          'Declares the method that adds a session title.',
          'An instance method of the store.',
          'Each time the user taps Save on the sheet.',
          'All writes go through one method.')],
        [r`        titles.insert(title, at: 0)`, n(
          'The store, changing its own array.',
          'Puts the new title first.',
          'Inside add(_:), its only statement.',
          'On each save; the list redraws right after.',
          'Newest first is a product decision that a unit test can pin down.')],
        ['    }', null],
        ['', null],
        [r`    static func forCurrentLaunch() -> SessionStore {`, n(
          'The app\'s entry point calls it once.',
          'Chooses which store this launch should use.',
          'A static factory on the type.',
          'Once, at app launch, before the first screen appears.',
          'Keeping the decision in one function makes the test hook easy to find and audit.')],
        [r`        let arguments = ProcessInfo.processInfo.arguments`, n(
          'iOS, which passes the launch arguments to the process.',
          'Reads the array of strings the app was launched with.',
          'First line of the factory.',
          'Once, at launch, when forCurrentLaunch() runs.',
          'XCUIApplication.launchArguments ends up here, so the test controls the app\'s starting state.')],
        [r`        if arguments.contains("-ui-testing") {`, n(
          'The app, deciding which data to start with.',
          'Checks whether a UI test launched it.',
          'Inside the factory, after reading the arguments.',
          'Once, at launch, right after the arguments are read.',
          'Users never pass this flag, so normal launches are unaffected.')],
        [r`            return SessionStore(titles: ["Algebra review",`, n(
          'The factory, building the test store.',
          'Starts building a store seeded with known sessions.',
          'The testing branch of the if statement.',
          'Only when the flag is present.',
          'Tests can now assert on exact rows such as "Algebra review".')],
        [r`                                         "Biology flashcards"])`, n(
          'The Swift compiler, reading the continued argument.',
          'Finishes the two-item seed list.',
          'Continuation of the call.',
          'At launch, testing branch only.',
          'Seed data lives in memory only, so tests never touch or delete a real user\'s data.')],
        ['        }', null],
        [r`        return SessionStore(titles: [])`, n(
          'The factory, building the normal store.',
          'Returns an empty store for a normal launch.',
          'The normal branch, after the if statement.',
          'Every launch without the flag.',
          'A real app would load saved data here instead.')],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'code',
      title: 'Write the UI test',
      intro: `<p>This XCTest UI test performs one complete journey: launch with known data, open the sheet, type a title, save, and wait for the new row. Test methods start with <code>test</code>. Every query uses an identifier, so the test survives translation and redesign.</p>`,
      run: 'static',
      lines: [
        [r`import XCTest`, n(
          'The compiler, building the UI-testing target.',
          'Imports XCTest, which provides XCUIApplication and assertions.',
          'Top of a file in the UI-test target, not the app.',
          'At compile time, when the UI-test target builds.',
          'UI tests are an XCTest feature; Swift Testing covers unit and integration tests.')],
        ['', null],
        [r`final class SessionFlowUITests: XCTestCase {`, n(
          'XCTest discovers subclasses of XCTestCase.',
          'Declares a class that groups UI tests for the sessions journey.',
          'In the UI-test target, a separate bundle from the app.',
          'Instantiated by the runner for each test method.',
          'Naming the class after the journey makes failures easy to locate.')],
        [r`    @MainActor`, n(
          'The Swift compiler, which enforces actor isolation.',
          'Runs the test on the main actor.',
          'Attribute on the test method.',
          'Checked at compile time.',
          'XCUIApplication APIs are main-actor isolated in current SDKs.')],
        [r`    func testAddingASessionShowsItInTheList() throws {`, n(
          'XCTest finds methods whose names begin with test.',
          'Declares one UI test with a sentence-like name.',
          'Inside the test class.',
          'When you run the UI-test target or click its diamond.',
          'The name states the expected behavior, so a failure reads like a broken requirement.')],
        [r`        let app = XCUIApplication()`, n(
          'XCTest, the testing framework.',
          'Creates a proxy for the app under test; it does not launch yet.',
          'Inside the test, in the runner process.',
          'At the start of the test.',
          'The test talks to the app through this proxy, never through your Swift types.')],
        [r`        app.launchArguments = ["-ui-testing"]`, n(
          'The test, configuring the launch.',
          'Passes the flag the store checks for.',
          'On the proxy, before launch.',
          'Once per test, before every launch.',
          'Known starting data makes the test repeatable on any simulator.')],
        [r`        app.launch()`, n(
          'XCTest and the simulator.',
          'Installs and starts the app, then waits until it is idle.',
          'The simulator, in the app\'s own process.',
          'Takes a second or more; the test waits until the app is idle.',
          'A fresh launch per test isolates tests from each other.')],
        ['', null],
        [r`        app.buttons["addSessionButton"].tap()`, n(
          'XCTest, querying the accessibility tree.',
          'Finds the button with that identifier and taps it.',
          'Runs against the app\'s current screen.',
          'Right after the app finishes launching.',
          'If no element matches, the test fails with a "No matches found" error at this line.')],
        [r`        let title = app.textFields["sessionTitleField"]`, n(
          'XCTest, building a query.',
          'Creates a query for the sheet\'s text field.',
          'Inside the test, in the runner process.',
          'Resolved lazily, when it is used.',
          'Queries are descriptions, re-evaluated each time, so they stay valid after the screen changes.')],
        [r`        title.tap()`, n(
          'XCTest, acting like a finger on the screen.',
          'Taps the field so the keyboard appears.',
          'On the New Session sheet.',
          'After the sheet has opened.',
          'Typing requires keyboard focus, exactly as for a person.')],
        [r`        title.typeText("Chemistry quiz prep")`, n(
          'XCTest, via the simulated keyboard.',
          'Types the title one character at a time.',
          'Into the field that has keyboard focus.',
          'Right after the field is tapped.',
          'Real typing exercises the binding and the disabled-until-typed rule on Save.')],
        [r`        app.buttons["saveSessionButton"].tap()`, n(
          'XCTest, tapping on the user\'s behalf.',
          'Taps Save, which adds the session and closes the sheet.',
          'On the New Session sheet.',
          'After the title has been typed.',
          'If Save were still disabled, the tap would do nothing and the next check would catch it.')],
        ['', null],
        [r`        let row = app.staticTexts["Chemistry quiz prep"]`, n(
          'XCTest, building a query for the new row.',
          'Queries for a text element whose label is the new title.',
          'On the list screen, after the sheet is gone.',
          'After the sheet\'s closing animation starts.',
          'The row\'s text is user data, not interface copy, so querying by label is safe here.')],
        [r`        XCTAssertTrue(row.waitForExistence(timeout: 2))`, n(
          'XCTest\'s assertion and waiting APIs.',
          'Waits up to two seconds for the row, then asserts it exists.',
          'The last line of the test.',
          'After saving; it polls until the row appears or two seconds pass.',
          'Waiting for a condition instead of sleeping a fixed time keeps tests fast and stops flaky failures during animations.')],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'widget',
      title: 'Query explorer',
      intro: `<p>Pick a query and see which elements it matches in the accessibility tree. Then switch the app to Spanish: label-based queries stop matching, identifier queries keep working. Turn the <code>-ui-testing</code> argument off and watch the seeded rows disappear. Finally, run the UI test under each setting.</p>`,
      widget: 'shipping-ui-query',
      props: {},
    },
    {
      kind: 'code',
      title: 'Audit accessibility and launch time',
      intro: `<p>UI tests can check quality as well as behavior. An <strong>accessibility audit</strong> scans the current screen for problems such as low contrast, missing labels, small tap targets and text clipped at large sizes; Module 05 (Design) has the full audit checklist, and this test automates it. A <strong>performance test</strong> measures launch time and flags regressions against a recorded baseline.</p>`,
      run: 'static',
      lines: [
        [r`import XCTest`, n(
          'The Swift compiler, building the UI-test target.',
          'Imports XCTest for UI tests and metrics.',
          'Top of a file in the UI-test target.',
          'At compile time, when the UI-test target builds.',
          'Audits and launch metrics are XCTest features.')],
        ['', null],
        [r`final class QualityUITests: XCTestCase {`, n(
          'XCTest, which discovers XCTestCase subclasses.',
          'Groups quality checks that are not tied to one journey.',
          'In the UI-test target.',
          'A new instance is created for each test method.',
          'Separate quality tests can run less often, for example only before a release.')],
        [r`    @MainActor`, n(
          'The Swift compiler, which enforces actor isolation.',
          'Main-actor isolation for the test.',
          'On the audit test method below.',
          'Checked at compile time.',
          'Required to use XCUIApplication.')],
        [r`    func testSessionListPassesAccessibilityAudit() throws {`, n(
          'XCTest, which runs methods that start with test.',
          'A test that audits the first screen.',
          'Inside the quality test class.',
          'When the UI-test target runs.',
          'throws is needed because the audit reports problems by throwing.')],
        [r`        let app = XCUIApplication()`, n(
          'XCTest, the testing framework.',
          'Creates the proxy for the app under test.',
          'First line of the audit test.',
          'At the start of the test, before launch.',
          'Same setup as any UI test.')],
        [r`        app.launchArguments = ["-ui-testing"]`, n(
          'The test, configuring the launch.',
          'Launches with seeded rows.',
          'On the proxy, before launch.',
          'Once, before the only launch in this test.',
          'An empty list would hide problems in the rows themselves.')],
        [r`        app.launch()`, n(
          'XCTest and the simulator.',
          'Starts the app and waits until it is idle.',
          'In the simulator, in the app\'s own process.',
          'Before the audit, so there is a screen to inspect.',
          'The audit inspects whatever is on screen at this moment.')],
        [r`        try app.performAccessibilityAudit()`, n(
          'XCTest\'s audit engine, the same checks as Accessibility Inspector.',
          'Scans the screen for contrast, element descriptions, hit-region size, Dynamic Type and clipped text, recording a failure for each issue.',
          'Against the current screen.',
          'After launch; call it again after navigating to audit other screens.',
          'It catches problems VoiceOver and low-vision users hit, automatically, on every run.')],
        ['    }', null],
        ['', null],
        [r`    @MainActor`, n(
          'The Swift compiler, which enforces actor isolation.',
          'Puts the performance test on the main actor.',
          'On the performance test method below.',
          'Checked at compile time.',
          'XCUIApplication is main-actor isolated, so this test needs the same isolation as the audit test above.')],
        [r`    func testLaunchPerformance() throws {`, n(
          'XCTest, which runs methods that start with test.',
          'A performance test for cold launch.',
          'Inside the quality test class, below the audit.',
          'When run, usually on a real device for meaningful numbers.',
          'Launch time is the first impression; regressions sneak in one framework at a time.')],
        [r`        measure(metrics: [XCTApplicationLaunchMetric()]) {`, n(
          'XCTest\'s measurement system, inherited from XCTestCase.',
          'Runs the block several times and records launch duration.',
          'The only statement of the performance test.',
          'Runs the block five times by default, then compares with the baseline.',
          'Set a baseline once in Xcode; later runs fail if launch gets noticeably slower.')],
        [r`            XCUIApplication().launch()`, n(
          'XCTest, starting a fresh copy of the app.',
          'Launches the app from scratch.',
          'Inside the measured block.',
          'Once per iteration of the measured block.',
          'Measuring the real launch includes everything your app does at startup.')],
        ['        }', null],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'code',
      title: 'Previews as visual checks',
      intro: `<p>Previews are the fastest visual test you have. Write one per interesting state: sample data, empty, the largest text size, dark mode. You see every state at a glance after each edit, without launching the app or tapping your way there.</p>`,
      run: 'static',
      context: listContext,
      lines: [
        [r`import SwiftUI`, n(
          'The Swift compiler, building the app target in a debug build.',
          'Imports SwiftUI for #Preview and environment values.',
          'Top of the previews file.',
          'At compile time, in debug builds where previews are compiled.',
          'Previews are a SwiftUI and Xcode feature.')],
        ['', null],
        [r`extension SessionStore {`, n(
          'You, adding members to an existing type without editing its file.',
          'Adds sample data for previews.',
          'Often in a Preview Content folder, so it is excluded from release builds.',
          'Compiled with the app; used only by previews.',
          'One shared sample keeps every preview consistent.')],
        [r`    static var sample: SessionStore {`, n(
          'The previews below, each of which reads it.',
          'A computed property that builds a fresh seeded store on each use.',
          'Static member of SessionStore.',
          'Each time a preview reads it.',
          'A fresh instance per preview means one preview cannot change another\'s data.')],
        [r`        SessionStore(titles: ["Algebra review", "Biology flashcards"])`, n(
          'The store\'s initializer, called by the sample property.',
          'Creates a store with two known rows.',
          'Body of the computed property.',
          'On each read, so every preview gets its own copy.',
          'The same rows the UI test uses, so what you check by eye matches what tests check by code.')],
        ['    }', null],
        ['}', null],
        ['', null],
        [r`#Preview("Sample data") {`, n(
          'Xcode\'s preview canvas, showing the first of three tabs.',
          'A named preview of the normal state.',
          'At file scope, one of several previews.',
          'Whenever the canvas refreshes.',
          'Names appear as tabs in the canvas, so each state is one click away.')],
        [r`    SessionListView(store: .sample)`, n(
          'SwiftUI, rendering inside the canvas.',
          'Renders the list with sample rows.',
          'The body of the "Sample data" preview.',
          'Each time the preview refreshes.',
          'The view takes its store as input, which is what makes previews this easy.')],
        ['}', null],
        ['', null],
        [r`#Preview("Empty state") {`, n(
          'Xcode\'s preview canvas, showing the second tab.',
          'A preview of the first-launch state.',
          'At file scope, the second preview.',
          'Each time the canvas refreshes.',
          'Empty states are easy to forget and are the first thing a new user sees.')],
        [r`    SessionListView(store: SessionStore(titles: []))`, n(
          'SwiftUI, rendering inside the canvas.',
          'Renders the list with no rows.',
          'The body of the "Empty state" preview.',
          'Each time the preview refreshes.',
          'Seeing a blank screen here tells you the view needs a ContentUnavailableView.')],
        ['}', null],
        ['', null],
        [r`#Preview("Largest text") {`, n(
          'Xcode\'s preview canvas, showing the third tab.',
          'A preview at an accessibility text size.',
          'At file scope, the third preview.',
          'Each time the canvas refreshes.',
          'Large Dynamic Type sizes reveal clipped and overlapping text instantly.')],
        [r`    SessionListView(store: .sample)`, n(
          'SwiftUI, rendering inside the canvas.',
          'The same list, about to be enlarged.',
          'The body of the "Largest text" preview, before its modifier.',
          'Each time the preview refreshes.',
          'Same data, different environment: one variable at a time.')],
        [r`        .environment(\.dynamicTypeSize, .accessibility3)`, n(
          'SwiftUI\'s environment, which passes values down to every child view.',
          'Forces a very large accessibility text size for this preview only.',
          'Modifier on the preview\'s view.',
          'Each time the preview refreshes.',
          'The canvas\'s Variants button can also show every text size at once without code.')],
        ['}', null],
      ],
      try: [
        'Add a "Dark mode" preview that applies .preferredColorScheme(.dark).',
      ],
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>A UI test uses <code>app.buttons["Save"]</code>. It passes in English and fails after the app is translated into Spanish. What is the best fix?</p>',
          choices: ['Launch the app in English for UI tests, whatever the simulator language', 'Query by identifier: <code>app.buttons["saveSessionButton"]</code>', 'Add a sleep before the tap so the label can load', 'Use <code>app.buttons.element(boundBy: 2)</code> instead'],
          answer: 1,
          explain: '<p>A subscript string matches an identifier or a label. Labels change with language; identifiers do not. Forcing English hides the bug from every other user, a sleep changes nothing about the label, and index-based queries break as soon as the layout changes.</p>',
        },
        {
          q: '<p>Why does the test set <code>app.launchArguments = ["-ui-testing"]</code> before <code>app.launch()</code>?</p>',
          choices: ['So the app launches faster in the simulator during tests', 'Because XCTest requires at least one launch argument', 'So the app starts from known in-memory data', 'So the app turns on VoiceOver for the accessibility checks'],
          answer: 2,
          explain: '<p>The app checks for the flag and seeds a known store. Without it the test depends on whatever data the simulator holds, which differs between machines and runs.</p>',
        },
        {
          q: '<p>Which check belongs in a unit test rather than a UI test?</p>',
          choices: ['<code>share(of:tip:people:)</code> returns nil for zero people', 'Tapping Save on the sheet shows the new row in the list', 'The first screen passes an accessibility audit', 'Cold launch stays under its recorded baseline'],
          answer: 0,
          explain: '<p>The split rule is pure logic: a unit test checks it in milliseconds and points straight at the failure. The other three need the running app.</p>',
        },
        {
          q: '<p>A UI test sometimes fails because the new row appears after the sheet\'s closing animation. What should it do?</p>',
          choices: ['Retry the whole test up to three times', 'Sleep for five seconds before querying for the row', 'Turn off the animation with <code>UIView.setAnimationsEnabled(false)</code>', 'Wait with <code>waitForExistence(timeout:)</code>'],
          answer: 3,
          explain: '<p>Waiting for a condition returns as soon as the row appears and fails only after the timeout. A fixed sleep is either too short (flaky) or too long (slow), retries hide the problem, and the test runner cannot reach into the app to switch off its animations.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 4: debugging and Instruments
// ---------------------------------------------------------------------------
// Shared code for the two sides of the retain-cycle comparison. The code is the
// same apart from the capture line; the notes are written per side (`leaks` is
// true for the strong-capture version) so each explains what happens on that side.
const timerLines = (leaks, capture, captureNote) => {
  const v = (before, after) => (leaks ? before : after);
  return [
  [r`final class StudyTimer {`, n(
    'You declare it; ARC (Automatic Reference Counting) manages its memory.',
    'A class standing in for a repeating timer that calls back on every tick.',
    'At file scope; each instance lives on the heap.',
    'An instance is created when a SessionModel is created.',
    v('Classes are reference types, so ARC counts how many strong references point at each instance; on this side that count never reaches zero.',
      'Classes are reference types, so ARC counts strong references; on this side the count does reach zero, and the deinit below proves it.'))],
  [r`    var onTick: (() -> Void)?`, n(
    'The timer stores the closure it will call.',
    'An optional closure property, called on each tick.',
    'A stored property of the timer; the closure itself is also a heap object.',
    'Assigned once in SessionModel\'s init.',
    v('Storing a closure keeps it, and everything it captured, alive for as long as the timer lives; here that includes the model.',
      'Storing a closure keeps it alive for as long as the timer lives, but with a weak capture the closure no longer keeps the model alive.'))],
  [r`    deinit { print("StudyTimer freed") }`, n(
    'ARC calls deinit automatically.',
    'Prints a message at the moment the timer is destroyed.',
    'Inside StudyTimer; a class can have at most one deinit.',
    'Exactly when the last strong reference to the timer goes away.',
    v('A print in deinit is the simplest leak detector; on this side the line never appears, because the timer never dies.',
      'A print in deinit is the simplest leak detector; on this side it prints second, right after the model is freed.'))],
  ['}', null],
  ['', null],
  [r`final class SessionModel {`, n(
    'You declare it; a study screen would own one.',
    'The view model for a running study session.',
    'At file scope; instances live on the heap.',
    'Created when the screen opens.',
    v('It owns the timer, which is normal; the problem is that the timer\'s closure owns it back.',
      'It owns the timer, which is normal; with [weak self] the timer no longer owns it back.'))],
  [r`    var seconds = 0`, n(
    'The model owns this counter.',
    'Seconds studied so far.',
    'A stored property of the model.',
    'Incremented by the timer\'s closure on each tick.',
    v('The closure needs to reach this property, which is why it refers to self at all; a strong reference is the default when it does.',
      'The closure still needs to reach this property, so it refers to self, but through a weak reference it does not own.'))],
  [r`    let timer = StudyTimer()`, n(
    'The model holds a strong reference to its timer.',
    'Creates the timer together with the model.',
    'A stored property: model to timer is a strong arrow.',
    'Created together with each model, before init\'s body runs.',
    v('An owner holding what it uses strongly is correct; the cycle appears because the arrow also points back.',
      'An owner holding what it uses strongly is correct; this arrow stays strong, and only the arrow pointing back is weakened.'))],
  [r`    init() {`, n(
    'Swift calls it when SessionModel() runs.',
    'The initializer that wires the timer to the model.',
    'Inside SessionModel, its only initializer.',
    'Once per model, after all stored properties have values.',
    v('self is fully usable here because every stored property already has a default value, which is also what lets the closure capture it.',
      'self is fully usable here because every stored property already has a value, so the capture list can refer to it.'))],
  [capture, captureNote],
  ['    }', null],
  [r`    deinit { print("SessionModel freed") }`, n(
    'ARC, the moment the model\'s count reaches zero.',
    'Prints when the model is destroyed.',
    'Inside SessionModel, after init.',
    'When the model\'s strong reference count reaches zero.',
    v('The model\'s deinit should run before the timer\'s; on this side neither runs, which is the symptom to look for.',
      'The model\'s deinit runs before ARC releases the timer it owns, so this line prints first.'))],
  ['}', null],
  ['', null],
  [r`var model: SessionModel? = SessionModel()`, n(
    'Top-level code, playing the screen that owns the model.',
    'Creates a model and holds it in an optional variable.',
    'A global variable in this program.',
    'When the program starts.',
    v('An optional lets the program drop its reference by assigning nil, like a screen closing; the test is whether that frees anything.',
      'An optional lets the program drop its reference by assigning nil, like a screen closing; here that is enough to free both objects.'))],
  [r`model = nil`, n(
    'Top-level code, releasing its reference.',
    'Drops the only reference the "screen" held.',
    'The global variable that played the screen\'s reference.',
    v('Immediately after creation, before any tick could happen.',
      'Immediately after creation, at the same moment as on the left.'),
    v('Nothing else should hold the model strongly, but the closure does, so ARC frees nothing on this line.',
      'The closure holds the model only weakly, so this release drops the count to zero and ARC frees it here.'))],
  [r`print("screen closed")`, n(
    v('Swift\'s print function, writing the only line this side produces.',
      'Swift\'s print function, writing the last of three lines.'),
    'Marks the point after the screen let go.',
    'Standard output, the console below the code.',
    'After the release, as the last line of the program.',
    v('Any deinit message that appears before this line proves memory was freed in time; on this side none does.',
      'Both deinit messages appear before this line, proving memory was freed in time.'))],
  ];
};

const debugging = {
  id: 'shipping-debugging',
  title: 'Debugging and Instruments',
  steps: [
    {
      kind: 'concept',
      title: 'Read the crash before you change code',
      body: `<p>When a Swift program hits a programmer error it <strong>traps</strong>: it stops immediately instead of continuing with corrupt data. In Xcode, the debugger pauses on the failing line, the console prints the reason, and the Debug navigator (Command-7) shows the <strong>stack trace</strong>, the chain of function calls that led there. Read all three before editing anything.</p>`,
      points: [
        { term: 'Index out of range', text: 'An array was read at a position it does not have, such as sessions[3] in a three-item array.' },
        { term: 'Unexpectedly found nil', text: 'A force unwrap (!) met nil. Replace it with if let, guard let or ?? and handle the empty case.' },
        { term: 'EXC_BAD_ACCESS', text: 'Code touched memory that was already freed, often through unowned references or unsafe pointers.' },
        { term: 'Stack trace', text: 'Read from the top down until you reach the first frame from your own code; that is usually where to look.' },
      ],
      callout: { tone: 'tip', title: 'Crashes after release', html: `<p>Crashes from testers and customers appear in Xcode's Organizer. They are <strong>symbolicated</strong>, meaning raw memory addresses are turned back into function names and line numbers, using the dSYM file saved with your archive.</p>` },
    },
    {
      kind: 'compare',
      title: 'Print debugging, then the fix',
      intro: `<p>The average of 25, 30 and 40 minutes should be 31.67, but the screen shows 31. A temporary <code>print</code> reveals the values involved. The fix converts before dividing and guards the empty list, which would otherwise crash with a division by zero.</p>`,
      left: {
        label: 'Before: a debug print exposes the bug',
        run: 'swift',
        expect: 'debug: total=95 count=3\n31.0',
        lines: [
          [r`func averageMinutes(_ sessions: [Int]) -> Double {`, n(
            'Your code, called by the stats screen.',
            'Declares a function that should return the average session length.',
            'At file scope, in the stats feature.',
            'Each time the weekly summary is shown.',
            'Returning Double promises fractional minutes, a promise the buggy body breaks.')],
          [r`    let total = sessions.reduce(0, +)`, n(
            'reduce, combining every element with +.',
            'Adds up all the minutes into an Int: 95 here.',
            'First line of the function.',
            'On each call, before the debug print.',
            'Summing with reduce(0, +) is clear and correct; the bug is on another line.')],
          [r`    print("debug: total=\(total) count=\(sessions.count)")`, n(
            'print, added temporarily while hunting the bug.',
            'Shows the two values that feed the division.',
            'Just before the suspicious line.',
            'On each call, until you delete it.',
            'Printing the inputs to a calculation tells you whether the inputs or the calculation are wrong. Remove such prints before committing.')],
          [r`    return Double(total / sessions.count)`, n(
            'Integer division, then a conversion.',
            'Divides 95 by 3 as integers, which gives 31, then converts 31 to 31.0.',
            'Last line of the function.',
            'On each call, after the debug print.',
            'The conversion happens too late: the fraction is already gone. An empty array would also crash here with a division by zero.')],
          ['}', null],
          ['', null],
          [r`print(averageMinutes([25, 30, 40]))`, n(
            'Top-level code, playing the stats screen.',
            'Calls the function and prints the result, 31.0.',
            'The program\'s top level, its entry point.',
            'After the debug line prints.',
            'Seeing total=95 and count=3 but 31.0 points straight at the division.')],
        ],
      },
      right: {
        label: 'After: convert first, guard the empty case',
        run: 'swift',
        expect: '31.666666666666668\n0.0',
        lines: [
          [r`func averageMinutes(_ sessions: [Int]) -> Double {`, n(
            'Your code, the same signature as before.',
            'Declares the corrected average function.',
            'At file scope, replacing the buggy version.',
            'Each time the summary is shown.',
            'Keeping the signature means no caller has to change.')],
          [r`    guard !sessions.isEmpty else { return 0 }`, n(
            'guard, checked at run time.',
            'Returns 0 for a week with no sessions.',
            'First line, before any arithmetic.',
            'On each call, before any arithmetic.',
            'Integer division by zero traps. Handling the empty case is a product decision written down in code.')],
          [r`    let total = sessions.reduce(0, +)`, n(
            'reduce, adding every element with +.',
            'Sums the minutes, as before.',
            'After the guard, so the array is known to be non-empty.',
            'Only for a non-empty array.',
            'This line was never the problem, so it stays.')],
          [r`    return Double(total) / Double(sessions.count)`, n(
            'Floating-point division on two converted Doubles.',
            'Converts both numbers first, so 95 / 3 keeps its fraction.',
            'Last line of the function.',
            'On each call with data.',
            'Convert before dividing whenever the result must keep a fraction.')],
          ['}', null],
          ['', null],
          [r`print(averageMinutes([25, 30, 40]))`, n(
            'Top-level code, playing the stats screen again.',
            'Prints 31.666666666666668, the full Double value.',
            'The program\'s top level.',
            'Runs first, producing the first output line.',
            'The view should still round this for display, for example with a format style.')],
          [r`print(averageMinutes([]))`, n(
            'Top-level code, trying the edge case.',
            'Prints 0.0 instead of crashing.',
            'The program\'s top level.',
            'Runs second, producing the second output line.',
            'Each bug you fix deserves a regression test so it can never quietly return.')],
        ],
      },
      verdict: `<p>A print is a quick way to see values, but it changes the code and is easy to leave behind. The real fix is a one-line change, and the guard handles a crash nobody had seen yet. Turn both cases into unit tests so the bug stays fixed.</p>`,
    },
    {
      kind: 'concept',
      title: 'Breakpoints and LLDB',
      body: `<p>A <strong>breakpoint</strong> pauses the app just before a line runs. Click a line number in Xcode's gutter to add one. While paused, the Variables view lists every local value, and the console accepts <strong>LLDB</strong> commands. LLDB is the debugger built into Xcode.</p>`,
      points: [
        { term: 'v total', text: 'Reads a variable directly from memory without running code. It is the fastest and safest command.' },
        { term: 'p total', text: 'Evaluates an expression and prints it with type-aware formatting.' },
        { term: 'po model', text: 'Prints an object\'s description, the text from CustomStringConvertible or debugDescription.' },
        { term: 'Stepping', text: 'Step Over (F6) runs the line, Step Into (F7) enters the call, Step Out (F8) finishes the function, Continue resumes.' },
        { term: 'Condition', text: 'Edit a breakpoint and add a condition such as minutes < 0 so it stops only when the bug happens.' },
      ],
      callout: { tone: 'tip', title: 'Debug without editing code', html: `<p>Give a breakpoint a Log Message action and tick "Automatically continue". It prints like <code>print</code> but never touches your source, so nothing slips into a commit.</p>` },
    },
    {
      kind: 'code',
      title: 'Log with Logger, not print',
      intro: `<p><code>print</code> output vanishes once the app leaves Xcode. The unified logging system keeps messages with a level, a subsystem and a category, so you can filter them in Xcode's console or the Console app. It also hides private values from logs collected off the device.</p>`,
      run: 'static',
      lines: [
        [r`import OSLog`, n(
          'The Swift compiler, building the service\'s file.',
          'Imports Apple\'s unified logging API, which provides Logger.',
          'Top of the service\'s file.',
          'At compile time, before Logger can be referenced.',
          'Logger is part of the operating system, so it adds no dependency and very little overhead.')],
        ['', null],
        [r`extension Logger {`, n(
          'You, adding members to the system Logger type.',
          'Starts an extension that defines the app\'s named loggers.',
          'At file scope, often in Core/Logging.swift.',
          'Compiled once; used everywhere.',
          'One place for every logger keeps subsystem and category names consistent across the app.')],
        [r`    static let sync = Logger(subsystem: "com.example.StudyBuddy",`, n(
          'The logging system, which tags each message.',
          'Creates a logger whose subsystem is the app\'s bundle identifier.',
          'A static constant on Logger.',
          'Created the first time anything uses Logger.sync.',
          'Using the bundle ID as the subsystem lets you filter the console to just your app.')],
        [r`                             category: "sync")`, n(
          'The logging system, which stores the category with every message.',
          'Names the category, the part of the app this logger covers, and closes the call.',
          'Second argument of the initializer, aligned under the first.',
          'Set once, when the logger is created.',
          'Categories let you show only sync messages while chasing a sync bug.')],
        ['}', null],
        ['', null],
        [r`struct SyncService {`, n(
          'You declare it; the app calls it when sessions change.',
          'A service that uploads study sessions.',
          'In Core/Services/, next to the other services.',
          'Created once by the composition root.',
          'Services are where logging pays off most, because they talk to the outside world.')],
        [r`    func upload(_ count: Int, for email: String) async {`, n(
          'The view model, after the user saves.',
          'An async method that uploads some number of sessions for an account.',
          'An instance method of SyncService.',
          'Each time a sync starts.',
          'The parameters are what we want in the logs, one public and one private.')],
        [r`        Logger.sync.info("Uploading \(count) sessions")`, n(
          'Logger, at the info level.',
          'Records the start of an upload with the number of sessions.',
          'First line of upload, before any work starts.',
          'At the start of each sync.',
          'Numbers are public by default, so they appear in the log even when collected from a tester\'s device.')],
        [r`        Logger.sync.debug("Account: \(email, privacy: .private)")`, n(
          'Logger, at the debug level.',
          'Logs the email but marks it private.',
          'Second line of upload.',
          'At the start of each sync.',
          'Private values appear while you debug in Xcode but are redacted in logs collected from a device, which protects users. Debug-level messages are not stored by default.')],
        [r`        do {`, n(
          'Swift\'s error-handling syntax, inside upload.',
          'Begins the block that can fail.',
          'Inside upload, around the call that can throw.',
          'On each sync attempt.',
          'The catch below is where a failure is logged.')],
        [r`            try await Task.sleep(for: .milliseconds(200))`, n(
          'The Swift concurrency runtime.',
          'Waits 200 milliseconds, standing in for the real network call.',
          'Inside do; the thread is free while waiting.',
          'During each sync, between the start and finish messages.',
          'Task.sleep throws if the task is cancelled, which gives the catch block something real to log.')],
        [r`            Logger.sync.notice("Upload finished")`, n(
          'Logger, at the notice level.',
          'Records a successful finish.',
          'Inside do, after the wait.',
          'When the upload completes.',
          'notice is the default level and is kept on disk, so it is visible after the fact.')],
        [r`        } catch {`, n(
          'Swift\'s catch clause, paired with the do block in upload.',
          'Catches any error from the block.',
          'Directly after the do block.',
          'Only when something throws.',
          'Every failure path deserves a log line; silent failures are the hardest bugs to find.')],
        [r`            Logger.sync.error("Upload failed: \(error)")`, n(
          'Logger, at the error level.',
          'Records the failure and the error\'s description.',
          'Inside the catch block.',
          'Only when the upload fails or is cancelled.',
          'Error-level messages stand out in the console and are always stored.')],
        ['        }', null],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'concept',
      title: 'Visual debuggers and Instruments',
      body: `<p>Some bugs are easier to see than to read. Xcode can pause the app and draw its views or its objects. <strong>Instruments</strong> records the app over time. Profile with Command-I: it builds an optimized Release version and opens Instruments. Measure on a real device whenever you can.</p>`,
      points: [
        { term: 'View hierarchy', text: 'Debug > View Debugging shows every view in an exploded 3D stack: find hidden, zero-size or clipped views.' },
        { term: 'Memory graph', text: 'The Debug Memory Graph button draws live objects and their references. Leaked objects get a purple warning.' },
        { term: 'Time Profiler', text: 'Samples call stacks many times a second to show where CPU time goes, especially on the main thread.' },
        { term: 'Allocations', text: 'Tracks every allocation. Repeat an action and look for memory that keeps growing.' },
        { term: 'Leaks and Hangs', text: 'Leaks finds unreachable memory; Hangs flags moments when the main thread stopped responding.' },
      ],
    },
    {
      kind: 'compare',
      title: 'A retain cycle, and [weak self]',
      intro: `<p>ARC frees an object when nothing holds it strongly. On the left, the model owns a timer whose closure captures <code>self</code> strongly: model to timer to closure to model, a <strong>retain cycle</strong>. Releasing the model frees nothing. On the right, <code>[weak self]</code> breaks the loop and both objects are freed.</p>`,
      left: {
        label: 'Before: strong capture leaks',
        run: 'swift',
        expect: 'screen closed',
        lines: timerLines(true,
          r`        timer.onTick = { self.seconds += 1 }`,
          n(
            'The closure, which captures self strongly by default.',
            'Stores a closure in the timer that increments the model\'s seconds.',
            'Inside init; the closure lives on the heap, owned by the timer.',
            'Assigned once, during initialization.',
            'Now model holds timer, timer holds closure, closure holds model. The loop keeps every count above zero forever.')),
      },
      right: {
        label: 'After: [weak self] breaks the cycle',
        run: 'swift',
        expect: 'SessionModel freed\nStudyTimer freed\nscreen closed',
        lines: timerLines(false,
          r`        timer.onTick = { [weak self] in self?.seconds += 1 }`,
          n(
            'The closure, with a capture list.',
            'Captures self weakly, so the closure refers to the model without keeping it alive.',
            'Inside init; the weak reference becomes nil automatically when the model dies.',
            'Assigned once; checked on every tick.',
            'A weak reference does not add to the count. self? safely does nothing if the model is already gone.')),
      },
      verdict: `<p>A cycle needs every arrow in the loop to be strong. Break one with <code>weak</code> (it becomes nil when the object dies) or <code>unowned</code> (it promises the object outlives the reference, and crashes if wrong). Prefer <code>weak</code> for closures stored by objects you own and for delegates.</p>`,
    },
    {
      kind: 'widget',
      title: 'Memory graph lab',
      intro: `<p>Each box is a heap object, each arrow a reference, and each badge the strong-reference count ARC tracks. Pop the screen and watch ARC free what it can. With a strong capture, the remaining objects form a cycle and are flagged as leaked. Turn on <code>[weak self]</code>, reset and pop again. Then try the delegate scenario.</p>`,
      widget: 'shipping-retain-cycle',
      props: {},
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>The app stops with "Fatal error: Unexpectedly found nil while unwrapping an Optional value". What is the most likely cause?</p>',
          choices: ['A retain cycle kept an object alive too long', 'A force unwrap (<code>!</code>) met nil', 'An array was indexed past its last element', 'The main thread was blocked for too long'],
          answer: 1,
          explain: '<p>That message comes from <code>!</code> meeting nil. An index past the end reports "Index out of range", and retain cycles never crash; they quietly leak memory.</p>',
        },
        {
          q: '<p>In the left program, <code>model = nil</code> runs but neither deinit message prints. Why?</p>',
          choices: ['deinit only runs when the app quits, not when a variable becomes nil', 'Top-level variables keep their objects alive until the program ends', 'The closure captures the model strongly, so the cycle keeps it alive', 'print does not work inside deinit, so the messages were lost'],
          answer: 2,
          explain: '<p>The model owns the timer, the timer owns the closure, and the closure owns the model. Releasing the outside reference leaves each object with one strong reference from the loop. <code>[weak self]</code> removes one arrow and the whole chain is freed.</p>',
        },
        {
          q: '<p>You want to pause only when <code>log(_:)</code> receives a negative number, without editing code. What do you use?</p>',
          choices: ['A conditional breakpoint with the condition <code>minutes &lt; 0</code>', 'A <code>print</code> inside the guard, removed before committing', 'The memory graph debugger, filtered to FocusModel', 'Instruments Allocations, recording while you tap'],
          answer: 0,
          explain: '<p>A condition makes the breakpoint stop only when the expression is true. A print requires editing source, and the memory tools answer different questions.</p>',
        },
        {
          q: '<p>Scrolling feels jerky and you suspect slow work on the main thread. Which tool shows where that time goes?</p>',
          choices: ['The view hierarchy debugger', 'Leaks', 'Logger with the debug level', 'Instruments Time Profiler'],
          answer: 3,
          explain: '<p>Time Profiler samples call stacks and shows which functions use the CPU, and on which thread. The view debugger shows layout and Leaks shows memory, not time.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 5: performance, accessibility and localization
// ---------------------------------------------------------------------------
const performanceQuality = {
  id: 'shipping-performance-quality',
  title: 'Performance, Accessibility and Localization',
  steps: [
    {
      kind: 'concept',
      title: 'The main thread and the frame budget',
      body: `<p>iOS redraws the screen 60 times a second, or up to 120 on ProMotion displays, so each frame has about 16.7 ms (or 8.3 ms) to be ready. Every SwiftUI <code>body</code>, every tap handler and all layout run on the <strong>main thread</strong>. When main-thread work overruns the budget, a frame arrives late: a <strong>hitch</strong>, felt as a stutter. If the main thread stays blocked for 250 ms or more, Xcode reports a <strong>hang</strong>, and taps stop responding.</p>`,
      points: [
        { term: 'Keep body cheap', text: 'No decoding, sorting or formatter creation inside body. Compute once and store the result.' },
        { term: 'Go lazy', text: 'LazyVStack and List build rows only as they scroll into view; VStack builds every row up front.' },
        { term: 'Size images', text: 'Decode a thumbnail at display size, off the main actor, instead of a full camera photo.' },
      ],
      callout: { tone: 'design', title: 'Energy is performance too', html: `<p>Work that causes hitches also drains the battery: a busy CPU, timers that poll, best-accuracy location when "nearby" is enough, and many small network requests. Xcode's Energy gauge shows the cost while the app runs.</p>` },
    },
    {
      kind: 'widget',
      title: 'Frame budget lab',
      intro: `<p>Scroll a simulated list of study spots and watch each frame's time against the budget line. Decode full-size photos on the main thread at 120 Hz and count the hitches. Then move the work off the main actor, remove the formatter from <code>body</code>, and switch the eager <code>VStack</code> to <code>LazyVStack</code>. Notice which change fixes which symptom.</p>`,
      widget: 'shipping-frame-budget',
      props: {},
    },
    {
      kind: 'code',
      title: 'Move heavy work off the main actor',
      intro: `<p>Decoding a 12-megapixel photo can take tens of milliseconds, several frames' worth. Here a function marked <code>@concurrent</code> decodes a small thumbnail on a background thread, and the row shows it when ready. The row's <code>body</code> stays fast because it only displays a finished image.</p>`,
      run: 'static',
      context: r`import Foundation
struct StudySpot: Identifiable {
    let id = UUID()
    let name: String
    let photoData: Data
}`,
      lines: [
        [r`import SwiftUI`, n(
          'The Swift compiler, building the spots feature.',
          'Imports SwiftUI, which also brings in UIImage from UIKit on iOS.',
          'Top of the spots feature\'s file.',
          'At compile time, before the app runs.',
          'UIImage is still the standard way to decode image data on iOS.')],
        ['', null],
        [r`@concurrent`, n(
          'The Swift 6.2 compiler and the concurrency runtime.',
          'Marks the function below to always run on the shared background thread pool, never on the caller\'s actor.',
          'An attribute on a global async function.',
          'Applied every time the function is called.',
          'Even when called from main-actor code, the slow decoding now happens elsewhere, so frames keep flowing.')],
        [r`func makeThumbnail(from data: Data) async -> UIImage? {`, n(
          'Any caller that awaits it, here a row\'s .task.',
          'Declares an async function that turns raw image bytes into a small image, or nil.',
          'At file scope in the spots feature.',
          'Once per row, when the row first appears.',
          'A free function with no shared state is safe to run concurrently for many rows at once.')],
        [r`    guard let image = UIImage(data: data) else { return nil }`, n(
          'UIImage, which parses the compressed bytes.',
          'Creates an image from the data, or returns nil if the bytes are not a valid image.',
          'First line of the function, on a background thread.',
          'On each call, on a background thread.',
          'Corrupt data becomes a missing thumbnail instead of a crash.')],
        [r`    let size = CGSize(width: 160, height: 160)`, n(
          'Your code, choosing the target size.',
          'The thumbnail size in pixels: 80 points on a 2x screen.',
          'Inside the function, after the image is known to be valid.',
          'On each call, just before resizing.',
          'Decoding at display size uses a fraction of the memory of a full photo, which also helps scrolling.')],
        [r`    return await image.byPreparingThumbnail(ofSize: size)`, n(
          'UIKit\'s image pipeline, through byPreparingThumbnail(ofSize:).',
          'Decodes and downsizes the image, then returns it ready to draw.',
          'Last line of the function.',
          'Suspends until the thumbnail is ready, typically a few milliseconds.',
          'A prepared image draws instantly; an undecoded one would be decoded on the main thread at first display.')],
        ['}', null],
        ['', null],
        [r`struct SpotRow: View {`, n(
          'SwiftUI, which creates one per visible spot.',
          'A row in the study-spot list.',
          'In Features/Spots/, next to the list that uses it.',
          'Created as the row scrolls into a lazy list.',
          'Rows are created often, so they must be cheap to build.')],
        [r`    let spot: StudySpot`, n(
          'The list, which passes each spot in.',
          'The model for this row: a name and photo bytes.',
          'A stored property of the view.',
          'Set when the row is created.',
          'The row receives data; it never fetches it.')],
        [r`    @State private var thumbnail: UIImage?`, n(
          'SwiftUI, which stores the image between redraws.',
          'The decoded thumbnail, nil until ready.',
          'View state for this row only.',
          'Set once, when the task finishes.',
          'Storing the result means decoding happens once, not on every redraw.')],
        ['', null],
        [r`    var body: some View {`, n(
          'SwiftUI, on the main thread.',
          'Describes the row using only ready-made values.',
          'The View protocol\'s only requirement.',
          'On appearance and when thumbnail changes.',
          'Nothing slow happens here, so this body fits easily inside a frame.')],
        [r`        HStack {`, n(
          'SwiftUI\'s layout system, placing two children side by side.',
          'Places the image and the name side by side.',
          'Root of the row\'s content.',
          'On each redraw of the row.',
          'Standard stacks are fast to lay out.')],
        [r`            if let thumbnail { Image(uiImage: thumbnail) }`, n(
          'SwiftUI, evaluating the if statement inside the view builder.',
          'Shows the thumbnail once it exists, and nothing before.',
          'First child of the HStack.',
          'On each redraw; true after the task finishes.',
          'A placeholder or ProgressView could fill the gap; either way, body never waits for decoding.')],
        [r`            Text(spot.name)`, n(
          'SwiftUI, rendering a text label.',
          'Shows the spot\'s name next to the thumbnail.',
          'Second child of the HStack.',
          'On each redraw, including the very first one.',
          'The text appears immediately, before the image is ready.')],
        ['        }', null],
        [r`        .task {`, n(
          'SwiftUI, which starts an async task tied to the view\'s lifetime.',
          'Runs the closure when the row appears.',
          'Modifier on the HStack, the row\'s root view.',
          'When the row appears; cancelled automatically if it scrolls away first.',
          'Automatic cancellation avoids wasted work for rows the user flicked past.')],
        [r`            thumbnail = await makeThumbnail(from: spot.photoData)`, n(
          'The row, on the main actor, awaiting background work.',
          'Waits for the thumbnail, then stores it, which triggers one redraw.',
          'Inside the task closure.',
          'After decoding completes in the background.',
          'The main thread is free during the await and only does the cheap assignment afterwards.')],
        ['        }', null],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'concept',
      title: 'An accessibility pass before every release',
      body: `<p>The World Health Organization estimates that one in six people lives with a significant disability, and everyone has moments of bright sunlight, tired eyes or one free hand. iOS supplies the tools; your job is to not break them. Check each screen against this short list, use Accessibility Inspector (Xcode > Open Developer Tool) to audit it, and automate the audit with <code>performAccessibilityAudit()</code>. Module 05 (Design) walks through the full audit checklist.</p>`,
      points: [
        { term: 'VoiceOver', text: 'Every control has a spoken label; icon-only buttons need accessibilityLabel. Decorative images are hidden.' },
        { term: 'Dynamic Type', text: 'Use text styles such as .body and test at the largest accessibility sizes. Nothing is clipped.' },
        { term: 'Contrast', text: 'Body text needs at least 4.5:1 against its background, in light and dark mode.' },
        { term: 'Targets', text: 'Tap targets are at least 44 by 44 points.' },
        { term: 'Motion and color', text: 'Respect Reduce Motion, and never use color alone to show state.' },
      ],
    },
    {
      kind: 'code',
      title: 'Make a custom control speak',
      intro: `<p>An icon-only button is just "plus circle fill" to VoiceOver unless you describe it. Here the button gets a label (what it is), a value (its current state) and a hint (what happens). The decorative circle is hidden. Turn on VoiceOver on a device, or use Accessibility Inspector, to hear the difference.</p>`,
      run: 'swiftui',
      lines: [
        [r`import SwiftUI`, n(
          'The Swift compiler, building this file.',
          'Imports SwiftUI, including its accessibility modifiers.',
          'Top of the row\'s file.',
          'At compile time, before the app runs.',
          'Accessibility in SwiftUI is a set of ordinary modifiers, no extra framework.')],
        ['', null],
        [r`struct GoalRow: View {`, n(
          'You declare it; SwiftUI renders it.',
          'A row showing one subject and a button to log time.',
          'At file scope, in the goals feature.',
          'Created by the parent list.',
          'Custom rows are exactly where accessibility gets forgotten.')],
        [r`    @State private var minutes = 45`, n(
          'SwiftUI, which stores the value.',
          'Minutes logged for this subject, starting at 45.',
          'View state owned by this row.',
          'Starts at 45 and changes on each tap of the button.',
          'The value read aloud must follow this state, so it is computed from it below.')],
        [r`    var body: some View {`, n(
          'SwiftUI, which calls it on the main thread.',
          'Describes the row and its accessibility information together.',
          'The View protocol\'s only requirement.',
          'On appearance and after each tap.',
          'Because labels live in body, they update automatically with the state.')],
        [r`        HStack(spacing: 16) {`, n(
          'SwiftUI\'s layout system, arranging the ring, name and button.',
          'Places the ring, the name and the button in a row.',
          'Root of the row\'s content.',
          'On each redraw, after every tap.',
          'VoiceOver visits the children in reading order: left to right.')],
        [r`            Circle().stroke(Color.green, lineWidth: 6)`, n(
          'SwiftUI\'s shape drawing, through Circle and stroke.',
          'Draws a green ring as decoration.',
          'First child of the row, at the leading edge.',
          'On each redraw; its look never changes.',
          'Color alone carries no meaning here, so nothing is lost for people who cannot see it.')],
        [r`                .frame(width: 44, height: 44)`, n(
          'SwiftUI\'s layout system, sizing the circle.',
          'Sizes the ring to 44 by 44 points.',
          'Modifier on the decorative circle.',
          'On each layout pass.',
          '44 points is Apple\'s minimum comfortable size for anything a finger aims at.')],
        [r`                .accessibilityHidden(true)`, n(
          'SwiftUI, editing the accessibility tree.',
          'Removes the decorative ring from VoiceOver.',
          'Modifier on the decorative circle.',
          'Applied on every render.',
          'Hiding decoration means VoiceOver users do not hear "image" on every row.')],
        [r`            Text("Algebra")`, n(
          'SwiftUI, rendering text that VoiceOver can read.',
          'Shows the subject name, which VoiceOver reads as is.',
          'Middle of the row, after the ring.',
          'On each redraw of GoalRow, before and after taps.',
          'Text is accessible by default and scales with Dynamic Type.')],
        [r`            Spacer()`, n(
          'SwiftUI\'s layout system, filling the leftover width.',
          'Pushes the button to the trailing edge.',
          'Between the name and the button.',
          'On each layout pass, taking whatever width is left.',
          'Spacers have no accessibility element, so they cost nothing to VoiceOver.')],
        [r`            Button {`, n(
          'The user, or VoiceOver\'s double-tap, activates it.',
          'Starts a button with a custom label view.',
          'Last child of the row, at the trailing edge.',
          'Its action runs on each activation.',
          'A real Button gets the button trait and keyboard support automatically; a tap gesture would not.')],
        [r`                minutes = min(minutes + 15, 60)`, n(
          'The button\'s action closure, on the main thread.',
          'Adds 15 minutes, capped at the 60-minute goal.',
          'Inside the action closure.',
          'On each activation by a tap or a VoiceOver double-tap.',
          'The change updates the spoken value below, too.')],
        [r`            } label: {`, n(
          'Swift\'s multiple-trailing-closure syntax, read by the compiler.',
          'Switches from the action to the button\'s visible label.',
          'Between the two closures.',
          'At compile time; it only separates the two closures.',
          'A custom label can be any view, which is why it needs an explicit spoken label.')],
        [r`                Image(systemName: "plus.circle.fill").font(.title)`, n(
          'SwiftUI, drawing an SF Symbol.',
          'Shows a large plus icon as the only visible label.',
          'Inside the label closure.',
          'On each redraw of the button\'s label.',
          'Without help, VoiceOver would read the symbol\'s name, which means nothing to a student.')],
        ['            }', null],
        [r`            .accessibilityLabel("Add 15 minutes")`, n(
          'VoiceOver, which speaks it first.',
          'Names what the button does.',
          'Modifier on the button, after its closing brace.',
          'Read whenever VoiceOver focuses the button.',
          'A label is short and says what the control is, not how it looks.')],
        [r`            .accessibilityValue("\(minutes) of 60 minutes")`, n(
          'VoiceOver, which speaks it after the label.',
          'Reports the current progress, such as "45 of 60 minutes".',
          'Modifier on the button, after the label.',
          'Re-read after each change.',
          'Values carry state that changes; labels stay constant.')],
        [r`            .accessibilityHint("Logs more study time for Algebra")`, n(
          'VoiceOver, after a short pause.',
          'Explains the result of activating the button.',
          'Modifier on the button, after the value.',
          'Read only if the user waits, and can be turned off in settings.',
          'Hints help newcomers without slowing down experienced users.')],
        ['        }', null],
        [r`        .padding()`, n(
          'SwiftUI\'s layout system, adding default insets.',
          'Adds standard spacing around the row.',
          'Modifier on the HStack.',
          'Each layout pass of GoalRow.',
          'Comfortable spacing also makes targets easier to hit.')],
        ['    }', null],
        ['}', null],
        ['', null],
        [r`#Preview { GoalRow() }`, n(
          'Xcode\'s canvas, here the phone beside the code.',
          'Shows the row in the canvas so you can tap and inspect it.',
          'At file scope; compiled only for development tools.',
          'Whenever the file changes.',
          'Pair the preview with Accessibility Inspector to hear exactly what VoiceOver will say.')],
      ],
      try: [
        'Write out what VoiceOver says for the button after two taps.',
        'Delete .accessibilityHidden(true). What extra element would VoiceOver now stop on?',
      ],
    },
    {
      kind: 'code',
      title: 'Localize with a String Catalog',
      intro: `<p>Add a <strong>String Catalog</strong> (Localizable.xcstrings) and Xcode collects every user-facing string from SwiftUI at build time. Translators fill in each language there. Plurals and formatted numbers, durations and dates adapt to the user's language and region automatically.</p>`,
      run: 'static',
      lines: [
        [r`import SwiftUI`, n(
          'The Swift compiler, building this file.',
          'Imports SwiftUI; Text initializers accept localizable keys.',
          'Top of the stats feature\'s file.',
          'At compile time, before the app runs.',
          'Localization in SwiftUI mostly happens by using Text with literals, which you already do.')],
        ['', null],
        [r`struct WeekSummaryView: View {`, n(
          'SwiftUI, which renders it inside the stats screen.',
          'A small summary card for the week.',
          'In Features/Stats/, next to the stats screen.',
          'Created by the stats screen.',
          'Every string in this view will be extracted for translation.')],
        [r`    let sessionCount: Int`, n(
          'The parent screen, which passes it in.',
          'How many sessions were logged this week.',
          'A stored property of the view.',
          'Set when the parent creates the card.',
          'A number that drives a plural phrase needs special handling in other languages.')],
        [r`    let minutes: Int`, n(
          'The parent stats screen, which passes it in.',
          'Total minutes studied this week.',
          'A stored property of the view.',
          'Set when the parent creates the card.',
          'Will be shown as a localized duration, not as raw minutes.')],
        [r`    let weekStart: Date`, n(
          'The parent stats screen, which passes it in.',
          'The first day of the week being summarized.',
          'A stored property of the view.',
          'Set when the parent creates the card.',
          'Dates must be formatted for the user\'s region; month and day order differ worldwide.')],
        ['', null],
        [r`    var body: some View {`, n(
          'SwiftUI, which calls it to draw the card.',
          'Describes the card\'s four lines.',
          'The View protocol\'s only requirement.',
          'On appearance and when inputs change.',
          'Each Text below is looked up in the String Catalog at run time.')],
        [r`        VStack(alignment: .leading) {`, n(
          'SwiftUI\'s layout system, stacking the four lines.',
          'Stacks the lines, aligned to the leading edge.',
          'Root of the card\'s content.',
          'On each redraw of WeekSummaryView.',
          'leading, not left: in right-to-left languages such as Arabic it flips automatically.')],
        [r`            Text("This week")`, n(
          'SwiftUI and the String Catalog.',
          'A string literal that Xcode extracts as a translatable key.',
          'First line of the card.',
          'Looked up when the view renders, in the user\'s language.',
          'Text with a literal is localizable by default; Text(verbatim:) opts out for things like codes.')],
        [r`                .font(.headline)`, n(
          'SwiftUI\'s typography system, through the font modifier.',
          'Uses the headline text style.',
          'Modifier on the title text.',
          'On each redraw, with the user\'s current text size.',
          'Text styles also scale with Dynamic Type, which matters more in languages with longer words.')],
        [r`            Text("\(sessionCount) sessions")`, n(
          'SwiftUI and the String Catalog.',
          'An interpolated string; the catalog key becomes "%lld sessions".',
          'Second line of the card.',
          'Looked up on each render with the current count.',
          'In the catalog, choose Vary by Plural to provide "1 session" and "5 sessions", and the forms other languages need.')],
        [r`            Text(Duration.seconds(minutes * 60),`, n(
          'SwiftUI and Foundation\'s formatting.',
          'Starts a Text that displays a Duration value.',
          'Third line of the card.',
          'On each render, using the user\'s current language.',
          'Formatting a typed value beats building "1 hr 35 min" by hand, which can only ever be English.')],
        [r`                 format: .units(allowed: [.hours, .minutes]))`, n(
          'Foundation\'s Duration format style.',
          'Shows hours and minutes, such as "1 hr, 35 min" in English.',
          'Second argument of the Text.',
          'Each render, using the user\'s locale.',
          'The same value reads "1 h y 35 min" for a Spanish-speaking user, with no extra code.')],
        [r`            Text(weekStart, format: .dateTime.month().day())`, n(
          'SwiftUI and Foundation\'s date format style.',
          'Shows the month and day in the user\'s regional order, such as "Oct 20" or "20 oct".',
          'Fourth and last line of the card.',
          'On each render, using the user\'s region settings.',
          'Never hard-code date patterns like MM/dd; regions disagree about order and separators.')],
        ['        }', null],
        ['    }', null],
        ['}', null],
        ['', null],
        [r`func goalBanner() -> String {`, n(
          'Code that builds text outside a Text view, such as a view model preparing an alert message.',
          'Returns a localized String for use where Text is not available.',
          'At file scope, beside the view.',
          'Each time a banner is built.',
          'Plain String values are not localized automatically; String(localized:) marks them.')],
        [r`    String(localized: "Weekly goal reached",`, n(
          'Foundation\'s localization lookup, through String(localized:comment:).',
          'Looks up the key in the String Catalog for the user\'s language.',
          'The function\'s only expression.',
          'At run time, each time the function is called.',
          'Xcode also extracts this key into the catalog at build time.')],
        [r`           comment: "Banner shown when the weekly goal is met")`, n(
          'Translators, who read it in the catalog.',
          'Explains where and how the string is used.',
          'Second argument of String(localized:comment:).',
          'Read by humans, never shown to users.',
          'Context prevents bad translations of short, ambiguous phrases.')],
        ['}', null],
      ],
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>A list stutters while scrolling on a 120 Hz iPhone. Time Profiler shows <code>UIImage(data:)</code> inside a row\'s <code>body</code>. What is the best fix?</p>',
          choices: ['Lower the display to 60 Hz so each frame gets 16.7 ms', 'Decode a thumbnail off the main actor and store it in state', 'Wrap the row in a <code>VStack</code> so rows are built up front', 'Call <code>UIImage(data:)</code> twice so the second call hits a cache'],
          answer: 1,
          explain: '<p>Decoding on the main thread blows the 8.3 ms frame budget. Doing it once, in the background, at display size removes the work from every frame. You cannot control the refresh rate, and a VStack makes things worse by building every row.</p>',
        },
        {
          q: '<p>Which element should get <code>.accessibilityHidden(true)</code>?</p>',
          choices: ['A decorative ring beside text that states the progress', 'An icon-only delete button at the trailing end of each row', 'The only text on the screen that explains why saving failed', 'A toggle with no visible label at the end of a settings row'],
          answer: 0,
          explain: '<p>Hide decoration that repeats information found elsewhere. The icon-only button and the unlabeled toggle need labels, not hiding, and hiding an error message would silence it for VoiceOver users.</p>',
        },
        {
          q: '<p><code>Text("\\(count) sessions")</code> reads "1 sessions" when count is 1. Where do you fix it?</p>',
          choices: ['Add an if statement in body for count == 1', 'Use <code>Text(verbatim:)</code> so the count is inserted as is', 'In the String Catalog, set the key to Vary by Plural', 'Store "session" and append "s" in code'],
          answer: 2,
          explain: '<p>Plural rules differ by language: some have three or more forms. The catalog handles them per language. An if statement or adding "s" only works for English.</p>',
        },
        {
          q: '<p>What does a hang mean in Xcode\'s diagnostics?</p>',
          choices: ['The app used more than 1 GB of memory at once', 'One frame took longer than its 16.7 ms budget', 'A network request waited more than 60 s', 'The main thread was blocked for 250 ms or more'],
          answer: 3,
          explain: '<p>A late frame is a hitch; a long block of the main thread is a hang, where taps and scrolling freeze. Memory and network problems have their own reports.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 6: release
// ---------------------------------------------------------------------------
const release = {
  id: 'shipping-release',
  title: 'From Archive to App Store',
  steps: [
    {
      kind: 'concept',
      title: 'Identity and signing',
      body: `<p>Shipping follows a fixed road: identity and signing, version and privacy, archive and upload, TestFlight, App Review, release and monitoring. It starts with identity. iOS runs only code that Apple can trace to a known developer, and <strong>code signing</strong> attaches that proof to every build. With <strong>Automatically manage signing</strong> checked in the target's Signing &amp; Capabilities tab, Xcode creates and renews the pieces for you; you mainly choose a team and a bundle ID.</p>`,
      points: [
        { term: 'Bundle ID', text: 'Reverse-DNS name such as com.example.StudyBuddy. Unique worldwide, and fixed once a build is uploaded.' },
        { term: 'Team', text: 'An Apple Developer Program membership. A free personal team runs apps on your own device but cannot use TestFlight or the App Store.' },
        { term: 'Certificate', text: 'Proves who signed the build: Apple Development for testing, Apple Distribution for release.' },
        { term: 'Provisioning profile', text: 'Ties a bundle ID, a certificate, allowed devices and capabilities together.' },
        { term: 'Capabilities', text: 'Features such as App Groups (sharing data with a widget) or push notifications. Adding one updates the App ID and profile.' },
      ],
      callout: { tone: 'warn', title: 'Choose the bundle ID carefully', html: `<p>After the first upload, the bundle ID can never change for that app record. Avoid version numbers or temporary names in it.</p>` },
    },
    {
      kind: 'code',
      title: 'Version, build and configuration',
      intro: `<p>Every upload needs a <strong>version</strong> users see (1.2.1) and a <strong>build number</strong> that is unique for that version (42). Xcode stores them as MARKETING_VERSION and CURRENT_PROJECT_VERSION. Showing both in an About row lets testers report exactly which build they used. <code>#if DEBUG</code> picks settings per <strong>build configuration</strong>: Debug while developing, Release when archiving.</p>`,
      run: 'static',
      lines: [
        [r`import SwiftUI`, n(
          'The Swift compiler, building the settings feature.',
          'Imports SwiftUI for the About row.',
          'Top of the file that holds app-wide helpers.',
          'At compile time, before the app runs.',
          'Bundle and URL come along with SwiftUI through Foundation.')],
        ['', null],
        [r`enum AppInfo {`, n(
          'You declare it; nothing ever creates an instance.',
          'A namespace for app-wide build information.',
          'In Core/, shared by every feature.',
          'Its static members are evaluated when first read.',
          'An enum with no cases cannot be instantiated, which makes it a tidy container for static helpers.')],
        [r`    static var version: String {`, n(
          'The About row in Settings, which reads it.',
          'A computed property that returns a display string such as "Version 1.2.1 (42)".',
          'A static member of AppInfo.',
          'Each time something reads it; nothing is cached.',
          'Computing from the bundle means the text can never disagree with the real build.')],
        [r`        let info = Bundle.main.infoDictionary`, n(
          'Foundation\'s Bundle, which reads the app\'s compiled Info.plist.',
          'Gets the dictionary of build settings stored inside the app.',
          'First line of the getter.',
          'At run time, on each read.',
          'Xcode copies MARKETING_VERSION and CURRENT_PROJECT_VERSION into Info.plist when it builds the app.')],
        [r`        let short = info?["CFBundleShortVersionString"] as? String`, n(
          'Your code, reading one key.',
          'Gets the marketing version, the number users see in the App Store.',
          'Inside the getter, after the dictionary is read.',
          'On each read of version.',
          'Each new App Store release needs a higher version than the one already live.')],
        [r`        let build = info?["CFBundleVersion"] as? String`, n(
          'Your code, reading another key.',
          'Gets the build number, which identifies one specific upload.',
          'Inside the getter, next to the version lookup.',
          'On each read of version.',
          'Uploading the same version and build twice is rejected, so the number goes up with every upload.')],
        [r`        return "Version \(short ?? "?") (\(build ?? "?"))"`, n(
          'The getter, producing its result.',
          'Combines both values, falling back to "?" if a key is missing.',
          'Last line of the getter.',
          'On each read, after both lookups.',
          'The nil-coalescing operator avoids force unwraps; a missing key shows "?" instead of crashing.')],
        ['    }', null],
        ['', null],
        [r`    static var apiBase: URL {`, n(
          'Services that build request URLs.',
          'Returns the server address for the current build configuration.',
          'A static member of AppInfo.',
          'Each time a service builds a request URL.',
          'One switch point keeps test builds from writing into production data.')],
        [r`        #if DEBUG`, n(
          'The Swift compiler, at build time.',
          'Includes the next line only when the DEBUG flag is set, which Xcode does for the Debug configuration.',
          'A compile-time condition inside the getter.',
          'Decided while building; the other branch is not compiled at all.',
          'Release builds cannot accidentally point at staging, because that code is not in them.')],
        [r`        URL(string: "https://staging.example.com")!`, n(
          'Foundation\'s URL initializer, parsing the staging literal.',
          'The staging server for development builds.',
          'Inside the DEBUG branch.',
          'Returned in Debug builds only.',
          'A staging server lets you test against fake data without touching real accounts.')],
        [r`        #else`, n(
          'The Swift compiler\'s conditional compilation.',
          'Starts the branch used when DEBUG is not set.',
          'Between the two compile-time branches.',
          'Decided at build time, not at run time.',
          'Archive builds use the Release configuration, so they always take this branch.')],
        [r`        URL(string: "https://api.example.com")!`, n(
          'Foundation\'s URL initializer, parsing the production literal.',
          'The production server address.',
          'Inside the release branch.',
          'Returned in Release builds, including TestFlight and App Store builds.',
          'TestFlight runs the same Release build that ships, so testers see real behavior.')],
        [r`        #endif`, n(
          'The Swift compiler\'s conditional compilation.',
          'Ends the conditional compilation block.',
          'Closes the #if block inside the getter.',
          'Decided at build time.',
          'Keep conditional blocks small so both configurations stay easy to read.')],
        ['    }', null],
        ['}', null],
        ['', null],
        [r`struct AboutRow: View {`, n(
          'SwiftUI, inside the Settings screen.',
          'A row that displays the version and build.',
          'In Features/Settings/, beside the Settings screen.',
          'Created when Settings opens.',
          'Testers can quote this text in TestFlight feedback.')],
        [r`    var body: some View {`, n(
          'SwiftUI, which calls it to draw the row.',
          'Describes the row\'s content.',
          'The View protocol\'s only requirement.',
          'When the Settings screen shows the row.',
          'The row only displays; AppInfo does the work.')],
        [r`        LabeledContent("App", value: AppInfo.version)`, n(
          'SwiftUI\'s standard label-and-value control.',
          'Shows "App" on the leading side and the version string on the trailing side, the standard settings layout.',
          'The only content of the row\'s body.',
          'On each render of the row.',
          'LabeledContent matches the look of Settings rows and reads well with VoiceOver.')],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'code',
      title: 'The privacy manifest',
      intro: `<p>Apps must explain their data use. <strong>Purpose strings</strong> in Info.plist explain each permission prompt. The <strong>privacy manifest</strong>, a file named PrivacyInfo.xcprivacy, declares tracking, collected data and any <strong>required-reason APIs</strong>, APIs that could fingerprint a device. Uploads that use them without a declared reason are rejected with ITMS-91053. This is a property list, not Swift.</p>`,
      run: 'static',
      verify: 'skip',
      verifyReason: 'A property list (XML), not Swift; it was validated with plutil -lint instead.',
      lines: [
        [r`<?xml version="1.0" encoding="UTF-8"?>`, n(
          'Xcode, which writes this header when you add a new App Privacy file.',
          'Declares that the file is XML encoded as UTF-8.',
          'First line of PrivacyInfo.xcprivacy, a resource in the app target.',
          'Read at build time and by App Store Connect at upload.',
          'Property lists are XML; the header lets every tool parse the file the same way.')],
        [r`<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"`, n(
          'XML parsers, including Xcode\'s property-list reader.',
          'Names the property-list document type.',
          'Second line, continued on the next.',
          'Read whenever a tool parses the file.',
          'It identifies the format; you never edit it by hand.')],
        [r`    "http://www.apple.com/DTDs/PropertyList-1.0.dtd">`, n(
          'XML parsers, including Xcode\'s property-list reader.',
          'Points to the official definition of the format.',
          'Continuation of the DOCTYPE line.',
          'Read during parsing, never at app run time.',
          'Split over two lines here only to fit the page.')],
        [r`<plist version="1.0">`, n(
          'Property-list parsers in Xcode and App Store Connect.',
          'Opens the property list.',
          'Root element of the file.',
          'Read at build and upload time.',
          'Everything inside is plain data: keys, values, arrays and dictionaries.')],
        [r`<dict>`, n(
          'Property-list parsers in Xcode and App Store Connect.',
          'Opens the top-level dictionary of privacy keys.',
          'Directly inside the plist element.',
          'Read when the archive is uploaded.',
          'Each key below answers one privacy question about the app.')],
        [r`    <key>NSPrivacyTracking</key>`, n(
          'App Store Connect, which checks it against your answers.',
          'Asks whether the app tracks users across other companies\' apps and websites.',
          'First key in the dictionary.',
          'Read at upload and when the privacy report is generated.',
          'Tracking requires App Tracking Transparency permission; Study Buddy does not track.')],
        [r`    <false/>`, n(
          'Property-list parsers in Xcode and App Store Connect.',
          'Answers no to the tracking question.',
          'The value for NSPrivacyTracking.',
          'Read when the archive is uploaded.',
          'An honest false means no tracking prompt and no tracking domains to list.')],
        [r`    <key>NSPrivacyCollectedDataTypes</key>`, n(
          'App Store Connect, comparing it with your App Privacy answers.',
          'Lists the kinds of data the app sends off the device.',
          'Second key in the top-level dictionary.',
          'Read at upload, alongside the App Privacy answers you enter on the website.',
          'These declarations should match the privacy "nutrition label" on the App Store page.')],
        [r`    <array/>`, n(
          'Property-list parsers in Xcode and App Store Connect.',
          'An empty list: Study Buddy collects nothing.',
          'The value for collected data types.',
          'Read when the archive is uploaded.',
          'Location used only on the device to sort spots is not "collected". Collecting means sending data off the device where you or a partner can keep it.')],
        [r`    <key>NSPrivacyAccessedAPITypes</key>`, n(
          'App Store Connect\'s upload checks.',
          'Lists required-reason APIs the app calls.',
          'Third key in the top-level dictionary.',
          'Read at upload; missing entries trigger ITMS-91053.',
          'Required-reason categories include user defaults, file timestamps, system boot time, disk space and active keyboards.')],
        [r`    <array>`, n(
          'Property-list parsers in Xcode and App Store Connect.',
          'Opens the list of API declarations.',
          'The value for accessed API types.',
          'Read when the archive is uploaded.',
          'One dictionary per API category the app uses.')],
        [r`        <dict>`, n(
          'Property-list parsers in Xcode and App Store Connect.',
          'Opens one API declaration.',
          'First element of the array.',
          'Read when the archive is uploaded.',
          'Each declaration pairs a category with the reasons you use it.')],
        [r`            <key>NSPrivacyAccessedAPIType</key>`, n(
          'App Store Connect\'s upload checks.',
          'Names which category this declaration covers.',
          'Inside the declaration dictionary.',
          'Read when the archive is uploaded.',
          'Study Buddy saves settings with UserDefaults and @AppStorage, which counts.')],
        [r`            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>`, n(
          'App Store Connect\'s upload checks.',
          'Names the UserDefaults category, which also covers @AppStorage.',
          'The value for the API type key.',
          'Read when the archive is uploaded.',
          'Exact spelling matters; Xcode\'s property-list editor offers the valid names.')],
        [r`            <key>NSPrivacyAccessedAPITypeReasons</key>`, n(
          'App Store Connect\'s upload checks.',
          'Introduces the list of approved reasons.',
          'Inside the declaration, after the type.',
          'Read when the archive is uploaded.',
          'You may only choose reason codes that Apple publishes for that category.')],
        [r`            <array>`, n(
          'Property-list parsers in Xcode and App Store Connect.',
          'Opens the list of reason codes.',
          'Value of the reasons key.',
          'Read when the archive is uploaded.',
          'Several reasons are allowed if several apply.')],
        [r`                <string>CA92.1</string>`, n(
          'App Store Connect and App Review.',
          'Reason CA92.1: the app reads and writes defaults that only this app uses.',
          'The only reason in the list.',
          'Checked at upload and may be checked in review.',
          'Declaring a reason is a promise; using the API for anything else breaks the guidelines.')],
        [r`            </array>`, n(
          'Property-list parsers in Xcode and App Store Connect.',
          'Closes the reasons list.',
          'End of the reasons value.',
          'Read when the archive is uploaded.',
          'Tags must nest correctly or the upload fails to parse the file.')],
        [r`        </dict>`, n(
          'Property-list parsers in Xcode and App Store Connect.',
          'Closes the UserDefaults declaration.',
          'End of the first array element.',
          'Read when the archive is uploaded.',
          'Add another dictionary here if the app later reads, say, disk space.')],
        [r`    </array>`, n(
          'Property-list parsers in Xcode and App Store Connect.',
          'Closes the list of API declarations.',
          'End of the accessed API types value.',
          'Read when the archive is uploaded.',
          'Third-party SDKs ship their own manifests, which Xcode merges into the app\'s privacy report.')],
        [r`</dict>`, n(
          'Property-list parsers in Xcode and App Store Connect.',
          'Closes the top-level dictionary.',
          'End of the privacy keys.',
          'Read when the archive is uploaded.',
          'Xcode can generate a privacy report from the archive (Organizer, Generate Privacy Report).')],
        [r`</plist>`, n(
          'Property-list parsers in Xcode and App Store Connect.',
          'Closes the property list.',
          'Last line of PrivacyInfo.xcprivacy.',
          'Read when the archive is uploaded.',
          'The file must be a member of the app target or it is not copied into the build.')],
      ],
    },
    {
      kind: 'concept',
      title: 'TestFlight and App Review',
      body: `<p><strong>TestFlight</strong> delivers beta builds to real people before release. Testers install the TestFlight app, run your build and send feedback with screenshots. <strong>App Review</strong> then checks the release build against Apple's App Review Guidelines. Most rejections are avoidable.</p>`,
      points: [
        { term: 'Internal testers', text: 'Up to 100 members of your App Store Connect team. Builds are available as soon as they finish processing.' },
        { term: 'External testers', text: 'Up to 10,000 people by email or public link. The first build of a version needs Beta App Review. Builds expire after 90 days.' },
        { term: '2.1 Completeness', text: 'Crashes, placeholder text and broken links. Test the exact build you submit.' },
        { term: '2.3 Metadata', text: 'Screenshots and descriptions must match what the app really does.' },
        { term: '5.1.1 Data', text: 'Explain every permission. If users can create an account, they must be able to delete it in the app.' },
      ],
      callout: { tone: 'tip', title: 'Help the reviewer', html: `<p>If the app needs a login, put a working demo account in App Review Information. Reviewers who cannot get past the first screen reject the build.</p>` },
    },
    {
      kind: 'concept',
      title: 'After approval: release, watch, maintain',
      body: `<p>Once approved, you release manually, automatically or on a date. A <strong>phased release</strong> rolls an update out over seven days to people with automatic updates (1%, 2%, 5%, 10%, 20%, 50%, then 100%). If crash reports spike, pause it; anyone can still download the update manually. Shipping starts the maintenance phase of the life cycle, not the end of it.</p>`,
      points: [
        { term: 'Crashes', text: 'Xcode\'s Organizer collects crash reports from users who share analytics, symbolicated with your archive\'s dSYMs.' },
        { term: 'Hangs and energy', text: 'The Organizer also reports hangs, launch time and battery use from real devices.' },
        { term: 'Analytics and ratings', text: 'App Store Connect shows downloads, retention, ratings and reviews.' },
        { term: 'Maintenance release', text: 'Fix, test, bump to 1.2.1 with a new build number, TestFlight, submit. Request an expedited review only for critical bugs.' },
      ],
    },
    {
      kind: 'widget',
      title: 'Release pipeline lab',
      intro: `<p>Ship Study Buddy 1.2.1. Each stage asks one release decision. A wrong choice shows what really happens (a rejected upload, a crash at launch, a reviewer's message), so you can try again. Stages unlock in order; select a locked stage to see what breaks if you skip it.</p>`,
      widget: 'shipping-release-pipeline',
      props: {},
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>Version 1.2 (build 41) is live. You fix a crash. Which version and build should the upload use?</p>',
          choices: ['1.2.0 (42)', '1.1 (42)', '1.2.1 (42)', '1.2 (41)'],
          answer: 2,
          explain: '<p>A new release needs a version higher than the live one, and every upload needs a build number not used before for that version. Reusing 1.2 (41) is rejected at upload, 1.1 is lower than the live version, and 1.2.0 (42) is a fresh build of the version that is already live, not a new release.</p>',
        },
        {
          q: '<p>Why does an archived TestFlight build talk to <code>api.example.com</code> even though you were using staging all week?</p>',
          choices: ['TestFlight rewrites every URL in the build to its production form', 'Archive builds Release, which leaves out the DEBUG branch', 'Apple blocks staging servers from TestFlight builds at upload time', 'The privacy manifest lists only the production domain, so staging fails'],
          answer: 1,
          explain: '<p>Archive builds the Release configuration, where DEBUG is not set. The Debug branch is removed at compile time, so the build contains only the production address.</p>',
        },
        {
          q: '<p>An upload succeeds, but App Store Connect emails ITMS-91053: Missing API declaration. What is missing?</p>',
          choices: ['A required-reason entry in PrivacyInfo.xcprivacy', 'A purpose string for location in Info.plist', 'A demo account entered under App Review Information', 'A provisioning profile that includes the push capability'],
          answer: 0,
          explain: '<p>ITMS-91053 is about required-reason APIs declared in the privacy manifest, such as UserDefaults with reason CA92.1. Missing purpose strings produce ITMS-90683, demo accounts matter only during review, and a profile problem stops the upload itself.</p>',
        },
        {
          q: '<p>Day 3 of a phased release shows a spike in crashes on the new version. What is the best first move?</p>',
          choices: ['Remove the app from sale until the crash is fixed', 'Let the rollout reach day 7 so the fixed build can replace it sooner', 'Ask affected users to delete and reinstall the app', 'Pause the rollout, fix the crash and ship a maintenance release'],
          answer: 3,
          explain: '<p>Pausing stops automatic updates to more users while you fix and test the bug, then ship 1.2.2. The rollout exists exactly to limit the damage of a bad build.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 7: capstone
// ---------------------------------------------------------------------------
const plannerContext = r`struct StudySession: Equatable {
    let subject: String
    let minutes: Int
}
struct StudyPlanner {
    private(set) var sessions: [StudySession] = []
    var weeklyMinutes: Int { sessions.reduce(0) { $0 + $1.minutes } }
    mutating func log(_ session: StudySession) {
        guard session.minutes > 0 else { return }
        sessions.insert(session, at: 0)
    }
}`;

const capstone = {
  id: 'shipping-capstone',
  title: 'Capstone: Study Buddy from Idea to Release',
  steps: [
    {
      kind: 'concept',
      title: 'The life cycle, applied',
      body: `<p>The <strong>software development life cycle</strong> (SDLC) is the path every product follows: requirements, design, implementation, testing, deployment and maintenance. Modern teams run it in short <strong>iterations</strong>. Each loop delivers a small working slice, gathers feedback and shapes the next loop.</p><p>Your capstone, <strong>Study Buddy</strong>, begins with requirements. <em>Functional</em> requirements say what the app does; <em>non-functional</em> requirements say how well it must do it.</p>`,
      points: [
        { term: 'Plan and log', text: 'Plan study sessions, log minutes and see a weekly total, stored on the device with SwiftData.' },
        { term: 'Study spots', text: 'Show quiet places to study near the student, using location and MapKit.' },
        { term: 'Resources', text: 'Download study resources from a REST API with URLSession and keep them for offline use.' },
        { term: 'Widget', text: 'A home-screen widget shows the next scheduled session.' },
        { term: 'Qualities', text: 'Works offline, supports VoiceOver and Dynamic Type, keeps location on the device, launches in under a second.' },
      ],
    },
    {
      kind: 'concept',
      title: 'User stories and acceptance criteria',
      body: `<p>A <strong>user story</strong> states one requirement from the user's side: <em>As a student, I want to log a study session so that I can see my weekly total.</em> A good story is small enough for one iteration and valuable on its own.</p><p>Each story gets <strong>acceptance criteria</strong>, concrete conditions written as <em>Given</em> (the starting situation), <em>When</em> (the action) and <em>Then</em> (the observable result). If you cannot imagine the test, the criterion is too vague.</p>`,
      points: [
        { term: 'Given', text: 'a planner with 90 minutes of Algebra logged this week' },
        { term: 'When', text: 'the student logs a 30-minute Biology session' },
        { term: 'Then', text: 'the weekly total is 120 minutes, and the newest session is listed first' },
        { term: 'Too vague', text: '"Logging feels quick" becomes "logging takes at most two taps from the Today screen".' },
      ],
    },
    {
      kind: 'widget',
      title: 'Story to test mapper',
      intro: `<p>Pick a Study Buddy story. Sort each clause into Given, When or Then, or flag it as not testable. The Swift Testing skeleton on the right is generated as you go: misplaced clauses become TODO comments, and vague clauses get a measurable rewrite. Complete all three stories.</p>`,
      widget: 'shipping-story-mapper',
      props: {},
    },
    {
      kind: 'concept',
      title: 'Wireframes and architecture',
      body: `<p>A <strong>wireframe</strong> is a quick, low-detail sketch of each screen: boxes, labels and arrows between screens, no colors. Sketch Today, Spots, Resources and Settings, then walk every story through the sketches before writing code. Changing a sketch costs seconds; changing shipped code costs a release.</p><p>The <strong>architecture diagram</strong> gives every requirement a home, using the MVVM layers and feature folders from the first lesson.</p>`,
      points: [
        { term: 'Views', text: 'A TabView with Today, Spots and Resources tabs, one feature folder each.' },
        { term: 'View models', text: 'One @Observable view model for each screen that loads data or applies rules; a static screen stays a plain view.' },
        { term: 'Services', text: 'Location (CLLocationUpdate), spot search (MapKit) and resources (URLSession), each behind a protocol.' },
        { term: 'Storage', text: 'SwiftData models in an App Group container, so the widget extension reads the same store.' },
        { term: 'Widget', text: 'A WidgetKit extension whose timeline provider reads the next session.' },
      ],
    },
    {
      kind: 'code',
      title: 'Build the model behind the first story',
      intro: `<p>Iteration 1 starts with the model for "log a study session". It has no user interface and no storage yet, so it is quick to write and to check. Run it: the output is exactly what the story's acceptance criteria promise.</p>`,
      run: 'swift',
      lines: [
        [r`struct StudySession: Equatable {`, n(
          'You declare it; Swift copies it like any value.',
          'A model type for one logged session.',
          'Core/Models/, shared by every feature.',
          'Created each time the student logs time.',
          'Equatable lets tests compare whole sessions with ==. In the real app this becomes a SwiftData @Model class.')],
        [r`    let subject: String`, n(
          'Each session value stores its own subject.',
          'The subject studied, such as "Biology".',
          'A stored constant of the struct.',
          'Set once, when the session is created.',
          'let keeps a logged session from being edited by accident; editing would be its own story.')],
        [r`    let minutes: Int`, n(
          'Each session value stores its own length.',
          'How long the student studied, in whole minutes.',
          'A stored constant of the struct.',
          'Set once, when the session is created.',
          'Whole minutes match how students think about study time and avoid rounding questions.')],
        ['}', null],
        ['', null],
        [r`struct StudyPlanner {`, n(
          'The Today screen\'s view model will own one.',
          'A value type that holds the week\'s sessions and their rules.',
          'Core/Models/, next to StudySession.',
          'Created when the app starts, or fresh in every test.',
          'Keeping the rules in a plain struct makes each acceptance criterion a fast unit test.')],
        [r`    private(set) var sessions: [StudySession] = []`, n(
          'The planner owns writes; screens and tests read.',
          'The logged sessions, newest first, starting empty.',
          'A stored property with a private setter.',
          'Read by the list; changed only by log(_:).',
          'Forcing writes through log(_:) keeps the zero-minute rule impossible to bypass.')],
        ['', null],
        [r`    var weeklyMinutes: Int {`, n(
          'The weekly-total label reads it.',
          'A computed property for the total minutes.',
          'Inside StudyPlanner, below the stored list.',
          'Every time something reads it.',
          'Computing the total instead of storing it means it can never disagree with the list.')],
        [r`        sessions.reduce(0) { $0 + $1.minutes }`, n(
          'reduce, walking the array once.',
          'Starts at 0 and adds each session\'s minutes; $0 is the running total, $1 the session.',
          'Body of the computed property.',
          'On each read of weeklyMinutes.',
          'One expression states the rule exactly: the total is the sum of all session lengths.')],
        ['    }', null],
        ['', null],
        [r`    mutating func log(_ session: StudySession) {`, n(
          'The Log button\'s view model, or a test.',
          'The only way to add a session.',
          'A mutating method, because it changes a struct\'s stored property.',
          'Each time the student logs time.',
          'mutating makes the change visible at the call site: you can only call it on a var.')],
        [r`        guard session.minutes > 0 else { return }`, n(
          'The guard statement, checked at run time.',
          'Ignores sessions of zero or negative length.',
          'First line of log(_:), before any change.',
          'On each call, before the array changes.',
          'This line exists because of an acceptance criterion: "a zero-minute session is not logged".')],
        [r`        sessions.insert(session, at: 0)`, n(
          'The planner, changing its own array.',
          'Adds the session at the front of the list.',
          'Inside log(_:), after validation.',
          'For valid sessions only.',
          'Inserting at index 0 implements "the newest session is listed first" directly.')],
        ['    }', null],
        ['}', null],
        ['', null],
        [r`var planner = StudyPlanner()`, n(
          'Top-level code, playing the Today screen.',
          'Creates an empty planner in a variable.',
          'The program\'s top level.',
          'When the program starts.',
          'var is required because log(_:) mutates the struct.')],
        [r`planner.log(StudySession(subject: "Algebra", minutes: 90))`, n(
          'Top-level code, setting up the Given.',
          'Logs 90 minutes of Algebra.',
          'The program\'s top level.',
          'First change to the planner.',
          'This mirrors "Given a planner with 90 minutes of Algebra logged this week".')],
        [r`planner.log(StudySession(subject: "Biology", minutes: 30))`, n(
          'Top-level code, performing the When.',
          'Logs a 30-minute Biology session.',
          'The program\'s top level.',
          'Second change to the planner.',
          'This mirrors "When the student logs a 30-minute Biology session".')],
        [r`print(planner.weeklyMinutes, planner.sessions.first?.subject ?? "none")`, n(
          'print, checking the Then by eye.',
          'Prints the total and the newest subject: "120 Biology".',
          'Standard output, the console below the code.',
          'After both sessions are logged.',
          'Next you will turn this eyeball check into automated tests that run on every build.')],
      ],
      expect: '120 Biology',
      try: [
        'Log a third session of 0 minutes before the print. Predict the output, then run it.',
      ],
    },
    {
      kind: 'code',
      title: 'Turn acceptance criteria into tests',
      intro: `<p>Each acceptance criterion becomes a test, and the Given, When and Then become comments above the lines that perform them. When these tests pass, the story is verified. The <code>StudyPlanner</code> from the previous step is compiled with this file.</p>`,
      run: 'swifttest',
      expectTests: 2,
      context: plannerContext,
      lines: [
        [r`import Testing`, n(
          'The Swift compiler, building the unit-test target.',
          'Imports Swift Testing for @Suite, @Test and #expect.',
          'Top of the story\'s test file.',
          'At compile time, when the test target builds.',
          'Acceptance tests for model logic are ordinary unit tests: fast and precise.')],
        ['', null],
        [r`@Suite("Story: log a study session")`, n(
          'The @Suite macro, read by Xcode\'s test discovery.',
          'Names the suite after the user story it verifies.',
          'Attached to the struct below.',
          'Read at discovery, when Xcode lists the tests.',
          'Naming suites after stories gives a living checklist: a green suite means a verified story.')],
        [r`struct LogSessionStoryTests {`, n(
          'The test runner, which creates a fresh instance per test.',
          'Holds every test for this story.',
          'In the unit-test target, under a Sessions folder.',
          'A new instance per test.',
          'Fresh instances keep each criterion\'s test independent.')],
        [r`    @Test("Logging a session updates the weekly total")`, n(
          'The @Test macro, registering the main criterion\'s test.',
          'Registers the test with a display name taken from the criterion.',
          'Inside the suite, attached to the method below.',
          'Read at discovery, when Xcode builds the list of tests.',
          'The report reads like the specification, so anyone can see which promise broke.')],
        [r`    func loggingUpdatesWeeklyTotal() {`, n(
          'The test runner, which calls it on a fresh suite instance.',
          'The test for the main acceptance criterion.',
          'An instance method of the suite.',
          'When the suite runs, on Command-U or in continuous integration.',
          'One behavior per test keeps failures easy to diagnose.')],
        [r`        // Given a planner with 90 minutes of Algebra logged this week`, n(
          'Readers of the test; the compiler ignores comments.',
          'Labels the setup lines with the criterion\'s Given clause.',
          'Directly above the setup lines it describes.',
          'Never runs; it is documentation for people.',
          'Copying the clause word for word links the code to the story it proves.')],
        [r`        var planner = StudyPlanner()`, n(
          'The test, setting up the Given.',
          'Creates an empty planner.',
          'First statement of the test.',
          'At the start of the test.',
          'Each test builds its own planner, so no state leaks between tests.')],
        [r`        planner.log(StudySession(subject: "Algebra", minutes: 90))`, n(
          'The test, finishing the Given.',
          'Logs the 90 minutes the Given describes.',
          'The setup section, under the Given comment.',
          'Before the action under test.',
          'Setup uses the same public method as the app, so it cannot create impossible states.')],
        [r`        // When the student logs a 30-minute Biology session`, n(
          'Readers; the compiler ignores comments.',
          'Labels the single action under test.',
          'Above the single action line.',
          'Never runs; it is documentation for people.',
          'A test should have exactly one When; two actions usually mean two tests.')],
        [r`        planner.log(StudySession(subject: "Biology", minutes: 30))`, n(
          'The test, performing the When.',
          'Logs the 30-minute Biology session.',
          'The action section, under the When comment.',
          'After the setup is complete.',
          'This is the behavior under test.')],
        [r`        // Then the weekly total is 120 minutes`, n(
          'Readers; the compiler ignores comments.',
          'Labels the first outcome.',
          'Directly above its expectation.',
          'Never runs; it is documentation for people.',
          'Each Then clause gets its own expectation, so a report shows exactly which one failed.')],
        [r`        #expect(planner.weeklyMinutes == 120)`, n(
          'The #expect macro, checking the total.',
          'Checks the total is 90 plus 30.',
          'The assertion section, under the Then comment.',
          'After the action, as the first check of the Then section.',
          'An exact number makes the criterion measurable.')],
        [r`        // And the newest session is listed first`, n(
          'Readers; the compiler ignores comments.',
          'Labels the second outcome, joined with And.',
          'Directly above the second expectation.',
          'Never runs; it is documentation for people.',
          'And keeps several outcomes of one action in one readable scenario.')],
        [r`        #expect(planner.sessions.first?.subject == "Biology")`, n(
          'The #expect macro, checking the order.',
          'Checks the first session is the Biology one just logged.',
          'The assertion section, last line of the test.',
          'After the action, even if the previous expectation failed.',
          'Optional chaining with == is safe: an empty list gives nil, which is not "Biology", so the test fails instead of crashing.')],
        ['    }', null],
        ['', null],
        [r`    @Test("A zero-minute session is not logged")`, n(
          'The @Test macro, registering the edge-case test.',
          'Registers a second criterion: invalid sessions are ignored.',
          'Inside the suite, below the first test.',
          'Read at discovery, alongside the first test.',
          'Edge cases are acceptance criteria too; write them down with the story.')],
        [r`    func zeroMinutesIgnored() {`, n(
          'The test runner, which calls it on a fresh suite instance.',
          'The test for the zero-minute rule.',
          'An instance method of the suite.',
          'When the suite runs, possibly in parallel with the first test.',
          'A short name for a short test.')],
        [r`        var planner = StudyPlanner()`, n(
          'The test, setting up an empty planner.',
          'Creates an empty planner: the Given is no sessions yet.',
          'First statement of the edge-case test.',
          'At the start of the test.',
          'An empty start makes the expected result obvious.')],
        [r`        planner.log(StudySession(subject: "Biology", minutes: 0))`, n(
          'The test, performing the When.',
          'Tries to log a zero-minute session.',
          'Second statement of the test.',
          'After the empty planner exists.',
          'Zero is the boundary between valid and invalid, the most likely spot for a bug.')],
        [r`        #expect(planner.sessions.isEmpty)`, n(
          'The #expect macro, checking the list.',
          'Then: the list is still empty.',
          'Last line of the edge-case test.',
          'After the attempted log.',
          'If someone deletes the guard, this test fails before the bug reaches TestFlight.')],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'concept',
      title: 'Plan the build, the tests and the release',
      body: `<p>Plans turn the design into a schedule. Build in thin vertical slices: each iteration delivers one story end to end, from view to storage, on a real device.</p>`,
      points: [
        { term: 'Iteration 1', text: 'A walking skeleton: tabs, the SwiftData model and "log a session" end to end, on TestFlight for internal testers.' },
        { term: 'Iteration 2', text: 'Study spots: the location permission flow, MapKit search and distance sorting.' },
        { term: 'Iteration 3', text: 'Resources from the REST API with offline caching, then the widget.' },
        { term: 'Test plan', text: 'A unit test per acceptance criterion, integration tests with an in-memory store, UI tests for the three core journeys and an accessibility audit per screen.' },
        { term: 'Release plan', text: 'Privacy manifest and purpose strings, external TestFlight with five students (validation), App Review, phased release, crash monitoring.' },
      ],
      callout: { tone: 'tip', title: 'Definition of done', html: `<p>A story is done when its acceptance tests pass, its screens pass the accessibility audit and it runs on a real device. Compiling is not done.</p>` },
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>Which acceptance criterion is testable as written?</p>',
          choices: ['The spots list is pleasant to use', 'Spots within 2 km are listed nearest first', 'The widget always shows current data', 'Logging a session feels quick'],
          answer: 1,
          explain: '<p>A distance and an order can be checked by code. "Pleasant", "always" and "feels quick" need rewriting into something measurable, such as "at most two taps".</p>',
        },
        {
          q: '<p>In "Given 90 minutes logged, When the student logs 30 more, Then the total is 120", which part becomes the <code>#expect</code> line?</p>',
          choices: ['Then', 'Given', 'When', 'The story title'],
          answer: 0,
          explain: '<p>Then describes the observable result, which is what an expectation checks. Given becomes setup code and When becomes the single action under test.</p>',
        },
        {
          q: '<p>All acceptance tests pass, but in a TestFlight session students ignore the weekly total entirely. What has happened?</p>',
          choices: ['The tests are wrong and must be rewritten before release', 'The app failed verification, so the tests were incomplete', 'The app passed verification but not validation', 'The phased release should be paused'],
          answer: 2,
          explain: '<p>The tests prove the feature works as specified (verification). Real use shows whether it meets a real need (validation). That feedback goes into the next iteration\'s requirements.</p>',
        },
        {
          q: '<p>Why does the widget extension read SwiftData from an App Group container?</p>',
          choices: ['Widgets cannot use SwiftData directly, so the App Group holds a JSON copy', 'An App Group container is faster to read than the app\'s own sandbox', 'App Review rejects widgets whose data is not in an App Group container', 'The extension is a separate process, so it needs a shared container'],
          answer: 3,
          explain: '<p>Each process has its own sandbox. An App Group capability creates a container both can open, so the widget sees the sessions the app saved. Widgets can use SwiftData directly, and the group is about access, not speed or review rules.</p>',
        },
      ],
    },
  ],
};

const workedExamples = {
  id: 'shipping-worked-examples',
  title: 'Worked Examples',
  steps: [
        {
          kind: 'example',
          title: "Build a retain cycle, watch it leak, then break it",
          problem: "<p>A Pilot and a Ship hold each other. First build the strong two-way link and prove with deinit prints that releasing both variables frees nothing; then make one reference weak and watch both objects free.</p>",
          adapter: 'trace',
          expect: "Created pilot and ship\nPilot holds the ship\nCycle closed\nPilot freed\nShip freed\nafter release",
          frames: [
            {
              caption: "Two classes, each with an optional reference to the other and a deinit print. Creating one of each is harmless; nothing links them yet, and the creation marker prints.",
              lines: [
                [r`final class Pilot {`, RC_PILOT_CLASS],
                [r`    var ship: Ship?`, RC_PILOT_SHIP],
                [r`    deinit { print("Pilot freed") }`, RC_PILOT_DEINIT],
                ['}', null],
                [r`final class Ship {`, RC_SHIP_CLASS],
                [r`    var pilot: Pilot?`, RC_SHIP_PILOT_STRONG],
                [r`    deinit { print("Ship freed") }`, RC_SHIP_DEINIT],
                ['}', null],
                [r`var pilot: Pilot? = Pilot()`, RC_VAR_PILOT],
                [r`var ship: Ship? = Ship()`, RC_VAR_SHIP],
                [r`print("Created pilot and ship")`, RC_PRINT_CREATED],
              ],
              expect: "Created pilot and ship",
            },
            {
              caption: "One direction of reference is added: the pilot holds the ship. That arrow alone is ordinary ownership; each object still also has its outside variable holding it.",
              lines: [
                [r`final class Pilot {`, RC_PILOT_CLASS],
                [r`    var ship: Ship?`, RC_PILOT_SHIP],
                [r`    deinit { print("Pilot freed") }`, RC_PILOT_DEINIT],
                ['}', null],
                [r`final class Ship {`, RC_SHIP_CLASS],
                [r`    var pilot: Pilot?`, RC_SHIP_PILOT_STRONG],
                [r`    deinit { print("Ship freed") }`, RC_SHIP_DEINIT],
                ['}', null],
                [r`var pilot: Pilot? = Pilot()`, RC_VAR_PILOT],
                [r`var ship: Ship? = Ship()`, RC_VAR_SHIP],
                [r`print("Created pilot and ship")`, RC_PRINT_CREATED],
                [r`pilot?.ship = ship`, RC_LINK1],
                [r`print("Pilot holds the ship")`, RC_PRINT_HOLDS],
              ],
              expect: "Created pilot and ship\nPilot holds the ship",
            },
            {
              caption: "The second direction closes the loop: the ship now holds the pilot too. Every object in the loop has a strong reference from inside the loop itself.",
              lines: [
                [r`final class Pilot {`, RC_PILOT_CLASS],
                [r`    var ship: Ship?`, RC_PILOT_SHIP],
                [r`    deinit { print("Pilot freed") }`, RC_PILOT_DEINIT],
                ['}', null],
                [r`final class Ship {`, RC_SHIP_CLASS],
                [r`    var pilot: Pilot?`, RC_SHIP_PILOT_STRONG],
                [r`    deinit { print("Ship freed") }`, RC_SHIP_DEINIT],
                ['}', null],
                [r`var pilot: Pilot? = Pilot()`, RC_VAR_PILOT],
                [r`var ship: Ship? = Ship()`, RC_VAR_SHIP],
                [r`print("Created pilot and ship")`, RC_PRINT_CREATED],
                [r`pilot?.ship = ship`, RC_LINK1],
                [r`print("Pilot holds the ship")`, RC_PRINT_HOLDS],
                [r`ship?.pilot = pilot`, RC_LINK2],
                [r`print("Cycle closed")`, RC_PRINT_CYCLE],
              ],
              expect: "Created pilot and ship\nPilot holds the ship\nCycle closed",
            },
            {
              caption: "Both outside variables are set to nil, and the after release marker prints, but no freed lines appear before it. The cycle keeps both objects alive: this is the leak, proven.",
              lines: [
                [r`final class Pilot {`, RC_PILOT_CLASS],
                [r`    var ship: Ship?`, RC_PILOT_SHIP],
                [r`    deinit { print("Pilot freed") }`, RC_PILOT_DEINIT],
                ['}', null],
                [r`final class Ship {`, RC_SHIP_CLASS],
                [r`    var pilot: Pilot?`, RC_SHIP_PILOT_STRONG],
                [r`    deinit { print("Ship freed") }`, RC_SHIP_DEINIT],
                ['}', null],
                [r`var pilot: Pilot? = Pilot()`, RC_VAR_PILOT],
                [r`var ship: Ship? = Ship()`, RC_VAR_SHIP],
                [r`print("Created pilot and ship")`, RC_PRINT_CREATED],
                [r`pilot?.ship = ship`, RC_LINK1],
                [r`print("Pilot holds the ship")`, RC_PRINT_HOLDS],
                [r`ship?.pilot = pilot`, RC_LINK2],
                [r`print("Cycle closed")`, RC_PRINT_CYCLE],
                [r`pilot = nil`, RC_NIL_PILOT],
                [r`ship = nil`, RC_NIL_SHIP],
                [r`print("after release")`, RC_PRINT_AFTER],
              ],
              expect: "Created pilot and ship\nPilot holds the ship\nCycle closed\nafter release",
            },
            {
              caption: "The repair changes exactly one word: the ship reference back to the pilot becomes weak. The same creation and linking runs, and the printed markers are unchanged so far.",
              lines: [
                [r`final class Pilot {`, RC_PILOT_CLASS],
                [r`    var ship: Ship?`, RC_PILOT_SHIP],
                [r`    deinit { print("Pilot freed") }`, RC_PILOT_DEINIT],
                ['}', null],
                [r`final class Ship {`, RC_SHIP_CLASS],
                [r`    weak var pilot: Pilot?`, RC_SHIP_PILOT_WEAK],
                [r`    deinit { print("Ship freed") }`, RC_SHIP_DEINIT],
                ['}', null],
                [r`var pilot: Pilot? = Pilot()`, RC_VAR_PILOT],
                [r`var ship: Ship? = Ship()`, RC_VAR_SHIP],
                [r`print("Created pilot and ship")`, RC_PRINT_CREATED],
                [r`pilot?.ship = ship`, RC_LINK1],
                [r`print("Pilot holds the ship")`, RC_PRINT_HOLDS],
                [r`ship?.pilot = pilot`, RC_LINK2],
                [r`print("Cycle closed")`, RC_PRINT_CYCLE],
              ],
              expect: "Created pilot and ship\nPilot holds the ship\nCycle closed",
            },
            {
              caption: "The same release now frees both objects: Pilot freed prints when its variable goes nil, Ship freed follows, and only then does the after release marker print.",
              lines: [
                [r`final class Pilot {`, RC_PILOT_CLASS],
                [r`    var ship: Ship?`, RC_PILOT_SHIP],
                [r`    deinit { print("Pilot freed") }`, RC_PILOT_DEINIT],
                ['}', null],
                [r`final class Ship {`, RC_SHIP_CLASS],
                [r`    weak var pilot: Pilot?`, RC_SHIP_PILOT_WEAK],
                [r`    deinit { print("Ship freed") }`, RC_SHIP_DEINIT],
                ['}', null],
                [r`var pilot: Pilot? = Pilot()`, RC_VAR_PILOT],
                [r`var ship: Ship? = Ship()`, RC_VAR_SHIP],
                [r`print("Created pilot and ship")`, RC_PRINT_CREATED],
                [r`pilot?.ship = ship`, RC_LINK1],
                [r`print("Pilot holds the ship")`, RC_PRINT_HOLDS],
                [r`ship?.pilot = pilot`, RC_LINK2],
                [r`print("Cycle closed")`, RC_PRINT_CYCLE],
                [r`pilot = nil`, RC_NIL_PILOT],
                [r`ship = nil`, RC_NIL_SHIP],
                [r`print("after release")`, RC_PRINT_AFTER],
              ],
              expect: "Created pilot and ship\nPilot holds the ship\nCycle closed\nPilot freed\nShip freed\nafter release",
            },
          ],
          tryIt: {
            task: "<p>A Driver and a Car hold each other strongly and leak the same way. Change the starter so releasing both variables frees both objects, keeping the driver to car link strong.</p>",
            lines: [
              [r`final class Driver {`, RC_TRY_DRIVER_CLASS],
              [r`    var car: Car?`, RC_TRY_DRIVER_CAR],
              [r`    deinit { print("Driver freed") }`, RC_TRY_DRIVER_DEINIT],
              ['}', null],
              [r`final class Car {`, RC_TRY_CAR_CLASS],
              [r`    var driver: Driver?`, RC_TRY_CAR_DRIVER_STRONG],
              [r`    deinit { print("Car freed") }`, RC_TRY_CAR_DEINIT],
              ['}', null],
              [r`var driver: Driver? = Driver()`, RC_TRY_VAR_DRIVER],
              [r`var car: Car? = Car()`, RC_TRY_VAR_CAR],
              [r`driver?.car = car`, RC_TRY_LINK1],
              [r`car?.driver = driver`, RC_TRY_LINK2],
              [r`driver = nil`, RC_TRY_NIL_DRIVER],
              [r`car = nil`, RC_TRY_NIL_CAR],
              [r`print("after release")`, RC_TRY_PRINT_AFTER],
            ],
            solution: [
              [r`final class Driver {`, RC_TRY_DRIVER_CLASS],
              [r`    var car: Car?`, RC_TRY_DRIVER_CAR],
              [r`    deinit { print("Driver freed") }`, RC_TRY_DRIVER_DEINIT],
              ['}', null],
              [r`final class Car {`, RC_TRY_CAR_CLASS],
              [r`    weak var driver: Driver?`, RC_TRY_CAR_DRIVER_WEAK],
              [r`    deinit { print("Car freed") }`, RC_TRY_CAR_DEINIT],
              ['}', null],
              [r`var driver: Driver? = Driver()`, RC_TRY_VAR_DRIVER],
              [r`var car: Car? = Car()`, RC_TRY_VAR_CAR],
              [r`driver?.car = car`, RC_TRY_LINK1],
              [r`car?.driver = driver`, RC_TRY_LINK2],
              [r`driver = nil`, RC_TRY_NIL_DRIVER],
              [r`car = nil`, RC_TRY_NIL_CAR],
              [r`print("after release")`, RC_TRY_PRINT_AFTER],
            ],
            expect: "Driver freed\nCar freed\nafter release",
          },
        },
        {
          kind: 'example',
          title: "Find the work that busts a 16.7 ms frame",
          problem: "<p>Model one frame of a scrolling list in tenths of a millisecond: input, update, layout and render for twenty items. Find the segment that pushes the total over the 16.7 ms budget, then cache it and fit.</p>",
          adapter: 'diagram',
          diagram: 'frame-budget',
          frames: [
            {
              caption: "The model starts with the item count, a tenths formatter, and the input segment alone: twenty items at one tenth each. The first total is two milliseconds, well inside budget.",
              lines: [
                [r`let items = 20`, FB_ITEMS],
                [r`func ms(_ tenths: Int) -> String {`, FB_FUNC],
                [r`    "\(tenths / 10).\(tenths % 10)"`, FB_FUNC_BODY],
                ['}', null],
                [r`let inputTenths = items * 1`, FB_INPUT],
                [r`var totalTenths = inputTenths`, FB_TOTAL_INPUT],
                [r`print("Input: \(ms(inputTenths)) ms")`, FB_PRINT_INPUT],
                [r`print("Total: \(ms(totalTenths)) ms")`, FB_PRINT_TOTAL],
              ],
              diagram: {"segments": [{"label": "Input", "ms": 2.0}], "budget": 16.7, "note": "Only input is modelled so far"},
              claims: ["Input: 2.0 ms", "Total: 2.0 ms"],
            },
            {
              caption: "Update joins at two tenths per item, four milliseconds. The running total is six milliseconds; the frame still fits with plenty of the budget left.",
              lines: [
                [r`let items = 20`, FB_ITEMS],
                [r`func ms(_ tenths: Int) -> String {`, FB_FUNC],
                [r`    "\(tenths / 10).\(tenths % 10)"`, FB_FUNC_BODY],
                ['}', null],
                [r`let inputTenths = items * 1`, FB_INPUT],
                [r`let updateTenths = items * 2`, FB_UPDATE],
                [r`var totalTenths = inputTenths + updateTenths`, FB_TOTAL_IU],
                [r`print("Input: \(ms(inputTenths)) ms")`, FB_PRINT_INPUT],
                [r`print("Update: \(ms(updateTenths)) ms")`, FB_PRINT_UPDATE],
                [r`print("Total: \(ms(totalTenths)) ms")`, FB_PRINT_TOTAL],
              ],
              diagram: {"segments": [{"label": "Input", "ms": 2.0}, {"label": "Update", "ms": 4.0}], "budget": 16.7, "note": "Input plus update: 6.0 ms"},
              claims: ["Update: 4.0 ms", "Total: 6.0 ms"],
            },
            {
              caption: "Naive layout arrives and it redoes work per item: items times items in the formula. Layout alone is twelve milliseconds and the total is already over budget at eighteen.",
              lines: [
                [r`let items = 20`, FB_ITEMS],
                [r`func ms(_ tenths: Int) -> String {`, FB_FUNC],
                [r`    "\(tenths / 10).\(tenths % 10)"`, FB_FUNC_BODY],
                ['}', null],
                [r`let inputTenths = items * 1`, FB_INPUT],
                [r`let updateTenths = items * 2`, FB_UPDATE],
                [r`let layoutTenths = items * items * 3 / 10`, FB_LAYOUT_NAIVE],
                [r`var totalTenths = inputTenths + updateTenths`, FB_TOTAL_IU],
                [r`totalTenths += layoutTenths`, FB_ADD_LAYOUT],
                [r`print("Input: \(ms(inputTenths)) ms")`, FB_PRINT_INPUT],
                [r`print("Update: \(ms(updateTenths)) ms")`, FB_PRINT_UPDATE],
                [r`print("Layout: \(ms(layoutTenths)) ms")`, FB_PRINT_LAYOUT],
                [r`print("Total: \(ms(totalTenths)) ms")`, FB_PRINT_TOTAL],
              ],
              diagram: {"segments": [{"label": "Input", "ms": 2.0}, {"label": "Update", "ms": 4.0}, {"label": "Layout", "ms": 12.0}], "budget": 16.7, "note": "Naive layout busts the budget on its own"},
              claims: ["Layout: 12.0 ms", "Total: 18.0 ms"],
            },
            {
              caption: "Render adds three more milliseconds, for a total of twenty-one. The diagram and the printed total agree: this frame drops, and layout is most of the cost.",
              lines: [
                [r`let items = 20`, FB_ITEMS],
                [r`func ms(_ tenths: Int) -> String {`, FB_FUNC],
                [r`    "\(tenths / 10).\(tenths % 10)"`, FB_FUNC_BODY],
                ['}', null],
                [r`let inputTenths = items * 1`, FB_INPUT],
                [r`let updateTenths = items * 2`, FB_UPDATE],
                [r`let layoutTenths = items * items * 3 / 10`, FB_LAYOUT_NAIVE],
                [r`let renderTenths = items + 10`, FB_RENDER],
                [r`var totalTenths = inputTenths + updateTenths`, FB_TOTAL_IU],
                [r`totalTenths += layoutTenths`, FB_ADD_LAYOUT],
                [r`totalTenths += renderTenths`, FB_ADD_RENDER],
                [r`print("Input: \(ms(inputTenths)) ms")`, FB_PRINT_INPUT],
                [r`print("Update: \(ms(updateTenths)) ms")`, FB_PRINT_UPDATE],
                [r`print("Layout: \(ms(layoutTenths)) ms")`, FB_PRINT_LAYOUT],
                [r`print("Render: \(ms(renderTenths)) ms")`, FB_PRINT_RENDER],
                [r`print("Total: \(ms(totalTenths)) ms")`, FB_PRINT_TOTAL],
              ],
              diagram: {"segments": [{"label": "Input", "ms": 2.0}, {"label": "Update", "ms": 4.0}, {"label": "Layout", "ms": 12.0}, {"label": "Render", "ms": 3.0}], "budget": 16.7, "note": "21.0 ms against a 16.7 ms budget"},
              claims: ["Render: 3.0 ms", "Total: 21.0 ms"],
            },
            {
              caption: "The repair caches layout: the result is computed once, stored, and reused, so layout costs three milliseconds instead of twelve. The total drops to twelve and the frame fits.",
              lines: [
                [r`let items = 20`, FB_ITEMS],
                [r`func ms(_ tenths: Int) -> String {`, FB_FUNC],
                [r`    "\(tenths / 10).\(tenths % 10)"`, FB_FUNC_BODY],
                ['}', null],
                [r`let inputTenths = items * 1`, FB_INPUT],
                [r`let updateTenths = items * 2`, FB_UPDATE],
                [r`let cachedLayoutTenths = 30`, FB_CACHED_DECL],
                [r`let layoutTenths = cachedLayoutTenths`, FB_LAYOUT_CACHED],
                [r`let renderTenths = items + 10`, FB_RENDER],
                [r`var totalTenths = inputTenths + updateTenths`, FB_TOTAL_IU],
                [r`totalTenths += layoutTenths`, FB_ADD_LAYOUT],
                [r`totalTenths += renderTenths`, FB_ADD_RENDER],
                [r`print("Input: \(ms(inputTenths)) ms")`, FB_PRINT_INPUT],
                [r`print("Update: \(ms(updateTenths)) ms")`, FB_PRINT_UPDATE],
                [r`print("Layout: \(ms(layoutTenths)) ms")`, FB_PRINT_LAYOUT],
                [r`print("Render: \(ms(renderTenths)) ms")`, FB_PRINT_RENDER],
                [r`print("Total: \(ms(totalTenths)) ms")`, FB_PRINT_TOTAL],
              ],
              diagram: {"segments": [{"label": "Input", "ms": 2.0}, {"label": "Update", "ms": 4.0}, {"label": "Layout", "ms": 3.0}, {"label": "Render", "ms": 3.0}], "budget": 16.7, "note": "Cached layout: total 12.0 ms"},
              claims: ["Layout: 3.0 ms", "Total: 12.0 ms"],
            },
            {
              caption: "A verdict line compares the total in tenths against one hundred sixty-seven, the budget in tenths. Twelve milliseconds is on time, and the diagram shows the same four segments.",
              lines: [
                [r`let items = 20`, FB_ITEMS],
                [r`func ms(_ tenths: Int) -> String {`, FB_FUNC],
                [r`    "\(tenths / 10).\(tenths % 10)"`, FB_FUNC_BODY],
                ['}', null],
                [r`let inputTenths = items * 1`, FB_INPUT],
                [r`let updateTenths = items * 2`, FB_UPDATE],
                [r`let cachedLayoutTenths = 30`, FB_CACHED_DECL],
                [r`let layoutTenths = cachedLayoutTenths`, FB_LAYOUT_CACHED],
                [r`let renderTenths = items + 10`, FB_RENDER],
                [r`var totalTenths = inputTenths + updateTenths`, FB_TOTAL_IU],
                [r`totalTenths += layoutTenths`, FB_ADD_LAYOUT],
                [r`totalTenths += renderTenths`, FB_ADD_RENDER],
                [r`print("Input: \(ms(inputTenths)) ms")`, FB_PRINT_INPUT],
                [r`print("Update: \(ms(updateTenths)) ms")`, FB_PRINT_UPDATE],
                [r`print("Layout: \(ms(layoutTenths)) ms")`, FB_PRINT_LAYOUT],
                [r`print("Render: \(ms(renderTenths)) ms")`, FB_PRINT_RENDER],
                [r`print("Total: \(ms(totalTenths)) ms")`, FB_PRINT_TOTAL],
                [r`if totalTenths <= 167 { print("Verdict: on time") }`, FB_VERDICT],
              ],
              diagram: {"segments": [{"label": "Input", "ms": 2.0}, {"label": "Update", "ms": 4.0}, {"label": "Layout", "ms": 3.0}, {"label": "Render", "ms": 3.0}], "budget": 16.7, "note": "12.0 ms: the frame ships on time"},
              claims: ["Total: 12.0 ms", "Verdict: on time"],
            },
          ],
          tryIt: {
            task: "<p>The starter costs layout as items times items for ten items and totals 15.0 ms. Change layout to a single cached cost of thirty tenths and print the new total.</p>",
            lines: [
              [r`let items = 10`, FB_TRY_ITEMS],
              [r`let inputTenths = 20`, FB_TRY_INPUT],
              [r`let layoutTenths = items * items`, FB_TRY_LAYOUT_NAIVE],
              [r`let renderTenths = 30`, FB_TRY_RENDER],
              [r`let totalTenths = inputTenths + layoutTenths + renderTenths`, FB_TRY_TOTAL],
              [r`print("Total: \(totalTenths / 10).\(totalTenths % 10) ms")`, FB_TRY_PRINT],
            ],
            solution: [
              [r`let items = 10`, FB_TRY_ITEMS],
              [r`let inputTenths = 20`, FB_TRY_INPUT],
              [r`let layoutTenths = 30`, FB_TRY_LAYOUT_CACHED],
              [r`let renderTenths = 30`, FB_TRY_RENDER],
              [r`let totalTenths = inputTenths + layoutTenths + renderTenths`, FB_TRY_TOTAL],
              [r`print("Total: \(totalTenths / 10).\(totalTenths % 10) ms")`, FB_TRY_PRINT],
            ],
            expect: "Total: 8.0 ms",
          },
        },
        {
          kind: 'example',
          title: "Walk a release through its gates, including the one that fails",
          problem: "<p>Model a release as a checklist: build, signing, archive, validation and distribution gates, each printed from a simple fact. Validation fails on a missing privacy entry; add the entry and walk the release through.</p>",
          adapter: 'diagram',
          diagram: 'release',
          simulation: true,
          frames: [
            {
              caption: "The checklist helper formats any gate line, and the first fact says the build compiled. The Build gate prints PASS and the pipeline stands at its first stage.",
              lines: [
                [r`func gate(_ name: String, _ passed: Bool) -> String {`, RL_FUNC],
                [r`    if passed { return "\(name): PASS" }`, RL_FUNC_IF],
                [r`    return "\(name): FAIL"`, RL_FUNC_RETURN],
                ['}', null],
                [r`let buildOK = true`, RL_BUILD],
                [r`print(gate("Build", buildOK))`, RL_PRINT_BUILD],
              ],
              diagram: {"at": 0, "note": "Build gate cleared"},
              claims: ["Build: PASS"],
            },
            {
              caption: "The signing fact joins the checklist and its gate prints PASS. A signed build is the only kind that can be archived for distribution later.",
              lines: [
                [r`func gate(_ name: String, _ passed: Bool) -> String {`, RL_FUNC],
                [r`    if passed { return "\(name): PASS" }`, RL_FUNC_IF],
                [r`    return "\(name): FAIL"`, RL_FUNC_RETURN],
                ['}', null],
                [r`let buildOK = true`, RL_BUILD],
                [r`let signed = true`, RL_SIGNED],
                [r`print(gate("Build", buildOK))`, RL_PRINT_BUILD],
                [r`print(gate("Signing", signed))`, RL_PRINT_SIGN],
              ],
              diagram: {"at": 1, "note": "Signing gate cleared"},
              claims: ["Signing: PASS"],
            },
            {
              caption: "The archive fact joins and the Archive gate prints PASS. Three stages are cleared; the archive is the exact build validation will now inspect.",
              lines: [
                [r`func gate(_ name: String, _ passed: Bool) -> String {`, RL_FUNC],
                [r`    if passed { return "\(name): PASS" }`, RL_FUNC_IF],
                [r`    return "\(name): FAIL"`, RL_FUNC_RETURN],
                ['}', null],
                [r`let buildOK = true`, RL_BUILD],
                [r`let signed = true`, RL_SIGNED],
                [r`let archived = true`, RL_ARCHIVED],
                [r`print(gate("Build", buildOK))`, RL_PRINT_BUILD],
                [r`print(gate("Signing", signed))`, RL_PRINT_SIGN],
                [r`print(gate("Archive", archived))`, RL_PRINT_ARCH],
              ],
              diagram: {"at": 2, "note": "Archive gate cleared"},
              claims: ["Archive: PASS"],
            },
            {
              caption: "Validation runs against a missing privacy entry and prints FAIL, with the reason and a blocked distribution line. The diagram marks the Validation stage as failed.",
              lines: [
                [r`func gate(_ name: String, _ passed: Bool) -> String {`, RL_FUNC],
                [r`    if passed { return "\(name): PASS" }`, RL_FUNC_IF],
                [r`    return "\(name): FAIL"`, RL_FUNC_RETURN],
                ['}', null],
                [r`let buildOK = true`, RL_BUILD],
                [r`let signed = true`, RL_SIGNED],
                [r`let archived = true`, RL_ARCHIVED],
                [r`var hasPrivacy = false`, RL_PRIVACY_BAD],
                [r`print(gate("Build", buildOK))`, RL_PRINT_BUILD],
                [r`print(gate("Signing", signed))`, RL_PRINT_SIGN],
                [r`print(gate("Archive", archived))`, RL_PRINT_ARCH],
                [r`print(gate("Validation", hasPrivacy))`, RL_PRINT_VAL],
                [r`print("Validation failed: missing privacy entry")`, RL_REASON],
                [r`print("Distribution: BLOCKED")`, RL_PRINT_BLOCKED],
              ],
              diagram: {"at": 3, "failed": 3, "note": "Validation failed: privacy entry missing"},
              claims: ["Validation: FAIL", "Validation failed: missing privacy entry", "Distribution: BLOCKED"],
            },
            {
              caption: "The fix is the missing entry itself: the privacy fact becomes true and nothing else changes. Validation now prints PASS at the same stage that failed before.",
              lines: [
                [r`func gate(_ name: String, _ passed: Bool) -> String {`, RL_FUNC],
                [r`    if passed { return "\(name): PASS" }`, RL_FUNC_IF],
                [r`    return "\(name): FAIL"`, RL_FUNC_RETURN],
                ['}', null],
                [r`let buildOK = true`, RL_BUILD],
                [r`let signed = true`, RL_SIGNED],
                [r`let archived = true`, RL_ARCHIVED],
                [r`var hasPrivacy = true`, RL_PRIVACY_OK],
                [r`print(gate("Build", buildOK))`, RL_PRINT_BUILD],
                [r`print(gate("Signing", signed))`, RL_PRINT_SIGN],
                [r`print(gate("Archive", archived))`, RL_PRINT_ARCH],
                [r`print(gate("Validation", hasPrivacy))`, RL_PRINT_VAL],
              ],
              diagram: {"at": 3, "note": "Validation passed after the fix"},
              claims: ["Validation: PASS"],
            },
            {
              caption: "With every earlier gate green, the distribution line prints READY and the pipeline reaches its last stage. The release walked through all five gates in order.",
              lines: [
                [r`func gate(_ name: String, _ passed: Bool) -> String {`, RL_FUNC],
                [r`    if passed { return "\(name): PASS" }`, RL_FUNC_IF],
                [r`    return "\(name): FAIL"`, RL_FUNC_RETURN],
                ['}', null],
                [r`let buildOK = true`, RL_BUILD],
                [r`let signed = true`, RL_SIGNED],
                [r`let archived = true`, RL_ARCHIVED],
                [r`var hasPrivacy = true`, RL_PRIVACY_OK],
                [r`print(gate("Build", buildOK))`, RL_PRINT_BUILD],
                [r`print(gate("Signing", signed))`, RL_PRINT_SIGN],
                [r`print(gate("Archive", archived))`, RL_PRINT_ARCH],
                [r`print(gate("Validation", hasPrivacy))`, RL_PRINT_VAL],
                [r`if hasPrivacy { print("Distribution: READY") }`, RL_DIST],
              ],
              diagram: {"at": 4, "note": "Distribution ready: all gates passed"},
              claims: ["Distribution: READY"],
            },
          ],
          tryIt: {
            task: "<p>The starter release is signed but has no app icon, so its verdict is blocked. Supply the missing icon fact and make the same checklist print the ready verdict.</p>",
            lines: [
              [r`let signed = true`, RL_TRY_SIGNED],
              [r`let hasIcon = false`, RL_TRY_ICON_BAD],
              [r`let ready = signed && hasIcon`, RL_TRY_READY],
              [r`print(ready ? "Release: READY" : "Release: BLOCKED")`, RL_TRY_PRINT],
            ],
            solution: [
              [r`let signed = true`, RL_TRY_SIGNED],
              [r`let hasIcon = true`, RL_TRY_ICON_OK],
              [r`let ready = signed && hasIcon`, RL_TRY_READY],
              [r`print(ready ? "Release: READY" : "Release: BLOCKED")`, RL_TRY_PRINT],
            ],
            expect: "Release: READY",
          },
        },
  ],
};

export default {
  id: 'shipping',
  number: 9,
  title: 'Architecture, Testing and Shipping',
  short: 'Ship It',
  summary: 'Structure an app with MVVM and dependency injection, prove it works with Swift Testing and UI tests, find bugs with the debugger and Instruments, and take it through TestFlight and App Review to the App Store.',
  objectives: ['CLO3', 'CLO1'],
  outcomes: ['SLO2', 'SLO4', 'SLO3'],
  lessons: [
    architecture,
    testingBasics,
    uiTesting,
    debugging,
    performanceQuality,
    release,
    capstone,
    workedExamples,
  ],
};

// Plain-language glossary of Swift and SwiftUI terms. Used for keyword tooltips
// in the editor and to explain lines a student has edited or added.
export const GLOSSARY = {
  import: 'Brings a framework (a library from Apple or a package) into this file so its types and functions can be used.',
  let: 'Declares a constant: a named value that can never be reassigned after it is set.',
  var: 'Declares a variable: a named value that can change later.',
  func: 'Declares a function: a named, reusable block of code that can take inputs and return an output.',
  return: 'Ends the function and hands a value back to whoever called it.',
  struct: 'Declares a structure, a value type. Copies are independent, so changing one never affects another.',
  class: 'Declares a class, a reference type. Variables share one object, and classes can inherit from other classes.',
  enum: 'Declares an enumeration: a type with a fixed set of named cases, optionally carrying associated values.',
  protocol: 'Declares a protocol: a list of requirements (properties and methods) that conforming types promise to provide.',
  extension: 'Adds new methods, computed properties, or protocol conformances to an existing type.',
  actor: 'Declares an actor: a reference type that protects its mutable state so only one task touches it at a time.',
  init: 'An initializer: code that runs while a new instance is being created, giving every stored property a value.',
  deinit: 'A deinitializer: code that runs just before a class instance is freed from memory.',
  self: 'The current instance: the value whose method or property is running right now.',
  if: 'Runs a block only when a condition is true.',
  else: 'The block that runs when the preceding if condition was false.',
  guard: 'Checks a condition early and exits the current scope if it fails, keeping the main path unindented.',
  switch: 'Compares a value against several patterns and runs the first matching case. Swift requires every possibility to be handled.',
  case: 'One branch of a switch, or one possible value of an enum.',
  default: 'The switch branch that runs when no other case matched.',
  for: 'Repeats a block once for each element of a sequence, such as a range or an array.',
  in: 'Separates a loop variable (or closure parameters) from what follows.',
  while: 'Repeats a block as long as a condition stays true.',
  repeat: 'Runs a block once, then keeps repeating it while a condition stays true.',
  break: 'Leaves the current loop or switch immediately.',
  continue: 'Skips the rest of this loop iteration and moves to the next one.',
  throw: 'Signals an error. Execution jumps to the nearest catch.',
  throws: 'Marks a function that can throw an error; callers must use try.',
  try: 'Calls something that can throw. try? turns errors into nil; try! crashes on an error.',
  do: 'Starts a block whose thrown errors are handled by the catch clauses that follow.',
  catch: 'Handles an error thrown inside the matching do block.',
  defer: 'Schedules code to run when the current scope exits, however it exits.',
  async: 'Marks a function that can pause while waiting (for the network, a timer, a file) without blocking the app.',
  await: 'Marks a point where the code may pause until an async operation finishes.',
  Task: 'Starts new concurrent work, for example from a button tap.',
  nil: 'The absence of a value. Only optional types can hold nil.',
  true: 'The Boolean value for yes.',
  false: 'The Boolean value for no.',
  static: 'Belongs to the type itself rather than to any one instance.',
  private: 'Hides a declaration from code outside its enclosing type or file.',
  mutating: 'Marks a struct or enum method that changes self. It can only be called on a var.',
  override: 'Replaces a method or property inherited from a superclass.',
  final: 'Prevents a class from being subclassed (or a member from being overridden).',
  weak: 'A reference that does not keep an object alive. It becomes nil when the object is freed.',
  some: 'An opaque type: "some specific type that conforms to this protocol", chosen by the implementation.',
  any: 'An existential type: a box that can hold any value conforming to the protocol.',
  where: 'Adds an extra condition to a pattern, loop, or generic constraint.',
  typealias: 'Gives an existing type a new, more descriptive name.',
  print: 'Writes text to the console (the output panel). Helpful for learning and debugging; not visible to app users.',
  Int: 'A whole number, positive or negative.',
  Double: 'A number with a fractional part, stored with about 15 significant digits.',
  String: 'Text: a sequence of characters.',
  Bool: 'A true or false value.',
  Character: 'A single user-perceived character, such as "a" or an emoji.',
  Array: 'An ordered list of values of one type, accessed by position starting at 0.',
  Dictionary: 'An unordered collection of key-value pairs; you look values up by key.',
  Set: 'An unordered collection of unique values, fast to test for membership.',
  Optional: 'A value that may be present or nil. Written with a question mark, as in Int?.',
  View: 'The SwiftUI protocol for anything that appears on screen. A view is a description, cheap to create and recreate.',
  body: 'The computed property where a SwiftUI view describes its content. SwiftUI calls it whenever the view’s data changes.',
  '@State': 'Property wrapper that gives a view its own source of truth. Changing it makes SwiftUI re-run body.',
  '@Binding': 'Property wrapper for a two-way connection to state owned by another view.',
  '@Observable': 'Macro that makes a class’s properties observable, so views using them update when they change.',
  '@Environment': 'Reads a value provided by the environment, such as the color scheme or a shared model.',
  '@AppStorage': 'Reads and writes a small value in UserDefaults, so it persists between launches.',
  '@Bindable': 'Lets you create bindings ($) to properties of an @Observable object.',
  '@MainActor': 'Runs code on the main thread, where all UI work must happen.',
  '@main': 'Marks the app’s entry point: the type iOS starts when the app launches.',
  '@Model': 'SwiftData macro that turns a class into a persisted database model.',
  '@Test': 'Swift Testing macro that marks a function as a test.',
  '#Preview': 'Shows a live preview of a view in Xcode’s canvas (and in this page).',
  '#expect': 'Swift Testing macro that checks a condition and records a failure if it is false.',
  VStack: 'Arranges child views vertically, top to bottom.',
  HStack: 'Arranges child views horizontally, leading to trailing.',
  ZStack: 'Layers child views on top of each other, back to front.',
  Text: 'Displays read-only text.',
  Image: 'Displays an image or an SF Symbol icon.',
  Button: 'A control that runs an action when tapped.',
  List: 'A scrolling list of rows, styled for iOS.',
  ForEach: 'Creates one view per element of a collection.',
  NavigationStack: 'A container that pushes and pops screens as the user drills into content.',
  NavigationLink: 'A tappable row or button that pushes another screen onto the navigation stack.',
  TabView: 'Switches between top-level sections with a tab bar.',
  Toggle: 'An on/off switch bound to a Bool.',
  TextField: 'An editable single-line text input bound to a String.',
  Slider: 'Selects a number from a range by dragging.',
  Spacer: 'Flexible empty space that pushes neighboring views apart.',
  padding: 'Modifier that adds space around a view (16 points by default).',
  font: 'Modifier that sets the text style, such as .title or .body, which scales with Dynamic Type.',
  foregroundStyle: 'Modifier that sets the color or style of text and symbols.',
  frame: 'Modifier that proposes a size for a view or lets it expand to fill available space.',
  background: 'Modifier that draws a color, material, or view behind the view.',
  glassEffect: 'Modifier that renders a Liquid Glass surface (iOS 26) behind the view.',
  URLSession: 'Apple’s networking API for HTTP requests.',
  JSONDecoder: 'Turns JSON data into Swift values that conform to Decodable.',
  JSONEncoder: 'Turns Swift values that conform to Encodable into JSON data.',
  Codable: 'Shorthand for Encodable & Decodable: the type can be converted to and from formats like JSON.',
  Identifiable: 'A type with a stable id property, so SwiftUI can track each element in a list.',
  Equatable: 'A type whose values can be compared with ==.',
  closure: 'An unnamed function you can store or pass around, written in braces.',
};

const WORD = /@?#?[A-Za-z_][A-Za-z0-9_]*/g;

export function termsInLine(line) {
  const code = line.replace(/\/\/.*$/, '').replace(/"(?:[^"\\]|\\.)*"/g, '""');
  const found = [];
  for (const m of code.matchAll(WORD)) {
    const w = m[0];
    const has = (k) => Object.prototype.hasOwnProperty.call(GLOSSARY, k);
    if (has(w) && !found.includes(w)) found.push(w);
    const bare = w.replace(/^[@#]/, '');
    if (w !== bare && has(bare) && !found.includes(bare) && !has(w)) found.push(bare);
  }
  if (/\{\s*(\(|[a-z_$][\w$]*\s*(,\s*[a-z_$][\w$]*)*\s+in\b)/i.test(code) || /\{\s*\$0/.test(code)) found.push('closure');
  return found;
}

// A best-effort five-part explanation for a line that differs from the original.
export function autoExplain(line) {
  const t = line.trim();
  const terms = termsInLine(t);
  const what = terms.length
    ? terms.slice(0, 3).map((w) => `${w}: ${GLOSSARY[w]}`).join(' ')
    : 'A line you wrote or changed. Run the code to see what it does.';
  let who = 'The Swift compiler reads this line; the runtime executes it.';
  let when = 'When execution reaches this line.';
  if (/^(import)\b/.test(t)) { who = 'The Swift compiler.'; when = 'At compile time, before the program runs.'; }
  if (/^(struct|class|enum|protocol|extension|actor)\b/.test(t)) { when = 'At compile time; the type exists for the whole program.'; }
  if (/\.(padding|font|foregroundStyle|frame|background|glassEffect)\b/.test(t) || /^(VStack|HStack|ZStack|Text|Button|List)\b/.test(t)) { who = 'SwiftUI, while it evaluates body.'; when = 'Every time SwiftUI recomputes this view’s body.'; }
  return {
    who,
    what,
    where: 'In the editor line shown; its scope is the enclosing braces.',
    when,
    why: 'This line is new or edited, so it has no hand-written note. Compare it with the original line (Reset restores it) and run the code to test your idea.',
    auto: true,
  };
}

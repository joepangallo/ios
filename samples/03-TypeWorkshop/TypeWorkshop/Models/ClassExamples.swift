// ClassExamples.swift
// Who: the 3.2 lesson screen runs these programs and drives the memory lab;
//      the unit tests check the same programs and the lab's bookkeeping.
// What: the class programs from the course lesson "Classes and Reference
//       Semantics" (a joint bank account, inheritance with override and super,
//       struct-versus-class settings), a lab that runs the same lines in a struct
//       world and a class world and counts references, and the decision guide.
// Where: the Models folder; Lesson_3_2_Classes.swift is the screen that uses them.
// When: run() executes when the screen draws; the lab changes when a button is tapped.
// Why: assignment copies a struct but shares a class. Seeing both side by side,
//      with ARC freeing objects nobody refers to, makes the difference concrete.

import Observation // Observation provides @Observable for the memory lab.

/// Course step "A class with an initializer": a joint account shared by two constants.
enum AClassWithAnInitializer { // A caseless enum used as a namespace for this example.
    class BankAccount { // A reference type: instances live on the heap.
        let owner: String // The owners never change, so let.
        var balance: Double // Changed by deposits.

        init(owner: String, balance: Double) { // Classes get no memberwise init; we write one.
            self.owner = owner // self.owner is the property, owner the parameter.
            self.balance = balance // Every stored property must be set before init ends.
        }

        func deposit(_ amount: Double) { // No mutating keyword: a class method changes the shared object.
            balance += amount // Every reference to this object sees the new balance.
        }
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        let joint = BankAccount(owner: "Ana and Ben", balance: 100) // One object on the heap; joint holds a reference.
        let sameAccount = joint // Copies the reference, not the account.
        sameAccount.deposit(50) // Changes the one shared object, even though sameAccount is a let.
        out.print(joint.balance) // 150.0: the deposit is visible through joint.
        out.print(joint === sameAccount) // true: both constants refer to the same object.
        return out // The two printed lines.
    }
}

/// Course step "Inheritance, override, super and final".
enum InheritanceOverrideSuperFinal { // Namespace for this step's example.
    class Account { // The base class; not final, so subclasses are allowed.
        var balance: Double // Inherited by every subclass.
        init(balance: Double) { self.balance = balance } // A subclass with no new stored properties inherits this init.

        func monthEnd() -> String { // The method subclasses may override.
            "Balance: \(balance)" // A single-expression body returns implicitly.
        }
    }

    final class SavingsAccount: Account { // A kind of Account; final means nothing may subclass it.
        override func monthEnd() -> String { // override is mandatory when replacing an inherited method.
            balance += balance * 0.01 // Adds 1 percent interest to the inherited balance.
            return "Interest added. " + super.monthEnd() // super runs Account's version, which reports the new balance.
        }
    }

    /// The two accounts the course program starts with: a plain one and a savings one.
    static func makeAccounts() -> [Account] { // Shared by run() and the live demo on screen.
        [ // An array typed as the superclass holds subclass instances too: polymorphism.
            Account(balance: 200), // Uses the base monthEnd().
            SavingsAccount(balance: 1000), // Uses the init it inherited from Account.
        ]
    }

    /// Calls monthEnd() on each account, the way the course program's loop does.
    static func monthEndReport(for accounts: [Account]) -> Transcript { // One printed line per account.
        var out = Transcript() // Collects the printed lines.
        for account in accounts { // account has the static type Account.
            out.print(account.monthEnd()) // Dynamic dispatch: the object decides which version runs.
        }
        return out // One line per account.
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        monthEndReport(for: makeAccounts()) // Fresh accounts, one pass of the loop.
    }
}

/// Left side of the compare "Copy a struct, share a class".
enum CopyAStruct { // Namespace for the struct version.
    struct Settings { // A value type: assignment copies.
        var volume = 5 // A default gives the struct a no-argument initializer.
    }

    /// Runs the left-hand program and returns what it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        let phone = Settings() // Volume 5. The course wrote var; only tablet changes, so let is enough here.
        var tablet = phone // Copies every stored property into a brand-new value.
        tablet.volume = 9 // Changes tablet's copy only.
        out.print(phone.volume, tablet.volume) // 5 9: the original kept its volume.
        return out // The one printed line.
    }
}

/// Right side of the compare "Copy a struct, share a class".
enum ShareAClass { // Namespace for the class version.
    class Settings { // A reference type: assignment shares.
        var volume = 5 // With every property defaulted, the class gets a free init().
    }

    /// Runs the right-hand program and returns what it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        let phone = Settings() // One object on the heap.
        let tablet = phone // Copies the reference: two names, one object.
        tablet.volume = 9 // Changes the shared object; allowed because let fixes only the reference.
        out.print(phone.volume, tablet.volume) // 9 9: phone sees the change made through tablet.
        return out // The one printed line.
    }
}

/// The struct world of the memory lab: Account is a value type.
enum ValueWorld { // Namespace, so both worlds can call their type Account.
    struct Account { var balance: Double } // Each variable holds its own independent copy.
}

/// The class world of the memory lab: Account is a reference type.
enum ReferenceWorld { // Namespace for the class version.
    final class Account { // Variables hold references to shared objects on the heap.
        var balance: Double // Changes are seen by every reference to the object.
        init(balance: Double) { self.balance = balance } // Classes need a written init.
    }
}

/// Course widget "See it in memory: values and references".
/// Both worlds start with `var a = Account(balance: 100)`. Each operation runs the
/// same line in both worlds. The class world also tracks every object it created
/// with a weak reference, so the screen can show when ARC really frees one.
@Observable // The screen redraws after every operation.
final class ValueReferenceLab { // A class: one lab the screen keeps and changes.
    /// The lines the student can run, in the order the buttons appear.
    enum Operation: CaseIterable { // CaseIterable lets the screen make one button per case.
        case copy // var b = a
        case changeB // b.balance += 50
        case changeA // a.balance -= 20
        case newB // b = Account(balance: 0)
        case identity // print(a === b)
    }

    /// One object the class world created, remembered weakly.
    struct HeapEntry: Identifiable { // Identifiable so a ForEach can list the heap.
        let id: Int // 1 for the first object created, 2 for the second, and so on.
        weak var object: ReferenceWorld.Account? // weak: does not keep the object alive; becomes nil when ARC frees it.
    }

    private(set) var structA = ValueWorld.Account(balance: 100) // The struct world's a.
    private(set) var structB: ValueWorld.Account? // The struct world's b; nil until declared.
    private(set) var classA: ReferenceWorld.Account // The class world's a, a strong reference.
    private(set) var classB: ReferenceWorld.Account? // The class world's b; nil until declared.
    private(set) var heap: [HeapEntry] = [] // Every object created so far, alive or freed.
    private(set) var log: [String] = [] // The lines run so far, with any printed results.

    init() { // Starts both worlds with var a = Account(balance: 100).
        let first = ReferenceWorld.Account(balance: 100) // The first heap object.
        classA = first // a refers to it.
        heap = [HeapEntry(id: 1, object: first)] // Remember it weakly as object 1.
    }

    var hasB: Bool { classB != nil } // Both worlds declare b at the same moment.

    /// The Swift line an operation stands for, as its button shows it.
    func code(for operation: Operation) -> String { // The first copy or new account also declares b.
        switch operation { // One line per operation.
        case .copy: hasB ? "b = a" : "var b = a" // var only the first time b appears.
        case .changeB: "b.balance += 50" // Changes b.
        case .changeA: "a.balance -= 20" // Changes a.
        case .newB: hasB ? "b = Account(balance: 0)" : "var b = Account(balance: 0)" // A brand-new instance for b.
        case .identity: "print(a === b)" // Same object?
        }
    }

    /// Whether the operation can run yet: changing or comparing b needs b to exist.
    func isEnabled(_ operation: Operation) -> Bool { // Used to disable buttons.
        switch operation { // Only two operations need b.
        case .changeB, .identity: hasB // b must be declared first.
        case .copy, .changeA, .newB: true // Always possible.
        }
    }

    /// Runs one line in both worlds and records it in the log.
    func run(_ operation: Operation) { // Called by a button.
        guard isEnabled(operation) else { return } // Ignore lines that would not compile yet.
        let line = code(for: operation) // Remember the text before b's declaration changes it.
        switch operation { // The same line, executed in both worlds.
        case .copy: // b = a
            structB = structA // Copies the whole value.
            classB = classA // Copies the reference only.
            log.append(line) // Nothing printed.
        case .changeB: // b.balance += 50
            structB?.balance += 50 // Changes the struct copy in b.
            classB?.balance += 50 // Changes whatever object b refers to.
            log.append(line) // Nothing printed.
        case .changeA: // a.balance -= 20
            structA.balance -= 20 // Changes the struct value in a.
            classA.balance -= 20 // Changes the object a refers to.
            log.append(line) // Nothing printed.
        case .newB: // b = Account(balance: 0)
            structB = ValueWorld.Account(balance: 0) // A new value for b.
            let fresh = ReferenceWorld.Account(balance: 0) // A new object on the heap.
            heap.append(HeapEntry(id: heap.count + 1, object: fresh)) // Remember it weakly.
            classB = fresh // b now refers to the new object; the old one may lose its last reference here.
            log.append(line) // Nothing printed.
        case .identity: // print(a === b)
            let same = classB.map { $0 === classA } ?? false // Identity: the very same object?
            log.append("\(line)  // class world prints \(same); struct world does not compile") // Structs have no identity.
        }
    }

    /// Starts both worlds over.
    func reset() { // Called by the Reset button.
        let first = ReferenceWorld.Account(balance: 100) // A fresh first object.
        structA = ValueWorld.Account(balance: 100) // A fresh struct value.
        structB = nil // b no longer exists.
        classA = first // a refers to the fresh object.
        classB = nil // Dropping b releases its object if nothing else refers to it.
        heap = [HeapEntry(id: 1, object: first)] // Only the fresh object is listed.
        log = [] // Nothing has run yet.
    }

    /// How many of the variables a and b refer to this object: the references ARC counts here.
    func referenceCount(of object: ReferenceWorld.Account) -> Int { // 0, 1 or 2 in this lab.
        var count = 0 // Start with no references.
        if classA === object { count += 1 } // a refers to it.
        if let classB, classB === object { count += 1 } // b refers to it.
        return count // The total.
    }

    /// Which names refer to this object, such as "a, b".
    func names(for object: ReferenceWorld.Account) -> String { // Shown next to each heap object.
        var names: [String] = [] // Collected in order.
        if classA === object { names.append("a") } // a refers to it.
        if let classB, classB === object { names.append("b") } // b refers to it.
        return names.joined(separator: ", ") // For example "a, b".
    }
}

/// The concept step "Struct or class? A decision guide", as data for a picker.
enum StructOrClassGuide { // Namespace for the guide.
    /// The four kinds of type the guide compares.
    enum Kind: String { // String raw values double as display names.
        case structType = "Struct" // Data that is copied.
        case classType = "Class" // A shared thing with identity.
        case enumType = "Enum" // A fixed set of possibilities.
        case actorType = "Actor" // A reference type that protects its state.
    }

    /// One thing an app might model, with the kind the course recommends.
    struct Example: Identifiable, Hashable { // Hashable so it can be a Picker selection.
        let name: String // What is being modeled.
        let kind: Kind // The recommended kind of type.
        var id: String { name } // Names are unique in the list below.
    }

    /// The course's own examples, in the order the guide lists them.
    static let examples: [Example] = [ // Every example named on the course page.
        Example(name: "A to-do item", kind: .structType), // Plain data.
        Example(name: "A coffee order", kind: .structType), // Plain data.
        Example(name: "A weather reading", kind: .structType), // Plain data.
        Example(name: "A SwiftUI view", kind: .structType), // Views are structs.
        Example(name: "The one cart that several screens update", kind: .classType), // Shared identity.
        Example(name: "A download in progress", kind: .classType), // Shared identity with a lifecycle.
        Example(name: "An @Observable model that views watch", kind: .classType), // Shared, observed state.
        Example(name: "A coffee size", kind: .enumType), // A fixed set of possibilities.
        Example(name: "A loading state", kind: .enumType), // A fixed set of possibilities.
        Example(name: "A counter that many tasks update at once", kind: .actorType), // Shared state that must be protected.
    ]

    /// The course's explanation for each kind.
    static func reason(for kind: Kind) -> String { // Shown under the picker.
        switch kind { // One sentence per kind, from the course page.
        case .structType: "Data: a to-do item, a coffee order, a weather reading, a SwiftUI view." // Struct point.
        case .classType: "A shared thing with identity: the one cart that several screens update, a download in progress, an @Observable model that views watch." // Class point.
        case .enumType: "A fixed set of possibilities, such as a coffee size or a loading state." // Enum point.
        case .actorType: "A reference type that protects its state from data races." // Actor point.
        }
    }

    /// The course's quick test: should changing a copy change the original too?
    static func quickTest(originalShouldChange: Bool) -> Kind { // The answer decides struct or class.
        originalShouldChange ? .classType : .structType // Shared identity means a class; otherwise a struct.
    }
}

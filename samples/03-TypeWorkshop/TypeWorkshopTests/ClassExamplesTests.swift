// ClassExamplesTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks every program in lesson 3.2 against the course's expected
//       output, the memory lab's struct and class worlds (including ARC
//       really freeing objects), and the struct-or-class guide.
// Where: the TypeWorkshopTests target; the code under test is Models/ClassExamples.swift.
// When: only when tests run.
// Why: the memory lab is the screen students use to see copying versus
//      sharing, so its bookkeeping must be exactly right.

import Testing // Swift Testing: @Test and #expect.
@testable import TypeWorkshop // Lets the tests see the app's internal types.

@MainActor // The app's types are main-actor isolated by default.
struct ClassExamplesTests { // Lesson 3.2.
    @Test func jointAccountSharesDeposits() { // Course step "A class with an initializer".
        #expect(AClassWithAnInitializer.run().text == "150.0\ntrue") // The expected output.
        let joint = AClassWithAnInitializer.BankAccount(owner: "Ana and Ben", balance: 100) // One object.
        let third = AClassWithAnInitializer.BankAccount(owner: "Ana and Ben", balance: 100) // Equal contents, another object.
        #expect(joint !== third) // The course's try item: not the same object.
        third.deposit(5) // Changes only the third account.
        #expect(joint.balance == 100) // joint is unaffected.
    }

    @Test func monthEndDispatchesToTheSubclass() { // Course step "Inheritance, override, super and final".
        #expect(InheritanceOverrideSuperFinal.run().text == "Balance: 200.0\nInterest added. Balance: 1010.0") // The expected output.
        let accounts = InheritanceOverrideSuperFinal.makeAccounts() // Fresh accounts.
        #expect(accounts[1] is InheritanceOverrideSuperFinal.SavingsAccount) // The dynamic type of the second element.
        _ = InheritanceOverrideSuperFinal.monthEndReport(for: accounts) // First month.
        let second = InheritanceOverrideSuperFinal.monthEndReport(for: accounts) // Second month builds on the first.
        #expect(second.lines[0] == "Balance: 200.0") // The plain account never changes.
        #expect(second.lines[1].hasPrefix("Interest added. Balance: 1020.1")) // 1010.0 plus 1 percent.
    }

    @Test func structCopiesAndClassShares() { // Compare step "Copy a struct, share a class".
        #expect(CopyAStruct.run().text == "5 9") // Left side.
        #expect(ShareAClass.run().text == "9 9") // Right side.
    }

    @Test func labStartsWithOneObjectAndNoB() { // The widget's starting state.
        let lab = ValueReferenceLab() // Fresh lab.
        #expect(lab.structA.balance == 100) // var a = Account(balance: 100)
        #expect(lab.classA.balance == 100) // The same in the class world.
        #expect(!lab.hasB) // b is not declared yet.
        #expect(!lab.isEnabled(.changeB)) // Changing b needs b.
        #expect(!lab.isEnabled(.identity)) // Comparing needs b.
        #expect(lab.code(for: .copy) == "var b = a") // The first copy declares b.
        #expect(lab.heap.count == 1) // One object on the heap.
        #expect(lab.referenceCount(of: lab.classA) == 1) // Only a refers to it.
    }

    @Test func copyThenChangeBShowsTheDifference() { // The heart of the widget.
        let lab = ValueReferenceLab() // Fresh lab.
        lab.run(.changeB) // Ignored: b does not exist yet.
        #expect(lab.log.isEmpty) // Nothing ran.
        lab.run(.copy) // var b = a
        #expect(lab.code(for: .copy) == "b = a") // Later copies only assign.
        #expect(lab.classB === lab.classA) // Same object.
        #expect(lab.referenceCount(of: lab.classA) == 2) // a and b.
        #expect(lab.names(for: lab.classA) == "a, b") // Both names.
        lab.run(.changeB) // b.balance += 50
        #expect(lab.structA.balance == 100) // The struct original is untouched.
        #expect(lab.structB?.balance == 150) // Only the copy changed.
        #expect(lab.classA.balance == 150) // The class original changed too: shared object.
        lab.run(.changeA) // a.balance -= 20
        #expect(lab.structA.balance == 80) // Struct a changes alone.
        #expect(lab.structB?.balance == 150) // Struct b keeps its value.
        #expect(lab.classB?.balance == 130) // Class b sees the change.
        lab.run(.identity) // print(a === b)
        #expect(lab.log.last?.contains("prints true") == true) // Same object.
        #expect(lab.log.count == 4) // copy, changeB, changeA, identity.
    }

    @Test func arcFreesAnObjectWithNoReferences() { // "Watch ARC count the references to each object."
        let lab = ValueReferenceLab() // Fresh lab.
        lab.run(.newB) // var b = Account(balance: 0): a second object.
        #expect(lab.heap.count == 2) // Two objects.
        #expect(lab.code(for: .newB) == "b = Account(balance: 0)") // b now exists.
        lab.run(.identity) // Different objects now.
        #expect(lab.log.last?.contains("prints false") == true) // Not the same object.
        lab.run(.copy) // b = a: object 2 loses its only reference.
        #expect(lab.heap[1].object == nil) // ARC freed it; the weak reference became nil.
        #expect(lab.heap[0].object === lab.classA) // Object 1 is alive.
        lab.run(.newB) // Another new object for b.
        #expect(lab.heap.count == 3) // Object 3.
        #expect(lab.referenceCount(of: lab.classA) == 1) // Only a refers to object 1 again.
        lab.reset() // Start over.
        #expect(lab.heap.count == 1) // One fresh object.
        #expect(lab.log.isEmpty) // Nothing run.
        #expect(!lab.hasB) // b is gone.
    }

    @Test func guideCoversEveryKindAndTheQuickTest() { // Concept step "Struct or class? A decision guide".
        let kinds = Set(StructOrClassGuide.examples.map(\.kind.rawValue)) // Every kind used by an example.
        #expect(kinds == ["Struct", "Class", "Enum", "Actor"]) // All four appear.
        #expect(Set(StructOrClassGuide.examples.map(\.id)).count == StructOrClassGuide.examples.count) // ids are unique.
        #expect(StructOrClassGuide.quickTest(originalShouldChange: false) == .structType) // Independent copies: struct.
        #expect(StructOrClassGuide.quickTest(originalShouldChange: true) == .classType) // Shared identity: class.
        for kind in [StructOrClassGuide.Kind.structType, .classType, .enumType, .actorType] { // Every kind.
            #expect(!StructOrClassGuide.reason(for: kind).isEmpty) // Each has the course's explanation.
        }
    }
}

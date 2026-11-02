// BillSplitTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: the course's tests for share(of:tip:people:) from lesson 9.2: the first
//       two tests, the Splitting a bill suite with #require, both parameterized
//       tests, the course's try-it (a negative bill), and tests for the bug lab,
//       the #require demo and the testing pyramid model.
// Where: the StudyBuddyTests target.
// When: on every test run. share(of:tip:people:) is nonisolated, so these tests
//       need no actor.
// Why: these are the exact tests the lesson screen runs live, so the screen and
//      the test target can never disagree.

import Testing // Swift Testing: @Suite, @Test, #expect and #require.
@testable import StudyBuddy // Lets the tests see the app's internal types.

@Test func splitsTotalWithTip() { // A name that reads like a sentence.
    #expect(share(of: 100, tip: 20, people: 4) == 30) // $100 plus 20%, split four ways, is exactly 30.
}

@Test func rejectsZeroPeople() { // The invalid-input branch.
    #expect(share(of: 50, tip: 10, people: 0) == nil) // nil, never infinity.
}

@Test func rejectsNegativeBill() { // The course's try-it: the test that catches bug D.
    #expect(share(of: -10, tip: 0, people: 2) == nil) // A negative bill is invalid.
}

@Suite("Splitting a bill") // A readable heading in the Test navigator.
struct BillSplitTests { // A fresh instance per test keeps tests isolated.
    @Test("Zero tip splits only the bill") // A display name with spaces.
    func zeroTip() throws { // throws: #require throws to stop early.
        let each = try #require(share(of: 90, tip: 0, people: 3)) // Unwraps, or ends the test right here.
        #expect(each == 30) // The share.
        #expect(each * 3 == 90) // The shares add back up to the bill.
    }

    @Test("Shares round to the nearest cent") // The rounding requirement.
    func roundsToCents() { // No throws needed.
        #expect(share(of: 20, tip: 0, people: 3) == 6.67) // 6.666... rounds up.
    }
}

@Test("Each share includes the tip", arguments: [ // One test case per row.
    (bill: 100.0, tip: 20, people: 4, expected: 30.0), // The standard case.
    (bill: 60.0, tip: 15, people: 2, expected: 34.5), // An odd percentage.
    (bill: 10.0, tip: 0, people: 3, expected: 3.33), // Rounds down.
    (bill: 0.0, tip: 18, people: 5, expected: 0.0), // A zero bill is valid.
])
func shareIncludesTip(bill: Double, tip: Int, people: Int, // Receives each tuple's values in order.
                      expected: Double) { // The expected share for that row.
    #expect(share(of: bill, tip: tip, people: people) == expected) // The same line for every case.
}

@Test("Invalid party sizes are rejected", arguments: [0, -1, -12]) // Three cases.
func rejectsBadPeople(people: Int) { // One party size per case.
    #expect(share(of: 50, tip: 10, people: people) == nil) // Expect nil every time.
}

@Suite("Bug lab") // The widget from lesson 9.2.
struct BugLabTests { // A fresh instance per test.
    @Test("With no bugs, every check passes") // The correct code.
    func cleanSuiteIsGreen() { // All four tests and all three candidates.
        for check in LabCheck.suite + LabCheck.candidates { // Seven expectations.
            #expect(check.failure(with: []) == nil, "\(check.id) should pass") // Green.
        }
    }

    @Test("Each bug turns exactly one course test red", arguments: [ // Bug and the test it breaks.
        (SplitBug.truncates, "Shares round to the nearest cent"), // A: 6.66 instead of 6.67.
        (SplitBug.tipAsWholeNumber, "splitsTotalWithTip()"), // B: 525 instead of 30.
        (SplitBug.noPeopleGuard, "rejectsZeroPeople()"), // C: infinity instead of nil.
    ])
    func bugBreaksOneTest(bug: SplitBug, test: String) { // One case per bug.
        let red = LabCheck.suite.filter { $0.failure(with: [bug]) != nil }.map(\.id) // The failing tests.
        #expect(red == [test]) // Exactly the expected one.
    }

    @Test("Bug D leaves the whole course suite green") // What a green suite does not prove.
    func bugDHides() { // Negative bills allowed.
        #expect(LabCheck.suite.allSatisfy { $0.failure(with: [.negativeBills]) == nil }) // Every test passes anyway.
    }

    @Test("Only the negative-bill expectation catches bug D") // The course's final question.
    func onlyNegativeBillCatchesD() { // Three candidates.
        let catching = LabCheck.candidates.filter { $0.failure(with: [.negativeBills]) != nil }.map(\.id) // The ones that turn red.
        #expect(catching == ["A negative bill is rejected"]) // Only that one.
    }

    @Test("Failure messages show the actual value") // Like Swift Testing's own reports.
    func messageShowsActual() throws { // try: #require can throw.
        let message = try #require(LabCheck.suite[0].failure(with: [.tipAsWholeNumber])) // Bug B's failure.
        #expect(message.contains("→ 525.0")) // The value the course mentions.
        #expect(LabCheck.suite[0].code == "#expect(share(of: 100, tip: 20, people: 4) == 30)") // The code is written as typed.
    }
}

@Suite("#require demo") // The lesson's people stepper.
struct RequireDemoTests { // A fresh instance per test.
    @Test("Three people pass with no issues") // The course's values.
    func passes() { // 90 / 3 = 30.
        #expect(RequireDemo.issues(people: 3).isEmpty) // Green.
    }

    @Test("Zero people record exactly one issue") // The course's question: why not three?
    func requireStops() { // #require ends the test.
        let issues = RequireDemo.issues(people: 0) // Act.
        #expect(issues.count == 1) // One issue only.
        #expect(issues.first?.hasPrefix("#require failed") == true) // And it is the #require.
    }

    @Test("Two people record both expectation failures") // #expect keeps going.
    func expectContinues() { // 90 / 2 = 45.
        #expect(RequireDemo.issues(people: 2).count == 2) // Both #expect lines fail and both are recorded.
    }
}

@Suite("Testing pyramid") // The figure in lesson 9.2.
struct PyramidTests { // A fresh instance per test.
    @Test("The pyramid answers far sooner than the ice-cream cone") // The figure's point.
    func pyramidIsFaster() { // Compare the totals.
        #expect(TestSuiteShape.pyramid.totalSeconds < TestSuiteShape.iceCreamCone.totalSeconds / 10) // More than ten times faster.
    }

    @Test("Total time is count times cost for each layer") // The model's arithmetic.
    func totalIsSum() { // One test of each kind.
        let shape = TestSuiteShape(unit: 1, integration: 1, ui: 1) // Arrange.
        #expect(shape.totalSeconds == TestSuiteShape.unitSeconds + TestSuiteShape.integrationSeconds + TestSuiteShape.uiSeconds) // Assert.
    }
}

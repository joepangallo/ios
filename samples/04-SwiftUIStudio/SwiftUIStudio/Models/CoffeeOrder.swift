// CoffeeOrder.swift
// Who: every card in lesson 4.5, Observable Models, and the tests that run the model
//      with no screen at all.
// What: the coffee order model (shots, milk, the price rule and the four-shot limit),
//       the study planner shared through the environment, a checkout view model with
//       status and error messages, and the console program from "The model runs
//       without a screen".
// Where: the Models folder. It imports Observation, not SwiftUI: @Observable lives in
//        the Observation framework, so the rules run without any view.
// When: the order is created once per demo card and changed by its buttons and controls.
// Why: rules written in plain Swift can be exercised directly, which is exactly what
//      the unit tests do. Every view that shows an order follows the same rules.

import Foundation // String(format:) and Duration.
import Observation // The @Observable macro.

/// A coffee order: data plus the rules about it, kept separate from any screen.
@Observable // Reports every read and write of the stored properties below to SwiftUI.
final class CoffeeOrder { // A class: every view that holds it points at the same single order.
    var drink = "Latte" // The challenge on the course page adds this property.
    var shots = 2 // Espresso shots, between 1 and 4.
    var oatMilk = false // Oat milk costs 60 cents extra.
    var extraHot = false // The @Bindable challenge adds this switch.

    /// The price rule: 3.25 base, 75 cents a shot, 60 cents for oat milk.
    var price: Double { // Computed from stored properties, so it is always current.
        let base = 3.25 + Double(shots) * 0.75 // Two shots: 3.25 + 1.50 = 4.75.
        return oatMilk ? base + 0.60 : base // Oat milk on top.
    }

    /// The price as the screen shows it, for example "$4.75".
    var priceText: String { String(format: "$%.2f", price) } // Two decimals, like the course.

    /// The four-shot limit lives here, not in a view.
    func addShot() { // Called by "Add a shot" buttons.
        if shots < 4 { shots += 1 } // A fifth shot is quietly refused.
    }

    /// The challenge's removeShot(): never goes below 1.
    func removeShot() { // Called by "Remove a shot" buttons.
        if shots > 1 { shots -= 1 } // An order always has at least one shot.
    }

    /// A short description, for example "Oat Latte, 3 shots".
    var summary: String { // Used by the checkout messages.
        "\(oatMilk ? "Oat " : "")\(drink), \(shots) shot\(shots == 1 ? "" : "s")" // "1 shot", "2 shots".
    }
}

/// The console program from "The model runs without a screen".
enum CoffeeOrderProgram { // A namespace for the program.
    /// Runs the course's program and returns what it prints.
    /// The course's version uses `loops: 3` and `oatMilk: true`, and prints "$4.75" then "4 $6.85".
    static func run(loops: Int = 3, oatMilk: Bool = true, removeOneShot: Bool = false) -> [String] { // The parameters are the three challenges.
        var out = Transcript() // Collects printed lines so the screen and the tests can read them.
        let order = CoffeeOrder() // `let order = CoffeeOrder()`
        out.print(String(format: "$%.2f", order.price)) // `print(String(format: "$%.2f", order.price))`
        for _ in 0..<max(loops, 0) { order.addShot() } // `for _ in 1...3 { order.addShot() }`
        order.oatMilk = oatMilk // `order.oatMilk = true`
        if removeOneShot { order.removeShot() } // The third challenge: call removeShot() before the last print.
        out.print(order.shots, String(format: "$%.2f", order.price)) // `print(order.shots, String(format: "$%.2f", order.price))`
        return out.lines // Everything printed, in order.
    }
}

/// The study planner from "Sharing a model through @Environment".
@Observable final class StudyPlanner { // `@Observable final class StudyPlanner { var sessionsDone = 0 }`
    var sessionsDone = 0 // How many study sessions are finished.
}

/// A view model: the checkout screen's own state and logic, so its view stays thin.
/// The order is the model; status and error messages belong to this one screen.
@Observable // The checkout view redraws when status or the name changes.
final class CheckoutViewModel { // A plain class: no SwiftUI in here.
    /// Where the checkout is in its short life.
    enum Status: Equatable { // Equatable so the view and the tests can compare it.
        case editing // Waiting for a name.
        case sending // The simulated shop is "thinking".
        case placed(String) // Success, with a confirmation message.
        case failed(String) // Something went wrong, with a message that says what.
    }

    let order: CoffeeOrder // The model this screen checks out. let: the screen never swaps it for another order.
    var cupName = "" // Typed by the person; the view binds a TextField to it.
    var shopIsOpen = true // A switch in the demo, so you can see the error path.
    private(set) var status: Status = .editing // Only this class changes the status.
    private let delay: Duration // How long the pretend shop takes; tests pass .zero.

    /// Creates a checkout for an order. The shop is simulated: nothing leaves the device.
    init(order: CoffeeOrder, delay: Duration = .milliseconds(700)) { // The default delay is long enough to see "Sending".
        self.order = order // Keep the shared order.
        self.delay = delay // Keep the delay.
    }

    /// The name with spaces trimmed, so "  " does not count as a name.
    private var trimmedName: String { cupName.trimmingCharacters(in: .whitespaces) } // Removes leading and trailing spaces.

    /// The button is enabled only when a name exists and nothing is in flight.
    var canPlaceOrder: Bool { !trimmedName.isEmpty && status != .sending } // A derived value, not stored state.

    /// One line of text the view shows under the button.
    var statusMessage: String { // The view only reads this; the wording lives here.
        switch status { // One message per status.
        case .editing: trimmedName.isEmpty ? "Add a name for the cup." : "Ready to order \(order.summary) for \(trimmedName)." // A hint, or a preview.
        case .sending: "Sending your order..." // Shown while the pretend shop works.
        case .placed(let message): message // The confirmation.
        case .failed(let message): message // The error.
        }
    }

    /// Places the order with a simulated shop. Runs on the main actor, like the view that calls it.
    func placeOrder() async { // async: it waits for the pretend shop without freezing the screen.
        guard !trimmedName.isEmpty else { // A name is required.
            status = .failed("Add a name for the cup first.") // Explain what is missing.
            return // Stop here.
        }
        status = .sending // The view shows a progress message now.
        try? await Task.sleep(for: delay) // Pretend the shop takes a moment; try? ignores cancellation.
        if shopIsOpen { // The demo's switch decides the outcome.
            status = .placed("Order placed: \(order.summary) for \(trimmedName), \(order.priceText). (Simulated)") // Success.
        } else { // The error path.
            status = .failed("The shop is closed right now. Nothing was charged. (Simulated)") // A clear error message.
        }
    }

    /// Goes back to editing after a result.
    func startOver() { // The Start over button.
        status = .editing // Clear the message.
        cupName = "" // And the name.
    }
}

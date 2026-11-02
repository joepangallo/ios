// WeatherService.swift
// Who: lesson 9.1's dependency-injection demos and lesson 9.2's view-model
//      tests, exactly as the course writes them.
// What: the WeatherService contract, a mock that reports a fixed reading, an
//       offline stand-in that always fails, the WeatherViewModel that accepts
//       any of them, and summary(from:), the course's console version.
// Where: the Models folder. No live weather service is included: this sample
//        stays offline, and the app's live implementation is the UserDefaults
//        session storage instead (see SessionStorage.swift).
// When: the lessons create a view model around whichever service you pick.
// Why: one view model, three dependencies, zero changes inside the view model:
//      the payoff of describing a dependency with a protocol.

import Foundation // Foundation provides the Error protocol's helpers and string formatting.
import Observation // Observation provides @Observable without importing SwiftUI.

/// The contract: report the current temperature in degrees Celsius.
nonisolated protocol WeatherService: Sendable { // Sendable: safe to share across concurrent tasks.
    func currentTemperature() async throws -> Double // async allows waiting; throws lets failure reach a catch.
}

/// A stand-in that returns a fixed reading instantly, for previews and tests.
nonisolated struct MockWeatherService: WeatherService { // Plain data: no network, no disk, no timing surprises.
    var reading = 21.5 // The temperature to report; a test can pass any other value.
    func currentTemperature() async throws -> Double { reading } // Still async throws, to match the contract.
}

/// A stand-in that always fails, like a phone with no connection.
nonisolated struct OfflineWeatherService: WeatherService { // Makes the failure path happen on demand.
    struct Offline: Error {} // Any type that conforms to Error can be thrown.
    func currentTemperature() async throws -> Double { // Same signature, so it is injectable.
        throw Offline() // Fails immediately instead of returning a reading.
    }
}

/// The view model for a weather card. It never learns which service it was given.
@MainActor @Observable // Main actor: SwiftUI reads it there, and Swift proves every write happens there too.
final class WeatherViewModel { // final: one shared, observable instance nobody subclasses.
    private let service: any WeatherService // Depends on the contract, not a concrete type.
    private(set) var summary = "Not loaded" // The text the card shows, starting neutral.

    init(service: any WeatherService) { self.service = service } // Initializer injection: you must choose a service.

    /// Fetches the reading and updates summary.
    func load() async { // async: it can pause at await while the screen keeps drawing.
        summary = "Loading…" // Immediate feedback; the view updates automatically.
        do { // The service can throw.
            let t = try await service.currentTemperature() // Waits for whichever service was injected.
            summary = "Now: \(t) °C" // For example "Now: 21.5 °C".
        } catch { // Any thrown error lands here.
            summary = "Could not load weather" // A visible, friendly failure instead of a crash.
        }
    }
}

/// The console version from the course: one function, any service, a ready-to-show string.
nonisolated func summary(from service: any WeatherService) async -> String { // The caller chooses the implementation.
    do { // The service can throw.
        let t = try await service.currentTemperature() // Cannot tell a mock from a real server, which is the point.
        return "Now: \(t) °C" // Swift prints whole Doubles with .0, so 30 shows as 30.0.
    } catch { // The failure branch.
        return "Could not load weather" // Always returns a string, success or not.
    }
}

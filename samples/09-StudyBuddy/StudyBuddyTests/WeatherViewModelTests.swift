// WeatherViewModelTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: the course's view-model tests from lesson 9.2 ("Test a view model with
//       stand-ins") and the expected output of lesson 9.1's "Prove it with a
//       stand-in" program.
// Where: the StudyBuddyTests target. FailingWeatherService lives here, in the
//        test target, so the app never ships it.
// When: on every test run; each test injects its own stand-in.
// Why: these tests run in milliseconds, offline, with the same result every time.

import Testing // Swift Testing: @Suite, @Test and #expect.
@testable import StudyBuddy // Lets the tests see the app's internal types.

/// The course's failing stand-in: it always throws.
struct FailingWeatherService: WeatherService { // Conforms to the same protocol as the mock.
    struct Offline: Error {} // A tiny error type to throw.
    func currentTemperature() async throws -> Double { // Matching the signature makes it injectable.
        throw Offline() // Simulates no connection without touching Wi-Fi settings.
    }
}

@MainActor // WeatherViewModel is main-actor isolated, so tests that touch it are too.
struct WeatherViewModelTests { // Without @Suite, the type name is the heading.
    @Test func showsReadingFromService() async { // The success path.
        let model = WeatherViewModel(service: MockWeatherService()) // Arrange: the mock that reports 21.5.
        await model.load() // Act: the real load() logic.
        #expect(model.summary == "Now: 21.5 °C") // Assert: the exact text the screen shows.
    }

    @Test func showsMessageWhenServiceFails() async { // The failure path.
        let model = WeatherViewModel(service: FailingWeatherService()) // Arrange: only the dependency differs.
        await model.load() // Act: the catch branch runs.
        #expect(model.summary == "Could not load weather") // Assert: the friendly message.
    }

    @Test("A new view model says Not loaded") // The starting state.
    func startsNotLoaded() { // Before load().
        #expect(WeatherViewModel(service: MockWeatherService()).summary == "Not loaded") // The neutral message.
    }
}

@Suite("Prove it with a stand-in") // Lesson 9.1's console program.
struct StandInTests { // A fresh instance per test.
    @Test("summary(from:) formats whole Doubles with .0") // The course's two lines.
    func summaries() async { // summary(from:) is async.
        #expect(await summary(from: MockWeatherService()) == "Now: 21.5 °C") // First line.
        #expect(await summary(from: MockWeatherService(reading: 30)) == "Now: 30.0 °C") // Second line: 30.0, not 30.
    }

    @Test("A failing service gives the failure text") // The course's try-it.
    func failingSummary() async { // The catch branch.
        #expect(await summary(from: FailingWeatherService()) == "Could not load weather") // Always returns a string.
    }

    @MainActor // The lesson's program uses Transcript, a main-actor type.
    @Test("The lesson's program matches the course output") // The screen's Run button.
    func lessonProgram() async { // Awaits both calls.
        #expect(await WeatherConsoleDemo.program() == ["Now: 21.5 °C", "Now: 30.0 °C"]) // Line for line.
    }
}

// PerformanceTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: tests for lesson 9.5: frame budgets and verdicts, the frame budget
//       lab's symptoms, heavy work giving the same answer on and off the main
//       actor, thumbnail decoding, what the custom controls say to VoiceOver,
//       and the Spanish strings in the String Catalog.
// Where: the StudyBuddyTests target.
// When: on every test run.
// Why: performance fixes and translations are easy to break silently; these
//      checks make them loud.

import Foundation // Foundation provides Bundle, Locale and Data.
import Testing // Swift Testing: @Suite, @Test, #expect and #require.
import UIKit // UIKit provides UIImage, which the thumbnail test measures.
@testable import StudyBuddy // Lets the tests see the app's internal types.

@Suite("Frame budget") // The concept step.
struct FrameBudgetTests { // A fresh instance per test.
    @Test("Budgets at 60 and 120 Hz") // 16.7 and 8.3 ms.
    func budgets() { // The course's numbers.
        #expect(abs(FrameBudget.milliseconds(hz: 60) - 16.67) < 0.01) // 1000 / 60.
        #expect(abs(FrameBudget.milliseconds(hz: 120) - 8.33) < 0.01) // 1000 / 120.
    }

    @Test("Verdicts", arguments: [ // Duration, refresh rate, expected verdict.
        (5.0, 60, FrameBudget.Verdict.onTime), // Well inside.
        (20.0, 60, .hitch), // Over 16.7.
        (10.0, 120, .hitch), // Over 8.3.
        (10.0, 60, .onTime), // The same frame is fine at 60 Hz.
        (250.0, 60, .hang), // Xcode's hang threshold.
    ])
    func verdicts(ms: Double, hz: Int, expected: FrameBudget.Verdict) { // One case per row.
        #expect(FrameBudget.verdict(ms: ms, hz: hz) == expected) // Assert.
    }
}

@Suite("Frame budget lab") // The widget: which fix cures which symptom.
struct FrameLabTests { // A fresh instance per test.
    @Test("With every fix applied, every frame is on time at 120 Hz") // The goal.
    func allFixed() { // No mistakes.
        let frames = FrameLab.frames(decodeOnMain: false, formatterInBody: false, eagerStack: false) // Arrange.
        #expect(frames.allSatisfy { FrameBudget.verdict(ms: $0, hz: 120) == .onTime }) // All green.
    }

    @Test("A formatter in body makes every frame late at 120 Hz but not at 60 Hz") // A steady cost.
    func formatterOnly() { // One mistake.
        let frames = FrameLab.frames(decodeOnMain: false, formatterInBody: true, eagerStack: false) // Arrange.
        #expect(frames.allSatisfy { FrameBudget.verdict(ms: $0, hz: 120) == .hitch }) // Late at 120.
        #expect(frames.allSatisfy { FrameBudget.verdict(ms: $0, hz: 60) == .onTime }) // Fine at 60.
    }

    @Test("Decoding on main causes a spike every third frame") // Periodic hitches.
    func decodeOnly() { // One mistake.
        let frames = FrameLab.frames(decodeOnMain: true, formatterInBody: false, eagerStack: false) // Arrange.
        #expect(frames.filter { FrameBudget.verdict(ms: $0, hz: 60) == .hitch }.count == FrameLab.frameCount / 3) // 8 of 24.
    }

    @Test("An eager VStack makes the first frame a hang") // One huge frame.
    func eagerOnly() { // One mistake.
        let frames = FrameLab.frames(decodeOnMain: false, formatterInBody: false, eagerStack: true) // Arrange.
        #expect(FrameBudget.verdict(ms: frames[0], hz: 60) == .hang) // The first frame.
        #expect(frames.dropFirst().allSatisfy { FrameBudget.verdict(ms: $0, hz: 120) == .onTime }) // The rest are fine.
    }
}

@Suite("Off the main actor") // The @concurrent step.
struct OffMainActorTests { // A fresh instance per test.
    @Test("@concurrent gives the same answer as the main-actor version") // Moving work changes where, not what.
    func sameResult() async { // async: awaits the background version.
        #expect(await studyStatisticsOffMain(iterations: 10_000) == studyStatistics(iterations: 10_000)) // Identical.
    }

    @Test("Zero iterations average to zero instead of dividing by zero") // The max(_, 1) guard.
    func zeroIterations() { // Edge case.
        #expect(studyStatistics(iterations: 0) == 0) // No crash.
    }

    @Test("A thumbnail is decoded at 160 pixels or less") // The course's makeThumbnail.
    func thumbnailSize() async throws { // try: #require can throw.
        let data = await makeSamplePhotoData(hue: 0.5) // A four-megapixel JPEG.
        #expect(!data.isEmpty) // The sample photo exists.
        let image = try #require(await makeThumbnail(from: data)) // Decoded.
        #expect(max(image.size.width * image.scale, image.size.height * image.scale) <= 160) // Display size, not full size.
    }

    @Test("Corrupt bytes give no thumbnail instead of a crash") // The guard in makeThumbnail.
    func corruptData() async { // Not an image.
        #expect(await makeThumbnail(from: Data("not an image".utf8)) == nil) // nil.
    }
}

@MainActor // The controls are main-actor types.
@Suite("Custom controls that speak") // The accessibility step.
struct SpeakingControlTests { // A fresh instance per test.
    @Test("Adjusting stays inside the range", arguments: [ // Start, direction, expected.
        (25, true, 30), (25, false, 20), (90, true, 90), (5, false, 5), // Normal steps and both ends.
    ])
    func adjusted(start: Int, up: Bool, expected: Int) { // One case per row.
        #expect(FocusLengthControl.adjusted(start, up: up, range: 5...90, step: 5) == expected) // Assert.
    }

    @Test("The spoken value uses the plural rules", arguments: [(1, "1 minute"), (25, "25 minutes")]) // Singular and plural.
    func spokenValue(minutes: Int, expected: String) { // From the String Catalog's plural variations.
        #expect(FocusLengthControl.spokenValue(minutes) == expected) // Assert.
    }

    @Test("GoalRow's button says label, value, trait and hint") // What VoiceOver reads.
    func goalRowSpeech() { // The course's starting value.
        #expect(GoalRow.spokenText(minutes: 45) == "Add 15 minutes, 45 of 60 minutes, Button. Logs more study time for Algebra") // Exact text.
    }
}

@MainActor // Bundle lookups here use main-actor helpers from the app.
@Suite("String Catalog") // The localization step.
struct LocalizationTests { // A fresh instance per test.
    /// The compiled Spanish table inside the app bundle.
    private func spanish() throws -> Bundle { // Throws if the table was not built.
        let path = try #require(Bundle.main.path(forResource: "es", ofType: "lproj")) // es.lproj, compiled from Localizable.xcstrings.
        return try #require(Bundle(path: path)) // A bundle that reads only that folder.
    }

    @Test("The app ships English and Spanish") // Both tables were compiled.
    func languages() { // The bundle's localizations.
        #expect(Bundle.main.localizations.contains("es")) // Spanish.
        #expect(Bundle.main.localizations.contains("en")) // English.
    }

    @Test("Main strings have Spanish translations", arguments: [ // Key and its Spanish value.
        ("This week", "Esta semana"), ("Add Session", "Añadir sesión"), ("Save", "Guardar"), // Interface strings.
        ("Title", "Título"), ("Stop and log", "Detener y registrar"), ("%lld min left", "Faltan %lld min"), // More.
    ])
    func translations(key: String, expected: String) throws { // One case per row.
        #expect(try spanish().localizedString(forKey: key, value: nil, table: nil) == expected) // Read straight from es.lproj.
    }

    @Test("goalBanner follows the locale it is given") // String(localized:) outside Text.
    func banner() { // English and Spanish.
        #expect(goalBanner(in: Locale(identifier: "en")) == "Weekly goal reached") // English.
        #expect(goalBanner(in: Locale(identifier: "es")) == "Meta semanal alcanzada") // Spanish.
    }

    @Test("Plurals vary by language", arguments: [ // Count, locale, expected text.
        (1, "en", "1 session"), (5, "en", "5 sessions"), (1, "es", "1 sesión"), (5, "es", "5 sesiones"), // Four cases.
    ])
    func plurals(count: Int, language: String, expected: String) { // One case per row.
        var resource = LocalizedStringResource("\(count) sessions") // Key "%lld sessions".
        resource.locale = Locale(identifier: language) // Look it up in that language.
        #expect(String(localized: resource) == expected) // The catalog's plural variation.
    }
}

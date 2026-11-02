// IntelligenceTests.swift
// Who: the Swift Testing runner.
// What: checks lesson 7.6's logic: the availability messages for every state, which
//       states keep the feature visible, the highlighted lines, the scripted plain and
//       guided outputs, and the on-device language helpers.
// Where: the DeviceLabTests target.
// When: whenever the tests run.
// Why: the app must explain every unavailable state and never crash; these tests feed
//      each state in directly and never call the language model itself.

import Testing // @Test and #expect.
import FoundationModels // SystemLanguageModel.Availability values.
import NaturalLanguage // NLTag values.
@testable import DeviceLab // The app's internal types.

@MainActor // The app's types live on the main actor.
struct AvailabilityTests { // The course's availability check.
    @Test(arguments: [ // Each state and the course's message for it.
        (AvailabilityChoice.available, "Ready to suggest trips."), // Ready.
        (AvailabilityChoice.deviceNotEligible, "This device cannot run the model."), // Unsupported.
        (AvailabilityChoice.appleIntelligenceNotEnabled, "Turn on Apple Intelligence in Settings."), // Off.
        (AvailabilityChoice.modelNotReady, "The model is still downloading."), // Downloading.
    ])
    func eachStateHasTheCourseMessage(choice: AvailabilityChoice, message: String) { // Parameterized.
        #expect(availabilityMessage(for: choice.availability) == message) // The course's words.
    }

    @Test func theRealCheckNeverCrashes() { // Whatever this machine says.
        let known = ["Ready to suggest trips.", "This device cannot run the model.", "Turn on Apple Intelligence in Settings.", "The model is still downloading.", "Trip ideas are unavailable right now."] // Every possible message.
        #expect(known.contains(availabilityMessage())) // One of them.
    }

    @Test func featureStaysVisibleWhenReadyOrDownloading() { // The course's try-it.
        #expect(isTripFeatureVisible(.available)) // Ready.
        #expect(isTripFeatureVisible(.unavailable(.modelNotReady))) // Ready soon.
        #expect(!isTripFeatureVisible(.unavailable(.deviceNotEligible))) // Never.
        #expect(!isTripFeatureVisible(.unavailable(.appleIntelligenceNotEnabled))) // Until Settings changes.
    }

    @Test func highlightedLinesReturnTheMatchingMessage() { // Listing and messages agree.
        for choice in AvailabilityChoice.allCases { // Every state.
            let returnLine = choice.linesRun.max() ?? 0 // The return line of that case.
            #expect(AvailabilityChoice.listing[returnLine].contains(availabilityMessage(for: choice.availability))) // It returns that message.
        }
    }
}

@MainActor // The app's types live on the main actor.
struct ScriptedTripTests { // Plain text versus guided generation.
    @Test(arguments: 1...5) // Every allowed count.
    func guidedOutputObeysCount(count: Int) { // .count(n).
        let idea = ScriptedTrip.guided(for: "Muir Woods", count: count, days: 1...5) // Guided.
        #expect(idea.activities.count == count) // Exactly n.
    }

    @Test func guidedDaysStayInsideTheRange() { // .range(a...b).
        #expect(ScriptedTrip.guided(for: "Point Reyes", count: 3, days: 1...5).days == 2) // The suggestion fits.
        #expect(ScriptedTrip.guided(for: "Point Reyes", count: 3, days: 3...5).days == 3) // Raised to the floor.
        #expect(ScriptedTrip.guided(for: "Point Reyes", count: 3, days: 1...1).days == 1) // Lowered to the ceiling.
    }

    @Test func plainTextIsProseAboutThePlace() { // Free text your code would have to parse.
        let text = ScriptedTrip.plainText(for: "Yosemite Valley") // Plain mode.
        #expect(text.contains("Yosemite Valley")) // Mentions the place.
        #expect(!text.contains("[")) // No structure.
    }

    @Test func everyPromptHasFiveActivities() { // Enough for .count(5).
        for place in ScriptedTrip.places { // All three prompts.
            #expect(ScriptedTrip.activities(for: place).count == 5) // Five each.
        }
    }

    @Test func revealFillsFieldsInOrder() { // Title, then activities, then days.
        let idea = ScriptedIdea(title: "A Day at Muir Woods", activities: ["a", "b"], days: 2) // Two activities.
        let none = OnDeviceIntelligenceLesson.revealLines(idea, upTo: 0) // Nothing yet.
        #expect(!none.contains { $0.contains("title") }) // No title.
        let all = OnDeviceIntelligenceLesson.revealLines(idea, upTo: 4) // Everything.
        #expect(all.contains("  title: \"A Day at Muir Woods\",")) // Title.
        #expect(all.contains("  activities: [\"a\", \"b\"],")) // Both activities.
        #expect(all.contains("  days: 2")) // Days last.
    }

    @Test func listingShowsTheChosenRules() { // The code follows the steppers.
        let lines = OnDeviceIntelligenceLesson.ideaListing(count: 4, days: 2...3) // Custom rules.
        #expect(lines.contains("    @Guide(description: \"Things to do\", .count(4))")) // The count.
        #expect(lines.contains("    @Guide(.range(2...3))")) // The range.
    }
}

@MainActor // The app's types live on the main actor.
struct LanguageToolTests { // Natural Language, on device.
    @Test func detectsFrench() { // A clear French sentence.
        #expect(LanguageTools.dominantLanguage(of: "Le sentier commence près du lac et monte vers la crête.") == "French") // Named in English.
    }

    @Test func detectsEnglish() { // A clear English sentence.
        #expect(LanguageTools.dominantLanguage(of: "The trail starts by the lake and climbs to the ridge.") == "English") // Named in English.
    }

    @Test func emptyTextIsUnknown() { // Nothing to detect.
        #expect(LanguageTools.dominantLanguage(of: "") == "Unknown") // No guess.
    }

    @Test func nameKindsHavePlainLabels() { // The three kinds of name.
        #expect(LanguageTools.kindLabel(for: .placeName) == "place") // Places.
        #expect(LanguageTools.kindLabel(for: .personalName) == "person") // People.
        #expect(LanguageTools.kindLabel(for: .organizationName) == "organization") // Organizations.
        #expect(LanguageTools.kindLabel(for: .noun) == nil) // Ordinary words are not names.
    }

    @Test func nameTaggingNeverCrashesWithoutItsModel() { // The Simulator often lacks the model.
        let names = LanguageTools.names(in: LanguageTools.samples[0]) // Try the English sample.
        if !LanguageTools.canTagNames { // No model on this machine.
            #expect(names.isEmpty) // Nothing found, and no crash.
        } else { // A model exists.
            #expect(names.allSatisfy { $0.hasSuffix(")") }) // Every name carries its kind.
        }
    }
}

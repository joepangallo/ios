// OnDeviceML.swift
// Who: lesson 7.6's "Vision, Core ML and other machine-learning tools" demo, and the
//      unit tests for its language helpers.
// What: two small on-device machine-learning examples: Natural Language detects which
//       language a sentence is in and finds place names in it, and Vision reads the
//       words printed on a picture of a trail sign.
// Where: the Models folder.
// When: when the student taps the buttons in that card.
// Why: language models are one kind of on-device intelligence; these frameworks run
//      other trained models on the phone, privately, offline and for free.

import NaturalLanguage // NLLanguageRecognizer and NLTagger.
import Vision // RecognizeTextRequest.
import CoreGraphics // CGImage.
import Foundation // Locale.

/// Natural Language helpers.
enum LanguageTools { // A namespace for pure functions.
    /// Sample sentences for the demo, in English, French and Spanish.
    static let samples = [ // The English one names real places.
        "We hiked from Lands End to the Golden Gate Bridge in San Francisco.", // English.
        "Le sentier commence près du lac et monte vers la crête.", // French.
        "La ruta empieza junto al lago y sube hasta la cresta.", // Spanish.
    ]

    /// The most likely language of a text, named in English, such as "French".
    static func dominantLanguage(of text: String) -> String { // "Unknown" when there is no clear answer.
        guard let language = NLLanguageRecognizer.dominantLanguage(for: text) else { return "Unknown" } // Runs a trained model on the device.
        return Locale(identifier: "en").localizedString(forLanguageCode: language.rawValue) ?? language.rawValue // "fr" becomes "French".
    }

    /// Whether this device has the model that finds names; the Simulator often lacks it.
    static var canTagNames: Bool { // Checked before tagging, like the language model's availability.
        NLTagger.availableTagSchemes(for: .word, language: .english).contains(.nameType) // Installed tag schemes for English words.
    }

    /// A plain word for each kind of name.
    static func kindLabel(for tag: NLTag) -> String? { // nil for ordinary words.
        switch tag { // The three kinds of name.
        case .placeName: "place" // Cities, landmarks, parks.
        case .personalName: "person" // People.
        case .organizationName: "organization" // Companies, clubs, agencies.
        default: nil // Not a name.
        }
    }

    /// Every name the text mentions, with its kind, such as "Golden Gate Bridge (place)".
    static func names(in text: String) -> [String] { // Empty when nothing is found or tagging is unavailable.
        let tagger = NLTagger(tagSchemes: [.nameType]) // Tags people, places and organizations.
        tagger.string = text // The text to read.
        var found: [String] = [] // Collected names.
        let options: NLTagger.Options = [.omitWhitespace, .omitPunctuation, .joinNames] // Treat "San Francisco" as one name.
        tagger.enumerateTags(in: text.startIndex..<text.endIndex, unit: .word, scheme: .nameType, options: options) { tag, range in // Visits every word or joined name.
            if let tag, let kind = kindLabel(for: tag) { found.append("\(text[range]) (\(kind))") } // Keep only names.
            return true // Keep going to the end.
        }
        return found // Every name found; the model can be wrong, as the lesson warns.
    }
}

/// Vision helper: read the printed text in an image.
enum SignReader { // A namespace for one function.
    /// Every line of text Vision finds, top to bottom.
    static func readText(in image: CGImage) async throws -> [String] { // Throws if Vision cannot run.
        let request = RecognizeTextRequest() // Apple's text recognizer.
        let observations = try await request.perform(on: image) // Runs on the device.
        return observations.compactMap { $0.topCandidates(1).first?.string } // The best reading of each line.
    }
}

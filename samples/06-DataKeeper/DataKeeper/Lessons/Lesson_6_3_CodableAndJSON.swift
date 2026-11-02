// Lesson_6_3_CodableAndJSON.swift
// Who: the student, after tapping lesson 6.3 on the home screen.
// What: encoding a Book to pretty-printed JSON, decoding an array with an optional key,
//       CodingKeys with a nested type, a live decoding lab, every DecodingError case,
//       and the date strategies.
// Where: pushed from ContentView. The examples live in Support/JSONExamples.swift and
//        Support/JSONLab.swift, where the tests check them.
// When: every output is computed as the screen draws, so each toggle updates it at once.
// Why: memory holds Swift values, disks and networks hold bytes; Codable is the bridge.

import SwiftUI // Views and state.

struct CodableAndJSONLesson: View { // The lesson 6.3 screen.
    let lesson: Lesson // Which lesson this page shows.
    @State private var prettyPrinted = true // The encoder's line breaks and indentation.
    @State private var sortedKeys = true // The encoder's alphabetical key order.
    @State private var showEncodedRepo = false // The CodingKeys Try It.
    @State private var labJSON = JSONLab.samples[0].json // The lab's editable JSON.
    @State private var labSample = 0 // Which sample was loaded last.
    @State private var optionalSubtitle = false // Lab toggle: subtitle is String?.
    @State private var useCodingKeys = false // Lab toggle: pages comes from page_count.
    @State private var includeFifth = false // The decoding-error Try It.
    @State private var dateJSONIsSeconds = false // Which JSON the date card decodes.
    @State private var strategy = DatesExample.Strategy.iso8601 // The date decoding strategy.

    var body: some View { // Rebuilt whenever an option changes.
        LessonPage(lesson: lesson) { // The shared page layout.
            DemoCard(title: "Encoding and decoding", caption: "Encodable turns a value into bytes, Decodable rebuilds it, Codable is both, and Data is the buffer of bytes in between.") { // Course concept.
                Text(verbatim: "The course's Book, encoded, begins with these bytes (7B is the character {):") // Introduces the hex dump.
                    .font(.footnote) // Small print.
                Text(verbatim: (try? EncodeExample.firstBytes()) ?? "-") // Each byte in hexadecimal.
                    .font(.footnote.monospaced()) // Fixed-width, like a memory dump.
            }

            DemoCard(title: "Encode a struct to JSON", caption: "Book adopts Codable and nothing more. Turn the formatting options off to see what each one adds.") { // Course code step.
                Toggle(".prettyPrinted", isOn: $prettyPrinted) // Line breaks and indentation.
                Toggle(".sortedKeys", isOn: $sortedKeys) // Alphabetical keys.
                ConsoleView(lines: encodeLines) // Bytes: 95, then the JSON, with both options on.
            }

            DemoCard(title: "Decode JSON into Swift values", caption: "The first book has no subtitle key. Because subtitle is String?, the missing key becomes nil instead of an error.") { // Course code step.
                Text(verbatim: DecodeExample.json) // The input JSON.
                    .font(.caption.monospaced()) // Small and fixed-width.
                ConsoleView(lines: (try? DecodeExample.run().lines) ?? ["Decoding failed"]) // The three printed lines.
            }

            DemoCard(title: "Nested types and CodingKeys", caption: "CodingKeys maps starCount to stargazers_count; Owner decodes the nested object; the extra language key is ignored.") { // Course code step.
                Text(verbatim: CodingKeysExample.json) // The input JSON.
                    .font(.caption.monospaced()) // Small and fixed-width.
                ConsoleView(lines: (try? CodingKeysExample.run().lines) ?? ["Decoding failed"]) // swiftlang/swift: 69000 stars.
                Toggle("Encode repo back to JSON", isOn: $showEncodedRepo) // The course's Try It.
                if showEncodedRepo { // Only after the toggle is on.
                    ConsoleView(lines: [(try? CodingKeysExample.encodeBack()) ?? "Encoding failed"]) // The JSON key name comes back.
                }
            }

            DemoCard(title: "The JSON decoding lab", caption: "Edit the JSON or load a broken sample. Then change the struct with the toggles and see which mismatch each change fixes.") { // Course widget.
                Picker("Sample", selection: $labSample) { // Loads a ready-made input.
                    ForEach(JSONLab.samples.indices, id: \.self) { index in // One menu item per sample.
                        Text(JSONLab.samples[index].name).tag(index) // The index is the stored value.
                    }
                }
                .pickerStyle(.menu) // A compact menu.
                .onChange(of: labSample) { _, index in labJSON = JSONLab.samples[index].json } // Replaces the editor's text.
                TextEditor(text: $labJSON) // The JSON, editable.
                    .font(.caption.monospaced()) // Small and fixed-width.
                    .frame(height: 90) // Room for a few lines.
                    .autocorrectionDisabled() // JSON is not English; autocorrect would break it.
                    .textInputAutocapitalization(.never) // Same reason: keys are lowercase.
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.4))) // A light border.
                Toggle("subtitle: String? (optional)", isOn: $optionalSubtitle) // Fixes missing and null subtitles.
                Toggle("CodingKeys: pages = \"page_count\"", isOn: $useCodingKeys) // Fixes the snake_case key.
                LabOutcomeView(outcome: JSONLab.decode(labJSON, optionalSubtitle: optionalSubtitle, useCodingKeys: useCodingKeys)) // The live result.
            }

            DemoCard(title: "Reading a decoding error", caption: "Each kind of bad input is a different DecodingError case, so separate catch clauses can say something useful.") { // Course code step.
                Toggle("Add a fifth sample where city is 7", isOn: $includeFifth) // The course's Try It.
                ConsoleView(lines: DecodingErrorExample.run(includeFifth: includeFifth).lines) // One line per sample.
            }

            DemoCard(title: "Dates in JSON", caption: "JSON has no date type. A date decoding strategy tells the decoder how the server wrote the date.") { // Course code step.
                Picker("JSON", selection: $dateJSONIsSeconds) { // Which input.
                    Text("ISO 8601 text").tag(false) // "2026-09-14T17:00:00Z".
                    Text("Seconds since 1970").tag(true) // 1789405200.
                }
                .pickerStyle(.segmented) // Two choices.
                Text(verbatim: dateJSONIsSeconds ? DatesExample.secondsJSON : DatesExample.isoJSON) // The input JSON.
                    .font(.caption.monospaced()) // Small and fixed-width.
                Picker("Strategy", selection: $strategy) { // The decoder setting.
                    ForEach(DatesExample.Strategy.allCases) { Text($0.rawValue).tag($0) } // Three strategies.
                }
                .pickerStyle(.menu) // A menu, because .secondsSince1970 is too long for a segment.
                ConsoleView(lines: DatesExample.run(json: dateJSONIsSeconds ? DatesExample.secondsJSON : DatesExample.isoJSON, strategy: strategy).lines) // The decoded date, or the error.
            }
        }
    }

    /// The encode card's output for the current options.
    private var encodeLines: [String] { // Computed each time the card draws.
        var formatting: JSONEncoder.OutputFormatting = [] // Start with no options.
        if prettyPrinted { formatting.insert(.prettyPrinted) } // Adds line breaks and indentation.
        if sortedKeys { formatting.insert(.sortedKeys) } // Adds alphabetical order.
        return (try? EncodeExample.run(formatting: formatting).lines) ?? ["Encoding failed"] // The printed lines.
    }
}

/// Shows a lab outcome: green for a decoded value, orange for an error.
struct LabOutcomeView: View { // A small view for one result.
    let outcome: JSONLab.Outcome // What the decode produced.

    var body: some View { // Two layouts, one per case.
        VStack(alignment: .leading, spacing: 4) { // Lines stacked.
            switch outcome { // Which case?
            case .decoded(let text): // Success.
                Text("print(book) shows:").font(.caption.bold()) // A label.
                Text(verbatim: text).font(.caption.monospaced()) // The value, exactly as Swift prints it.
            case .failed(let kind, let path, let message): // Failure.
                Text(verbatim: "DecodingError.\(kind)").font(.caption.bold()) // The error case.
                Text(verbatim: "Path: \(path)").font(.caption.monospaced()) // Where in the JSON it happened.
                Text(verbatim: message).font(.caption) // Swift's own explanation.
            }
        }
        .padding(10) // Room inside the box.
        .frame(maxWidth: .infinity, alignment: .leading) // Full width.
        .background(isDecoded ? Color.green.opacity(0.15) : Color.orange.opacity(0.18), in: .rect(cornerRadius: 10)) // Green for success, orange for an error.
    }

    /// true when the outcome is a success.
    private var isDecoded: Bool { // Used for the background color.
        if case .decoded = outcome { return true } // Matches the success case.
        return false // Anything else is a failure.
    }
}

#Preview { // Shows this lesson in Xcode's canvas.
    NavigationStack { CodableAndJSONLesson(lesson: ContentView.lessons[2]) } // Inside a stack, so the title shows.
}

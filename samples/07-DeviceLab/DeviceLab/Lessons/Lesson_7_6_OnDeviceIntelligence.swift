// Lesson_7_6_OnDeviceIntelligence.swift
// Who: students opening lesson 7.6 from the home screen.
// What: the course's availability check on this device, with a practice picker for
//       every state; the course's TripPlanner session and @Generable TripIdea, which
//       run only when the model is available; a scripted comparison of plain text and
//       guided generation; and two other on-device models, Natural Language and Vision.
// Where: pushed by ContentView when the student taps "7.6".
// When: built when the lesson opens; nothing calls the model until the student asks.
// Why: the model runs on the phone, so it is private, offline and free, but many
//      devices cannot run it. The app must check first and keep working without it.

import SwiftUI // Views, state and ImageRenderer.
import FoundationModels // SystemLanguageModel.

struct OnDeviceIntelligenceLesson: View { // The screen for lesson 7.6.
    let lesson: Lesson // The lesson row that opened this screen.
    @State private var availability = SystemLanguageModel.default.availability // This device's real answer.
    @State private var practice = AvailabilityChoice.available // The practice picker's state.
    @State private var place = "Muir Woods" // The place to ask about.
    @State private var planner: TripPlanner? // Created on first use, only when the model is available.
    @State private var conversation: [String] = [] // Prompts and answers, oldest first.
    @State private var asking = false // True while the session is generating.
    @State private var idea: TripIdea? // The last guided result.
    @State private var ideaError = "" // Why the guided request failed, if it did.
    @State private var guidedMode = false // The scripted demo's mode.
    @State private var scriptedPlace = ScriptedTrip.places[0] // The scripted demo's prompt.
    @State private var activityCount = 3 // The scripted .count rule.
    @State private var minDays = 1 // The scripted .range rule's lower bound.
    @State private var maxDays = 5 // The scripted .range rule's upper bound.
    @State private var revealed = 0 // How many guided fields have "arrived" so far.
    @State private var generation = 0 // Bumped on every Generate tap to restart the reveal.
    @State private var sentence = LanguageTools.samples[0] // Text for Natural Language.
    @State private var signLines: [String] = [] // What Vision read from the sign.
    @State private var signStatus = "Not read yet." // Vision's progress or failure.

    private var isAvailable: Bool { availability == .available } // The one state where the model can run.

    var body: some View { // The whole lesson page.
        LessonPage(lesson: lesson) { // CourseKit's scrolling page.
            conceptCard // A language model that lives on the phone.
            availabilityCard // Check availability first.
            sessionCard // Ask with a session.
            generableCard // Get Swift values back with @Generable.
            scriptedCard // Plain text versus guided generation.
            otherToolsCard // Vision, Core ML and friends.
        }
    }

    // MARK: - A language model that lives on the phone

    private var conceptCard: some View { // The first concept step, with this device's answer.
        DemoCard(title: "A language model that lives on the phone", caption: "Foundation Models gives your app the on-device model behind Apple Intelligence: private, offline, and free per request.") { // Course concept step.
            Label(availabilityMessage(for: availability), systemImage: isAvailable ? "sparkles" : "exclamationmark.triangle") // This device, right now.
                .font(.subheadline.weight(.semibold)) // Stands out.
            TermRow(term: "Good at", text: "Summarizing, pulling details out of text, classifying and tagging, and writing short, friendly text.") // Course point.
            TermRow(term: "Not a fact source", text: "A compact model has limited knowledge of the world. It can sound confident and still be wrong, so never present its output as truth.") // Course point.
            TermRow(term: "Requirements", text: "A device that supports Apple Intelligence, with Apple Intelligence turned on in Settings and the model downloaded.") // Course point.
            CalloutBox(title: "Treat it as an extra", text: "Many devices cannot run the model. The app must still work without it, and the feature should hide or explain itself when the model is missing.", symbol: "paintbrush") // Course callout.
        }
    }

    // MARK: - Check availability first

    private var availabilityCard: some View { // The course's availabilityMessage(), real and in practice.
        DemoCard(title: "Check availability first", caption: "The real answer for this device, then a practice picker that feeds every state to the course's switch.") { // Course code step.
            Text(verbatim: "This device: \(availabilityMessage())") // The course's function, exactly as written.
                .font(.subheadline) // Readable.
            Button("Check again", systemImage: "arrow.clockwise") { availability = SystemLanguageModel.default.availability } // Availability can change, for example after a download.
                .buttonStyle(.bordered) // Secondary.
            Divider() // Separates real from practice.
            MenuPicker(title: "Practice state", selection: $practice) { // The four states.
                ForEach(AvailabilityChoice.allCases) { choice in Text(verbatim: choice.rawValue).tag(choice) } // One per state.
            }
            CodeListing(lines: AvailabilityChoice.listing, highlighted: practice.linesRun) // The lines that run.
            PhonePanel(symbol: isTripFeatureVisible(practice.availability) ? "sparkles" : "iphone", title: availabilityMessage(for: practice.availability), text: isTripFeatureVisible(practice.availability) ? "isTripFeatureVisible is true: keep the feature on screen." : "isTripFeatureVisible is false: hide the feature; the rest of the app still works.", tone: practice == .available ? .ok : .warn, button: practice == .available ? "Suggest a Trip" : (practice == .appleIntelligenceNotEnabled ? "Open Settings" : nil)) // What the user sees.
        }
    }

    // MARK: - Ask with a session

    private var sessionCard: some View { // The course's TripPlanner, live when possible.
        DemoCard(title: "Ask with a session", caption: "A session holds instructions and a transcript, so a later prompt can build on earlier ones. Try a place, then \"somewhere warmer\".") { // Course code step.
            TextField("Place", text: $place) // The place to ask about.
                .textFieldStyle(.roundedBorder) // A visible box.
            HStack { // Two prompts.
                Button("Suggest") { ask(place) } // The course's suggest(near:).
                    .buttonStyle(.borderedProminent) // Main action.
                Button("Somewhere warmer") { ask("somewhere warmer") } // The course's follow-up try-it.
                    .buttonStyle(.bordered) // Secondary.
            }
            .disabled(!isAvailable || asking) // Only when the model can run, one request at a time.
            if !isAvailable { // Explain instead of failing.
                Text(verbatim: "Unavailable here: \(availabilityMessage(for: availability)) The app keeps working; this feature simply waits.") // Why the buttons are off.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // Quieter.
            }
            ConsoleView(lines: conversation) // The conversation so far.
            Text("In the Simulator, availability can report .available while the model itself cannot load. The request then fails and the course's catch-all shows \"Something went wrong. Try again.\" instead of crashing. A device with Apple Intelligence gives real answers.") // What students will likely see here.
                .font(.footnote) // Small print.
                .foregroundStyle(.secondary) // Quieter.
        }
    }

    /// Sends one prompt through the shared session.
    private func ask(_ text: String) { // Called by both buttons.
        guard isAvailable else { return } // Never touch the model when it cannot run.
        let session = planner ?? TripPlanner() // Create the session on first use only.
        planner = session // Keep it, so the transcript survives.
        conversation.append("You: \(text)") // Show the prompt.
        asking = true // Disable the buttons.
        Task { // Generation is asynchronous.
            let answer = await session.suggest(near: text) // The course's method.
            conversation.append("Model: \(answer)") // Show the answer.
            asking = false // Ready again.
        }
    }

    // MARK: - Get Swift values back with @Generable

    private var generableCard: some View { // The course's planTrip(to:), live when possible.
        DemoCard(title: "Get Swift values back with @Generable", caption: "Guided generation makes the model fill in the TripIdea struct: a title, exactly three activities, and 1 to 5 days.") { // Course code step.
            Button("Plan a trip to \(place)", systemImage: "wand.and.stars") { // The course's planTrip(to:).
                ideaError = "" // Clear the last failure.
                Task { // Generation is asynchronous.
                    do { // planTrip throws.
                        idea = try await planTrip(to: place) // A typed TripIdea.
                    } catch { // Guardrails, context limits, or unavailability.
                        ideaError = error.localizedDescription // Say why.
                    }
                }
            }
            .buttonStyle(.borderedProminent) // Main action.
            .disabled(!isAvailable) // Only when the model can run.
            if let idea { // A typed value arrived.
                Text(verbatim: idea.title).font(.headline) // TripIdea.title.
                ForEach(idea.activities, id: \.self) { Text(verbatim: "- \($0)") } // TripIdea.activities, exactly three.
                Text(verbatim: "Days: \(idea.days)") // TripIdea.days, between 1 and 5.
            } else if !isAvailable { // The model cannot run here.
                Text("Needs the on-device model. The scripted demo below shows the same idea without it.") // Points to the next card.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // Quieter.
            }
            if !ideaError.isEmpty { Text(verbatim: ideaError).font(.footnote).foregroundStyle(.red) } // A failure, in red.
        }
    }

    // MARK: - Plain text versus guided generation

    private var scriptedCard: some View { // The course's comparison widget, rebuilt natively.
        let scripted = ScriptedTrip.guided(for: scriptedPlace, count: activityCount, days: minDays...max(minDays, maxDays)) // The guided value under the current rules.
        return DemoCard(title: "Plain text versus guided generation", caption: "Scripted responses, written by hand to show the mechanics; the real model's words vary. Guided output arrives as Swift values, field by field, and always obeys the rules.") { // Course widget step.
            Picker("Prompt", selection: $scriptedPlace) { // The place.
                ForEach(ScriptedTrip.places, id: \.self) { Text(verbatim: $0).tag($0) } // Three prompts.
            }
            .pickerStyle(.segmented) // Side by side.
            Picker("Mode", selection: $guidedMode) { // Plain or guided.
                Text("Plain text").tag(false) // Free prose.
                Text("Guided").tag(true) // Typed values.
            }
            .pickerStyle(.segmented) // Side by side.
            Stepper("Activities: .count(\(activityCount))", value: $activityCount, in: 1...5) // The count rule.
            Stepper("Fewest days: \(minDays)", value: $minDays, in: 1...5) // The range's lower bound.
            Stepper("Most days: \(max(minDays, maxDays))", value: $maxDays, in: 1...10) // The range's upper bound, never below the lower one.
            CodeListing(lines: Self.ideaListing(count: activityCount, days: minDays...max(minDays, maxDays))) // The type, with the current rules.
            Button("Generate") { generation += 1 } // Restarts the reveal.
                .buttonStyle(.borderedProminent) // Main action.
            if guidedMode { // Field by field.
                ConsoleView(lines: Self.revealLines(scripted, upTo: revealed)) // The struct filling in.
            } else { // One block of prose.
                ConsoleView(lines: [ScriptedTrip.plainText(for: scriptedPlace)]) // Your code would have to parse this.
            }
        }
        .task(id: generation) { // Runs after each Generate tap.
            revealed = 0 // Start empty.
            for step in 1...(activityCount + 2) { // Title, each activity, then days.
                try? await Task.sleep(for: .milliseconds(250)) // A pause between fields.
                revealed = step // One more field has arrived.
            }
        }
    }

    /// The course's TripIdea declaration, with the rules the steppers chose.
    static func ideaListing(count: Int, days: ClosedRange<Int>) -> [String] { // Pure, for display.
        [ // One string per line.
            "@Generable", // The macro.
            "struct TripIdea {", // The type.
            "    @Guide(description: \"A short, catchy title\")", // A hint.
            "    var title: String", // First field.
            "    @Guide(description: \"Things to do\", .count(\(count)))", // The count rule.
            "    var activities: [String]", // Second field.
            "    @Guide(.range(\(days.lowerBound)...\(days.upperBound)))", // The range rule.
            "    var days: Int", // Last field.
            "}", // Closing brace.
        ]
    }

    /// The guided value as Swift source, showing only the fields that have arrived.
    static func revealLines(_ idea: ScriptedIdea, upTo count: Int) -> [String] { // Pure, for display.
        var lines = ["TripIdea("] // Opening.
        if count >= 1 { lines.append("  title: \"\(idea.title)\",") } // The first field.
        let shown = max(0, min(count - 1, idea.activities.count)) // How many activities have arrived.
        lines.append("  activities: [" + idea.activities.prefix(shown).map { "\"\($0)\"" }.joined(separator: ", ") + "],") // The array so far.
        if count >= idea.activities.count + 2 { lines.append("  days: \(idea.days)") } // The last field.
        lines.append(")") // Closing.
        return lines // The listing.
    }

    // MARK: - Vision, Core ML and other machine-learning tools

    private var otherToolsCard: some View { // The last concept step, with two live models.
        DemoCard(title: "Vision, Core ML and other machine-learning tools", caption: "Other frameworks run trained models on the Neural Engine. These two run right here, on this device.") { // Course concept step.
            TermRow(term: "Natural Language", text: "Detects a text's language, splits it into sentences and words, and tags names of people and places.") // Course point.
            MenuPicker(title: "Sample", selection: $sentence) { // Ready-made sentences in three languages.
                ForEach(LanguageTools.samples, id: \.self) { Text(verbatim: String($0.prefix(28)) + "...").tag($0) } // A short preview of each.
            }
            TextField("Sentence", text: $sentence, axis: .vertical) // Or type your own.
                .textFieldStyle(.roundedBorder) // A visible box.
            Text(verbatim: "Language: \(LanguageTools.dominantLanguage(of: sentence)).") // Language detection, live.
                .font(.footnote) // Small print.
            Text(verbatim: LanguageTools.canTagNames ? "Names: \(LanguageTools.names(in: sentence).isEmpty ? "none found" : LanguageTools.names(in: sentence).joined(separator: ", "))" : "Names: the name-tagging model is not installed on this device (common in the Simulator), so the app checks first and skips it.") // Name tagging, only when its model exists.
                .font(.footnote) // Small print.
                .font(.footnote) // Small print.
            TermRow(term: "Vision", text: "Analyzes images: reads text with RecognizeTextRequest and finds faces, barcodes and document edges.") // Course point.
            TrailSignView() // The sign Vision will read.
            Button("Read the sign with Vision", systemImage: "text.viewfinder") { readSign() } // Runs text recognition.
                .buttonStyle(.bordered) // Secondary.
            Text(verbatim: signLines.isEmpty ? signStatus : "Vision read: \(signLines.joined(separator: " / "))") // The result.
                .font(.footnote) // Small print.
            TermRow(term: "Core ML", text: "Runs models you trained or converted yourself, such as a plant classifier. Create ML trains simple models from labeled examples without code.") // Course point.
            TermRow(term: "Speech and Translation", text: "Turn speech into text and translate between languages, on device for supported languages.") // Course point.
            CalloutBox(title: "Prefer on-device first", text: "On-device processing keeps data private, works offline and costs nothing per request. Tell people when their data leaves the phone.", symbol: "lock.shield") // Course callout.
        }
    }

    /// Renders the sign to an image and asks Vision to read it.
    private func readSign() { // Called by the button.
        let renderer = ImageRenderer(content: TrailSignView()) // Draws a SwiftUI view into an image.
        renderer.scale = 3 // Sharp enough for text recognition.
        guard let image = renderer.cgImage else { signStatus = "Could not draw the sign."; return } // Drawing failed.
        signStatus = "Reading..." // Progress.
        Task { // Recognition is asynchronous.
            do { // Vision can throw.
                signLines = try await SignReader.readText(in: image) // The lines Vision found.
                if signLines.isEmpty { signStatus = "Vision found no text." } // Nothing recognized.
            } catch { // Vision could not run here.
                signStatus = "Vision could not run here: \(error.localizedDescription)" // Say why.
            }
        }
    }
}

/// A trail sign drawn in SwiftUI, for Vision to read.
struct TrailSignView: View { // Brown board, white letters, like a park sign.
    var body: some View { // Two lines of text.
        VStack(spacing: 2) { // Name above distance.
            Text("RIDGE LOOP") // The trail's name.
                .font(.title2.bold()) // Large and bold.
            Text("Summit 6.4 km") // The distance.
                .font(.headline) // Smaller.
        }
        .foregroundStyle(.white) // White letters...
        .padding(.horizontal, 24) // ...with room around them...
        .padding(.vertical, 12) // ...top and bottom...
        .background(Color.brown, in: .rect(cornerRadius: 8)) // ...on a brown board.
    }
}

#Preview { // Shows the lesson in Xcode's canvas.
    NavigationStack { // Gives the page its title bar.
        OnDeviceIntelligenceLesson(lesson: ContentView.lessons[5]) // Lesson 7.6.
    }
}

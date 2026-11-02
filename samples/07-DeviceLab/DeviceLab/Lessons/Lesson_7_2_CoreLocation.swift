// Lesson_7_2_CoreLocation.swift
// Who: students opening lesson 7.2 from the home screen.
// What: the course's LocationModel streaming real positions, a practice run of its
//       loop body for every update flag, the Empire State to Times Square distance,
//       a world measuring lab with bearings, reverse geocoding with @concurrent,
//       and the live configurations that trade accuracy for battery.
// Where: pushed by ContentView when the student taps "7.2".
// When: built when the lesson opens; location starts only when the student turns
//       on Live updates, and stops when they turn it off or leave.
// Why: position changes over time, so Swift models it as an AsyncSequence; this
//      screen lets students watch each update and each flag arrive.

import SwiftUI // Views and state.
import CoreLocation // CLLocation and its fields.

struct CoreLocationLesson: View { // The screen for lesson 7.2.
    let lesson: Lesson // The lesson row that opened this screen.
    @State private var model = LocationModel() // The real, live model.
    @State private var liveOn = false // The Live updates switch; off until the student asks.
    @State private var liveKind = LiveActivityKind.fitness // The live configuration; hikers are on foot.
    @State private var practiceModel = LocationModel() // A second model that only practice mode feeds.
    @State private var scenario = LoopScenario.location // The practice scenario.
    @State private var degreeLatitude = 0.0 // Latitude for the "degrees are not meters" slider.
    @State private var usage = DistanceUsage.road // .road or .person for the course's distance example.
    @State private var region = RegionChoice.unitedStates // Which region's formatting to use.
    @State private var youLatitude = 37.7694 // The "You" pin's latitude; starts at Golden Gate Park.
    @State private var youLongitude = -122.4862 // The "You" pin's longitude.
    @State private var landmark = Landmark.all[2] // The landmark to measure to; starts at the Golden Gate Bridge.
    @State private var placeSpot = PlaceSpot.empireState // Which point to name.
    @State private var placeResult = "" // The last place name found.
    @State private var lookups = 0 // How many lookups were sent; each is a trip to Apple's servers.
    @State private var lookingUp = false // True while a lookup is in flight.

    var body: some View { // The whole lesson page.
        LessonPage(lesson: lesson) { // CourseKit's scrolling page.
            fixCard // What one CLLocation holds.
            updatesCard // Updates arrive over time.
            streamCard // The course's model, live and in practice.
            distanceCard // The course's distance example.
            worldCard // The measuring lab.
            placeNameCard // Coordinates to a place name.
            batteryCard // Accuracy, battery and the background.
        }
        .task(id: "\(liveOn)-\(liveKind.rawValue)") { // Restarts whenever the switch or the configuration changes.
            guard liveOn else { return } // Off: nothing to run.
            do { // start() can throw if the stream fails.
                try await model.start(liveKind) // Loops until SwiftUI cancels this task.
            } catch is CancellationError { // Cancelled on purpose: not an error.
            } catch { // A real failure.
                model.status = "Stopped: \(error.localizedDescription)" // Tell the student.
            }
        }
        .onChange(of: liveOn) { _, on in // The switch moved.
            if !on { model.stop(); model.status = "Stopped" } // Release the session; the location arrow disappears.
        }
        .onDisappear { model.stop() } // Leaving the lesson ends the session too.
    }

    // MARK: - How a phone knows where it is

    private var fixCard: some View { // The concept step, with a real fix when one exists.
        DemoCard(title: "How a phone knows where it is", caption: "Each answer is a CLLocation. Turn on Live updates below to fill these in with real values.") { // Course concept step.
            let fix = model.location // The latest real fix, if any.
            TermRow(term: "coordinate", text: fix.map { String(format: "%.5f, %.5f", $0.coordinate.latitude, $0.coordinate.longitude) } ?? "No fix yet. Latitude and longitude, in degrees.") // Real value or the definition.
            TermRow(term: "horizontalAccuracy", text: fix.map { String(format: "%.0f m: the true position is probably within this radius.", $0.horizontalAccuracy) } ?? "The radius, in meters, the true position is likely inside. Negative means invalid.") // Real value or the definition.
            TermRow(term: "altitude, speed, course", text: fix.map { String(format: "%.0f m high, %.1f m/s, %.0f degrees (negative means unknown).", $0.altitude, $0.speed, $0.course) } ?? "Height in meters, speed in meters per second, direction in degrees. Negative speed or course means unknown.") // Real values or the definition.
            TermRow(term: "timestamp", text: fix.map { "Measured \($0.timestamp.formatted(date: .omitted, time: .standard)). An old timestamp means a cached position." } ?? "When the fix was measured. An old timestamp means a cached position.") // Real value or the definition.
            CalloutBox(title: "Degrees are not meters", text: "A degree of latitude is about 111 km everywhere, but a degree of longitude shrinks toward the poles. Drag the slider.") // Course callout.
            LabeledSlider(title: "Latitude", value: $degreeLatitude, range: 0...85, step: 5) // Move north from the equator.
            Text(verbatim: String(format: "At latitude %d: one degree of longitude is %.1f km", Int(degreeLatitude), DistanceLab.metersPerDegreeOfLongitude(atLatitude: degreeLatitude) / 1000)) // Computed by Core Location, shown in km like the callout.
                .font(.footnote) // Small print.
        }
    }

    // MARK: - Updates arrive over time

    private var updatesCard: some View { // The AsyncSequence concept step.
        DemoCard(title: "Updates arrive over time", caption: "CLLocationUpdate.liveUpdates() is an AsyncSequence: read it with for try await, and the loop body runs once per update. A CLServiceSession states your goal, such as .whenInUse.") { // Course concept step.
            TermRow(term: "authorizationDenied", text: "The person said no, so location is nil.") // Course point.
            TermRow(term: "locationUnavailable", text: "No position can be found right now.") // Course point.
            TermRow(term: "accuracyLimited", text: "The person chose approximate location.") // Course point.
            TermRow(term: "stationary", text: "The device stopped moving, so updates pause.") // Course point.
        }
    }

    // MARK: - Stream locations into an @Observable model

    private var streamCard: some View { // The course's LocationModel, running.
        DemoCard(title: "Stream locations into an @Observable model", caption: "Live updates runs the course's start() in a .task. In the Simulator, use Features > Location, or xcrun simctl location <device> set 37.7694,-122.4862.") { // Course code step.
            Toggle("Live updates", isOn: $liveOn) // Starts and stops the real stream.
            MenuPicker(title: "Configuration", selection: $liveKind) { // The live configuration passed to liveUpdates(_:).
                ForEach(LiveActivityKind.allCases) { kind in Text(verbatim: kind.rawValue).tag(kind) } // One row per kind.
            }
            PhonePanel(symbol: model.status == "Live" ? "location.fill" : "location", title: model.status, text: model.location.map { "\(DistanceText.text(meters: $0.distance(from: Trail.samples[0].location))) to Lakeshore Trail. Updates so far: \(model.updateCount)." } ?? "No position yet. Updates so far: \(model.updateCount).", tone: model.status == "Live" ? .ok : .neutral) // The live result.
            Divider() // Separates live mode from practice.
            Text("One trip through the loop body") // The course simulation's title.
                .font(.subheadline.weight(.semibold)) // A small heading.
            MenuPicker(title: "Update", selection: $scenario) { // The five states the course offers.
                ForEach(LoopScenario.allCases) { item in Text(verbatim: item.rawValue).tag(item) } // One row per state.
            }
            CodeListing(lines: LoopScenario.listing, highlighted: scenario.linesRun) // The lines that run are tinted.
            PhonePanel(symbol: "figure.hiking", title: practiceModel.status, text: scenario.screenText, tone: scenario == .location ? .ok : (scenario == .denied ? .bad : .warn)) // What Trailhead shows.
        }
        .onChange(of: scenario, initial: true) { _, item in // Runs at first appearance and on every pick.
            practiceModel.apply(location: item.carriesLocation ? Trail.sampleSpot : nil, flags: item.flags) // The same loop body, fed a pretend update.
        }
    }

    // MARK: - Distance between two places

    private var distanceCard: some View { // The course's distance example, run for real.
        let transcript = DistanceLab.run(usage: usage.value, locale: region.locale) // Runs the example with the chosen format.
        return DemoCard(title: "Distance between two places", caption: "The Empire State Building to Times Square, measured along the curved surface of the Earth, then formatted for a region.") { // Course code step.
            Picker("Usage", selection: $usage) { // .road or .person.
                ForEach(DistanceUsage.allCases) { item in Text(verbatim: item.rawValue).tag(item) } // Two choices.
            }
            .pickerStyle(.segmented) // Side by side.
            Picker("Region", selection: $region) { // Which region's units and decimal marks.
                ForEach(RegionChoice.allCases) { item in Text(verbatim: item.rawValue).tag(item) } // A few regions.
            }
            .pickerStyle(.segmented) // Side by side.
            ConsoleView(lines: transcript.lines) // print(meters), then print(text).
        }
    }

    // MARK: - Measure the world with real Swift

    private var worldCard: some View { // The course's measuring widget, rebuilt natively.
        let you = CLLocation(latitude: youLatitude, longitude: youLongitude) // The "You" pin.
        let meters = landmark.location.distance(from: you) // Surface distance.
        let bearing = DistanceLab.bearing(from: you, to: landmark.location) // Direction to travel.
        return DemoCard(title: "Measure the world with real Swift", caption: "Move the You pin with the sliders, or use your real location, and pick a landmark.") { // Course widget step.
            LabeledSlider(title: "Latitude", value: $youLatitude, range: -80...80) // North and south.
            LabeledSlider(title: "Longitude", value: $youLongitude, range: -180...180) // East and west.
            Text(verbatim: String(format: "You: %.4f, %.4f", youLatitude, youLongitude)) // The pin's coordinate.
                .font(.footnote.monospaced()) // Numbers line up.
            Button("Use my location", systemImage: "location") { // Copies the live fix into the pin.
                let fix = model.location ?? Trail.sampleSpot // The real fix, or the sample spot when there is none.
                youLatitude = fix.coordinate.latitude // Move the pin north or south.
                youLongitude = fix.coordinate.longitude // Move the pin east or west.
            }
            .buttonStyle(.bordered) // Secondary.
            MenuPicker(title: "Landmark", selection: $landmark) { // Where to measure to.
                ForEach(Landmark.all) { place in Text(verbatim: place.name).tag(place) } // One row per landmark.
            }
            Text(verbatim: "\(landmark.name): \(DistanceText.text(meters: meters)), heading \(Int(bearing.rounded())) degrees (\(DistanceLab.compassPoint(for: bearing)))") // Distance and direction.
                .font(.subheadline) // Readable.
            Text("Trails, nearest first") // A small heading.
                .font(.footnote.weight(.semibold)) // Bold.
            ForEach(TrailSorter.sorted(Trail.samples, from: you).prefix(3)) { trail in // The three nearest trailheads.
                Text(verbatim: "\(trail.name): \(DistanceText.text(meters: trail.location.distance(from: you)))") // Name and distance.
                    .font(.footnote) // Small.
            }
        }
    }

    // MARK: - Turn coordinates into a place name

    private var placeNameCard: some View { // The course's placeName(for:), run on demand.
        DemoCard(title: "Turn coordinates into a place name", caption: "MKReverseGeocodingRequest asks Apple's servers, so it needs a network connection. Look a place up once, not on every location update.") { // Course code step.
            MenuPicker(title: "Place", selection: $placeSpot) { // Which coordinate to name.
                ForEach(PlaceSpot.allCases) { item in Text(verbatim: item.rawValue).tag(item) } // A few choices.
            }
            Button(lookingUp ? "Looking up..." : "Look up the name", systemImage: "mappin.and.ellipse") { // Starts one lookup.
                let point = placeSpot.location(live: model.location) // The coordinate to name.
                lookingUp = true // Disable the button meanwhile.
                lookups += 1 // Count the server trip.
                Task { // The lookup is asynchronous.
                    placeResult = await placeName(for: point) // Runs off the main actor, then comes back.
                    lookingUp = false // Ready for another lookup.
                }
            }
            .buttonStyle(.borderedProminent) // The card's main action.
            .disabled(lookingUp) // One lookup at a time.
            Text(verbatim: placeResult.isEmpty ? "No lookup yet." : placeResult) // The name, or a hint.
                .font(.headline) // The result stands out.
            Text(verbatim: "Lookups sent: \(lookups)") // Each one is a network request.
                .font(.footnote) // Small print.
                .foregroundStyle(.secondary) // Quieter.
            CalloutBox(title: "Why @concurrent?", text: "This app uses main-actor isolation by default. Marking placeName(for:) @concurrent moves the wait for Apple's servers off the main actor, which Swift 6 requires here.", symbol: "cpu") // Explains the one change from the course's code.
        }
    }

    // MARK: - Accuracy, battery and the background

    private var batteryCard: some View { // The concept step about power.
        DemoCard(title: "Accuracy, battery and the background", caption: "Precision costs power, and GPS is the hungriest source. The Configuration picker above passes a live configuration to liveUpdates(_:).") { // Course concept step.
            TermRow(term: "Configurations", text: ".default, .automotiveNavigation, .otherNavigation, .fitness and .airborne.") // Course point.
            TermRow(term: "Approximate location", text: "People can turn off Precise Location. Updates then set accuracyLimited, and positions can be kilometers off. Design for it.") // Course point.
            TermRow(term: "Background updates", text: "Add the Location updates background mode and hold a CLBackgroundActivitySession, started while the app is on screen. This sample does not, so updates stop when it leaves the screen.") // Course point, and what this app does.
            TermRow(term: "CLMonitor", text: "Watches conditions, such as entering a circular area, without streaming every position. Relaunching a closed app this way needs Always authorization.") // Course point.
            CalloutBox(title: "Stop when you are done", text: "Turning off Live updates cancels the task and invalidates the session, so the location arrow and the battery drain disappear.") // Course callout, tied to this screen.
        }
    }
}

/// A slider with its title and value shown on its left; outside a Form, Slider hides its label.
struct LabeledSlider: View { // Used by the measuring demos.
    let title: String // What the slider changes.
    @Binding var value: Double // The value it reads and writes.
    let range: ClosedRange<Double> // The allowed values.
    var step: Double? = nil // An optional step size.

    var body: some View { // Title, then the slider.
        HStack { // Side by side.
            Text(verbatim: title) // The title.
                .font(.subheadline) // Readable.
                .frame(width: 84, alignment: .leading) // Titles line up in a column.
            if let step { // A stepped slider.
                Slider(value: $value, in: range, step: step) // Jumps in steps.
            } else { // A smooth slider.
                Slider(value: $value, in: range) // Any value in the range.
            }
        }
    }
}

/// The two unit usages the course's try-it compares.
enum DistanceUsage: String, CaseIterable, Identifiable { // Raw values are the labels.
    case road = ".road" // Miles or kilometers.
    case person = ".person" // Inches or centimeters, for a person's height.
    var id: String { rawValue } // Unique.
    var value: MeasurementFormatUnitUsage<UnitLength> { self == .road ? .road : .person } // The Foundation value.
}

/// Regions whose formatting the distance example can show.
enum RegionChoice: String, CaseIterable, Identifiable { // Raw values are the labels.
    case unitedStates = "US" // Miles, period decimals.
    case unitedKingdom = "UK" // Miles on roads too.
    case germany = "Germany" // Kilometers, comma decimals.
    var id: String { rawValue } // Unique.
    var locale: Locale { // The matching locale.
        switch self { // One identifier per region.
        case .unitedStates: Locale(identifier: "en_US") // United States English.
        case .unitedKingdom: Locale(identifier: "en_GB") // British English.
        case .germany: Locale(identifier: "de_DE") // German.
        }
    }
}

/// Points the place-name demo can look up.
enum PlaceSpot: String, CaseIterable, Identifiable { // Raw values are the labels.
    case empireState = "Empire State" // The course's example.
    case goldenGatePark = "Golden Gate Park" // The Simulator's sample spot.
    case me = "My location" // The live fix, when there is one.
    var id: String { rawValue } // Unique.

    /// The coordinate to look up; "My location" falls back to the sample spot without a live fix.
    func location(live: CLLocation?) -> CLLocation { // The live fix is passed in.
        switch self { // One coordinate per choice.
        case .empireState: DistanceLab.empireState // The course's spot.
        case .goldenGatePark: Trail.sampleSpot // Golden Gate Park.
        case .me: live ?? Trail.sampleSpot // The real position, if known.
        }
    }
}

#Preview { // Shows the lesson in Xcode's canvas.
    NavigationStack { // Gives the page its title bar.
        CoreLocationLesson(lesson: ContentView.lessons[1]) // Lesson 7.2.
    }
}

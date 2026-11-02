// Lesson_7_3_MapKitSwiftUI.swift
// Who: students opening lesson 7.3 from the home screen.
// What: maps as ordinary SwiftUI views: every kind of map content and camera
//       position, the course's TrailMapView, CameraDemo, CoffeeSearchView and WalkView,
//       a map you build by tapping (with the matching code written beside it), and a
//       Look Around preview.
// Where: pushed by ContentView when the student taps "7.3".
// When: built when the lesson opens; search, directions and Look Around ask Apple's
//       servers, so they need a network connection.
// Why: a Map is just another view, the visible area is just state, and search and
//      directions are asynchronous requests that fill that state in.

import SwiftUI // Views, state and animation.
import MapKit // Map, Marker, Annotation, MKLocalSearch, MKDirections and Look Around.

struct MapKitSwiftUILesson: View { // The screen for lesson 7.3.
    let lesson: Lesson // The lesson row that opened this screen.
    @State private var overviewPosition: MapCameraPosition = .automatic // The first card's camera.
    @State private var cameraChoice = CameraChoice.automatic // Which kind of camera position is shown.
    @State private var overviewLook = MapLook.standard // The first card's style.
    @State private var cameraConsole = Transcript() // What CameraDemo prints.
    @State private var handPosition: MapCameraPosition = .region(MKCoordinateRegion(center: .pier39, latitudinalMeters: 2500, longitudinalMeters: 2500)) // The hand-built map's camera.
    @State private var pins: [DroppedPin] = [] // Pins dropped by tapping.
    @State private var tool = PinKind.marker // What a tap drops.
    @State private var handLook = MapLook.standard // The hand-built map's style.
    @State private var realistic = false // Flat or 3D elevation.
    @State private var query = "coffee" // The search words.
    @State private var fromMe = false // Directions start: Pier 39 or the device's location.
    @State private var walking = true // Walking or driving directions.
    @State private var scene: MKLookAroundScene? // The Look Around scene, once fetched.

    var body: some View { // The whole lesson page.
        LessonPage(lesson: lesson) { // CourseKit's scrolling page.
            overviewCard // Content, camera positions and styles.
            DemoCard(title: "Markers and annotations", caption: "The course's TrailMapView: a standard pin, a custom pin and the blue dot, which appears only with location permission.") { // Course code step.
                TrailMapView() // The view from the course.
                    .frame(height: 260) // A map needs a fixed height inside a scrolling page.
                    .clipShape(.rect(cornerRadius: 12)) // Rounded corners to match the card.
            }
            DemoCard(title: "Move the camera", caption: "The course's CameraDemo. Tilt over the pier, then pan or zoom: onMapCameraChange prints the zoom level when each move ends.") { // Course code step.
                CameraDemo(console: $cameraConsole) // The view from the course, printing into the console below.
                    .frame(height: 260) // Fixed height inside the page.
                    .clipShape(.rect(cornerRadius: 12)) // Rounded corners.
                ConsoleView(lines: Array(cameraConsole.lines.suffix(4))) // The last four printed lines.
            }
            handBuiltCard // Build a map by hand.
            searchCard // Search for places.
            directionsCard // Directions and Look Around.
        }
    }

    // MARK: - A map is just another view

    private var overviewCard: some View { // The concept step, live.
        DemoCard(title: "A map is just another view", caption: "Every kind of map content from the lesson, with a picker for each kind of MapCameraPosition and each style.") { // Course concept step.
            Map(position: $overviewPosition) { // The camera is bound to state.
                Marker("Lakeshore Trail", systemImage: "figure.hiking", coordinate: Trail.samples[0].coordinate) // A balloon pin with a symbol.
                    .tint(.green) // A tint color.
                Annotation("Ridge Loop", coordinate: Trail.samples[1].coordinate) { // Any SwiftUI view, pinned.
                    Image(systemName: "mountain.2.fill") // A custom badge.
                        .padding(6) // Room for the circle.
                        .foregroundStyle(.white) // White icon...
                        .background(.orange, in: .circle) // ...on an orange circle.
                }
                UserAnnotation() // The blue dot, once location is allowed.
                MapCircle(center: Trail.sampleSpot.coordinate, radius: 1000) // A circle 1 km around Golden Gate Park.
                    .foregroundStyle(.blue.opacity(0.15)) // A light fill.
                    .stroke(.blue, lineWidth: 1) // A thin outline.
                MapPolyline(coordinates: Self.landsEndPath) // A line through points: the Lands End Trail.
                    .stroke(.green, lineWidth: 4) // Thick enough to follow.
            }
            .mapStyle(overviewLook.style(realistic: false)) // Standard, imagery or hybrid.
            .frame(height: 260) // Fixed height inside the page.
            .clipShape(.rect(cornerRadius: 12)) // Rounded corners.
            MenuPicker(title: "Camera", selection: $cameraChoice) { // The five kinds of camera position.
                ForEach(CameraChoice.allCases) { choice in Text(verbatim: choice.rawValue).tag(choice) } // One row per kind.
            }
            Picker("Style", selection: $overviewLook) { // The three styles.
                ForEach(MapLook.allCases) { look in Text(verbatim: ".\(look.rawValue)").tag(look) } // One per style.
            }
            .pickerStyle(.segmented) // Side by side.
            TermRow(term: "Marker", text: "A balloon pin with a title, an optional symbol and a tint color.") // Course term.
            TermRow(term: "Annotation", text: "Any SwiftUI view you pin to a coordinate, such as a photo or a badge.") // Course term.
            TermRow(term: "UserAnnotation", text: "The blue dot that shows where the person holding the phone is.") // Course term.
            TermRow(term: "MapCircle and MapPolyline", text: "Shapes drawn on the map: a circle with a radius in meters, or a line through points or along a route.") // Course term.
            CalloutBox(title: "The blue dot still needs permission", text: "Styles and map controls need nothing special. UserAnnotation only appears after the app has location authorization.", symbol: "exclamationmark.triangle") // Course callout.
        }
        .onChange(of: cameraChoice) { _, choice in // A new camera kind was picked.
            withAnimation { overviewPosition = choice.position } // Glide instead of jumping.
        }
    }

    /// A few points along the Lands End Trail, for MapPolyline.
    static let landsEndPath = [ // West to east along the cliffs.
        CLLocationCoordinate2D(latitude: 37.7804, longitude: -122.5110), // Trailhead near the Sutro Baths.
        CLLocationCoordinate2D(latitude: 37.7823, longitude: -122.5052), // Above Mile Rock Beach.
        CLLocationCoordinate2D(latitude: 37.7853, longitude: -122.5003), // Eagle's Point.
        CLLocationCoordinate2D(latitude: 37.7876, longitude: -122.4935), // Toward the Legion of Honor.
    ]

    // MARK: - Build a map by hand

    private var handBuiltCard: some View { // The course's map-building widget, rebuilt natively.
        DemoCard(title: "Build a map by hand", caption: "Pick a tool and tap the map to drop a Marker or an Annotation. The SwiftUI below always matches the map.") { // Course widget step.
            Picker("Tool", selection: $tool) { // What a tap drops.
                ForEach(PinKind.allCases) { kind in Text(verbatim: kind.rawValue).tag(kind) } // Marker or Annotation.
            }
            .pickerStyle(.segmented) // Side by side.
            MapReader { proxy in // Gives a proxy that converts screen points to coordinates.
                Map(position: $handPosition) { // The hand-built map.
                    ForEach(pins) { pin in // One piece of content per dropped pin.
                        if pin.kind == .marker { // A balloon.
                            Marker("Pin \(pin.id)", coordinate: pin.coordinate) // Titled by drop order.
                        } else { // A custom view.
                            Annotation("Pin \(pin.id)", coordinate: pin.coordinate) { // Pinned view.
                                Image(systemName: "binoculars.fill") // The course's binoculars.
                                    .padding(6) // Room for the circle.
                                    .background(.white, in: .circle) // A solid backdrop.
                                    .foregroundStyle(.black) // Readable on white in both modes.
                            }
                        }
                    }
                }
                .mapStyle(handLook.style(realistic: realistic)) // The chosen style and elevation.
                .onTapGesture { point in // A tap gives a point in the map's own space.
                    guard let coordinate = proxy.convert(point, from: .local) else { return } // Screen point to latitude and longitude.
                    pins.append(DroppedPin(id: pins.count + 1, kind: tool, latitude: coordinate.latitude, longitude: coordinate.longitude)) // Drop a pin there.
                }
            }
            .frame(height: 260) // Fixed height inside the page.
            .clipShape(.rect(cornerRadius: 12)) // Rounded corners.
            Picker("Style", selection: $handLook) { // Standard, imagery or hybrid.
                ForEach(MapLook.allCases) { look in Text(verbatim: ".\(look.rawValue)").tag(look) } // One per style.
            }
            .pickerStyle(.segmented) // Side by side.
            Toggle("Realistic elevation", isOn: $realistic) // Flat or 3D.
            HStack { // Two map actions.
                Button("Reset camera") { withAnimation { handPosition = .automatic } } // .automatic frames every pin.
                    .buttonStyle(.bordered) // Secondary.
                Button("Clear pins") { pins = [] } // Start over.
                    .buttonStyle(.bordered) // Secondary.
            }
            CodeListing(lines: MapCodeBuilder.lines(pins: pins, look: handLook, realistic: realistic)) // The matching SwiftUI.
        }
    }

    // MARK: - Search for places

    private var searchCard: some View { // The course's CoffeeSearchView, with a query picker.
        DemoCard(title: "Search for places", caption: "The course's CoffeeSearchView. MKLocalSearch asks Apple's servers near Pier 39; tap a marker to select it.") { // Course code step.
            Picker("Search for", selection: $query) { // The course's try-it words.
                ForEach(["coffee", "bookstore", "playground"], id: \.self) { word in Text(verbatim: word).tag(word) } // Three queries.
            }
            .pickerStyle(.segmented) // Side by side.
            CoffeeSearchView(query: query) // The view from the course.
                .frame(height: 280) // Fixed height inside the page.
                .clipShape(.rect(cornerRadius: 12)) // Rounded corners.
        }
    }

    // MARK: - Directions and Look Around

    private var directionsCard: some View { // The course's WalkView plus a Look Around preview.
        DemoCard(title: "Directions and Look Around", caption: "The course's WalkView asks MKDirections for a route to Coit Tower. Starting from My location needs location permission, so Pier 39 is the default start.") { // Course code step.
            Toggle("Start from My location", isOn: $fromMe) // The course's .forCurrentLocation().
            Toggle("Walking (off: driving)", isOn: $walking) // The course's try-it.
            WalkView(destination: Self.coitTowerItem, fromCurrentLocation: fromMe, transport: walking ? .walking : .automobile) // The view from the course.
                .frame(height: 260) // Fixed height inside the page.
                .clipShape(.rect(cornerRadius: 12)) // Rounded corners.
            Text("Look Around at Coit Tower") // A small heading.
                .font(.subheadline.weight(.semibold)) // Bold.
            LookAroundPreview(initialScene: scene) // Street-level imagery; empty until the scene arrives.
                .frame(height: 180) // A short strip.
                .clipShape(.rect(cornerRadius: 12)) // Rounded corners.
                .overlay { // Shown on top while there is no scene.
                    if scene == nil { Text("Loading Look Around, or none here.").font(.footnote).foregroundStyle(.secondary) } // A calm placeholder.
                }
                .task { scene = await lookAroundScene(at: .coitTower) } // Fetch the scene once.
        }
    }

    /// Coit Tower as a map item, the currency MapKit's routing accepts.
    static let coitTowerItem: MKMapItem = { // Built once.
        let item = MKMapItem(location: CLLocation(latitude: CLLocationCoordinate2D.coitTower.latitude, longitude: CLLocationCoordinate2D.coitTower.longitude), address: nil) // A place from a location.
        item.name = "Coit Tower" // A name for markers and selection.
        return item // The finished item.
    }() // The () runs the closure once, when the property is first read.
}

/// The five kinds of MapCameraPosition the lesson names.
enum CameraChoice: String, CaseIterable, Identifiable { // Raw values are the Swift spellings.
    case automatic = ".automatic" // Fit all the content.
    case region = ".region" // A center plus a span.
    case camera = ".camera" // A 3D viewpoint.
    case userLocation = ".userLocation(fallback:)" // Follow the blue dot, or fall back.
    case item = ".item" // One place.
    var id: String { rawValue } // Unique.

    /// The camera position for this choice.
    var position: MapCameraPosition { // Assigned inside withAnimation.
        switch self { // One position per kind.
        case .automatic: .automatic // Frames every marker, circle and line.
        case .region: .region(MKCoordinateRegion(center: Trail.sampleSpot.coordinate, latitudinalMeters: 3000, longitudinalMeters: 3000)) // 3 km around the park.
        case .camera: .camera(MapCamera(centerCoordinate: Trail.samples[1].coordinate, distance: 1500, heading: 30, pitch: 55)) // Tilted over Twin Peaks.
        case .userLocation: .userLocation(fallback: .automatic) // Needs permission; otherwise frames the content.
        case .item: .item(MapKitSwiftUILesson.coitTowerItem) // Centers on one map item.
        }
    }
}

/// The course's trail map: one standard pin, one custom pin and the blue dot.
struct TrailMapView: View { // From "Markers and annotations".
    @State private var position: MapCameraPosition = .automatic // Starts by framing the content.
    var body: some View { // One Map with content and two modifiers.
        Map(position: $position) { // The map content builder.
            Marker("Pier 39", systemImage: "figure.walk", // A balloon with a walking figure.
                   coordinate: .pier39) // At the pier.
            Annotation("Coit Tower", coordinate: .coitTower) { // A custom pin.
                Image(systemName: "binoculars.fill").padding(6) // The binoculars, with room around them.
                    .background(.white, in: .circle) // A white circle behind.
                    .foregroundStyle(.black) // Added for dark mode: black stays readable on the white circle.
            }
            UserAnnotation() // The blue dot.
        }
        .mapStyle(.standard(elevation: .realistic)) // 3D terrain and buildings when tilted.
        .mapControls { // The floating system controls.
            MapUserLocationButton() // Recenters on the user.
            MapCompass() // Appears once the map is rotated.
        }
    }
}

/// The course's camera demo, printing into a console instead of Xcode's.
struct CameraDemo: View { // From "Move the camera".
    @Binding var console: Transcript // Added for this app: where the prints go.
    @State private var position = MapCameraPosition.region( // Starts on a region, not .automatic.
        MKCoordinateRegion(center: .pier39, // Centered on the pier.
            latitudinalMeters: 800, longitudinalMeters: 800)) // 800 m tall and wide.
    var body: some View { // A map, a handler and a button.
        Map(position: $position) // A map with no content; the camera is the lesson.
            .onMapCameraChange(frequency: .onEnd) { context in // Runs when each move ends.
                console.print(context.region.span.latitudeDelta) // The course's print(context.region.span.latitudeDelta).
            }
            .safeAreaInset(edge: .bottom) { // Space at the bottom for the button.
                Button("Tilt over the pier", action: tilt) // Calls tilt() below.
                    .buttonStyle(.glassProminent) // The course's try-it: Liquid Glass.
                    .padding(.bottom, 8) // Lifts it off the edge.
            }
    }
    func tilt() { // Moves the camera to a tilted 3D view.
        let camera = MapCamera(centerCoordinate: .pier39, // Looking at the pier.
            distance: 900, heading: 45, pitch: 60) // 900 m away, facing northeast, tilted 60 degrees.
        withAnimation { position = .camera(camera) } // Glide instead of jumping.
    }
}

/// The course's place search, taking its words as a parameter.
struct CoffeeSearchView: View { // From "Search for places".
    var query = "coffee" // Added for this app: the course searches for "coffee".
    @State private var results: [MKMapItem] = [] // The places found.
    @State private var selected: MKMapItem? // The marker the user tapped.
    var body: some View { // A map of results.
        Map(selection: $selected) { // Tapping a marker writes it into selected.
            ForEach(results, id: \.self) { Marker(item: $0) } // One marker per result.
        }
        .task(id: query) { await search(for: query) } // Searches on appear and whenever the words change.
        .onChange(of: selected) { print(selected?.name ?? "none") } // The course's try-it, printed to Xcode's console.
        .safeAreaInset(edge: .bottom) { // A label over the bottom of the map.
            Text(verbatim: selected?.name ?? "\(results.count) results. Tap a marker.") // The selection, or a hint.
                .font(.footnote) // Small.
                .padding(6) // Room inside the label.
                .background(.regularMaterial, in: .capsule) // Readable over any map.
                .padding(.bottom, 6) // Lifted off the edge.
        }
    }
    func search(for text: String) async { // Searches near Pier 39.
        let request = MKLocalSearch.Request() // An empty request.
        request.naturalLanguageQuery = text // The words to look for.
        request.region = MKCoordinateRegion(center: .pier39, // Prefer places around the pier...
            latitudinalMeters: 2000, longitudinalMeters: 2000) // ...about 2 km on each side.
        let search = MKLocalSearch(request: request) // The object that talks to Apple's servers.
        let response = try? await search.start() // Wait for the reply; failure becomes nil.
        results = response?.mapItems ?? [] // New results redraw the markers.
    }
}

/// The course's walking route, with the start and the travel mode as parameters.
struct WalkView: View { // From "Directions and Look Around".
    let destination: MKMapItem // Where to go.
    var fromCurrentLocation = true // Added: the course always starts from the current location.
    var transport: MKDirectionsTransportType = .walking // Added: the course's try-it compares .automobile.
    @State private var route: MKRoute? // The route, once it arrives.
    @State private var note = "Asking for a route..." // Added: what the label under the map says.
    var body: some View { // The map with the route line.
        Map { // No position binding: the camera frames the content.
            Marker(item: destination) // Added: shows the destination too.
            if let route { // Only once a route exists.
                MapPolyline(route).stroke(.blue, lineWidth: 5) // The path, thick and blue.
            }
        }
        .task(id: "\(fromCurrentLocation)-\(transport.rawValue)") { await findRoute() } // Asks again when the options change.
        .safeAreaInset(edge: .bottom) { // A summary over the bottom of the map.
            Text(verbatim: note) // Minutes and distance, or what went wrong.
                .font(.footnote) // Small.
                .padding(6) // Room inside the label.
                .background(.regularMaterial, in: .capsule) // Readable over any map.
                .padding(.bottom, 6) // Lifted off the edge.
        }
    }
    func findRoute() async { // Builds and sends the request.
        let request = MKDirections.Request() // An empty request.
        let pier = MKMapItem(location: CLLocation(latitude: CLLocationCoordinate2D.pier39.latitude, longitude: CLLocationCoordinate2D.pier39.longitude), address: nil) // Added: Pier 39 as a start that needs no permission.
        request.source = fromCurrentLocation ? .forCurrentLocation() : pier // The course uses .forCurrentLocation(), which needs location permission.
        request.destination = destination // Where to go.
        request.transportType = transport // .walking in the course.
        let directions = MKDirections(request: request) // The object that talks to Apple's servers.
        route = try? await directions.calculate().routes.first // The recommended route, or nil.
        if let route { // A route arrived.
            note = RouteSummary.text(seconds: route.expectedTravelTime, meters: route.distance) // For example "12 min, 0.66 mi".
        } else { // No route.
            note = fromCurrentLocation ? "No route: is location allowed?" : "No route: is the network on?" // The likely cause.
        }
    }
}

#Preview { // Shows the lesson in Xcode's canvas.
    NavigationStack { // Gives the page its title bar.
        MapKitSwiftUILesson(lesson: ContentView.lessons[2]) // Lesson 7.3.
    }
}

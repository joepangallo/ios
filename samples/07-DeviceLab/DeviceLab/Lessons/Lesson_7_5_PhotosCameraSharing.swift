// Lesson_7_5_PhotosCameraSharing.swift
// Who: students opening lesson 7.5 from the home screen.
// What: the system photo picker and what an app actually receives from it, the
//       course's PostcardView, loading straight into the Transferable TrailPhoto,
//       the camera as a protected sensor with the course's canUseCamera() check,
//       and the course's TrailShareView with ShareLink.
// Where: pushed by ContentView when the student taps "7.5".
// When: built when the lesson opens. The Simulator's Photos library includes a few
//       sample pictures to pick; it has no camera.
// Why: the friendliest way to get one picture is never to touch the library at all,
//      and the friendliest way to send one is the system share sheet.

import SwiftUI // Views, state, ShareLink and Transferable.
import PhotosUI // PhotosPicker and PhotosPickerItem.
import AVFoundation // Camera status and hardware.

struct PhotosCameraSharingLesson: View { // The screen for lesson 7.5.
    let lesson: Lesson // The lesson row that opened this screen.
    @State private var peekItem: PhotosPickerItem? // The item picked in the "what your app can see" demo.
    @State private var trailItem: PhotosPickerItem? // The item picked in the TrailPhoto demo.
    @State private var trailPhoto: TrailPhoto? // The loaded TrailPhoto.
    @State private var trailMessage = "Pick a photo to load it as a TrailPhoto." // Status of that demo.
    @State private var cameraStatus = AVCaptureDevice.authorizationStatus(for: .video) // The real camera status.
    @State private var cameraAnswer = "" // What canUseCamera() returned.
    @State private var practiceStatus = AVAuthorizationStatus.notDetermined // The practice picker's status.
    @State private var practiceHasKey = true // Practice: whether Info.plist has NSCameraUsageDescription.

    var body: some View { // The whole lesson page.
        LessonPage(lesson: lesson) { // CourseKit's scrolling page.
            pickerPrivacyCard // What the picker keeps private.
            DemoCard(title: "Pick a photo and load it", caption: "The course's PostcardView: Choose Photo, then a task loads the bytes as Data, decodes them with UIImage and shows them.") { // Course code step.
                PostcardView() // The view from the course.
                    .frame(maxWidth: .infinity, maxHeight: 280) // Keeps a tall photo from filling the page.
            }
            trailPhotoCard // Load straight into your own type.
            cameraSensorCard // The camera is a protected sensor.
            cameraCheckCard // Check camera permission.
            shareCard // Share with ShareLink.
        }
    }

    // MARK: - The photo picker keeps the library private

    private var pickerPrivacyCard: some View { // The concept step, with a peek at what the app receives.
        DemoCard(title: "The photo picker keeps the library private", caption: "The picker runs outside your app, so iOS shows no alert and needs no Info.plist key. Pick a photo to see everything your app receives.") { // Course concept step.
            PhotosPicker("Pick a photo", selection: $peekItem, matching: .images) // The system picker.
                .buttonStyle(.bordered) // Looks tappable.
            if let peekItem { // After a pick.
                Text("What your app can see") // The course widget's panel title.
                    .font(.subheadline.weight(.semibold)) // A small heading.
                Text(verbatim: "Content types: \(peekItem.supportedContentTypes.map(\.identifier).joined(separator: ", "))") // Only the file formats on offer.
                    .font(.footnote.monospaced()) // Identifiers are code-like.
                Text(verbatim: "Library identifier: \(peekItem.itemIdentifier ?? "nil, because the app never asked for library access")") // No way back into the library.
                    .font(.footnote.monospaced()) // Code-like.
                Text("That is all: a handle. The bytes arrive only when the app asks the item to load them.") // The lesson's point.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // Quieter.
            }
            TermRow(term: "PhotosPickerItem", text: "A handle to one picked photo or video. Loading its data is a separate, asynchronous step.") // Course term.
            TermRow(term: "Transferable", text: "A Swift protocol for types that convert themselves to and from data, such as Data, Image and String. Pickers, drag and drop, and sharing all rely on it.") // Course term.
            TermRow(term: "Full library access", text: "Reading the whole library through PHPhotoLibrary needs NSPhotoLibraryUsageDescription and an alert. This app does not have that key, and does not need it.") // Course term, tied to this app.
        }
    }

    // MARK: - Load straight into your own type

    private var trailPhotoCard: some View { // The course's TrailPhoto and load(_:).
        DemoCard(title: "Load straight into your own type", caption: "TrailPhoto conforms to Transferable, so load(_:) hands back a finished value in one call.") { // Course code step.
            PhotosPicker("Choose a trail photo", selection: $trailItem, matching: .images) // The system picker.
                .buttonStyle(.bordered) // Looks tappable.
            if let trailPhoto { // After a successful load.
                Image(uiImage: trailPhoto.image) // The decoded picture.
                    .resizable() // May scale.
                    .scaledToFit() // Without cropping.
                    .frame(maxHeight: 200) // A modest size.
                    .clipShape(.rect(cornerRadius: 10)) // Rounded corners.
            }
            Text(verbatim: trailMessage) // What happened.
                .font(.footnote) // Small print.
        }
        .task(id: trailItem) { // Restarts with every pick; a stale load is cancelled.
            guard let trailItem else { return } // Nothing picked yet.
            trailMessage = "Loading..." // Large or iCloud photos can take a moment.
            if let photo = await load(trailItem) { // The course's helper.
                trailPhoto = photo // Show it.
                trailMessage = "Loaded a TrailPhoto: \(photo.pixelSizeText)." // Proof it is a real value.
            } else { // Decoding failed and threw, so load returned nil.
                trailMessage = "That item could not be read as an image." // Calm message.
            }
        }
    }

    // MARK: - The camera is a protected sensor

    private var cameraSensorCard: some View { // The concept step, with this device's real hardware.
        DemoCard(title: "The camera is a protected sensor", caption: "Your app sees every camera frame live, so iOS always asks first. Camera code lives in AVFoundation.") { // Course concept step.
            Label(AVCaptureDevice.default(for: .video) == nil ? "No camera on this device (the Simulator has none)" : "This device has a camera", systemImage: "camera") // Real hardware check.
                .font(.subheadline.weight(.semibold)) // Stands out.
            TermRow(term: "AVCaptureSession", text: "Connects a camera input to outputs such as still photos or video frames. Use it for a custom camera screen, like a barcode scanner.") // Course term.
            TermRow(term: "UIImagePickerController", text: "A ready-made UIKit camera screen from before SwiftUI, wrapped in a UIViewControllerRepresentable to take one quick photo.") // Course term.
            TermRow(term: "Microphone", text: "Recording video with sound also needs NSMicrophoneUsageDescription and a second alert.") // Course term.
            CalloutBox(title: "The Simulator has no camera", text: "Test camera features on a real iPhone. The photo picker does work in the Simulator, which includes a few sample photos.", symbol: "exclamationmark.triangle") // Course callout.
        }
    }

    // MARK: - Check camera permission

    private var cameraCheckCard: some View { // The course's canUseCamera(), real and in practice.
        DemoCard(title: "Check camera permission", caption: "The real button runs canUseCamera(). Practice mode shows which branch runs for each status, and what a missing Info.plist key does.") { // Course code step.
            Text(verbatim: "Real status: \(AccessState.caseName(cameraStatus)) (\(AccessState(cameraStatus).rawValue))") // The current answer.
                .font(.subheadline) // Readable.
            Button("Run canUseCamera()", systemImage: "camera") { // The real check.
                Task { // The check may wait for the alert.
                    let allowed = await canUseCamera() // The course's function.
                    cameraAnswer = "canUseCamera() returned \(allowed)." // Show the Bool.
                    cameraStatus = AVCaptureDevice.authorizationStatus(for: .video) // Read the new status.
                }
            }
            .buttonStyle(.borderedProminent) // The card's main action.
            if !cameraAnswer.isEmpty { // After a run.
                Text(verbatim: cameraAnswer) // The result.
                    .font(.footnote) // Small print.
            }
            Divider() // Separates real from practice.
            MenuPicker(title: "Practice status", selection: $practiceStatus) { // Every status.
                ForEach([AVAuthorizationStatus.notDetermined, .authorized, .denied, .restricted], id: \.self) { status in // The four statuses.
                    Text(verbatim: AccessState.caseName(status)).tag(status) // Swift spelling.
                }
            }
            Toggle("Info.plist has NSCameraUsageDescription", isOn: $practiceHasKey) // Empty the purpose string.
            CodeListing(lines: CameraBranch.listing, highlighted: CameraBranch.linesRun(for: practiceStatus)) // The lines that run.
            Text(verbatim: CameraBranch.outcome(for: practiceStatus, hasPurposeString: practiceHasKey)) // What happens next.
                .font(.footnote) // Small print.
        }
    }

    // MARK: - Share with ShareLink

    private var shareCard: some View { // The course's TrailShareView, plus the picked photo.
        DemoCard(title: "Share with ShareLink", caption: "ShareLink opens the system share sheet. Your app hands over one Transferable item and never learns where it went.") { // Course code step.
            TrailShareView() // The view from the course.
            if let trailPhoto { // A photo was loaded in the TrailPhoto demo.
                ShareLink(item: Image(uiImage: trailPhoto.image), preview: SharePreview("Your trail photo", image: Image(uiImage: trailPhoto.image))) { // Any Transferable value can be shared.
                    Label("Share the photo you picked", systemImage: "square.and.arrow.up") // A specific label.
                }
            }
        }
    }
}

/// The course's postcard: pick one photo, load it, show it.
struct PostcardView: View { // From "Pick a photo and load it".
    @State private var item: PhotosPickerItem? // The picked item, or nil.
    @State private var photo: Image? // The loaded image, or nil.

    var body: some View { // Photo above button.
        VStack(spacing: 16) { // 16 points apart.
            photo?.resizable().scaledToFit() // Nothing until a photo loads.
            PhotosPicker("Choose Photo", selection: $item, // The system picker writes into item.
                         matching: .images) // Still images only.
        }
        .task(id: item) { // Restarts after every pick.
            let data = try? await item?.loadTransferable( // Load the bytes, or nil.
                type: Data.self) // As raw Data.
            if let data, let image = UIImage(data: data) { // Bytes that decode as a picture.
                photo = Image(uiImage: image) // Show it.
            }
        }
    }
}

/// The course's share screen: a link and a photo.
struct TrailShareView: View { // From "Share with ShareLink".
    let trailURL = URL(string: "https://example.com/trails/42")! // A fixed literal, safe to force unwrap.
    let photo = Image(systemName: "photo") // Stands in for a trail photo.

    var body: some View { // Two share buttons.
        VStack(spacing: 20) { // 20 points apart.
            ShareLink(item: trailURL, // Share the link.
                      subject: Text("Ridge Loop"), // Used by Mail as the subject.
                      message: Text("Hike this with me")) // Prefilled, editable text.
            ShareLink(item: photo, // Share the image.
                      preview: SharePreview("Trail photo", // The share sheet's title.
                                            image: photo)) { // Its thumbnail.
                Label("Share Photo", systemImage: "photo") // A custom label.
            }
        }
        .frame(maxWidth: .infinity) // Centered in the card.
    }
}

#Preview { // Shows the lesson in Xcode's canvas.
    NavigationStack { // Gives the page its title bar.
        PhotosCameraSharingLesson(lesson: ContentView.lessons[4]) // Lesson 7.5.
    }
}

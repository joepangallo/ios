// CameraPermission.swift
// Who: lesson 7.5's "Check camera permission" demo, and its unit tests.
// What: the course's canUseCamera() function, its code as the lesson prints it, and a
//       pure description of which branch runs for each camera status.
// Where: the Support folder.
// When: when the student taps the real check, or picks a status in practice mode.
// Why: the camera sees every frame live, so iOS always asks first. Only .notDetermined
//      may show the alert; every other status already has its answer.

import AVFoundation // AVCaptureDevice and AVAuthorizationStatus.

/// The course's question: may this app use the camera right now? Asks the person if needed.
func canUseCamera() async -> Bool { // Called from a button, inside a Task.
    switch AVCaptureDevice.authorizationStatus(for: .video) { // Reading the status never shows an alert.
    case .authorized: // Allowed earlier.
        return true // Open the camera.
    case .notDetermined: // Never asked: the only time the alert can appear.
        return await AVCaptureDevice.requestAccess(for: .video) // iOS shows the alert and returns the answer.
    case .denied, .restricted: // Said no, or blocked by someone else.
        return false // Explain and offer Settings.
    @unknown default: // A status from a future iOS.
        return false // Fail closed.
    }
}

/// What the practice picker shows for each camera status.
enum CameraBranch { // A namespace for pure helpers.
    /// The course's code; positions match `linesRun(for:)`.
    static let listing = [ // Copied from the course.
        "func canUseCamera() async -> Bool {", // 0
        "    switch AVCaptureDevice.authorizationStatus(for: .video) {", // 1
        "    case .authorized:", // 2
        "        return true", // 3
        "    case .notDetermined:", // 4
        "        return await AVCaptureDevice.requestAccess(for: .video)", // 5
        "    case .denied, .restricted:", // 6
        "        return false", // 7
        "    @unknown default:", // 8
        "        return false", // 9
        "    }", // 10
        "}", // 11
    ]

    /// The lines that run for a status.
    static func linesRun(for status: AVAuthorizationStatus) -> Set<Int> { // Used to tint the listing.
        switch status { // The switch line, the case and its return.
        case .authorized: [1, 2, 3] // Straight to true.
        case .notDetermined: [1, 4, 5] // The alert.
        case .denied, .restricted: [1, 6, 7] // Straight to false.
        @unknown default: [1, 8, 9] // The fallback.
        }
    }

    /// What happens next, in one sentence.
    static func outcome(for status: AVAuthorizationStatus, hasPurposeString: Bool) -> String { // The missing-key case is the crash the lesson warns about.
        switch status { // One sentence per status.
        case .authorized: return "Returns true at once: open the camera screen." // No alert.
        case .notDetermined: // The alert path.
            return hasPurposeString ? "iOS shows its alert with your NSCameraUsageDescription sentence, then returns the answer." : "No NSCameraUsageDescription: iOS stops the app the moment it asks." // With or without the key.
        case .denied: return "Returns false: explain, and offer a link to Settings." // The person said no.
        case .restricted: return "Returns false: a parent or a company policy blocks the camera." // Someone else said no.
        @unknown default: return "Returns false: unknown statuses fail closed." // Safe fallback.
        }
    }
}

// PhotoTests.swift
// Who: the Swift Testing runner.
// What: checks lesson 7.5's logic: TrailPhoto decoding real image bytes and rejecting
//       bad ones, the camera switch's highlighted lines and outcomes, and the share URL.
// Where: the DeviceLabTests target.
// When: whenever the tests run.
// Why: decoding and permission branches are where photo features fail. The tests make
//      their own tiny image in memory; no photo library or camera is touched.

import Testing // @Test, #expect and #require.
import UIKit // UIGraphicsImageRenderer, to make a test image.
import AVFoundation // AVAuthorizationStatus.
@testable import DeviceLab // The app's internal types.

@MainActor // The app's types live on the main actor.
struct TrailPhotoTests { // The Transferable type.
    /// A 4 by 3 pixel red PNG, made in memory.
    private func tinyPNG() -> Data { // No files involved.
        let format = UIGraphicsImageRendererFormat() // Drawing settings.
        format.scale = 1 // One pixel per point.
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 4, height: 3), format: format) // A 4 x 3 canvas.
        return renderer.pngData { context in // Draw, then encode as PNG.
            UIColor.red.setFill() // Red paint.
            context.fill(CGRect(x: 0, y: 0, width: 4, height: 3)) // Fill the canvas.
        }
    }

    @Test func decodesRealImageBytes() throws { // The happy path.
        let photo = try TrailPhoto.decode(tinyPNG()) // Decode the PNG.
        #expect(photo.pixelSizeText == "4 x 3 pixels") // The right size.
    }

    @Test func rejectsBytesThatAreNotAnImage() { // The guard's else branch.
        #expect(throws: CocoaError.self) { // Must throw a Foundation error...
            try TrailPhoto.decode(Data([0x00, 0x01, 0x02])) // ...for three random bytes.
        }
    }

    @Test func theErrorIsCorruptFile() { // The exact code the course throws.
        do { // Expect a failure.
            _ = try TrailPhoto.decode(Data("hello".utf8)) // Text, not an image.
            Issue.record("Decoding text must throw") // Reaching here is a failure.
        } catch let error as CocoaError { // The expected type.
            #expect(error.code == .fileReadCorruptFile) // The expected code.
        } catch { // Any other error type.
            Issue.record("Unexpected error: \(error)") // Also a failure.
        }
    }
}

@MainActor // The app's types live on the main actor.
struct CameraBranchTests { // The course's canUseCamera() switch.
    @Test func eachStatusHighlightsItsCase() { // Lines match the listing.
        let listing = CameraBranch.listing // The course's code.
        #expect(CameraBranch.linesRun(for: .authorized) == [1, 2, 3]) // Straight to true.
        #expect(listing[3].contains("return true")) // That line returns true.
        #expect(CameraBranch.linesRun(for: .notDetermined) == [1, 4, 5]) // The request.
        #expect(listing[5].contains("requestAccess")) // That line asks.
        #expect(CameraBranch.linesRun(for: .denied) == [1, 6, 7]) // Straight to false.
        #expect(CameraBranch.linesRun(for: .restricted) == [1, 6, 7]) // The same case.
        #expect(listing[6].contains(".denied, .restricted")) // Two patterns in one case.
    }

    @Test func missingKeyIsTheCrashTheLessonWarnsAbout() { // No NSCameraUsageDescription.
        #expect(CameraBranch.outcome(for: .notDetermined, hasPurposeString: false).contains("stops the app")) // A crash.
        #expect(CameraBranch.outcome(for: .notDetermined, hasPurposeString: true).contains("alert")) // An alert.
    }

    @Test func otherStatusesNeverMentionAnAlert() { // Only .notDetermined asks.
        for status in [AVAuthorizationStatus.authorized, .denied, .restricted] { // The other three.
            #expect(!CameraBranch.outcome(for: status, hasPurposeString: true).contains("alert")) // No alert.
        }
    }

    @Test func shareLinkPointsAtTheTrailPage() { // The course's fixed URL.
        #expect(TrailShareView().trailURL.absoluteString == "https://example.com/trails/42") // A safe example domain.
    }
}

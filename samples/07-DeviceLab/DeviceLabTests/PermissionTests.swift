// PermissionTests.swift
// Who: the Swift Testing runner.
// What: checks lesson 7.1's logic: how every framework's status maps to the four
//       answers, the TrailFinder switch, the permission journey state machine, this
//       app's Info.plist purpose strings, its privacy manifest and the trail sorter.
// Where: the DeviceLabTests target.
// When: whenever the tests run.
// Why: permission code must handle every case; a missed case is a broken feature or a
//      privacy mistake, so each one is checked here without any real alert appearing.

import Testing // @Test, #expect and #require.
import Foundation // Data and PropertyListSerialization.
import CoreLocation // CLAuthorizationStatus and CLLocation.
import AVFoundation // AVAuthorizationStatus.
import UserNotifications // UNAuthorizationStatus.
@testable import DeviceLab // The app's internal types.

@MainActor // The app's types live on the main actor.
struct AccessStateTests { // Mapping each framework's status.
    @Test func locationStatusesMapToTheFourAnswers() { // Core Location.
        #expect(AccessState(CLAuthorizationStatus.notDetermined) == .notAsked) // Never asked.
        #expect(AccessState(CLAuthorizationStatus.authorizedWhenInUse) == .allowed) // Granted while in use.
        #expect(AccessState(CLAuthorizationStatus.authorizedAlways) == .allowed) // Granted always.
        #expect(AccessState(CLAuthorizationStatus.denied) == .denied) // Refused.
        #expect(AccessState(CLAuthorizationStatus.restricted) == .restricted) // Blocked by someone else.
    }

    @Test func cameraStatusesMapToTheFourAnswers() { // AVFoundation.
        #expect(AccessState(AVAuthorizationStatus.notDetermined) == .notAsked) // Never asked.
        #expect(AccessState(AVAuthorizationStatus.authorized) == .allowed) // Granted.
        #expect(AccessState(AVAuthorizationStatus.denied) == .denied) // Refused.
        #expect(AccessState(AVAuthorizationStatus.restricted) == .restricted) // Blocked.
    }

    @Test func notificationStatusesMapToTheFourAnswers() { // UserNotifications.
        #expect(AccessState(UNAuthorizationStatus.notDetermined) == .notAsked) // Never asked.
        #expect(AccessState(UNAuthorizationStatus.authorized) == .allowed) // Granted.
        #expect(AccessState(UNAuthorizationStatus.provisional) == .allowed) // Quiet delivery is still a yes.
        #expect(AccessState(UNAuthorizationStatus.ephemeral) == .allowed) // App Clips' temporary yes.
        #expect(AccessState(UNAuthorizationStatus.denied) == .denied) // Refused.
    }

    @Test func onlyNotAskedCanShowTheSystemAlert() { // Lesson 7.1's one-shot rule.
        #expect(AccessState.allCases.filter(\.canShowSystemAlert) == [.notAsked]) // Exactly one state.
    }

    @Test func caseNamesUseSwiftSpelling() { // Labels on screen match the code.
        #expect(AccessState.caseName(CLAuthorizationStatus.authorizedWhenInUse) == ".authorizedWhenInUse") // Location.
        #expect(AccessState.caseName(CLAuthorizationStatus.restricted) == ".restricted") // Location.
        #expect(AccessState.caseName(AVAuthorizationStatus.authorized) == ".authorized") // Camera.
        #expect(AccessState.caseName(AVAuthorizationStatus.notDetermined) == ".notDetermined") // Camera.
    }

    @Test func everyAnswerHasAnIconAndAdvice() { // The status rows never show blanks.
        for state in AccessState.allCases { // All four.
            #expect(!state.symbol.isEmpty) // An icon.
            #expect(!state.advice.isEmpty) // A next step.
        }
    }
}

@MainActor // TrailFinder lives on the main actor.
struct TrailFinderTests { // The course's switch.
    @Test func notDeterminedAsksTheSystemExactlyOnce() { // The only branch that requests.
        var asked = 0 // Counts calls to the stand-in requester.
        let finder = TrailFinder { _ in asked += 1 } // A stand-in: no real alert appears.
        finder.respond(to: .notDetermined) // Run the switch.
        #expect(asked == 1) // Asked once.
        #expect(finder.outcome == .askedSystem) // And recorded it.
    }

    @Test(arguments: [ // One run per status that must not ask.
        (CLAuthorizationStatus.authorizedWhenInUse, TrailFinderOutcome.showedTrails), // Granted.
        (CLAuthorizationStatus.authorizedAlways, TrailFinderOutcome.showedTrails), // Granted.
        (CLAuthorizationStatus.denied, TrailFinderOutcome.showedSettingsPrompt), // Refused.
        (CLAuthorizationStatus.restricted, TrailFinderOutcome.showedRestrictedMessage), // Blocked.
    ])
    func otherStatusesNeverAsk(status: CLAuthorizationStatus, expected: TrailFinderOutcome) { // Parameterized test.
        var asked = 0 // Counts requests.
        let finder = TrailFinder { _ in asked += 1 } // Stand-in requester.
        finder.respond(to: status) // Run the switch.
        #expect(asked == 0) // Never asked: iOS would ignore it anyway.
        #expect(finder.outcome == expected) // The right branch ran.
    }

    @Test func highlightedLinesPointAtTheRightCode() { // The listing and the outcomes agree.
        let listing = TrailFinder.listing // The course's code.
        #expect(listing[3].contains("requestWhenInUseAuthorization")) // The request line.
        #expect(TrailFinderOutcome.askedSystem.linesRun.contains(3)) // Highlighted when asking.
        #expect(listing[5].contains("showNearbyTrails")) // The feature line.
        #expect(TrailFinderOutcome.showedTrails.linesRun.contains(5)) // Highlighted when allowed.
        #expect(listing[7].contains("showOpenSettingsPrompt")) // The recovery line.
        #expect(TrailFinderOutcome.showedSettingsPrompt.linesRun.contains(7)) // Highlighted when denied.
        #expect(listing[9].contains("showRestrictedMessage")) // The restricted line.
        #expect(TrailFinderOutcome.showedRestrictedMessage.linesRun.contains(9)) // Highlighted when restricted.
        #expect(TrailFinderOutcome.idle.linesRun.isEmpty) // Nothing before the first tap.
    }

    @Test func everyOutcomeHasAMessage() { // The screen never shows a blank line.
        let outcomes: [TrailFinderOutcome] = [.idle, .askedSystem, .showedTrails, .showedSettingsPrompt, .showedRestrictedMessage, .unknownStatus] // All six.
        #expect(outcomes.allSatisfy { !$0.message.isEmpty }) // Every one has text.
    }
}

@MainActor // PermissionJourney is a main-actor type in this app.
struct PermissionJourneyTests { // The replayable journey.
    @Test func firstTapShowsTheSystemAlert() { // From .notDetermined.
        var journey = PermissionJourney() // A fresh story.
        journey.tapFeature() // Tap Show trails near me.
        #expect(journey.alertShowing) // iOS draws its alert.
        #expect(journey.log.contains("requestWhenInUseAuthorization()")) // The request was made.
    }

    @Test func allowWhileUsingShowsTrailsWithoutAskingAgain() { // The happy path.
        var journey = PermissionJourney() // A fresh story.
        journey.tapFeature() // Ask.
        journey.answer(.allowWhileUsing) // Allow.
        #expect(journey.status == .allowedWhileUsing) // Granted.
        journey.tapFeature() // Tap again.
        #expect(!journey.alertShowing) // No second alert.
        #expect(journey.screen == "Showing trails sorted by distance.") // The feature runs.
    }

    @Test func dontAllowNeverShowsTheAlertAgain() { // The one-shot rule.
        var journey = PermissionJourney() // A fresh story.
        journey.tapFeature() // Ask.
        journey.answer(.dontAllow) // Refuse.
        #expect(journey.status == .denied) // Denied.
        journey.tapFeature() // Tap again.
        #expect(!journey.alertShowing) // iOS stays silent.
        #expect(journey.screen.contains("Open Settings")) // The recovery card.
    }

    @Test func settingsReversesADenial() { // Only Settings can fix it.
        var journey = PermissionJourney() // A fresh story.
        journey.tapFeature() // Ask.
        journey.answer(.dontAllow) // Refuse.
        journey.turnOnInSettings() // Change it in Settings.
        #expect(journey.status == .allowedWhileUsing) // Granted now.
        #expect(journey.screen == "Showing trails sorted by distance.") // The feature works.
    }

    @Test func missingPurposeStringIsSilentlyIgnored() { // The quiz's trap.
        var journey = PermissionJourney() // A fresh story.
        journey.hasPurposeString = false // Empty Info.plist key.
        journey.tapFeature() // Ask.
        #expect(!journey.alertShowing) // No alert...
        #expect(journey.status == .notDetermined) // ...and the status never changes.
        #expect(journey.log.last?.contains("ignores") == true) // The log explains.
    }

    @Test func screenTimeRestrictionUsesTheRestrictedBranch() { // Someone else holds the switch.
        var journey = PermissionJourney() // A fresh story.
        journey.screenTimeOn = true // A parent blocks location.
        #expect(journey.status == .restricted) // Restricted at once.
        journey.tapFeature() // Tap.
        #expect(!journey.alertShowing) // No alert.
        #expect(journey.screen == "Location is unavailable on this device.") // No Settings button.
        journey.screenTimeOn = false // Lift the restriction.
        #expect(journey.status == .notDetermined) // A fresh start.
    }

    @Test func primingComesBeforeTheAlert() { // One Continue button, then the alert.
        var journey = PermissionJourney() // A fresh story.
        journey.primingOn = true // Priming enabled.
        journey.tapFeature() // Tap.
        #expect(journey.primingShowing) // Priming first...
        #expect(!journey.alertShowing) // ...not the alert yet.
        journey.continuePriming() // Tap Continue.
        #expect(!journey.primingShowing) // Priming is gone...
        #expect(journey.alertShowing) // ...and the alert appears.
    }

    @Test func allowOnceExpiresInTheBackground() { // A one-time grant.
        var journey = PermissionJourney() // A fresh story.
        journey.tapFeature() // Ask.
        journey.answer(.allowOnce) // Allow once.
        #expect(journey.status == .allowedOnce) // Granted for now.
        journey.sendToBackground() // Leave and come back.
        #expect(journey.status == .notDetermined) // Expired.
        journey.tapFeature() // Tap again.
        #expect(journey.alertShowing) // The alert can appear again.
    }

    @Test func backgroundKeepsOtherStatuses() { // Only Allow Once expires.
        var journey = PermissionJourney() // A fresh story.
        journey.tapFeature() // Ask.
        journey.answer(.dontAllow) // Refuse.
        journey.sendToBackground() // Leave and come back.
        #expect(journey.status == .denied) // Still denied.
    }

    @Test func eventsOutOfTurnDoNothing() { // Buttons that make no sense are ignored.
        var journey = PermissionJourney() // A fresh story.
        journey.answer(.allowWhileUsing) // No alert is showing.
        journey.continuePriming() // No priming is showing.
        journey.turnOnInSettings() // Not denied.
        #expect(journey.status == .notDetermined) // Nothing changed.
        #expect(journey.log.isEmpty) // Nothing logged.
    }

    @Test func resetStartsOver() { // A clean replay.
        var journey = PermissionJourney() // A fresh story.
        journey.tapFeature() // Ask.
        journey.answer(.dontAllow) // Refuse.
        journey.reset() // Start over.
        #expect(journey.status == .notDetermined) // Back to the start.
        #expect(journey.log.isEmpty) // An empty log.
    }
}

@MainActor // The app's types live on the main actor.
struct PrivacyFileTests { // Info.plist and the privacy manifest.
    @Test func thisAppHasOnlyThePurposeStringsItNeeds() { // Least privilege, checked.
        let rows = UsageDescription.rows(in: Bundle.main.infoDictionary ?? [:]) // This app's real Info.plist.
        let present = Set(rows.filter { $0.sentence != nil }.map(\.key)) // Keys that are set.
        #expect(present == ["NSLocationWhenInUseUsageDescription", "NSCameraUsageDescription"]) // Exactly the two this app uses.
    }

    @Test func rowsReadAnyDictionary() { // The helper works on a stand-in dictionary.
        let rows = UsageDescription.rows(in: ["NSMicrophoneUsageDescription": "Record trail notes."]) // One key set.
        #expect(rows.count == UsageDescription.lessonKeys.count) // One row per lesson key.
        #expect(rows.first { $0.key == "NSMicrophoneUsageDescription" }?.sentence == "Record trail notes.") // The sentence is read.
        #expect(rows.first { $0.key == "NSCameraUsageDescription" }?.sentence == nil) // Missing keys read as nil.
    }

    @Test func bundledManifestDeclaresNoTracking() throws { // The real PrivacyInfo.xcprivacy.
        let manifest = try #require(PrivacyManifest.load()) // Must be inside the app.
        #expect(manifest.tracking == false) // No tracking.
        #expect(manifest.trackingDomains.isEmpty) // No tracking domains.
        #expect(manifest.collectedDataTypes == 0) // No collected data.
        #expect(manifest.accessedAPICategories.isEmpty) // No required-reason APIs.
    }

    @Test func parseReadsTheFourKeys() throws { // A manifest that declares things.
        let plist: [String: Any] = [ // A stand-in manifest.
            "NSPrivacyTracking": true, // Tracks.
            "NSPrivacyTrackingDomains": ["ads.example.com"], // One domain.
            "NSPrivacyCollectedDataTypes": [["NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePreciseLocation"]], // One data type.
            "NSPrivacyAccessedAPITypes": [["NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults"]], // One API.
        ]
        let data = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0) // Encode as a plist.
        let manifest = try #require(PrivacyManifest.parse(data)) // Decode it.
        #expect(manifest == PrivacyManifest(tracking: true, trackingDomains: ["ads.example.com"], collectedDataTypes: 1, accessedAPICategories: ["NSPrivacyAccessedAPICategoryUserDefaults"])) // Every key read.
    }

    @Test func parseRejectsGarbage() { // Not a property list.
        #expect(PrivacyManifest.parse(Data("not a plist".utf8)) == nil) // nil, not a crash.
    }
}

@MainActor // Trail lives on the main actor.
struct TrailSorterTests { // Degrade, do not block.
    @Test func withoutLocationTrailsAreAlphabetical() { // Denied: A to Z.
        let names = TrailSorter.sorted(Trail.samples, from: nil).map(\.name) // No position.
        #expect(names == names.sorted()) // Alphabetical.
        #expect(names.count == Trail.samples.count) // Nothing lost.
    }

    @Test func withLocationNearestComesFirst() { // Allowed: by distance.
        let sorted = TrailSorter.sorted(Trail.samples, from: Trail.sampleSpot) // From Golden Gate Park.
        #expect(sorted.first?.name == "Lakeshore Trail") // Stow Lake is under a kilometer away.
        let distances = sorted.map { $0.location.distance(from: Trail.sampleSpot) } // Each distance.
        #expect(distances == distances.sorted()) // Ascending.
    }
}

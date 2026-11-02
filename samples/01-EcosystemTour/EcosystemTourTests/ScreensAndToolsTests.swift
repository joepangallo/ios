// ScreensAndToolsTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks lessons 1.1 to 1.3: points-and-pixels math and the device table,
//       Info.plist reading and formatting, the build-pipeline model, package
//       version rules, and Xcode's new-project naming rules.
// Where: the EcosystemTourTests target.
// When: only when tests run.
// Why: these are the rules the course's quizzes ask about (30 pt at @2x, the
//      stage that reports "cannot find 'greeting' in scope", Trail Notes's
//      bundle identifier); the tests pin the app to the course's answers.

import Testing // Swift Testing: @Test, #expect and #require.
import SwiftUI // UserInterfaceSizeClass.
@testable import EcosystemTour // The app's internal types.

@MainActor // The app's types are main-actor isolated.
struct DeviceTests { // Lesson 1.1.
    @Test func thirtyPointIconNeeds60And90Pixels() { // Quiz question 1.
        #expect(PixelMath.assetSizes(points: 30) == [.init(scale: 1, pixels: 30), .init(scale: 2, pixels: 60), .init(scale: 3, pixels: 90)]) // @1x, @2x, @3x.
    }

    @Test func pixelsBackToPoints() { // Quiz question 2: 132 px at @3x.
        #expect(PixelMath.points(pixels: 132, scale: 3) == 44) // 44 points.
        #expect(PixelMath.points(pixels: 132, scale: 2) == 66) // 66 on a @2x screen.
    }

    @Test func fortyFourPointsInPixels() { // The 44-point callout.
        #expect(PixelMath.pixels(points: 44, scale: 2) == 88) // 88 x 88 at @2x.
        #expect(PixelMath.pixels(points: 44, scale: 3) == 132) // 132 x 132 at @3x.
    }

    @Test func deviceTableMatchesTheCourse() throws { // Spot checks of the explorer's table.
        let pro = try #require(DeviceSpec.all.first { $0.id == "iphone-pro" }) // The iPhone 17 Pro.
        let proPixels = try #require(pro.pixels) // It has a fixed scale.
        #expect(proPixels.width == 1206 && proPixels.height == 2622) // 402 x 874 at @3x.
        let se = try #require(DeviceSpec.all.first { $0.id == "iphone-se" }) // The iPhone SE.
        #expect(se.pixels?.width == 750) // 375 at @2x.
        let vision = try #require(DeviceSpec.all.first { $0.id == "vision" }) // Vision Pro.
        #expect(vision.pixels == nil) // No fixed scale factor.
        #expect(DeviceSpec.all.count == 9) // Nine devices.
        #expect(DeviceSpec.comparison.map(\.id) == ["iphone-se", "iphone-pro", "iphone-max", "watch"]) // The true-scale line-up.
    }

    @Test func sizesAreWrittenWithAnX() { // The course writes 402 x 874.
        #expect(PixelMath.describe(402, 874) == "402 x 874") // Width, x, height.
    }

    @Test func sizeClassNames() { // The live size-class labels.
        #expect(DeviceInfo.name(of: .compact) == "Compact") // Constrained.
        #expect(DeviceInfo.name(of: .regular) == "Regular") // Roomy.
        #expect(DeviceInfo.name(of: nil) == "Not set") // No value from the environment.
    }

    @Test func platformCheckKeptTheIOSBranch() { // This build is for iOS, not watchOS.
        #expect(PlatformCheck.message == "Open the full app") // The #else branch.
    }
}

@MainActor // AppInfo and the models are main-actor isolated.
struct ToolboxTests { // Lesson 1.2.
    @Test func xcodeStampsBecomeVersions() { // DTXcode formatting.
        #expect(AppInfo.xcodeVersion(fromDTXcode: "2611") == "26.1.1") // Xcode 26.1.1.
        #expect(AppInfo.xcodeVersion(fromDTXcode: "2600") == "26.0") // A zero patch is left off.
        #expect(AppInfo.xcodeVersion(fromDTXcode: "1640") == "16.4") // An older Xcode.
        #expect(AppInfo.xcodeVersion(fromDTXcode: "abc") == nil) // Not a number.
        #expect(AppInfo.xcodeVersion(fromDTXcode: "12") == nil) // Too short.
    }

    @Test func sdkNamesAreReadable() { // DTSDKName formatting.
        #expect(AppInfo.sdkDescription("iphonesimulator26.1") == "iOS 26.1 (Simulator SDK)") // The Simulator SDK.
        #expect(AppInfo.sdkDescription("iphoneos26.0") == "iOS 26.0 (device SDK)") // The device SDK.
        #expect(AppInfo.sdkDescription("macosx26.0") == "macosx26.0") // Anything else is unchanged.
    }

    @Test func thisAppsIdentityComesFromInfoPlist() { // Bundle.main, read live.
        #expect(AppInfo.bundleIdentifier == "com.example.EcosystemTour") // The project's bundle identifier.
        #expect(AppInfo.version == "1.0") // MARKETING_VERSION.
        #expect(AppInfo.build == "1") // CURRENT_PROJECT_VERSION.
        #expect(AppInfo.value("NoSuchKey") == "-") // A missing key reads as a dash.
    }

    @Test func cleanBuildFinishesEveryStage() { // No problem planted.
        let run = BuildPipeline.run(destination: .simulator, configuration: .debug, problem: .none) // One press of Run.
        #expect(run.succeeded) // Every stage finished.
        #expect(run.failedStage == nil) // Nothing failed.
        #expect(run.log.last == "ContentView appeared") // The app launched.
    }

    @Test(arguments: BuildPipeline.Destination.allCases) // Both destinations.
    func typoStopsAtTheCompiler(destination: BuildPipeline.Destination) { // Quiz: "cannot find 'greeting' in scope".
        let run = BuildPipeline.run(destination: destination, configuration: .debug, problem: .typo) // A typo planted.
        #expect(run.failedStage == 1) // Stage 2 is the Swift compiler.
        #expect(run.outcomes.dropFirst(2).allSatisfy { $0 == .notReached }) // The linker and signing never run.
        #expect(run.log.last?.contains("cannot find 'greeting' in scope") == true) // Xcode's message.
    }

    @Test func missingTeamOnlyMattersOnADevice() { // The Simulator signs to run locally.
        #expect(BuildPipeline.run(destination: .simulator, configuration: .release, problem: .team).succeeded) // Fine in the Simulator.
        let device = BuildPipeline.run(destination: .device, configuration: .release, problem: .team) // A real iPhone.
        #expect(device.failedStage == BuildPipeline.stages.firstIndex { $0.id == "sign" }) // Stops at code signing.
    }

    @Test func developerModeStopsTheInstall() { // Quiz: Developer Mode.
        let run = BuildPipeline.run(destination: .device, configuration: .debug, problem: .developerMode) // Developer Mode off.
        #expect(run.failedStage == BuildPipeline.stages.firstIndex { $0.id == "install" }) // Stops at install.
        #expect(BuildPipeline.run(destination: .simulator, configuration: .debug, problem: .developerMode).succeeded) // The Simulator has no Developer Mode.
    }

    @Test func everyStageExplainsItself() { // No empty explanation on screen.
        for stage in BuildPipeline.stages { // All eight.
            #expect(!BuildPipeline.explanation(for: stage.id, destination: .device, configuration: .release).isEmpty) // Has text.
        }
    }

    @Test func fromAcceptsTheSameMajorVersion() { // from: "1.2.0".
        #expect(VersionRule.from.accepts(SemanticVersion(major: 1, minor: 2, patch: 0))) // The base itself.
        #expect(VersionRule.from.accepts(SemanticVersion(major: 1, minor: 9, patch: 9))) // Any newer 1.x.
        #expect(!VersionRule.from.accepts(SemanticVersion(major: 1, minor: 1, patch: 9))) // Older is refused.
        #expect(!VersionRule.from.accepts(SemanticVersion(major: 2, minor: 0, patch: 0))) // A new major is refused.
    }

    @Test func upToNextMinorAcceptsOnly12x() { // The Try it's answer.
        #expect(VersionRule.upToNextMinor.accepts(SemanticVersion(major: 1, minor: 2, patch: 7))) // A 1.2 bug fix.
        #expect(!VersionRule.upToNextMinor.accepts(SemanticVersion(major: 1, minor: 3, patch: 0))) // A new minor is refused.
        #expect(VersionRule.exact.accepts(VersionRule.base)) // exact: only 1.2.0...
        #expect(!VersionRule.exact.accepts(SemanticVersion(major: 1, minor: 2, patch: 1))) // ...and nothing else.
    }

    @Test func versionsCompareAndPrint() { // Comparable and CustomStringConvertible.
        #expect(SemanticVersion(major: 1, minor: 10, patch: 0) > SemanticVersion(major: 1, minor: 9, patch: 9)) // 10 beats 9 as a number, not as text.
        #expect(SemanticVersion(major: 2, minor: 1, patch: 0).description == "2.1.0") // Written with dots.
    }

    @Test func onlyIOS26AppsCanAddTipMath() { // The second Try it.
        #expect(!TipMathManifest.canBeAdded(byAppTargeting: 18)) // iOS 18 is too old.
        #expect(TipMathManifest.canBeAdded(byAppTargeting: 26)) // iOS 26 is fine.
    }

    @Test func xcodeTourHasNineRegions() { // The course's tour.
        #expect(XcodeRegion.tour.count == 9) // Nine regions.
        #expect(XcodeRegion.tour.first?.title == "Toolbar") // Starting at the toolbar.
    }
}

@MainActor // NewProjectNaming is main-actor isolated.
struct NewProjectTests { // Lesson 1.3.
    @Test func spacesBecomeHyphensAndUnderscores() { // Quiz: Trail Notes.
        #expect(NewProjectNaming.bundleIdentifier(product: "Trail Notes", organization: "com.example") == "com.example.Trail-Notes") // A hyphen in the bundle identifier.
        #expect(NewProjectNaming.appStructName(product: "Trail Notes") == "Trail_NotesApp") // An underscore in Swift.
    }

    @Test func oneWordNamesStayTidy() { // The checklist's advice.
        #expect(NewProjectNaming.bundleIdentifier(product: "HelloWorld", organization: "com.example") == "com.example.HelloWorld") // The course's example.
        #expect(NewProjectNaming.starterFiles(product: "HelloWorld") == ["HelloWorldApp.swift", "ContentView.swift", "Assets.xcassets", "HelloWorldTests/", "HelloWorldUITests/"]) // The template's files.
    }

    @Test func swiftNamesCannotStartWithADigit() { // An identifier rule.
        #expect(NewProjectNaming.swiftName("9Lives") == "_9Lives") // An underscore in front.
        #expect(NewProjectNaming.bundleName("9Lives") == "9Lives") // Bundle identifiers allow it.
    }

    @Test func emptyFieldsShowPlaceholders() { // Like the course's widget.
        #expect(NewProjectNaming.bundleIdentifier(product: "", organization: "") == "com.yourname.AppName") // Both placeholders.
    }

    @Test(arguments: [("com.example", true), ("com.your-name", true), ("example", false), ("com..example", false), ("com.my app", false), ("", false)]) // Valid and invalid prefixes.
    func organizationIdentifiersAreReverseDNS(org: String, valid: Bool) { // Runs once per pair.
        #expect(NewProjectNaming.isValidOrganization(org) == valid) // Two or more dot-separated parts.
    }
}

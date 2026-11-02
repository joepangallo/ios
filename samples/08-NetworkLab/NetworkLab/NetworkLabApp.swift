// NetworkLabApp.swift
// Who: iOS launches the app here; SwiftUI creates the window.
// What: the app's entry point, which shows the home screen, and the app
//       delegate that receives the push-notification device token (or the
//       error APNs sends instead), as lesson 8.6 describes.
// Where: the top of the app; every other screen opens from ContentView.
// When: once per launch, before any screen appears; the delegate methods run
//       later, only after the student asks to register for push.
// Why: @main marks where the program starts, so no main() function is needed;
//      the device token arrives only through a UIApplicationDelegate method, so
//      even a SwiftUI app needs one small delegate class.

import SwiftUI // SwiftUI provides App, Scene and WindowGroup; on iOS it also brings UIKit's UIApplication.

@main // Tells Swift that this type is where the program starts.
struct NetworkLabApp: App { // The App protocol describes the app's scenes.
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate // SwiftUI creates AppDelegate and connects it to UIKit.

    var body: some Scene { // SwiftUI reads this property once, at launch.
        WindowGroup { // One window on iPhone; iPad can open several.
            ContentView() // The home screen: the list of lessons.
        }
    }
}

/// Receives app-level callbacks from iOS, including APNs's answer to a registration.
final class AppDelegate: NSObject, UIApplicationDelegate { // NSObject because the protocol comes from Objective-C.
    /// APNs issued a device token for this app on this device.
    func application(
        _ application: UIApplication, // The running app; unused but required by the protocol.
        didRegisterForRemoteNotificationsWithDeviceToken token: Data // The token as raw bytes.
    ) { // The body starts here.
        PushRegistrar.shared.didRegister(token: token) // Formats it as hex and shows it; a real app would upload it to its server.
    }

    /// APNs refused to register: with a free team, the aps-environment entitlement is missing.
    func application(
        _ application: UIApplication, // The running app.
        didFailToRegisterForRemoteNotificationsWithError error: any Error // Why registration failed.
    ) { // The body starts here.
        PushRegistrar.shared.didFail(error: error) // Shows the message and its explanation.
    }
}

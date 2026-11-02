// DeviceLabWidgetBundle.swift
// Who: iOS, which starts the widget extension here.
// What: the extension's entry point, listing every widget it offers: the Water
//       widget and the hike Live Activity.
// Where: the DeviceLabWidget target, bundled inside the app.
// When: whenever iOS loads the extension to render a widget or an activity.
// Why: an extension needs exactly one @main type; a WidgetBundle lets one extension
//      hold several widgets.

import SwiftUI // The @WidgetBundleBuilder body uses SwiftUI's result builders.
import WidgetKit // WidgetBundle.

@main // Where the extension's program starts.
struct DeviceLabWidgetBundle: WidgetBundle { // Lists the widgets.
    var body: some Widget { // Read when the extension loads.
        WaterWidget() // The course's Home Screen widget.
        HikeLiveActivity() // The course's Live Activity, drawn on the Lock Screen and Dynamic Island.
    }
}

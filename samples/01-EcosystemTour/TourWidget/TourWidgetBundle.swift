// TourWidgetBundle.swift
// Who: WidgetKit reads this when iOS loads the TourWidget extension.
// What: the extension's entry point, which lists the widgets it offers.
// Where: the TourWidget target, a separate program bundled inside the app
//        (EcosystemTour.app/PlugIns/TourWidget.appex).
// When: each time iOS starts the extension, for example when someone opens
//       the widget gallery or the Home Screen needs a fresh snapshot.
// Why: an extension needs its own @main, just like the app; a WidgetBundle is
//      that entry point for widgets, and it can list several of them.

import WidgetKit // WidgetKit provides WidgetBundle and Widget.
import SwiftUI // SwiftUI provides the @main-compatible body builder.

@main // Marks where the extension's program starts; the app has its own @main.
struct TourWidgetBundle: WidgetBundle { // The list of widgets this extension offers.
    var body: some Widget { // WidgetKit reads it when the extension loads.
        WaterWidget() // The course's "Water Today" widget; more widgets would be listed here.
    }
}

// WeekSummaryView.swift
// Who: lesson 9.5 shows it in English and Spanish side by side, and the
//      capstone's Today screen could show it above the log.
// What: the course's week summary card: a title, a plural session count, a
//       duration and a date, all looked up or formatted for the user's
//       language and region; plus goalBanner(), a localized String built
//       outside any Text.
// Where: Features/Stats, as the course organises it.
// When: rebuilt when its inputs change, or when the language changes.
// Why: lesson 9.5. Text with a literal is localizable by default; plurals,
//      durations and dates adapt to the user's language with no extra code.

import SwiftUI // SwiftUI provides Text, which looks up keys in the String Catalog.

/// A summary card for the week, localized through Localizable.xcstrings.
struct WeekSummaryView: View { // Every string in this view is extracted for translation.
    let sessionCount: Int // How many sessions were logged this week.
    let minutes: Int // Total minutes studied this week.
    let weekStart: Date // The first day of the week being summarized.

    var body: some View { // Each Text below is looked up at run time.
        VStack(alignment: .leading) { // leading, not left: it flips in right-to-left languages.
            Text("This week") // A literal key: "Esta semana" in Spanish.
                .font(.headline) // Text styles also scale with Dynamic Type.
            Text("\(sessionCount) sessions") // Key "%lld sessions", which the catalog varies by plural.
            Text(Duration.seconds(minutes * 60), // A typed duration, never hand-built text.
                 format: .units(allowed: [.hours, .minutes])) // "1 hr, 35 min" in English, "1 h y 35 min" in Spanish.
            Text(weekStart, format: .dateTime.month().day()) // Month and day in the user's regional order.
        }
    }
}

/// A localized String for places where Text is not available, such as an alert.
func goalBanner() -> String { // The course's version: uses the user's language.
    String(localized: "Weekly goal reached", // Looked up in the String Catalog.
           comment: "Banner shown when the weekly goal is met") // Context for translators.
}

/// The same banner in a chosen language, so a lesson can show two languages at once.
func goalBanner(in locale: Locale) -> String { // Used by lesson 9.5's side-by-side view.
    var resource = LocalizedStringResource("Weekly goal reached", comment: "Banner shown when the weekly goal is met") // The same key.
    resource.locale = locale // Look it up for this locale instead of the user's.
    return String(localized: resource) // Resolve it to text.
}

#Preview("English") { // The card in the development language.
    WeekSummaryView(sessionCount: 5, minutes: 95, weekStart: .now).padding() // Five sessions, 95 minutes.
}

#Preview("Spanish") { // The same card for a Spanish-speaking user.
    WeekSummaryView(sessionCount: 1, minutes: 95, weekStart: .now).padding() // One session: the singular form.
        .environment(\.locale, Locale(identifier: "es")) // Previews the Spanish strings and formats.
}

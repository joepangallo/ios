// FocusView.swift
// Who: lesson 9.1 shows it live, and its preview shows it in Xcode's canvas.
// What: the course's focus screen: a status message and a "Log 25 minutes"
//       button, with every rule living in FocusModel.
// Where: Features/Focus, beside the model it displays.
// When: rebuilt whenever FocusModel.logged changes.
// Why: the view reads status and forwards the tap; it contains no rules, so
//      changing the goal is a one-line edit in the model, covered by one test.

import SwiftUI // SwiftUI provides View, Text, Button and @State.

/// The focus screen from lesson 9.1: layout only.
struct FocusView: View { // A cheap value description that SwiftUI may create many times.
    @State private var model = FocusModel() // Created once and kept alive while the view is on screen.

    var body: some View { // Runs again after logged changes.
        VStack(spacing: 16) { // Text above the buttons, 16 points apart.
            Text(model.status).font(.title2) // Displays a ready-made string; nothing to test here.
            Button("Log 25 minutes") { model.log(25) } // The view says what happened; the model decides what it means.
                .buttonStyle(.borderedProminent) // Styling is a view concern, so it sits here.
            Button("Reset") { model.reset() } // Starts the demo over.
                .buttonStyle(.bordered) // A quieter look for the secondary action.
        }
        .frame(maxWidth: .infinity) // Centred in its card.
    }
}

#Preview { FocusView() } // A fast visual check of this one view.

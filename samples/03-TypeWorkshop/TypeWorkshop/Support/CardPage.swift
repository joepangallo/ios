// CardPage.swift
// Who: every lesson screen in this app wraps its cards in CardPage.
// What: CourseKit's LessonPage, plus one extra launch argument: -card N scrolls
//       the page so that card N (counting from 0) sits at the top, and adding
//       -cardAnchor bottom lines the card's bottom edge up with the screen's instead.
// Where: the Support folder. CourseKit.swift is shared and regenerated, so this
//        small addition lives here rather than in that file.
// When: the scroll happens once, shortly after the lesson screen appears.
// Why: lesson pages are many screens tall. Like -lesson N.k, the -card argument
//      lets screenshots (and a teacher at a projector) jump straight to one card.

import SwiftUI // SwiftUI provides ScrollViewReader, Group(subviews:) and ForEach.

struct CardPage<Content: View>: View { // Generic over whatever cards the lesson shows.
    let lesson: Lesson // Which lesson this page belongs to.
    @ViewBuilder let content: () -> Content // The lesson's cards, written by each lesson file.

    var body: some View { // Rebuilt whenever a card's state changes.
        ScrollViewReader { proxy in // Gives access to scrollTo for the scroll view inside LessonPage.
            LessonPage(lesson: lesson) { // CourseKit's page: summary, then the cards.
                Group(subviews: content()) { cards in // Splits the content into its top-level cards.
                    ForEach(cards.indices, id: \.self) { index in // One entry per card, in order.
                        cards[index].id(index) // Tags each card with its position so scrollTo can find it.
                    }
                }
            }
            .task { await scrollToRequestedCard(using: proxy) } // Runs once when the page appears.
        }
    }

    /// Reads -card N (and optionally -cardAnchor bottom) from the launch arguments and scrolls there.
    private func scrollToRequestedCard(using proxy: ScrollViewProxy) async { // Does nothing without the argument.
        let args = ProcessInfo.processInfo.arguments // The words the app was launched with.
        guard let flag = args.firstIndex(of: "-card"), // Where the flag sits, if present.
              flag + 1 < args.count, // A number must follow it.
              let index = Int(args[flag + 1]) // And it must be a whole number.
        else { return } // Otherwise the page stays at the top.
        let anchorFlag = args.firstIndex(of: "-cardAnchor") // The optional anchor flag.
        let wantsBottom = anchorFlag.map { $0 + 1 < args.count && args[$0 + 1] == "bottom" } ?? false // true for -cardAnchor bottom.
        try? await Task.sleep(for: .milliseconds(400)) // Gives the page time to lay out its cards first.
        proxy.scrollTo(index, anchor: wantsBottom ? .bottom : .top) // Moves the card into view.
    }
}

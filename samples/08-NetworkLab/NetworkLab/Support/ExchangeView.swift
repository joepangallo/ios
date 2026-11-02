// ExchangeView.swift
// Who: the HTTP and REST lessons, whenever they show a real reply.
// What: a view that draws one HTTPExchange: the status line, the time it took,
//       chosen response headers and the start of the body.
// Where: the Support folder; lessons 8.2 and 8.3 place it inside their cards.
// When: after a live request finishes successfully (any status code).
// Why: showing every reply the same way makes status codes, headers and bodies
//      easy to compare from card to card.

import SwiftUI // View, Text and stacks.

/// Draws one request's reply: status, timing, headers and body.
struct ExchangeView: View { // Used by several cards.
    let exchange: HTTPExchange // The recorded reply.
    var headerNames: [String] = ["Content-Type", "Cache-Control", "ETag"] // Which headers to show; empty shows none.
    var bodyLimit = 500 // Long bodies are cut so the card stays readable.

    var body: some View { // Rebuilt when the exchange changes.
        VStack(alignment: .leading, spacing: 6) { // Status, headers, body.
            HStack { // Status on the left, time on the right.
                Text(exchange.statusLine) // For example "201 Created".
                    .font(.headline) // The most important fact.
                    .foregroundStyle(StatusFamily(code: exchange.statusCode) == .success ? .green : .orange) // Green for 2xx.
                Spacer() // Pushes the time to the right.
                Text("\(exchange.milliseconds) ms") // How long it took.
                    .font(.caption.monospacedDigit()) // Digits that do not jiggle.
                    .foregroundStyle(.secondary) // Quieter.
            }
            ForEach(headerNames, id: \.self) { name in // One row per chosen header.
                if let value = exchange.header(name) { // Only headers the server actually sent.
                    ValueRow(label: name, value: value) // Name and value.
                }
            }
            Text(verbatim: bodyPreview) // The body text, exactly as sent.
                .font(.system(.caption, design: .monospaced)) // Fixed width, like a terminal.
                .frame(maxWidth: .infinity, alignment: .leading) // Full width.
                .padding(8) // Space inside the box.
                .background(.fill.tertiary, in: .rect(cornerRadius: 8)) // A light box.
                .textSelection(.enabled) // Students can copy it.
        }
    }

    /// The body, cut to `bodyLimit` characters with a note when it was longer.
    private var bodyPreview: String { // Keeps huge bodies from filling the screen.
        let text = exchange.bodyText // The whole body as text.
        guard text.count > bodyLimit else { return text } // Short bodies are shown whole.
        return String(text.prefix(bodyLimit)) + "\n... (\(text.count - bodyLimit) more characters)" // Says how much was cut.
    }
}

// RequestJourney.swift
// Who: Lesson 8.1's screen and its unit tests.
// What: the measured facts of one request (JourneyReport), the delegate that
//       collects them from URLSessionTaskMetrics (JourneyLogger), what each
//       network layer did (LayerReading), a round-trip planner for HTTP/1.1,
//       HTTP/2 and HTTP/3, and the arithmetic of latency versus bandwidth.
// Where: the Models folder. JourneyLogger is called by URLSession on its own
//        threads; everything else runs on the main actor with the screen.
// When: each time the student measures a request or moves a slider.
// Why: seeing real DNS, TCP, TLS and HTTP numbers from Swift turns the layer
//      diagram into something you can measure, which is the point of Lesson 8.1.

import Foundation // URLSession, URLSessionTaskMetrics and Date.
import Synchronization // Mutex, to store reports safely from URLSession's threads.

/// The facts one measured request produced, copied out of URLSessionTaskMetrics.
/// nonisolated: it is created inside the delegate callback, off the main actor.
nonisolated struct JourneyReport: Sendable, Equatable { // A plain value: safe to hand from URLSession to the screen.
    var protocolName: String? // "http/1.1", "h2" or "h3"; nil when no network protocol was used (for example a cached reply).
    var isReusedConnection: Bool // True when the request rode on an already open connection.
    var remoteAddress: String? // The server's IP address that DNS produced.
    var remotePort: Int? // Usually 443, the HTTPS port.
    var tlsVersion: String? // For example "TLS 1.3".
    var dnsSeconds: Double? // How long the DNS lookup took; nil when it was skipped.
    var connectSeconds: Double? // How long the TCP connection took, not counting TLS; nil when skipped.
    var tlsSeconds: Double? // How long the TLS handshake took; nil when skipped.
    var waitSeconds: Double? // From sending the request to the first byte of the reply.
    var downloadSeconds: Double? // From the first byte to the last byte of the reply.
    var totalSeconds: Double // The whole task, start to finish.
    var fetchSources: [String] // Where each transaction's answer came from, for example ["network"].

    /// The lines the course's JourneyLogger prints, in the same order.
    var printedLines: [String] { // The console card shows these.
        var lines = ["Protocol: " + (protocolName ?? "unknown")] // print("Protocol:", t.networkProtocolName ?? "unknown")
        lines.append("Reused connection: \(isReusedConnection)") // print("Reused connection:", t.isReusedConnection)
        if let tlsSeconds { // The handshake line appears only on a fresh connection.
            lines.append("TLS handshake: " + Self.seconds(tlsSeconds)) // print("TLS handshake:", end.timeIntervalSince(start))
        }
        lines.append("Total seconds: " + Self.seconds(totalSeconds)) // print("Total seconds:", metrics.taskInterval.duration)
        return lines // Oldest first, like a console.
    }

    /// Formats seconds with three decimals, such as "0.031".
    static func seconds(_ value: Double) -> String { // The course prints the raw Double; three decimals read better on a phone.
        String(format: "%.3f", value) // %.3f always uses a dot, whatever the phone's region.
    }

    /// Formats seconds as whole milliseconds, such as "31 ms", or "skipped" when there is no value.
    static func milliseconds(_ value: Double?) -> String { // Used by the phase list.
        guard let value else { return "skipped" } // nil means the phase did not happen.
        return "\(Int((value * 1000).rounded())) ms" // Seconds times 1000, rounded to a whole number.
    }

    /// Builds a report from URLSession's metrics for one transaction.
    init(transaction t: URLSessionTaskTransactionMetrics, metrics: URLSessionTaskMetrics) { // Called inside the delegate callback.
        protocolName = t.networkProtocolName // Negotiated during the TLS handshake.
        isReusedConnection = t.isReusedConnection // URLSession tracks its pool of open connections.
        remoteAddress = t.remoteAddress // The IP address the connection went to.
        remotePort = t.remotePort // The port on that machine.
        tlsVersion = t.negotiatedTLSProtocolVersion.map { Self.tlsName($0.rawValue) } // nil when no TLS was used.
        dnsSeconds = Self.span(t.domainLookupStartDate, t.domainLookupEndDate) // nil when the lookup was skipped.
        connectSeconds = Self.span(t.connectStartDate, t.secureConnectionStartDate ?? t.connectEndDate) // TCP only: stops where TLS starts.
        tlsSeconds = Self.span(t.secureConnectionStartDate, t.secureConnectionEndDate) // nil on a reused connection.
        waitSeconds = Self.span(t.requestStartDate, t.responseStartDate) // The server's thinking time plus one trip.
        downloadSeconds = Self.span(t.responseStartDate, t.responseEndDate) // How long the body took to arrive.
        totalSeconds = metrics.taskInterval.duration // The whole task.
        fetchSources = metrics.transactionMetrics.map { Self.sourceName($0.resourceFetchType) } // One entry per transaction.
    }

    /// Builds a report from plain values; tests and previews use this.
    init(protocolName: String?, isReusedConnection: Bool, tlsSeconds: Double?, totalSeconds: Double) { // Only the fields the printed lines need.
        self.protocolName = protocolName // Copies each argument into the matching property.
        self.isReusedConnection = isReusedConnection // Whether the connection was reused.
        self.tlsSeconds = tlsSeconds // The handshake time, or nil.
        self.totalSeconds = totalSeconds // The whole task.
        fetchSources = ["network"] // A measured request came from the network.
    }

    /// The time between two optional dates, or nil if either is missing.
    static func span(_ start: Date?, _ end: Date?) -> Double? { // Missing dates mean the phase was skipped.
        guard let start, let end else { return nil } // Both must exist.
        return end.timeIntervalSince(start) // Seconds between them.
    }

    /// The readable name of a TLS version number.
    static func tlsName(_ raw: UInt16) -> String { // TLS versions travel as two-byte numbers.
        switch raw { // The numbers are defined by the TLS standard.
        case 0x0304: "TLS 1.3" // The current version: one round trip to set up.
        case 0x0303: "TLS 1.2" // The previous version: two round trips.
        default: "TLS (version \(raw))" // Anything older or newer.
        }
    }

    /// Where a transaction's answer came from, in words.
    static func sourceName(_ type: URLSessionTaskMetrics.ResourceFetchType) -> String { // Used by the caching lesson too.
        switch type { // The four kinds URLSession reports.
        case .networkLoad: "network" // Downloaded from the server.
        case .localCache: "local cache" // Answered from URLCache, without the network.
        case .serverPush: "server push" // Sent ahead of time by an HTTP/2 server.
        case .unknown: "unknown" // URLSession could not tell (simulated servers report this).
        @unknown default: "unknown" // Kinds Apple might add later.
        }
    }
}

/// Receives URLSession's metrics for a task and keeps a report of them.
/// This is the course's JourneyLogger. Instead of printing, it stores a report,
/// so the screen can show the same lines and the phases as bars.
nonisolated final class JourneyLogger: NSObject, URLSessionTaskDelegate { // NSObject because delegate protocols come from Objective-C.
    /// Reports collected so far. URLSession calls us on its own threads, so a Mutex guards them.
    private let reports = Mutex<[JourneyReport]>([]) // Starts empty.

    /// The callback that delivers metrics, once per task, after the response has arrived.
    func urlSession(_ session: URLSession, task: URLSessionTask, // The name and labels must match the protocol exactly.
                    didFinishCollecting metrics: URLSessionTaskMetrics) { // metrics holds every timestamp URLSession recorded.
        guard let t = metrics.transactionMetrics.last else { return } // The last transaction produced the response the code saw.
        let report = JourneyReport(transaction: t, metrics: metrics) // Copies the facts into a Sendable value.
        reports.withLock { $0.append(report) } // Stores it under the lock.
    }

    /// The newest report, waiting briefly in case the metrics arrive just after the response.
    func latestReport() async -> JourneyReport? { // Called right after the request returns.
        for _ in 0..<40 { // Up to 40 short waits: one second in total.
            if let report = reports.withLock({ $0.last }) { return report } // Done as soon as a report exists.
            try? await Task.sleep(for: .milliseconds(25)) // A short pause before checking again.
        }
        return nil // No metrics arrived; the screen says so.
    }
}

/// Sends one GET request through `session` with a JourneyLogger attached, then returns its report and status code.
/// Pass a brand-new session to measure a fresh connection, or the same session again to see it reused.
func measureJourney(url: URL, session: URLSession) async throws -> (report: JourneyReport?, status: Int) { // The course's measureJourney(), returning instead of printing.
    let logger = JourneyLogger() // One logger per measured request.
    let (_, response) = try await session.data(from: url, delegate: logger) // The delegate parameter attaches the logger to this one request.
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0 // 0 if the reply was not HTTP.
    return (await logger.latestReport(), status) // The report and the status together.
}

/// What one network layer did for a measured request, in plain words.
struct LayerReading: Identifiable, Equatable { // One row of the layer table.
    let layer: String // DNS, IP, TCP, TLS or HTTP.
    let job: String // What the layer is for, from the course.
    let observed: String // What it did for this request.
    var id: String { layer } // Each layer appears once.

    /// Describes every layer for a report, given the host name and the status code.
    static func readings(for report: JourneyReport, host: String, status: Int) -> [LayerReading] { // Pure: easy to test.
        let quic = report.protocolName == "h3" // HTTP/3 runs on QUIC, which replaces TCP.
        let reused = report.isReusedConnection // A reused connection skips the setup layers.
        return [ // Top to bottom in the order the request needs them.
            LayerReading(layer: "DNS", job: "Turns a name into an IP address.", // The phone book of the internet.
                         observed: reused ? "Skipped: the connection was already open." // Nothing to look up.
                            : report.dnsSeconds.map { "Looked up \(host) in \(JourneyReport.milliseconds($0))." } // A real lookup.
                            ?? "Answered from the phone's DNS cache."), // No lookup dates means a cached answer.
            LayerReading(layer: "IP", job: "Moves packets toward an address, hop by hop.", // The postal service.
                         observed: report.remoteAddress.map { "Packets went to \($0)." } ?? "No address was reported."), // The address DNS produced.
            LayerReading(layer: "TCP", job: "Turns packets into a reliable, ordered stream.", // Numbering and resending.
                         observed: quic ? "Not used: HTTP/3 runs on QUIC over UDP instead." // QUIC replaces TCP.
                            : reused ? "Reused a stream that was already open." // No new handshake.
                            : "Connected to port \(report.remotePort ?? 443) in \(JourneyReport.milliseconds(report.connectSeconds))."), // A fresh handshake.
            LayerReading(layer: "TLS", job: "Encrypts the stream and proves who the server is.", // The S in HTTPS.
                         observed: reused ? "Already encrypted: no new handshake." // The old handshake still protects the connection.
                            : "\(report.tlsVersion ?? "TLS") handshake took \(JourneyReport.milliseconds(report.tlsSeconds))."), // A fresh handshake.
            LayerReading(layer: "HTTP", job: "The request and response your code works with.", // Method, URL, headers, body, status.
                         observed: "\(report.protocolName ?? "unknown") answered \(status) \(reasonPhrase(for: status))."), // The protocol and the status.
        ]
    }
}

/// The three versions of HTTP the lesson compares.
enum HTTPVersion: String, CaseIterable, Identifiable { // CaseIterable feeds the picker.
    case http11 = "HTTP/1.1" // The raw value is the label on screen.
    case http2 = "HTTP/2" // Multiplexed streams over one TCP connection.
    case http3 = "HTTP/3" // Runs on QUIC instead of TCP.
    var id: String { rawValue } // The label doubles as the identity.

    /// The year the version was published.
    var year: Int { // Shown beside the name.
        switch self { case .http11: 1997; case .http2: 2015; case .http3: 2022 } // From the course.
    }

    /// What the version changed, in the course's words.
    var summary: String { // Shown under the picker.
        switch self { // One sentence or two per version.
        case .http11: "Text messages over TCP. One request at a time per connection, so a slow reply blocks the ones queued behind it (head-of-line blocking)." // HTTP/1.1.
        case .http2: "Binary frames and multiplexing: many requests share one TCP connection as interleaved streams, with compressed headers. One lost TCP packet still stalls every stream until it is resent." // HTTP/2.
        case .http3: "Runs on QUIC, a transport built on UDP. QUIC includes TLS 1.3, so connecting and encrypting happen together, each stream recovers from loss independently, and a connection can survive a move from Wi-Fi to cellular." // HTTP/3.
        }
    }
}

/// One round trip in the plan: a message out and its reply back.
struct RoundTripStep: Identifiable, Equatable { // One row in the "Follow one request" list.
    let id: Int // Its position, starting at 1.
    let title: String // For example "TCP handshake".
    let detail: String // What travels in each direction.
}

/// Plans the round trips one HTTPS request needs, like the course's "Follow one request" panel.
struct RoundTripPlan: Equatable { // A value: changing a control makes a new plan.
    var version: HTTPVersion = .http2 // Which HTTP version carries the request.
    var reuseConnection = false // True when a connection to the server is already open.
    var rttMilliseconds = 50 // How long one round trip takes on this network.

    /// Every round trip, in order.
    var steps: [RoundTripStep] { // Recomputed whenever a control changes.
        let request = "Request and response: GET /todos/1 goes out, 200 OK comes back." // The trip the app actually wanted.
        if reuseConnection { // An open connection skips DNS, TCP and TLS.
            return [RoundTripStep(id: 1, title: "Request and response", detail: request)] // Just the request.
        }
        if version == .http3 { // QUIC combines the transport and TLS handshakes.
            return [ // Three round trips in total.
                RoundTripStep(id: 1, title: "DNS lookup", detail: "Ask for the address of jsonplaceholder.typicode.com; get an IP back."), // Name to address.
                RoundTripStep(id: 2, title: "QUIC + TLS 1.3 handshake", detail: "One exchange opens the UDP-based connection and agrees on encryption together."), // The saved trip.
                RoundTripStep(id: 3, title: "Request and response", detail: request), // The real request.
            ]
        }
        return [ // HTTP/1.1 and HTTP/2 both run on TCP plus TLS: four round trips.
            RoundTripStep(id: 1, title: "DNS lookup", detail: "Ask for the address of jsonplaceholder.typicode.com; get an IP back."), // Name to address.
            RoundTripStep(id: 2, title: "TCP handshake", detail: "SYN goes out, SYN-ACK comes back: a reliable stream is open."), // TCP setup.
            RoundTripStep(id: 3, title: "TLS 1.3 handshake", detail: "ClientHello goes out, the certificate and keys come back: the stream is encrypted."), // TLS setup.
            RoundTripStep(id: 4, title: "Request and response", detail: request), // The real request.
        ]
    }

    /// How many round trips in total.
    var roundTrips: Int { steps.count } // One per step.

    /// How many of them are setup rather than the request itself.
    var setupRoundTrips: Int { roundTrips - 1 } // Everything except the last step.

    /// The total time before the reply arrives, ignoring the server's own thinking time.
    var totalMilliseconds: Int { roundTrips * rttMilliseconds } // Round trips multiplied by their length.
}

/// Compares many small requests with one batched request on the same network.
struct BatchComparison: Equatable { // Pure arithmetic, so tests can check it exactly.
    var items = 30 // How many rows the screen needs.
    var bytesPerItem = 200 // How big each row's JSON is.
    var rttMilliseconds = 100 // One round trip on this network.
    var bandwidthMbps = 10.0 // Megabits per second the connection carries.

    /// Milliseconds for `requests` sequential requests that carry `bytes` in total.
    func milliseconds(requests: Int, bytes: Int) -> Double { // Latency part plus bandwidth part.
        let latency = Double(requests * rttMilliseconds) // Every request pays at least one round trip.
        let transfer = Double(bytes * 8) / (bandwidthMbps * 1000) // Bits divided by bits per millisecond.
        return latency + transfer // Total waiting time.
    }

    /// One request per item.
    var separateMilliseconds: Double { milliseconds(requests: items, bytes: items * bytesPerItem) } // 30 round trips.

    /// One request for every item at once.
    var batchedMilliseconds: Double { milliseconds(requests: 1, bytes: items * bytesPerItem) } // One round trip, same bytes.
}

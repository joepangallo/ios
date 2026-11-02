// Lesson81Tests.swift
// Who: the Swift Testing runner.
// What: checks lesson 8.1's logic: the JourneyLogger's printed lines, the
//       layer descriptions, the round-trip planner, the latency arithmetic and
//       a measured request against the simulated server.
// Where: the NetworkLabTests target.
// When: only when tests run.
// Why: the screen shows these numbers to students, so they must be right.

import Testing // @Test, #expect and #require.
import Foundation // URL and URLSession.
@testable import NetworkLab // The app's internal types.

@MainActor // The app's types are main-actor isolated.
struct Lesson81Tests { // How an App Talks to a Server.
    @Test func printedLinesOnAFreshConnection() { // The course logger's four prints.
        let report = JourneyReport(protocolName: "h2", isReusedConnection: false, tlsSeconds: 0.031, totalSeconds: 0.2) // A fresh HTTP/2 request.
        #expect(report.printedLines == ["Protocol: h2", "Reused connection: false", "TLS handshake: 0.031", "Total seconds: 0.200"]) // Exactly the course's order.
    }

    @Test func printedLinesOnAReusedConnectionSkipTLS() { // No handshake, no TLS line.
        let report = JourneyReport(protocolName: nil, isReusedConnection: true, tlsSeconds: nil, totalSeconds: 0.05) // Reused, protocol unknown.
        #expect(report.printedLines == ["Protocol: unknown", "Reused connection: true", "Total seconds: 0.050"]) // ?? "unknown" and no TLS line.
    }

    @Test func formattingHelpers() { // seconds, milliseconds and span.
        #expect(JourneyReport.seconds(1) == "1.000") // Three decimals.
        #expect(JourneyReport.milliseconds(0.0315) == "32 ms") // Rounded.
        #expect(JourneyReport.milliseconds(nil) == "skipped") // A missing phase.
        let start = Date(timeIntervalSince1970: 0) // A fixed moment.
        #expect(JourneyReport.span(start, start.addingTimeInterval(0.5)) == 0.5) // Half a second.
        #expect(JourneyReport.span(nil, start) == nil) // Missing start.
        #expect(JourneyReport.tlsName(0x0304) == "TLS 1.3") // Current TLS.
        #expect(JourneyReport.tlsName(0x0303) == "TLS 1.2") // Previous TLS.
        #expect(JourneyReport.tlsName(1) == "TLS (version 1)") // Anything else.
        #expect(JourneyReport.sourceName(.localCache) == "local cache") // Cache hits.
        #expect(JourneyReport.sourceName(.networkLoad) == "network") // Downloads.
    }

    @Test func layerReadingsForAFreshHTTP2Request() { // Every layer did work.
        var report = JourneyReport(protocolName: "h2", isReusedConnection: false, tlsSeconds: 0.02, totalSeconds: 0.1) // Fresh.
        report.dnsSeconds = 0.004 // A real lookup.
        report.connectSeconds = 0.01 // TCP.
        report.remoteAddress = "104.21.59.19" // From DNS.
        report.remotePort = 443 // HTTPS.
        report.tlsVersion = "TLS 1.3" // Negotiated.
        let rows = LayerReading.readings(for: report, host: "example.org", status: 200) // Five rows.
        #expect(rows.map(\.layer) == ["DNS", "IP", "TCP", "TLS", "HTTP"]) // Top to bottom.
        #expect(rows[0].observed == "Looked up example.org in 4 ms.") // DNS.
        #expect(rows[1].observed == "Packets went to 104.21.59.19.") // IP.
        #expect(rows[2].observed == "Connected to port 443 in 10 ms.") // TCP.
        #expect(rows[3].observed == "TLS 1.3 handshake took 20 ms.") // TLS.
        #expect(rows[4].observed == "h2 answered 200 OK.") // HTTP.
    }

    @Test func layerReadingsForReusedAndHTTP3Connections() { // Skipped layers say so.
        let reused = LayerReading.readings(for: JourneyReport(protocolName: "h2", isReusedConnection: true, tlsSeconds: nil, totalSeconds: 0.05), host: "h", status: 200) // Reused.
        #expect(reused[0].observed.hasPrefix("Skipped")) // No DNS.
        #expect(reused[2].observed.hasPrefix("Reused")) // No TCP handshake.
        #expect(reused[3].observed.hasPrefix("Already encrypted")) // No TLS handshake.
        let quic = LayerReading.readings(for: JourneyReport(protocolName: "h3", isReusedConnection: false, tlsSeconds: 0.01, totalSeconds: 0.05), host: "h", status: 200) // HTTP/3.
        #expect(quic[2].observed.hasPrefix("Not used: HTTP/3 runs on QUIC")) // QUIC replaces TCP.
        #expect(quic[0].observed == "Answered from the phone's DNS cache.") // No lookup dates.
    }

    @Test(arguments: [(HTTPVersion.http11, false, 4), (.http2, false, 4), (.http3, false, 3), (.http2, true, 1), (.http3, true, 1)]) // Every combination worth checking.
    func roundTripCounts(version: HTTPVersion, reuse: Bool, expected: Int) { // The planner's core rule.
        let plan = RoundTripPlan(version: version, reuseConnection: reuse, rttMilliseconds: 50) // 50 ms per trip.
        #expect(plan.roundTrips == expected) // DNS + TCP + TLS + request, or fewer.
        #expect(plan.setupRoundTrips == expected - 1) // Everything but the request.
        #expect(plan.totalMilliseconds == expected * 50) // Trips times RTT.
        #expect(plan.steps.last?.title == "Request and response") // The request always comes last.
    }

    @Test func http3SavesOneRoundTripByCombiningHandshakes() { // The course's HTTP/3 point.
        let steps = RoundTripPlan(version: .http3).steps.map(\.title) // Step names.
        #expect(steps == ["DNS lookup", "QUIC + TLS 1.3 handshake", "Request and response"]) // Combined handshake.
        #expect(HTTPVersion.http3.year == 2022) // From the course.
        #expect(HTTPVersion.http11.summary.contains("head-of-line blocking")) // The HTTP/1.1 problem.
    }

    @Test func batchingBeatsManySmallRequests() { // The quiz's 30-request example.
        let comparison = BatchComparison(items: 30, bytesPerItem: 200, rttMilliseconds: 100, bandwidthMbps: 10) // Cellular-like.
        #expect(abs(comparison.separateMilliseconds - 3004.8) < 0.001) // 30 x 100 ms + 48,000 bits / 10,000 bits per ms.
        #expect(abs(comparison.batchedMilliseconds - 104.8) < 0.001) // One round trip, same bytes.
        let faster = BatchComparison(items: 30, bytesPerItem: 200, rttMilliseconds: 100, bandwidthMbps: 100) // More bandwidth.
        #expect(comparison.separateMilliseconds - faster.separateMilliseconds < 5) // Bandwidth barely helps small replies.
    }

    @Test func measureJourneyReportsMetricsFromTheSimulatedServer() async throws { // The logger end to end, offline.
        let session = SimulatedServer.session(always: .json("{}")) // No real network.
        let measured = try await measureJourney(url: Placeholder.url("todos/1"), session: session) // Attaches a JourneyLogger.
        let report = try #require(measured.report) // Metrics arrived.
        #expect(measured.status == 200) // The scripted status.
        #expect(report.printedLines.first == "Protocol: unknown") // A URLProtocol uses no network protocol.
        #expect(report.totalSeconds >= 0) // A real duration.
    }
}

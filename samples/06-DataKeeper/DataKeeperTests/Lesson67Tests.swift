// Lesson67Tests.swift
// Who: the Swift Testing runner.
// What: checks lesson 6.7's TokenStore with an in-memory stand-in for the Keychain:
//       save, update on a duplicate, read, delete, unexpected statuses, the recorder's
//       log, readable names, and the safer WeatherAPI request.
// Where: the DataKeeperTests target. TokenStore's tests never touch the real Keychain;
//        one test checks SystemKeychain's forwarding with an item only this test uses.
// When: whenever tests run.
// Why: the stand-in follows the Keychain's status rules, so the wrapper's logic is tested
//      exactly, without depending on the Simulator's Keychain.

import Foundation // Data and URLRequest.
import Security // The kSec constants and status codes.
import Testing // @Test, #expect and #require.
@testable import DataKeeper // The app's internal types.

/// An in-memory Keychain that answers with the same status codes as the real one.
@MainActor // Matches the app's main-actor protocol.
final class InMemoryKeychain: KeychainCalls { // A stand-in for tests.
    var items: [String: Data] = [:] // "service|account" to secret bytes.
    var forcedStatus: OSStatus? // When set, every call returns it, for example a locked device.
    var calls: [String] = [] // Which calls were made, in order.

    /// The identity of the item a dictionary describes.
    private func key(_ query: [String: Any]) -> String { // Service and account together.
        "\(query[kSecAttrService as String] as? String ?? "")|\(query[kSecAttrAccount as String] as? String ?? "")" // One string.
    }

    func add(_ attributes: [String: Any]) -> OSStatus { // SecItemAdd's rules.
        calls.append("add") // Records the call.
        if let forcedStatus { return forcedStatus } // A forced failure.
        guard items[key(attributes)] == nil else { return errSecDuplicateItem } // A second item with the same identity is refused.
        items[key(attributes)] = attributes[kSecValueData as String] as? Data // Stores the secret.
        return errSecSuccess // Created.
    }

    func update(_ query: [String: Any], _ changes: [String: Any]) -> OSStatus { // SecItemUpdate's rules.
        calls.append("update") // Records the call.
        if let forcedStatus { return forcedStatus } // A forced failure.
        guard items[key(query)] != nil else { return errSecItemNotFound } // Nothing to update.
        items[key(query)] = changes[kSecValueData as String] as? Data // Replaces the secret.
        return errSecSuccess // Updated.
    }

    func copyMatching(_ query: [String: Any], _ result: inout CFTypeRef?) -> OSStatus { // SecItemCopyMatching's rules.
        calls.append("copy") // Records the call.
        if let forcedStatus { return forcedStatus } // A forced failure.
        guard let data = items[key(query)] else { return errSecItemNotFound } // Nothing stored.
        result = data as CFData // Hands back the bytes.
        return errSecSuccess // Found.
    }

    func delete(_ query: [String: Any]) -> OSStatus { // SecItemDelete's rules.
        calls.append("delete") // Records the call.
        if let forcedStatus { return forcedStatus } // A forced failure.
        return items.removeValue(forKey: key(query)) == nil ? errSecItemNotFound : errSecSuccess // Not found, or deleted.
    }
}

@MainActor // The app's types are main-actor isolated.
struct TokenStoreTests { // The course's wrapper.
    @Test func baseQueryIdentifiesTheItem() { // "Describe the item you want".
        let query = TokenStore().baseQuery // The identifying dictionary.
        #expect(query[kSecAttrService as String] as? String == "com.example.trailhead") // The service.
        #expect(query[kSecAttrAccount as String] as? String == "accessToken") // The account.
        #expect((query[kSecClass as String] as? String) == (kSecClassGenericPassword as String)) // A generic password.
        #expect(query.count == 3) // Nothing else.
    }

    @Test func firstSaveAdds() throws { // A new item.
        let keychain = InMemoryKeychain() // The stand-in.
        try TokenStore(keychain: keychain).save("sample-token-1") // Save.
        #expect(keychain.calls == ["add"]) // Only SecItemAdd.
        #expect(try TokenStore(keychain: keychain).read() == "sample-token-1") // Reads it back.
    }

    @Test func secondSaveUpdates() throws { // "Save, or update if it exists".
        let keychain = InMemoryKeychain() // The stand-in.
        let store = TokenStore(keychain: keychain) // The wrapper.
        try store.save("first") // Add.
        try store.save("second") // Duplicate, then update.
        #expect(keychain.calls == ["add", "add", "update"]) // The course's pattern.
        #expect(try store.read() == "second") // The new value won.
        #expect(keychain.items.count == 1) // Still one item.
    }

    @Test func readMissingIsNil() throws { // Nobody has signed in.
        #expect(try TokenStore(keychain: InMemoryKeychain()).read() == nil) // Not an error.
    }

    @Test func deleteIsFineEitherWay() throws { // Signing out twice is harmless.
        let keychain = InMemoryKeychain() // The stand-in.
        let store = TokenStore(keychain: keychain) // The wrapper.
        try store.save("token") // Stored.
        try store.delete() // Deleted.
        try store.delete() // Already gone: still fine.
        #expect(try store.read() == nil) // Nothing left.
    }

    @Test func lockedDeviceThrows() { // errSecInteractionNotAllowed.
        let keychain = InMemoryKeychain() // The stand-in.
        keychain.forcedStatus = errSecInteractionNotAllowed // -25308.
        let store = TokenStore(keychain: keychain) // The wrapper.
        #expect(throws: KeychainError.unexpectedStatus(-25308)) { try store.read() } // Never looks like a missing token.
        #expect(throws: KeychainError.unexpectedStatus(-25308)) { try store.save("x") } // Save throws too.
        #expect(throws: KeychainError.unexpectedStatus(-25308)) { try store.delete() } // And delete.
    }

    @Test func emptyTokenRoundTrips() throws { // Zero bytes is still a value.
        let store = TokenStore(keychain: InMemoryKeychain()) // The wrapper.
        try store.save("") // Empty.
        #expect(try store.read() == "") // Not nil.
    }
}

@MainActor // The app's types are main-actor isolated.
struct KeychainHelperTests { // The recorder and the readable names.
    @Test func recorderLogsEveryCall() throws { // The screen's status log.
        let recorder = RecordingKeychain(base: InMemoryKeychain()) // Records a stand-in.
        let store = TokenStore(keychain: recorder) // The wrapper.
        try store.save("a") // Add.
        try store.save("b") // Duplicate, update.
        _ = try store.read() // Copy.
        try store.delete() // Delete.
        #expect(recorder.lines == [ // Every call with its status.
            "SecItemAdd -> 0 errSecSuccess", // Created.
            "SecItemAdd -> -25299 errSecDuplicateItem", // Already there.
            "SecItemUpdate -> 0 errSecSuccess", // Updated.
            "SecItemCopyMatching -> 0 errSecSuccess", // Found.
            "SecItemDelete -> 0 errSecSuccess", // Deleted.
        ])
    }

    @Test func statusNames() { // Readable codes.
        #expect(KeychainStatus.name(-25300) == "errSecItemNotFound") // Not found.
        #expect(KeychainStatus.name(-25308) == "errSecInteractionNotAllowed") // Locked.
        #expect(KeychainStatus.name(-34018) == "errSecMissingEntitlement") // No entitlement.
        #expect(KeychainStatus.name(-50) == "errSecParam") // Bad query.
        #expect(KeychainStatus.name(12345) == "unknown status") // Anything else.
    }

    @Test func describeUsesSwiftNamesAndHidesSecrets() { // The "describe the item" card.
        var query = TokenStore().baseQuery // The base query...
        query[kSecValueData as String] = Data("secret".utf8) // ...plus a secret...
        query[kSecReturnData as String] = true // ...and a flag.
        let lines = KeychainStatus.describe(query) // Readable lines.
        #expect(lines.contains("kSecClass: kSecClassGenericPassword")) // Constants by name.
        #expect(lines.contains("kSecAttrService: \"com.example.trailhead\"")) // Other text in quotes.
        #expect(lines.contains("kSecValueData: 6 bytes")) // The secret is never printed.
        #expect(lines.contains("kSecReturnData: true")) // Bools print as they are.
        #expect(lines == lines.sorted()) // A stable order.
    }

    @Test func systemKeychainForwardsToTheSecurityFramework() throws { // One real round trip, with an item only this test uses.
        let keychain = SystemKeychain() // The real calls.
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, // A generic password...
                                    kSecAttrService as String: "com.example.DataKeeper.unit-test", // ...under a test-only service.
                                    kSecAttrAccount as String: UUID().uuidString] // A unique account.
        var item = query // The item to add.
        item[kSecValueData as String] = Data("probe".utf8) // Its secret.
        #expect(keychain.add(item) == errSecSuccess) // Created in this app's own Keychain.
        var lookup = query // The read query.
        lookup[kSecReturnData as String] = true // Return the bytes.
        var result: CFTypeRef? // The match arrives here.
        #expect(keychain.copyMatching(lookup, &result) == errSecSuccess) // Found.
        #expect((result as? Data) == Data("probe".utf8)) // The same bytes.
        #expect(keychain.update(query, [kSecValueData as String: Data("changed".utf8)]) == errSecSuccess) // Updated.
        #expect(keychain.delete(query) == errSecSuccess) // Removed again.
        #expect(keychain.delete(query) == errSecItemNotFound) // Really gone.
    }
}

@MainActor // The app's types are main-actor isolated.
struct WeatherAPITests { // "Never hard-code API keys".
    @Test func urlHasNoKey() throws { // Only the city.
        let url = try #require(WeatherAPI.forecastURL(city: "São Paulo")) // Accents and spaces are encoded.
        #expect(url.absoluteString == "https://api.example.com/forecast?city=S%C3%A3o%20Paulo") // Encoded safely.
        #expect(!url.absoluteString.contains("key")) // No key in sight.
    }

    @Test func authorizeAddsTheBearerToken() throws { // The token from the Keychain.
        let store = TokenStore(keychain: InMemoryKeychain()) // A stand-in Keychain.
        try store.save("sample-token-123") // A sample token.
        var request = URLRequest(url: try #require(WeatherAPI.forecastURL(city: "Lisbon"))) // Never sent.
        try WeatherAPI.authorize(&request, store: store) // Adds the header.
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer sample-token-123") // The standard format.
    }

    @Test func authorizeWithoutTokenAddsNothing() throws { // Not signed in.
        var request = URLRequest(url: try #require(WeatherAPI.forecastURL(city: "Lisbon"))) // Never sent.
        try WeatherAPI.authorize(&request, store: TokenStore(keychain: InMemoryKeychain())) // No token stored.
        #expect(request.value(forHTTPHeaderField: "Authorization") == nil) // No header.
    }

    @Test func riskyVersionIsOnlyText() { // The left side of the compare.
        #expect(WeatherAPIComparison.riskyCode.contains("EXAMPLE-SECRET-1234")) // The course's obviously fake key, shown as text.
    }
}

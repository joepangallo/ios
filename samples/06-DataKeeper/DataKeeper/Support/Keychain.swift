// Keychain.swift
// Who: lesson 6.7's buttons save, read and delete a sample token through TokenStore; the
//      tests drive TokenStore with an in-memory stand-in instead of the real Keychain.
// What: the course's TokenStore wrapper (save, or update if it exists; read; delete), the
//       KeychainError it throws, a protocol that holds the four Security framework calls,
//       the real implementation, a recorder that logs every status code, and readable
//       names for queries and statuses.
// Where: the Support folder. Only SystemKeychain calls the Security framework.
// When: when the student taps Save, Read or Delete, and when lesson 6.7 appears.
// Why: secrets must never sit in UserDefaults or a file; the Keychain encrypts them.

import Foundation // Data and String.
import Security // SecItemAdd, SecItemUpdate, SecItemCopyMatching, SecItemDelete and the kSec constants.
import Observation // @Observable, for the recorder the screen watches.

/// The course's error: a Keychain call returned a status we did not expect.
enum KeychainError: Error, Equatable { // Equatable, so tests can compare errors.
    case unexpectedStatus(OSStatus) // Carries the number, such as -25308.
}

/// The four Keychain calls. The app uses the real ones; tests use a stand-in.
protocol KeychainCalls { // Each method mirrors one Security framework function.
    func add(_ attributes: [String: Any]) -> OSStatus // SecItemAdd.
    func update(_ query: [String: Any], _ changes: [String: Any]) -> OSStatus // SecItemUpdate.
    func copyMatching(_ query: [String: Any], _ result: inout CFTypeRef?) -> OSStatus // SecItemCopyMatching.
    func delete(_ query: [String: Any]) -> OSStatus // SecItemDelete.
}

/// The real Keychain: each method is a single call into the Security framework.
struct SystemKeychain: KeychainCalls { // Holds no state; the Keychain itself is the state.
    func add(_ attributes: [String: Any]) -> OSStatus { // Creates an item.
        SecItemAdd(attributes as CFDictionary, nil) // nil: we do not need the new item back.
    }
    func update(_ query: [String: Any], _ changes: [String: Any]) -> OSStatus { // Changes an existing item.
        SecItemUpdate(query as CFDictionary, changes as CFDictionary) // The query finds it; changes says what to set.
    }
    func copyMatching(_ query: [String: Any], _ result: inout CFTypeRef?) -> OSStatus { // Finds an item.
        SecItemCopyMatching(query as CFDictionary, &result) // The match comes back through result.
    }
    func delete(_ query: [String: Any]) -> OSStatus { // Removes matching items.
        SecItemDelete(query as CFDictionary) // Deletes whatever the query matches.
    }
}

/// The course's TokenStore: one small type that keeps every Keychain detail in one file.
struct TokenStore { // A struct: it only describes which item to use.
    let service = "com.example.trailhead" // Groups the item under the course's app.
    let account = "accessToken" // Names the item within the service.
    var keychain: any KeychainCalls = SystemKeychain() // Added for testing: the real Keychain unless a stand-in is passed.

    /// The dictionary that identifies the item: class, service and account.
    var baseQuery: [String: Any] { // Built fresh each time.
        [kSecClass as String: kSecClassGenericPassword, // A generic password item.
         kSecAttrService as String: service, // This service...
         kSecAttrAccount as String: account] // ...and this account.
    }
}

extension TokenStore { // The course's "Save, or update if it exists".
    /// Saves the token, replacing any token already stored.
    func save(_ token: String) throws { // Throws KeychainError for any status but success.
        let data = Data(token.utf8) // The Keychain stores bytes.
        var item = baseQuery // Start from the identifying attributes.
        item[kSecValueData as String] = data // The secret itself.
        item[kSecAttrAccessible as String] = // When it may be read:
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly // only while unlocked, and never moved to another device.

        var status = keychain.add(item) // SecItemAdd: try to create the item.
        if status == errSecDuplicateItem { // -25299: it already exists.
            let change = [kSecValueData as String: data] // Only the data changes.
            status = keychain.update(baseQuery, // SecItemUpdate: find the existing item...
                                     change) // ...and give it the new data.
        }
        guard status == errSecSuccess else { // 0 means success; anything else is a problem.
            throw KeychainError.unexpectedStatus(status) // Hands the number to the caller.
        }
    }
}

extension TokenStore { // The course's "Read and delete".
    /// Reads the token, or nil when none is stored.
    func read() throws -> String? { // nil means nobody has signed in.
        var query = baseQuery // Start from the identifying attributes.
        query[kSecReturnData as String] = true // Return the secret's bytes.
        query[kSecMatchLimit as String] = kSecMatchLimitOne // At most one match.
        var result: CFTypeRef? // The match arrives here.
        let status = keychain.copyMatching(query, &result) // SecItemCopyMatching.
        if status == errSecItemNotFound { return nil } // -25300: not an error for this app.
        guard status == errSecSuccess, let data = result as? Data else { // Success with bytes, or a problem.
            throw KeychainError.unexpectedStatus(status) // For example -25308 when the device is locked.
        }
        return String(decoding: data, as: UTF8.self) // Bytes back to text.
    }

    /// Deletes the token; deleting a token that is not there is fine.
    func delete() throws { // Used for signing out.
        let status = keychain.delete(baseQuery) // SecItemDelete.
        guard status == errSecSuccess || status == errSecItemNotFound // Gone either way.
        else { throw KeychainError.unexpectedStatus(status) } // Anything else is a problem.
    }
}

/// Wraps another KeychainCalls and records every call and its status for the screen.
@Observable // SwiftUI redraws the log whenever lines changes.
final class RecordingKeychain: KeychainCalls { // A class, so TokenStore and the view share one log.
    @ObservationIgnored private let base: any KeychainCalls // The calls that really run.
    var lines: [String] = [] // One line per call, oldest first.

    init(base: any KeychainCalls = SystemKeychain()) { // The real Keychain unless told otherwise.
        self.base = base // Remembers it.
    }

    func add(_ attributes: [String: Any]) -> OSStatus { record("SecItemAdd", base.add(attributes)) } // Forwards, then logs.
    func update(_ query: [String: Any], _ changes: [String: Any]) -> OSStatus { record("SecItemUpdate", base.update(query, changes)) } // Forwards, then logs.
    func copyMatching(_ query: [String: Any], _ result: inout CFTypeRef?) -> OSStatus { record("SecItemCopyMatching", base.copyMatching(query, &result)) } // Forwards, then logs.
    func delete(_ query: [String: Any]) -> OSStatus { record("SecItemDelete", base.delete(query)) } // Forwards, then logs.

    /// Adds one line to the log and passes the status through unchanged.
    private func record(_ call: String, _ status: OSStatus) -> OSStatus { // Returns status so the methods above stay one line.
        lines.append("\(call) -> \(status) \(KeychainStatus.name(status))") // For example SecItemAdd -> -25299 errSecDuplicateItem.
        return status // Unchanged.
    }
}

/// Readable names for the numbers and constants the Keychain uses.
enum KeychainStatus { // A namespace for the helpers.
    /// The constant's name for a status code.
    static func name(_ status: OSStatus) -> String { // Statuses are plain numbers, hard to read.
        switch status { // The codes this lesson meets.
        case errSecSuccess: "errSecSuccess" // 0.
        case errSecDuplicateItem: "errSecDuplicateItem" // -25299.
        case errSecItemNotFound: "errSecItemNotFound" // -25300.
        case errSecInteractionNotAllowed: "errSecInteractionNotAllowed" // -25308: the device is locked.
        case errSecMissingEntitlement: "errSecMissingEntitlement" // -34018: the app is not allowed to use the Keychain.
        case errSecParam: "errSecParam" // -50: a bad query.
        default: "unknown status" // Anything else.
        }
    }

    /// Swift names for the kSec keys and values, looked up by their real values.
    private static let names: [String: String] = [ // Built from the constants, so nothing is guessed.
        kSecClass as String: "kSecClass", // The item's class.
        kSecClassGenericPassword as String: "kSecClassGenericPassword", // A generic password.
        kSecAttrService as String: "kSecAttrService", // The service.
        kSecAttrAccount as String: "kSecAttrAccount", // The account.
        kSecValueData as String: "kSecValueData", // The secret's bytes.
        kSecAttrAccessible as String: "kSecAttrAccessible", // When it can be read.
        kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String: "kSecAttrAccessibleWhenUnlockedThisDeviceOnly", // Unlocked, this device only.
        kSecReturnData as String: "kSecReturnData", // Return the bytes.
        kSecMatchLimit as String: "kSecMatchLimit", // How many matches.
        kSecMatchLimitOne as String: "kSecMatchLimitOne", // One match.
    ]

    /// One readable line per entry in a query dictionary, sorted by key name.
    static func describe(_ query: [String: Any]) -> [String] { // For the "describe the item" card.
        query.map { key, value in // Each key and value...
            let keyName = names[key] ?? key // ...with the key's Swift name...
            let valueText: String // ...and a readable value.
            if let text = value as? String { valueText = names[text] ?? "\"\(text)\"" } // Constants by name, other text in quotes.
            else if let data = value as? Data { valueText = "\(data.count) bytes" } // Never print the secret itself.
            else { valueText = "\(value)" } // Numbers and Bools as they print.
            return "\(keyName): \(valueText)" // One line.
        }
        .sorted() // A stable order.
    }
}

/// The course's safer WeatherAPI: the app never holds the service's key.
enum WeatherAPI { // A namespace; nothing here sends a request.
    /// Builds the forecast URL for a city, with no key in it.
    static func forecastURL(city: String) -> URL? { // nil only if the parts cannot form a URL.
        var parts = URLComponents( // Builds a URL piece by piece...
            string: "https://api.example.com/forecast") // ...starting from your own server's address.
        parts?.queryItems = [URLQueryItem(name: "city", value: city)] // Encodes spaces and accents safely.
        return parts?.url // The finished URL.
    }

    /// Adds the signed-in user's token from the Keychain to a request.
    static func authorize(_ request: inout URLRequest, // inout: the function edits the caller's request.
                          store: TokenStore) throws { // The token comes from the Keychain.
        guard let token = try store.read() else { return } // No token: send no header.
        request.setValue("Bearer \(token)", // The standard format for a token.
                         forHTTPHeaderField: "Authorization") // The standard header name.
    }
}

// Security.swift
// Who: Lesson 8.5's security cards and their unit tests.
// What: a secure-store protocol with a Keychain implementation and an in-memory
//       stand-in, the course's savedToken() and authorized(_:), a scan that
//       finds a string constant inside this app's own binary, and a TLS trust
//       inspector that lists the server's certificates and can pin its key.
// Where: the Models folder. The Keychain calls go to iOS's Security framework;
//        the trust inspector is called by URLSession on its own threads.
// When: when the student saves, reads or deletes the demo token, scans the
//       binary, or inspects a server's certificate.
// Why: "never ship a secret" and "tokens go in the Keychain" are easier to
//      believe after you find a constant in the app's bytes and watch the
//      Authorization header appear only when a token is stored.

import Foundation // URLRequest, Data and FileManager.
import Security // SecItemAdd, SecItemCopyMatching, SecTrust and the kSec constants.
import CryptoKit // SHA256, for hashing a certificate's public key.
import Synchronization // Mutex, to record trust facts safely from URLSession's threads.

/// Somewhere to keep one small secret, such as a sign-in token.
protocol SecureStore { // A protocol, so tests can use a stand-in instead of the real Keychain.
    func save(_ token: String) throws // Stores the token, replacing any earlier one.
    func savedToken() -> String? // The stored token, or nil when nobody has signed in.
    func delete() // Removes the token.
}

/// An error from the Keychain, with Apple's description of its status code.
struct KeychainError: Error, Equatable { // Equatable lets tests compare errors.
    let status: OSStatus // The C-style result code, for example -25299 for a duplicate item.
    var message: String { (SecCopyErrorMessageString(status, nil) as String?) ?? "Keychain status \(status)" } // Apple's words for the code.
}

/// The real store: the Keychain, the encrypted store iOS provides for small secrets.
struct KeychainStore: SecureStore { // A struct: it holds only the names that find the item.
    var service = "com.example.NetworkLab.demo" // Groups this app's items; a different service in tests keeps data apart.
    var account = "session-token" // The item's name, the same one the course uses.

    /// The attributes that identify our one item.
    private var itemQuery: [String: Any] { // The Keychain takes a dictionary of attributes instead of parameters.
        [kSecClass as String: kSecClassGenericPassword, // A generic password: the class used for tokens.
         kSecAttrService as String: service, // Which group of items.
         kSecAttrAccount as String: account] // Which item in the group.
    }

    /// Saves the token, replacing any earlier one. Tokens are stored as UTF-8 bytes.
    func save(_ token: String) throws { // Called after the student taps Save.
        delete() // Removes an earlier copy, so SecItemAdd never meets a duplicate.
        var attributes = itemQuery // Starts from the identifying attributes.
        attributes[kSecValueData as String] = Data(token.utf8) // The secret itself, as bytes.
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly // Readable only while unlocked, never restored to another device.
        let status = SecItemAdd(attributes as CFDictionary, nil) // Adds the item to the Keychain.
        guard status == errSecSuccess else { throw KeychainError(status: status) } // Anything else is a real problem.
    }

    /// Returns the stored token, or nil if there is none. The course's savedToken().
    func savedToken() -> String? { // Called before every authorized request.
        var query = itemQuery // kSecClass and kSecAttrAccount, as in the course, plus our service.
        query[kSecReturnData as String] = true // Asks for the stored bytes to be returned.
        var result: AnyObject? // A slot for the Keychain to write the result into.
        let status = SecItemCopyMatching(query as CFDictionary, &result) // Searches; & passes result by reference.
        guard status == errSecSuccess, let data = result as? Data else { // Found, and came back as Data?
            return nil // errSecItemNotFound simply means nobody has signed in yet.
        }
        return String(decoding: data, as: UTF8.self) // Bytes back to text.
    }

    /// Removes the token, if there is one.
    func delete() { // Called by Delete, and before every save.
        SecItemDelete(itemQuery as CFDictionary) // Not finding an item is fine here, so the status is ignored.
    }
}

/// A stand-in store that keeps the token in memory. Tests use it so they never touch the Keychain.
final class InMemoryStore: SecureStore { // A class, so saving changes the one shared instance.
    private(set) var token: String? // nil until something is saved.
    init(token: String? = nil) { self.token = token } // Optionally starts signed in.
    func save(_ token: String) throws { self.token = token } // Never fails.
    func savedToken() -> String? { token } // Whatever was saved.
    func delete() { token = nil } // Forgets it.
}

/// Returns a copy of the request with "Authorization: Bearer <token>" when a token is stored. The course's authorized(_:).
func authorized(_ request: URLRequest, using store: any SecureStore) -> URLRequest { // The store is a parameter, so tests can pass a stand-in.
    var request = request // A mutable copy; URLRequest is a value type.
    if let token = store.savedToken() { // Only when someone has signed in.
        request.setValue("Bearer \(token)", // Bearer: whoever holds the token is let in.
                         forHTTPHeaderField: "Authorization") // The header servers read.
    }
    return request // The original is untouched; the copy may carry the header.
}

/// A string constant compiled into this app on purpose, so the demo can find it in the binary.
/// It is NOT a real key. Real keys belong on your own server, never in an app.
enum ShippedConstant { // A namespace for the demo value.
    static let demoKey = "DEMO-KEY-not-a-real-secret-8a41" // Longer than 15 bytes, so Swift stores it as plain bytes in the binary.
}

/// Searches this app's own executable files for a string, the way an attacker would.
/// Returns the file name and byte offset where it was found, or nil.
func findInAppBinary(_ text: String, bundle: Bundle = .main) -> (file: String, offset: Int)? { // Reads files that ship inside the app.
    let needle = Data(text.utf8) // The bytes to look for.
    let folder = bundle.bundleURL // The .app folder.
    let names = (try? FileManager.default.contentsOfDirectory(atPath: folder.path())) ?? [] // Every file at the top of the bundle.
    let executable = bundle.executableURL?.lastPathComponent // The main executable's name.
    for name in names.sorted() where name == executable || name.hasSuffix(".dylib") { // Debug builds keep the code in a .debug.dylib beside the executable.
        guard let data = try? Data(contentsOf: folder.appending(path: name), options: .mappedIfSafe) else { continue } // Maps the file instead of copying it.
        if let range = data.range(of: needle) { return (name, range.lowerBound) } // Found: where, and at which byte.
    }
    return nil // Not found in any executable file.
}

/// Whether the key a server presented matches one of the pinned keys.
nonisolated enum PinCheck { // A namespace for the pure pinning rule; nonisolated so the TLS delegate can use it off the main actor.
    /// No pins means pinning is off; otherwise the observed key hash must be one of the pins.
    static func allows(observed: String?, pins: Set<String>) -> Bool { // Pure, so tests can check it.
        if pins.isEmpty { return true } // Pinning off: normal certificate checks only.
        guard let observed else { return false } // No key to compare: refuse.
        return pins.contains(observed) // The key must be one we expect.
    }

    /// The SHA-256 of some bytes, as lowercase hexadecimal.
    static func sha256Hex(_ data: Data) -> String { // 64 characters for 32 bytes.
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() // Each byte as two hex digits.
    }
}

/// What the TLS handshake revealed about a server.
nonisolated struct TrustFacts: Sendable, Equatable { // Created on URLSession's thread, read by the screen.
    var chain: [String] = [] // Certificate subjects, from the server's own certificate up to the authority.
    var leafKeyHash: String? // SHA-256 of the server certificate's public key.
    var trustedBySystem = false // Whether iOS trusts the chain.
    var rejectedByPin = false // True when our pin check refused the connection.
}

/// A session delegate that records the server's certificates and can enforce a pin.
nonisolated final class TrustInspector: NSObject, URLSessionDelegate { // nonisolated: URLSession calls it off the main actor.
    private let pins: Set<String> // Empty: record only. Otherwise: allowed key hashes.
    private let facts = Mutex(TrustFacts()) // Filled during the handshake.

    /// Creates an inspector; pass key hashes to enforce pinning.
    init(pins: Set<String> = []) { self.pins = pins } // No pins by default.

    /// What the most recent handshake revealed.
    var observed: TrustFacts { facts.withLock { $0 } } // A copy, read under the lock.

    /// URLSession asks how to answer an authentication challenge; server trust is one.
    func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge) async // Called during the TLS handshake.
        -> (URLSession.AuthChallengeDisposition, URLCredential?) { // How to proceed, and an optional credential.
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust, // Only the certificate check interests us.
              let trust = challenge.protectionSpace.serverTrust else { // The server's certificate chain.
            return (.performDefaultHandling, nil) // Anything else: let URLSession decide.
        }
        let certificates = (SecTrustCopyCertificateChain(trust) as? [SecCertificate]) ?? [] // Server first, authority last.
        var found = TrustFacts() // Collects what we learn.
        found.chain = certificates.map { (SecCertificateCopySubjectSummary($0) as String?) ?? "(unnamed)" } // A readable name for each.
        found.leafKeyHash = certificates.first.flatMap(Self.keyHash) // Hash of the server's own public key.
        found.trustedBySystem = SecTrustEvaluateWithError(trust, nil) // The same check URLSession would make.
        found.rejectedByPin = !PinCheck.allows(observed: found.leafKeyHash, pins: pins) // Our extra rule.
        let result = found // A constant copy, so the closure below captures a fixed value.
        facts.withLock { $0 = result } // Stores what we learned.
        return found.rejectedByPin ? (.cancelAuthenticationChallenge, nil) : (.performDefaultHandling, nil) // Refuse, or carry on normally.
    }

    /// The SHA-256 of a certificate's public key, the value apps pin.
    static func keyHash(_ certificate: SecCertificate) -> String? { // nil if the key cannot be read.
        guard let key = SecCertificateCopyKey(certificate), // The public key inside the certificate.
              let bytes = SecKeyCopyExternalRepresentation(key, nil) as Data? else { return nil } // Its raw bytes.
        return PinCheck.sha256Hex(bytes) // Hashed, so the pin is short and fixed-length.
    }
}

/// Fetches a URL over a fresh connection with a TrustInspector attached and returns what it saw.
func inspectTrust(of url: URL, pins: Set<String> = []) async -> (facts: TrustFacts, outcome: String) { // Never throws: outcomes become sentences.
    let inspector = TrustInspector(pins: pins) // Records the handshake.
    let session = URLSession(configuration: .ephemeral, delegate: inspector, delegateQueue: nil) // Ephemeral: a new TLS handshake every time.
    defer { session.finishTasksAndInvalidate() } // A session with a delegate must be invalidated, or it leaks.
    do { // The request may fail.
        let (_, response) = try await session.data(from: url) // Sends the request.
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0 // The status code.
        return (inspector.observed, "Connected and received \(status) \(reasonPhrase(for: status)).") // Success.
    } catch { // The pin refused it, or the network failed.
        let facts = inspector.observed // What the handshake showed before the failure.
        if facts.rejectedByPin { return (facts, "Refused: the server's key does not match the pin.") } // Our own refusal.
        return (facts, userMessage(for: error) ?? "Cancelled.") // Any other failure, in words.
    }
}

/// Saves a value in UserDefaults (the mistake), then looks for it as plain bytes in the
/// preferences file on disk. Returns the file's name if the value was found there.
/// The value is removed again before returning, whatever happened.
func findInPreferencesFile(_ value: String, defaults: UserDefaults = .standard) async -> String? { // Shows why UserDefaults is not for secrets.
    let key = "demoTokenDoNotDoThis" // A key name that says what it is.
    defaults.set(value, forKey: key) // The mistake: a token in a settings file.
    defer { defaults.removeObject(forKey: key) } // Cleans up on every exit.
    let name = (Bundle.main.bundleIdentifier ?? "app") + ".plist" // Preferences files are named after the bundle id.
    let file = URL.libraryDirectory.appending(path: "Preferences/" + name) // Library/Preferences inside the app's sandbox.
    for _ in 0..<30 { // The system writes the file shortly after set(_:forKey:); wait up to three seconds.
        if let data = try? Data(contentsOf: file), data.range(of: Data(value.utf8)) != nil { return name } // Found as readable bytes.
        try? await Task.sleep(for: .milliseconds(100)) // Checks again shortly.
    }
    return nil // Not written yet; the value is still stored unencrypted, just not on disk yet.
}

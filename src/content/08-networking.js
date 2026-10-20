// Module 8: Networking and Backend Communication.
// Code lines are written with String.raw so Swift's backslash escapes
// (string interpolation, escaped quotes) survive exactly as typed.
const R = String.raw;
const n = (who, what, where, when, why) => ({ who, what, where, when, why });

const foundations = {
  id: 'networking-foundations',
  title: 'How an App Talks to a Server',
  steps: [
    {
      kind: 'concept',
      title: 'Your app is a client',
      body: `<p>Almost every app you use talks to a computer it does not control. A weather app asks a forecast service for today's temperature; a messaging app hands your message to a server that delivers it. The app on the phone is the <strong>client</strong>: it starts the conversation. The <strong>server</strong> is a program on another machine, usually in a data center, that waits for requests and answers them.</p><p>Everything that lives on servers (databases, accounts, business rules) is called the <strong>backend</strong>. Your Swift code never reaches into the backend's database. It sends a message across the network and waits for a reply.</p>`,
      points: [
        { term: 'Request', text: 'A message from the client asking the server to do something: send data, save data, delete data.' },
        { term: 'Response', text: `The server's answer: a status that says how it went, plus any data.` },
        { term: 'Network', text: 'Everything in between: Wi-Fi or cellular radio, routers, cables and other companies\' networks.' },
        { term: 'URLSession', text: 'The Foundation class that iOS apps use to send requests and receive responses.' },
      ],
      callout: { tone: 'design', title: 'Design for the gap', html: `<p>Reading memory takes nanoseconds. A network reply takes tens to hundreds of milliseconds, and sometimes never arrives. Every screen that loads data needs a plan for "still waiting" and "it failed", not only for "it worked".</p>` },
    },
    {
      kind: 'concept',
      title: 'The layers a request travels through',
      body: `<p>When your code asks for <code>https://api.open-meteo.com/v1/forecast</code>, several <strong>protocols</strong> (agreed rules for exchanging messages) cooperate. Each solves one problem and relies on the layer beneath it. You write code only for the top layer; URLSession and iOS handle the rest.</p>`,
      points: [
        { term: 'DNS', text: 'Domain Name System. Turns a name such as api.open-meteo.com into an IP address, the way a contacts app turns a name into a phone number.' },
        { term: 'IP', text: 'Internet Protocol. Gives every machine an address and moves small packets toward it, hop by hop. Packets can be lost or arrive out of order.' },
        { term: 'TCP', text: 'Transmission Control Protocol. Builds a reliable, ordered stream of bytes on top of IP by numbering packets and resending lost ones.' },
        { term: 'TLS', text: 'Transport Layer Security. Encrypts the stream and proves, with a certificate, that the server is who it claims to be. It is the S in HTTPS.' },
        { term: 'HTTP', text: 'Hypertext Transfer Protocol. The request and response format your code works with: method, URL, headers, body and status code.' },
      ],
    },
    {
      kind: 'concept',
      title: 'Latency, bandwidth and round trips',
      body: `<p><strong>Bandwidth</strong> is how much data a connection carries per second. <strong>Latency</strong> is how long one message takes to reach the other side. For the small JSON replies most apps fetch, latency matters far more than bandwidth.</p><p>A <strong>round trip</strong> is one message out and its reply back; its duration is the <strong>RTT</strong> (round-trip time). A brand-new HTTPS connection spends several round trips on setup (look up the name, open TCP, negotiate TLS) before your request even leaves. On good Wi-Fi an RTT might be 20 ms; on a busy cellular network, 100 ms or more. Multiply by the number of round trips and the delay becomes visible.</p>`,
      points: [
        { term: 'Reuse connections', text: 'URLSession keeps connections open, so the next request to the same server skips the setup.' },
        { term: 'Make fewer requests', text: 'One request that returns 20 items beats 20 requests that return one item each.' },
      ],
      callout: { tone: 'warn', title: 'Never block the main thread', html: `<p>The main thread draws your interface. If it sits waiting for the network, the app freezes. Swift's <code>await</code> lets your code wait for a reply while the main thread keeps drawing.</p>` },
    },
    {
      kind: 'widget',
      title: 'Follow one request',
      intro: `<p>Step through a single HTTPS request, one message at a time. Change the round-trip time to model fast Wi-Fi or a weak cellular signal, compare HTTP/2 over TCP and TLS with HTTP/3 over QUIC, and switch on connection reuse. Watch the round-trip counter: on a fresh connection, setup costs more than the request itself.</p>`,
      widget: 'networking-request-journey',
      props: {},
    },
    {
      kind: 'concept',
      title: 'HTTP/1.1, HTTP/2 and HTTP/3',
      body: `<p>The request format has stayed familiar since HTTP/1.1, but the way it travels has changed twice.</p>`,
      points: [
        { term: 'HTTP/1.1 (1997)', text: 'Text messages over TCP. One request at a time per connection, so a slow reply blocks the ones queued behind it (head-of-line blocking).' },
        { term: 'HTTP/2 (2015)', text: 'Binary frames and multiplexing: many requests share one TCP connection as interleaved streams, with compressed headers. One lost TCP packet still stalls every stream until it is resent.' },
        { term: 'HTTP/3 (2022)', text: 'Runs on QUIC, a transport built on UDP. QUIC includes TLS 1.3, so connecting and encrypting happen together, each stream recovers from loss independently, and a connection can survive a move from Wi-Fi to cellular.' },
      ],
      callout: { tone: 'ecosystem', title: 'URLSession chooses for you', html: `<p>You never pick a version in code. URLSession agrees on HTTP/2 during the TLS handshake, and on iOS 15 and later it uses HTTP/3 once a server advertises support. Your <code>URLRequest</code> looks the same either way.</p>` },
    },
    {
      kind: 'code',
      title: 'Measuring the journey from Swift',
      intro: `<p>URLSession records when each phase of a request happened. A <strong>delegate</strong> (an object that receives callbacks) can read those metrics. This logger prints the negotiated protocol (h2 means HTTP/2, h3 means HTTP/3), whether an open connection was reused, how long the TLS handshake took and the total time.</p>`,
      run: 'static',
      simulate: { widget: 'networking-request-journey', props: { compact: true } },
      lines: [
        [R`import Foundation`, n(
          'The Swift compiler, while it builds the app.',
          'Makes URLSession, URL and the task-metrics types available in this file.',
          'The first line of the file; an import applies to this file only.',
          'At compile time, before any of your code runs.',
          'URLSession belongs to the Foundation framework, not to the Swift language, so every file that does networking imports it.')],
        ['', null],
        [R`final class JourneyLogger: NSObject, URLSessionTaskDelegate {`, n(
          'Your code declares it; URLSession will call into it.',
          'Declares a class that can receive callbacks about network tasks.',
          'A reference type: instances live on the heap, and URLSession keeps a reference while the task runs.',
          'Compiled once; an instance is created each time measureJourney() runs.',
          'Delegate protocols come from Objective-C, so the class inherits from NSObject; final says nothing subclasses it.')],
        [R`    func urlSession(_ session: URLSession, task: URLSessionTask,`, n(
          'URLSession, which looks for a method with exactly this signature.',
          'Begins the callback that delivers metrics, naming the session and the task (one request) they describe.',
          'A method inside JourneyLogger; its signature continues on the next line.',
          'Called once per task, after the response has completely arrived.',
          'The name and argument labels must match the protocol requirement exactly, or URLSession never calls it.')],
        [R`        didFinishCollecting metrics: URLSessionTaskMetrics) {`, n(
          'URLSession supplies the metrics object.',
          'Finishes the signature: metrics holds every timestamp URLSession recorded for the task.',
          'The last parameter of the delegate method; the body starts at the brace.',
          'Filled in at call time, when collection is complete.',
          'The external label didFinishCollecting reads like a sentence at the call site, while metrics is the short name used inside.')],
        [R`        guard let t = metrics.transactionMetrics.last else { return }`, n(
          'Your delegate, reading data URLSession gathered.',
          'Takes the last transaction (one request and response exchange), or leaves the method if there is none.',
          'The first statement inside the callback.',
          'Every time the callback runs.',
          'A task can contain several transactions, for example a redirect followed by the real request; the last one produced the response your code saw.')],
        [R`        print("Protocol:", t.networkProtocolName ?? "unknown")`, n(
          'Your code, using a value negotiated by URLSession and the server.',
          'Prints the protocol that was used: "http/1.1", "h2" or "h3".',
          'Inside the callback; the output goes to the Xcode console.',
          'After the task finished.',
          'The property is optional because some transactions, such as a response loaded from the local cache, used no network protocol; ?? substitutes a readable default.')],
        [R`        print("Reused connection:", t.isReusedConnection)`, n(
          'URLSession, which tracks its pool of open connections.',
          'Prints true when the request rode on a connection that was already open.',
          'Inside the callback.',
          'After the task finished.',
          'A reused connection skips DNS, TCP and TLS entirely, which is why a second request to the same server is usually much faster.')],
        [R`        if let start = t.secureConnectionStartDate,`, n(
          'Your code, unwrapping an optional timestamp.',
          'Binds the moment the TLS handshake began, if there was one.',
          'Inside the callback; the condition continues on the next line.',
          'After the task finished.',
          'A reused connection has no handshake, so these dates are nil; if let skips the print instead of crashing.')],
        [R`           let end = t.secureConnectionEndDate {`, n(
          'Your code, unwrapping a second optional.',
          'Binds the moment the TLS handshake completed.',
          'The second clause of the same if statement; both must succeed.',
          'Evaluated right after the first clause.',
          'Combining clauses with a comma keeps the happy path flat instead of nesting two ifs.')],
        [R`            print("TLS handshake:", end.timeIntervalSince(start))`, n(
          'Foundation date arithmetic.',
          'Prints the handshake duration in seconds, for example 0.031.',
          'Inside the if body, so only when both dates exist.',
          'After the task finished, on a fresh connection.',
          'Measuring real phases on real networks shows where time goes, instead of guessing.')],
        ['        }', null],
        [R`        print("Total seconds:", metrics.taskInterval.duration)`, n(
          'URLSession, which recorded when the task started and ended.',
          'Prints the whole task duration, from start to the last byte of the response.',
          'Inside the callback, after the per-phase details.',
          'After the task finished.',
          'Comparing the total with the TLS time tells you whether setup or the server dominates.')],
        ['    }', null],
        ['}', null],
        ['', null],
        [R`func measureJourney() async throws {`, n(
          'Your code; a caller awaits it.',
          'Declares a function that performs one measured request.',
          'A top-level function in this file.',
          'Runs whenever a caller awaits it, for example from a button action.',
          'async lets it wait for the network without blocking a thread; throws passes failures such as no connection to the caller.')],
        [R`    let url = URL(string: "https://httpbin.org/get")!`, n(
          'Foundation parses the string.',
          'Creates a URL value for a public test endpoint that echoes requests.',
          'A local constant inside measureJourney.',
          'Each time the function runs.',
          'The ! is acceptable only because this literal is known to be valid; never force-unwrap URLs built from user input.')],
        [R`    let logger = JourneyLogger()`, n(
          'Your code creates the delegate.',
          'Makes one logger instance.',
          'A local constant; the object itself lives on the heap.',
          'Just before the request starts.',
          'URLSession holds the delegate while the task runs, so it stays alive until the metrics arrive.')],
        [R`    _ = try await URLSession.shared.data(from: url, delegate: logger)`, n(
          'URLSession performs DNS, TCP, TLS and HTTP for you.',
          'Sends a GET request, waits for the full response and tells the logger about this one task.',
          'Called from measureJourney; the network work happens on URLSession\'s own threads.',
          'The function suspends at await until the response arrives or an error is thrown.',
          'The _ = discards the data because only the metrics matter here; the delegate parameter attaches the logger to this single request.')],
        ['}', null],
      ],
      try: [
        'In the panel, turn on connection reuse. Which three timestamps would be nil for that request, and why?',
        'Predict what networkProtocolName prints for a server that supports HTTP/3 on your very first request to it.',
      ],
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>Your app makes its first request to a new server over HTTPS with HTTP/2. What has to happen before the request itself is sent?</p>',
          choices: ['Only a DNS lookup', 'A DNS lookup, a TCP handshake and a TLS handshake', 'A TLS handshake only, because HTTPS does not use TCP', 'Nothing; HTTP/2 sends the request immediately'],
          answer: 1,
          explain: '<p>A fresh HTTP/2 connection needs the server\'s address (DNS), a reliable byte stream (TCP) and encryption plus server authentication (TLS), each costing at least one round trip. HTTPS absolutely runs on TCP for HTTP/1.1 and HTTP/2; only HTTP/3 replaces TCP with QUIC.</p>',
        },
        {
          q: '<p>A list screen makes 30 separate requests, one per row, each returning about 200 bytes. On cellular the screen takes three seconds to fill. Which change helps most?</p>',
          choices: ['Compress each JSON reply', 'Use a faster JSON decoder', 'Switch the phone to a higher-bandwidth plan', 'Fetch all 30 rows in one request'],
          answer: 3,
          explain: '<p>Tiny replies are dominated by latency: every request pays at least one round trip. One request pays it once. Compression and bandwidth help with large bodies, not with 200-byte replies, and decoding 200 bytes is already instant.</p>',
        },
        {
          q: '<p>Which statement about HTTP/3 is true?</p>',
          choices: ['It runs over QUIC, which is built on UDP and includes TLS 1.3', 'It removes encryption to save a round trip', 'You enable it by setting a property on every URLRequest', 'It requires a WebSocket connection'],
          answer: 0,
          explain: '<p>QUIC combines the transport and TLS 1.3 handshakes, which is where the saved round trip comes from, and encryption is mandatory. URLSession uses HTTP/3 automatically when the server supports it; there is no per-request switch.</p>',
        },
        {
          q: '<p>A teammate calls a function that blocks until the network replies, directly inside a button action on the main thread. What does the user experience?</p>',
          choices: ['Nothing unusual; networks are fast', 'iOS moves the call to a background thread automatically', 'The whole app freezes until the reply arrives or the request times out', 'The button disables itself until the reply arrives'],
          answer: 2,
          explain: '<p>The main thread draws the interface and handles touches. While it waits, nothing redraws and taps go unanswered, possibly for the full timeout. iOS does not rescue blocking code; using <code>await</code> with URLSession\'s async methods is what keeps the main thread free.</p>',
        },
      ],
    },
  ],
};

const http = {
  id: 'networking-http',
  title: 'Speaking HTTP',
  steps: [
    {
      kind: 'concept',
      title: 'Anatomy of a request and a response',
      body: `<p>An HTTP message is structured text (HTTP/2 and HTTP/3 carry the same parts in binary frames). A request says what you want; a response says what happened. Here is a complete request for one to-do item:</p><p><code>GET /todos/1 HTTP/1.1</code><br><code>Host: jsonplaceholder.typicode.com</code><br><code>Accept: application/json</code></p>`,
      points: [
        { term: 'Method', text: 'The verb: what to do with the resource, such as GET, POST, PUT, PATCH or DELETE.' },
        { term: 'URL', text: 'Which resource: scheme, host, path and optional query items.' },
        { term: 'Headers', text: 'Name and value pairs that describe the message: its format, the formats you accept, who is calling.' },
        { term: 'Body', text: 'Optional data, usually JSON. Sent with POST, PUT and PATCH, and returned by most responses.' },
        { term: 'Status code', text: 'A three-digit number at the start of every response, such as 200 OK or 404 Not Found.' },
      ],
    },
    {
      kind: 'concept',
      title: 'Methods and idempotency',
      body: `<p>The method tells the server your intent. Two properties matter when you write client code. A <strong>safe</strong> method only reads; it changes nothing on the server. An <strong>idempotent</strong> method has the same effect whether you send it once or five times. That matters because networks fail mid-request: if the reply never came, can you simply send it again?</p>`,
      points: [
        { term: 'GET', text: 'Read a resource. Safe and idempotent, so retrying is always fine. No body.' },
        { term: 'POST', text: 'Create something or trigger an action. Neither safe nor idempotent: sending it twice may place two orders.' },
        { term: 'PUT', text: 'Replace a resource with the body you send. Idempotent: the end state is the same however often it runs.' },
        { term: 'PATCH', text: 'Change some fields of a resource. Not guaranteed to be idempotent ("add 1 to the count" is a patch).' },
        { term: 'DELETE', text: 'Remove a resource. Idempotent: once it is gone, deleting again leaves it gone, even if the reply is 404.' },
      ],
      callout: { tone: 'tip', title: 'A retry rule of thumb', html: `<p>Retry GET, PUT and DELETE automatically after a timeout. Never blindly retry a POST; later in this module you will see how idempotency keys make that safe.</p>` },
    },
    {
      kind: 'code',
      title: 'Build URLs with URLComponents',
      intro: `<p>A URL has parts: the <strong>scheme</strong> (https), the <strong>host</strong> (the server's name), the <strong>path</strong> (which resource) and <strong>query items</strong> (name=value options after the ?). Spaces, accents and symbols such as &amp; must be <em>percent-encoded</em> (written as %20, %26). <code>URLComponents</code> assembles the parts and encodes them for you, so user input cannot break the URL.</p>`,
      run: 'static',
      simulate: { widget: 'networking-url-anatomy', props: {} },
      lines: [
        [R`import Foundation`, n(
          'The Swift compiler.',
          'Brings URLComponents, URLQueryItem and URL into this file.',
          'Top of the file.',
          'At compile time.',
          'These URL types are Foundation types, available on every Apple platform.')],
        ['', null],
        [R`func searchURL(for city: String) -> URL? {`, n(
          'Your code; a view or model calls it with whatever the user typed.',
          'Declares a function that builds a city-search URL for the Open-Meteo geocoding API.',
          'A top-level function; it could equally live inside an API client type.',
          'Each time the app needs a search URL, for example on every search.',
          'It returns URL? because building a URL can fail, and the caller should decide what to do then.')],
        [R`    var parts = URLComponents()`, n(
          'Foundation\'s URL builder.',
          'Creates an empty set of URL parts to fill in.',
          'A local variable (a struct value) inside the function.',
          'At the start of every call.',
          'It is var because each following line mutates one part.')],
        [R`    parts.scheme = "https"`, n(
          'Your code sets the protocol.',
          'Chooses HTTPS, the encrypted form of HTTP.',
          'Stored in the parts value.',
          'While the URL is being built.',
          'App Transport Security blocks plain http by default, so https is the normal choice.')],
        [R`    parts.host = "geocoding-api.open-meteo.com"`, n(
          'Your code names the server.',
          'Sets the host name that DNS will turn into an IP address.',
          'Stored in the parts value.',
          'While the URL is being built.',
          'Keeping the host separate from the path makes it easy to point at a test server later.')],
        [R`    parts.path = "/v1/search"`, n(
          'Your code names the resource.',
          'Sets the path: version 1 of the search endpoint.',
          'Stored in the parts value; a path must start with /.',
          'While the URL is being built.',
          'APIs often put a version in the path so old apps keep working when a new version ships.')],
        [R`    parts.queryItems = [`, n(
          'Your code supplies options for the request.',
          'Starts the array of name and value pairs that become the text after the ?.',
          'A property of the parts value; the array spans the next lines.',
          'While the URL is being built.',
          'Query items are passed as separate values, so URLComponents can encode each one correctly.')],
        [R`        URLQueryItem(name: "name", value: city),`, n(
          'URLComponents encodes the user\'s text.',
          'Adds name=<the city>, percent-encoding spaces, accents, & and = inside the value.',
          'The first element of the queryItems array.',
          'Encoding happens when parts.url is read.',
          'Pasting raw user text into a URL string lets an & split it into two items; a query item keeps it one value.')],
        [R`        URLQueryItem(name: "count", value: "1")`, n(
          'Your code adds a second option.',
          'Asks the API for only the best match.',
          'The second element; items are joined with & in this order.',
          'Encoded when parts.url is read.',
          'Requesting only what you need keeps replies small and fast.')],
        ['    ]', null],
        [R`    return parts.url`, n(
          'URLComponents assembles the final URL.',
          'Returns the encoded URL, or nil if the parts cannot form a valid URL.',
          'The last line of the function.',
          'When the caller reads the result.',
          'For "São Paulo" it produces ...search?name=S%C3%A3o%20Paulo&count=1, exactly what the server expects.')],
        ['}', null],
      ],
      try: [
        'In the panel, type a city with a space or an accent. Which characters change in the final URL?',
        'Type rock+roll. URLComponents leaves the + alone. Why might a server read it as a space?',
      ],
    },
    {
      kind: 'concept',
      title: 'Headers that matter',
      body: `<p>Headers travel with every request and response. Their names are case-insensitive. You set request headers on a <code>URLRequest</code>, and you read response headers from an <code>HTTPURLResponse</code>.</p>`,
      points: [
        { term: 'Content-Type', text: 'The format of the body you are sending, such as application/json. Set it whenever you send a body so the server knows how to parse it.' },
        { term: 'Accept', text: 'The formats the client can read. application/json asks for JSON back.' },
        { term: 'Authorization', text: 'Proves who is calling, usually the word Bearer followed by a token the user received at sign-in.' },
        { term: 'Cache-Control and ETag', text: 'Response headers that say how long a reply may be reused and label its version. They return in the last lesson of this module.' },
        { term: 'User-Agent', text: 'Names the client software. URLSession fills it in, along with Host, Content-Length and Accept-Encoding; leave those to URLSession.' },
      ],
    },
    {
      kind: 'concept',
      title: 'Status codes: how did it go?',
      body: `<p>Every response starts with a three-digit status code. The first digit names the family, so an app can react sensibly even to a code it has never seen.</p>`,
      points: [
        { term: '2xx Success', text: '200 OK, 201 Created (after a POST), 204 No Content (success with an empty body).' },
        { term: '3xx Redirection', text: '301 and 302 point to a new URL, and URLSession follows them for you. 304 Not Modified means your cached copy is still good.' },
        { term: '4xx Client error', text: 'The request was wrong: 400 Bad Request, 401 Unauthorized (sign in again), 403 Forbidden, 404 Not Found, 409 Conflict, 422 invalid data, 429 Too Many Requests.' },
        { term: '5xx Server error', text: 'The server failed: 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable. Often temporary, so a later retry can succeed.' },
      ],
      callout: { tone: 'warn', title: 'A 404 is not an error to URLSession', html: `<p>URLSession throws only when no response arrives at all: offline, timed out, untrusted certificate. A 404 or a 500 is a successfully delivered piece of bad news, so your code must check <code>statusCode</code> itself.</p>` },
    },
    {
      kind: 'code',
      title: 'Building a POST request',
      intro: `<p>To create a resource you send a POST with a JSON body. A <code>URLRequest</code> bundles everything the request needs: URL, method, headers, body and a timeout. This function only <em>builds</em> the request; sending it comes in the URLSession lesson. <code>JSONEncoder</code> turns a Swift value into JSON bytes.</p>`,
      run: 'static',
      lines: [
        [R`import Foundation`, n(
          'The Swift compiler.',
          'Imports URLRequest, JSONEncoder and the other Foundation types used below.',
          'Top of the file.',
          'At compile time.',
          'Networking and JSON encoding both live in Foundation.')],
        ['', null],
        [R`struct NewTodo: Encodable {`, n(
          'Your code defines the shape of the body.',
          'Declares a value type that can be written out as JSON.',
          'A top-level struct; instances live on the stack or inline in other values.',
          'Compiled once; a value is created for each request.',
          'Encodable is all a request body needs; the compiler writes the encoding code for you.')],
        [R`    let title: String`, n(
          'Your struct.',
          'A stored property that becomes the JSON key "title".',
          'Inside NewTodo.',
          'Set when a NewTodo is created.',
          'Property names match the API\'s keys, so no extra mapping code is needed.')],
        [R`    let completed: Bool`, n(
          'Your struct.',
          'Becomes "completed": true or false in the JSON.',
          'Inside NewTodo.',
          'Set when a NewTodo is created.',
          'Swift Bool maps directly to JSON true and false.')],
        [R`    let userId: Int`, n(
          'Your struct.',
          'Becomes "userId": a JSON number.',
          'Inside NewTodo.',
          'Set when a NewTodo is created.',
          'The API spells it userId, which is also fine Swift style, so the names line up.')],
        ['}', null],
        ['', null],
        [R`func makeCreateRequest(title: String) throws -> URLRequest {`, n(
          'Your code; the caller later passes the result to URLSession.',
          'Declares a function that builds, but does not send, a POST request.',
          'A top-level function; often a method of an API client type.',
          'Whenever the user creates a new to-do.',
          'It throws because encoding can fail; separating building from sending makes the request easy to inspect in a test.')],
        [R`    let url = URL(string: "https://jsonplaceholder.typicode.com")!`, n(
          'Foundation parses the base address.',
          'Creates the server\'s base URL from a fixed string.',
          'A local constant inside the function.',
          'Each call.',
          'Force-unwrapping is tolerable for a literal you control and have tested; never for user input.')],
        [R`        .appending(path: "todos")`, n(
          'Foundation\'s URL API.',
          'Adds the path component /todos, producing the collection URL.',
          'Chained onto the URL from the line above.',
          'Each call, right after the base URL is created.',
          'appending(path:) inserts the slash and encodes the component correctly, unlike string concatenation.')],
        [R`    var request = URLRequest(url: url)`, n(
          'Foundation.',
          'Creates a request with defaults: GET, no headers, no body, a 60-second timeout.',
          'A local variable; URLRequest is a struct.',
          'Each call.',
          'It is var because the following lines change the method, headers and body.')],
        [R`    request.httpMethod = "POST"`, n(
          'Your code sets the verb.',
          'Changes the method from GET to POST.',
          'Stored in the request value.',
          'While the request is being built.',
          'POST asks the collection to create a new member from the body.')],
        [R`    request.setValue("application/json",`, n(
          'Your code adds a header.',
          'Starts setting a header whose value is application/json.',
          'On the request; the header name follows on the next line.',
          'While the request is being built.',
          'The server must know the body is JSON before it can parse it.')],
        [R`                     forHTTPHeaderField: "Content-Type")`, n(
          'URLRequest stores the header.',
          'Names the header: Content-Type, the format of the body being sent.',
          'Second half of the setValue call.',
          'While the request is being built.',
          'setValue replaces any earlier value for that header, so calling it twice cannot create duplicates.')],
        [R`    request.setValue("application/json",`, n(
          'Your code adds another header.',
          'Starts a second header with the same value.',
          'On the request.',
          'While the request is being built.',
          'Same value, different meaning: this one describes the reply you want.')],
        [R`                     forHTTPHeaderField: "Accept")`, n(
          'URLRequest stores the header.',
          'Names it Accept: the client can read JSON responses.',
          'Second half of the call.',
          'While the request is being built.',
          'Some servers can answer in several formats; Accept picks one.')],
        [R`    let todo = NewTodo(title: title, completed: false, userId: 1)`, n(
          'Your code creates the body value.',
          'Builds a NewTodo with the title the user typed.',
          'A local constant on the stack.',
          'Each call.',
          'Working with a typed struct instead of a hand-written JSON string means the compiler catches misspelled keys.')],
        [R`    request.httpBody = try JSONEncoder().encode(todo)`, n(
          'JSONEncoder converts the value; the request stores the bytes.',
          'Encodes the struct as JSON Data and sets it as the request body.',
          'On the request.',
          'Each call; try passes any encoding error to the caller.',
          'The body must be Data (bytes), and JSONEncoder produces exactly that.')],
        [R`    request.timeoutInterval = 15`, n(
          'URLSession will enforce it when the request is sent.',
          'Gives up if no data arrives for 15 seconds, instead of the 60-second default.',
          'On the request.',
          'Applied later, while the request is in flight.',
          'A user waiting on a Save button should hear about a problem sooner than one minute.')],
        [R`    return request`, n(
          'Your function.',
          'Hands the finished request to the caller.',
          'The last line of the function.',
          'After every part has been set.',
          'URLRequest is a value type, so the caller gets an independent copy it can still modify.')],
        ['}', null],
      ],
      try: [
        'Which line would you change to make this request update to-do 5 completely instead of creating one?',
        'Remove the Content-Type line in your head. What might the server do with the body then?',
      ],
    },
    {
      kind: 'widget',
      title: 'HTTP request builder',
      intro: `<p>Send real HTTP requests from this page. Pick a method and a preset endpoint, add headers or a JSON body, then send. You will see the raw request, the status code, the response headers the browser lets this page read, the timing and the body, plus the equivalent Swift <code>URLRequest</code> code. Try a POST, a 404, and the endpoint that requires an Authorization header.</p>`,
      widget: 'networking-http-builder',
      props: {},
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>A user edits only their display name and taps Save. The API supports partial updates of a profile. Which method fits best?</p>',
          choices: ['GET /profile', 'DELETE /profile', 'PATCH /profile with the new name', 'POST /profiles with the new name'],
          answer: 2,
          explain: '<p>PATCH changes some fields of an existing resource. POST to the collection would ask the server to create a new profile, and GET only reads.</p>',
        },
        {
          q: '<p>A request times out and you never see a reply. Which one can your app safely resend automatically?</p>',
          choices: ['POST /orders', 'PUT /cart/items/42 with the complete item', 'POST /payments', 'PATCH /counter with "add 1"'],
          answer: 1,
          explain: '<p>PUT replaces the item with the same body every time, so sending it twice leaves the same end state. The POSTs could create a second order or payment, and "add 1" would add 2.</p>',
        },
        {
          q: '<p>The server answers <code>data(from:)</code> with 404 Not Found. What does URLSession do?</p>',
          choices: ['Throws URLError(.fileDoesNotExist)', 'Retries the request three times', 'Stops the app with a fatal error', 'Returns normally; the HTTPURLResponse has statusCode 404'],
          answer: 3,
          explain: '<p>A response arrived, so from URLSession\'s point of view the transfer succeeded. Your code must read <code>statusCode</code> and treat 404 as a failure. URLSession throws only when no usable response arrives.</p>',
        },
        {
          q: '<p>Code builds a URL as <code>"https://api.example.com/search?q=" + text</code>, and a user searches for <em>salt &amp; pepper</em>. What reaches the server?</p>',
          choices: ['The & splits the value, so q is "salt " and an unexpected second item " pepper" appears', 'q is "salt & pepper", exactly as typed', 'Swift refuses to compile the concatenation', 'URLSession repairs the URL before sending'],
          answer: 0,
          explain: '<p>An & in a query string separates items. Building the URL with <code>URLComponents</code> and a <code>URLQueryItem</code> encodes it as %26, so the server receives the whole phrase as one value.</p>',
        },
        {
          q: '<p>An API answers 503 Service Unavailable with a Retry-After header. What should the app do?</p>',
          choices: ['Sign the user out', 'Wait as instructed, then try again; the server is temporarily overloaded or down', 'Show "Page not found"', 'Delete its cached data'],
          answer: 1,
          explain: '<p>5xx codes mean the server failed, and 503 specifically signals a temporary condition. Retry-After tells you how long to wait. Signing out is the reaction to 401, and "not found" is 404.</p>',
        },
      ],
    },
  ],
};

const jsonRest = {
  id: 'networking-json-rest',
  title: 'REST Resources and JSON',
  steps: [
    {
      kind: 'concept',
      title: 'REST: resources and verbs',
      body: `<p><strong>REST</strong> (Representational State Transfer) is the most common style of web API. Instead of calling remote functions by name, you act on <strong>resources</strong>, things the server knows about, each with its own URL. The HTTP method says what to do. The server replies with a <strong>representation</strong> of the resource, almost always JSON. JSONPlaceholder, a free practice API, follows the pattern:</p>`,
      points: [
        { term: 'GET /todos', text: 'The collection: a JSON array of every to-do.' },
        { term: 'GET /todos/1', text: 'One member of the collection, identified by its id.' },
        { term: 'POST /todos', text: 'Create a to-do from the JSON body; the reply is 201 Created with the new id.' },
        { term: 'PATCH /todos/1', text: 'Change some fields of to-do 1, such as completed.' },
        { term: 'DELETE /todos/1', text: 'Remove to-do 1.' },
      ],
      callout: { tone: 'design', title: 'Stateless by design', html: `<p>Each request carries everything the server needs, including who is calling. The server does not remember earlier requests, which lets any one of many machines answer the next one.</p>` },
    },
    {
      kind: 'concept',
      title: 'From JSON to Swift types',
      body: `<p><strong>JSON</strong> (JavaScript Object Notation) is text built from a handful of value kinds, and each maps to a Swift type. Swift's <code>Codable</code> protocol converts between them automatically when names and types line up. <code>Decodable</code> reads JSON into Swift values, <code>Encodable</code> writes them out, and <code>Codable</code> means both.</p>`,
      points: [
        { term: 'Object { }', text: 'A struct whose stored properties match the keys.' },
        { term: 'Array [ ]', text: 'A Swift Array, such as [Todo].' },
        { term: 'String, number, true/false', text: 'String; Int or Double; Bool.' },
        { term: 'null or a missing key', text: 'An Optional property, such as let dueDate: String?. A non-optional property with no value is a decoding error.' },
      ],
      callout: { tone: 'tip', title: 'Model only what you use', html: `<p>Your struct may skip keys it does not need. Extra keys in the JSON are ignored, so the server can add fields without breaking your app.</p>` },
    },
    {
      kind: 'code',
      title: 'Decode your first response',
      intro: `<p>This is the JSON that <code>GET https://jsonplaceholder.typicode.com/todos/1</code> really returns, embedded as a string so the program runs without a network. The struct mirrors its four keys. <code>JSONDecoder</code> reads bytes (<code>Data</code>), not strings, so the text is converted first.</p>`,
      run: 'swift',
      lines: [
        [R`import Foundation`, n(
          'The Swift compiler.',
          'Makes JSONDecoder and Data available.',
          'Top of the file.',
          'At compile time.',
          'JSON support is part of Foundation, not the core language.')],
        ['', null],
        [R`struct Todo: Codable {`, n(
          'Your code; the compiler generates the decoding logic.',
          'Declares a value type that can be read from and written to JSON.',
          'A top-level struct.',
          'Compiled once; values are created by the decoder at run time.',
          'Conforming to Codable is all it takes: the compiler matches each stored property to a JSON key of the same name.')],
        [R`    let userId: Int`, n(
          'Your struct.',
          'Holds the "userId" number.',
          'Inside Todo.',
          'Filled in during decoding.',
          'The JSON number 1 has no fractional part, so Int is the right type.')],
        [R`    let id: Int`, n(
          'Your struct.',
          'Holds the to-do\'s own identifier.',
          'Inside Todo.',
          'Filled in during decoding.',
          'let makes decoded values read-only, which is what data from a server usually should be.')],
        [R`    let title: String`, n(
          'Your struct.',
          'Holds the "title" text.',
          'Inside Todo.',
          'Filled in during decoding.',
          'A JSON string maps to a Swift String.')],
        [R`    let completed: Bool`, n(
          'Your struct.',
          'Holds the true or false flag.',
          'Inside Todo.',
          'Filled in during decoding.',
          'A JSON boolean maps to Bool; the string "false" would not.')],
        ['}', null],
        ['', null],
        [R`let json = """`, n(
          'Your code, standing in for a server reply.',
          'Opens a multi-line string literal holding the JSON text.',
          'A global constant in this script.',
          'At program start.',
          'Triple quotes let the JSON keep its own double quotes without escaping each one.')],
        [R`{"userId": 1, "id": 1,`, n(
          'The JSON text itself.',
          'Starts the object and gives the first two keys their numbers.',
          'Inside the string literal; Swift does not interpret it.',
          'Only read when the decoder parses it.',
          'This is the exact response JSONPlaceholder sends, so the model is designed against real data.')],
        [R` "title": "delectus aut autem", "completed": false}`, n(
          'The JSON text.',
          'Supplies the remaining two keys and closes the object.',
          'Inside the string literal.',
          'Read during parsing.',
          'The placeholder title is Latin filler text, which is what this practice API returns.')],
        [R`"""`, n(
          'The Swift compiler.',
          'Closes the multi-line string.',
          'Its indentation sets how much leading space is removed from each line.',
          'At compile time.',
          'Placing it at column 0 keeps the JSON text exactly as written.')],
        ['', null],
        [R`let data = Data(json.utf8)`, n(
          'Foundation.',
          'Converts the string to raw UTF-8 bytes.',
          'A global constant.',
          'At program start, after json exists.',
          'URLSession hands you Data, never a String, so decoding from Data matches what a real request gives you.')],
        [R`let todo = try JSONDecoder().decode(Todo.self, from: data)`, n(
          'JSONDecoder parses the bytes and calls Todo\'s generated initializer.',
          'Turns the JSON into a fully typed Todo value, or throws if anything does not match.',
          'Top-level script code.',
          'Immediately after data is created.',
          'Todo.self passes the type itself, telling the decoder what shape to expect.')],
        [R`print(todo.title)`, n(
          'Your code.',
          'Prints the decoded title: delectus aut autem.',
          'Top-level script code; output goes to the console.',
          'After decoding succeeded.',
          'From here on you work with properties and types, not string keys.')],
        [R`print(todo.completed ? "Done" : "Still to do")`, n(
          'Your code.',
          'Prints a message based on the Bool, using the ternary operator.',
          'Top-level script code.',
          'After the title is printed.',
          'Typed values make logic like this safe; there is no chance completed is accidentally a string.')],
      ],
      expect: 'delectus aut autem\nStill to do',
      try: [
        'Add a fifth key, "priority": 2, to the JSON. Does decoding still succeed? Why?',
        'Change "completed": false to "completed": "no". Predict the error before you run it.',
      ],
    },
    {
      kind: 'code',
      title: 'Rename keys with CodingKeys',
      intro: `<p>Open-Meteo's weather API names its fields <code>temperature_2m</code> and <code>wind_speed_10m</code>, which are poor Swift property names. A nested enum named <code>CodingKeys</code> maps each Swift property to the JSON key it comes from. Once you write it, list every property that should be decoded. The JSON's <code>interval</code> key has no property, so it is simply ignored.</p>`,
      run: 'swift',
      lines: [
        [R`import Foundation`, n(
          'The Swift compiler.',
          'Imports JSONDecoder and Data.',
          'Top of the file.',
          'At compile time.',
          'Every decoding example needs Foundation.')],
        ['', null],
        [R`struct Conditions: Decodable {`, n(
          'Your code.',
          'Declares a read-only model for the current weather.',
          'A top-level struct.',
          'Values are created during decoding.',
          'Decodable is enough because the app only reads weather; it never sends it.')],
        [R`    let time: String`, n(
          'Your struct.',
          'Holds the measurement time as text.',
          'Inside Conditions.',
          'Filled during decoding.',
          'Its JSON key is already a good Swift name, so it maps unchanged.')],
        [R`    let temperature: Double`, n(
          'Your struct.',
          'Holds degrees Celsius, such as 25.7.',
          'Inside Conditions.',
          'Filled during decoding.',
          'Double because the value has a fractional part; Int would fail to decode 25.7.')],
        [R`    let windSpeed: Double`, n(
          'Your struct.',
          'Holds wind speed in kilometres per hour.',
          'Inside Conditions.',
          'Filled during decoding.',
          'Swift style is lowerCamelCase, so the property is windSpeed even though the JSON says otherwise.')],
        ['', null],
        [R`    enum CodingKeys: String, CodingKey {`, n(
          'The compiler\'s generated decoder looks for this exact name.',
          'Declares the list of keys, each backed by the JSON key string.',
          'Nested inside Conditions, so it belongs only to this type.',
          'Used at run time whenever a Conditions value is decoded or encoded.',
          'Without it, keys must equal property names; with it, you choose the mapping.')],
        [R`        case time`, n(
          'The enum.',
          'Maps time to the JSON key "time".',
          'Inside CodingKeys.',
          'Used during decoding.',
          'A case without a raw value uses its own name as the string.')],
        [R`        case temperature = "temperature_2m"`, n(
          'The enum.',
          'Maps the temperature property to the JSON key temperature_2m.',
          'Inside CodingKeys.',
          'Used during decoding.',
          'The raw value is the key exactly as the server spells it, including the height suffix 2m.')],
        [R`        case windSpeed = "wind_speed_10m"`, n(
          'The enum.',
          'Maps windSpeed to wind_speed_10m.',
          'Inside CodingKeys.',
          'Used during decoding.',
          'Explicit mappings document the API right in the model, which helps the next reader.')],
        ['    }', null],
        ['}', null],
        ['', null],
        [R`let json = """`, n(
          'Your code, standing in for the server.',
          'Opens the string holding the "current" object from a real Open-Meteo reply.',
          'A global constant.',
          'At program start.',
          'Testing a model against a captured response is quick and works offline.')],
        [R`{"time": "2026-10-20T14:15", "interval": 900,`, n(
          'The JSON text.',
          'Provides the time and an interval key that the model does not use.',
          'Inside the string literal.',
          'Read during parsing.',
          'interval is there on purpose: extra keys are skipped without error.')],
        [R` "temperature_2m": 25.7, "wind_speed_10m": 18.8}`, n(
          'The JSON text.',
          'Provides the two measurements under their snake_case names.',
          'Inside the string literal.',
          'Read during parsing.',
          'These are the names CodingKeys points to.')],
        [R`"""`, n(
          'The compiler.',
          'Ends the multi-line string.',
          'Column 0, so no indentation is stripped.',
          'At compile time.',
          'The closing delimiter must be on its own line.')],
        [R`let data = Data(json.utf8)`, n(
          'Foundation.',
          'Converts the text to bytes.',
          'A global constant.',
          'At program start.',
          'The decoder works on Data, the same type URLSession returns.')],
        [R`let now = try JSONDecoder().decode(Conditions.self, from: data)`, n(
          'JSONDecoder, guided by CodingKeys.',
          'Decodes the bytes into a Conditions value.',
          'Top-level script code.',
          'Right after data exists.',
          'If a mapped key were misspelled, this line would throw keyNotFound and name the missing key.')],
        [R`print("\(now.temperature) °C, wind \(now.windSpeed) km/h")`, n(
          'Your code.',
          'Prints 25.7 °C, wind 18.8 km/h using string interpolation.',
          'Top-level script code.',
          'After decoding.',
          'The rest of the app uses the clean Swift names; snake_case never leaks past the model.')],
        [R`print("Measured at \(now.time)")`, n(
          'Your code.',
          'Prints the timestamp string.',
          'Top-level script code.',
          'After the first print.',
          'A real app would convert this ISO 8601 text to a Date for display.')],
      ],
      expect: '25.7 °C, wind 18.8 km/h\nMeasured at 2026-10-20T14:15',
      try: [
        'Misspell the raw value "wind_speed_10m". What does the error name?',
        'Delete the line case time. Why does the program no longer compile?',
      ],
    },
    {
      kind: 'code',
      title: 'Nested JSON, nested structs',
      intro: `<p>Real responses nest objects inside objects. JSONPlaceholder's <code>/users/1</code> keeps the street and city inside an <code>address</code> object. The simplest model mirrors that nesting: a second struct for the inner object, used as the type of a property. Codable decodes the whole tree in one call.</p>`,
      run: 'swift',
      lines: [
        [R`import Foundation`, n(
          'The Swift compiler.',
          'Imports JSONDecoder and Data.',
          'Top of the file.',
          'At compile time.',
          'Required for any JSON work.')],
        ['', null],
        [R`struct User: Decodable {`, n(
          'Your code.',
          'Declares the outer model, matching the top-level JSON object.',
          'A top-level struct.',
          'Values are created during decoding.',
          'One struct per JSON object is the most readable mapping.')],
        [R`    let name: String`, n(
          'Your struct.',
          'Holds the user\'s full name.',
          'Inside User.',
          'Filled during decoding.',
          'A plain string key, mapped by name.')],
        [R`    let address: Address`, n(
          'Your struct, delegating to another Decodable type.',
          'Holds the nested address object as an Address value.',
          'Inside User; the Address value is stored inline.',
          'Decoded right after name, by Address\'s own generated code.',
          'Because Address is Decodable, User needs no extra code to handle the nesting.')],
        ['}', null],
        ['', null],
        [R`struct Address: Decodable {`, n(
          'Your code.',
          'Declares the model for the inner "address" object.',
          'A top-level struct, reusable wherever an address appears.',
          'Values are created while a User is decoded.',
          'Splitting models by JSON object keeps each one small and testable.')],
        [R`    let street: String`, n(
          'Your struct.',
          'Holds the street name.',
          'Inside Address.',
          'Filled during decoding.',
          'Only the keys you need are modelled; suite and zipcode are ignored.')],
        [R`    let city: String`, n(
          'Your struct.',
          'Holds the city name.',
          'Inside Address.',
          'Filled during decoding.',
          'Matches the "city" key exactly.')],
        ['}', null],
        ['', null],
        [R`let json = """`, n(
          'Your code, standing in for the server.',
          'Opens a trimmed copy of the /users/1 response.',
          'A global constant.',
          'At program start.',
          'The real reply has more keys; leaving them out changes nothing because extras are ignored.')],
        [R`{"id": 1, "name": "Leanne Graham",`, n(
          'The JSON text.',
          'Starts the user object with an id the model skips and the name it keeps.',
          'Inside the string literal.',
          'Read during parsing.',
          'id is ignored because User has no id property.')],
        [R` "address": {"street": "Kulas Light", "city": "Gwenborough"}}`, n(
          'The JSON text.',
          'Holds the nested address object, then closes the outer object.',
          'Inside the string literal.',
          'Read during parsing.',
          'The inner braces are what the Address struct mirrors.')],
        [R`"""`, n(
          'The compiler.',
          'Ends the string.',
          'Column 0.',
          'At compile time.',
          'Keeps the JSON free of extra indentation.')],
        ['', null],
        [R`let data = Data(json.utf8)`, n(
          'Foundation.',
          'Converts the text to bytes.',
          'A global constant.',
          'At program start.',
          'Decoders read Data.')],
        [R`let user = try JSONDecoder().decode(User.self, from: data)`, n(
          'JSONDecoder walks the tree: User first, then Address inside it.',
          'Decodes the entire nested structure in one call.',
          'Top-level script code.',
          'After data exists.',
          'You never write loops or key lookups; the types describe the shape.')],
        [R`print("\(user.name) lives on \(user.address.street)")`, n(
          'Your code.',
          'Prints the name and street, reaching into the nested value with dot syntax.',
          'Top-level script code.',
          'After decoding.',
          'The nesting in Swift reads exactly like the nesting in the JSON.')],
        [R`print("in \(user.address.city)")`, n(
          'Your code.',
          'Prints the city on a second line.',
          'Top-level script code.',
          'After the first print.',
          'user.address.city is fully type-checked; a typo would not compile.')],
      ],
      expect: 'Leanne Graham lives on Kulas Light\nin Gwenborough',
      try: [
        'Remove "city" from the JSON. Which key and which path will the error report?',
      ],
    },
    {
      kind: 'code',
      title: 'Flatten with a nested container',
      intro: `<p>Sometimes you want a flat Swift type even though the JSON nests. Then you write <code>init(from:)</code> yourself. A <strong>container</strong> is a view of one JSON object, read through a CodingKey enum. <code>nestedContainer</code> steps into an inner object so you can read its keys directly. Use this sparingly: nested structs are less code.</p>`,
      run: 'swift',
      lines: [
        [R`import Foundation`, n(
          'The Swift compiler.',
          'Imports the decoding types.',
          'Top of the file.',
          'At compile time.',
          'Decoder and the container types are Foundation-level Codable machinery.')],
        ['', null],
        [R`struct User: Decodable {`, n(
          'Your code.',
          'Declares a flat model: no Address type at all.',
          'A top-level struct.',
          'Values are created by the custom initializer below.',
          'The rest of the app only ever needs the city, so a flat type is simpler to use.')],
        [R`    let name: String`, n(
          'Your struct.',
          'Holds the top-level name.',
          'Inside User.',
          'Assigned in init(from:).',
          'A let property must be assigned exactly once in the initializer.')],
        [R`    let city: String`, n(
          'Your struct.',
          'Holds the city, which in the JSON sits inside address.',
          'Inside User.',
          'Assigned in init(from:).',
          'This is the flattening: one property for a value that was two levels deep.')],
        ['', null],
        [R`    enum CodingKeys: String, CodingKey { case name, address }`, n(
          'Your code, for the outer object.',
          'Lists the two outer keys this initializer reads.',
          'Nested inside User.',
          'Used during decoding.',
          'Each JSON object level gets its own key enum.')],
        [R`    enum AddressKeys: String, CodingKey { case city }`, n(
          'Your code, for the inner object.',
          'Lists the only key read from inside address.',
          'Nested inside User.',
          'Used during decoding.',
          'A separate enum makes it a compile error to ask the address container for a key that belongs elsewhere.')],
        [R`    init(from decoder: Decoder) throws {`, n(
          'JSONDecoder calls it in place of the generated initializer.',
          'Starts a custom decoding initializer.',
          'Inside User; Decodable requires exactly this signature.',
          'Each time a User is decoded.',
          'Writing it yourself replaces the compiler\'s automatic version for this type.')],
        [R`        let root = try decoder.container(keyedBy: CodingKeys.self)`, n(
          'The decoder.',
          'Gets a keyed container for the outer JSON object.',
          'A local constant inside the initializer.',
          'First thing during decoding.',
          'It throws if the JSON at this point is not an object.')],
        [R`        name = try root.decode(String.self, forKey: .name)`, n(
          'The outer container.',
          'Reads "name" as a String and assigns it.',
          'Inside the initializer.',
          'Right after the container is created.',
          'Each read names the type and the key, so a mismatch is caught with a precise error.')],
        [R`        let address = try root.nestedContainer(`, n(
          'The outer container.',
          'Begins stepping into the object stored under a key.',
          'Inside the initializer; the arguments follow on the next line.',
          'After name is read.',
          'nestedContainer gives you the inner object without a separate struct.')],
        [R`            keyedBy: AddressKeys.self, forKey: .address)`, n(
          'The outer container.',
          'Chooses the inner key enum and the outer key that holds the object.',
          'The second line of the same call.',
          'During decoding.',
          'The keyedBy type defines which keys are legal inside the address object.')],
        [R`        city = try address.decode(String.self, forKey: .city)`, n(
          'The nested container.',
          'Reads "city" from inside address and assigns it.',
          'Inside the initializer.',
          'After the nested container is created.',
          'After this line every let property has a value, so initialization is complete.')],
        ['    }', null],
        ['}', null],
        ['', null],
        [R`let json = """`, n(
          'Your code, standing in for the server.',
          'Opens the JSON text.',
          'A global constant.',
          'At program start.',
          'The same shape as before: city is nested inside address.')],
        [R`{"name": "Leanne Graham", "address": {"city": "Gwenborough"}}`, n(
          'The JSON text.',
          'A user object with a nested address object.',
          'Inside the string literal.',
          'Read during parsing.',
          'The Swift type is flat, but the JSON is not; the initializer bridges the two.')],
        [R`"""`, n(
          'The compiler.',
          'Ends the string.',
          'Column 0.',
          'At compile time.',
          'Keeps the text unindented.')],
        [R`let user = try JSONDecoder().decode(User.self, from: Data(json.utf8))`, n(
          'JSONDecoder, which calls your init(from:).',
          'Converts the text to bytes and decodes a flat User.',
          'Top-level script code.',
          'After json exists.',
          'Callers cannot tell the type has a hand-written initializer; the call looks the same.')],
        [R`print("\(user.name), \(user.city)")`, n(
          'Your code.',
          'Prints the name and city.',
          'Top-level script code.',
          'After decoding.',
          'user.city reads flat even though the data was nested.')],
      ],
      expect: 'Leanne Graham, Gwenborough',
    },
    {
      kind: 'code',
      title: 'When decoding fails',
      intro: `<p>Decoding fails loudly when the JSON does not match your model, and the error says exactly where. <code>DecodingError</code> has cases for a missing key, a wrong type, an unexpected null and corrupted data. Catching specific cases turns a crash into a useful message. Each call below passes different JSON; <code>\\"</code> writes a quote inside a Swift string.</p>`,
      run: 'swift',
      lines: [
        [R`import Foundation`, n(
          'The Swift compiler.',
          'Imports JSONDecoder and DecodingError.',
          'Top of the file.',
          'At compile time.',
          'DecodingError is defined alongside the Codable types.')],
        ['', null],
        [R`struct Todo: Decodable {`, n(
          'Your code.',
          'Declares a small model with two required properties.',
          'A top-level struct.',
          'Decoded once per check call.',
          'Required (non-optional) properties make the failure cases easy to trigger.')],
        [R`    let id: Int`, n(
          'Your struct.',
          'Must be a JSON number.',
          'Inside Todo.',
          'Filled during decoding.',
          'A quoted "3" is a string, not a number, and will not decode as Int.')],
        [R`    let title: String`, n(
          'Your struct.',
          'Must be present and a string.',
          'Inside Todo.',
          'Filled during decoding.',
          'Non-optional, so a missing title is an error rather than nil.')],
        ['}', null],
        [R`func check(_ json: String) {`, n(
          'Your code.',
          'Declares a helper that tries to decode one JSON string and reports the result.',
          'A top-level function.',
          'Once for each call at the bottom.',
          'It does not throw: every error is handled inside, which is what a screen would do.')],
        [R`    do {`, n(
          'Swift error handling.',
          'Starts a block whose thrown errors flow to the catch clauses below.',
          'Inside check.',
          'Each call.',
          'do/catch is where you decide what each failure means to the user.')],
        [R`        let data = Data(json.utf8)`, n(
          'Foundation.',
          'Converts the text to bytes.',
          'A local constant inside do.',
          'Each call.',
          'Same first step as with a real network response.')],
        [R`        let todo = try JSONDecoder().decode(Todo.self, from: data)`, n(
          'JSONDecoder.',
          'Attempts the decode; on failure, jumps to the first matching catch.',
          'Inside do.',
          'Each call.',
          'try marks the exact line that can fail.')],
        [R`        print("Decoded:", todo.title)`, n(
          'Your code.',
          'Reports success with the decoded title.',
          'Inside do; runs only if decoding succeeded.',
          'After a successful decode.',
          'Lines after a throwing call run only on the success path.')],
        [R`    } catch DecodingError.keyNotFound(let key, _) {`, n(
          'Swift pattern matching on the thrown error.',
          'Catches a missing key and binds which key it was.',
          'The first catch clause.',
          'When a required key is absent.',
          'The underscore ignores the context value, which this message does not need.')],
        [R`        print("Missing key:", key.stringValue)`, n(
          'Your code.',
          'Prints the name of the missing key.',
          'Inside the first catch.',
          'For the second call below.',
          'stringValue turns the CodingKey back into the JSON key text.')],
        [R`    } catch DecodingError.typeMismatch(let type, let context) {`, n(
          'Swift pattern matching.',
          'Catches a value of the wrong JSON type, binding the expected type and the context.',
          'The second catch clause.',
          'When, say, a string arrives where a number was expected.',
          'The context carries the codingPath, the route to the bad value.')],
        [R`        let path = context.codingPath.map { $0.stringValue }`, n(
          'Your code, using map with a shorthand closure.',
          'Turns the path of CodingKeys into an array of strings.',
          'Inside the second catch.',
          'For the third call below.',
          'A readable path such as ["address", "city"] points straight at the problem in big JSON.')],
        [R`        print("Wrong type at \(path): expected \(type)")`, n(
          'Your code.',
          'Prints the path and the type the model wanted.',
          'Inside the second catch.',
          'For the third call.',
          'Interpolating a type prints its name, Int here.')],
        [R`    } catch {`, n(
          'Swift error handling.',
          'Catches every other error, bound automatically as error.',
          'The final catch clause.',
          'For the fourth call, whose text is not valid JSON.',
          'A non-throwing function must handle every possible error, so a catch-all is required.')],
        [R`        print("Not valid JSON")`, n(
          'Your code.',
          'Reports the remaining case: the text could not be parsed at all.',
          'Inside the last catch.',
          'For the fourth call.',
          'That case is DecodingError.dataCorrupted; this example keeps the message general.')],
        ['    }', null],
        ['}', null],
        ['', null],
        [R`check("{\"id\": 1, \"title\": \"Walk the dog\"}")`, n(
          'Your code.',
          'Decodes valid JSON and prints the title.',
          'Top-level script code.',
          'First of the four calls, when the script runs.',
          'A baseline: the happy path.')],
        [R`check("{\"id\": 2}")`, n(
          'Your code.',
          'Passes JSON with no title.',
          'Top-level script code.',
          'Second, after the first call returns.',
          'Triggers keyNotFound.')],
        [R`check("{\"id\": \"3\", \"title\": \"Read\"}")`, n(
          'Your code.',
          'Passes an id written as a string.',
          'Top-level script code.',
          'Third, after the missing-key case.',
          'Triggers typeMismatch at ["id"].')],
        [R`check("{\"id\": 4, \"title\": ")`, n(
          'Your code.',
          'Passes text that stops in the middle.',
          'Top-level script code.',
          'Last, after the type-mismatch case.',
          'Truncated replies happen on flaky networks, and they must not crash the app.')],
      ],
      expect: 'Decoded: Walk the dog\nMissing key: title\nWrong type at ["id"]: expected Int\nNot valid JSON',
      try: [
        R`Add check("{\"id\": 5, \"title\": null}"). Which catch clause runs, and why?`,
      ],
    },
    {
      kind: 'widget',
      title: 'JSON to Swift decoder lab',
      intro: `<p>Load a real response (or the offline sample), then edit the JSON or the Swift model. The lab decodes it the way <code>JSONDecoder</code> does and reports either the decoded value or the exact <code>DecodingError</code> case, coding path and message. Try deleting a key, putting a number in quotes, making a property optional, setting a value to null, or decoding an array as a single object.</p>`,
      widget: 'networking-json-decoder',
      props: {},
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>The JSON is <code>{"id": 7, "title": "Run", "done": true}</code>. The struct has <code>let id: Int</code>, <code>let title: String</code> and <code>let completed: Bool</code>, with no CodingKeys. What happens?</p>',
          choices: ['It decodes, and completed defaults to false', 'It throws keyNotFound for completed', 'It throws typeMismatch for done', 'It decodes, and completed becomes nil'],
          answer: 1,
          explain: '<p>Without CodingKeys, the property completed looks for a key named "completed", which is missing. Non-optional properties have no default during decoding, and done is simply ignored as an extra key.</p>',
        },
        {
          q: '<p>The server sometimes leaves out <code>"dueDate"</code>. How should you declare the property?</p>',
          choices: ['let dueDate: String', 'var dueDate = "" so the default covers a missing key', 'let dueDate: String?', 'let dueDate: Any'],
          answer: 2,
          explain: '<p>An optional property decodes to nil when the key is missing or null. The tempting <code>var dueDate = ""</code> does not help: the generated decoder still requires the key and throws keyNotFound. Any is not Decodable at all.</p>',
        },
        {
          q: '<p>The JSON key is <code>temp_c</code> and you want a Swift property called <code>temperature</code>. What do you add?</p>',
          choices: ['Make temperature optional', 'Rename the key in the JSON text before decoding', 'Decode into a Dictionary instead', 'A CodingKeys enum containing case temperature = "temp_c"'],
          answer: 3,
          explain: '<p>CodingKeys maps property names to JSON keys. Making the property optional would only hide the problem: it would always be nil because no key named temperature exists.</p>',
        },
        {
          q: '<p>Decoding <code>{"id": "42"}</code> into a struct with <code>let id: Int</code> throws which error?</p>',
          choices: ['typeMismatch with codingPath ["id"]: expected Int but found a string', 'keyNotFound for id', 'Nothing; JSONDecoder converts "42" to 42', 'valueNotFound for id'],
          answer: 0,
          explain: '<p>The key exists, so it is not keyNotFound, and the value is not null, so it is not valueNotFound. JSONDecoder never converts between strings and numbers; a quoted number is a string.</p>',
        },
      ],
    },
  ],
};

const TODO_CONTEXT = `import Foundation
struct Todo: Codable, Sendable {
    let userId: Int
    let id: Int
    let title: String
    let completed: Bool
}`;

const WEATHER_MODELS = `import Foundation
struct CurrentWeather: Decodable, Sendable {
    let temperature: Double
    let windSpeed: Double
    enum CodingKeys: String, CodingKey {
        case temperature = "temperature_2m"
        case windSpeed = "wind_speed_10m"
    }
}
struct Forecast: Decodable, Sendable {
    let current: CurrentWeather
}`;

const WEATHER_CLIENT = `${WEATHER_MODELS}
struct WeatherClient: Sendable {
    var session = URLSession.shared
    func current(latitude: Double,
                 longitude: Double) async throws -> CurrentWeather {
        var parts = URLComponents(
            string: "https://api.open-meteo.com/v1/forecast")!
        parts.queryItems = [
            URLQueryItem(name: "latitude", value: "\\(latitude)"),
            URLQueryItem(name: "longitude", value: "\\(longitude)"),
            URLQueryItem(name: "current",
                         value: "temperature_2m,wind_speed_10m")
        ]
        let (data, response) = try await session.data(from: parts.url!)
        guard let http = response as? HTTPURLResponse,
              http.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(Forecast.self, from: data).current
    }
}`;

const WEATHER_MODEL = `${WEATHER_CLIENT}
import Observation
enum LoadState {
    case idle
    case loading
    case loaded(CurrentWeather)
    case failed(String)
}
@MainActor
@Observable
final class WeatherModel {
    private(set) var state = LoadState.idle
    private let client = WeatherClient()
    func load(latitude: Double, longitude: Double) async {
        state = .loading
        do {
            state = .loaded(try await client.current(
                latitude: latitude, longitude: longitude))
        } catch {
            state = .failed("Could not load the weather.")
        }
    }
}`;

const urlsession = {
  id: 'networking-urlsession',
  title: 'URLSession with async/await',
  steps: [
    {
      kind: 'concept',
      title: 'Meet URLSession',
      body: `<p><code>URLSession</code> is the networking engine built into every Apple platform. It manages connections, follows redirects, stores cookies, caches responses, negotiates HTTP versions and does all of the waiting off the main thread. You describe <em>what</em> you want; it handles <em>how</em>.</p><p>Its main methods are <code>async</code>: you <code>await</code> them and receive the result as a return value, or a thrown error.</p>`,
      points: [
        { term: 'URLSession.shared', text: 'A ready-made session with default settings, fine for most simple requests.' },
        { term: 'data(from:) and data(for:)', text: 'Fetch a URL or send a URLRequest; returns the body as Data plus the URLResponse.' },
        { term: 'upload and download', text: 'upload(for:from:) sends a body; download(from:) saves a large file to disk.' },
        { term: 'bytes(for:)', text: 'Delivers the body as it arrives instead of waiting for all of it.' },
        { term: 'URLSessionConfiguration', text: 'Builds custom sessions: timeouts, caching, cellular rules, extra headers.' },
      ],
      callout: { tone: 'history', title: 'Before async/await', html: `<p>Older code passes a <em>completion handler</em> closure to <code>dataTask(with:)</code> and then calls <code>resume()</code>. You will meet it in existing projects; the async methods replace it.</p>` },
    },
    {
      kind: 'code',
      title: 'Your first real fetch',
      intro: `<p>Four phases appear in nearly every network call: build the URL, await the response, check the status code, decode the body. This function fetches one to-do from JSONPlaceholder using the <code>Todo</code> struct from the JSON lesson. It is <code>async throws</code>: callers must <code>await</code> it, and every failure (offline, a bad status, unexpected JSON) arrives as a thrown error.</p>`,
      run: 'static',
      context: TODO_CONTEXT,
      lines: [
        [R`import Foundation`, n(
          'The Swift compiler.',
          'Imports URLSession, URL, HTTPURLResponse and JSONDecoder.',
          'Top of the file.',
          'At compile time.',
          'All four phases use Foundation types.')],
        ['', null],
        [R`enum APIError: Error {`, n(
          'Your code.',
          'Declares the app\'s own error type for problems URLSession does not report.',
          'A top-level enum.',
          'A value is created only when a bad status arrives.',
          'Conforming to Error lets you throw it; an enum lists every failure your API layer can produce.')],
        [R`    case badStatus(Int)`, n(
          'Your enum.',
          'One case that carries the status code that was received.',
          'Inside APIError.',
          'Created when the status check fails.',
          'Keeping the code lets callers react differently to 401 and 503.')],
        ['}', null],
        ['', null],
        [R`func fetchTodo(id: Int) async throws -> Todo {`, n(
          'Your code; a model or view awaits it.',
          'Declares an asynchronous, throwing function that returns a decoded Todo.',
          'A top-level function.',
          'Whenever a caller awaits it.',
          'async allows suspension while waiting; throws lets every failure reach the caller with full detail.')],
        [R`    let base = URL(string: "https://jsonplaceholder.typicode.com")!`, n(
          'Foundation.',
          'Phase one: creates the API\'s base URL.',
          'A local constant.',
          'Each call.',
          'A literal you control can be force-unwrapped safely; it would fail on the very first test run if it were wrong.')],
        [R`    let url = base.appending(path: "todos/\(id)")`, n(
          'Foundation\'s URL API.',
          'Adds the resource path, for example /todos/1.',
          'A local constant.',
          'Each call.',
          'The id is an Int, so it cannot inject unexpected characters into the path.')],
        [R`    let (data, response) =`, n(
          'Your code.',
          'Declares two constants that receive the tuple returned on the next line.',
          'Local constants.',
          'Assigned when the network replies.',
          'Destructuring a tuple names both results at once.')],
        [R`        try await URLSession.shared.data(from: url)`, n(
          'URLSession performs the whole request on its own threads.',
          'Phase two: sends a GET request and suspends until the full body arrives.',
          'Called from fetchTodo; the caller\'s thread is freed while waiting.',
          'Execution resumes here after the reply, or jumps out with a thrown URLError.',
          'try handles transport failures; await marks the point where this function pauses without blocking anything.')],
        [R`    guard let http = response as? HTTPURLResponse else {`, n(
          'Swift type casting.',
          'Checks that the response really is an HTTP response and unwraps it.',
          'Inside fetchTodo.',
          'Right after the reply arrives.',
          'data(from:) returns the general URLResponse type; statusCode exists only on its HTTP subclass.')],
        [R`        throw URLError(.badServerResponse)`, n(
          'Your code, reusing a Foundation error.',
          'Fails with a standard error if the cast did not succeed.',
          'Inside the guard\'s else branch, which must leave the function.',
          'Practically never for https URLs, but the compiler requires a plan.',
          'Reusing URLError keeps error handling uniform for callers.')],
        ['    }', null],
        [R`    guard (200..<300).contains(http.statusCode) else {`, n(
          'Your code.',
          'Phase three: accepts only 2xx status codes.',
          'Inside fetchTodo.',
          'After the cast succeeds.',
          'URLSession does not throw for 404 or 500; without this line an error page would be passed to the decoder.')],
        [R`        throw APIError.badStatus(http.statusCode)`, n(
          'Your code.',
          'Throws your own error carrying the real status code.',
          'The else branch of the status guard.',
          'Whenever the server answers with 4xx or 5xx.',
          'The caller learns what actually happened instead of a confusing decoding error.')],
        ['    }', null],
        [R`    return try JSONDecoder().decode(Todo.self, from: data)`, n(
          'JSONDecoder.',
          'Phase four: decodes the body into a Todo and returns it.',
          'The last line of fetchTodo.',
          'Only after the status check passed.',
          'A decoding failure is thrown too, so the caller handles every problem in one catch.')],
        ['}', null],
      ],
      try: [
        'Which line would you change to accept only 200 and nothing else in the 2xx family?',
        'List the three kinds of errors a caller of fetchTodo could receive.',
      ],
    },
    {
      kind: 'code',
      title: 'A small API client',
      intro: `<p>Instead of scattering URLs across your views, gather one API's calls in one type. <code>WeatherClient</code> knows Open-Meteo's address and query items and returns a typed <code>CurrentWeather</code> (the CodingKeys model from the JSON lesson, wrapped in a <code>Forecast</code>). Views never see URLs or JSON. The session is a stored property, so a test can pass in a differently configured one.</p>`,
      run: 'static',
      context: WEATHER_MODELS,
      lines: [
        [R`import Foundation`, n(
          'The Swift compiler.',
          'Imports the networking and JSON types.',
          'Top of the file.',
          'At compile time.',
          'The client is pure Foundation; it does not need SwiftUI.')],
        ['', null],
        [R`struct WeatherClient: Sendable {`, n(
          'Your code.',
          'Declares the client as a value type that is safe to share between concurrent tasks.',
          'A top-level struct.',
          'Created by whichever model needs weather.',
          'Sendable lets Swift 6 prove it can be used from the main actor and from background tasks without data races.')],
        [R`    var session = URLSession.shared`, n(
          'Your struct stores a URLSession.',
          'Uses the shared session unless someone passes another.',
          'A stored property with a default value.',
          'Set when the client is created.',
          'Making the session injectable lets you supply a session with caching or short timeouts later.')],
        [R`    func current(latitude: Double,`, n(
          'Your code.',
          'Begins a method that returns the weather at a coordinate.',
          'Inside WeatherClient; the signature continues on the next line.',
          'Whenever a caller awaits it.',
          'Labels make the call site read clearly: current(latitude:longitude:).')],
        [R`                 longitude: Double) async throws -> CurrentWeather {`, n(
          'Your code.',
          'Finishes the signature: asynchronous, throwing, returning a CurrentWeather.',
          'Part of the method declaration.',
          'Compile time.',
          'Returning a domain type instead of Data keeps JSON details inside the client.')],
        [R`        var parts = URLComponents(`, n(
          'Foundation.',
          'Starts building the request URL from a base string.',
          'A local variable inside current.',
          'Each call.',
          'URLComponents encodes query values correctly.')],
        [R`            string: "https://api.open-meteo.com/v1/forecast")!`, n(
          'URLComponents parses the base address.',
          'Supplies the forecast endpoint and force-unwraps the result.',
          'The argument of the call on the previous line.',
          'Each call.',
          'The string is a constant you control, so a failure here would be a programming error found immediately.')],
        [R`        parts.queryItems = [`, n(
          'Your code.',
          'Starts the list of query items.',
          'On the URLComponents value.',
          'Each call.',
          'Each option is a separate item the API documents.')],
        [R`            URLQueryItem(name: "latitude", value: "\(latitude)"),`, n(
          'Your code.',
          'Adds the latitude, converted to text with interpolation.',
          'The first query item.',
          'Each call.',
          'Query values are always strings in a URL.')],
        [R`            URLQueryItem(name: "longitude", value: "\(longitude)"),`, n(
          'Your code.',
          'Adds the longitude.',
          'The second query item.',
          'Each call.',
          'Together the two values identify the place to forecast.')],
        [R`            URLQueryItem(name: "current",`, n(
          'Your code.',
          'Starts the item that lists which current measurements to return.',
          'The third query item; its value is on the next line.',
          'Each call.',
          'Open-Meteo returns only the variables you name, keeping the response small.')],
        [R`                         value: "temperature_2m,wind_speed_10m")`, n(
          'Your code.',
          'Asks for temperature and wind speed, separated by a comma.',
          'Value of the third item.',
          'Each call.',
          'The comma is legal in a query value, so URLComponents leaves it as is.')],
        ['        ]', null],
        [R`        let (data, response) = try await session.data(from: parts.url!)`, n(
          'URLSession.',
          'Sends the request and suspends until the reply arrives.',
          'Inside current; the network work runs on URLSession\'s threads.',
          'Resumes when the body has fully arrived or an error is thrown.',
          'Using the stored session rather than URLSession.shared respects whatever session the creator injected.')],
        [R`        guard let http = response as? HTTPURLResponse,`, n(
          'Swift type casting.',
          'Unwraps the response as an HTTP response.',
          'Inside current; the guard continues on the next line.',
          'After the reply.',
          'You need HTTPURLResponse to read the status code.')],
        [R`              http.statusCode == 200 else {`, n(
          'Your code.',
          'Requires exactly 200 OK, the only success this endpoint returns.',
          'Second condition of the same guard.',
          'After the cast succeeds.',
          'Open-Meteo answers 400 with an error message for impossible coordinates; this rejects it.')],
        [R`            throw URLError(.badServerResponse)`, n(
          'Your code.',
          'Fails with a standard error when either condition is false.',
          'The guard\'s else branch.',
          'Only on a bad reply.',
          'Callers handle it exactly like a transport error.')],
        ['        }', null],
        [R`        return try JSONDecoder()`, n(
          'Foundation.',
          'Creates a decoder and begins the return statement; the call continues on the next line.',
          'The last statement of current.',
          'After the status check passed.',
          'A fresh JSONDecoder is cheap, and its default settings suit this API.')],
        [R`            .decode(Forecast.self, from: data).current`, n(
          'JSONDecoder.',
          'Decodes the outer Forecast object and returns only its current part.',
          'Chained onto the decoder from the line above.',
          'After the status check passed.',
          'The nested wrapper is an implementation detail callers never see.')],
        ['    }', null],
        ['}', null],
      ],
      try: [
        'Add a third measurement, relative_humidity_2m, to the request. Which two places must change?',
      ],
    },
    {
      kind: 'widget',
      title: 'Watch a request happen',
      intro: `<p>Pick a city and fetch its current weather from Open-Meteo, for real. The Swift code beside it is the client and model from this lesson. Each line lights up as the matching phase actually happens in this page: building the URL, waiting for the network, checking the status, decoding, updating the screen state. The timings are measured, not invented. Fetch the same city twice and compare, then try an invalid coordinate.</p>`,
      widget: 'networking-weather-live',
      props: { mode: 'full' },
    },
    {
      kind: 'code',
      title: 'Loading state as an enum',
      intro: `<p>A screen that loads data is always in one of a few states. An enum with associated values makes them explicit, so the view can never show a spinner and stale data at the same time by mistake. <code>@Observable</code> lets SwiftUI watch <code>state</code>; <code>@MainActor</code> keeps every change on the main thread, where interface updates belong.</p>`,
      run: 'static',
      context: WEATHER_CLIENT,
      lines: [
        [R`import Observation`, n(
          'The Swift compiler.',
          'Imports the @Observable macro.',
          'Top of the file.',
          'At compile time.',
          'This file holds no views, so it imports Observation directly instead of all of SwiftUI.')],
        ['', null],
        [R`enum LoadState {`, n(
          'Your code.',
          'Declares every state the weather screen can be in.',
          'A top-level enum.',
          'A value exists for as long as the model does.',
          'An enum makes impossible combinations, such as loading and failed at once, unrepresentable.')],
        [R`    case idle`, n(
          'Your enum.',
          'Nothing has been requested yet.',
          'Inside LoadState.',
          'Before the first load.',
          'Distinguishing idle from loading lets a screen show a prompt instead of a spinner.')],
        [R`    case loading`, n(
          'Your enum.',
          'A request is in flight.',
          'Inside LoadState.',
          'From the start of a load until it finishes.',
          'The view shows progress during this state.')],
        [R`    case loaded(CurrentWeather)`, n(
          'Your enum.',
          'Success, carrying the weather as an associated value.',
          'Inside LoadState.',
          'After a successful load.',
          'The data travels with the state, so there is no separate optional property that might be stale.')],
        [R`    case failed(String)`, n(
          'Your enum.',
          'Failure, carrying a message for the user.',
          'Inside LoadState.',
          'After any thrown error.',
          'The view can show the message and a retry button.')],
        ['}', null],
        ['', null],
        [R`@MainActor`, n(
          'The Swift compiler enforces it.',
          'Isolates the whole class to the main actor, meaning the main thread.',
          'Applies to every property and method of WeatherModel.',
          'Checked at compile time; enforced at run time by switching to the main thread.',
          'SwiftUI reads state on the main thread, so all writes must happen there too; Swift 6 turns violations into compile errors.')],
        [R`@Observable`, n(
          'The Observation macro, expanded by the compiler.',
          'Makes SwiftUI track reads of this class\'s properties.',
          'Applies to the class below.',
          'Expanded at compile time; tracking happens whenever a view\'s body runs.',
          'When state changes, only the views that read it are redrawn.')],
        [R`final class WeatherModel {`, n(
          'Your code.',
          'Declares the model that owns the screen\'s state and loading logic.',
          'A reference type on the heap, shared by the view that owns it.',
          'Created once when the view first appears.',
          'A class gives the view one stable object whose state can change over time.')],
        [R`    private(set) var state = LoadState.idle`, n(
          'Your model.',
          'Stores the current state, starting at idle.',
          'A stored property, observed by SwiftUI.',
          'Read every time the view\'s body runs; written during load.',
          'private(set) lets views read state but only the model change it.')],
        [R`    private let client = WeatherClient()`, n(
          'Your model.',
          'Holds the API client from the previous step.',
          'A private stored property.',
          'Created with the model.',
          'The model talks to the client; the view never does.')],
        [R`    func load(latitude: Double, longitude: Double) async {`, n(
          'Your model; the view calls it.',
          'Declares the loading method. It does not throw: it turns errors into state.',
          'A main-actor method.',
          'When the view appears, or when the user taps Try Again.',
          'Moving error handling into the model keeps the view free of do/catch.')],
        [R`        state = .loading`, n(
          'Your model.',
          'Switches to the loading state.',
          'On the main actor.',
          'Immediately, before any network work.',
          'The view redraws with a spinner right away, so the tap feels responsive.')],
        [R`        do {`, n(
          'Swift error handling.',
          'Starts the block that may throw.',
          'Inside load.',
          'Each load.',
          'Every failure path ends in the catch below.')],
        [R`            state = .loaded(try await client.current(`, n(
          'Your model awaits the client.',
          'Suspends until the weather arrives, then stores it inside the loaded case.',
          'On the main actor; the network work itself runs elsewhere.',
          'Resumes on the main actor after the reply.',
          'While suspended, the main thread is free to draw the spinner.')],
        [R`                latitude: latitude, longitude: longitude))`, n(
          'Your model.',
          'Passes the coordinates through to the client.',
          'Arguments of the call on the previous line.',
          'Each load.',
          'The model decides what to load; the client decides how.')],
        [R`        } catch {`, n(
          'Swift error handling.',
          'Catches any error: offline, timeout, bad status or bad JSON.',
          'Inside load.',
          'Only when something failed.',
          'One catch covers every failure the client can throw.')],
        [R`            state = .failed("Could not load the weather.")`, n(
          'Your model.',
          'Stores a friendly failure message.',
          'On the main actor.',
          'After an error.',
          'Users need a plain sentence and a way to retry, not an error code.')],
        ['        }', null],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'code',
      title: 'Calling it from SwiftUI with .task',
      intro: `<p>The view owns the model with <code>@State</code> and switches over its state. <code>.task</code> starts the load when the view appears and cancels it automatically if the view disappears first, so you never fetch for a screen nobody sees. The panel runs the same flow against the live API.</p>`,
      run: 'static',
      context: WEATHER_MODEL,
      simulate: { widget: 'networking-weather-live', props: { mode: 'phone' } },
      lines: [
        [R`import SwiftUI`, n(
          'The Swift compiler.',
          'Imports SwiftUI, which also re-exports Observation.',
          'Top of the file.',
          'At compile time.',
          'Views need SwiftUI.')],
        [R`struct WeatherView: View {`, n(
          'Your code; SwiftUI renders it.',
          'Declares the weather screen.',
          'A struct describing interface, recreated often.',
          'Whenever SwiftUI needs a fresh description.',
          'Views are cheap values; the model is where long-lived state lives.')],
        [R`    @State private var model = WeatherModel()`, n(
          'SwiftUI stores the model for the view\'s lifetime.',
          'Creates the model once and keeps it across body recomputations.',
          'Stored by SwiftUI outside the struct.',
          'Created when the view first appears.',
          '@State with an @Observable class is the modern way for a view to own its model.')],
        ['', null],
        [R`    var body: some View {`, n(
          'SwiftUI calls it.',
          'Describes what to show for the current state.',
          'A computed property of the view.',
          'Every time model.state changes.',
          'body must be fast and free of side effects; loading happens in .task, not here.')],
        [R`        VStack(spacing: 12) {`, n(
          'SwiftUI.',
          'Stacks the content vertically.',
          'The root of body.',
          'Each body evaluation.',
          'The stack is the view the .task modifier attaches to.')],
        [R`            switch model.state {`, n(
          'Your code; Observation records this read.',
          'Chooses content based on the current state.',
          'Inside the VStack builder.',
          'Each body evaluation.',
          'switch must cover every case, so adding a state later forces you to design its screen.')],
        [R`            case .idle, .loading:`, n(
          'Swift pattern matching.',
          'Handles both the not-started and in-progress states.',
          'Inside the switch.',
          'Before data arrives.',
          'Both look the same to the user here, so one case lists both.')],
        [R`                ProgressView("Loading weather")`, n(
          'SwiftUI.',
          'Shows a spinner with a label.',
          'Inside the first case.',
          'While loading.',
          'A label tells VoiceOver users what is happening.')],
        [R`            case .loaded(let now):`, n(
          'Swift pattern matching.',
          'Matches success and binds the associated weather value.',
          'Inside the switch.',
          'After a successful load.',
          'The data is available only in this branch, so it can never be shown in the wrong state.')],
        [R`                Text("\(now.temperature, specifier: "%.1f") °C")`, n(
          'SwiftUI.',
          'Shows the temperature with one decimal place.',
          'Inside the loaded case.',
          'After success.',
          'The specifier formats the Double inside Text without extra code.')],
        [R`            case .failed(let message):`, n(
          'Swift pattern matching.',
          'Matches failure and binds the message.',
          'Inside the switch.',
          'After an error.',
          'Failure is a first-class screen state, not an afterthought.')],
        [R`                Text(message)`, n(
          'SwiftUI.',
          'Shows the friendly error message.',
          'Inside the failed case.',
          'After an error.',
          'The model wrote the message; the view only displays it.')],
        [R`                Button("Try Again") { Task { await load() } }`, n(
          'SwiftUI runs the action when the user taps.',
          'Starts a new task that reloads.',
          'Inside the failed case.',
          'When the user taps the button.',
          'A Button action is synchronous, so Task { } is needed to call async code.')],
        ['            }', null],
        ['        }', null],
        [R`        .task { await load() }`, n(
          'SwiftUI manages this task\'s lifetime.',
          'Starts loading when the view appears.',
          'A modifier on the VStack.',
          'Once when the view appears; cancelled automatically if it disappears first.',
          'Tying work to the view\'s lifetime prevents updates for screens that are gone.')],
        ['    }', null],
        ['', null],
        [R`    private func load() async {`, n(
          'Your view.',
          'Wraps the model call with this screen\'s coordinates.',
          'A private helper method of the view.',
          'Called from .task and from the Try Again button.',
          'Both callers share one place that knows the coordinates.')],
        [R`        await model.load(latitude: 35.68, longitude: 139.69)`, n(
          'Your model does the work.',
          'Loads the weather for Tokyo.',
          'On the main actor.',
          'Each time load runs.',
          'Real apps take the coordinate from user input or from location services.')],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>In what order does a typical fetch function work?</p>',
          choices: ['Decode, await the response, check the status, build the URL', 'Check the status, build the URL, decode, await the response', 'Build the URL, await the response, check the status, decode', 'Await the response, build the URL, decode, check the status'],
          answer: 2,
          explain: '<p>You need a URL before you can send anything, a response before you can check it, and a successful status before decoding makes sense. Decoding before checking the status feeds error pages to the decoder.</p>',
        },
        {
          q: '<p>The user leaves a screen before its <code>.task</code> load finishes. What happens to the work?</p>',
          choices: ['It keeps running and later updates a view that no longer exists', 'SwiftUI cancels the task, and the pending await throws a cancellation error', 'The app crashes', 'It pauses until the user returns'],
          answer: 1,
          explain: '<p>.task is tied to the view\'s lifetime. Cancellation makes URLSession stop the request and throw, which is why your code should treat cancellation as quiet, not as a failure to show.</p>',
        },
        {
          q: '<p>Why is <code>WeatherModel</code> marked <code>@MainActor</code>?</p>',
          choices: ['So changes to state, which drive the interface, always happen on the main thread', 'So the network request itself runs on the main thread', 'Because @Observable does not work without it', 'To make the request faster'],
          answer: 0,
          explain: '<p>The request still runs on URLSession\'s own threads; await simply suspends the model without blocking. The attribute guarantees that every write to state happens on the main thread. @Observable works without it.</p>',
        },
        {
          q: '<p>What is wrong with this code? <code>let (data, _) = try await URLSession.shared.data(from: url)</code> followed by <code>return try JSONDecoder().decode(User.self, from: data)</code></p>',
          choices: ['data(from:) must not be awaited', 'JSONDecoder cannot decode Data', 'The tuple is in the wrong order', 'It never checks the status code, so a 500 error page is decoded and the real cause is hidden'],
          answer: 3,
          explain: '<p>Discarding the response skips the status check. When the server fails, the decoder receives an error body and throws a misleading DecodingError instead of a clear "server error 500".</p>',
        },
      ],
    },
  ],
};

const errorsSecurity = {
  id: 'networking-errors-security',
  title: 'Errors, Retries and Security',
  steps: [
    {
      kind: 'concept',
      title: 'Everything that can go wrong',
      body: `<p>On a phone, failure is normal: elevators, tunnels, crowded stadiums, airplane mode. Each kind of failure deserves a different response, so your code has to tell them apart.</p>`,
      points: [
        { term: 'No connection', text: 'URLError .notConnectedToInternet or .networkConnectionLost. Show saved data if you have it, plus a calm offline message.' },
        { term: 'Timeout or unreachable', text: '.timedOut (no data within the timeout, 60 seconds by default), .cannotFindHost (the DNS lookup failed) or .cannotConnectToHost. Often temporary.' },
        { term: 'Bad status', text: 'A reply arrived with 4xx or 5xx. URLSession does not throw; your status check does.' },
        { term: 'Bad data', text: 'DecodingError: the JSON does not match your model. Retrying will not help, so report it.' },
        { term: 'Cancelled', text: 'URLError .cancelled or CancellationError: your own code stopped the work. Show nothing.' },
      ],
      callout: { tone: 'design', title: 'Write messages for people', html: `<p>"The operation couldn't be completed (NSURLErrorDomain error -1009)" means nothing to a user. "You appear to be offline. Showing saved results." tells them what happened and what they still have.</p>` },
    },
    {
      kind: 'code',
      title: 'Turn errors into messages',
      intro: `<p>One function translates any error into a sentence a person can act on, or <code>nil</code> when nothing should be shown at all. Casting with <code>as?</code> checks whether the error is a <code>URLError</code>, whose <code>code</code> says what failed. Keeping this in one place means every screen speaks the same language.</p>`,
      run: 'static',
      lines: [
        [R`import Foundation`, n(
          'The Swift compiler.',
          'Imports URLError and DecodingError.',
          'Top of the file.',
          'At compile time.',
          'Both error types are Foundation types.')],
        ['', null],
        [R`func userMessage(for error: any Error) -> String? {`, n(
          'Your code; every screen\'s catch block can call it.',
          'Declares a function that maps any error to an optional message.',
          'A top-level function, often placed in the networking layer.',
          'After a request fails.',
          'Returning nil gives callers a clear signal to show nothing.')],
        [R`    if error is CancellationError { return nil }`, n(
          'Swift concurrency produces this error.',
          'Returns nil when a Swift task was cancelled.',
          'First check inside the function.',
          'When .task or Task.cancel() stopped the work.',
          'Cancellation is the app\'s own decision, so there is nothing to tell the user.')],
        [R`    if let urlError = error as? URLError {`, n(
          'Swift type casting.',
          'Checks whether the error came from URLSession and unwraps it.',
          'Inside the function.',
          'For transport-level failures.',
          'URLError carries a precise code for each network problem.')],
        [R`        switch urlError.code {`, n(
          'Your code.',
          'Branches on the specific network failure.',
          'Inside the if let.',
          'For every URLError.',
          'A switch keeps all network cases visible in one place.')],
        [R`        case .cancelled:`, n(
          'Pattern matching.',
          'Matches URLSession\'s own cancellation code.',
          'Inside the switch.',
          'When a URLSession task was cancelled, for example because its Swift task was.',
          'URLSession reports cancellation as URLError, not CancellationError, so both checks are needed.')],
        [R`            return nil`, n(
          'Your code.',
          'Shows nothing for cancellation.',
          'Inside the cancelled case.',
          'After cancellation.',
          'Consistent with the CancellationError check above.')],
        [R`        case .notConnectedToInternet, .networkConnectionLost:`, n(
          'Pattern matching.',
          'Matches both flavors of "no connection".',
          'Inside the switch.',
          'In airplane mode, or when the signal drops mid-request.',
          'Users experience both the same way, so they share one message.')],
        [R`            return "You appear to be offline."`, n(
          'Your code.',
          'Returns the offline message.',
          'Inside that case.',
          'When there is no connection.',
          'It says what happened without blame or jargon.')],
        [R`        case .timedOut:`, n(
          'Pattern matching.',
          'Matches a request that waited too long for data.',
          'Inside the switch.',
          'After the request\'s timeout interval passed.',
          'A timeout suggests a slow network or server, which a retry may fix.')],
        [R`            return "The server took too long to answer."`, n(
          'Your code.',
          'Returns the timeout message.',
          'Inside that case.',
          'After a timeout.',
          'It hints that trying again later is reasonable.')],
        [R`        case .cannotFindHost, .cannotConnectToHost:`, n(
          'Pattern matching.',
          'Matches DNS failure and refused connections.',
          'Inside the switch.',
          'When the server\'s name or address does not answer.',
          'These usually mean the server side is down or unreachable.')],
        [R`            return "The server cannot be reached right now."`, n(
          'Your code.',
          'Returns the unreachable message.',
          'Inside that case.',
          'When the host is unreachable.',
          '"Right now" signals the problem is probably temporary.')],
        [R`        default:`, n(
          'Pattern matching.',
          'Catches every other URLError code.',
          'The last case of the switch.',
          'For rarer problems such as an untrusted certificate.',
          'URLError has dozens of codes; default keeps the function complete.')],
        [R`            return "A network problem stopped the request."`, n(
          'Your code.',
          'Returns a general network message.',
          'Inside default.',
          'For any other network failure.',
          'Still more helpful than a raw error code.')],
        ['        }', null],
        ['    }', null],
        [R`    if error is DecodingError {`, n(
          'Swift type checking.',
          'Checks for a JSON mismatch.',
          'After the URLError branch.',
          'When the reply did not match the model.',
          'This is usually a bug or an API change, not a user problem.')],
        [R`        return "The server sent data this app cannot read."`, n(
          'Your code.',
          'Returns the bad-data message.',
          'Inside the if.',
          'After a DecodingError.',
          'Honest wording; a real app would also log the error for its developers.')],
        ['    }', null],
        [R`    return "Something went wrong. Please try again."`, n(
          'Your code.',
          'Returns a fallback for any other error.',
          'The last line of the function.',
          'For errors not matched above, such as your own APIError.',
          'Every error gets some message; none falls through silently.')],
        ['}', null],
      ],
    },
    {
      kind: 'code',
      title: 'Retry with exponential backoff',
      intro: `<p>Temporary failures such as timeouts and 503 often succeed a moment later. <strong>Exponential backoff</strong> waits longer after each failure (200, 400, 800 ms), giving a struggling server room to recover. Production code also adds random <strong>jitter</strong> so thousands of phones do not retry in lockstep. Retry only idempotent requests. Here an actor plays a server that fails twice.</p>`,
      run: 'swift',
      lines: [
        [R`enum FetchError: Error { case timedOut }`, n(
          'Your code.',
          'Declares a stand-in for a network timeout.',
          'A top-level enum.',
          'Thrown by the fake server below.',
          'A tiny custom error keeps the example runnable without a network.')],
        [R`actor FlakyServer {`, n(
          'Swift concurrency.',
          'Declares an actor: a type whose state only one task can touch at a time.',
          'A reference type on the heap.',
          'One instance is created near the bottom.',
          'It counts calls safely even if many tasks call it concurrently.')],
        [R`    private var calls = 0`, n(
          'The actor.',
          'Counts how many times fetch has been called.',
          'Isolated inside the actor.',
          'Incremented on each call.',
          'Mutable state in an actor is protected from data races automatically.')],
        [R`    func fetch() throws -> String {`, n(
          'The actor.',
          'Declares the fake request.',
          'A method of FlakyServer.',
          'Each attempt.',
          'Callers outside the actor must await it, which the retry closure does.')],
        [R`        calls += 1`, n(
          'The actor.',
          'Records one more attempt.',
          'Inside fetch.',
          'At the start of each call.',
          'The count decides when the server recovers.')],
        [R`        if calls < 3 { throw FetchError.timedOut }`, n(
          'The actor.',
          'Fails on the first two calls.',
          'Inside fetch.',
          'Calls 1 and 2.',
          'This simulates a server that is briefly overloaded.')],
        [R`        return "200 OK on call \(calls)"`, n(
          'The actor.',
          'Succeeds from the third call on.',
          'Inside fetch.',
          'On the third call and every call after it.',
          'The message shows how many attempts it took.')],
        ['    }', null],
        ['}', null],
        ['', null],
        [R`func withRetry<T>(attempts: Int,`, n(
          'Your code.',
          'Declares a generic retry helper that works for any result type T.',
          'A top-level generic function.',
          'Whenever an operation should be retried.',
          'Generics let one helper wrap any request, whatever it returns.')],
        [R`                  _ operation: () async throws -> T) async throws -> T {`, n(
          'Your code.',
          'Takes the work as an async throwing closure and returns its result.',
          'The rest of the signature.',
          'Compile time.',
          'Passing the work as a closure means the helper can run it again.')],
        [R`    var delay = 200`, n(
          'Your helper.',
          'Sets the first wait, in milliseconds.',
          'A local variable.',
          'Once per withRetry call.',
          'Starting small keeps the first retry quick.')],
        [R`    for attempt in 1..<attempts {`, n(
          'Your helper.',
          'Loops over every attempt except the last.',
          'Inside withRetry.',
          'Up to attempts minus one times.',
          'The final attempt happens after the loop, so its error can escape to the caller.')],
        [R`        do { return try await operation() } catch {`, n(
          'Your helper.',
          'Tries the operation; on success returns at once, on failure falls into catch.',
          'Inside the loop.',
          'Each attempt.',
          'An early return ends the loop the moment anything succeeds.')],
        [R`            print("Attempt \(attempt) failed; retry in \(delay) ms")`, n(
          'Your helper.',
          'Logs the failure and the upcoming wait.',
          'Inside catch.',
          'After each failure.',
          'Logging retries makes flaky networks visible during testing.')],
        [R`            try await Task.sleep(for: .milliseconds(delay))`, n(
          'Swift concurrency\'s clock.',
          'Suspends this task without blocking any thread.',
          'Inside catch.',
          'Between attempts.',
          'Task.sleep throws if the task is cancelled, so a retry loop never outlives its screen.')],
        [R`            delay *= 2`, n(
          'Your helper.',
          'Doubles the wait for next time: 200, 400, 800.',
          'Inside catch.',
          'After each sleep.',
          'Doubling is the exponential part of exponential backoff.')],
        ['        }', null],
        ['    }', null],
        [R`    return try await operation()`, n(
          'Your helper.',
          'Makes the final attempt; if it throws, the error goes to the caller.',
          'After the loop.',
          'Only if every earlier attempt failed.',
          'Giving up eventually is essential; retrying forever drains battery and hammers the server.')],
        ['}', null],
        [R`let server = FlakyServer()`, n(
          'Your code.',
          'Creates the fake server.',
          'A global constant.',
          'At program start.',
          'One shared instance, so the call count persists across attempts.')],
        [R`print(try await withRetry(attempts: 4) { try await server.fetch() })`, n(
          'Your code.',
          'Retries the fetch up to four times and prints the result.',
          'Top-level script code.',
          'At program start.',
          'The trailing closure is the operation; await is needed because fetch is isolated to the actor.')],
      ],
      expect: 'Attempt 1 failed; retry in 200 ms\nAttempt 2 failed; retry in 400 ms\n200 OK on call 3',
      try: [
        'Change calls < 3 to calls < 5. What happens with attempts: 4?',
        'How would you add jitter so each phone waits a random time between 0 and delay?',
      ],
    },
    {
      kind: 'widget',
      title: 'Retry lab',
      intro: `<p>Two hundred simulated phones hit a server the moment it recovers from an outage. Compare no retries, immediate retries, exponential backoff and backoff with jitter. Watch the load against the server's capacity, how many users succeed and how many requests were wasted. Then trigger real failures from this page: a request that times out and a server that answers 503.</p>`,
      widget: 'networking-retry-lab',
      props: {},
    },
    {
      kind: 'code',
      title: 'Cancel work nobody needs',
      intro: `<p>Search-as-you-type would send a request per keystroke unless stale ones are cancelled. <code>.task(id:)</code> restarts its task whenever the id changes and cancels the previous one. A short sleep at the start acts as a <strong>debounce</strong>: if another key arrives within 300 ms, the sleeping task is cancelled before it ever touches the network.</p>`,
      run: 'static',
      context: `struct SearchClient: Sendable {
    func search(_ text: String) async throws -> [String] { [] }
}`,
      lines: [
        [R`import SwiftUI`, n(
          'The Swift compiler.',
          'Imports SwiftUI.',
          'Top of the file.',
          'At compile time.',
          'The view, List and .task all come from SwiftUI.')],
        ['', null],
        [R`struct SearchView: View {`, n(
          'Your code.',
          'Declares a searchable list screen.',
          'A view struct.',
          'Rendered while the screen is visible.',
          'All the cancellation logic fits inside one modifier.')],
        [R`    @State private var query = ""`, n(
          'SwiftUI stores it.',
          'Holds the text in the search field.',
          'View state owned by SwiftUI.',
          'Updated on every keystroke.',
          'Its value doubles as the task id below.')],
        [R`    @State private var results: [String] = []`, n(
          'SwiftUI stores it.',
          'Holds the latest search results.',
          'View state.',
          'Replaced after each completed search.',
          'An empty array is a sensible starting value.')],
        [R`    let client = SearchClient()`, n(
          'Your view.',
          'Holds a client that performs the network search.',
          'A stored constant of the view.',
          'Created with the view.',
          'The client is a Sendable struct, so it is cheap to keep in a view.')],
        ['', null],
        [R`    var body: some View {`, n(
          'SwiftUI.',
          'Describes the screen.',
          'Computed property.',
          'Each time query or results change.',
          'No network calls here; they live in .task.')],
        [R`        List(results, id: \.self) { Text($0) }`, n(
          'SwiftUI.',
          'Shows one row per result string.',
          'The root view of body.',
          'Each body evaluation.',
          'id: \\.self identifies rows by their text.')],
        [R`            .searchable(text: $query)`, n(
          'SwiftUI.',
          'Adds a system search field bound to query.',
          'A modifier on the List.',
          'Writes query as the user types.',
          'The binding is how keystrokes reach state.')],
        [R`            .task(id: query) {`, n(
          'SwiftUI manages the task.',
          'Runs the closure now, and again whenever query changes, cancelling the previous run.',
          'A modifier on the List.',
          'On appear and after every keystroke.',
          'Automatic cancellation is exactly what search-as-you-type needs.')],
        [R`                do {`, n(
          'Swift error handling.',
          'Starts the work that may throw or be cancelled.',
          'Inside the task closure.',
          'Each run.',
          'Both sleeping and searching can throw.')],
        [R`                    try await Task.sleep(for: .milliseconds(300))`, n(
          'Swift concurrency.',
          'Waits 300 ms before searching.',
          'Inside do.',
          'At the start of each run.',
          'If another key arrives, this sleep throws CancellationError and the old search never starts.')],
        [R`                    results = try await client.search(query)`, n(
          'Your client, then SwiftUI state.',
          'Searches with the current text and stores the results.',
          'Inside do; the update happens on the main actor.',
          'Only if the user paused typing for 300 ms.',
          'A cancelled task\'s URLSession request is cancelled too, saving data and battery.')],
        [R`                } catch {`, n(
          'Swift error handling.',
          'Catches cancellation and real failures alike.',
          'Inside the task closure.',
          'When the sleep or the search throws.',
          'Both paths need different handling, decided on the next line.')],
        [R`                    if Task.isCancelled { return }`, n(
          'Swift concurrency.',
          'Leaves quietly when this run was cancelled.',
          'Inside catch.',
          'After the user typed again or left the screen.',
          'A newer run is already in charge; clearing results now would flash an empty list.')],
        [R`                    results = []`, n(
          'Your view.',
          'Clears the list after a genuine failure.',
          'Inside catch.',
          'Only for real errors.',
          'A real app would also show a message from userMessage(for:).')],
        ['                }', null],
        ['            }', null],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'concept',
      title: 'HTTPS, certificates and App Transport Security',
      body: `<p>TLS gives every HTTPS connection two guarantees. <strong>Encryption</strong>: nobody on the coffee-shop Wi-Fi can read or alter the traffic. <strong>Authentication</strong>: the server proves its identity with a <strong>certificate</strong>, a signed document that binds its domain name to a public key. The signature comes from a <strong>certificate authority</strong> (CA) that iOS already trusts. If the name does not match, the certificate has expired or the chain does not lead to a trusted CA, URLSession refuses to connect.</p>`,
      points: [
        { term: 'App Transport Security (ATS)', text: 'Since iOS 9, apps load only HTTPS URLs with modern TLS by default. A plain http:// request fails.' },
        { term: 'Exceptions', text: 'Info.plist keys under NSAppTransportSecurity can relax ATS for specific domains. Some require a justification during App Review; avoid them.' },
        { term: 'Certificate pinning', text: 'Accepting only a specific certificate or key for your own server, used by high-risk apps such as banking. It must be updated whenever the certificate changes.' },
      ],
    },
    {
      kind: 'concept',
      title: 'Never ship a secret in the app',
      body: `<p>Everything inside your app is on every user's phone, and an app binary can be copied and inspected. A string constant such as an API key survives compilation as readable bytes. Hiding it only slows an attacker down, because the app must eventually send the key over the network.</p>`,
      points: [
        { term: 'Keep keys on a server', text: 'Your app calls your own backend, which adds the secret key and calls the third-party API.' },
        { term: 'Per-user tokens', text: 'At sign-in your server issues a token for that user only, which can expire and be revoked.' },
        { term: 'Tokens go in the Keychain', text: 'The Keychain is the encrypted store iOS provides for small secrets. UserDefaults is a settings file that was never designed for secrets; never put tokens there.' },
      ],
      figure: { widget: 'networking-secret-leak', props: {} },
    },
    {
      kind: 'code',
      title: 'Read a token and authorize a request',
      intro: `<p>After sign-in, your app saves the user's token with <code>SecItemAdd</code>. Later, each request that needs it reads the token back and adds an <code>Authorization: Bearer</code> header. The Keychain has a C-style API: you describe the item you want with a dictionary of <code>kSec</code> keys and pass it to a function.</p>`,
      run: 'static',
      lines: [
        [R`import Foundation`, n(
          'The Swift compiler.',
          'Imports URLRequest and Data.',
          'Top of the file.',
          'At compile time.',
          'The second function builds on URLRequest.')],
        [R`import Security`, n(
          'The Swift compiler.',
          'Imports the Keychain functions and kSec constants.',
          'Top of the file.',
          'At compile time.',
          'The Keychain lives in the Security framework.')],
        ['', null],
        [R`func savedToken() -> String? {`, n(
          'Your code.',
          'Declares a function that returns the stored token, or nil if there is none.',
          'A top-level function, typically inside a TokenStore type.',
          'Before every authorized request.',
          'nil means "not signed in", which the caller can handle.')],
        [R`    let query: [String: Any] = [`, n(
          'Your code.',
          'Starts the dictionary that describes the item to find.',
          'A local constant.',
          'Each call.',
          'The Keychain API takes a dictionary of attributes rather than parameters.')],
        [R`        kSecClass as String: kSecClassGenericPassword,`, n(
          'The Security framework.',
          'Says the item is a generic password, the class used for tokens.',
          'First entry of the query.',
          'Each call.',
          'Items are grouped by class; this one fits any app-defined secret.')],
        [R`        kSecAttrAccount as String: "session-token",`, n(
          'Your code.',
          'Names the item by account, the same name used when it was saved.',
          'Second entry.',
          'Each call.',
          'The account string is how you find your item again.')],
        [R`        kSecReturnData as String: true`, n(
          'The Security framework.',
          'Asks for the stored bytes to be returned.',
          'Third entry.',
          'Each call.',
          'Without it, the call only reports whether the item exists.')],
        ['    ]', null],
        [R`    var result: AnyObject?`, n(
          'Your code.',
          'Prepares a slot for the Keychain to write the result into.',
          'A local variable.',
          'Each call.',
          'The C-style API returns data through a pointer argument.')],
        [R`    let status = SecItemCopyMatching(query as CFDictionary, &result)`, n(
          'iOS\'s Keychain service.',
          'Searches the Keychain and fills result if it finds the item.',
          'Runs in the Security framework on the device.',
          'Each call.',
          'The & passes result by reference; the returned status says whether it worked.')],
        [R`    guard status == errSecSuccess, let data = result as? Data else {`, n(
          'Your code.',
          'Continues only if the item was found and came back as Data.',
          'Inside savedToken.',
          'After the search.',
          'errSecItemNotFound simply means nobody has signed in yet.')],
        [R`        return nil`, n(
          'Your code.',
          'Reports that no token is available.',
          'The guard\'s else branch.',
          'When there is no item.',
          'The caller can then show the sign-in screen.')],
        ['    }', null],
        [R`    return String(decoding: data, as: UTF8.self)`, n(
          'Swift\'s String initializer.',
          'Converts the stored bytes back to text.',
          'The last line of savedToken.',
          'When a token was found.',
          'Tokens are saved as UTF-8 Data, so they decode the same way.')],
        ['}', null],
        [R`func authorized(_ request: URLRequest) -> URLRequest {`, n(
          'Your code; the API client calls it before sending.',
          'Returns a copy of a request with the token attached.',
          'A top-level function.',
          'Before each request to your own server.',
          'Centralizing this means no request accidentally goes out without the header.')],
        [R`    var request = request`, n(
          'Your code.',
          'Makes a mutable copy of the parameter.',
          'A local variable that shadows the parameter.',
          'Each call.',
          'Parameters are constants; URLRequest is a value type, so the copy is independent.')],
        [R`    if let token = savedToken() {`, n(
          'Your code.',
          'Reads the token and continues only if there is one.',
          'Inside authorized.',
          'Each call.',
          'Requests to public endpoints still work when nobody is signed in.')],
        [R`        request.setValue("Bearer \(token)",`, n(
          'URLRequest.',
          'Starts setting the header value: Bearer followed by the token.',
          'Inside the if let.',
          'When a token exists.',
          'Bearer is the standard scheme: whoever holds the token is let in.')],
        [R`                         forHTTPHeaderField: "Authorization")`, n(
          'URLRequest.',
          'Names the header: Authorization.',
          'Second line of the call.',
          'When a token exists.',
          'The token travels only over HTTPS, so it is encrypted in transit.')],
        ['    }', null],
        [R`    return request`, n(
          'Your code.',
          'Hands back the possibly authorized request.',
          'The last line.',
          'Each call.',
          'Returning a new value keeps the function free of side effects and easy to test.')],
        ['}', null],
      ],
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>Which of these errors should produce no message at all?</p>',
          choices: ['URLError(.timedOut)', 'URLError(.notConnectedToInternet)', 'URLError(.cancelled) after the user left the screen', 'DecodingError.keyNotFound'],
          answer: 2,
          explain: '<p>Cancellation is your own app stopping work nobody needs anymore. Telling the user about it would be noise. The others are real problems that deserve a clear message.</p>',
        },
        {
          q: '<p>A retry helper retries every failed request three times. Which request is dangerous to retry blindly?</p>',
          choices: ['GET /forecast', 'POST /payments', 'PUT /settings with the complete settings object', 'DELETE /drafts/9'],
          answer: 1,
          explain: '<p>If the first POST reached the server but the reply was lost, retrying charges the customer twice. GET, PUT and DELETE are idempotent, so repeating them leaves the same end state.</p>',
        },
        {
          q: '<p>Why add random jitter to backoff delays?</p>',
          choices: ['To make the retries faster on average', 'Because Task.sleep is imprecise', 'To hide the retry pattern from attackers', 'So clients that failed together do not all retry at the same instant'],
          answer: 3,
          explain: '<p>Without jitter, every phone that failed at the same moment waits exactly 200 ms, then 400 ms, and they all return together, overloading the server again. Randomness spreads them out. In the retry lab, compare the spikes.</p>',
        },
        {
          q: '<p>A teammate stores a paid API key as a constant in the app. What is the right fix?</p>',
          choices: ['Keep the key on your own server, which calls the paid API on the app\'s behalf', 'Move it to Info.plist', 'Base64-encode it in the source', 'Write it to UserDefaults on first launch'],
          answer: 0,
          explain: '<p>Anything shipped in the app, encoded or not, can be extracted, and anything the app sends can be read with a proxy. Info.plist is plain text inside the bundle, and Base64 is an encoding, not encryption.</p>',
        },
        {
          q: '<p>With default settings, an iOS 26 app requests <code>http://api.example.com/data</code> (no s). What happens?</p>',
          choices: ['It works but logs a warning', 'App Transport Security blocks it and the request fails', 'iOS quietly upgrades it to https', 'It works only on Wi-Fi'],
          answer: 1,
          explain: '<p>ATS rejects plain HTTP loads unless Info.plist contains an exception. It does not rewrite the URL; the request fails with an error, which is why every API you call should use https.</p>',
        },
      ],
    },
  ],
};

const realtime = {
  id: 'networking-realtime',
  title: 'Live Data Beyond Request and Response',
  steps: [
    {
      kind: 'concept',
      title: 'When the server has news',
      body: `<p>HTTP is client-initiated: the server can only answer questions. But scores change, messages arrive and delivery drivers move. There are several ways to get news from a server to an app, each with different costs.</p>`,
      points: [
        { term: 'Polling', text: 'Ask every few seconds: "anything new?" Simple, but most answers are "no", and every request wakes the radio.' },
        { term: 'Long polling', text: 'Ask, and the server holds the request open until there is news or a timeout; then ask again.' },
        { term: 'Streaming (Server-Sent Events)', text: 'One long HTTP response that the server keeps writing lines into. News flows one way: server to client.' },
        { term: 'WebSocket', text: 'An HTTP connection upgraded into a two-way channel. Either side can send a message at any time, with little overhead per message.' },
        { term: 'Push notifications', text: 'Apple\'s push service delivers a message to the device even when your app is not running.' },
      ],
      callout: { tone: 'design', title: 'Battery is part of the design', html: `<p>A cellular radio stays in a high-power state for several seconds after each transfer. Many small requests spread over a minute can cost more energy than one larger request.</p>` },
    },
    {
      kind: 'widget',
      title: 'Live score lab',
      intro: `<p>A match produces goals at unpredictable moments. Deliver them to a phone by polling (pick the interval), over a WebSocket or with push notifications. Compare how late each update arrives, how many requests carry no news, how long the radio stays awake and how much work the server does for a thousand fans. Then send the app to the background and see which approach still delivers.</p>`,
      widget: 'networking-realtime-lab',
      props: {},
    },
    {
      kind: 'code',
      title: 'WebSockets with URLSessionWebSocketTask',
      intro: `<p>A WebSocket starts as an HTTP request and is then upgraded into a two-way channel that stays open. <code>URLSessionWebSocketTask</code> exposes it with async methods: <code>send</code> a message, and <code>await receive()</code> for the next one. A loop keeps receiving until the surrounding task is cancelled. Each message is either text or binary data.</p>`,
      run: 'static',
      lines: [
        [R`import Foundation`, n(
          'The Swift compiler.',
          'Imports URLSession and its WebSocket task type.',
          'Top of the file.',
          'At compile time.',
          'WebSocket support is built into URLSession; no extra library is needed.')],
        ['', null],
        [R`func followGame(id: Int) async throws {`, n(
          'Your code; a model awaits it inside a task.',
          'Declares a function that listens for live score updates.',
          'A top-level function.',
          'For as long as the game screen is open.',
          'It runs until cancelled or until the connection fails, so it is async throws.')],
        [R`    let url = URL(string: "wss://scores.example.com/live")!`, n(
          'Foundation.',
          'Creates the WebSocket address. wss means WebSocket over TLS.',
          'A local constant.',
          'Once per call.',
          'wss is to ws what https is to http; App Transport Security expects the secure form.')],
        [R`    let socket = URLSession.shared.webSocketTask(with: url)`, n(
          'URLSession.',
          'Creates a WebSocket task for that address, not yet connected.',
          'A local constant; the task object lives on the heap.',
          'Once per call.',
          'Like other URLSession tasks, it starts suspended so you can configure it first.')],
        [R`    socket.resume()`, n(
          'URLSession.',
          'Starts the connection: an HTTP request asking to upgrade to WebSocket.',
          'Inside followGame.',
          'Immediately after creation.',
          'Tasks do nothing until resumed.')],
        [R`    defer { socket.cancel(with: .goingAway, reason: nil) }`, n(
          'Swift\'s defer statement.',
          'Schedules a clean close of the socket for whenever the function exits.',
          'Inside followGame; runs on every exit path.',
          'At exit: normal return, thrown error or cancellation.',
          'Leaving sockets open wastes server resources and battery.')],
        ['', null],
        [R`    try await socket.send(.string("subscribe \(id)"))`, n(
          'URLSession sends one WebSocket message.',
          'Tells the server which game to follow.',
          'Inside followGame.',
          'Once, right after connecting.',
          'The message format is whatever your server defines; text is easiest to debug.')],
        ['', null],
        [R`    while !Task.isCancelled {`, n(
          'Swift concurrency.',
          'Loops until the task running this function is cancelled.',
          'Inside followGame.',
          'For the life of the screen.',
          'When the view disappears, .task cancels, the loop ends and defer closes the socket.')],
        [R`        let message = try await socket.receive()`, n(
          'URLSession.',
          'Suspends until the server sends the next message.',
          'Inside the loop.',
          'Each time a message arrives.',
          'No polling: the function sleeps at no cost until there is news.')],
        [R`        switch message {`, n(
          'Your code.',
          'Branches on the kind of message.',
          'Inside the loop.',
          'Once per message.',
          'A WebSocket message is either text or binary.')],
        [R`        case .string(let text):`, n(
          'Pattern matching.',
          'Matches a text message and binds its content.',
          'Inside the switch.',
          'For text frames.',
          'JSON updates usually arrive as text.')],
        [R`            print("Score update:", text)`, n(
          'Your code.',
          'Handles the update; a real app would decode JSON and update the model.',
          'Inside the text case.',
          'For each text message.',
          'Printing keeps the example focused on the socket itself.')],
        [R`        case .data(let bytes):`, n(
          'Pattern matching.',
          'Matches a binary message.',
          'Inside the switch.',
          'For binary frames.',
          'Binary suits compact formats or images.')],
        [R`            print("Binary frame of \(bytes.count) bytes")`, n(
          'Your code.',
          'Reports the binary message\'s size.',
          'Inside the data case.',
          'For each binary message.',
          'Shows the payload arrives as Data.')],
        [R`        @unknown default:`, n(
          'The Swift compiler.',
          'Handles message kinds Apple might add in the future.',
          'The last case.',
          'Compile time, plus at run time if a new kind appears.',
          'The enum may grow, so the compiler asks for a future-proof case.')],
        [R`            break`, n(
          'Your code.',
          'Ignores unknown kinds.',
          'Inside @unknown default.',
          'Practically never.',
          'Ignoring is safer than crashing on something new.')],
        ['        }', null],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'code',
      title: 'Streaming a response line by line',
      intro: `<p>Some servers keep one HTTP response open and write events into it as they happen. Server-Sent Events use lines that start with <code>data:</code>. <code>bytes(for:)</code> hands you the body as it arrives, and <code>.lines</code> turns it into an asynchronous sequence of lines that you read with <code>for try await</code>. Live logs and progress feeds work this way.</p>`,
      run: 'static',
      lines: [
        [R`import Foundation`, n(
          'The Swift compiler.',
          'Imports URLSession and URLRequest.',
          'Top of the file.',
          'At compile time.',
          'Streaming uses the same session as ordinary requests.')],
        ['', null],
        [R`func streamEvents() async throws {`, n(
          'Your code.',
          'Declares a function that prints events for as long as the server sends them.',
          'A top-level function.',
          'Runs until the stream ends, fails or is cancelled.',
          'A long-running async function fits naturally into a .task modifier.')],
        [R`    let url = URL(string: "https://api.example.com/v1/events")!`, n(
          'Foundation.',
          'Creates the stream\'s address.',
          'A local constant.',
          'Once per call.',
          'It is an ordinary https URL; no special scheme is needed.')],
        [R`    var request = URLRequest(url: url)`, n(
          'Foundation.',
          'Creates a request so a header can be added.',
          'A local variable.',
          'Once per call.',
          'data(from:) cannot set headers; a URLRequest can.')],
        [R`    request.setValue("text/event-stream",`, n(
          'URLRequest.',
          'Starts setting the Accept header value for Server-Sent Events.',
          'On the request.',
          'Before sending.',
          'Servers often serve both normal JSON and a stream from one URL; Accept chooses the stream.')],
        [R`                     forHTTPHeaderField: "Accept")`, n(
          'URLRequest.',
          'Names the header.',
          'Second line of the call.',
          'Before sending.',
          'Same setValue call as for any other header.')],
        [R`    let (bytes, response) =`, n(
          'Your code.',
          'Declares constants for the byte stream and the response.',
          'Local constants.',
          'Assigned as soon as the response headers arrive.',
          'Unlike data(for:), this returns before the body is complete.')],
        [R`        try await URLSession.shared.bytes(for: request)`, n(
          'URLSession.',
          'Sends the request and returns once headers arrive, with the body still flowing.',
          'Called inside streamEvents.',
          'Resumes after the headers, not after the whole body.',
          'Waiting for an endless body would never finish; bytes lets you start reading immediately.')],
        [R`    guard (response as? HTTPURLResponse)?.statusCode == 200 else {`, n(
          'Your code.',
          'Checks the status before reading any events.',
          'Inside streamEvents.',
          'Right after the headers arrive.',
          'Optional chaining makes the comparison false if the cast fails.')],
        [R`        throw URLError(.badServerResponse)`, n(
          'Your code.',
          'Fails when the stream could not be opened.',
          'The guard\'s else branch.',
          'Only on a bad status.',
          'Same convention as the ordinary API client.')],
        ['    }', null],
        [R`    for try await line in bytes.lines {`, n(
          'Swift concurrency, iterating an asynchronous sequence.',
          'Waits for each complete line of text as it arrives.',
          'Inside streamEvents.',
          'Each time the server finishes writing a line.',
          'try covers network errors in the middle of the stream; the loop ends when the server closes it.')],
        [R`        guard line.hasPrefix("data: ") else { continue }`, n(
          'Your code.',
          'Skips lines that are not event data, such as comments or event names.',
          'Inside the loop.',
          'For every line.',
          'Server-Sent Events put the payload after data: and use other prefixes for metadata.')],
        [R`        let payload = line.dropFirst(6)`, n(
          'Swift string slicing.',
          'Removes the six characters of "data: ".',
          'Inside the loop.',
          'For each data line.',
          'dropFirst returns a Substring, which avoids copying the text.')],
        [R`        print("Event:", payload)`, n(
          'Your code.',
          'Handles the event; real code would decode JSON and update the model.',
          'Inside the loop.',
          'For each event, the moment it arrives.',
          'The interface can update event by event instead of after a long wait.')],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'concept',
      title: 'Push notifications at a glance',
      body: `<p>Your app cannot keep a connection open in the background; iOS suspends it to save battery. For news that must reach someone who is not using your app, use the <strong>Apple Push Notification service</strong> (APNs).</p>`,
      points: [
        { term: 'Permission', text: 'The app asks the user through UNUserNotificationCenter before it shows alerts. Many people decline, so the app must still work without push.' },
        { term: 'Device token', text: 'The app registers with APNs and receives a token that identifies this app on this device, then sends the token to your server.' },
        { term: 'Your server sends', text: 'Your backend sends the message and the token to APNs, authenticated with a key from your Apple developer account. APNs delivers it.' },
        { term: 'Not guaranteed', text: 'Delivery is best effort, and silent background pushes are throttled. Treat a push as a hint to fetch fresh data, not as the data itself.' },
      ],
      callout: { tone: 'ecosystem', title: 'Live Activities', html: `<p>A Live Activity on the Lock Screen, built with ActivityKit, can also be updated by push. It is the system's answer for live scores, deliveries and rides.</p>` },
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>A chat screen must show new messages within a second while it is open, and users send messages too. What fits best?</p>',
          choices: ['Polling every 30 seconds', 'A WebSocket', 'Push notifications only', 'Downloading the history once at launch'],
          answer: 1,
          explain: '<p>A WebSocket carries messages in both directions the moment they happen, over one open connection. Polling every 30 seconds is far too slow, and push alone is best effort and meant for when the app is not in front.</p>',
        },
        {
          q: '<p>A news app must alert people to breaking stories even when it is closed. What is required?</p>',
          choices: ['A WebSocket kept open in the background', 'Polling every minute in the background', 'Push notifications through APNs', 'Server-Sent Events'],
          answer: 2,
          explain: '<p>iOS suspends apps in the background, so their sockets, polls and streams stop. Only the system\'s push service can reach a device on the app\'s behalf.</p>',
        },
        {
          q: '<p>An app polls every 5 seconds, and the data changes about once every 10 minutes. Roughly what fraction of requests carry news?</p>',
          choices: ['About half', 'All of them', 'About 1 in 10', 'About 1 in 120'],
          answer: 3,
          explain: '<p>Ten minutes is 600 seconds, which is 120 polls, and only one of them finds a change. The other 119 wake the radio and load the server for nothing.</p>',
        },
        {
          q: '<p>Why does the WebSocket receive loop check <code>Task.isCancelled</code>?</p>',
          choices: ['So the loop ends when its task is cancelled, for example when the screen closes', 'Because the socket requires it before each receive', 'To reconnect faster after errors', 'To avoid decoding errors'],
          answer: 0,
          explain: '<p>The loop would otherwise keep listening forever. Ending it lets defer close the socket, freeing the server connection and the radio.</p>',
        },
      ],
    },
  ],
};

const SERVICE_CONTEXT = `${TODO_CONTEXT}
protocol TodoService: Sendable {
    func todos(page: Int) async throws -> [Todo]
}`;

const MODEL_CONTEXT = `${SERVICE_CONTEXT}
import Observation
@MainActor
@Observable
final class TodoListModel {
    private(set) var todos: [Todo] = []
    private(set) var isLoading = false
    private(set) var hasMore = true
    private var nextPage = 1
    private let service: any TodoService
    init(service: any TodoService) { self.service = service }
    func loadNextPage() async {
        guard !isLoading, hasMore else { return }
        isLoading = true
        defer { isLoading = false }
        guard let page = try? await service.todos(page: nextPage)
        else { return }
        todos += page
        hasMore = !page.isEmpty
        nextPage += 1
    }
}`;

const architecture = {
  id: 'networking-architecture',
  title: 'Designing the API Layer',
  steps: [
    {
      kind: 'concept',
      title: 'Layers with clear jobs',
      body: `<p>As an app grows, networking code spreads everywhere unless you give it a home. A common structure has four layers, and each talks only to the one below it.</p>`,
      points: [
        { term: 'View', text: 'SwiftUI. Shows state and forwards user actions. Knows nothing about URLs or JSON.' },
        { term: 'Model', text: 'An @Observable class that holds screen state and decides when to load. Testable without any interface.' },
        { term: 'Service protocol', text: 'Describes what data the app needs, such as todos(page:), not how it is fetched.' },
        { term: 'Live service', text: 'The implementation that uses URLSession. Tests and previews swap in a stub that returns fixed data.' },
      ],
      callout: { tone: 'design', title: 'Dependency injection', html: `<p>The model receives its service through its initializer instead of creating one. That single decision lets you test the model without a network, preview screens offline and point the app at a different server without touching any view.</p>` },
    },
    {
      kind: 'code',
      title: 'A protocol and a live implementation',
      intro: `<p>The protocol is the contract: one async method that returns a page of to-dos. <code>Sendable</code> promises values are safe to share across concurrent tasks. <code>LiveTodoService</code> fulfils the contract with URLSession. <code>validate(_:)</code> is the status check from the URLSession lesson, moved into a helper. JSONPlaceholder pages with <code>_page</code> and <code>_limit</code>.</p>`,
      run: 'static',
      context: `${TODO_CONTEXT}
func validate(_ response: URLResponse) throws {
    guard let http = response as? HTTPURLResponse,
          (200..<300).contains(http.statusCode) else {
        throw URLError(.badServerResponse)
    }
}`,
      lines: [
        [R`import Foundation`, n(
          'The Swift compiler.',
          'Imports URLSession, URLComponents and JSONDecoder.',
          'Top of the file.',
          'At compile time.',
          'Only the live implementation needs networking types; the protocol does not.')],
        ['', null],
        [R`protocol TodoService: Sendable {`, n(
          'Your code.',
          'Declares the contract every to-do source must meet.',
          'A top-level protocol.',
          'Checked at compile time wherever a type claims to conform.',
          'Depending on a protocol instead of a concrete type is what makes swapping in a stub possible.')],
        [R`    func todos(page: Int) async throws -> [Todo]`, n(
          'The protocol.',
          'Requires one method that returns a page of to-dos.',
          'Inside TodoService.',
          'Called by the model when it needs more data.',
          'The signature says nothing about URLs or JSON, so implementations are free to use anything.')],
        ['}', null],
        ['', null],
        [R`struct LiveTodoService: TodoService {`, n(
          'Your code.',
          'Declares the real implementation, backed by the network.',
          'A top-level struct.',
          'Created once at app launch and handed to the model.',
          'A struct with only Sendable properties satisfies Sendable automatically.')],
        [R`    var session = URLSession.shared`, n(
          'Your struct.',
          'Stores the session to use.',
          'A stored property with a default.',
          'Set when the service is created.',
          'An injectable session allows custom caching or timeouts.')],
        [R`    var pageSize = 20`, n(
          'Your struct.',
          'Sets how many items to request per page.',
          'A stored property with a default.',
          'Set when the service is created.',
          'Large enough to fill a screen, small enough to arrive quickly.')],
        ['', null],
        [R`    func todos(page: Int) async throws -> [Todo] {`, n(
          'Your struct, satisfying the protocol.',
          'Implements the required method.',
          'Inside LiveTodoService.',
          'Each time the model asks for a page.',
          'The exact signature from the protocol; the compiler checks it matches.')],
        [R`        var parts = URLComponents(`, n(
          'Foundation.',
          'Starts building the collection URL.',
          'A local variable.',
          'Each call.',
          'Query items will be added next.')],
        [R`            string: "https://jsonplaceholder.typicode.com/todos")!`, n(
          'URLComponents.',
          'Parses the collection address.',
          'Argument of the call above.',
          'Each call.',
          'A constant string, safe to force-unwrap.')],
        [R`        parts.queryItems = [`, n(
          'Your code.',
          'Starts the paging parameters.',
          'On parts.',
          'Each call.',
          'Paging belongs in the query, not the path.')],
        [R`            URLQueryItem(name: "_page", value: String(page)),`, n(
          'Your code.',
          'Asks for a specific page, starting at 1.',
          'First query item.',
          'Each call.',
          'This API names the parameter _page; other APIs use page or a cursor.')],
        [R`            URLQueryItem(name: "_limit", value: String(pageSize))`, n(
          'Your code.',
          'Asks for pageSize items per page.',
          'Second query item.',
          'Each call.',
          'Without a limit, this API returns all 200 to-dos at once.')],
        ['        ]', null],
        [R`        let (data, response) = try await session.data(from: parts.url!)`, n(
          'URLSession.',
          'Fetches the page and suspends until it arrives.',
          'Inside todos(page:).',
          'Each call.',
          'Same pattern as every earlier fetch.')],
        [R`        try validate(response)`, n(
          'Your helper.',
          'Throws unless the status is 2xx.',
          'Inside todos(page:).',
          'After the reply.',
          'One shared helper means every service checks status the same way.')],
        [R`        return try JSONDecoder().decode([Todo].self, from: data)`, n(
          'JSONDecoder.',
          'Decodes a JSON array into an array of Todo values.',
          'The last line of the method.',
          'After validation.',
          '[Todo].self asks for an array; decoding Todo.self here would throw typeMismatch.')],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'code',
      title: 'Pagination in the model',
      intro: `<p>Long lists arrive in <strong>pages</strong>. Page-number APIs take <code>page</code> and <code>limit</code>; cursor APIs return an opaque <code>next</code> token that you send back, which stays correct when new items are inserted. This model loads the next page when the list's last row appears, ignores duplicate triggers while a load is running and stops when a page comes back empty.</p>`,
      run: 'static',
      context: SERVICE_CONTEXT,
      lines: [
        [R`import Observation`, n(
          'The Swift compiler.',
          'Imports @Observable.',
          'Top of the file.',
          'At compile time.',
          'The model needs observation, not networking types.')],
        ['', null],
        [R`@MainActor`, n(
          'The Swift compiler.',
          'Keeps all of the model\'s state on the main actor.',
          'Applies to the class below.',
          'Enforced at compile time.',
          'The list view reads todos on the main thread, so writes must happen there too.')],
        [R`@Observable`, n(
          'The Observation macro.',
          'Lets SwiftUI redraw when todos or isLoading change.',
          'Applies to the class below.',
          'Expanded at compile time.',
          'Views showing a spinner at the bottom of the list react to isLoading automatically.')],
        [R`final class TodoListModel {`, n(
          'Your code.',
          'Declares the list screen\'s model.',
          'A reference type on the heap.',
          'Created once per list screen.',
          'One object owns the pages loaded so far.')],
        [R`    private(set) var todos: [Todo] = []`, n(
          'Your model.',
          'Holds every item loaded so far.',
          'Observed property.',
          'Grows by one page at a time.',
          'Views read it; only the model appends to it.')],
        [R`    private(set) var isLoading = false`, n(
          'Your model.',
          'Records whether a page request is in flight.',
          'Observed property.',
          'True during each load.',
          'Prevents duplicate requests and drives a loading indicator.')],
        [R`    private(set) var hasMore = true`, n(
          'Your model.',
          'Records whether more pages may exist.',
          'Observed property.',
          'Becomes false at the end of the data.',
          'Stops the app from asking for pages that do not exist.')],
        [R`    private var nextPage = 1`, n(
          'Your model.',
          'Remembers which page to request next.',
          'A private property.',
          'Incremented after each successful load.',
          'Page numbers in this API start at 1.')],
        [R`    private let service: any TodoService`, n(
          'Your model.',
          'Holds whatever service it was given: live or stub.',
          'A private constant.',
          'Set once in the initializer.',
          'any TodoService means "some type that meets the contract"; the model never knows which.')],
        [R`    init(service: any TodoService) { self.service = service }`, n(
          'Your code.',
          'Receives the service from outside.',
          'The class initializer.',
          'When the screen creates its model.',
          'This is dependency injection: the caller decides which service to use.')],
        [R`    func loadNextPage() async {`, n(
          'Your model; the view calls it from the last row\'s .task.',
          'Declares the method that fetches one more page.',
          'A main-actor method.',
          'When the user scrolls to the end of the list.',
          'It does not throw; errors leave the list as it was so the user can try again.')],
        [R`        guard !isLoading, hasMore else { return }`, n(
          'Your model.',
          'Exits if a load is already running or nothing is left.',
          'First line of the method.',
          'Every call.',
          'The last row can appear several times quickly; this guard prevents duplicate pages.')],
        [R`        isLoading = true`, n(
          'Your model.',
          'Marks the load as started.',
          'On the main actor.',
          'Before awaiting.',
          'Set before the await, so a second call during the wait is rejected by the guard.')],
        [R`        defer { isLoading = false }`, n(
          'Swift\'s defer.',
          'Guarantees isLoading is reset however the method exits.',
          'Inside the method.',
          'At exit, success or failure.',
          'Forgetting to reset it on an early return would freeze pagination forever.')],
        [R`        guard let page = try? await service.todos(page: nextPage)`, n(
          'Your service, live or stub.',
          'Fetches the next page; try? turns any error into nil.',
          'On the main actor while suspended.',
          'Each allowed call.',
          'For a list, failing quietly and letting the user scroll again is often the right behavior.')],
        [R`        else { return }`, n(
          'Your model.',
          'Leaves without changes if the fetch failed.',
          'The guard\'s else branch.',
          'Only on failure.',
          'nextPage is untouched, so the same page is requested next time.')],
        [R`        todos += page`, n(
          'Your model.',
          'Appends the new items to the list.',
          'On the main actor.',
          'After a successful fetch.',
          'Observation redraws the list with the new rows.')],
        [R`        hasMore = !page.isEmpty`, n(
          'Your model.',
          'Stops paging when a page comes back empty.',
          'On the main actor.',
          'After each fetch.',
          'An empty page is this API\'s signal that the end was reached.')],
        [R`        nextPage += 1`, n(
          'Your model.',
          'Moves on to the following page.',
          'On the main actor.',
          'After each successful fetch.',
          'Only advances on success, so a failed page is retried rather than skipped.')],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'code',
      title: 'Test the model with a stub',
      intro: `<p>Because the model depends on a protocol, a test can hand it a <strong>stub</strong>: a fake service that returns fixed data instantly. No network, no flakiness, no waiting. This Swift Testing test checks two behaviors of the model from the previous step: a page appends its items, and an empty page ends pagination.</p>`,
      run: 'swifttest',
      expectTests: 1,
      context: MODEL_CONTEXT,
      lines: [
        [R`import Testing`, n(
          'The Swift compiler.',
          'Imports Swift Testing: @Test and #expect.',
          'Top of the test file, in the test target.',
          'At compile time.',
          'Swift Testing is the modern testing framework that ships with Xcode.')],
        ['', null],
        [R`struct StubTodoService: TodoService {`, n(
          'Your test code.',
          'Declares a fake service that meets the same contract as the live one.',
          'A struct in the test target only.',
          'Created inside each test.',
          'The model cannot tell the difference, which is the point.')],
        [R`    let pages: [[Todo]]`, n(
          'Your stub.',
          'Holds the pages to return, in order.',
          'A stored property.',
          'Set when the test creates the stub.',
          'Each test decides exactly what the "server" contains.')],
        ['', null],
        [R`    func todos(page: Int) async throws -> [Todo] {`, n(
          'Your stub, satisfying the protocol.',
          'Returns a page from memory instead of the network.',
          'Inside StubTodoService.',
          'Whenever the model asks for a page.',
          'Marked async throws to match the protocol, even though it never waits or fails.')],
        [R`        page <= pages.count ? pages[page - 1] : []`, n(
          'Your stub.',
          'Returns the requested page, or an empty array past the end.',
          'The method body; a single expression returns implicitly.',
          'Each call.',
          'An empty array after the last page mimics how the real API signals the end.')],
        ['    }', null],
        ['}', null],
        ['', null],
        [R`@MainActor`, n(
          'The Swift compiler.',
          'Runs the test on the main actor.',
          'Applies to the test function below.',
          'When the test runs.',
          'TodoListModel is main-actor isolated, so the test must be too.')],
        [R`@Test func appendsPagesUntilEmpty() async {`, n(
          'Swift Testing discovers it through the @Test macro.',
          'Declares an async test with a descriptive name.',
          'A top-level function in the test target.',
          'When you run tests in Xcode or from the command line.',
          'async lets the test await the model\'s methods directly.')],
        [R`    let first = Todo(userId: 1, id: 1, title: "Plan", completed: false)`, n(
          'Your test.',
          'Creates one known to-do.',
          'A local constant.',
          'At the start of the test.',
          'Known input makes the expected output obvious.')],
        [R`    let stub = StubTodoService(pages: [[first]])`, n(
          'Your test.',
          'Creates a stub with one page that holds one item.',
          'A local constant.',
          'Arrange phase.',
          'The second page is deliberately missing, so it comes back empty.')],
        [R`    let model = TodoListModel(service: stub)`, n(
          'Your test.',
          'Creates the real model with the fake service injected.',
          'A local constant.',
          'Arrange phase.',
          'This is the payoff of dependency injection: the real logic under test, with no network.')],
        ['', null],
        [R`    await model.loadNextPage()`, n(
          'Your model.',
          'Loads page 1 from the stub.',
          'On the main actor.',
          'Act phase.',
          'It completes instantly because the stub never waits.')],
        [R`    #expect(model.todos.count == 1)`, n(
          'Swift Testing.',
          'Checks that exactly one item was appended.',
          'Inside the test.',
          'Assert phase.',
          'On failure, #expect prints both sides of the comparison.')],
        [R`    #expect(model.hasMore)`, n(
          'Swift Testing.',
          'Checks that the model still expects more pages.',
          'Inside the test.',
          'Assert phase.',
          'A non-empty page must not end pagination.')],
        ['', null],
        [R`    await model.loadNextPage()`, n(
          'Your model.',
          'Requests page 2, which the stub returns empty.',
          'On the main actor.',
          'Second act phase.',
          'Exercises the end-of-data path.')],
        [R`    #expect(model.hasMore == false)`, n(
          'Swift Testing.',
          'Checks that pagination has stopped.',
          'Inside the test.',
          'Final assertion.',
          'Without this behavior the app would request empty pages forever.')],
        ['}', null],
      ],
    },
    {
      kind: 'concept',
      title: 'HTTP caching: do not download it twice',
      body: `<p>Many responses do not change between requests. HTTP has caching built in, and URLSession's <code>URLCache</code> follows its rules automatically.</p>`,
      points: [
        { term: 'Cache-Control: max-age=60', text: 'The server says the response stays fresh for 60 seconds. Within that window URLSession answers from the cache without using the network.' },
        { term: 'ETag', text: 'A version label for the response, such as "v42". URLSession stores it with the cached copy.' },
        { term: 'If-None-Match and 304', text: 'When the copy is stale, URLSession asks "still v42?". If nothing changed, the server answers 304 Not Modified with no body, and your code receives the cached body as a normal 200 response.' },
        { term: 'Cache policy', text: 'Each request can override the default: .returnCacheDataElseLoad for offline-first screens, .reloadIgnoringLocalCacheData for pull to refresh.' },
      ],
    },
    {
      kind: 'widget',
      title: 'Cache lab',
      intro: `<p>Request the same resource again and again while you control the clock, the server's data, the cache policy and the network. Watch which requests are answered from the cache, which revalidate with a 304 and which download the whole body, and count the bytes and time saved. The last button sends a real conditional request, so you can see a genuine 304.</p>`,
      widget: 'networking-cache-lab',
      props: {},
    },
    {
      kind: 'code',
      title: 'Configure the cache',
      intro: `<p>The shared session already has a small cache. A custom <code>URLSessionConfiguration</code> lets you size it, choose a default policy and wait for connectivity instead of failing at once. Individual requests can still pick their own policy.</p>`,
      run: 'static',
      lines: [
        [R`import Foundation`, n(
          'The Swift compiler.',
          'Imports URLSession, URLCache and URLRequest.',
          'Top of the file.',
          'At compile time.',
          'Caching is part of the URL Loading System in Foundation.')],
        ['', null],
        [R`func makeCachingSession() -> URLSession {`, n(
          'Your code; typically called once at app launch.',
          'Declares a factory for a session with a larger cache.',
          'A top-level function.',
          'Once; the session is then reused.',
          'Sessions are meant to be long-lived and shared, not created per request.')],
        [R`    let config = URLSessionConfiguration.default`, n(
          'Foundation.',
          'Starts from the default configuration.',
          'A local constant; configuration is a class, so its properties can still change.',
          'Once, when the session is created.',
          'default stores cookies and cache on disk; ephemeral would keep everything in memory.')],
        [R`    config.urlCache = URLCache(memoryCapacity: 10_000_000,`, n(
          'Foundation.',
          'Creates a cache with a 10 MB memory budget.',
          'On the configuration.',
          'Once, when the session is created.',
          'Underscores make large numbers readable; memory hits are the fastest.')],
        [R`                               diskCapacity: 100_000_000)`, n(
          'Foundation.',
          'Gives the cache a 100 MB disk budget.',
          'Second argument of the URLCache initializer.',
          'Once, when the session is created.',
          'Disk entries survive app restarts, so a cold start can show cached data.')],
        [R`    config.requestCachePolicy = .useProtocolCachePolicy`, n(
          'Foundation.',
          'Follows the server\'s Cache-Control and ETag rules by default.',
          'On the configuration.',
          'Applied to every request from this session.',
          'This is already the default; writing it documents the intent.')],
        [R`    config.timeoutIntervalForRequest = 20`, n(
          'Foundation.',
          'Fails a request if no data arrives for 20 seconds.',
          'On the configuration.',
          'Enforced during each request.',
          'Shorter than the 60-second default, so users hear about problems sooner.')],
        [R`    config.waitsForConnectivity = true`, n(
          'Foundation.',
          'Waits for a network to appear instead of failing immediately when offline.',
          'On the configuration.',
          'When a request starts without connectivity.',
          'Useful for background-friendly work; the request timeout still applies once it starts.')],
        [R`    return URLSession(configuration: config)`, n(
          'Foundation.',
          'Creates the session from the configuration.',
          'The last line of the factory.',
          'Once, when the session is created.',
          'The configuration is copied, so later changes to config do not affect the session.')],
        ['}', null],
        ['', null],
        [R`func offlineFirstRequest(for url: URL) -> URLRequest {`, n(
          'Your code.',
          'Declares a helper for screens that prefer cached data.',
          'A top-level function.',
          'Whenever such a screen loads.',
          'The policy is per request, so other screens keep normal behavior.')],
        [R`    var request = URLRequest(url: url)`, n(
          'Foundation.',
          'Creates a request.',
          'A local variable.',
          'Each call.',
          'It must be var to change its policy.')],
        [R`    request.cachePolicy = .returnCacheDataElseLoad`, n(
          'Foundation.',
          'Uses any cached copy, however old; loads from the network only if none exists.',
          'On the request.',
          'Applied when the request is sent.',
          'Ideal for content that rarely changes, or when showing something beats showing nothing.')],
        [R`    return request`, n(
          'Your code.',
          'Returns the configured request.',
          'The last line.',
          'Each call.',
          'The caller sends it with any session.')],
        ['}', null],
      ],
    },
    {
      kind: 'concept',
      title: 'GraphQL',
      body: `<p><strong>GraphQL</strong> is a query language for APIs, created at Facebook. Instead of many REST endpoints, a GraphQL server exposes one endpoint, and the client sends a query describing exactly the fields it wants, nested as deeply as needed. The response mirrors the query's shape.</p><p>For example, <code>{ user(id: 1) { name todos(first: 3) { title } } }</code> returns a user's name and three to-do titles in one round trip, with nothing extra.</p>`,
      points: [
        { term: 'Good fit', text: 'Screens that combine several related resources, or many clients (phone, watch, web) that need different fields.' },
        { term: 'Costs', text: 'More server complexity, harder HTTP caching because queries usually travel as POST requests, and protection needed against very expensive queries.' },
        { term: 'On iOS', text: 'It is still JSON over HTTP, so URLSession and Codable work. Libraries such as Apollo iOS generate Swift types from the schema.' },
      ],
    },
    {
      kind: 'concept',
      title: 'gRPC',
      body: `<p><strong>gRPC</strong> is a remote procedure call framework, created at Google: the client calls methods on a server as if they were local functions. You describe services and messages in a <code>.proto</code> file (Protocol Buffers), and a code generator produces the Swift client. Messages travel as compact binary over HTTP/2, and calls can stream in either direction.</p>`,
      points: [
        { term: 'Good fit', text: 'Traffic between services inside a backend, high-volume or streaming APIs, and teams that want a strict, generated contract.' },
        { term: 'Costs', text: 'Binary payloads are hard to read while debugging, browsers need a proxy, and both sides must share the .proto files.' },
        { term: 'On iOS', text: 'The open-source grpc-swift package generates async/await clients. Most public APIs your apps call will still be REST with JSON.' },
      ],
    },
    {
      kind: 'concept',
      title: 'REST API design you will meet',
      body: `<p>Sooner or later you will design the backend side too, or review one. These conventions make an API predictable for every client that uses it.</p>`,
      points: [
        { term: 'Plural nouns, methods as verbs', text: '/users/7/todos rather than /getTodosForUser?id=7. The HTTP method already says what to do.' },
        { term: 'Honest statuses and error bodies', text: '201 with the new resource after a POST; 422 with a JSON body naming the invalid field. RFC 9457 "problem details" standardizes that body.' },
        { term: 'Versioning', text: 'A version in the path (/v1/) or a header, so old app versions keep working; not every user updates.' },
        { term: 'Idempotency keys', text: 'Many APIs accept a unique Idempotency-Key header on POST. If the server sees the same key twice, it returns the first result instead of charging twice.' },
        { term: 'Rate limits', text: 'Answer 429 Too Many Requests with a Retry-After header, so clients know when to back off.' },
      ],
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>Why does <code>TodoListModel</code> receive <code>any TodoService</code> in its initializer instead of creating a <code>LiveTodoService</code> itself?</p>',
          choices: ['Swift requires protocols for async code', 'So tests and previews can inject a stub with fixed data', 'It makes network requests faster', 'URLSession cannot be used inside a class'],
          answer: 1,
          explain: '<p>Injection decouples the model from the network. The live app passes LiveTodoService; tests pass a stub. Speed and language rules have nothing to do with it.</p>',
        },
        {
          q: '<p>A response carried <code>ETag: "v7"</code> and <code>max-age=0</code>. The data has not changed. With <code>.useProtocolCachePolicy</code>, what does the next request do?</p>',
          choices: ['Downloads the full body again', 'Fails because the cached copy is stale', 'Sends If-None-Match: "v7", receives 304, and hands your code the cached body as a 200 response', 'Never contacts the server'],
          answer: 2,
          explain: '<p>max-age=0 means the copy must be revalidated before use, but the ETag makes revalidation cheap: only headers travel, and URLSession turns the 304 into the cached 200 response for you.</p>',
        },
        {
          q: '<p>An inbox where new messages constantly arrive at the top needs paging. Page numbers or cursors?</p>',
          choices: ['Cursors, because inserts shift page boundaries and cause duplicates or gaps with page numbers', 'Page numbers, because they are simpler', 'Neither; download everything at once', 'Page numbers with a larger limit'],
          answer: 0,
          explain: '<p>If two messages arrive while you read page 1, page 2 now starts two items earlier and repeats them. A cursor marks a position in the data itself, so inserts do not shift it.</p>',
        },
        {
          q: '<p>A watch app and a phone app need very different fields from the same related data, ideally in one request each. Which API style fits best?</p>',
          choices: ['gRPC', 'Polling', 'Server-Sent Events', 'GraphQL'],
          answer: 3,
          explain: '<p>GraphQL lets each client ask for exactly the fields it needs across related resources in one query. gRPC suits service-to-service contracts, and the other two are delivery patterns, not API shapes.</p>',
        },
        {
          q: '<p>The last row of a list appears twice in quick succession, calling <code>loadNextPage()</code> twice. What stops two identical page requests?</p>',
          choices: ['The hasMore check', 'The !isLoading check, because isLoading is set before the first call suspends', 'defer { isLoading = false }', 'nextPage += 1'],
          answer: 1,
          explain: '<p>The first call sets isLoading to true before awaiting, so the second call hits the guard and returns. hasMore is still true at that moment, and defer only runs when the first call finishes.</p>',
        },
      ],
    },
  ],
};

export default {
  id: 'networking',
  number: 8,
  title: 'Networking and Backend Communication',
  short: 'Networking',
  summary: 'Explain how a request travels from an iPhone to a server and back, speak HTTP and REST, decode JSON with Codable, call APIs with URLSession and async/await, handle failures and secrets safely, choose between polling, WebSockets and push, and structure a testable API layer.',
  objectives: ['CLO6', 'CLO5'],
  outcomes: ['SLO1'],
  lessons: [foundations, http, jsonRest, urlsession, errorsSecurity, realtime, architecture],
};

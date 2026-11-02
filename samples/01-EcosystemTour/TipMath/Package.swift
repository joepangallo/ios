// swift-tools-version: 6.2
// Package.swift (the line above must stay first: it names the package tools version this manifest needs)
// Who: Swift Package Manager reads this manifest; so does Xcode when an app adds the package.
// What: describes the TipMath package: its name, the platforms it supports,
//       the library it offers, and the targets that hold its code and tests.
// Where: the root of the TipMath folder, next to the EcosystemTour project.
//        It is a standalone package: the app does not link it.
// When: each time the package is resolved, built or tested, for example with `swift test`.
// Why: lesson 1.2 shows what a package and its manifest are. This one has no
//      dependencies, so it builds offline in seconds.

import PackageDescription // The vocabulary of a manifest: Package, products and targets.

let package = Package( // Swift Package Manager looks for a constant with exactly this name.
    name: "TipMath", // The package's name, shown in Xcode's package list.
    platforms: [.iOS(.v26), .macOS(.v26)], // The oldest iOS and macOS the package supports.
    products: [.library(name: "TipMath", targets: ["TipMath"])], // The library other code can import.
    targets: [ // The modules inside the package.
        .target(name: "TipMath"), // The library's code, in Sources/TipMath.
        .testTarget(name: "TipMathTests", dependencies: ["TipMath"]) // Its tests, in Tests/TipMathTests; they never ship.
    ]
)

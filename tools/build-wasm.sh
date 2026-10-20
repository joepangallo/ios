#!/usr/bin/env bash
# Compiles src/wasm/SwiftCore.swift to src/wasm/SwiftCore.wasm with the swift.org
# toolchain + Swift SDK for WebAssembly (install: swiftly install 6.4.1, then
# swift sdk install <wasm artifactbundle>). Embedded Swift keeps the module tiny.
set -euo pipefail
cd "$(dirname "$0")/.."
TC="$HOME/Library/Developer/Toolchains/swift-6.4.1-RELEASE.xctoolchain/usr/bin"
SDKR="$HOME/Library/org.swift.swiftpm/swift-sdks/swift-6.4.1-RELEASE_wasm.artifactbundle/swift-6.4.1-RELEASE_wasm/wasm32-unknown-wasip1"
EXPORTS=(relativeLuminance contrastRatio distanceMeters bearingDegrees countPrimes)
LINK=(-Xlinker --no-entry -Xlinker --gc-sections -Xlinker --strip-all)
for e in "${EXPORTS[@]}"; do LINK+=(-Xlinker "--export=$e"); done
"$TC/swiftc" -target wasm32-unknown-wasip1 -enable-experimental-feature Embedded \
  -enable-experimental-feature Extern -wmo -Osize -parse-as-library \
  -sdk "$SDKR/WASI.sdk" -resource-dir "$SDKR/swift.xctoolchain/usr/lib/swift" \
  -Xclang-linker -resource-dir -Xclang-linker "$SDKR/swift.xctoolchain/usr/lib/swift/clang" \
  "${LINK[@]}" src/wasm/SwiftCore.swift -o src/wasm/SwiftCore.wasm
ls -la src/wasm/SwiftCore.wasm

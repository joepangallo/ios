#!/usr/bin/env bash
# Compiles src/wasm/SwiftCore.swift to src/wasm/SwiftCore.wasm with the swift.org
# 6.4.1 toolchain and the Swift SDK for WebAssembly. Embedded Swift keeps the
# module tiny, and the build is byte-for-byte reproducible.
#
# Install on macOS: `swiftly install 6.4.1` (lands in ~/Library/Developer/Toolchains),
#   then `swift sdk install <swift-6.4.1-RELEASE_wasm.artifactbundle.tar.gz>`
#   (lands in ~/Library/org.swift.swiftpm/swift-sdks).
# Install on Linux: `swiftly install 6.4.1` (lands in ~/.local/share/swiftly/toolchains),
#   then the same `swift sdk install` (lands in ~/.swiftpm/swift-sdks).
# Overrides: SWIFT_TOOLCHAIN_BIN (directory that holds swiftc), SWIFT_SDKS_DIR
#   (the swift-sdks directory), OUT (output path; tools/wasm-check.mjs sets it).
# `--check-toolchain` prints the paths and exits 0 when both exist, 2 otherwise.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=6.4.1
if [ -n "${SWIFT_TOOLCHAIN_BIN:-}" ]; then
  TC="$SWIFT_TOOLCHAIN_BIN"
elif [ "$(uname -s)" = "Darwin" ]; then
  TC="$HOME/Library/Developer/Toolchains/swift-$VERSION-RELEASE.xctoolchain/usr/bin"
else
  TC="${SWIFTLY_HOME_DIR:-$HOME/.local/share/swiftly}/toolchains/$VERSION/usr/bin"
fi
if [ -n "${SWIFT_SDKS_DIR:-}" ]; then
  SDKS="$SWIFT_SDKS_DIR"
elif [ "$(uname -s)" = "Darwin" ]; then
  SDKS="$HOME/Library/org.swift.swiftpm/swift-sdks"
else
  SDKS="$HOME/.swiftpm/swift-sdks"
fi
SDKR="$SDKS/swift-$VERSION-RELEASE_wasm.artifactbundle/swift-$VERSION-RELEASE_wasm/wasm32-unknown-wasip1"
OUT="${OUT:-src/wasm/SwiftCore.wasm}"
echo "toolchain: $TC"
echo "sdk: $SDKR"
if [ ! -x "$TC/swiftc" ] || [ ! -d "$SDKR" ]; then
  echo "swift.org toolchain or WebAssembly SDK not found (see the comment at the top of $0)" >&2
  exit 2
fi
if [ "${1:-}" = "--check-toolchain" ]; then
  exit 0
fi
EXPORTS=(relativeLuminance contrastRatio distanceMeters bearingDegrees countPrimes)
LINK=(-Xlinker --no-entry -Xlinker --gc-sections -Xlinker --strip-all)
for e in "${EXPORTS[@]}"; do LINK+=(-Xlinker "--export=$e"); done
# -disable-incremental-llvm-codegen zeroes the per-build module hash the frontend
# embeds in the data section, so the output is byte-for-byte reproducible.
"$TC/swiftc" -target wasm32-unknown-wasip1 -enable-experimental-feature Embedded \
  -enable-experimental-feature Extern -wmo -Osize -parse-as-library \
  -Xfrontend -disable-incremental-llvm-codegen \
  -sdk "$SDKR/WASI.sdk" -resource-dir "$SDKR/swift.xctoolchain/usr/lib/swift" \
  -Xclang-linker -resource-dir -Xclang-linker "$SDKR/swift.xctoolchain/usr/lib/swift/clang" \
  "${LINK[@]}" src/wasm/SwiftCore.swift -o "$OUT"
ls -la "$OUT"

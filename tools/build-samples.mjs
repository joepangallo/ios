// Writes the Xcode project for every sample app under samples/.
//
// Each sample folder holds a sample.json that describes the app:
//   { "name": "SwiftUIStudio", "title": "SwiftUI Studio", "modules": [4],
//     "infoPlist": { "NSLocationWhenInUseUsageDescription": "..." },
//     "uiTests": false, "widget": { "name": "StudyWidget" } }
// From it this tool writes <name>.xcodeproj (project.pbxproj, the workspace
// stub and a shared scheme), in the format Xcode 26 itself writes: folder-based
// groups, so every file dropped into a target's folder is part of that target.
// The first run for a new sample also writes a starter app (App struct, home
// screen, the shared CourseKit.swift, asset catalog, a Swift Testing file).
// Existing Swift files are never overwritten; CourseKit.swift is always
// refreshed from the copy below so every sample shares one version.
//
// Usage: node tools/build-samples.mjs [sample-folder ...] [--page | --page-only] [--pdf]
//   --page also writes samples/sample-apps.html, the students' guide to the samples;
//   --page-only writes only the guide; --pdf also prints the guide to samples/sample-apps.pdf.
// Object ids are derived from names, so regenerating never churns the diff.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLES = path.join(ROOT, 'samples');
const COURSEKIT = path.join(ROOT, 'tools/sample-template/CourseKit.swift');
const DEPLOYMENT = '26.0';
const XCODE = '26.1.1';

const oid = (...parts) => crypto.createHash('sha1').update(parts.join('/')).digest('hex').slice(0, 24).toUpperCase();
const q = (s) => (/^[A-Za-z0-9_./$()-]+$/.test(s) && !/^\d/.test(s) ? s : JSON.stringify(s));

// Project-level settings, exactly as Xcode 26.1.1's iOS App template writes them,
// except the deployment target, which the course sets to iOS 26.0.
const PROJECT_COMMON = {
  ALWAYS_SEARCH_USER_PATHS: 'NO', ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS: 'YES',
  CLANG_ANALYZER_NONNULL: 'YES', CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION: 'YES_AGGRESSIVE', CLANG_CXX_LANGUAGE_STANDARD: '"gnu++20"',
  CLANG_ENABLE_MODULES: 'YES', CLANG_ENABLE_OBJC_ARC: 'YES', CLANG_ENABLE_OBJC_WEAK: 'YES',
  CLANG_WARN_BLOCK_CAPTURE_AUTORELEASING: 'YES', CLANG_WARN_BOOL_CONVERSION: 'YES', CLANG_WARN_COMMA: 'YES',
  CLANG_WARN_CONSTANT_CONVERSION: 'YES', CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS: 'YES', CLANG_WARN_DIRECT_OBJC_ISA_USAGE: 'YES_ERROR',
  CLANG_WARN_DOCUMENTATION_COMMENTS: 'YES', CLANG_WARN_EMPTY_BODY: 'YES', CLANG_WARN_ENUM_CONVERSION: 'YES',
  CLANG_WARN_INFINITE_RECURSION: 'YES', CLANG_WARN_INT_CONVERSION: 'YES', CLANG_WARN_NON_LITERAL_NULL_CONVERSION: 'YES',
  CLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF: 'YES', CLANG_WARN_OBJC_LITERAL_CONVERSION: 'YES', CLANG_WARN_OBJC_ROOT_CLASS: 'YES_ERROR',
  CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER: 'YES', CLANG_WARN_RANGE_LOOP_ANALYSIS: 'YES', CLANG_WARN_STRICT_PROTOTYPES: 'YES',
  CLANG_WARN_SUSPICIOUS_MOVE: 'YES', CLANG_WARN_UNGUARDED_AVAILABILITY: 'YES_AGGRESSIVE', CLANG_WARN_UNREACHABLE_CODE: 'YES',
  CLANG_WARN__DUPLICATE_METHOD_MATCH: 'YES', COPY_PHASE_STRIP: 'NO',
};
const PROJECT_DEBUG = {
  ...PROJECT_COMMON, DEBUG_INFORMATION_FORMAT: 'dwarf', ENABLE_STRICT_OBJC_MSGSEND: 'YES', ENABLE_TESTABILITY: 'YES',
  ENABLE_USER_SCRIPT_SANDBOXING: 'YES', GCC_C_LANGUAGE_STANDARD: 'gnu17', GCC_DYNAMIC_NO_PIC: 'NO', GCC_NO_COMMON_BLOCKS: 'YES',
  GCC_OPTIMIZATION_LEVEL: '0', GCC_PREPROCESSOR_DEFINITIONS: ['"DEBUG=1"', '"$(inherited)"'],
  GCC_WARN_64_TO_32_BIT_CONVERSION: 'YES', GCC_WARN_ABOUT_RETURN_TYPE: 'YES_ERROR', GCC_WARN_UNDECLARED_SELECTOR: 'YES',
  GCC_WARN_UNINITIALIZED_AUTOS: 'YES_AGGRESSIVE', GCC_WARN_UNUSED_FUNCTION: 'YES', GCC_WARN_UNUSED_VARIABLE: 'YES',
  IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT, LOCALIZATION_PREFERS_STRING_CATALOGS: 'YES', MTL_ENABLE_DEBUG_INFO: 'INCLUDE_SOURCE',
  MTL_FAST_MATH: 'YES', ONLY_ACTIVE_ARCH: 'YES', SDKROOT: 'iphoneos', SWIFT_ACTIVE_COMPILATION_CONDITIONS: '"DEBUG $(inherited)"',
  SWIFT_OPTIMIZATION_LEVEL: '"-Onone"',
};
const PROJECT_RELEASE = {
  ...PROJECT_COMMON, DEBUG_INFORMATION_FORMAT: '"dwarf-with-dsym"', ENABLE_NS_ASSERTIONS: 'NO', ENABLE_STRICT_OBJC_MSGSEND: 'YES',
  ENABLE_USER_SCRIPT_SANDBOXING: 'YES', GCC_C_LANGUAGE_STANDARD: 'gnu17', GCC_NO_COMMON_BLOCKS: 'YES',
  GCC_WARN_64_TO_32_BIT_CONVERSION: 'YES', GCC_WARN_ABOUT_RETURN_TYPE: 'YES_ERROR', GCC_WARN_UNDECLARED_SELECTOR: 'YES',
  GCC_WARN_UNINITIALIZED_AUTOS: 'YES_AGGRESSIVE', GCC_WARN_UNUSED_FUNCTION: 'YES', GCC_WARN_UNUSED_VARIABLE: 'YES',
  IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT, LOCALIZATION_PREFERS_STRING_CATALOGS: 'YES', MTL_ENABLE_DEBUG_INFO: 'NO',
  MTL_FAST_MATH: 'YES', SDKROOT: 'iphoneos', SWIFT_COMPILATION_MODE: 'wholemodule', VALIDATE_PRODUCT: 'YES',
};

// Swift settings shared by every target: Swift 6 language mode (full data-race
// checking, as the course recommends) with Xcode 26's approachable concurrency.
const SWIFT = { SWIFT_APPROACHABLE_CONCURRENCY: 'YES', SWIFT_UPCOMING_FEATURE_MEMBER_IMPORT_VISIBILITY: 'YES', SWIFT_VERSION: '6.0' };

function appSettings(s) {
  const info = Object.fromEntries(Object.entries(s.infoPlist || {}).map(([k, v]) => [`INFOPLIST_KEY_${k}`, typeof v === 'boolean' ? (v ? 'YES' : 'NO') : q(String(v))]));
  return {
    ASSETCATALOG_COMPILER_APPICON_NAME: 'AppIcon', ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: 'AccentColor',
    CODE_SIGN_STYLE: 'Automatic', CURRENT_PROJECT_VERSION: '1', ENABLE_PREVIEWS: 'YES', GENERATE_INFOPLIST_FILE: 'YES',
    INFOPLIST_KEY_CFBundleDisplayName: q(s.title),
    INFOPLIST_KEY_UIApplicationSceneManifest_Generation: 'YES', INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents: 'YES',
    INFOPLIST_KEY_UILaunchScreen_Generation: 'YES',
    INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad: '"UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight"',
    INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone: '"UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight"',
    ...info,
    LD_RUNPATH_SEARCH_PATHS: ['"$(inherited)"', '"@executable_path/Frameworks"'],
    MARKETING_VERSION: '1.0', PRODUCT_BUNDLE_IDENTIFIER: `com.example.${s.name}`, PRODUCT_NAME: '"$(TARGET_NAME)"',
    STRING_CATALOG_GENERATE_SYMBOLS: 'YES', SWIFT_DEFAULT_ACTOR_ISOLATION: 'MainActor', SWIFT_EMIT_LOC_STRINGS: 'YES',
    ...SWIFT, TARGETED_DEVICE_FAMILY: '"1,2"',
  };
}
function testSettings(s, kind) {
  const base = {
    CODE_SIGN_STYLE: 'Automatic', CURRENT_PROJECT_VERSION: '1', GENERATE_INFOPLIST_FILE: 'YES', IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT,
    MARKETING_VERSION: '1.0', PRODUCT_BUNDLE_IDENTIFIER: `com.example.${s.name}${kind}`, PRODUCT_NAME: '"$(TARGET_NAME)"',
    STRING_CATALOG_GENERATE_SYMBOLS: 'NO', SWIFT_EMIT_LOC_STRINGS: 'NO', ...SWIFT, TARGETED_DEVICE_FAMILY: '"1,2"',
  };
  if (kind === 'Tests') return { BUNDLE_LOADER: '"$(TEST_HOST)"', ...base, TEST_HOST: `"$(BUILT_PRODUCTS_DIR)/${s.name}.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/${s.name}"` };
  return { ...base, TEST_TARGET_NAME: s.name };
}
function widgetSettings(s, w) {
  return {
    ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: 'AccentColor', ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME: 'WidgetBackground',
    CODE_SIGN_STYLE: 'Automatic', CURRENT_PROJECT_VERSION: '1', GENERATE_INFOPLIST_FILE: 'YES', INFOPLIST_FILE: `${w.name}/Info.plist`,
    INFOPLIST_KEY_CFBundleDisplayName: q(w.title || w.name), INFOPLIST_KEY_NSHumanReadableCopyright: '""', IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT,
    LD_RUNPATH_SEARCH_PATHS: ['"$(inherited)"', '"@executable_path/Frameworks"', '"@executable_path/../../Frameworks"'],
    MARKETING_VERSION: '1.0', PRODUCT_BUNDLE_IDENTIFIER: `com.example.${s.name}.${w.name}`, PRODUCT_NAME: '"$(TARGET_NAME)"',
    SKIP_INSTALL: 'YES', STRING_CATALOG_GENERATE_SYMBOLS: 'YES', SWIFT_EMIT_LOC_STRINGS: 'YES', ...SWIFT, TARGETED_DEVICE_FAMILY: '"1,2"',
  };
}

function settingsBlock(obj, indent) {
  const pad = '\t'.repeat(indent);
  return Object.keys(obj).sort().map((k) => {
    const v = obj[k];
    if (Array.isArray(v)) return `${pad}${k} = (\n${v.map((x) => `${pad}\t${x},`).join('\n')}\n${pad});`;
    return `${pad}${k} = ${v};`;
  }).join('\n');
}

export function pbxproj(s) {
  const N = s.name;
  const id = (...p) => oid(N, ...p);
  const targets = [
    { key: 'app', name: N, product: `${N}.app`, ftype: 'wrapper.application', ptype: 'com.apple.product-type.application', settings: appSettings(s) },
    { key: 'tests', name: `${N}Tests`, product: `${N}Tests.xctest`, ftype: 'wrapper.cfbundle', ptype: 'com.apple.product-type.bundle.unit-test', settings: testSettings(s, 'Tests'), dependsOnApp: true },
  ];
  if (s.uiTests) targets.push({ key: 'uitests', name: `${N}UITests`, product: `${N}UITests.xctest`, ftype: 'wrapper.cfbundle', ptype: 'com.apple.product-type.bundle.ui-testing', settings: testSettings(s, 'UITests'), dependsOnApp: true });
  if (s.widget) targets.push({ key: 'widget', name: s.widget.name, product: `${s.widget.name}.appex`, ftype: '"wrapper.app-extension"', ptype: 'com.apple.product-type.app-extension', settings: widgetSettings(s, s.widget), embedded: true });
  const T = (t, role) => id(t.key, role);
  const out = [];
  const sect = (name, body) => { if (body.length) out.push(`/* Begin ${name} section */\n${body.join('\n')}\n/* End ${name} section */\n`); };
  const widget = targets.find((t) => t.key === 'widget');

  sect('PBXBuildFile', widget ? [`\t\t${T(widget, 'buildfile')} /* ${widget.product} in Embed Foundation Extensions */ = {isa = PBXBuildFile; fileRef = ${T(widget, 'product')} /* ${widget.product} */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };`] : []);
  sect('PBXContainerItemProxy', targets.filter((t) => t.dependsOnApp || t.embedded).map((t) => {
    const remote = t.embedded ? t : targets[0];
    return `\t\t${T(t, 'proxy')} /* PBXContainerItemProxy */ = {\n\t\t\tisa = PBXContainerItemProxy;\n\t\t\tcontainerPortal = ${id('project')} /* Project object */;\n\t\t\tproxyType = 1;\n\t\t\tremoteGlobalIDString = ${T(remote, 'target')};\n\t\t\tremoteInfo = ${q(remote.name)};\n\t\t};`;
  }));
  sect('PBXCopyFilesBuildPhase', widget ? [`\t\t${id('embed')} /* Embed Foundation Extensions */ = {\n\t\t\tisa = PBXCopyFilesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tdstPath = "";\n\t\t\tdstSubfolderSpec = 13;\n\t\t\tfiles = (\n\t\t\t\t${T(widget, 'buildfile')} /* ${widget.product} in Embed Foundation Extensions */,\n\t\t\t);\n\t\t\tname = "Embed Foundation Extensions";\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};`] : []);
  sect('PBXFileReference', targets.map((t) => `\t\t${T(t, 'product')} /* ${t.product} */ = {isa = PBXFileReference; explicitFileType = ${t.ftype}; includeInIndex = 0; path = ${q(t.product)}; sourceTree = BUILT_PRODUCTS_DIR; };`));
  sect('PBXFileSystemSynchronizedBuildFileExceptionSet', widget ? [`\t\t${id('widget-exceptions')} /* Exceptions for "${widget.name}" folder in "${widget.name}" target */ = {\n\t\t\tisa = PBXFileSystemSynchronizedBuildFileExceptionSet;\n\t\t\tmembershipExceptions = (\n\t\t\t\tInfo.plist,\n\t\t\t);\n\t\t\ttarget = ${T(widget, 'target')} /* ${widget.name} */;\n\t\t};`] : []);
  sect('PBXFileSystemSynchronizedRootGroup', targets.map((t) => `\t\t${T(t, 'group')} /* ${t.name} */ = {\n\t\t\tisa = PBXFileSystemSynchronizedRootGroup;${t.embedded ? `\n\t\t\texceptions = (\n\t\t\t\t${id('widget-exceptions')} /* Exceptions for "${t.name}" folder in "${t.name}" target */,\n\t\t\t);` : ''}\n\t\t\tpath = ${q(t.name)};\n\t\t\tsourceTree = "<group>";\n\t\t};`));
  sect('PBXFrameworksBuildPhase', targets.map((t) => `\t\t${T(t, 'frameworks')} /* Frameworks */ = {\n\t\t\tisa = PBXFrameworksBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};`));
  sect('PBXGroup', [
    `\t\t${id('main')} = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n${targets.map((t) => `\t\t\t\t${T(t, 'group')} /* ${t.name} */,`).join('\n')}\n\t\t\t\t${id('products')} /* Products */,\n\t\t\t);\n\t\t\tsourceTree = "<group>";\n\t\t};`,
    `\t\t${id('products')} /* Products */ = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n${targets.map((t) => `\t\t\t\t${T(t, 'product')} /* ${t.product} */,`).join('\n')}\n\t\t\t);\n\t\t\tname = Products;\n\t\t\tsourceTree = "<group>";\n\t\t};`,
  ]);
  sect('PBXNativeTarget', targets.map((t) => {
    const phases = [`${T(t, 'sources')} /* Sources */`, `${T(t, 'frameworks')} /* Frameworks */`, `${T(t, 'resources')} /* Resources */`];
    if (t.key === 'app' && widget) phases.push(`${id('embed')} /* Embed Foundation Extensions */`);
    const deps = t.key === 'app' && widget ? [`${T(widget, 'dependency')} /* PBXTargetDependency */`] : t.dependsOnApp ? [`${T(t, 'dependency')} /* PBXTargetDependency */`] : [];
    return `\t\t${T(t, 'target')} /* ${t.name} */ = {\n\t\t\tisa = PBXNativeTarget;\n\t\t\tbuildConfigurationList = ${T(t, 'cfglist')} /* Build configuration list for PBXNativeTarget "${t.name}" */;\n\t\t\tbuildPhases = (\n${phases.map((p) => `\t\t\t\t${p},`).join('\n')}\n\t\t\t);\n\t\t\tbuildRules = (\n\t\t\t);\n\t\t\tdependencies = (\n${deps.map((d) => `\t\t\t\t${d},\n`).join('')}\t\t\t);\n\t\t\tfileSystemSynchronizedGroups = (\n\t\t\t\t${T(t, 'group')} /* ${t.name} */,\n\t\t\t);\n\t\t\tname = ${q(t.name)};\n\t\t\tpackageProductDependencies = (\n\t\t\t);\n\t\t\tproductName = ${q(t.name)};\n\t\t\tproductReference = ${T(t, 'product')} /* ${t.product} */;\n\t\t\tproductType = "${t.ptype}";\n\t\t};`;
  }));
  sect('PBXProject', [`\t\t${id('project')} /* Project object */ = {\n\t\t\tisa = PBXProject;\n\t\t\tattributes = {\n\t\t\t\tBuildIndependentTargetsInParallel = 1;\n\t\t\t\tLastSwiftUpdateCheck = 2610;\n\t\t\t\tLastUpgradeCheck = 2610;\n\t\t\t\tTargetAttributes = {\n${targets.map((t) => `\t\t\t\t\t${T(t, 'target')} = {\n\t\t\t\t\t\tCreatedOnToolsVersion = ${XCODE};${t.dependsOnApp ? `\n\t\t\t\t\t\tTestTargetID = ${T(targets[0], 'target')};` : ''}\n\t\t\t\t\t};`).join('\n')}\n\t\t\t\t};\n\t\t\t};\n\t\t\tbuildConfigurationList = ${id('project', 'cfglist')} /* Build configuration list for PBXProject "${N}" */;\n\t\t\tdevelopmentRegion = en;\n\t\t\thasScannedForEncodings = 0;\n\t\t\tknownRegions = (\n${(s.regions || ['en', 'Base']).map((r) => `\t\t\t\t${q(r)},`).join('\n')}\n\t\t\t);\n\t\t\tmainGroup = ${id('main')};\n\t\t\tminimizedProjectReferenceProxies = 1;\n\t\t\tpreferredProjectObjectVersion = 77;\n\t\t\tproductRefGroup = ${id('products')} /* Products */;\n\t\t\tprojectDirPath = "";\n\t\t\tprojectRoot = "";\n\t\t\ttargets = (\n${targets.map((t) => `\t\t\t\t${T(t, 'target')} /* ${t.name} */,`).join('\n')}\n\t\t\t);\n\t\t};`]);
  const phase = (isa, label, role) => targets.map((t) => `\t\t${T(t, role)} /* ${label} */ = {\n\t\t\tisa = ${isa};\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};`);
  sect('PBXResourcesBuildPhase', phase('PBXResourcesBuildPhase', 'Resources', 'resources'));
  sect('PBXSourcesBuildPhase', phase('PBXSourcesBuildPhase', 'Sources', 'sources'));
  sect('PBXTargetDependency', targets.filter((t) => t.dependsOnApp || t.embedded).map((t) => {
    const target = t.embedded ? t : targets[0];
    return `\t\t${T(t, 'dependency')} /* PBXTargetDependency */ = {\n\t\t\tisa = PBXTargetDependency;\n\t\t\ttarget = ${T(target, 'target')} /* ${target.name} */;\n\t\t\ttargetProxy = ${T(t, 'proxy')} /* PBXContainerItemProxy */;\n\t\t};`;
  }));
  const cfg = (key, name, settings) => `\t\t${key} /* ${name} */ = {\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = {\n${settingsBlock(settings, 4)}\n\t\t\t};\n\t\t\tname = ${name};\n\t\t};`;
  sect('XCBuildConfiguration', [
    cfg(id('project', 'Debug'), 'Debug', PROJECT_DEBUG), cfg(id('project', 'Release'), 'Release', PROJECT_RELEASE),
    ...targets.flatMap((t) => [cfg(T(t, 'Debug'), 'Debug', t.settings), cfg(T(t, 'Release'), 'Release', t.settings)]),
  ]);
  const list = (key, label, base) => `\t\t${key} /* ${label} */ = {\n\t\t\tisa = XCConfigurationList;\n\t\t\tbuildConfigurations = (\n\t\t\t\t${base('Debug')} /* Debug */,\n\t\t\t\t${base('Release')} /* Release */,\n\t\t\t);\n\t\t\tdefaultConfigurationIsVisible = 0;\n\t\t\tdefaultConfigurationName = Release;\n\t\t};`;
  sect('XCConfigurationList', [
    list(id('project', 'cfglist'), `Build configuration list for PBXProject "${N}"`, (c) => id('project', c)),
    ...targets.map((t) => list(T(t, 'cfglist'), `Build configuration list for PBXNativeTarget "${t.name}"`, (c) => T(t, c))),
  ]);
  return `// !$*UTF8*$!\n{\n\tarchiveVersion = 1;\n\tclasses = {\n\t};\n\tobjectVersion = 77;\n\tobjects = {\n\n${out.join('\n')}\t};\n\trootObject = ${id('project')} /* Project object */;\n}\n`;
}

export function scheme(s) {
  const N = s.name;
  const ref = (key, name, product) => `<BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "${oid(N, key, 'target')}"
               BuildableName = "${product}"
               BlueprintName = "${name}"
               ReferencedContainer = "container:${N}.xcodeproj">
            </BuildableReference>`;
  const app = ref('app', N, `${N}.app`);
  const testables = [['tests', `${N}Tests`]].concat(s.uiTests ? [['uitests', `${N}UITests`]] : [])
    .map(([key, name]) => `         <TestableReference
            skipped = "NO"
            parallelizable = "${key === 'tests' ? 'YES' : 'NO'}">
            ${ref(key, name, `${name}.xctest`)}
         </TestableReference>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "2610"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES"
      buildArchitectures = "Automatic">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            ${app}
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES"
      shouldAutocreateTestPlan = "YES">
      <Testables>
${testables}
      </Testables>
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         ${app}
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         ${app}
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
`;
}

const ASSETS = {
  'Contents.json': { info: { author: 'xcode', version: 1 } },
  'AccentColor.colorset/Contents.json': { colors: [{ idiom: 'universal' }], info: { author: 'xcode', version: 1 } },
  'AppIcon.appiconset/Contents.json': {
    images: [
      { idiom: 'universal', platform: 'ios', size: '1024x1024' },
      { appearances: [{ appearance: 'luminosity', value: 'dark' }], idiom: 'universal', platform: 'ios', size: '1024x1024' },
      { appearances: [{ appearance: 'luminosity', value: 'tinted' }], idiom: 'universal', platform: 'ios', size: '1024x1024' },
    ],
    info: { author: 'xcode', version: 1 },
  },
};

function writeIfMissing(file, text) {
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return true;
}

// The course's topic lessons for the given modules, numbered as the course
// numbers them: lesson k of module N is N.k, and Worked Examples lessons are
// practice, not topics.
export async function courseLessons(modules) {
  const files = fs.readdirSync(path.join(ROOT, 'src/content')).filter((f) => /^\d\d-.*\.js$/.test(f)).sort();
  const out = [];
  for (const f of files) {
    const m = (await import(path.join(ROOT, 'src/content', f))).default;
    if (!modules.includes(m.number)) continue;
    m.lessons.filter((l) => !l.id.endsWith('-worked-examples')).forEach((l, i) => out.push({ number: `${m.number}.${i + 1}`, title: l.title, id: l.id }));
  }
  return out;
}

const swiftString = (s) => JSON.stringify(s).replace(/\\u([0-9a-f]{4})/g, (_, h) => `\\u{${h}}`);

// A starter app for a brand-new sample. Lesson screens are added by hand.
async function scaffold(dir, s) {
  const N = s.name;
  const lessons = await courseLessons(s.modules);
  writeIfMissing(path.join(dir, N, 'ContentView.swift'), `// ContentView.swift
// Who: SwiftUI shows this view first, inside the app's window.
// What: the home screen, listing every lesson this app demonstrates.
// Where: created by ${N}App; each row opens one lesson screen.
// When: at launch, and again whenever the student returns to the list.
// Why: one screen per lesson, in course order, mirrors the course page.

import SwiftUI // SwiftUI provides View and Text.

struct ContentView: View { // The home screen.
    /// Every lesson in this app, numbered and titled exactly as on the course page.
    static let lessons: [Lesson] = [ // static: one shared list, also read by the tests.
${lessons.map((l) => `        Lesson(number: "${l.number}", title: ${swiftString(l.title)}, summary: "Coming soon."),`).join('\n')}
    ]

    var body: some View { // Built once at launch.
        LessonCatalog(title: ${swiftString(s.title)}, lessons: Self.lessons) { lesson in // The shared list from CourseKit.
            switch lesson.number { // Picks the screen for the tapped lesson.
            default: Text(lesson.title) // Placeholder until the lesson's screen exists.
            }
        }
    }
}

#Preview { // Shows the home screen in Xcode's canvas.
    ContentView() // The whole list.
}
`);
  for (const [rel, json] of Object.entries(ASSETS)) writeIfMissing(path.join(dir, N, 'Assets.xcassets', rel), JSON.stringify(json, null, 2) + '\n');
  writeIfMissing(path.join(dir, N, `${N}App.swift`), `// ${N}App.swift
// Who: iOS launches the app here; SwiftUI creates the window.
// What: the app's entry point, which shows the home screen.
// Where: the top of the app; every other screen opens from ContentView.
// When: once per launch, before any screen appears.
// Why: @main marks where the program starts, so no main() function is needed.

import SwiftUI // SwiftUI provides App, Scene and WindowGroup.

@main // Tells Swift that this type is where the program starts.
struct ${N}App: App { // The App protocol describes the app's scenes.
    var body: some Scene { // SwiftUI reads this property once, at launch.
        WindowGroup { // One window on iPhone; iPad can open several.
            ContentView() // The home screen: the list of lessons.
        }
    }
}
`);
  writeIfMissing(path.join(dir, `${N}Tests`, `${N}Tests.swift`), `// ${N}Tests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks that the home screen lists each lesson once, in course order.
// Where: the ${N}Tests target, which can see the app's code through @testable import.
// When: only when tests run; test code never ships inside the app.
// Why: a broken lesson list would hide a whole screen from students.

import Testing // Swift Testing: @Test and #expect.
@testable import ${N} // Lets the tests see the app's internal types.

@MainActor // The app's types live on the main actor (the app target's default isolation), so the suite runs there too.
struct CatalogTests { // A suite: related tests grouped in one type.
    @Test func lessonNumbersAreUnique() { // One test; its name says what it checks.
        let numbers = ContentView.lessons.map(\\.number) // Every lesson number in the catalog.
        #expect(Set(numbers).count == numbers.count) // A set drops duplicates, so the counts match only when all are unique.
    }
}
`);
  if (s.widget) {
    const W = s.widget.name;
    for (const [rel, json] of Object.entries({ ...ASSETS, 'WidgetBackground.colorset/Contents.json': ASSETS['AccentColor.colorset/Contents.json'] })) {
      if (rel.startsWith('AppIcon')) continue;
      writeIfMissing(path.join(dir, W, 'Assets.xcassets', rel), JSON.stringify(json, null, 2) + '\n');
    }
    writeIfMissing(path.join(dir, W, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>NSExtension</key>
	<dict>
		<key>NSExtensionPointIdentifier</key>
		<string>com.apple.widgetkit-extension</string>
	</dict>
</dict>
</plist>
`);
  }
}

export async function buildSample(dir) {
  const s = JSON.parse(fs.readFileSync(path.join(dir, 'sample.json'), 'utf8'));
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(s.name)) throw new Error(`${dir}: name must be one word of letters and digits`);
  const proj = path.join(dir, `${s.name}.xcodeproj`);
  fs.mkdirSync(path.join(proj, 'project.xcworkspace'), { recursive: true });
  fs.mkdirSync(path.join(proj, 'xcshareddata/xcschemes'), { recursive: true });
  fs.writeFileSync(path.join(proj, 'project.pbxproj'), pbxproj(s));
  fs.writeFileSync(path.join(proj, 'project.xcworkspace/contents.xcworkspacedata'), '<?xml version="1.0" encoding="UTF-8"?>\n<Workspace\n   version = "1.0">\n   <FileRef\n      location = "self:">\n   </FileRef>\n</Workspace>\n');
  fs.writeFileSync(path.join(proj, `xcshareddata/xcschemes/${s.name}.xcscheme`), scheme(s));
  await scaffold(dir, s);
  fs.mkdirSync(path.join(dir, s.name, 'Shared'), { recursive: true });
  fs.copyFileSync(COURSEKIT, path.join(dir, s.name, 'Shared/CourseKit.swift'));
  return s;
}

// ------------------------------------------------------------ the guide page
const LANGUAGE = { en: 'English', es: 'Spanish', fr: 'French', de: 'German' };
const sampleDirs = () => fs.readdirSync(SAMPLES).filter((d) => fs.existsSync(path.join(SAMPLES, d, 'sample.json'))).sort();
const swiftLiteral = (lit) => JSON.parse(lit.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h) => `\\u${h.padStart(4, '0')}`));

// Everything the guide page shows, read from the samples themselves.
export async function collectSamples() {
  const files = fs.readdirSync(path.join(ROOT, 'src/content')).filter((f) => /^\d\d-.*\.js$/.test(f)).sort();
  const modules = [];
  for (const f of files) modules.push((await import(path.join(ROOT, 'src/content', f))).default);
  modules.sort((a, b) => a.number - b.number);
  const course = modules.map((m) => ({ number: m.number, title: m.title, short: m.short, summary: m.summary,
    lessons: m.lessons.filter((l) => !l.id.endsWith('-worked-examples')).map((l, i) => ({ number: `${m.number}.${i + 1}`, title: l.title })) }));
  const apps = sampleDirs().map((dir) => {
    const s = JSON.parse(fs.readFileSync(path.join(SAMPLES, dir, 'sample.json'), 'utf8'));
    const src = path.join(SAMPLES, dir, s.name);
    const content = fs.readFileSync(path.join(src, 'ContentView.swift'), 'utf8');
    const lessonDir = path.join(src, 'Lessons');
    const lessonFiles = fs.existsSync(lessonDir) ? fs.readdirSync(lessonDir).filter((f) => f.endsWith('.swift')) : [];
    const lessons = [...content.matchAll(/Lesson\(number: "(\d+\.\d+)", title: ("(?:[^"\\]|\\.)*"), summary: ("(?:[^"\\]|\\.)*")\)/g)].map((m) => ({
      number: m[1], title: swiftLiteral(m[2]), summary: swiftLiteral(m[3]),
      file: lessonFiles.find((f) => f.startsWith(`Lesson_${m[1].replace('.', '_')}_`)) || null,
    }));
    const testDir = path.join(SAMPLES, dir, `${s.name}Tests`);
    const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.swift') ? [path.join(d, e.name)] : [])) : []);
    const tests = walk(testDir).reduce((n, f) => n + (fs.readFileSync(f, 'utf8').match(/^\s*@Test\b/gm) || []).length, 0);
    const mods = s.modules.map((n) => course.find((m) => m.number === n));
    const moduleLabel = mods.length > 1
      ? `Modules ${mods[0].number}-${mods[mods.length - 1].number} · ${mods.map((m) => m.short || m.title).join(' and ')}`
      : `Module ${mods[0].number} · ${mods[0].short || mods[0].title}`;
    return {
      dir, slug: `app-${dir.slice(0, 2)}`, name: s.name, title: s.title, modules: s.modules, moduleLabel,
      about: s.about || mods.map((m) => m.summary).join(' '), notes: s.notes || [], lessons, tests,
      uiTests: !!s.uiTests, widget: s.widget ? s.widget.title || s.widget.name : null,
      languages: (s.regions || []).filter((r) => r !== 'Base').map((r) => LANGUAGE[r] || r),
    };
  });
  const lessonCount = course.reduce((n, m) => n + m.lessons.length, 0);
  return { course, apps, lessonCount, tokens: fs.readFileSync(path.join(ROOT, 'src/app/tokens.css'), 'utf8') };
}

export async function buildPage() {
  const { renderSamplesPage } = await import('../src/samples/page.js');
  return renderSamplesPage(await collectSamples());
}

async function writePdf(htmlFile, pdfFile) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
    await page.goto(`file://${htmlFile}`, { waitUntil: 'networkidle' });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: pdfFile, format: 'Letter', printBackground: true, displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="font:9px -apple-system,sans-serif;color:#777;width:100%;padding:0 14mm;display:flex;justify-content:space-between"><span>Sample Apps</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
      margin: { top: '14mm', bottom: '16mm', left: '14mm', right: '14mm' } });
  } finally { await browser.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const named = args.filter((a) => !a.startsWith('--'));
  if (!flags.has('--page-only')) {
    const dirs = named.length ? named.map((d) => path.resolve(d)) : sampleDirs().map((d) => path.join(SAMPLES, d));
    for (const d of dirs) console.log(`${path.relative(ROOT, d)}: ${(await buildSample(d)).name}.xcodeproj`);
  }
  if (flags.has('--page') || flags.has('--page-only') || flags.has('--pdf')) {
    const html = path.join(SAMPLES, 'sample-apps.html');
    fs.writeFileSync(html, await buildPage());
    console.log('samples/sample-apps.html');
    if (flags.has('--pdf')) { await writePdf(html, path.join(SAMPLES, 'sample-apps.pdf')); console.log('samples/sample-apps.pdf'); }
  }
}

// swift-tools-version: 6.2
import PackageDescription
let package = Package(name: "FMTTranscribe", platforms: [.macOS(.v15)], dependencies: [.package(path: "../../.runtime-desert-ant/sdk")], targets: [.executableTarget(name: "FMTTranscribe", dependencies: [.product(name: "Voz", package: "sdk"), .product(name: "Who", package: "sdk"), .product(name: "Ear", package: "sdk")])])

import Foundation
import CoreGraphics

let maxDisplays: UInt32 = 16
var activeDisplays = [CGDirectDisplayID](repeating: 0, count: Int(maxDisplays))
var displayCount: UInt32 = 0

let result = CGGetActiveDisplayList(maxDisplays, &activeDisplays, &displayCount)
if result != .success {
    exit(0)
}

for index in 0..<Int(displayCount) {
    let displayId = activeDisplays[index]
    let bounds = CGDisplayBounds(displayId)
    let isMain = CGDisplayIsMain(displayId) != 0

    let x = Int(bounds.origin.x.rounded())
    let y = Int(bounds.origin.y.rounded())
    let width = Int(bounds.size.width.rounded())
    let height = Int(bounds.size.height.rounded())

    print("\(displayId)\t\(isMain ? 1 : 0)\t\(x)\t\(y)\t\(width)\t\(height)")
}

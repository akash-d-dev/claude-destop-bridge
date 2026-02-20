import Foundation
import CoreGraphics

func sanitize(_ value: String) -> String {
    return value
        .replacingOccurrences(of: "\t", with: " ")
        .replacingOccurrences(of: "\n", with: " ")
        .replacingOccurrences(of: "\r", with: " ")
}

let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
guard let rawList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
    exit(0)
}

for window in rawList {
    guard let id = window[kCGWindowNumber as String] as? Int, id > 0 else {
        continue
    }

    let ownerName = sanitize(window[kCGWindowOwnerName as String] as? String ?? "")
    let title = sanitize(window[kCGWindowName as String] as? String ?? "")

    if ownerName.isEmpty {
        continue
    }

    print("\(id)\t\(ownerName)\t\(title)")
}

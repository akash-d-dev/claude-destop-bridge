import Foundation
import CoreGraphics
import AppKit

enum NavigationAction: String {
    case up
    case down
    case end
}

func activateClaude() {
    if let app = NSWorkspace.shared.runningApplications.first(where: { $0.localizedName == "Claude" }) {
        app.activate(options: [])
    }
}

func claudeWindowCenter() -> CGPoint? {
    let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
    guard let rawList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
        return nil
    }

    for window in rawList {
        guard let owner = window[kCGWindowOwnerName as String] as? String, owner == "Claude" else {
            continue
        }

        guard let boundsDict = window[kCGWindowBounds as String] as? [String: Any],
              let bounds = CGRect(dictionaryRepresentation: boundsDict as CFDictionary),
              bounds.width > 200,
              bounds.height > 200 else {
            continue
        }

        return CGPoint(x: bounds.midX, y: bounds.midY)
    }

    return nil
}

func fallbackCenterPoint() -> CGPoint {
    let mainBounds = CGDisplayBounds(CGMainDisplayID())
    return CGPoint(x: mainBounds.midX, y: mainBounds.midY)
}

func click(at point: CGPoint, source: CGEventSource) {
    let move = CGEvent(
        mouseEventSource: source,
        mouseType: .mouseMoved,
        mouseCursorPosition: point,
        mouseButton: .left
    )
    move?.post(tap: .cghidEventTap)
    usleep(10_000)

    let down = CGEvent(
        mouseEventSource: source,
        mouseType: .leftMouseDown,
        mouseCursorPosition: point,
        mouseButton: .left
    )
    down?.post(tap: .cghidEventTap)
    usleep(12_000)

    let up = CGEvent(
        mouseEventSource: source,
        mouseType: .leftMouseUp,
        mouseCursorPosition: point,
        mouseButton: .left
    )
    up?.post(tap: .cghidEventTap)
}

func sendKey(_ keyCode: CGKeyCode, flags: CGEventFlags = [], source: CGEventSource) {
    let keyDown = CGEvent(
        keyboardEventSource: source,
        virtualKey: keyCode,
        keyDown: true
    )
    keyDown?.flags = flags
    keyDown?.post(tap: .cghidEventTap)
    usleep(8_000)

    let keyUp = CGEvent(
        keyboardEventSource: source,
        virtualKey: keyCode,
        keyDown: false
    )
    keyUp?.flags = flags
    keyUp?.post(tap: .cghidEventTap)
}

guard CommandLine.arguments.count >= 2,
      let action = NavigationAction(rawValue: CommandLine.arguments[1].lowercased()) else {
    fputs("Usage: swift navigate_main_view.swift <up|down|end>\n", stderr)
    exit(1)
}

guard let eventSource = CGEventSource(stateID: .hidSystemState) else {
    fputs("Unable to create event source\n", stderr)
    exit(1)
}

activateClaude()
usleep(90_000)

let targetPoint = claudeWindowCenter() ?? fallbackCenterPoint()
print("action=\(action.rawValue) clickX=\(Int(targetPoint.x)) clickY=\(Int(targetPoint.y))")
click(at: targetPoint, source: eventSource)
usleep(80_000)

switch action {
case .up:
    for _ in 0..<4 {
        sendKey(126, source: eventSource) // Up Arrow
        usleep(14_000)
    }
case .down:
    for _ in 0..<4 {
        sendKey(125, source: eventSource) // Down Arrow
        usleep(14_000)
    }
case .end:
    sendKey(125, flags: .maskCommand, source: eventSource) // Cmd + Down Arrow
}


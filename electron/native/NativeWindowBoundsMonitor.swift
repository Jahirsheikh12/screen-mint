import Foundation
import ApplicationServices
import CoreGraphics

struct TargetWindowInfo {
	let windowID: CGWindowID
	let pid: pid_t
	let title: String?
	let bounds: CGRect
}

var targetWindowInfo: TargetWindowInfo?
var targetWindowElement: AXUIElement?
var axObserver: AXObserver?

func cgRect(from dictionary: NSDictionary?) -> CGRect? {
	guard let dictionary else {
		return nil
	}

	return CGRect(dictionaryRepresentation: dictionary)
}

func currentTargetWindowInfo(windowID: CGWindowID) -> TargetWindowInfo? {
	let options = CGWindowListOption(arrayLiteral: .optionIncludingWindow)
	guard
		let windowList = CGWindowListCopyWindowInfo(options, windowID) as? [[String: Any]],
		let entry = windowList.first
	else {
		return nil
	}

	guard
		let ownerPID = entry[kCGWindowOwnerPID as String] as? pid_t,
		let boundsDictionary = entry[kCGWindowBounds as String] as? NSDictionary,
		let bounds = cgRect(from: boundsDictionary)
	else {
		return nil
	}

	let title = (entry[kCGWindowName as String] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
	return TargetWindowInfo(windowID: windowID, pid: ownerPID, title: title, bounds: bounds)
}

func axValue<T>(_ value: CFTypeRef?, as type: AXValueType, into pointer: inout T) -> Bool {
	guard let value, CFGetTypeID(value) == AXValueGetTypeID() else {
		return false
	}

	let axValue = unsafeBitCast(value, to: AXValue.self)
	return AXValueGetType(axValue) == type && AXValueGetValue(axValue, type, &pointer)
}

func copyWindowBounds(_ element: AXUIElement) -> CGRect? {
	var positionValue: CFTypeRef?
	var sizeValue: CFTypeRef?
	guard
		AXUIElementCopyAttributeValue(element, kAXPositionAttribute as CFString, &positionValue) == .success,
		AXUIElementCopyAttributeValue(element, kAXSizeAttribute as CFString, &sizeValue) == .success
	else {
		return nil
	}

	var position = CGPoint.zero
	var size = CGSize.zero
	guard
		axValue(positionValue, as: .cgPoint, into: &position),
		axValue(sizeValue, as: .cgSize, into: &size)
	else {
		return nil
	}

	return CGRect(origin: position, size: size)
}

func copyWindowTitle(_ element: AXUIElement) -> String? {
	var value: CFTypeRef?
	guard AXUIElementCopyAttributeValue(element, kAXTitleAttribute as CFString, &value) == .success else {
		return nil
	}

	return (value as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
}

func enumerateAXWindows(pid: pid_t) -> [AXUIElement] {
	let appElement = AXUIElementCreateApplication(pid)
	var value: CFTypeRef?
	guard AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &value) == .success else {
		return []
	}

	return value as? [AXUIElement] ?? []
}

func matchWindowElement(info: TargetWindowInfo) -> AXUIElement? {
	let windows = enumerateAXWindows(pid: info.pid)
	if windows.isEmpty {
		return nil
	}

	let normalizedTargetTitle = info.title?.lowercased()
	var bestMatch: (element: AXUIElement, score: Double)?

	for window in windows {
		guard let bounds = copyWindowBounds(window), bounds.width > 0, bounds.height > 0 else {
			continue
		}

		let title = copyWindowTitle(window)?.lowercased()
		let titleMatches = normalizedTargetTitle != nil && title == normalizedTargetTitle
		let originDistance = Double(hypot(bounds.origin.x - info.bounds.origin.x, bounds.origin.y - info.bounds.origin.y))
		let sizeDistance = Double(hypot(bounds.width - info.bounds.width, bounds.height - info.bounds.height))
		let score = (titleMatches ? 10_000.0 : 0.0) - originDistance - sizeDistance

		if bestMatch == nil || score > bestMatch!.score {
			bestMatch = (window, score)
		}
	}

	return bestMatch?.element
}

func emitBounds(_ bounds: CGRect) {
	let payload: [String: Double] = [
		"x": bounds.origin.x,
		"y": bounds.origin.y,
		"width": bounds.width,
		"height": bounds.height,
	]

	guard let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]) else {
		return
	}

	FileHandle.standardOutput.write(Data("BOUNDS:".utf8))
	FileHandle.standardOutput.write(data)
	FileHandle.standardOutput.write(Data("\n".utf8))
}

func emitCurrentBounds() {
	if let element = targetWindowElement, let bounds = copyWindowBounds(element) {
		emitBounds(bounds)
		return
	}

	if let info = targetWindowInfo {
		emitBounds(info.bounds)
	}
}

let callback: AXObserverCallback = { _, _, _, _ in
	emitCurrentBounds()
}

func stopRunLoop() {
	CFRunLoopStop(CFRunLoopGetMain())
}

func startStdinStopListener() {
	FileHandle.standardInput.readabilityHandler = { handle in
		let data = handle.availableData
		if data.isEmpty {
			stopRunLoop()
			return
		}

		guard let text = String(data: data, encoding: .utf8) else {
			return
		}

		if text.contains("stop") {
			stopRunLoop()
		}
	}
}

guard CommandLine.arguments.count >= 2, let requestedWindowID = UInt32(CommandLine.arguments[1]) else {
	fputs("Missing window id argument\n", stderr)
	exit(1)
}

guard AXIsProcessTrusted() else {
	fputs("Accessibility permission is required for window bounds monitoring\n", stderr)
	exit(2)
}

guard let info = currentTargetWindowInfo(windowID: requestedWindowID) else {
	fputs("Unable to resolve target window info\n", stderr)
	exit(3)
}

targetWindowInfo = info

guard let matchedWindow = matchWindowElement(info: info) else {
	fputs("Unable to match target AX window\n", stderr)
	exit(4)
}

targetWindowElement = matchedWindow

var observerRef: AXObserver?
let observerResult = AXObserverCreate(info.pid, callback, &observerRef)
guard observerResult == .success, let observerRef else {
	fputs("Failed to create AXObserver\n", stderr)
	exit(5)
}

axObserver = observerRef

let notifications = [
	kAXMovedNotification as CFString,
	kAXResizedNotification as CFString,
	kAXUIElementDestroyedNotification as CFString,
]

var registeredNotification = false
for notification in notifications {
	let result = AXObserverAddNotification(observerRef, matchedWindow, notification, nil)
	if result == .success {
		registeredNotification = true
	}
}

guard registeredNotification else {
	fputs("Failed to subscribe to window notifications\n", stderr)
	exit(6)
}

CFRunLoopAddSource(CFRunLoopGetMain(), AXObserverGetRunLoopSource(observerRef), .defaultMode)
startStdinStopListener()
emitCurrentBounds()
CFRunLoopRun()
FileHandle.standardInput.readabilityHandler = nil

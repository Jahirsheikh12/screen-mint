import Foundation
import Speech

struct AvailabilityResponse: Codable {
	let available: Bool
	let message: String?
	let supportedLanguages: [String]
}

struct TranscriptionRequest: Codable {
	let audioPath: String
	let language: String
	let contextualStrings: [String]?
}

struct WordResponse: Codable {
	let text: String
	let startMs: Int
	let endMs: Int
	let confidence: Double?
}

struct TranscriptionResponse: Codable {
	let language: String
	let words: [WordResponse]
}

enum HelperError: Error, LocalizedError {
	case message(String)

	var errorDescription: String? {
		switch self {
		case .message(let value):
			return value
		}
	}
}

func printJSON<T: Encodable>(_ value: T) throws {
	let encoder = JSONEncoder()
	encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
	let data = try encoder.encode(value)
	FileHandle.standardOutput.write(data)
	FileHandle.standardOutput.write("\n".data(using: .utf8)!)
}

func supportedLocaleIdentifiers() -> [String] {
	SFSpeechRecognizer.supportedLocales()
		.map(\.identifier)
		.sorted()
}

let preferredLocaleByLanguage: [String: String] = [
	"ar": "ar-SA",
	"cs": "cs-CZ",
	"da": "da-DK",
	"de": "de-DE",
	"el": "el-GR",
	"en": "en-US",
	"es": "es-ES",
	"fi": "fi-FI",
	"fr": "fr-FR",
	"he": "he-IL",
	"hi": "hi-IN",
	"hr": "hr-HR",
	"hu": "hu-HU",
	"id": "id-ID",
	"it": "it-IT",
	"ja": "ja-JP",
	"ko": "ko-KR",
	"ms": "ms-MY",
	"nb": "nb-NO",
	"nl": "nl-NL",
	"no": "nb-NO",
	"pl": "pl-PL",
	"pt": "pt-BR",
	"ro": "ro-RO",
	"ru": "ru-RU",
	"sk": "sk-SK",
	"sv": "sv-SE",
	"th": "th-TH",
	"tr": "tr-TR",
	"uk": "uk-UA",
	"vi": "vi-VN",
	"wuu": "wuu-CN",
	"yue": "yue-CN",
	"zh": "zh-CN"
]

func resolveLocaleIdentifier(for language: String) -> String? {
	let trimmed = language.trimmingCharacters(in: .whitespacesAndNewlines)
	if trimmed.isEmpty || trimmed.lowercased() == "auto" {
		return nil
	}

	let normalized = trimmed.replacingOccurrences(of: "_", with: "-").lowercased()
	let locales = supportedLocaleIdentifiers()
	if let exact = locales.first(where: { $0.lowercased() == normalized }) {
		return exact
	}

	if let prefix = normalized.split(separator: "-").first.map(String.init) {
		if let preferred = preferredLocaleByLanguage[prefix],
		   let exactPreferred = locales.first(where: { $0.lowercased() == preferred.lowercased() }) {
			return exactPreferred
		}
		if let matching = locales.first(where: { $0.lowercased().hasPrefix(prefix + "-") }) {
			return matching
		}
		if locales.contains(where: { $0.lowercased() == prefix }) {
			return prefix
		}
	}

	return nil
}

func authorizationStatusDescription(_ status: SFSpeechRecognizerAuthorizationStatus) -> String? {
	switch status {
	case .authorized:
		return nil
	case .notDetermined:
		return "Speech recognition permission will be requested when transcription starts."
	case .denied:
		return "Speech recognition permission is denied for this app."
	case .restricted:
		return "Speech recognition is restricted on this Mac."
	@unknown default:
		return "Speech recognition is unavailable on this Mac."
	}
}

func currentAuthorizationStatus() -> SFSpeechRecognizerAuthorizationStatus {
	SFSpeechRecognizer.authorizationStatus()
}

func requestSpeechAuthorization() throws {
	let status = currentAuthorizationStatus()
	if status == .authorized {
		return
	}

	let semaphore = DispatchSemaphore(value: 0)
	var finalStatus = status
	SFSpeechRecognizer.requestAuthorization { updatedStatus in
		finalStatus = updatedStatus
		semaphore.signal()
	}

	_ = semaphore.wait(timeout: .now() + 15)
	guard finalStatus == .authorized else {
		throw HelperError.message(
			authorizationStatusDescription(finalStatus) ?? "Speech recognition permission was not granted."
		)
	}
}

func availability(language: String?) -> AvailabilityResponse {
	let locales = supportedLocaleIdentifiers()
	let requestedLanguage = language ?? ""
	guard let localeIdentifier = resolveLocaleIdentifier(for: requestedLanguage.isEmpty ? "en-US" : requestedLanguage) else {
		return AvailabilityResponse(
			available: false,
			message: requestedLanguage.isEmpty || requestedLanguage == "auto"
				? "Apple Speech requires a fixed language."
				: "Apple Speech does not support the selected language on this Mac.",
			supportedLanguages: locales
		)
	}

	guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeIdentifier)) else {
		return AvailabilityResponse(
			available: false,
			message: "Apple Speech is unavailable for the selected language on this Mac.",
			supportedLanguages: locales
		)
	}

	guard recognizer.supportsOnDeviceRecognition else {
		return AvailabilityResponse(
			available: false,
			message: "On-device Apple Speech is unavailable for the selected language on this Mac.",
			supportedLanguages: locales
		)
	}

	return AvailabilityResponse(
		available: true,
		message: authorizationStatusDescription(currentAuthorizationStatus()),
		supportedLanguages: locales
	)
}

func transcribe(requestPath: String) throws -> TranscriptionResponse {
	let requestURL = URL(fileURLWithPath: requestPath)
	let requestData = try Data(contentsOf: requestURL)
	let request = try JSONDecoder().decode(TranscriptionRequest.self, from: requestData)

	guard let localeIdentifier = resolveLocaleIdentifier(for: request.language) else {
		throw HelperError.message("Apple Speech requires a fixed supported language.")
	}

	try requestSpeechAuthorization()

	guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeIdentifier)) else {
		throw HelperError.message("Apple Speech is unavailable for the selected language on this Mac.")
	}

	guard recognizer.supportsOnDeviceRecognition else {
		throw HelperError.message("On-device Apple Speech is unavailable for the selected language on this Mac.")
	}

	let audioURL = URL(fileURLWithPath: request.audioPath)
	guard FileManager.default.fileExists(atPath: audioURL.path) else {
		throw HelperError.message("Audio file for Apple Speech transcription was not found.")
	}

	let recognitionRequest = SFSpeechURLRecognitionRequest(url: audioURL)
	recognitionRequest.requiresOnDeviceRecognition = true
	recognitionRequest.shouldReportPartialResults = false
	if let contextualStrings = request.contextualStrings, !contextualStrings.isEmpty {
		recognitionRequest.contextualStrings = contextualStrings
	}

	let semaphore = DispatchSemaphore(value: 0)
	var finalResult: SFSpeechRecognitionResult?
	var finalError: Error?
	let task = recognizer.recognitionTask(with: recognitionRequest) { result, error in
		if let result = result {
			finalResult = result
			if result.isFinal {
				semaphore.signal()
			}
		}

		if let error = error {
			finalError = error
			semaphore.signal()
		}
	}

	let waitResult = semaphore.wait(timeout: .now() + 300)
	task.cancel()

	if waitResult == .timedOut {
		throw HelperError.message("Apple Speech transcription timed out.")
	}

	if let finalError = finalError {
		throw finalError
	}

	guard let result = finalResult else {
		throw HelperError.message("Apple Speech did not return a transcript.")
	}

	let words = result.bestTranscription.segments.map { segment in
		WordResponse(
			text: segment.substring,
			startMs: Int((segment.timestamp * 1000.0).rounded()),
			endMs: Int(((segment.timestamp + segment.duration) * 1000.0).rounded()),
			confidence: Double(segment.confidence)
		)
	}

	return TranscriptionResponse(language: localeIdentifier, words: words)
}

do {
	let arguments = CommandLine.arguments
	guard arguments.count >= 2 else {
		throw HelperError.message("Missing command. Use 'availability' or 'transcribe'.")
	}

	switch arguments[1] {
	case "availability":
		let language = arguments.count >= 3 ? arguments[2] : nil
		try printJSON(availability(language: language))
	case "transcribe":
		guard arguments.count >= 3 else {
			throw HelperError.message("Missing transcription request path.")
		}
		try printJSON(transcribe(requestPath: arguments[2]))
	default:
		throw HelperError.message("Unknown command.")
	}
} catch {
	let message = (error as? LocalizedError)?.errorDescription ?? String(describing: error)
	FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
	exit(1)
}

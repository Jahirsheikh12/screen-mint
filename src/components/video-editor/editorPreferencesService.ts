import {
	type EditorPreferences,
	type EditorPreferencesService as EditorPreferencesServiceContract,
	loadEditorPreferences,
	saveEditorPreferences,
} from "./editorPreferences";

export interface EditorPreferencesService extends EditorPreferencesServiceContract {}

export function createEditorPreferencesService(options: { debounceMs?: number } = {}) {
	const debounceMs = options.debounceMs ?? 180;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let queuedPreferences: Partial<EditorPreferences> | null = null;

	const flush = () => {
		if (!queuedPreferences) {
			return;
		}

		const preferences = queuedPreferences;
		queuedPreferences = null;
		saveEditorPreferences(preferences);
	};

	return {
		load() {
			return loadEditorPreferences();
		},
		save(preferences: Partial<EditorPreferences>) {
			queuedPreferences = null;
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			saveEditorPreferences(preferences);
		},
		scheduleSave(preferences: Partial<EditorPreferences>) {
			queuedPreferences = {
				...(queuedPreferences ?? {}),
				...preferences,
			};
			if (timer) {
				clearTimeout(timer);
			}
			timer = setTimeout(() => {
				timer = null;
				flush();
			}, debounceMs);
		},
		flush() {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			flush();
		},
		cancel() {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			queuedPreferences = null;
		},
	};
}

export const editorPreferencesService = createEditorPreferencesService();

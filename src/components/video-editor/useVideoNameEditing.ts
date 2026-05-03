import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeVideoDisplayName } from "@/lib/fileNames";

export function useVideoNameEditing(initialName = "Untitled") {
	const [videoName, setVideoName] = useState(initialName);
	const [draftVideoName, setDraftVideoName] = useState(initialName);
	const [isEditingVideoName, setIsEditingVideoName] = useState(false);
	const videoNameInputRef = useRef<HTMLInputElement | null>(null);
	const videoNameEditCanceledRef = useRef(false);

	useEffect(() => {
		if (!isEditingVideoName) {
			return;
		}

		requestAnimationFrame(() => {
			videoNameInputRef.current?.focus();
			videoNameInputRef.current?.select();
		});
	}, [isEditingVideoName]);

	const startVideoNameEdit = useCallback(() => {
		setDraftVideoName(videoName);
		setIsEditingVideoName(true);
	}, [videoName]);

	const commitVideoNameEdit = useCallback(() => {
		const nextVideoName = normalizeVideoDisplayName(draftVideoName);
		setVideoName(nextVideoName);
		setDraftVideoName(nextVideoName);
		setIsEditingVideoName(false);
	}, [draftVideoName]);

	const cancelVideoNameEdit = useCallback(() => {
		videoNameEditCanceledRef.current = true;
		setDraftVideoName(videoName);
		setIsEditingVideoName(false);
	}, [videoName]);

	const handleVideoNameInputBlur = useCallback(() => {
		if (videoNameEditCanceledRef.current) {
			videoNameEditCanceledRef.current = false;
			return;
		}

		commitVideoNameEdit();
	}, [commitVideoNameEdit]);

	const handleVideoNameInputKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter") {
				event.preventDefault();
				commitVideoNameEdit();
				return;
			}

			if (event.key === "Escape") {
				event.preventDefault();
				cancelVideoNameEdit();
			}
		},
		[cancelVideoNameEdit, commitVideoNameEdit],
	);

	return {
		videoName,
		setVideoName,
		draftVideoName,
		setDraftVideoName,
		isEditingVideoName,
		setIsEditingVideoName,
		videoNameInputRef,
		startVideoNameEdit,
		commitVideoNameEdit,
		cancelVideoNameEdit,
		handleVideoNameInputBlur,
		handleVideoNameInputKeyDown,
	};
}

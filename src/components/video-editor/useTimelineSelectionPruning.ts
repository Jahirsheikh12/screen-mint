import { type Dispatch, type SetStateAction, useEffect } from "react";

type IdentifiedRegion = {
	id: string;
};

type UseTimelineSelectionPruningOptions<
	TZoom extends IdentifiedRegion,
	TAnnotation extends IdentifiedRegion,
	TSpeed extends IdentifiedRegion,
	TAudio extends IdentifiedRegion,
> = {
	selectedZoomId: string | null;
	setSelectedZoomId: Dispatch<SetStateAction<string | null>>;
	zoomRegions: TZoom[];
	selectedAnnotationId: string | null;
	setSelectedAnnotationId: Dispatch<SetStateAction<string | null>>;
	annotationRegions: TAnnotation[];
	selectedSpeedId: string | null;
	setSelectedSpeedId: Dispatch<SetStateAction<string | null>>;
	speedRegions: TSpeed[];
	selectedAudioId: string | null;
	setSelectedAudioId: Dispatch<SetStateAction<string | null>>;
	audioRegions: TAudio[];
};

export function useTimelineSelectionPruning<
	TZoom extends IdentifiedRegion,
	TAnnotation extends IdentifiedRegion,
	TSpeed extends IdentifiedRegion,
	TAudio extends IdentifiedRegion,
>({
	selectedZoomId,
	setSelectedZoomId,
	zoomRegions,
	selectedAnnotationId,
	setSelectedAnnotationId,
	annotationRegions,
	selectedSpeedId,
	setSelectedSpeedId,
	speedRegions,
	selectedAudioId,
	setSelectedAudioId,
	audioRegions,
}: UseTimelineSelectionPruningOptions<TZoom, TAnnotation, TSpeed, TAudio>) {
	useEffect(() => {
		if (selectedZoomId && !zoomRegions.some((region) => region.id === selectedZoomId)) {
			setSelectedZoomId(null);
		}
	}, [selectedZoomId, setSelectedZoomId, zoomRegions]);

	useEffect(() => {
		if (
			selectedAnnotationId &&
			!annotationRegions.some((region) => region.id === selectedAnnotationId)
		) {
			setSelectedAnnotationId(null);
		}
	}, [selectedAnnotationId, setSelectedAnnotationId, annotationRegions]);

	useEffect(() => {
		if (selectedSpeedId && !speedRegions.some((region) => region.id === selectedSpeedId)) {
			setSelectedSpeedId(null);
		}
	}, [selectedSpeedId, setSelectedSpeedId, speedRegions]);

	useEffect(() => {
		if (selectedAudioId && !audioRegions.some((region) => region.id === selectedAudioId)) {
			setSelectedAudioId(null);
		}
	}, [selectedAudioId, setSelectedAudioId, audioRegions]);
}

import { MessageSquare } from "lucide-react";
import { useScopedT } from "@/contexts/I18nContext";
import { AnnotationSettingsPanel } from "../AnnotationSettingsPanel";
import { TabContent, TabHeader } from "../settingsPanelLayout";
import type { AnnotationRegion, AnnotationType, BlurData, FigureData } from "../types";

interface AnnotationSettingsTabProps {
	selectedAnnotation?: AnnotationRegion | null;
	onAnnotationContentChange?: (id: string, content: string) => void;
	onAnnotationTypeChange?: (id: string, type: AnnotationType) => void;
	onAnnotationStyleChange?: (id: string, style: Partial<AnnotationRegion["style"]>) => void;
	onAnnotationFigureDataChange?: (id: string, figureData: FigureData) => void;
	onAnnotationBlurDataChange?: (id: string, blurData: BlurData) => void;
	onAnnotationDelete?: (id: string) => void;
}

export function AnnotationSettingsTab({
	selectedAnnotation,
	onAnnotationContentChange,
	onAnnotationTypeChange,
	onAnnotationStyleChange,
	onAnnotationFigureDataChange,
	onAnnotationBlurDataChange,
	onAnnotationDelete,
}: AnnotationSettingsTabProps) {
	const tSettings = useScopedT("settings");
	return (
		<TabContent>
			{selectedAnnotation &&
			onAnnotationContentChange &&
			onAnnotationTypeChange &&
			onAnnotationStyleChange &&
			onAnnotationDelete ? (
				<>
					<TabHeader
						title={tSettings("annotationTab.annotation", "Annotation")}
						description={tSettings(
							"annotationTab.editTheSelectedAnnotation",
							"Edit the selected annotation's content and style",
						)}
					/>
					<AnnotationSettingsPanel
						annotation={selectedAnnotation}
						onContentChange={(content) => onAnnotationContentChange(selectedAnnotation.id, content)}
						onTypeChange={(type) => onAnnotationTypeChange(selectedAnnotation.id, type)}
						onStyleChange={(style) => onAnnotationStyleChange(selectedAnnotation.id, style)}
						onFigureDataChange={
							onAnnotationFigureDataChange
								? (figureData) => onAnnotationFigureDataChange(selectedAnnotation.id, figureData)
								: undefined
						}
						onBlurDataChange={
							onAnnotationBlurDataChange
								? (blurData) => onAnnotationBlurDataChange(selectedAnnotation.id, blurData)
								: undefined
						}
						onDelete={() => onAnnotationDelete(selectedAnnotation.id)}
						inline
					/>
				</>
			) : (
				<div className="flex flex-col items-center justify-center py-12 text-center">
					<div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/5 shadow-inner flex items-center justify-center mb-4">
						<MessageSquare className="w-7 h-7 text-slate-600" />
					</div>
					<p className="text-sm font-medium text-slate-400">
						{tSettings("annotationTab.noAnnotationSelected", "No Annotation Selected")}
					</p>
					<p className="text-[11px] text-slate-500 mt-1.5 max-w-[200px] leading-relaxed">
						{tSettings(
							"annotationTab.selectAnAnnotationOn",
							"Select an annotation on the timeline to edit its settings",
						)}
					</p>
				</div>
			)}
		</TabContent>
	);
}

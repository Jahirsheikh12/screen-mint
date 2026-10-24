import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";
import type { AutoPolishContentType } from "./autoPolish";
import { SettingsSection } from "./settingsPanelLayout";

// Product Hunt and App Store are brand names and stay as they are in every language.
const CONTENT_TYPES: Array<{ value: AutoPolishContentType; label: string; key?: string }> = [
	{ value: "product-hunt", label: "Product Hunt" },
	{ value: "landing-page", label: "Landing page", key: "editor.polishPanel.landingPage" },
	{ value: "app-store", label: "App Store" },
	{ value: "pitch-deck", label: "Pitch deck", key: "editor.polishPanel.pitchDeck" },
];

interface AutoPolishPanelProps {
	onAutoPolish: (contentType: AutoPolishContentType) => void;
	embedded?: boolean;
}

export function AutoPolishPanel({ onAutoPolish, embedded = false }: AutoPolishPanelProps) {
	const { t } = useI18n();
	const [contentType, setContentType] = useState<AutoPolishContentType>("product-hunt");

	return (
		<div
			className={cn(
				"w-full h-full shrink-0 min-w-0 bg-surface rounded-xl flex flex-col shadow-panel overflow-hidden",
				embedded ? "" : "w-[400px]",
			)}
		>
			<div className="flex-1 min-h-0 min-w-0 overflow-y-auto custom-scrollbar p-4 pb-20 relative">
				<SettingsSection
					title={t("editor.polishPanel.autoPolish", "Auto Polish")}
					description={t(
						"editor.polishPanel.oneClickStudioTemplates",
						"One-click studio templates",
					)}
				>
					<div className="grid grid-cols-[1fr_auto] gap-2 items-center p-3 rounded-lg border border-line bg-fill-subtle">
						<div className="relative w-full group">
							<select
								value={contentType}
								onChange={(event) => setContentType(event.target.value as AutoPolishContentType)}
								className="w-full bg-sunken border border-line hover:border-line-strong focus:border-accent/50 text-fg h-8 px-2.5 rounded-md text-caption outline-none transition-all font-medium appearance-none cursor-pointer pr-8"
							>
								{CONTENT_TYPES.map((type) => (
									<option key={type.value} value={type.value} className="bg-surface">
										{type.key ? t(type.key, type.label) : type.label}
									</option>
								))}
							</select>
							<ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-subtle pointer-events-none group-hover:text-accent-fg transition-colors" />
						</div>
						<button
							type="button"
							className="h-8 px-4 rounded-lg bg-gradient-to-r from-accent to-accent text-fg text-caption font-bold uppercase tracking-wider shadow-sm hover:from-accent hover:to-accent transition-all duration-300"
							onClick={() => onAutoPolish(contentType)}
						>
							{t("editor.polishPanel.apply", "Apply")}
						</button>
					</div>
				</SettingsSection>
			</div>
		</div>
	);
}

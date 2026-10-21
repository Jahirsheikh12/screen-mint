import { ArrowRight, HelpCircle, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n, useScopedT } from "@/contexts/I18nContext";

export function TutorialHelp() {
	const t = useScopedT("editor");
	const { locale } = useI18n();
	// Chinese is written without spaces between words.
	const wordGap = locale.startsWith("zh") ? "" : " ";
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="h-7 px-2 text-label text-fg-muted hover:text-fg hover:bg-fill-hover transition-all gap-1.5"
				>
					<HelpCircle className="w-3.5 h-3.5" />
					<span className="font-medium">{t("tutorial.howTrimmingWorks")}</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-2xl bg-canvas border-line-strong [&>button]:text-fg-muted [&>button:hover]:text-fg">
				<DialogHeader>
					<DialogTitle className="text-xl font-semibold text-fg flex items-center gap-2">
						<Scissors className="w-5 h-5 text-danger-fg" /> {t("tutorial.title")}
					</DialogTitle>
					<DialogDescription className="text-fg-muted">
						{t("tutorial.understanding")}
					</DialogDescription>
				</DialogHeader>
				<div className="mt-4 space-y-8">
					{/* Explanation */}
					<div className="bg-fill-subtle rounded-lg p-4 border border-line">
						<p className="text-fg-muted leading-relaxed">
							{t("tutorial.descriptionP1")}
							{wordGap}
							<span className="text-danger-fg font-bold">{t("tutorial.descriptionRemove")}</span>
							{wordGap}
							{t("tutorial.descriptionP2")}
							{wordGap}
							{t("tutorial.descriptionP3")}
						</p>
					</div>
					{/* Visual Illustration */}
					<div className="space-y-2">
						<h3 className="text-body font-medium text-fg-muted uppercase tracking-wider">
							{t("tutorial.visualExample")}
						</h3>
						<div className="relative h-24 bg-[#000] rounded-lg border border-line-strong flex items-center px-4 overflow-hidden select-none">
							{/* Background track (Kept parts) */}
							<div className="absolute inset-x-4 h-2 bg-track/20 rounded-full overflow-hidden">
								{/* Solid line representing video */}
							</div>
							{/* Removed Segment 1 */}
							<div
								className="absolute left-[20%] h-8 bg-danger/20 border border-danger rounded flex flex-col items-center justify-center z-10"
								style={{ width: "20%" }}
							>
								<span className="text-micro font-bold text-danger-fg bg-sunken px-1 rounded">
									{t("tutorial.removed")}
								</span>
							</div>
							{/* Removed Segment 2 */}
							<div
								className="absolute left-[65%] h-8 bg-danger/20 border border-danger rounded flex flex-col items-center justify-center z-10"
								style={{ width: "15%" }}
							>
								<span className="text-micro font-bold text-danger-fg bg-sunken px-1 rounded">
									{t("tutorial.removed")}
								</span>
							</div>
							{/* Labels for kept parts */}
							<div className="absolute left-[5%] text-micro text-fg-muted font-medium">
								{t("tutorial.kept")}
							</div>
							<div className="absolute left-[50%] text-micro text-fg-muted font-medium">
								{t("tutorial.kept")}
							</div>
							<div className="absolute left-[90%] text-micro text-fg-muted font-medium">
								{t("tutorial.kept")}
							</div>
						</div>
						<div className="flex justify-center mt-2">
							<ArrowRight className="w-4 h-4 text-fg-disabled rotate-90" />
						</div>
						{/* Result */}
						<div className="relative h-12 bg-[#000] rounded-lg border border-line-strong flex items-center justify-center gap-1 px-4 select-none">
							<div
								className="h-8 bg-fill-pressed rounded flex items-center justify-center opacity-80"
								style={{ width: "30%" }}
							>
								<span className="text-micro text-fg font-medium">
									{t("tutorial.part", undefined, { number: "1" })}
								</span>
							</div>
							<div
								className="h-8 bg-fill-pressed rounded flex items-center justify-center opacity-80"
								style={{ width: "30%" }}
							>
								<span className="text-micro text-fg font-medium">
									{t("tutorial.part", undefined, { number: "2" })}
								</span>
							</div>
							<div
								className="h-8 bg-fill-pressed rounded flex items-center justify-center opacity-80"
								style={{ width: "30%" }}
							>
								<span className="text-micro text-fg font-medium">
									{t("tutorial.part", undefined, { number: "3" })}
								</span>
							</div>
							<span className="absolute right-4 text-label text-fg-muted">
								{t("tutorial.finalVideo")}
							</span>
						</div>
					</div>
					{/* Steps */}
					<div className="grid grid-cols-2 gap-4">
						<div className="p-3 rounded bg-fill-subtle border border-line">
							<div className="text-danger-fg font-bold mb-1">{t("tutorial.addTrimStep")}</div>
							<p className="text-label text-fg-muted">{t("tutorial.addTrimDesc")}</p>
						</div>
						<div className="p-3 rounded bg-fill-subtle border border-line">
							<div className="text-danger-fg font-bold mb-1">{t("tutorial.adjustStep")}</div>
							<p className="text-label text-fg-muted">{t("tutorial.adjustDesc")}</p>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

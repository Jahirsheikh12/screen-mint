import { Film, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/contexts/I18nContext";

type ProjectEntry = {
	path: string;
	name: string;
	modifiedAt: number;
	thumbnail: string | null;
};

interface ProjectBrowserDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onOpenProject: (filePath: string) => Promise<boolean>;
}

export function ProjectBrowserDialog({
	open,
	onOpenChange,
	onOpenProject,
}: ProjectBrowserDialogProps) {
	const { t } = useI18n();
	const [projects, setProjects] = useState<ProjectEntry[] | null>(null);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setProjects(null);
		void window.electronAPI.listProjectFiles().then((result) => {
			if (!cancelled) setProjects(result.success ? result.projects : []);
		});
		return () => {
			cancelled = true;
		};
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>{t("dialogs.projectBrowser.projects", "Projects")}</DialogTitle>
					<DialogDescription className="text-fg-subtle">
						{t(
							"dialogs.projectBrowser.recentProjectsAndProjects",
							"Recent projects and projects saved in your recordings folder.",
						)}
					</DialogDescription>
				</DialogHeader>

				{projects === null ? (
					<p className="py-10 text-center text-label text-fg-subtle">
						{t("dialogs.projectBrowser.loadingProjects", "Loading projects\u2026")}
					</p>
				) : projects.length === 0 ? (
					<p className="py-10 text-center text-label text-fg-subtle">
						{t("dialogs.projectBrowser.noSavedProjectsYet", "No saved projects yet")}
					</p>
				) : (
					<ul className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
						{projects.map((project) => (
							<li
								key={project.path}
								className="group overflow-hidden rounded-xl border border-line bg-fill-subtle"
							>
								<button
									type="button"
									onClick={async () => {
										if (await onOpenProject(project.path)) onOpenChange(false);
									}}
									className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
								>
									<div className="flex aspect-video items-center justify-center bg-sunken">
										{project.thumbnail ? (
											<img src={project.thumbnail} alt="" className="h-full w-full object-cover" />
										) : (
											<Film className="h-6 w-6 text-fg-disabled" aria-hidden="true" />
										)}
									</div>
									<div className="px-2.5 pt-2">
										<div className="truncate text-label font-medium text-fg">{project.name}</div>
										<div className="text-micro text-fg-subtle">
											{new Date(project.modifiedAt).toLocaleString()}
										</div>
									</div>
								</button>
								<div className="flex justify-end px-1.5 pb-1.5">
									<button
										type="button"
										aria-label={`Show ${project.name} in folder`}
										onClick={() => void window.electronAPI.revealInFolder(project.path)}
										className="rounded-md p-1.5 text-fg-subtle hover:bg-fill-hover hover:text-fg"
									>
										<FolderOpen className="h-3.5 w-3.5" />
									</button>
								</div>
							</li>
						))}
					</ul>
				)}
			</DialogContent>
		</Dialog>
	);
}

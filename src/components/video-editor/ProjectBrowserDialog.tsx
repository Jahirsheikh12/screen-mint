import { Film, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

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
			<DialogContent className="max-w-3xl bg-[#141416] border-white/10 text-slate-200">
				<DialogHeader>
					<DialogTitle>Projects</DialogTitle>
					<DialogDescription className="text-slate-500">
						Recent projects and projects saved in your recordings folder.
					</DialogDescription>
				</DialogHeader>

				{projects === null ? (
					<p className="py-10 text-center text-xs text-slate-500">Loading projects…</p>
				) : projects.length === 0 ? (
					<p className="py-10 text-center text-xs text-slate-500">No saved projects yet</p>
				) : (
					<ul className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
						{projects.map((project) => (
							<li
								key={project.path}
								className="group overflow-hidden rounded-xl border border-white/5 bg-white/[0.03]"
							>
								<button
									type="button"
									onClick={async () => {
										if (await onOpenProject(project.path)) onOpenChange(false);
									}}
									className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]"
								>
									<div className="flex aspect-video items-center justify-center bg-black/40">
										{project.thumbnail ? (
											<img src={project.thumbnail} alt="" className="h-full w-full object-cover" />
										) : (
											<Film className="h-6 w-6 text-slate-600" aria-hidden="true" />
										)}
									</div>
									<div className="px-2.5 pt-2">
										<div className="truncate text-xs font-medium text-slate-200">
											{project.name}
										</div>
										<div className="text-[10px] text-slate-500">
											{new Date(project.modifiedAt).toLocaleString()}
										</div>
									</div>
								</button>
								<div className="flex justify-end px-1.5 pb-1.5">
									<button
										type="button"
										aria-label={`Show ${project.name} in folder`}
										onClick={() => void window.electronAPI.revealInFolder(project.path)}
										className="rounded-md p-1.5 text-slate-500 hover:bg-white/10 hover:text-slate-200"
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

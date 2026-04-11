import { cn } from "@/lib/utils";

function SkeletonBlock({ className, style }: { className?: string; style?: React.CSSProperties }) {
	return <div className={cn("animate-breathe rounded bg-white/[0.05]", className)} style={style} />;
}

export function VideoEditorSkeleton() {
	return (
		<div className="flex flex-col h-screen bg-[#0c0c0f] overflow-hidden">
			{/* Header Bar */}
			<div className="relative h-11 flex-shrink-0 bg-[#111114] border-b border-white/5 flex items-center px-4">
				{/* Left: macOS traffic lights spacer + action icons */}
				<div className="flex items-center gap-0.5 ml-[72px]">
					{[0, 1, 2, 3].map((i) => (
						<SkeletonBlock
							key={i}
							className="w-8 h-8 rounded-md"
							style={{ animationDelay: `${i * 0.08}s` }}
						/>
					))}
				</div>

				{/* Center: project filename */}
				<div className="absolute left-1/2 -translate-x-1/2">
					<SkeletonBlock className="w-40 h-3.5 rounded-full" />
				</div>

				{/* Right: undo/redo, presets, layout, export */}
				<div className="ml-auto flex items-center gap-0.5">
					<SkeletonBlock className="w-8 h-8 rounded-md" />
					<SkeletonBlock className="w-8 h-8 rounded-md" style={{ animationDelay: "0.05s" }} />
					<div className="w-px h-5 bg-white/[0.06] mx-1.5" />
					<SkeletonBlock className="w-24 h-7 rounded-lg" style={{ animationDelay: "0.1s" }} />
					<SkeletonBlock className="w-8 h-8 rounded-md" style={{ animationDelay: "0.15s" }} />
					<div className="w-px h-5 bg-white/[0.06] mx-1.5" />
					<SkeletonBlock className="w-20 h-8 rounded-lg bg-[#f59e0b]/10" />
				</div>
			</div>

			{/* Main body */}
			<div className="flex-1 min-h-0 flex flex-col">
				{/* Top panel: video preview + settings (~65%) */}
				<div className="flex h-[65%] gap-3 pr-3 pl-3 pt-3">
					{/* Video preview area */}
					<div className="flex-1 min-w-0 rounded-xl overflow-hidden bg-[#111114] border border-white/[0.04] flex items-center justify-center">
						<SkeletonBlock className="w-16 h-16 rounded-2xl" style={{ animationDelay: "0.2s" }} />
					</div>

					{/* Settings sidebar */}
					<div className="w-[400px] shrink-0 min-w-0 bg-[#0A0F0D] border border-white/[0.06] rounded-2xl flex flex-row shadow-2xl shadow-black/40 h-full overflow-hidden">
						{/* Icon nav column */}
						<div className="flex flex-col gap-0.5 p-1.5 border-r border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent">
							{/* Group 1: Capture */}
							{[0, 1, 2].map((i) => (
								<SkeletonBlock
									key={`g1-${i}`}
									className="w-9 h-9 rounded-lg"
									style={{ animationDelay: `${i * 0.1}s` }}
								/>
							))}
							<div className="mx-2 my-1.5 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
							{/* Group 2: Canvas */}
							{[0, 1, 2].map((i) => (
								<SkeletonBlock
									key={`g2-${i}`}
									className="w-9 h-9 rounded-lg"
									style={{ animationDelay: `${(i + 3) * 0.1}s` }}
								/>
							))}
							<div className="mx-2 my-1.5 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
							{/* Group 3: Overlay */}
							{[0, 1, 2].map((i) => (
								<SkeletonBlock
									key={`g3-${i}`}
									className="w-9 h-9 rounded-lg"
									style={{ animationDelay: `${(i + 6) * 0.1}s` }}
								/>
							))}
						</div>

						{/* Content area */}
						<div className="flex-1 min-w-0 p-3 flex flex-col gap-4">
							{/* Tab header */}
							<div className="flex flex-col gap-1.5">
								<SkeletonBlock className="w-24 h-4 rounded-full" />
								<SkeletonBlock
									className="w-52 h-3 rounded-full"
									style={{ animationDelay: "0.1s" }}
								/>
							</div>

							{/* Section 1 */}
							<div className="flex flex-col gap-2">
								<SkeletonBlock className="w-32 h-3 rounded-full" />
								<SkeletonBlock
									className="w-full h-10 rounded-xl"
									style={{ animationDelay: "0.15s" }}
								/>
							</div>

							{/* Section 2 */}
							<div className="flex flex-col gap-2">
								<SkeletonBlock
									className="w-28 h-3 rounded-full"
									style={{ animationDelay: "0.2s" }}
								/>
								<SkeletonBlock
									className="w-full h-10 rounded-xl"
									style={{ animationDelay: "0.25s" }}
								/>
							</div>

							{/* Section 3 */}
							<div className="flex flex-col gap-2">
								<SkeletonBlock
									className="w-36 h-3 rounded-full"
									style={{ animationDelay: "0.3s" }}
								/>
								<SkeletonBlock
									className="w-full h-10 rounded-xl"
									style={{ animationDelay: "0.35s" }}
								/>
							</div>

							{/* Section 4 */}
							<div className="flex flex-col gap-2">
								<SkeletonBlock
									className="w-20 h-3 rounded-full"
									style={{ animationDelay: "0.4s" }}
								/>
								<SkeletonBlock
									className="w-full h-20 rounded-xl"
									style={{ animationDelay: "0.45s" }}
								/>
							</div>
						</div>
					</div>
				</div>

				{/* Resize handle */}
				<div className="h-3 flex items-center justify-center mx-4">
					<div className="w-8 h-1 bg-white/[0.08] rounded-full" />
				</div>

				{/* Timeline panel (~35%) */}
				<div className="flex-1 min-h-0 mx-4 mb-4 rounded-2xl border border-white/5 bg-[#0c0c0f] overflow-hidden flex flex-col">
					{/* Transport bar */}
					<div className="flex items-center px-3 py-1.5 border-b border-white/5 bg-[#111114] gap-2">
						{/* Left: layers dropdown */}
						<SkeletonBlock className="w-28 h-7 rounded-lg" />

						{/* Center: playback controls */}
						<div className="flex-1 flex items-center justify-center gap-1">
							<SkeletonBlock className="w-8 h-8 rounded-md" />
							<SkeletonBlock className="w-8 h-8 rounded-md" style={{ animationDelay: "0.1s" }} />
							<SkeletonBlock className="w-8 h-8 rounded-md" style={{ animationDelay: "0.2s" }} />
						</div>

						{/* Right: tool buttons */}
						<div className="flex items-center gap-0.5">
							{[0, 1, 2, 3, 4].map((i) => (
								<SkeletonBlock
									key={i}
									className="w-8 h-8 rounded-md"
									style={{ animationDelay: `${i * 0.08}s` }}
								/>
							))}
						</div>
					</div>

					{/* Timeline tracks */}
					<div className="flex-1 min-h-0 p-3 flex flex-col gap-2">
						<SkeletonBlock className="w-full h-10 rounded-lg" />
						<SkeletonBlock className="w-full h-6 rounded-lg" style={{ animationDelay: "0.1s" }} />
						<SkeletonBlock className="w-[70%] h-6 rounded-lg" style={{ animationDelay: "0.2s" }} />
					</div>
				</div>
			</div>
		</div>
	);
}

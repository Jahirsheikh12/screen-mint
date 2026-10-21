import { Check } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
	color: string;
	colors: string[];
	onChange: (color: { hex: string }) => void;
	className?: string;
}

export function ColorPicker({ color, colors, onChange, className }: ColorPickerProps) {
	const [hexInput, setHexInput] = useState(color);
	const inputRef = useRef<HTMLInputElement>(null);

	const normalizedColor = color.toUpperCase();

	const handleSwatchClick = (hex: string) => {
		setHexInput(hex);
		onChange({ hex });
	};

	const handleHexCommit = (value: string) => {
		const cleaned = value.startsWith("#") ? value : `#${value}`;
		if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(cleaned)) {
			onChange({ hex: cleaned });
		} else {
			setHexInput(color);
		}
	};

	return (
		<div className={cn("flex flex-col gap-3", className)}>
			{/* Swatch grid */}
			<div className="grid grid-cols-8 gap-1.5 p-1 -m-1 overflow-visible">
				{colors.map((swatch) => {
					const isSelected = swatch.toUpperCase() === normalizedColor;
					return (
						<button
							key={swatch}
							type="button"
							onClick={() => handleSwatchClick(swatch)}
							className={cn(
								"relative w-full aspect-square rounded-lg transition-all duration-150",
								isSelected
									? "ring-2 ring-accent scale-110 z-10"
									: "hover:scale-110 hover:z-10 shadow-sm border border-line-strong",
							)}
							style={{ backgroundColor: swatch }}
						>
							{isSelected && (
								<Check
									className="absolute inset-0 m-auto w-3 h-3 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
									style={{
										color: isLightColor(swatch) ? "#000" : "#fff",
									}}
									strokeWidth={3}
								/>
							)}
						</button>
					);
				})}
			</div>

			{/* Hex input + preview */}
			<div className="flex items-center gap-2">
				<label className="relative w-8 h-8 rounded-lg border border-line-strong shadow-sm cursor-pointer overflow-hidden shrink-0 hover:border-accent/50 transition-all duration-200">
					<div className="absolute inset-[2px] rounded-[5px]" style={{ backgroundColor: color }} />
					<input
						type="color"
						value={color}
						onChange={(e) => {
							setHexInput(e.target.value);
							onChange({ hex: e.target.value });
						}}
						className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
					/>
				</label>
				<div className="flex-1 relative">
					<span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-caption text-fg-subtle font-mono pointer-events-none">
						#
					</span>
					<input
						ref={inputRef}
						type="text"
						value={hexInput.replace(/^#/, "").toUpperCase()}
						onChange={(e) => {
							const val = e.target.value.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6);
							setHexInput(`#${val}`);
						}}
						onBlur={() => handleHexCommit(hexInput)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleHexCommit(hexInput);
						}}
						className="w-full h-8 rounded-md border border-line-strong bg-sunken pl-6 pr-2.5 text-caption text-fg font-mono tracking-widest uppercase outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-200"
					/>
				</div>
			</div>
		</div>
	);
}

function isLightColor(hex: string): boolean {
	const c = hex.replace("#", "");
	const r = parseInt(c.substring(0, 2), 16);
	const g = parseInt(c.substring(2, 4), 16);
	const b = parseInt(c.substring(4, 6), 16);
	return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

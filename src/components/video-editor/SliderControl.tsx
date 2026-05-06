import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";

interface SliderControlProps {
	label: string;
	value: number;
	defaultValue: number;
	min: number;
	max: number;
	step: number;
	onChange: (value: number) => void;
	formatValue: (value: number) => string;
	parseInput: (text: string) => number | null;
	accentColor?: "purple" | "blue";
	disabled?: boolean;
}

export function SliderControl({
	label,
	value,
	defaultValue,
	min,
	max,
	step,
	onChange,
	formatValue,
	parseInput,
	accentColor = "blue",
	disabled = false,
}: SliderControlProps) {
	const [editing, setEditing] = useState(false);
	const [editText, setEditText] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const isModified = value !== defaultValue;

	useEffect(() => {
		if (editing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [editing]);

	const commitEdit = () => {
		if (disabled) {
			setEditing(false);
			return;
		}

		const parsed = parseInput(editText);
		if (parsed != null && !isNaN(parsed)) {
			onChange(Math.min(max, Math.max(min, parsed)));
		}
		setEditing(false);
	};

	const cancelEdit = () => {
		setEditing(false);
	};

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1.5">
					<span className="text-[11px] font-medium text-slate-300">{label}</span>
					{isModified && (
						<button
							type="button"
							disabled={disabled}
							onClick={() => !disabled && onChange(defaultValue)}
							className="text-slate-600 hover:text-[#F59E0B] transition-colors duration-200"
							title="Reset to default"
						>
							<RotateCcw className="w-2.5 h-2.5" />
						</button>
					)}
				</div>
				{editing ? (
					<input
						ref={inputRef}
						type="text"
						value={editText}
						disabled={disabled}
						onChange={(e) => setEditText(e.target.value)}
						onBlur={commitEdit}
						onKeyDown={(e) => {
							if (e.key === "Enter") commitEdit();
							if (e.key === "Escape") cancelEdit();
						}}
						className="w-14 text-[11px] text-right font-mono bg-white/10 border border-white/20 rounded-md px-1.5 py-0.5 text-slate-200 outline-none focus:border-[#F59E0B]/50 focus:ring-1 focus:ring-[#F59E0B]/20 transition-all duration-200"
					/>
				) : (
					<span
						className={
							disabled
								? "text-[11px] text-slate-600 font-mono tabular-nums bg-white/[0.02] px-1.5 py-0.5 rounded-md transition-colors duration-200"
								: "text-[11px] text-slate-400 font-mono tabular-nums cursor-text hover:text-slate-200 bg-white/[0.04] px-1.5 py-0.5 rounded-md transition-colors duration-200"
						}
						onClick={() => {
							if (disabled) return;
							setEditText(formatValue(value));
							setEditing(true);
						}}
					>
						{formatValue(value)}
					</span>
				)}
			</div>
			<Slider
				value={[value]}
				onValueChange={(values) => !disabled && onChange(values[0])}
				disabled={disabled}
				min={min}
				max={max}
				step={step}
				className={
					accentColor === "purple"
						? "w-full [&_[role=slider]]:bg-[#8b5cf6] [&_[role=slider]]:border-[#8b5cf6] [&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5"
						: "w-full [&_[role=slider]]:bg-[#F59E0B] [&_[role=slider]]:border-[#F59E0B] [&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5"
				}
			/>
		</div>
	);
}

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";

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
	const { t } = useI18n();
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
		<div className="flex min-w-0 flex-col gap-2">
			<div className="flex min-w-0 items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-1.5">
					<span className="min-w-0 break-words text-caption font-medium leading-tight text-fg-muted">
						{label}
					</span>
					{isModified && (
						<button
							type="button"
							disabled={disabled}
							onClick={() => !disabled && onChange(defaultValue)}
							className="shrink-0 text-fg-disabled hover:text-accent-fg transition-colors duration-200"
							title={t("editor.slider.resetToDefault", "Reset to default")}
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
						className="w-14 shrink-0 text-caption text-right font-mono bg-sunken border border-line-strong rounded-md px-1.5 py-1 text-fg outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-200"
					/>
				) : (
					<span
						className={
							disabled
								? "shrink-0 whitespace-nowrap text-caption text-fg-disabled font-mono tabular-nums bg-fill-subtle px-1.5 py-1 rounded-md transition-colors duration-200"
								: "shrink-0 whitespace-nowrap text-caption text-fg-muted font-mono tabular-nums cursor-text hover:text-fg bg-sunken border border-line px-1.5 py-1 rounded-md transition-colors duration-200 hover:border-line-strong shadow-sm"
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
				className={cn(
					"w-full pt-2 pb-1",
					accentColor === "purple" && "[&_[role=slider]]:ring-purple-500/50",
				)}
			/>
		</div>
	);
}

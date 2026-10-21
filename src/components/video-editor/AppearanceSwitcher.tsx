import { Monitor, Moon, Sun } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useScopedT } from "@/contexts/I18nContext";
import { normalizeThemePreference, THEME_PREFERENCES, useThemePreference } from "@/lib/theme";

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

export function AppearanceSwitcher() {
	const t = useScopedT("editor");
	const [preference, setPreference] = useThemePreference();
	const Icon = THEME_ICONS[preference];
	const label = t("theme.appearance", "Appearance");

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition hover:bg-fill-hover hover:text-fg cursor-pointer"
					title={label}
					aria-label={label}
				>
					<Icon className="h-4 w-4" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-[150px] border-line-strong bg-raised">
				<DropdownMenuLabel className="text-caption font-medium text-fg-subtle">
					{label}
				</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={preference}
					onValueChange={(value) => setPreference(normalizeThemePreference(value))}
				>
					{THEME_PREFERENCES.map((option) => {
						const OptionIcon = THEME_ICONS[option];
						return (
							<DropdownMenuRadioItem
								key={option}
								value={option}
								className="gap-2 text-fg-muted hover:bg-fill-hover hover:text-fg cursor-pointer"
							>
								<OptionIcon className="h-3.5 w-3.5" />
								{t(`theme.${option}`)}
							</DropdownMenuRadioItem>
						);
					})}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

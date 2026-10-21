import * as SwitchPrimitives from "@radix-ui/react-switch";
import * as React from "react";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
	React.ElementRef<typeof SwitchPrimitives.Root>,
	React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
	<SwitchPrimitives.Root
		className={cn(
			"peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-base ease-standard disabled:cursor-not-allowed disabled:opacity-50",
			"data-[state=checked]:bg-accent data-[state=unchecked]:bg-track/20 hover:data-[state=unchecked]:bg-track/30",
			className,
		)}
		{...props}
		ref={ref}
	>
		<SwitchPrimitives.Thumb
			className={cn(
				"pointer-events-none block h-4 w-4 rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.3)] ring-0 transition-transform duration-base ease-standard",
				"bg-fixed-white",
				"data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-[2px]",
			)}
		/>
	</SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };

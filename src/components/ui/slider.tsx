import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
	React.ElementRef<typeof SliderPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
	<SliderPrimitive.Root
		ref={ref}
		className={cn("relative flex w-full touch-none select-none items-center group", className)}
		{...props}
	>
		<SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-track/15">
			<SliderPrimitive.Range className="absolute h-full rounded-full bg-accent" />
		</SliderPrimitive.Track>
		<SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full border border-line-strong bg-fixed-white shadow-[0_1px_3px_rgb(0_0_0/0.35)] transition-transform duration-fast ease-standard hover:scale-110 disabled:pointer-events-none disabled:opacity-50" />
	</SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };

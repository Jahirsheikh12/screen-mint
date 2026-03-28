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
		<SliderPrimitive.Track className="relative h-[5px] w-full grow overflow-hidden rounded-full bg-white/[0.08]">
			<SliderPrimitive.Range className="absolute h-full bg-[#F59E0B] rounded-full" />
		</SliderPrimitive.Track>
		<SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full border-2 border-[#F59E0B] bg-[#F59E0B] shadow-md shadow-black/30 transition-all duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0A0F0D] disabled:pointer-events-none disabled:opacity-50" />
	</SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };

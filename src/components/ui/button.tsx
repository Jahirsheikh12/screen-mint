import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-body font-medium transition-colors duration-fast ease-standard disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-accent text-on-accent shadow-sm hover:bg-accent-hover",
				destructive: "bg-danger text-on-danger shadow-sm hover:bg-danger/90",
				outline: "border border-line-strong bg-transparent text-fg hover:bg-fill-hover",
				secondary: "bg-fill-hover text-fg hover:bg-fill-pressed",
				ghost: "text-fg-muted hover:bg-fill-hover hover:text-fg",
				link: "text-accent-fg underline-offset-4 hover:underline",
				brand: "bg-accent text-on-accent shadow-sm hover:bg-accent-hover",
				glass: "border border-line bg-fill-subtle text-fg hover:bg-fill-hover",
			},
			size: {
				default: "h-8 px-3.5",
				sm: "h-7 px-2.5 text-label",
				lg: "h-9 px-5",
				icon: "h-8 w-8",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
		);
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };

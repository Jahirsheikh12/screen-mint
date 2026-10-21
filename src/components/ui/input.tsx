import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, type, ...props }, ref) => {
		return (
			<input
				type={type}
				className={cn(
					"flex h-8 w-full rounded-md border border-line-strong bg-sunken px-2.5 py-1 text-body text-fg file:border-0 file:bg-transparent file:text-body file:font-medium placeholder:text-fg-subtle focus-visible:border-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
					className,
				)}
				ref={ref}
				{...props}
			/>
		);
	},
);
Input.displayName = "Input";

export { Input };

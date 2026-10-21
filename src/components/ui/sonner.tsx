import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			className="toaster group"
			duration={3000}
			toastOptions={{
				classNames: {
					toast:
						"group toast group-[.toaster]:bg-raised group-[.toaster]:text-fg group-[.toaster]:border-line group-[.toaster]:shadow-popover",
					description: "group-[.toast]:text-fg-muted",
					actionButton: "group-[.toast]:bg-accent group-[.toast]:text-on-accent",
					cancelButton: "group-[.toast]:bg-fill-hover group-[.toast]:text-fg-muted",
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };

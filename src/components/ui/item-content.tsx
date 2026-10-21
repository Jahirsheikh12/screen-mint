import type { PropsWithChildren } from "react";

interface ItemContentProps extends PropsWithChildren {
	classes: string;
}

function ItemContent({ children, classes }: ItemContentProps) {
	return (
		<div
			className={`bg-fill-subtle border border-line rounded-md w-full flex flex-row items-center px-3 py-1 gap-2 transition-all duration-150 hover:bg-accent/10 ${classes}`}
			style={{ minHeight: 40 }}
		>
			{children}
		</div>
	);
}

export default ItemContent;

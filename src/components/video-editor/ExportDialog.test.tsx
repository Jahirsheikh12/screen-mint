import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { ExportDialog } from "./ExportDialog";

function renderDialog(props: Partial<Parameters<typeof ExportDialog>[0]> = {}) {
	return renderToStaticMarkup(
		<I18nProvider>
			<ExportDialog
				isOpen
				onClose={() => undefined}
				progress={null}
				isExporting={false}
				exportStatus="idle"
				error={null}
				{...props}
			/>
		</I18nProvider>,
	);
}

describe("ExportDialog", () => {
	it("renders a non-blank idle state when opened without progress", () => {
		const html = renderDialog();

		expect(html).toContain("Ready to Export");
	});

	it("renders save retry UI after a canceled save", () => {
		const html = renderDialog({
			exportStatus: "canceled",
			error: "Save dialog canceled. Click Save Again to save without re-rendering.",
			canRetrySave: true,
			onRetrySave: () => undefined,
		});

		expect(html).toContain("Save Again");
		expect(html).toContain("Save dialog canceled");
	});

	it("renders saving state without requiring frame progress", () => {
		const html = renderDialog({
			isExporting: true,
			exportStatus: "saving",
		});

		expect(html).toContain("Saving Export");
	});
});

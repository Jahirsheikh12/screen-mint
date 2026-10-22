import { Minus, Plus } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { FAQ_GROUPS, QUICK_ANSWERS } from "../lib/faq";
import { SUPPORT_EMAIL_HREF } from "../lib/sponsors";
import { SectionTitle } from "./Chapters";

const EDGE = "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]";

/**
 * The four questions everyone asks, answered up front; the rest behind topic tabs. Every panel is
 * rendered (inactive ones `hidden`), so all answers are in the static HTML for search and answer
 * engines. Questions are native disclosures, so they open without JavaScript.
 */
export function FAQ() {
	const [active, setActive] = useState(0);

	const selectTab = (index: number) => {
		const next = (index + FAQ_GROUPS.length) % FAQ_GROUPS.length;
		setActive(next);
		document.getElementById(`faq-tab-${FAQ_GROUPS[next].id}`)?.focus();
	};

	const onTabKey = (event: KeyboardEvent) => {
		const moves: Record<string, number> = {
			ArrowRight: active + 1,
			ArrowLeft: active - 1,
			Home: 0,
			End: FAQ_GROUPS.length - 1,
		};
		if (!(event.key in moves)) return;
		event.preventDefault();
		selectTab(moves[event.key]);
	};

	return (
		<section id="faq" className="px-5 pt-24 md:px-8 md:pt-28">
			<div className="mx-auto max-w-[1000px]">
				<SectionTitle title="Questions and answers">
					Something else on your mind?{" "}
					<a
						href={SUPPORT_EMAIL_HREF}
						className="text-white underline decoration-white/25 underline-offset-[5px] transition-colors hover:decoration-reel"
					>
						Send an email
					</a>
					.
				</SectionTitle>

				<ul
					className={`mt-12 grid overflow-hidden rounded-[22px] bg-ink-2 sm:grid-cols-2 lg:grid-cols-4 ${EDGE}`}
				>
					{QUICK_ANSWERS.map((faq) => (
						<li
							key={faq.question}
							className="border-white/[0.07] p-6 md:p-7 [&:not(:first-child)]:border-t sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(even)]:border-l lg:border-t-0 lg:[&:not(:first-child)]:border-l"
						>
							<h3 className="text-[15px] font-semibold leading-snug text-white/70 sm:min-h-[2.75em]">
								{faq.question}
							</h3>
							<p className="mt-4 font-display text-[40px] font-semibold leading-none tracking-[-0.035em] text-reel">
								{faq.verdict}
							</p>
							<p className="mt-4 text-[15px] leading-relaxed text-white/55">{faq.answer}</p>
						</li>
					))}
				</ul>

				<div className="mx-auto mt-16 max-w-[820px]">
					<div
						role="tablist"
						aria-label="Question topics"
						className="flex overflow-x-auto border-b border-white/[0.08]"
					>
						{FAQ_GROUPS.map((group, i) => {
							const selected = i === active;
							return (
								<button
									key={group.id}
									id={`faq-tab-${group.id}`}
									type="button"
									role="tab"
									aria-selected={selected}
									aria-controls={`faq-panel-${group.id}`}
									tabIndex={selected ? 0 : -1}
									onClick={() => setActive(i)}
									onKeyDown={onTabKey}
									className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap px-2.5 pb-3.5 pt-2 text-[15px] last:pr-0 sm:px-4 sm:last:pr-4 sm:text-[16px] font-semibold transition-colors first:pl-0 ${
										selected ? "text-white" : "text-white/50 hover:text-white"
									}`}
								>
									{group.title}
									<span
										className={`hidden tabular-nums text-[14px] font-medium sm:inline ${selected ? "text-reel" : "text-white/35"}`}
									>
										{group.items.length}
									</span>
									<span
										aria-hidden="true"
										className={`absolute inset-x-2.5 bottom-0 sm:inset-x-4 h-0.5 rounded-full bg-reel transition-opacity [button:first-child>&]:left-0 ${
											selected ? "opacity-100" : "opacity-0"
										}`}
									/>
								</button>
							);
						})}
					</div>

					{FAQ_GROUPS.map((group, i) => (
						<div
							key={group.id}
							id={`faq-panel-${group.id}`}
							role="tabpanel"
							aria-labelledby={`faq-tab-${group.id}`}
							hidden={i !== active}
							className={`mt-6 rounded-[22px] bg-ink-2 px-6 md:px-8 ${EDGE}`}
						>
							{group.items.map((faq) => (
								<details
									key={faq.question}
									name={`faq-${group.id}`}
									className="group border-b border-white/[0.07] last:border-b-0"
								>
									<summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-[17px] font-semibold text-white/85 transition-colors hover:text-white group-open:text-white [&::-webkit-details-marker]:hidden">
										{faq.question}
										<span
											aria-hidden="true"
											className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-reel/[0.12] text-reel"
										>
											<Plus className="h-4 w-4 group-open:hidden" />
											<Minus className="hidden h-4 w-4 group-open:block" />
										</span>
									</summary>
									<p className="max-w-[62ch] pb-6 pr-8 text-[16px] leading-[1.65] text-white/55">
										{faq.answer}
									</p>
								</details>
							))}
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

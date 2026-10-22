import { ChevronDown } from "lucide-react";
import { FAQ_GROUPS } from "../lib/faq";
import { SUPPORT_EMAIL_HREF } from "../lib/sponsors";
import { SectionTitle } from "./Chapters";

/**
 * Native disclosures: every answer is in the HTML (search and answer engines read it), it works
 * without JavaScript, and the shared `name` keeps one question open at a time.
 */
export function FAQ() {
	return (
		<section id="faq" className="px-5 pt-24 md:px-8 md:pt-28">
			<div className="mx-auto grid max-w-[1120px] gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-20">
				<div className="lg:sticky lg:top-28 lg:self-start">
					<SectionTitle title="Questions and answers" align="left">
						Something else on your mind?{" "}
						<a
							href={SUPPORT_EMAIL_HREF}
							className="text-white underline decoration-white/25 underline-offset-[5px] transition-colors hover:decoration-reel"
						>
							Send an email
						</a>
						.
					</SectionTitle>
				</div>

				<div className="flex flex-col gap-12">
					{FAQ_GROUPS.map((group) => (
						<div key={group.title}>
							<h3 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
								{group.title}
							</h3>
							<div className="mt-4 border-t border-white/[0.08]">
								{group.items.map((faq) => (
									<details
										key={faq.question}
										name="faq"
										className="group border-b border-white/[0.08]"
									>
										<summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-[17px] font-semibold text-white/85 transition-colors hover:text-white group-open:text-white [&::-webkit-details-marker]:hidden">
											{faq.question}
											<ChevronDown
												aria-hidden="true"
												className="h-5 w-5 shrink-0 text-white/40 transition-transform duration-200 group-open:rotate-180"
											/>
										</summary>
										<p className="max-w-[62ch] pb-6 pr-8 text-[16px] leading-[1.65] text-white/55">
											{faq.answer}
										</p>
									</details>
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

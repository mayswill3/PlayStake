import Link from 'next/link';
import { EyebrowPill } from '@/components/ui/playstake';
import { FEATURED_FAQS, type FaqItem } from '@/lib/faq';

/** Accordion of FAQ items. Native <details>, so it works without JS. */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <dl className="space-y-3">
      {items.map(({ id, q, a, links }) => (
        <details
          key={id}
          id={id}
          className="group scroll-mt-24 rounded-[var(--ps-radius-lg)] overflow-hidden ps-gradient-border-mask-light shadow-ps-shadow-sm"
        >
          <summary
            className="flex cursor-pointer select-none items-center justify-between gap-4 px-5 py-5 text-ps-text dark:text-ps-text-on-dark font-semibold text-sm sm:text-base list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ps-blue)] dark:focus-visible:ring-[var(--ps-lime)] focus-visible:ring-inset"
            style={{ WebkitAppearance: 'none' }}
          >
            <dt>{q}</dt>
            {/* Rotates from + to x when open */}
            <span
              aria-hidden="true"
              className="flex-shrink-0 text-ps-lime text-xl font-light transition-transform duration-200 group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <dd className="px-5 pb-5 text-ps-muted dark:text-ps-muted-on-dark text-sm leading-relaxed">
            <p>{a}</p>
            {links && links.length > 0 && (
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {links.map((link) =>
                  link.href.startsWith('http') || link.href.startsWith('mailto:') ? (
                    <a
                      key={link.href}
                      href={link.href}
                      className="font-medium text-ps-text dark:text-ps-text-on-dark underline underline-offset-2 hover:text-ps-lime"
                      {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="font-medium text-ps-text dark:text-ps-text-on-dark underline underline-offset-2 hover:text-ps-lime"
                    >
                      {link.label}
                    </Link>
                  ),
                )}
              </p>
            )}
          </dd>
        </details>
      ))}
    </dl>
  );
}

/** Homepage section: the most-asked questions, with a link to the full page. */
export function FAQ() {
  return (
    <section id="faq" className="scroll-mt-16 py-16 lg:py-24 bg-ps-paper dark:bg-ps-ink">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <EyebrowPill label="FAQ" className="mb-3" />
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ps-text dark:text-ps-text-on-dark">
            Questions?{' '}
            <span className="ps-gradient-text">Answered.</span>
          </h2>
        </div>

        <FaqList items={FEATURED_FAQS} />

        <div className="mt-8 text-center">
          <Link
            href="/faq"
            className="inline-flex items-center gap-1 text-sm font-semibold text-ps-text dark:text-ps-text-on-dark underline underline-offset-4 hover:text-ps-lime"
          >
            See all questions
          </Link>
        </div>
      </div>
    </section>
  );
}

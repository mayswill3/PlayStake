import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { ThemeToggle } from '@/components/ui/theme-toggle';

type TocItem = {
  id: string;
  label: string;
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  summary: string;
  lastUpdated: string;
  toc: TocItem[];
  children: React.ReactNode;
};

export function LegalPage({
  eyebrow,
  title,
  summary,
  lastUpdated,
  toc,
  children,
}: LegalPageProps) {
  return (
    <div className="min-h-screen bg-ps-paper text-ps-text dark:bg-ps-ink dark:text-ps-text-on-dark">
      <header className="sticky top-0 z-50 border-b border-[var(--ps-border-light)] bg-ps-paper/90 backdrop-blur-xl dark:border-[var(--ps-border-dark)] dark:bg-ps-ink/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-lime"
          >
            <Image
              src="/logo.png"
              alt="PlayStake"
              width={36}
              height={36}
              className="h-9 w-9"
            />
            <span className="font-display text-lg font-bold">PlayStake</span>
          </Link>

          <div className="flex items-center gap-1">
            <Link
              href="/learn-more"
              className="hidden h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ps-muted transition-colors hover:bg-ps-paper-elevated hover:text-ps-text dark:text-ps-muted-on-dark dark:hover:bg-ps-ink-2 dark:hover:text-ps-text-on-dark sm:inline-flex"
            >
              <ArrowLeft size={15} />
              Back to overview
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[240px_minmax(0,820px)] lg:justify-center lg:gap-16">
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="mb-3 font-display text-xs font-bold uppercase tracking-[0.14em] text-ps-muted dark:text-ps-muted-on-dark">
                On this page
              </p>
              <nav aria-label={`${title} sections`}>
                <ol className="space-y-1 border-l border-[var(--ps-border-light)] pl-4 dark:border-[var(--ps-border-dark)]">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="block py-1.5 text-sm leading-5 text-ps-muted transition-colors hover:text-ps-lime-strong dark:text-ps-muted-on-dark dark:hover:text-ps-lime"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </div>
          </aside>

          <article className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-[var(--ps-border-light)] bg-white shadow-ps-shadow-sm dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2">
              <div className="border-b border-[var(--ps-border-light)] bg-gradient-to-br from-ps-lime/10 via-transparent to-ps-cyan/10 p-6 dark:border-[var(--ps-border-dark)] sm:p-9">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-ps-lime/15 text-ps-lime-strong dark:text-ps-lime">
                  {eyebrow === 'Privacy' ? (
                    <ShieldCheck size={23} />
                  ) : (
                    <FileText size={23} />
                  )}
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ps-lime-strong dark:text-ps-lime">
                  {eyebrow}
                </p>
                <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {title}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-ps-muted dark:text-ps-muted-on-dark sm:text-base">
                  {summary}
                </p>
                <p className="mt-5 text-xs text-ps-muted dark:text-ps-muted-on-dark">
                  Last updated:{' '}
                  <time dateTime="2026-07-29">{lastUpdated}</time>
                </p>
              </div>

              <div className="p-6 sm:p-9">{children}</div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--ps-border-light)] bg-white/70 px-5 py-4 text-sm dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2/70">
              <span className="text-ps-muted dark:text-ps-muted-on-dark">
                Looking for the other policy?
              </span>
              <div className="flex items-center gap-4 font-semibold">
                <Link
                  href="/terms"
                  className="text-ps-lime-strong hover:underline dark:text-ps-lime"
                >
                  Terms
                </Link>
                <Link
                  href="/privacy"
                  className="text-ps-lime-strong hover:underline dark:text-ps-lime"
                >
                  Privacy
                </Link>
              </div>
            </div>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export function LegalSection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-b border-[var(--ps-border-light)] py-8 first:pt-0 last:border-b-0 last:pb-0 dark:border-[var(--ps-border-dark)]"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 font-mono text-xs font-bold text-ps-lime-strong dark:text-ps-lime">
          {number}
        </span>
        <h2 className="font-display text-xl font-bold tracking-tight">
          {title}
        </h2>
      </div>
      <div className="mt-4 space-y-4 text-sm leading-7 text-ps-muted dark:text-ps-muted-on-dark [&_a]:font-semibold [&_a]:text-ps-lime-strong [&_a]:underline-offset-2 hover:[&_a]:underline dark:[&_a]:text-ps-lime [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-ps-text dark:[&_strong]:text-ps-text-on-dark [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

export function LegalCallout({
  title,
  children,
  tone = 'info',
}: {
  title: string;
  children: React.ReactNode;
  tone?: 'info' | 'warning';
}) {
  const className =
    tone === 'warning'
      ? 'border-amber-400/30 bg-amber-400/10'
      : 'border-ps-lime/30 bg-ps-lime/10';

  return (
    <div className={`rounded-xl border p-4 ${className}`}>
      <p className="font-display text-sm font-bold text-ps-text dark:text-ps-text-on-dark">
        {title}
      </p>
      <div className="mt-1 text-sm leading-6">{children}</div>
    </div>
  );
}

export function LegalTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
      <table className="w-full min-w-[620px] border-collapse text-left text-sm">
        <thead className="bg-ps-paper-elevated text-ps-text dark:bg-ps-ink-3 dark:text-ps-text-on-dark">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="px-4 py-3 font-display text-xs font-bold uppercase tracking-[0.08em]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--ps-border-light)] dark:divide-[var(--ps-border-dark)]">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="align-top">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-4 py-3 leading-6 text-ps-muted dark:text-ps-muted-on-dark"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

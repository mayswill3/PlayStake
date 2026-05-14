import { Check, X } from 'lucide-react';

const ROWS = [
  {
    feature: 'Your opponent',
    playstake: 'A real matched player',
    traditional: 'The house (algorithmic odds)',
  },
  {
    feature: 'Edge',
    playstake: 'Your skill alone',
    traditional: 'Built-in house margin',
  },
  {
    feature: 'Outcome',
    playstake: 'P2P result, dual-source verified',
    traditional: 'Bookmaker settles, final',
  },
  {
    feature: 'Winnings',
    playstake: 'Instant to your wallet',
    traditional: 'Withdrawal requests + delays',
  },
  {
    feature: 'Integrity',
    playstake: 'Escrow + dispute review',
    traditional: 'House rules apply',
  },
  {
    feature: 'Relationship',
    playstake: 'Player community',
    traditional: 'Customer number',
  },
] as const;

export function ComparisonTable() {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table
        className="w-full min-w-[520px] border-collapse text-sm"
        aria-label="PlayStake vs traditional bookmaker comparison"
      >
        <thead>
          <tr>
            <th
              scope="col"
              className="py-3 px-4 text-left text-[11px] uppercase tracking-widest text-fg-muted font-semibold w-[30%]"
            >
              Feature
            </th>
            <th
              scope="col"
              className="py-3 px-4 text-left text-[11px] uppercase tracking-widest font-semibold w-[35%] text-brand-600 dark:text-brand-400"
            >
              PlayStake
            </th>
            <th
              scope="col"
              className="py-3 px-4 text-left text-[11px] uppercase tracking-widest text-fg-muted font-semibold w-[35%]"
            >
              Bookmaker
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.feature} className="border-t border-themed">
              <td className="py-3.5 px-4 font-medium text-fg">{row.feature}</td>
              <td className="py-3.5 px-4">
                <span className="flex items-start gap-2">
                  <Check
                    size={14}
                    className="text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-fg-secondary">{row.playstake}</span>
                </span>
              </td>
              <td className="py-3.5 px-4">
                <span className="flex items-start gap-2">
                  <X
                    size={14}
                    className="text-fg-muted flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-fg-muted">{row.traditional}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

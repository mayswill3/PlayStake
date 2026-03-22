import { Card } from '@/components/ui/Card';

interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  valueColor?: string;
}

export function StatCard({
  label,
  value,
  subtitle,
  valueColor = 'text-text-primary',
}: StatCardProps) {
  return (
    <Card>
      <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted mb-1">{label}</p>
      <p className={`text-2xl font-display font-bold tabular-nums ${valueColor}`}>{value}</p>
      {subtitle && <p className="text-xs text-text-secondary font-mono mt-1">{subtitle}</p>}
    </Card>
  );
}

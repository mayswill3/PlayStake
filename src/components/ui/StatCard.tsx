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
  valueColor = 'text-surface-100',
}: StatCardProps) {
  return (
    <Card>
      <p className="text-sm text-surface-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
      {subtitle && <p className="text-xs text-surface-500 mt-1">{subtitle}</p>}
    </Card>
  );
}

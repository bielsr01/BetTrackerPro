import { StatusBadge } from '../status-badge';

export default function StatusBadgeExample() {
  return (
    <div className="flex gap-4 p-4">
      <StatusBadge status="pending" />
      <StatusBadge status="won" />
      <StatusBadge status="lost" />
      <StatusBadge status="returned" />
    </div>
  );
}
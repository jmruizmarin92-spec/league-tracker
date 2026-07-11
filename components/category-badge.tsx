import { categoryMeta } from "@/lib/event-category";
import { Badge } from "@/components/ui/badge";

export function CategoryBadge({ category }: { category: string | null | undefined }) {
  const meta = categoryMeta(category);
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className="gap-1">
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </Badge>
  );
}

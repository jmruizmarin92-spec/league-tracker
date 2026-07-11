"use client";

import { CATEGORIES } from "@/lib/event-category";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CategorySelect({
  value,
  onChange,
  placeholder,
  noneLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  noneLabel: string;
}) {
  return (
    <Select
      value={value || "none"}
      onValueChange={(v) => onChange(v === "none" ? "" : v)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{noneLabel}</SelectItem>
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <SelectItem key={c.value} value={c.value}>
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {c.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

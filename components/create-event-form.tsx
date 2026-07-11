"use client";

import { useActionState, useState } from "react";
import { createEventAction, type ActionState } from "@/app/actions/events";
import { CategorySelect } from "@/components/category-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CreateEventForm({
  labels,
}: {
  labels: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createEventAction,
    {},
  );
  const [game, setGame] = useState("");
  const [category, setCategory] = useState("");
  const [local, setLocal] = useState("");
  const [listRequired, setListRequired] = useState(false);
  const iso = local ? new Date(local).toISOString() : "";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="game" value={game} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="starts_at_iso" value={iso} />
      <input type="hidden" name="list_required" value={String(listRequired)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">{labels.name}</label>
          <Input id="name" name="name" maxLength={100} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{labels.category}</label>
          <CategorySelect
            value={category}
            onChange={setCategory}
            placeholder={labels.categoryPlaceholder}
            noneLabel={labels.categoryNone}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{labels.game}</label>
          <Select value={game} onValueChange={setGame}>
            <SelectTrigger>
              <SelectValue placeholder={labels.gamePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tcg">TCG</SelectItem>
              <SelectItem value="vgc">VGC</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e_starts" className="text-sm font-medium">{labels.startsAt}</label>
          <Input id="e_starts" type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e_loc" className="text-sm font-medium">{labels.location}</label>
          <Input id="e_loc" name="location" maxLength={120} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e_cost" className="text-sm font-medium">{labels.cost}</label>
          <Input id="e_cost" name="cost" type="number" min={0} step="0.01" defaultValue="0" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e_cap" className="text-sm font-medium">{labels.capacity}</label>
          <Input id="e_cap" name="capacity" type="number" min={1} step={1} placeholder={labels.capacityHint} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="e_url" className="text-sm font-medium">{labels.externalUrl}</label>
          <Input id="e_url" name="external_url" type="url" maxLength={500} placeholder={labels.externalUrlHint} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="e_desc" className="text-sm font-medium">{labels.description}</label>
          <Textarea id="e_desc" name="description" rows={2} maxLength={1000} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="e_prizes" className="text-sm font-medium">{labels.prizes}</label>
          <Textarea id="e_prizes" name="prizes" rows={2} maxLength={1000} placeholder={labels.prizesHint} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch id="e_listreq" checked={listRequired} onCheckedChange={setListRequired} />
        <label htmlFor="e_listreq" className="text-sm">{labels.listRequired}</label>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !game}>{labels.cta}</Button>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
    </form>
  );
}

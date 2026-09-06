"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  saveStorePrizeDefaultsAction,
  type ActionState,
} from "@/app/actions/event-prizes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

// Per-player figures a store usually applies to its cups (PL-29): a new
// event of the store starts its prize budget from these.
export function StorePrizeDefaultsForm({
  storeId,
  slug,
  defaults,
}: {
  storeId: string;
  slug: string;
  defaults: { venueFee: number; judgeFee: number; entryPack: boolean; packValue: number };
}) {
  const t = useTranslations("eventPrizes");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveStorePrizeDefaultsAction,
    {},
  );
  const [entryPack, setEntryPack] = useState(defaults.entryPack);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="store_id" value={storeId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="entry_pack" value={entryPack ? "true" : "false"} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="spd_venue" className="text-sm font-medium">
            {t("venueFee")}
          </label>
          <Input
            id="spd_venue"
            name="venue_fee"
            type="number"
            min={0}
            step="0.01"
            defaultValue={defaults.venueFee}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="spd_judge" className="text-sm font-medium">
            {t("judgeFee")}
          </label>
          <Input
            id="spd_judge"
            name="judge_fee"
            type="number"
            min={0}
            step="0.01"
            defaultValue={defaults.judgeFee}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="spd_pack" className="text-sm font-medium">
            {t("packValue")}
          </label>
          <Input
            id="spd_pack"
            name="pack_value"
            type="number"
            min={0}
            step="0.01"
            defaultValue={defaults.packValue}
          />
        </div>
        <div className="flex items-center gap-2 sm:pt-6">
          <Switch id="spd_entrypack" checked={entryPack} onCheckedChange={setEntryPack} />
          <label htmlFor="spd_entrypack" className="text-sm">
            {t("entryPack")}
          </label>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state?.ok && <p className="text-sm text-primary">{t("saved")}</p>}
      </div>
    </form>
  );
}

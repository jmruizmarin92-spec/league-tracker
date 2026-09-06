"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  saveEventPrizeBudgetAction,
  type ActionState,
} from "@/app/actions/event-prizes";
import {
  computePrizeBudget,
  defaultShares,
  prizeSummaryText,
  MAX_TOP_CUT,
  TOP_CUT_SIZES,
  type PrizeKind,
} from "@/lib/event-prizes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PrizeBudgetDefaults = {
  venueFee: number;
  judgeFee: number;
  entryPack: boolean;
  packValue: number;
  extraCosts: number;
  extraCostsNote: string;
  prizeKind: PrizeKind;
  topCut: number;
  shares: number[];
};

const OTHER = "other";

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

function toNumber(s: string): number {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// Admin-only prize budget of a standalone event (PL-29): the per-player cuts
// and the split, recomputed live as the TO types, saved with the event and
// optionally published as the public "Premios" text. `players` is the count
// of players imported from TOM, or the registered count while there is no
// import (`playersSource` says which, the card tells the TO).
export function EventPrizeBudget({
  eventId,
  slug,
  entryFee,
  players,
  playersSource,
  defaults,
  defaultsSource,
}: {
  eventId: string;
  slug: string;
  entryFee: number;
  players: number;
  playersSource: "tdf" | "registered";
  defaults: PrizeBudgetDefaults;
  // Where the initial values come from: this event's saved budget, the
  // store's defaults, or nothing (zeros).
  defaultsSource: "event" | "store" | "none";
}) {
  const t = useTranslations("eventPrizes");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveEventPrizeBudgetAction,
    {},
  );

  const [venueFee, setVenueFee] = useState(String(defaults.venueFee));
  const [judgeFee, setJudgeFee] = useState(String(defaults.judgeFee));
  const [entryPack, setEntryPack] = useState(defaults.entryPack);
  const [packValue, setPackValue] = useState(String(defaults.packValue));
  const [extraCosts, setExtraCosts] = useState(String(defaults.extraCosts));
  const [extraNote, setExtraNote] = useState(defaults.extraCostsNote);
  const [prizeKind, setPrizeKind] = useState<PrizeKind>(defaults.prizeKind);
  const [topCut, setTopCut] = useState(defaults.topCut);
  const [shares, setShares] = useState<string[]>(
    Array.from({ length: defaults.topCut }, (_, i) => String(defaults.shares[i] ?? 0)),
  );

  const isPreset = (TOP_CUT_SIZES as readonly number[]).includes(topCut);
  const [otherCut, setOtherCut] = useState(!isPreset);

  function applyTopCut(n: number) {
    const size = Math.min(MAX_TOP_CUT, Math.max(1, Math.floor(n || 1)));
    setTopCut(size);
    setShares(defaultShares(size).map(String));
  }

  function onPresetChange(value: string) {
    if (value === OTHER) {
      setOtherCut(true);
      return;
    }
    setOtherCut(false);
    applyTopCut(Number(value));
  }

  function setShare(i: number, value: string) {
    setShares((prev) => prev.map((s, j) => (j === i ? value : s)));
  }

  const shareNumbers = shares.map(toNumber);
  const result = useMemo(
    () =>
      computePrizeBudget({
        players,
        entryFee,
        venueFee: toNumber(venueFee),
        judgeFee: toNumber(judgeFee),
        entryPack,
        packValue: toNumber(packValue),
        extraCosts: toNumber(extraCosts),
        prizeKind,
        topCut,
        shares: shareNumbers,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, entryFee, venueFee, judgeFee, entryPack, packValue, extraCosts, prizeKind, topCut, shares],
  );
  const sharesSum = shareNumbers.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const summary = prizeSummaryText(result, prizeKind, {
    packOne: t("packOne"),
    packMany: t("packMany"),
    cashUnit: t("cashUnit"),
    entryPackLine: t("entryPackLine"),
  });
  const unit = (n: number) =>
    prizeKind === "packs" ? t("packs", { n }) : t("euros", { n });

  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: t("rowGross"), value: eur.format(result.gross) },
    { label: t("rowVenue"), value: `− ${eur.format(result.venueTotal)}` },
    { label: t("rowJudge"), value: `− ${eur.format(result.judgeTotal)}` },
    {
      label: t("rowEntryPacks", { n: result.entryPacksCount }),
      value: `− ${eur.format(result.entryPacksCost)}`,
    },
    {
      label: extraNote ? `${t("rowExtra")} (${extraNote})` : t("rowExtra"),
      value: `− ${eur.format(result.extraCosts)}`,
    },
    { label: t("rowRemaining"), value: eur.format(result.remaining), strong: true },
    { label: t("rowPot"), value: unit(result.potUnits), strong: true },
    {
      label: result.remaining < 0 ? t("rowDeficit") : t("rowLeftover"),
      value: eur.format(Math.abs(result.leftover)),
    },
  ];

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="entry_pack" value={entryPack ? "true" : "false"} />
      <input type="hidden" name="prize_kind" value={prizeKind} />
      <input type="hidden" name="top_cut" value={topCut} />
      <input type="hidden" name="shares" value={shareNumbers.map(Math.floor).join(",")} />

      <div className="flex flex-col gap-1 text-sm">
        <span>
          {playersSource === "tdf"
            ? t("playersTdf", { n: players })
            : t("playersRegistered", { n: players })}
          {" · "}
          {t("entryFee", { fee: eur.format(entryFee) })}
        </span>
        {defaultsSource === "store" && (
          <span className="text-muted-foreground">{t("fromStoreDefaults")}</span>
        )}
        {defaultsSource === "none" && (
          <span className="text-muted-foreground">{t("noDefaults")}</span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pb_venue" className="text-sm font-medium">
            {t("venueFee")}
          </label>
          <Input
            id="pb_venue"
            name="venue_fee"
            type="number"
            min={0}
            step="0.01"
            value={venueFee}
            onChange={(e) => setVenueFee(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pb_judge" className="text-sm font-medium">
            {t("judgeFee")}
          </label>
          <Input
            id="pb_judge"
            name="judge_fee"
            type="number"
            min={0}
            step="0.01"
            value={judgeFee}
            onChange={(e) => setJudgeFee(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pb_pack" className="text-sm font-medium">
            {t("packValue")}
          </label>
          <Input
            id="pb_pack"
            name="pack_value"
            type="number"
            min={0}
            step="0.01"
            value={packValue}
            onChange={(e) => setPackValue(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 sm:pt-6">
          <Switch id="pb_entrypack" checked={entryPack} onCheckedChange={setEntryPack} />
          <label htmlFor="pb_entrypack" className="text-sm">
            {t("entryPack")}
          </label>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pb_extra" className="text-sm font-medium">
            {t("extraCosts")}
          </label>
          <Input
            id="pb_extra"
            name="extra_costs"
            type="number"
            min={0}
            step="0.01"
            value={extraCosts}
            onChange={(e) => setExtraCosts(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pb_extra_note" className="text-sm font-medium">
            {t("extraCostsNote")}
          </label>
          <Input
            id="pb_extra_note"
            name="extra_costs_note"
            maxLength={120}
            placeholder={t("extraCostsNoteHint")}
            value={extraNote}
            onChange={(e) => setExtraNote(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("prizeKind")}</span>
          <Select value={prizeKind} onValueChange={(v) => setPrizeKind(v as PrizeKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="packs">{t("prizePacks")}</SelectItem>
              <SelectItem value="cash">{t("prizeCash")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("topCut")}</span>
          <div className="flex gap-2">
            <Select value={otherCut ? OTHER : String(topCut)} onValueChange={onPresetChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOP_CUT_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {t("topN", { n })}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER}>{t("topOther")}</SelectItem>
              </SelectContent>
            </Select>
            {otherCut && (
              <Input
                type="number"
                min={1}
                max={MAX_TOP_CUT}
                step={1}
                className="w-24"
                aria-label={t("topCut")}
                value={topCut}
                onChange={(e) => applyTopCut(Number(e.target.value))}
              />
            )}
          </div>
        </div>
      </div>

      {/* Shares per placing */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">{t("sharesTitle")}</span>
          <div className="flex items-center gap-3">
            <span
              className={
                sharesSum === 100 ? "text-sm text-muted-foreground" : "text-sm text-destructive"
              }
            >
              {t("sharesSum", { n: sharesSum })}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => applyTopCut(topCut)}>
              {t("resetShares")}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {shares.map((s, i) => (
            <div key={i} className="flex flex-col gap-1">
              <label htmlFor={`pb_share_${i}`} className="text-xs text-muted-foreground">
                {i + 1}º
              </label>
              <Input
                id={`pb_share_${i}`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={s}
                onChange={(e) => setShare(i, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        <dl className="flex flex-col divide-y text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-4 py-1.5">
              <dt className={r.strong ? "font-medium" : "text-muted-foreground"}>{r.label}</dt>
              <dd className={r.strong ? "font-medium tabular-nums" : "tabular-nums"}>{r.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("awardsTitle")}</span>
          <ol className="flex flex-col divide-y text-sm">
            {result.awards.map((a) => (
              <li key={a.place} className="flex justify-between gap-4 py-1.5">
                <span>
                  {a.place}º
                  <span className="ml-2 text-muted-foreground">{a.share} %</span>
                </span>
                <span className="tabular-nums">{unit(a.amount)}</span>
              </li>
            ))}
          </ol>
          {summary && (
            <div className="mt-2 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{t("summaryPreview")}</span>
              <p className="whitespace-pre-wrap rounded-md border p-2 text-sm">{summary}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" name="intent" value="save" disabled={pending}>
          {t("save")}
        </Button>
        <Button
          type="submit"
          name="intent"
          value="publish"
          variant="secondary"
          disabled={pending || !summary}
        >
          {t("publish")}
        </Button>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state?.ok && (
          <p className="text-sm text-primary">{state.published ? t("published") : t("saved")}</p>
        )}
      </div>
    </form>
  );
}

// Label bundles for the create-event / create-league forms, shared by
// /admin/events, /leagues and the store console (PL-17) so the three pages
// cannot drift. `t` is the namespace-bound translator (`events` / `leagues`).

type Translator = (key: string, values?: Record<string, string | number>) => string;

export function eventFormLabels(t: Translator): Record<string, string> {
  return {
    name: t("fName"),
    subtitle: t("fSubtitle"),
    subtitleHint: t("subtitleHint"),
    category: t("fCategory"),
    categoryPlaceholder: t("categoryPlaceholder"),
    categoryNone: t("categoryNone"),
    game: t("fGame"),
    gamePlaceholder: t("gamePlaceholder"),
    store: t("fStore"),
    storeNone: t("storeNone"),
    league: t("fLeague"),
    leaguePlaceholder: t("leaguePlaceholder"),
    leagueNone: t("leagueNone"),
    tournamentId: t("fTournamentId"),
    tournamentIdHint: t("tournamentIdHint"),
    status: t("fStatus"),
    statusOpen: t("status_open"),
    statusClosed: t("status_closed"),
    statusComplete: t("status_complete"),
    startsAt: t("fStartsAt"),
    location: t("fLocation"),
    cost: t("fCost"),
    capacity: t("fCapacity"),
    capacityHint: t("capacityHint"),
    externalUrl: t("fExternalUrl"),
    externalUrlHint: t("externalUrlHint"),
    description: t("fDescription"),
    prizes: t("fPrizes"),
    prizesHint: t("prizesHint"),
    listRequired: t("fListRequired"),
    listLock: t("fListLock"),
    listLockHint: t("listLockHint"),
    pasteTitle: t("pasteTitle"),
    pasteHint: t("pasteHint"),
    pastePlaceholder: t("pastePlaceholder"),
    pasteCta: t("pasteCta"),
    pasteFilled: t("pasteFilled"),
    pasteError: t("pasteError"),
    pasteStoreMatched: t("pasteStoreMatched", { name: "{name}" }),
    pasteStoreMissing: t("pasteStoreMissing", { id: "{id}" }),
    pasteStoreMismatch: t("pasteStoreMismatch", { id: "{id}" }),
    pasteLeagueMatched: t("pasteLeagueMatched", { name: "{name}" }),
    pasteLeagueNone: t("pasteLeagueNone"),
    pasteLeagueMany: t("pasteLeagueMany"),
    pasteNoLeagueId: t("pasteNoLeagueId"),
    cta: t("createCta"),
  };
}

export function leagueFormLabels(t: Translator) {
  return {
    name: t("fieldName"),
    game: t("fieldGame"),
    gamePlaceholder: t("gamePlaceholder"),
    format: t("fieldFormat"),
    formatPlaceholder: t("formatPlaceholder"),
    description: t("fieldDescription"),
    startMonth: t("fieldStartMonth"),
    endMonth: t("fieldEndMonth"),
    store: t("fieldStore"),
    storeNone: t("storeNone"),
    cta: t("createCta"),
  };
}

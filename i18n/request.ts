import { getRequestConfig } from "next-intl/server";

// Single-locale (Spanish) setup. Structured so more locales can be added later
// without reworking the app: swap this constant for a cookie/header lookup.
const locale = "es";

export default getRequestConfig(async () => {
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

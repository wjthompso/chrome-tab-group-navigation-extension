/**
 * Grouping key and title for "group tabs by domain".
 * The key is the registrable domain, lowercased, so mail.google.com and
 * google.com share a group. The title is the first label only, in title case:
 * Google.com is shown as Google. Brand spellings such as GitHub stay Github.
 */

/**
 * Platform suffixes that are not "category + country".
 * "foo.github.io" stays its own site instead of merging into Github.
 */
const MULTI_LABEL_SUFFIXES = new Set([
  "github.io", "blogspot.com", "web.app", "firebaseapp.com",
  "pages.dev", "netlify.app", "vercel.app", "herokuapp.com",
]);

/** Second labels in endings like gov.co, co.uk, and com.au. */
const COUNTRY_SECOND_LEVELS = new Set([
  "ac", "co", "com", "edu", "go", "gob", "gov", "lg", "mil", "ne", "net", "nic", "nom", "or", "org", "sch",
]);

function isCountryCode(label) {
  return label.length === 2 && /^[a-z]{2}$/.test(label);
}

function isIp(labels) {
  return labels.length === 4 && labels.every((label) => /^\d+$/.test(label));
}

function titleCaseLabel(label) {
  if (label.startsWith("xn--")) return label;
  return label
    .split("-")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join("-");
}

/** Lowercased registrable domain, or null when the hostname is empty. */
export function registrableDomain(hostname) {
  const labels = String(hostname)
    .toLowerCase()
    .replace(/\.$/, "")
    .split(".")
    .filter(Boolean);
  if (labels[0] === "www") labels.shift();
  if (labels.length === 0) return null;
  if (labels.length === 1 || isIp(labels)) return labels.join(".");

  const tld = labels.at(-1);
  const second = labels.at(-2);
  const countrySuffix = isCountryCode(tld) && COUNTRY_SECOND_LEVELS.has(second);
  const platformSuffix = MULTI_LABEL_SUFFIXES.has(`${second}.${tld}`);
  if (labels.length >= 3 && (countrySuffix || platformSuffix)) {
    return labels.slice(-3).join(".");
  }
  return labels.slice(-2).join(".");
}

/** "google.com" → "Google". "my-site.co.uk" → "My-Site". Addresses stay whole. */
export function titleCaseDomain(domain) {
  const labels = domain.split(".");
  if (isIp(labels)) return domain;
  return titleCaseLabel(labels[0]);
}

/**
 * @param {string} url
 * @returns {{ domain: string, title: string } | null}
 */
export function domainInfoFromUrl(url) {
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const domain = registrableDomain(parsed.hostname);
  if (!domain) return null;
  return { domain, title: titleCaseDomain(domain) };
}

/**
 * Unpinned http(s) tabs, clustered by registrable domain, in strip order.
 * @param {Array<{ id: number, index: number, pinned?: boolean, url?: string, pendingUrl?: string, groupId?: number }>} tabs
 */
export function clusterByDomain(tabs) {
  const buckets = new Map();
  const order = [];

  for (const tab of [...tabs].sort((a, b) => a.index - b.index)) {
    if (tab.pinned) continue;
    const info = domainInfoFromUrl(tab.url || tab.pendingUrl || "");
    if (!info) continue;

    let bucket = buckets.get(info.domain);
    if (!bucket) {
      bucket = { domain: info.domain, title: info.title, tabIds: [] };
      buckets.set(info.domain, bucket);
      order.push(bucket);
    }
    bucket.tabIds.push(tab.id);
  }

  return order;
}

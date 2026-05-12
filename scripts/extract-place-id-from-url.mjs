/**
 * extract-place-id-from-url.mjs
 *
 * Extracts place_id / CID / kgmid / lat / lng from GBP URLs.
 *
 * ── GBP URL formats found in the GYC sheet ──────────────────────────────────
 *
 * 100% of the 133 GBP URLs in the sheet are:
 *   https://share.google/<TOKEN>
 *
 * These are Google's new short-share links. They require 2 HTTP redirects:
 *   share.google/<TOKEN>
 *   → google.com/share.google?q=<TOKEN>
 *   → google.com/search?kgmid=/g/<KGID>&q=<Business Name>&...
 *
 * What we get from the redirect (no API call):
 *   - kgmid   : Google Knowledge Graph entity ID  e.g. /g/11y1r0vrky
 *   - name    : Business name from the `q` param
 *
 * What we CANNOT get without an API call:
 *   - place_id : ChIJ… format (needed for Places API Details, Reviews, etc.)
 *   - CID      : Numeric CID (not present in any redirect)
 *   - lat/lng  : Not embedded in these URLs
 *
 * ── Using kgmid ──────────────────────────────────────────────────────────────
 * kgmid IS a unique, stable Google entity ID.  You can use it two ways:
 *
 * 1. As a high-confidence `textQuery` seed for Places API (New) v1:
 *      POST https://places.googleapis.com/v1/places:searchText
 *      { "textQuery": "<business name>" }   — then match by kgmid if returned
 *
 * 2. Convert to place_id via Places API (Old) findPlaceFromText:
 *      GET https://maps.googleapis.com/maps/api/place/findplacefromtext/json
 *        ?input=<business name>&inputtype=textquery&fields=place_id,name
 *
 * Recommendation: skip the Places API lookup for kgmid extraction (free).
 * Use Places API only when you actually need a place_id (e.g. Reviews, Details).
 *
 * ── Summary ──────────────────────────────────────────────────────────────────
 * • 133 / 133 URLs  → require redirect follow to extract kgmid  (free, no API)
 * • 133 / 133 URLs  → still need Places API to get place_id
 * •   0 / 133 URLs  → have place_id or CID embedded directly
 *
 * Bottom line: The Google Places API CANNOT be skipped entirely.
 * But we CAN pre-extract kgmid + business name cheaply (just HTTP redirects),
 * giving us a better search signal to resolve place_id with fewer API errors.
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

// ─── Low-level redirect follower ────────────────────────────────────────────

function followRedirects(url, maxHops = 10, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const hops = [];

    function fetch(u) {
      if (hops.length >= maxHops) return resolve({ finalUrl: u, hops });
      hops.push(u);

      const lib = u.startsWith('https') ? https : http;
      const req = lib.request(
        u,
        { method: 'GET', timeout: timeoutMs, headers: { 'User-Agent': 'Mozilla/5.0' } },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const next = res.headers.location.startsWith('http')
              ? res.headers.location
              : new URL(res.headers.location, u).href;
            // consume body to avoid socket leaks
            res.resume();
            fetch(next);
          } else {
            res.resume();
            resolve({ finalUrl: u, statusCode: res.statusCode, hops });
          }
        }
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout following ${u}`));
      });
      req.end();
    }

    fetch(url);
  });
}

// ─── URL parsers ─────────────────────────────────────────────────────────────

/**
 * Try to extract identifiers directly from a URL string without any HTTP call.
 * Returns partial results — caller can check which fields are null.
 */
function parseUrlDirect(urlStr) {
  const result = { placeId: null, cid: null, kgmid: null, lat: null, lng: null, name: null };

  let u;
  try {
    u = new URL(urlStr);
  } catch {
    return result;
  }

  // ── place_id in query param  e.g. ?q=place_id:ChIJ… ──────────────────────
  const qParam = u.searchParams.get('q') || '';
  const placeIdMatch = qParam.match(/place_id:([A-Za-z0-9_-]+)/);
  if (placeIdMatch) result.placeId = placeIdMatch[1];

  // ── CID in ?cid=  e.g. https://maps.google.com/?cid=12345678 ──────────────
  const cidParam = u.searchParams.get('cid');
  if (cidParam && /^\d+$/.test(cidParam)) result.cid = cidParam;

  // ── kgmid in Google Search resolved URL  e.g. ?kgmid=/g/11y1r0vrky ───────
  const kgmid = u.searchParams.get('kgmid');
  if (kgmid) result.kgmid = kgmid;

  // ── business name from ?q= (only if not a place_id query) ────────────────
  if (!result.placeId && qParam && !qParam.includes('place_id:')) {
    result.name = decodeURIComponent(qParam).replace(/\+/g, ' ');
  }

  // ── lat/lng from @lat,lng in path  e.g. /maps/place/.../@37.123,-122.456,17z ─
  const coordMatch = (u.pathname + u.search).match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (coordMatch) {
    result.lat = parseFloat(coordMatch[1]);
    result.lng = parseFloat(coordMatch[2]);
  }

  return result;
}

// ─── Determine if URL needs a redirect follow ─────────────────────────────

function needsRedirect(urlStr) {
  try {
    const u = new URL(urlStr);
    return (
      u.hostname === 'share.google' ||
      u.hostname === 'g.page' ||
      u.hostname === 'maps.app.goo.gl' ||
      (u.hostname === 'goo.gl' && u.pathname.startsWith('/maps'))
    );
  } catch {
    return false;
  }
}

// ─── Main exported function ───────────────────────────────────────────────

/**
 * extractPlaceInfo(url)
 *
 * Accepts any GBP URL and returns:
 *   {
 *     placeId : string | null   — ChIJ… format (null for share.google URLs)
 *     cid     : string | null   — numeric CID (null for share.google URLs)
 *     kgmid   : string | null   — /g/XXXXX Knowledge Graph ID (from redirect)
 *     lat     : number | null
 *     lng     : number | null
 *     name    : string | null   — business name if extractable
 *     resolvedUrl : string      — final URL after redirects (or original)
 *     hops    : string[]        — redirect chain
 *   }
 *
 * For share.google URLs: follows 2 redirects, extracts kgmid + name for free.
 * place_id / CID / lat / lng are NOT available from these URLs — use Places API.
 */
export async function extractPlaceInfo(url) {
  const cleanUrl = url.trim();

  // 1. Try direct parse first (works for maps.google.com/?cid=…, place_id: params, etc.)
  const direct = parseUrlDirect(cleanUrl);
  if (direct.placeId || direct.cid || direct.kgmid) {
    return { ...direct, resolvedUrl: cleanUrl, hops: [cleanUrl] };
  }

  // 2. Short / share URLs → follow redirect then parse resolved URL
  if (needsRedirect(cleanUrl)) {
    const { finalUrl, hops } = await followRedirects(cleanUrl);
    const parsed = parseUrlDirect(finalUrl);
    return { ...parsed, resolvedUrl: finalUrl, hops };
  }

  // 3. Full maps URL — try parsing as-is
  return { ...direct, resolvedUrl: cleanUrl, hops: [cleanUrl] };
}

// ─── Batch helper ────────────────────────────────────────────────────────────

/**
 * batchExtract(urls, { concurrency = 5 })
 *
 * Process an array of GBP URL strings in parallel (with concurrency limit).
 * Returns array of { url, ...extractPlaceInfo result } objects.
 */
export async function batchExtract(urls, { concurrency = 5 } = {}) {
  const results = [];
  const queue = [...urls];

  async function worker() {
    while (queue.length) {
      const url = queue.shift();
      try {
        const info = await extractPlaceInfo(url);
        results.push({ url, ...info });
      } catch (err) {
        results.push({ url, error: err.message, placeId: null, cid: null, kgmid: null, lat: null, lng: null, name: null, resolvedUrl: url, hops: [] });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return results;
}

// ─── CLI smoke test ──────────────────────────────────────────────────────────

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const testUrls = [
    'https://share.google/BW4YjumtHQ1C6MTuQ',            // share.google
    'https://share.google/wkywNelvuegybLsF4',
    'https://www.google.com/maps/place/Alphabet+Academy/@40.7,-74.0,17z?q=place_id:ChIJXXX', // hypothetical place_id
    'https://maps.google.com/?cid=1234567890123456',       // CID
  ];

  console.log('Testing extract-place-id-from-url.mjs...\n');
  for (const u of testUrls) {
    console.log('INPUT:', u);
    const result = await extractPlaceInfo(u);
    console.log('OUTPUT:', JSON.stringify(result, null, 2));
    console.log('---');
  }
}

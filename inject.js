// Runs in the page's MAIN world at document_start, before the site's bundle loads.
// Wraps window.fetch so that requests to the Constructor.io browse/search API
// (which powers the product grid) come back with one item per product family
// instead of one item per color.
//
// Strategy: on the first grid request for a given query (collection + filters +
// sort), fetch the entire result set in pages of 200, collapse it once, cache it,
// then answer the site's own page requests by slicing the collapsed list and
// rewriting total_num_results. That keeps the site's pagination, virtual grid
// height and "(N)" result count consistent with what is shown.
(() => {
  if (window.__fabCollapseInstalled) return;
  window.__fabCollapseInstalled = true;

  const EVT = {
    settings: 'fabcollapse:settings', // isolated world -> here (JSON string)
    ready: 'fabcollapse:ready',       // here -> isolated world, "send me settings"
  };

  const settings = {
    enabled: true,
    mergeByName: true,   // also merge items whose group codes differ but names match
    pick: 'first',       // 'first' (site's relevance order) or 'mostSizes'
  };

  document.addEventListener(EVT.settings, (e) => {
    try { Object.assign(settings, JSON.parse(e.detail)); } catch { /* ignore */ }
  });
  document.dispatchEvent(new CustomEvent(EVT.ready));

  const nativeFetch = window.fetch;
  const CACHE_TTL_MS = 10 * 60 * 1000;
  const MAX_PAGES = 15;        // 15 x 200 = 3000 items, plenty for any grid
  const PAGE_SIZE = 200;       // Constructor.io's maximum per request
  const cache = new Map();     // queryKey -> { promise, at }

  // ---- request classification -------------------------------------------

  function isGridRequest(url) {
    if (url.hostname !== 'ac.cnstrc.com') return false;
    const p = url.pathname;
    if (p.startsWith('/search/')) return true;
    if (p.startsWith('/browse/')) {
      // /browse/<facet>/<value> is a grid. These are not:
      return !/^\/browse\/(facets?|facet_options|facets_with_options|items|groups)(\/|\?|$)/.test(p);
    }
    return false;
  }

  // Params that change between page requests but do not change the result set.
  const VOLATILE = new Set(['page', 'num_results_per_page', '_dt', 'i', 's', 'c']);

  function queryKey(url) {
    const parts = [];
    for (const [k, v] of url.searchParams) {
      if (VOLATILE.has(k)) continue;
      // pre_filter_expression embeds a "now" timestamp; neutralize it.
      parts.push(k + '=' + v.replace(/\b1\d{12}\b/g, 'TS'));
    }
    parts.sort();
    return url.origin + url.pathname + '?' + parts.join('&');
  }

  // ---- grouping ---------------------------------------------------------

  function normalizeGroupCode(code) {
    // Some families appear as both "LG2500577" and "LG2500577_LC".
    return String(code).trim().replace(/_[A-Z]{1,3}$/, '');
  }

  function normalizeName(label) {
    return String(label).toLowerCase().replace(/[®™]/g, '').replace(/\s+/g, ' ').trim();
  }

  function sizeScore(item) {
    const facets = item && item.data && item.data.facets;
    if (!Array.isArray(facets)) return 0;
    let n = 0;
    for (const f of facets) {
      if (f && /^available_size_/.test(f.name) && Array.isArray(f.values)) {
        n += f.values.filter((v) => v !== 'no-size').length;
      }
    }
    return n;
  }

  // A group code shared by more than this many differently named products is a
  // placeholder (e.g. every outfit carries group_code "outfit"), not a family.
  const GENERIC_GROUP_LABEL_LIMIT = 4;

  function genericGroupCodes(items) {
    const labelsByGroup = new Map();
    for (const item of items) {
      const d = (item && item.data) || {};
      if (!d.group_code || !d.label) continue;
      const g = normalizeGroupCode(d.group_code);
      if (!labelsByGroup.has(g)) labelsByGroup.set(g, new Set());
      labelsByGroup.get(g).add(normalizeName(d.label));
    }
    const generic = new Set();
    for (const [g, labels] of labelsByGroup) {
      if (labels.size > GENERIC_GROUP_LABEL_LIMIT) generic.add(g);
    }
    return generic;
  }

  function collapse(items) {
    const out = [];
    const keptIndex = new Map();   // familyKey -> index into out
    const nameToKey = new Map();   // normalized name -> familyKey
    const generic = genericGroupCodes(items);

    for (const item of items) {
      const d = (item && item.data) || {};
      const group = d.group_code ? normalizeGroupCode(d.group_code) : null;
      let key = group && !generic.has(group) ? 'g:' + group : null;
      const name = d.label ? normalizeName(d.label) : null;

      if (name && (settings.mergeByName || !key)) {
        if (key) {
          const prior = nameToKey.get(name);
          if (prior && prior !== key) key = prior; else nameToKey.set(name, key);
        } else {
          key = 'n:' + name;
        }
      }

      if (!key) { out.push(item); continue; }

      if (!keptIndex.has(key)) {
        keptIndex.set(key, out.length);
        out.push(item);
        continue;
      }

      if (settings.pick === 'mostSizes') {
        const idx = keptIndex.get(key);
        if (sizeScore(item) > sizeScore(out[idx])) out[idx] = item;
      }
    }
    return { items: out, families: keptIndex.size };
  }

  // ---- loading ----------------------------------------------------------

  async function loadAll(url) {
    const all = [];
    let total = Infinity;
    for (let page = 1; all.length < total && page <= MAX_PAGES; page++) {
      const u = new URL(url);
      u.searchParams.set('page', String(page));
      u.searchParams.set('num_results_per_page', String(PAGE_SIZE));
      const res = await nativeFetch(u.toString());
      if (!res.ok) throw new Error('constructor.io returned ' + res.status);
      const json = await res.json();
      const results = json && json.response && json.response.results;
      if (!Array.isArray(results)) throw new Error('unexpected response shape');
      total = Number(json.response.total_num_results) || results.length;
      all.push(...results);
      if (results.length < PAGE_SIZE) break;
    }
    const collapsed = collapse(all);
    return { items: collapsed.items };
  }

  function getCollapsed(url) {
    const key = queryKey(url);
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && now - hit.at < CACHE_TTL_MS) return hit.promise;
    const promise = loadAll(url);
    cache.set(key, { promise, at: now });
    promise.catch(() => cache.delete(key));
    if (cache.size > 20) cache.delete(cache.keys().next().value);
    return promise;
  }

  // ---- fetch wrapper ----------------------------------------------------

  async function handleGridRequest(url, thisArg, args) {
    const res = await nativeFetch.apply(thisArg, args);
    if (!res.ok) return res;

    let json;
    try { json = await res.clone().json(); } catch { return res; }
    if (!json || !json.response || !Array.isArray(json.response.results)) return res;

    try {
      const { items } = await getCollapsed(url);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const per = Math.max(1, parseInt(url.searchParams.get('num_results_per_page') || '24', 10) || 24);

      json.response.results = items.slice((page - 1) * per, page * per);
      json.response.total_num_results = items.length;

      const headers = new Headers(res.headers);
      headers.delete('content-length');
      headers.delete('content-encoding');
      return new Response(JSON.stringify(json), { status: res.status, statusText: res.statusText, headers });
    } catch (err) {
      console.warn('[Fabletics Color Collapse] falling back to original response:', err);
      return res;
    }
  }

  window.fetch = function fetch(input, init) {
    if (!settings.enabled) return nativeFetch.apply(this, arguments);
    let url;
    try {
      const raw = typeof input === 'string' ? input
        : input instanceof URL ? input.href
        : input && typeof input.url === 'string' ? input.url : null;
      if (!raw) return nativeFetch.apply(this, arguments);
      url = new URL(raw, location.href);
    } catch {
      return nativeFetch.apply(this, arguments);
    }
    if (!isGridRequest(url)) return nativeFetch.apply(this, arguments);
    return handleGridRequest(url, this, arguments);
  };
})();

// Isolated-world content script. Bridges chrome.storage settings to inject.js
// (main world) via DOM events and renders the docked on-page toggle button.
const DEFAULTS = { enabled: true, mergeByName: true, pick: 'first' };
let current = { ...DEFAULTS };
let settingsLoaded = false; // the dock is not drawn until the saved setting is known

function pushSettings() {
  document.dispatchEvent(new CustomEvent('fabcollapse:settings', { detail: JSON.stringify(current) }));
  renderDock();
}

document.addEventListener('fabcollapse:ready', pushSettings);

chrome.storage.sync.get(DEFAULTS, (stored) => {
  current = { ...DEFAULTS, ...stored };
  settingsLoaded = true;
  pushSettings();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  for (const key of Object.keys(changes)) current[key] = changes[key].newValue;
  pushSettings();
});

// ---- docked toggle -----------------------------------------------------
// A fixed-size button on the right edge. Click toggles collapsing; drag slides
// it up or down the edge. Its vertical position is remembered per device.

const DOCK_POS_KEY = 'dockTopFraction';
const DRAG_THRESHOLD_PX = 4;
let dock = null;
let topFraction = 0.38;

chrome.storage.local.get({ [DOCK_POS_KEY]: topFraction }, (v) => {
  topFraction = v[DOCK_POS_KEY];
  if (dock) placeDock();
});

function ensureDock() {
  if (dock) return dock;
  const host = document.createElement('div');
  host.id = 'fabcollapse-dock';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      :host { all: initial; position: fixed; right: 0; top: 38vh; z-index: 2147483646; }
      button {
        all: initial; cursor: pointer; display: block; box-sizing: border-box;
        width: 44px; height: 44px; padding: 7px 9px 7px 7px;
        background: #fff; border: 1px solid rgba(0,0,0,.12); border-right: 0;
        border-radius: 12px 0 0 12px; box-shadow: 0 2px 10px rgba(0,0,0,.14);
        touch-action: none; user-select: none; -webkit-user-select: none;
      }
      button:focus-visible { outline: 2px solid #00d8e6; outline-offset: 2px; }
      button.dragging { cursor: grabbing; box-shadow: 0 4px 16px rgba(0,0,0,.22); }
      img { width: 28px; height: 28px; display: block; pointer-events: none;
            transition: filter .15s ease, opacity .15s ease; }
      button[aria-pressed="false"] { background: #f4f4f4; }
      button[aria-pressed="false"] img { filter: grayscale(1); opacity: .35; }
      @media (prefers-color-scheme: dark) {
        button { background: #1b1b1b; border-color: rgba(255,255,255,.14); }
        button[aria-pressed="false"] { background: #141414; }
      }
    </style>
    <button type="button" aria-pressed="${current.enabled}"><img alt=""></button>`;
  const button = root.querySelector('button');
  root.querySelector('img').src = chrome.runtime.getURL('icons/icon128.png');

  let drag = null; // { startY, startTop, moved }
  button.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { startY: e.clientY, startTop: host.getBoundingClientRect().top, moved: false };
    button.setPointerCapture(e.pointerId);
  });
  button.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
    drag.moved = true;
    button.classList.add('dragging');
    host.style.top = clampTop(drag.startTop + dy) + 'px';
  });
  const endDrag = async (e) => {
    if (!drag) return;
    const wasDrag = drag.moved;
    drag = null;
    button.classList.remove('dragging');
    if (wasDrag) {
      topFraction = host.getBoundingClientRect().top / window.innerHeight;
      chrome.storage.local.set({ [DOCK_POS_KEY]: topFraction });
      return;
    }
    if (e.type === 'pointerup') {
      button.disabled = true;
      await chrome.storage.sync.set({ enabled: !current.enabled });
      location.reload();
    }
  };
  button.addEventListener('pointerup', endDrag);
  button.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', () => { if (dock) placeDock(); });

  dock = { host, button };
  document.documentElement.appendChild(host);
  placeDock();
  return dock;
}

function clampTop(px) {
  const h = dock ? dock.host.offsetHeight || 44 : 44;
  const margin = 8;
  return Math.min(Math.max(px, margin), window.innerHeight - h - margin);
}

function placeDock() {
  dock.host.style.top = clampTop(topFraction * window.innerHeight) + 'px';
}

function renderDock() {
  if (!settingsLoaded) return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderDock, { once: true });
    return;
  }
  const d = ensureDock();
  // Keep the dock outside <body>'s React tree so hydration never touches it.
  if (d.host.parentNode !== document.documentElement) document.documentElement.appendChild(d.host);
  d.button.setAttribute('aria-pressed', String(current.enabled));
  d.button.title = current.enabled ? 'Click to show all variations' : 'Click to collapse colors';
  d.button.setAttribute('aria-label', current.enabled ? 'Collapsing colors. Click to show all variations.' : 'Showing all variations. Click to collapse colors.');
}

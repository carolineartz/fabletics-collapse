const DEFAULTS = { enabled: true, mergeByName: true, pick: 'first' };
const $ = (id) => document.getElementById(id);

function render(settings) {
  $('enabled').checked = settings.enabled;
  $('mergeByName').checked = settings.mergeByName;
  $('pick').value = settings.pick;
  document.body.classList.toggle('off', !settings.enabled);
}

async function activeFableticsTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab && tab.url && /^https:\/\/([^/]+\.)?fabletics\.com\//.test(tab.url) ? tab : null;
}

async function save(patch) {
  await chrome.storage.sync.set(patch);
  const tab = await activeFableticsTab();
  if (tab) chrome.tabs.reload(tab.id);
}

chrome.storage.sync.get(DEFAULTS, (stored) => render({ ...DEFAULTS, ...stored }));

$('enabled').addEventListener('change', (e) => { document.body.classList.toggle('off', !e.target.checked); save({ enabled: e.target.checked }); });
$('mergeByName').addEventListener('change', (e) => save({ mergeByName: e.target.checked }));
$('pick').addEventListener('change', (e) => save({ pick: e.target.value }));

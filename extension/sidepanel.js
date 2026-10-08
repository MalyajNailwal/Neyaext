const DEFAULT_STUDIO = 'https://neya-eight.vercel.app';
const frame = document.getElementById('studio');
const status = document.getElementById('status');
const search = document.getElementById('shop-search');
let studioOrigin = DEFAULT_STUDIO;
let selectedProduct = null;
let studioReady = false;
function safeStudio(value) {
  try { const url = new URL(value); if (url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)) return url.origin; }
  catch { /* invalid setting */ }
  return DEFAULT_STUDIO;
}
function sendProduct() {
  if (selectedProduct && frame.contentWindow) frame.contentWindow.postMessage({ type: 'TRYON_PRODUCT', product: selectedProduct }, studioOrigin);
}
chrome.storage.sync.get('studioUrl').then(({ studioUrl }) => {
  studioOrigin = safeStudio(studioUrl || DEFAULT_STUDIO);
  frame.src = `${studioOrigin}/try-on?sidepanel=1`;
});
chrome.storage.session.get('selectedProduct').then(({ selectedProduct: product }) => { if (product) { selectedProduct = product; sendProduct(); } });
frame.addEventListener('load', () => { if (!studioReady) status.textContent = 'Connecting your studio…'; sendProduct(); });
window.addEventListener('message', event => {
  if (event.origin !== studioOrigin) return;
  if (event.source === frame.contentWindow && event.data?.type === 'TRYON_STUDIO_READY') {
    studioReady = true; status.textContent = 'Ready to browse'; sendProduct(); return;
  }
  if (event.source === frame.contentWindow && event.data?.type === 'TRYON_PICK_IMAGE') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]?.id) return chrome.tabs.sendMessage(tabs[0].id, { type: 'START_PICKER' }).then(response => {
        if (!response?.ok) throw new Error('PICKER_UNAVAILABLE');
        status.textContent = 'Hover over a clothing image, then click to select';
      });
      throw new Error('NO_TAB');
    }).catch(() => { status.textContent = 'Refresh the shopping tab, then tap Change again'; });
    return;
  }
  if (event.source === frame.contentWindow && event.data?.type === 'TRYON_OPEN_MIRROR') {
    const product = event.data.product || selectedProduct;
    chrome.runtime.sendMessage({ type: 'OPEN_MIRROR', product });
    return;
  }
  if (event.source === frame.contentWindow && event.data?.type === 'TRYON_EXIT_FULLSCREEN' && document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
});
setTimeout(() => { if (!studioReady) status.textContent = 'Studio unavailable · open full studio'; }, 8000);
const port = chrome.runtime.connect({ name: 'studio-sidepanel' });
port.onMessage.addListener(message => { if (message?.type === 'PRODUCT_SELECTED') { selectedProduct = message.product; sendProduct(); status.textContent = 'Look selected'; } });
document.getElementById('shop-form').addEventListener('submit', event => {
  event.preventDefault();
  const value = search.value.trim();
  if (!value) return;
  let url = `https://www.google.com/search?q=${encodeURIComponent(`${value} clothing`)}`;
  if (/^https?:\/\//i.test(value)) {
    try { const direct = new URL(value); if (!['http:', 'https:'].includes(direct.protocol) || direct.username || direct.password) throw new Error(); url = direct.href; }
    catch { status.textContent = 'Enter a valid store URL'; return; }
  }
  chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    if (tabs[0]?.id) return chrome.tabs.update(tabs[0].id, { url });
    return chrome.tabs.create({ url });
  }).then(() => { status.textContent = 'Pick a product image on the page'; }).catch(() => { status.textContent = 'Could not open that page'; });
});
document.getElementById('open-full').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_MIRROR', product: selectedProduct });
});

const expandBtn = document.getElementById('toggle-full');
async function setFullscreen(on) {
  try {
    if (on) { if (!document.fullscreenElement) await frame.requestFullscreen(); }
    else if (document.fullscreenElement) await document.exitFullscreen();
  } catch { status.textContent = 'Full screen is blocked here'; }
}
expandBtn.addEventListener('click', () => setFullscreen(true));
document.addEventListener('fullscreenchange', () => {
  const on = !!document.fullscreenElement;
  expandBtn.hidden = on;
  // The studio page cannot detect fullscreen from inside the frame, so tell it explicitly.
  try { frame.contentWindow?.postMessage({ type: 'TRYON_FULLSCREEN', fullscreen: on }, studioOrigin); } catch { /* frame not ready */ }
  if (on) chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => { if (tabs[0]?.id) chrome.tabs.sendMessage(tabs[0].id, { type: 'AUTO_PICKER' }).catch(() => {}); });
});

document.getElementById('close-panel').addEventListener('click', async () => {
  try {
    if (typeof chrome.sidePanel?.close === 'function') {
      const currentWindow = await chrome.windows.getCurrent();
      await chrome.sidePanel.close({ windowId: currentWindow.id });
    }
  } catch { /* older browser or standalone panel page */ }
  window.close();
});

const DEFAULT_STUDIO = 'https://neya-eight.vercel.app';
const panelPorts = new Set();
const MAX_IMAGE_URL_LENGTH = 8192;
function safeImageUrl(value) {
  if (typeof value !== 'string' || value.length > MAX_IMAGE_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  } catch { return false; }
}
function safeStudio(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return url.origin;
  } catch { /* ignored */ }
  return DEFAULT_STUDIO;
}
function safeProduct(product, maxImages = 8) {
  return product && safeImageUrl(product.imageUrl) ? {
    imageUrl: product.imageUrl, title: String(product.title || '').slice(0, 140),
    images: (Array.isArray(product.images) ? product.images : []).filter(safeImageUrl).slice(0, maxImages)
  } : null;
}
function studioProductUrl(studioOrigin, product) {
  const safe = safeProduct(product, 4);
  const payload = safe ? `#product=${encodeURIComponent(JSON.stringify({ imageUrl: safe.imageUrl, title: safe.title }))}` : '';
  return `${studioOrigin}/try-on${payload}`;
}
async function openStudio(product) {
  const { studioUrl } = await chrome.storage.sync.get('studioUrl');
  const url = studioProductUrl(safeStudio(studioUrl || DEFAULT_STUDIO), product);
  const { studioTabId } = await chrome.storage.session.get('studioTabId');
  if (studioTabId) {
    try { await chrome.tabs.update(studioTabId, { url, active: true }); await chrome.windows.update((await chrome.tabs.get(studioTabId)).windowId, { focused: true }); return; }
    catch { /* old tab closed */ }
  }
  const tab = await chrome.tabs.create({ url });
  if (tab.id) await chrome.storage.session.set({ studioTabId: tab.id });
}
async function openMirror(product) {
  const { studioUrl } = await chrome.storage.sync.get('studioUrl');
  const url = studioProductUrl(safeStudio(studioUrl || DEFAULT_STUDIO), product);
  const { studioTabId } = await chrome.storage.session.get('studioTabId');
  if (studioTabId) {
    try {
      const tab = await chrome.tabs.get(studioTabId);
      if (!tab.url || tab.url.startsWith(safeStudio(studioUrl || DEFAULT_STUDIO) + '/try-on')) {
        await chrome.tabs.update(studioTabId, { url });
        await chrome.windows.update(tab.windowId, { focused: true });
        return;
      }
    } catch { /* closed studio */ }
  }
  const window = await chrome.windows.create({ url, type: 'popup', width: 520, height: 820 });
  const tabId = window.tabs?.[0]?.id || (await chrome.tabs.query({ windowId: window.id }))[0]?.id;
  if (tabId) await chrome.storage.session.set({ studioTabId: tabId });
}
async function syncMirror(product) {
  const { studioTabId } = await chrome.storage.session.get('studioTabId');
  if (!studioTabId || !product) return;
  const { studioUrl } = await chrome.storage.sync.get('studioUrl');
  const origin = safeStudio(studioUrl || DEFAULT_STUDIO);
  try {
    const tab = await chrome.tabs.get(studioTabId);
    if (tab.url && !tab.url.startsWith(origin + '/try-on')) return;
    await chrome.tabs.update(studioTabId, { url: studioProductUrl(origin, product) });
  } catch { await chrome.storage.session.remove('studioTabId'); }
}
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'studio-sidepanel') return;
  panelPorts.add(port);
  chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => { if (tabs[0]?.id) chrome.tabs.sendMessage(tabs[0].id, { type: 'AUTO_PICKER' }).catch(() => {}); });
  port.onDisconnect.addListener(() => {
    panelPorts.delete(port);
    if (!panelPorts.size) chrome.tabs.query({}).then(tabs => { for (const tab of tabs) if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'STOP_PICKER' }).catch(() => {}); });
  });
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'IS_BROWSING') { sendResponse({ active: panelPorts.size > 0 }); return; }
  if (message?.type === 'OPEN_BROWSER') {
    const product = safeProduct(message.product);
    const windowId = sender.tab?.windowId || (Number.isInteger(message.windowId) ? message.windowId : null);
    const open = panelPorts.size ? Promise.resolve() : chrome.sidePanel?.open && windowId ? chrome.sidePanel.open({ windowId }) : Promise.reject(new Error('SIDE_PANEL_UNAVAILABLE'));
    (async () => {
      if (product) {
        await chrome.storage.session.set({ selectedProduct: product });
        for (const port of panelPorts) { try { port.postMessage({ type: 'PRODUCT_SELECTED', product }); } catch { panelPorts.delete(port); } }
        await syncMirror(product);
      }
      try { await open; sendResponse({ ok: true }); }
      catch { if (panelPorts.size) sendResponse({ ok: true }); else { await openStudio(product); sendResponse({ ok: true, fallback: true }); } }
    })().catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === 'OPEN_STUDIO') {
    openStudio(message.product).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === 'OPEN_MIRROR') {
    openMirror(message.product).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === 'GET_PRODUCT') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(async tabs => {
      if (!tabs[0]?.id) return sendResponse({ product: null });
      try { sendResponse(await chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PRODUCT' })); }
      catch { sendResponse({ product: null }); }
    });
    return true;
  }
  if (message?.type === 'START_PICKER') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(async tabs => {
      if (!tabs[0]?.id) return sendResponse({ ok: false });
      try { sendResponse(await chrome.tabs.sendMessage(tabs[0].id, { type: 'START_PICKER' })); }
      catch { sendResponse({ ok: false }); }
    });
    return true;
  }
});

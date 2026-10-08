const statusEl = document.getElementById('status');
const tryButton = document.getElementById('try');
let product = null;
let popupWindowId = null;
chrome.windows?.getCurrent?.().then(window => { popupWindowId = window.id; }).catch(() => {});
chrome.runtime.sendMessage({ type: 'GET_PRODUCT' }, response => {
  if (chrome.runtime.lastError || !response?.product) { statusEl.textContent = 'Open a clothing product page to start trying on.'; return; }
  product = response.product;
  statusEl.textContent = `Ready to try: ${product.title || 'this item'}`;
  tryButton.disabled = false;
});
tryButton.onclick = () => product && chrome.runtime.sendMessage({ type: 'OPEN_BROWSER', product, windowId: popupWindowId });
document.getElementById('pick').onclick = () => chrome.runtime.sendMessage({ type: 'START_PICKER' }, response => {
  if (chrome.runtime.lastError || !response?.ok) statusEl.textContent = 'Open a shopping page, then try picking an image.';
  else window.close();
});
document.getElementById('open').onclick = () => chrome.runtime.sendMessage({ type: 'OPEN_BROWSER', windowId: popupWindowId });
document.getElementById('settings-toggle').onclick = () => { document.getElementById('settings').hidden = !document.getElementById('settings').hidden; };
chrome.storage.sync.get('studioUrl').then(({ studioUrl }) => { document.getElementById('studio-url').value = studioUrl || 'https://neya-eight.vercel.app'; });
document.getElementById('save').onclick = async () => {
  const input = document.getElementById('studio-url');
  try {
    const url = new URL(input.value);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error();
    await chrome.storage.sync.set({ studioUrl: url.origin });
    input.value = url.origin;
    statusEl.textContent = 'Studio URL saved.';
  } catch { statusEl.textContent = 'Use an HTTPS URL or localhost.'; }
};

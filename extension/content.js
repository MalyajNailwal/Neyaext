(function () {
  if (globalThis.__aiTryOnLoaded) return;
  globalThis.__aiTryOnLoaded = true;
  let current = null, host = null, hiddenUrl = '', timer = null, lastUrl = location.href, pickerHost = null, highlight = null, autoBrowse = false, manualPicker = false;
  const targetImage = event => {
    if (event.target?.closest?.('#ai-try-on-control,#ai-try-on-picker,button,input,select,textarea')) return null;
    const direct = event.composedPath?.().find(node => node.tagName === 'IMG') || event.target?.closest?.('img');
    if (direct) return direct;
    // Store galleries often place a transparent zoom/link layer over the photo.
    const stack = document.elementsFromPoint?.(event.clientX, event.clientY) || [];
    for (const element of stack) {
      if (element.tagName === 'IMG') return element;
      if (element === document.body || element === document.documentElement) continue;
      for (const img of element.querySelectorAll?.('img') || []) {
        const rect = img.getBoundingClientRect();
        if (rect.width >= 140 && rect.height >= 140 && event.clientX >= rect.left && event.clientX <= rect.left + rect.width && event.clientY >= rect.top && event.clientY <= rect.top + rect.height) {
          const style = getComputedStyle(img);
          if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') return img;
        }
      }
    }
    return null;
  };
  const pickMove = event => {
    if (!highlight) return;
    const img = targetImage(event);
    if (!img) { highlight.style.display = 'none'; return; }
    const rect = img.getBoundingClientRect();
    if (rect.width < 140 || rect.height < 140) { highlight.style.display = 'none'; return; }
    Object.assign(highlight.style, { display: 'block', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  };
  const stopPicker = () => {
    document.removeEventListener('pointermove', pickMove, true);
    document.removeEventListener('click', pickClick, true);
    document.removeEventListener('keydown', pickKey, true);
    pickerHost?.remove(); pickerHost = null; highlight = null;
  };
  const pickKey = event => { if (event.key === 'Escape') { autoBrowse = false; manualPicker = false; stopPicker(); } };
  const pickNote = text => { const note = pickerHost?.shadowRoot?.querySelector('.pick-note'); if (note) note.textContent = text; };
  const pickClick = event => {
    const img = targetImage(event);
    if (!img) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const product = globalThis.TryOnDetector.fromClickedImage(img, document, window);
    if (!product) { pickNote('Choose a large clothing image on a product page.'); return; }
    pickNote('Selecting clothing…');
    chrome.runtime.sendMessage({ type: 'OPEN_BROWSER', product }, response => {
      if (chrome.runtime.lastError || !response?.ok) { pickNote('Could not select this image. Try again, or reload the extension and page.'); return; }
      pickNote('Selected ✓ · click another image to switch · Esc to stop');
    });
  };
  const startPicker = () => {
    if (pickerHost) return;
    pickerHost = document.createElement('div'); pickerHost.id = 'ai-try-on-picker';
    const shadow = pickerHost.attachShadow({ mode: 'open' });
    const style = document.createElement('style'); style.textContent = ':host{all:initial;pointer-events:none}.pick-note{position:fixed;z-index:2147483647;top:18px;left:50%;transform:translateX(-50%);padding:12px 18px;border-radius:999px;background:#151c13;color:#e9f7d9;border:1px solid #d6ff80;box-shadow:0 10px 30px #0008;font:700 13px system-ui,sans-serif;white-space:nowrap}.pick-highlight{position:fixed;z-index:2147483646;display:none;outline:3px solid #d6ff80;outline-offset:2px;border-radius:4px;box-shadow:0 0 0 100vmax #0003;pointer-events:none}';
    const note = document.createElement('div'); note.className = 'pick-note'; note.textContent = 'Click a clothing image to try it on · Esc to cancel';
    highlight = document.createElement('div'); highlight.className = 'pick-highlight';
    shadow.append(style, note, highlight); document.documentElement.append(pickerHost);
    document.addEventListener('pointermove', pickMove, true);
    document.addEventListener('click', pickClick, true);
    document.addEventListener('keydown', pickKey, true);
  };
  const scan = () => {
    if (location.href !== lastUrl) { lastUrl = location.href; hiddenUrl = ''; stopPicker(); }
    const result = globalThis.TryOnDetector.detect(document, window);
    current = result.product ? { ...result.product, images: result.images.map(x => x.imageUrl).slice(0, 8) } : null;
    if ((manualPicker || autoBrowse && current) && !pickerHost) startPicker();
    if (!current && autoBrowse && !manualPicker && pickerHost) stopPicker();
    if (!current || hiddenUrl === location.href) { host?.remove(); host = null; return; }
    if (host) return;
    host = document.createElement('div');
    host.id = 'ai-try-on-control';
    const shadow = host.attachShadow({ mode: 'closed' });
    const css = ':host{all:initial} .wrap{position:fixed;right:22px;bottom:24px;z-index:2147483646;display:flex;align-items:center;gap:2px;padding:5px;background:#191b1b;color:white;border:1px solid #8a8e86;border-radius:16px;box-shadow:0 12px 35px #0005;font:600 14px system-ui,sans-serif;animation:arrive .35s ease-out}button{border:0;color:inherit;background:transparent;cursor:pointer} .try{padding:10px 14px;border-radius:12px;background:#d6ff80;color:#14200b;font:700 14px system-ui,sans-serif}.try:hover{background:#e6ffa8}.pick{padding:9px 12px;font:700 12px system-ui,sans-serif;color:#e6f4d9;border-radius:10px}.pick:hover{background:#394535}.close{padding:7px 10px;font-size:18px;line-height:1}.drag{cursor:grab;padding:7px;color:#a9b1a0;touch-action:none;user-select:none}@keyframes arrive{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}';
    if (typeof CSSStyleSheet !== 'undefined' && 'adoptedStyleSheets' in shadow) { const sheet = new CSSStyleSheet(); sheet.replaceSync(css); shadow.adoptedStyleSheets = [sheet]; }
    else { const style = document.createElement('style'); style.textContent = css; shadow.append(style); }
    const wrap = document.createElement('div'); wrap.className = 'wrap';
    const drag = document.createElement('span'); drag.className = 'drag'; drag.textContent = '⋮⋮'; drag.title = 'Drag';
    const tryButton = document.createElement('button'); tryButton.className = 'try'; tryButton.textContent = '👕  Try On'; tryButton.setAttribute('aria-label', 'Try on this product');
    const pickButton = document.createElement('button'); pickButton.className = 'pick'; pickButton.textContent = 'Pick image'; pickButton.setAttribute('aria-label', 'Pick a clothing image on this page');
    const close = document.createElement('button'); close.className = 'close'; close.textContent = '×'; close.setAttribute('aria-label', 'Hide Try On');
    tryButton.onclick = () => chrome.runtime.sendMessage({ type: 'OPEN_BROWSER', product: current });
    pickButton.onclick = () => { manualPicker = true; startPicker(); };
    close.onclick = () => { hiddenUrl = location.href; host?.remove(); host = null; };
    drag.onpointerdown = event => {
      event.preventDefault(); drag.setPointerCapture(event.pointerId);
      const startX = event.clientX, startY = event.clientY, rect = wrap.getBoundingClientRect();
      drag.onpointermove = move => { wrap.style.right = 'auto'; wrap.style.bottom = 'auto'; wrap.style.left = `${Math.max(0, Math.min(innerWidth - rect.width, rect.left + move.clientX - startX))}px`; wrap.style.top = `${Math.max(0, Math.min(innerHeight - rect.height, rect.top + move.clientY - startY))}px`; };
      drag.onpointerup = () => { drag.onpointermove = null; drag.onpointerup = null; };
    };
    wrap.append(drag, tryButton, pickButton, close); shadow.append(wrap); document.documentElement.append(host);
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(scan, 350); };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'class'] });
  addEventListener('popstate', schedule);
  addEventListener('pageshow', schedule);
  if (window.navigation?.addEventListener) window.navigation.addEventListener('navigate', schedule);
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'GET_PRODUCT') sendResponse({ product: current, supported: !!current });
    if (message?.type === 'START_PICKER') { manualPicker = true; startPicker(); sendResponse({ ok: true }); }
    if (message?.type === 'AUTO_PICKER') { autoBrowse = true; if (current) startPicker(); sendResponse({ ok: true }); }
    if (message?.type === 'STOP_PICKER') { autoBrowse = false; manualPicker = false; stopPicker(); sendResponse({ ok: true }); }
  });
  scan();
  chrome.runtime.sendMessage({ type: 'IS_BROWSING' }, response => { if (response?.active) { autoBrowse = true; if (current) startPicker(); } });
})();

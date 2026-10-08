/* Lightweight, dependency-free detector shared by Chrome and Edge. */
(function (root) {
  const CLOTHING = /\b(shirt|tee|t-shirt|jacket|hoodie|dress|pants|jeans|coat|blazer|sweater|sweatshirt|skirt|top|kurta|saree|trousers|cardigan|vest|shorts|clothing|apparel|fashion)\b/i;
  const EXCLUDE = /\b(logo|banner|sprite|icon|avatar|payment|review|recommend|related|thumbnail|thumb|advert|placeholder)\b/i;
  const clean = value => value == null || typeof value === 'object' ? '' : String(value).trim().replace(/\s+/g, ' ').slice(0, 200);
  const absolute = (value, base) => {
    try {
      if (typeof value !== 'string' || !value.trim()) return '';
      const url = new URL(value, base);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch { return ''; }
  };
  const imageValues = value => Array.isArray(value) ? value.flatMap(imageValues) : typeof value === 'string' ? [value] : value && typeof value === 'object' ? imageValues(value.url || value.src || value.contentUrl) : [];
  const jsonProducts = data => {
    if (Array.isArray(data)) return data.flatMap(jsonProducts);
    if (!data || typeof data !== 'object') return [];
    const own = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
    const found = own.some(type => /Product/i.test(type || '')) ? [data] : [];
    return found.concat(jsonProducts(data['@graph']));
  };
  const visible = (img, win) => {
    const rect = img.getBoundingClientRect();
    const style = win.getComputedStyle(img);
    return rect.width >= 140 && rect.height >= 140 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  };
  /** @typedef {{imageUrl:string,title:string,source:string,confidence:number}} ProductCandidate */
  function detect(doc, win = root) {
    const base = doc.location?.href || win.location?.href || '';
    const title = clean(doc.querySelector('h1')?.textContent || doc.querySelector('meta[property="og:title"]')?.content || doc.title);
    const bodyClass = `${doc.body?.className || ''} ${base}`;
    const isShopify = !!(root.Shopify || doc.querySelector('meta[name="shopify-checkout-api-token"],script[type="application/json"][id*="ProductJson"],script[type="application/json"][data-product-json]') || /\/products\//.test(base) && /shopify|product-template/i.test(bodyClass));
    const candidates = new Map();
    const add = (image, source, score, meta = {}) => {
      const imageUrl = absolute(image, base);
      if (!imageUrl || EXCLUDE.test(imageUrl) || /\.(svg|gif)(\?|$)/i.test(imageUrl)) return;
      const prior = candidates.get(imageUrl);
      const item = { imageUrl, title: clean(meta.title || title), source, confidence: Math.min(1, score) };
      if (!prior || item.confidence > prior.confidence) candidates.set(imageUrl, item);
    };
    let hasStructuredProduct = false;
    for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        for (const product of jsonProducts(JSON.parse(script.textContent || ''))) {
          hasStructuredProduct = true;
          for (const image of imageValues(product.image)) add(image, 'structured-data', .98, { title: product.name });
        }
      } catch { /* malformed merchant JSON */ }
    }
    for (const script of doc.querySelectorAll('script[type="application/json"][id*="Product"],script[type="application/json"][data-product-json],script[type="application/json"][id*="product"]')) {
      try {
        const raw = JSON.parse(script.textContent || '{}');
        const product = raw.product || raw;
        for (const image of imageValues(product.images || product.featured_image)) add(image, 'shopify', .94, { title: product.title });
      } catch { /* malformed embedded product data */ }
    }
    const og = doc.querySelector('meta[property="og:image"],meta[property="og:image:secure_url"]')?.content;
    if (og) add(og, 'open-graph', .79);
    const imgs = [...doc.images];
    for (const img of imgs) {
      if (!visible(img, win)) continue;
      const loaded = img.currentSrc || img.src || '';
      const imageUrl = /placeholder|data:image|\.gif(?:\?|$)/i.test(loaded) ? img.dataset.src || img.dataset.original || loaded : loaded || img.dataset.src || img.dataset.original;
      const context = `${img.alt || ''} ${imageUrl} ${img.closest('[class],[id]')?.className || ''}`;
      if (EXCLUDE.test(context) || img.closest('header,footer,nav,aside,[class*="recommend"],[class*="related"]')) continue;
      const pixels = Math.max(img.naturalWidth * img.naturalHeight, img.getBoundingClientRect().width * img.getBoundingClientRect().height);
      const area = Math.min(.14, Math.log2(Math.max(1, pixels)) / 150);
      const main = img.closest('[class*="product"],[id*="product"],main') ? .12 : 0;
      const garment = CLOTHING.test(context) ? .12 : 0;
      const selected = img.closest('[class*="gallery"],[class*="media"],[class*="featured"]') ? .09 : 0;
      const tiny = img.naturalWidth && img.naturalWidth < 300 ? -.18 : 0;
      const score = .40 + area + main + garment + selected + tiny;
      add(imageUrl, 'visible-image', score);
    }
    const all = [...candidates.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 8);
    /* product:price:amount is kept here as a product-page signal, not as a price field. */
    const productSignals = hasStructuredProduct || !!doc.querySelector('[itemtype*="Product"],meta[property="product:price:amount"],meta[property="og:type"][content="product"]') || /\/products?\//.test(base) || isShopify;
    const clothingSignals = CLOTHING.test(`${title} ${all.slice(0, 3).map(x => x.imageUrl).join(' ')}`);
    return { product: productSignals && clothingSignals && all[0]?.confidence >= .5 ? all[0] : null, images: all, isProductPage: productSignals, isClothing: clothingSignals, adapter: isShopify ? 'shopify' : 'generic' };
  }
  function fromClickedImage(img, doc, win = root) {
    if (!img || img.tagName !== 'IMG' || !visible(img, win) || img.closest('header,footer,nav,aside,[class*="advert"],[class*="recommend"],[class*="related"]')) return null;
    const base = doc.location?.href || win.location?.href || '';
    const context = `${img.alt || ''} ${img.className || ''} ${img.closest('a')?.textContent || ''}`;
    const urlValues = [img.dataset.zoomImage, img.dataset.original, img.dataset.src, img.currentSrc, img.src];
    const imageUrl = urlValues.map(value => absolute(value, base)).find(value => value && !EXCLUDE.test(value)) || '';
    if (!imageUrl || EXCLUDE.test(context) || /\.(svg|gif)(\?|$)/i.test(imageUrl)) return null;
    const page = detect(doc, win);
    const title = clean(page.product?.title || img.alt || img.closest('a')?.textContent || doc.querySelector('h1')?.textContent || doc.title || 'Selected clothing');
    if (!page.isClothing && !CLOTHING.test(`${title} ${context} ${imageUrl}`)) return null;
    const images = [imageUrl, ...page.images.map(item => item.imageUrl)].filter((value, index, all) => all.indexOf(value) === index).slice(0, 8);
    return { imageUrl, title, source: 'user-selected', confidence: 1, images };
  }
  const adapter = (name) => ({
    name, detectProduct: (doc, win) => detect(doc, win).product,
    getProductImages: (doc, win) => detect(doc, win).images,
    getProductTitle: (doc, win) => detect(doc, win).product?.title || ''
  });
  const api = { detect, fromClickedImage, genericAdapter: adapter('generic'), shopifyAdapter: adapter('shopify') };
  root.TryOnDetector = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
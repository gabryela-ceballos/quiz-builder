// capture.cjs — serialises the current quiz page into editable HTML + full document (moved out of server.cjs
// so the main crawl, branch crawls and single-page re-clones share it)
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

async function makeCapture(pg, { sessionId, uploadsDir }) {
    const assetDir = path.join(uploadsDir, 'clone-assets', sessionId);
    const assetUrl = (name) => `/uploads/clone-assets/${sessionId}/${name}`;

    const saveCanvases = (canvases) => {
        const urls = {};
        Object.entries(canvases || {}).forEach(([id, dataUrl]) => {
            try {
                const b64 = String(dataUrl).split(',')[1];
                if (!b64) return;
                if (!fs.existsSync(assetDir)) fs.mkdirSync(assetDir, { recursive: true });
                const name = `chart_${crypto.createHash('md5').update(b64).digest('hex').slice(0, 12)}.png`;
                fs.writeFileSync(path.join(assetDir, name), Buffer.from(b64, 'base64'));
                urls[id] = assetUrl(name);
            } catch { /* ignore */ }
        });
        return urls;
    };

    // Download one media file used by a native block (image, audio, Lottie JSON, small video)
    const MEDIA_EXT = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'mp3', 'm4a', 'ogg', 'wav', 'aac', 'json', 'lottie', 'mp4', 'webm'];
    const downloadAsset = async (url, { maxBytes = 15 * 1024 * 1024 } = {}) => {
        if (!url || !/^https?:\/\//i.test(url)) return url;
        try {
            const ext = ((url.split('?')[0].match(/\.(\w{2,6})$/) || [])[1] || '').toLowerCase();
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
            clearTimeout(timer);
            if (!res.ok) return url;
            const ctype = res.headers.get('content-type') || '';
            const guessed = MEDIA_EXT.includes(ext) ? ext : /image\/png/.test(ctype) ? 'png' : /image\/jpe?g/.test(ctype) ? 'jpg' : /image\/webp/.test(ctype) ? 'webp' : /image\/gif/.test(ctype) ? 'gif' : /svg/.test(ctype) ? 'svg' : /audio\/mpeg/.test(ctype) ? 'mp3' : /audio/.test(ctype) ? 'm4a' : /json/.test(ctype) ? 'json' : /video\/mp4/.test(ctype) ? 'mp4' : '';
            if (!guessed) return url;
            const len = parseInt(res.headers.get('content-length') || '0', 10);
            if (len > maxBytes) return url;
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length > maxBytes) return url;
            if (!fs.existsSync(assetDir)) fs.mkdirSync(assetDir, { recursive: true });
            const name = `${crypto.createHash('md5').update(url).digest('hex').slice(0, 14)}.${guessed}`;
            fs.writeFileSync(path.join(assetDir, name), buf);
            return assetUrl(name);
        } catch { return url; }
    };

    const saveText = (content, ext) => {
        try {
            if (!fs.existsSync(assetDir)) fs.mkdirSync(assetDir, { recursive: true });
            const name = `${crypto.createHash('md5').update(content).digest('hex').slice(0, 14)}.${ext}`;
            fs.writeFileSync(path.join(assetDir, name), content);
            return assetUrl(name);
        } catch { return ''; }
    };

    const saveScreenshot = async (index) => {
        try {
            const buf = await pg.screenshot({ type: 'jpeg', quality: 78 });
            if (!fs.existsSync(assetDir)) fs.mkdirSync(assetDir, { recursive: true });
            const name = `shot_${index}_${Date.now().toString(36)}.jpg`;
            fs.writeFileSync(path.join(assetDir, name), buf);
            return { base64: buf.toString('base64'), url: assetUrl(name) };
        } catch { return { base64: '', url: '' }; }
    };

    // ── Extract ALL CSS from the page ONCE (before the loop) ──
    const cachedCSS = await pg.evaluate(() => {
        let cssText = '';
        try {
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        cssText += rule.cssText + '\n';
                    }
                } catch (e) { /* cross-origin stylesheet, skip */ }
            }
        } catch (e) { }

        // Extract CSS variables from inline style tags
        let cssVars = ':root {\n';
        for (const s of document.querySelectorAll('style')) {
            const txt = s.textContent || '';
            const varMatches = txt.matchAll(/--([\w-]+)\s*:\s*([^;]+)/g);
            for (const m of varMatches) {
                cssVars += `  --${m[1]}: ${m[2]};\n`;
            }
        }
        cssVars += '}\n';

        const bodyBg = getComputedStyle(document.body).backgroundColor;
        const bodyColor = getComputedStyle(document.body).color;
        const bodyFont = getComputedStyle(document.body).fontFamily;

        return { cssText, cssVars, bodyBg, bodyColor, bodyFont };
    });
    console.log('[Clone-Stream] CSS extracted, length:', cachedCSS.cssText.length);

    // ── Per-page HTML extractor — combines cached CSS with page innerHTML ──
    // ── Extract CSS @keyframes from all stylesheets ──
    const keyframesCSS = await pg.evaluate(() => {
        let kf = '';
        try {
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        if (rule.type === CSSRule.KEYFRAMES_RULE) {
                            kf += rule.cssText + '\n';
                        }
                    }
                } catch {}
            }
        } catch {}
        return kf;
    });
    console.log('[Clone-Stream] Keyframes extracted, length:', keyframesCSS.length);

    const extractPageHTML = async (canvases = {}) => {
        // ── Part 1: Editable HTML (lightweight, for Builder) ──
        let innerHTML = await pg.evaluate(() => {
            const container = document.querySelector('.main-content, main, [role="main"], #app, #root, #__next') || document.body;
            const contentEl = container.querySelector('[class*="main-content"]') || container;
            
            // Strip popups, notifications, urgency banners, cookie banners before extraction
            const popupSelectors = [
                '[class*="popup"]', '[class*="modal"]', '[class*="overlay"]',
                '[class*="notification"]', '[class*="banner"]', '[class*="toast"]',
                '[class*="cookie"]', '[class*="consent"]', '[class*="social-proof"]',
                '[class*="urgency"]', '[class*="fomo"]', '[class*="countdown"]',
                '[class*="alert"]', '[class*="snackbar"]',
            ];
            const allPopups = contentEl.querySelectorAll(popupSelectors.join(','));
            allPopups.forEach(el => {
                // Only remove if it looks like a floating element
                const cs = getComputedStyle(el);
                if (cs.position === 'fixed' || cs.position === 'absolute' || cs.zIndex > 100) {
                    el.remove();
                }
            });
            // Also remove fixed-position elements that might be popups
            document.querySelectorAll('*').forEach(el => {
                const cs = getComputedStyle(el);
                if (cs.position === 'fixed' && el.getBoundingClientRect().height < 200 && el.getBoundingClientRect().height > 20) {
                    // Likely a notification/toast/banner
                    const text = (el.textContent || '').toLowerCase();
                    if (/atenci[oó]n|personas|acaban|urgente|oferta|promo|cookie|notification|alert/i.test(text)) {
                        el.remove();
                    }
                }
            });
            
            contentEl.querySelectorAll('video').forEach(v => {
                v.setAttribute('playsinline', '');
                v.setAttribute('controls', '');
                if (v.src) v.setAttribute('src', v.src);
                v.querySelectorAll('source').forEach(s => { if (s.src) s.setAttribute('src', s.src); });
            });
            contentEl.querySelectorAll('iframe').forEach(iframe => {
                if (iframe.src) iframe.setAttribute('src', iframe.src);
            });
            return contentEl.innerHTML;
        });

        // ── Carousel/Slideshow detection and conversion ──
        const carouselData = await pg.evaluate(() => {
            const carousels = [];
            // Look for carousel containers
            const candidates = document.querySelectorAll(
                '[class*="swiper"], [class*="slick"], [class*="carousel"], [class*="slider"], [class*="slideshow"], [class*="gallery"]'
            );
            // Also check overflow-x containers
            const allDivs = document.querySelectorAll('div, section');
            const overflowContainers = [...allDivs].filter(el => {
                const cs = getComputedStyle(el);
                return (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden') &&
                    el.scrollWidth > el.clientWidth + 20 && el.children.length > 1;
            });

            const allCarousels = new Set([...candidates, ...overflowContainers]);

            for (const container of allCarousels) {
                const slides = [];
                // Get direct children or items with slide-like classes
                const items = container.querySelectorAll(
                    '[class*="slide"], [class*="item"], [class*="card"]'
                );
                const slideElements = items.length > 1 ? items : container.children;

                for (const slide of slideElements) {
                    const img = slide.querySelector('img');
                    const text = slide.textContent?.trim();
                    if (img?.src || (text && text.length > 0)) {
                        slides.push({
                            imgSrc: img?.src || '',
                            imgAlt: img?.alt || '',
                            html: slide.outerHTML,
                            text: text?.substring(0, 200) || '',
                        });
                    }
                }

                if (slides.length > 1) {
                    // Get container's approximate dimensions
                    const rect = container.getBoundingClientRect();
                    carousels.push({
                        slides,
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        outerHTML: container.outerHTML,
                        // Get a unique identifier for this container
                        id: container.id || container.className?.toString()?.substring(0, 60) || '',
                    });
                }
            }
            return carousels;
        });

        // Convert carousels to CSS scroll-snap
        if (carouselData.length > 0) {
            for (const carousel of carouselData) {
                const slideHTML = carousel.slides.map((s, i) =>
                    `<div style="flex:0 0 100%;scroll-snap-align:start;min-width:100%;box-sizing:border-box">${
                        s.imgSrc
                            ? `<img src="${s.imgSrc}" alt="${s.imgAlt}" style="width:100%;height:auto;display:block;border-radius:8px"/>`
                            : s.html
                    }</div>`
                ).join('');

                const dots = carousel.slides.map((_, i) =>
                    `<span style="width:8px;height:8px;border-radius:50%;background:${i === 0 ? '#6366f1' : '#d1d5db'};display:inline-block"></span>`
                ).join('');

                const scrollSnapCarousel = `<div style="position:relative;width:100%;overflow:hidden;margin:8px 0">
                    <div style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:0" class="clone-carousel">
                        ${slideHTML}
                    </div>
                    <div style="display:flex;justify-content:center;gap:6px;padding:8px 0">${dots}</div>
                    <style>.clone-carousel::-webkit-scrollbar{display:none}</style>
                </div>`;

                // Try to replace the original carousel HTML with our scroll-snap version
                // We use a distinctive substring from the original to find and replace
                const searchStr = carousel.outerHTML.substring(0, 200);
                const searchIdx = innerHTML.indexOf(searchStr);
                if (searchIdx >= 0) {
                    // Find the end of the original carousel element
                    const originalLen = carousel.outerHTML.length;
                    innerHTML = innerHTML.substring(0, searchIdx) + scrollSnapCarousel + innerHTML.substring(searchIdx + originalLen);
                }
            }
        }

        // Strip tracking from editable HTML
        const stripTracking = (html) => html
            .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match) => {
                const lower = match.toLowerCase();
                const t = ['fbq(', 'facebook.com/tr', 'fbevents.js', 'fb-pixel',
                    'google-analytics', 'googletagmanager', 'gtag(', 'ga(', 'analytics.js', 'gtm.js',
                    'hotjar', 'hj(', 'hjSiteSettings', 'tiktok.com/i18n/pixel', 'ttq.',
                    'snap.licdn.com', 'linkedin.com/px', 'ads.reddit.com',
                    'clarity.ms', 'clarity(', 'adsbygoogle', 'googlesyndication'];
                if (t.some(p => lower.includes(p.toLowerCase()))) return '';
                return match;
            })
            .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, (match) => {
                const l = match.toLowerCase();
                if (l.includes('facebook.com') || l.includes('googletagmanager') || l.includes('pixel') || l.includes('analytics')) return '';
                return match;
            })
            .replace(/<img[^>]*(facebook\.com\/tr|google-analytics|googletagmanager)[^>]*\/?>/gi, '');

        // ═══ DOWNLOAD EXTERNAL ASSETS LOCALLY ═══
        const downloadCloneAssets = async (htmlStr, quizId) => {
            const assetDir = path.join(uploadsDir, 'clone-assets', quizId);
            if (!fs.existsSync(assetDir)) fs.mkdirSync(assetDir, { recursive: true });

            // Extract all external URLs from HTML
            const urlSet = new Set();
            
            // img src
            const imgMatches = htmlStr.match(/(?:src|data-src)=["'](https?:\/\/[^"']+)["']/gi) || [];
            imgMatches.forEach(m => {
                const url = m.match(/["'](https?:\/\/[^"']+)["']/)?.[1];
                if (url) urlSet.add(url);
            });
            
            // CSS url() — background images, fonts, etc.
            const cssUrlMatches = htmlStr.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/gi) || [];
            cssUrlMatches.forEach(m => {
                const url = m.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/i)?.[1];
                if (url) urlSet.add(url);
            });
            
            // link href (CSS files)
            const linkMatches = htmlStr.match(/<link[^>]+href=["'](https?:\/\/[^"']+\.css[^"']*)["']/gi) || [];
            linkMatches.forEach(m => {
                const url = m.match(/href=["'](https?:\/\/[^"']+)["']/)?.[1];
                if (url) urlSet.add(url);
            });

            // Filter: skip tracking pixels, fonts, and JS files
            const skipPatterns = [
                /facebook\.com/i, /google-analytics/i, /googletagmanager/i,
                /hotjar/i, /tiktok/i, /clarity\.ms/i, /linkedin\.com/i,
                /\.js(\?|$)/i, /\.woff2?(\?|$)/i, /\.ttf(\?|$)/i, /\.eot(\?|$)/i,
                /data:image/i, /pixel/i, /tracker/i, /beacon/i
            ];
            
            const urls = [...urlSet].filter(u => !skipPatterns.some(p => p.test(u)));
            
            // Limit to 30 assets per page to avoid overwhelming
            const limitedUrls = urls.slice(0, 30);
            console.log(`[CloneAssets] Downloading ${limitedUrls.length} assets for quiz ${quizId}...`);
            
            const urlMap = {}; // original URL → local path
            
            const downloads = limitedUrls.map(async (url) => {
                try {
                    const crypto = require('crypto');
                    const urlHash = crypto.createHash('md5').update(url).digest('hex').substring(0, 12);
                    const extMatch = url.match(/\.(\w{2,5})(?:\?|$)/);
                    const ext = extMatch ? extMatch[1] : 'bin';
                    const safeExt = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'ico', 'css'].includes(ext.toLowerCase()) ? ext.toLowerCase() : 'bin';
                    const filename = `${urlHash}.${safeExt}`;
                    const filepath = path.join(assetDir, filename);
                    
                    // Skip if already downloaded
                    if (fs.existsSync(filepath)) {
                        urlMap[url] = `/uploads/clone-assets/${quizId}/${filename}`;
                        return;
                    }
                    
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 8000);
                    
                    const res = await fetch(url, {
                        signal: controller.signal,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                    });
                    clearTimeout(timeout);
                    
                    if (!res.ok) return;
                    
                    // Check content length (skip files > 5MB)
                    const contentLength = parseInt(res.headers.get('content-length') || '0');
                    if (contentLength > 5 * 1024 * 1024) return;
                    
                    const buffer = Buffer.from(await res.arrayBuffer());
                    fs.writeFileSync(filepath, buffer);
                    urlMap[url] = `/uploads/clone-assets/${quizId}/${filename}`;
                } catch (err) {
                    // Silent fail — asset will keep original URL
                }
            });
            
            await Promise.allSettled(downloads);
            
            console.log(`[CloneAssets] Downloaded ${Object.keys(urlMap).length}/${limitedUrls.length} assets`);
            
            // Replace all URLs in HTML
            let result = htmlStr;
            for (const [originalUrl, localPath] of Object.entries(urlMap)) {
                // Escape special regex characters in URL
                const escaped = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                result = result.replace(new RegExp(escaped, 'g'), localPath);
            }
            
            // Remove <base> tag since we no longer need it (all URLs are local now)
            result = result.replace(/<base[^>]*>/gi, '');
            
            return result;
        };

        innerHTML = stripTracking(innerHTML);
        const allCSS = cachedCSS.cssVars + cachedCSS.cssText + (keyframesCSS || '');

        // ── Inject interactive widgets for known patterns ──
        // Detect pages with sliders (weight, height, age) and inject working HTML range inputs
        const pageText = await pg.evaluate(() => document.body?.innerText || '');
        const isSliderPage = /qual.*peso|weight|qual.*altura|height|quantos.*anos|age|arraste|drag|deslize/i.test(pageText);

        let widgetScript = '';
        if (isSliderPage) {
            // Extract the current value shown on the page
            const sliderInfo = await pg.evaluate(() => {
                // Look for displayed value (like "70kg", "165cm")
                const numEls = [...document.querySelectorAll('span, div, p, strong')].filter(el => {
                    const t = (el.innerText || '').trim();
                    return /^\d{2,3}\s*(kg|cm|lb|ft|anos|years)?$/i.test(t) && el.getBoundingClientRect().height > 0;
                });
                const valEl = numEls[0];
                const rawVal = valEl ? parseInt((valEl.innerText || '').match(/\d+/)?.[0] || '70') : 70;
                const unit = valEl ? ((valEl.innerText || '').match(/(kg|cm|lb|ft|anos|years)/i)?.[0] || '') : '';

                // Detect if height or weight
                const fullText = document.body.innerText.toLowerCase();
                const isHeight = /altura|height|cm/i.test(fullText);
                const isAge = /anos|age|idade/i.test(fullText);

                return {
                    value: rawVal,
                    unit: unit,
                    min: isHeight ? 120 : (isAge ? 14 : 30),
                    max: isHeight ? 220 : (isAge ? 90 : 200),
                    isHeight,
                    isAge
                };
            });

            widgetScript = `
<div data-clone-slider style="padding:10px 20px;margin:10px 0;text-align:center">
  <div style="font-size:2.2rem;font-weight:700;margin-bottom:8px">
<span id="clone-slider-val">${sliderInfo.value}</span><span style="font-size:1.2rem;font-weight:400">${sliderInfo.unit}</span>
  </div>
  <input type="range" min="${sliderInfo.min}" max="${sliderInfo.max}" value="${sliderInfo.value}" id="clone-slider-input"
style="width:100%;height:6px;accent-color:var(--primary-color,#f59e0b);cursor:pointer;-webkit-appearance:none;background:linear-gradient(to right,#f59e0b 50%,#e5e7eb 50%);border-radius:3px"
oninput="document.getElementById('clone-slider-val').textContent=this.value" />
  <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:#999;margin-top:4px">
<span>${sliderInfo.min}</span><span>${sliderInfo.max}</span>
  </div>
</div>`;
        }

        let finalHTML = innerHTML;
        // If it's a slider page, try to append the interactive widget near the existing slider visual
        if (widgetScript) {
            // Find the container that has slider-like elements and add ours
            finalHTML = await pg.evaluate((args) => {
                const { innerHTML: html, widget } = args;
                const temp = document.createElement('div');
                temp.innerHTML = html;

                // Remove static slider elements that don't work
                const staticSliders = temp.querySelectorAll('[class*=slider], [class*=ruler], [class*=range], [class*=dial], [class*=scale]');
                staticSliders.forEach(el => el.style.display = 'none');

                // Find the CTA/continue button and insert slider before it
                const buttons = temp.querySelectorAll('button, a, [role=button]');
                let ctaBtn = null;
                for (const btn of buttons) {
                    if (/continuar|continue|next|próximo/i.test(btn.textContent)) {
                        ctaBtn = btn;
                        break;
                    }
                }

                if (ctaBtn && ctaBtn.parentElement) {
                    const wrapper = document.createElement('div');
                    wrapper.innerHTML = widget;
                    ctaBtn.parentElement.insertBefore(wrapper, ctaBtn);
                }

                return temp.innerHTML;
            }, { innerHTML: finalHTML, widget: widgetScript });
        }

        const editableCode = `<div class="cloned-page" style="background:${cachedCSS.bodyBg};color:${cachedCSS.bodyColor};font-family:${cachedCSS.bodyFont};min-height:100%;width:100%;overflow:hidden;box-sizing:border-box"><style>${allCSS}.cloned-page *{box-sizing:border-box}.cloned-page img{max-width:100%;height:auto}.cloned-page video{max-width:100%;height:auto}.cloned-page button,.cloned-page [role="button"]{cursor:pointer}.cloned-page a{text-decoration:none;color:inherit}[data-clone-slider] input[type=range]{-webkit-appearance:none;height:6px;border-radius:3px;outline:none}[data-clone-slider] input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;background:#f59e0b;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.2)}</style>${finalHTML}</div>`;

        // ── Part 2: Full interactive HTML (with all JS, for Player iframe) ──
        let fullDoc = '';
        try {
            const pageUrl = pg.url();
            const origin = new URL(pageUrl).origin;
            fullDoc = await pg.content();
            fullDoc = stripTracking(fullDoc);

            // Inject <base> tag for correct relative URL resolution
            if (!fullDoc.includes('<base ')) {
                fullDoc = fullDoc.replace(/<head([^>]*)>/i, `<head$1><base href="${origin}/" target="_self">`);
            }

            // Inject navigation bridge script — handles ALL interactive elements
            const navBridge = `<script data-clone-nav>
(function(){
  var advanceTimer = null;
  function advance() {
if (advanceTimer) return;
advanceTimer = setTimeout(function(){ advanceTimer = null; }, 800);
window.parent.postMessage({type:'clone-advance'},'*');
  }

  // Intercept all clicks on interactive elements
  document.addEventListener('click', function(e) {
var target = e.target;
for (var i = 0; i < 12; i++) {
  if (!target || target === document.body || target === document.documentElement) break;
  var tag = target.tagName ? target.tagName.toLowerCase() : '';

  // SKIP: let interactive widgets work naturally (sliders, inputs, toggles)
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (tag === 'label' && target.querySelector && target.querySelector('input')) return;
  // Skip range slider containers
  var cls = (target.className || '').toString().toLowerCase();
  if (cls.includes('slider') || cls.includes('range') || cls.includes('dial') || cls.includes('knob') || cls.includes('thumb') || cls.includes('ruler') || cls.includes('scale')) return;

  // CATCH: buttons, links, options, clickable cards
  var role = target.getAttribute ? (target.getAttribute('role') || '') : '';
  var isBtn = tag === 'button' || tag === 'a' || role === 'button' || role === 'option' ||
    cls.includes('btn') || cls.includes('button') || cls.includes('cta') ||
    cls.includes('option') || cls.includes('choice') || cls.includes('answer') ||
    cls.includes('card') || cls.includes('select');

  // Also catch styled divs/spans with cursor:pointer that look like buttons
  if (!isBtn && target.style) {
    var cursor = window.getComputedStyle ? window.getComputedStyle(target).cursor : '';
    if (cursor === 'pointer' && target.textContent && target.textContent.trim().length > 1 && target.textContent.trim().length < 200) {
      isBtn = true;
    }
  }

  if (isBtn) {
    // Let the original handler run briefly for visual feedback, then advance
    setTimeout(function() { advance(); }, 350);
    return;
  }
  target = target.parentElement;
}
  }, false);

  // Intercept form submissions
  document.addEventListener('submit', function(e) {
e.preventDefault();
advance();
  }, true);

  // MutationObserver: detect SPA page transitions (large DOM changes)
  var mainEl = document.querySelector('#__next, #app, #root, main, [role=main]') || document.body;
  var lastContent = (mainEl.textContent || '').slice(0, 200);
  var observer = new MutationObserver(function(mutations) {
var currentContent = (mainEl.textContent || '').slice(0, 200);
if (currentContent !== lastContent) {
  lastContent = currentContent;
  // Significant content change = page transition
  advance();
}
  });
  observer.observe(mainEl, { childList: true, subtree: true });

  // Intercept SPA navigation (pushState/replaceState)
  var origPush = history.pushState;
  var origReplace = history.replaceState;
  history.pushState = function() { origPush.apply(this, arguments); advance(); };
  history.replaceState = function() { origReplace.apply(this, arguments); advance(); };
  window.addEventListener('popstate', function() { advance(); });
})();
</script>`;
            fullDoc = fullDoc.replace('</body>', navBridge + '</body>');

            // Add responsive viewport if missing
            if (!fullDoc.includes('viewport')) {
                fullDoc = fullDoc.replace(/<head([^>]*)>/i, '<head$1><meta name="viewport" content="width=device-width,initial-scale=1">');
            }

            // ── Inject chart animation CSS + detection ──
            const chartAnimCSS = `<style data-clone-charts>
@keyframes chartBarGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes chartFadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes countUp { from { opacity: 0; } to { opacity: 1; } }
[data-clone-chart] { cursor: pointer; transition: outline 0.15s; }
[data-clone-chart]:hover { outline: 2px dashed #6c63ff; outline-offset: 4px; }
[data-clone-bar] { 
transform-origin: bottom center; 
animation: chartBarGrow 1s ease-out forwards;
}
[data-clone-bar-label] {
animation: chartFadeIn 0.8s ease-out forwards;
animation-delay: 0.5s;
opacity: 0;
}
</style>`;
            fullDoc = fullDoc.replace('</head>', chartAnimCSS + '</head>');

            // Inject a script that detects bar charts and marks them with data attributes
            const chartDetectScript = `<script data-clone-chart-detect>
(function() {
function detectCharts() {
    // Find groups of colored siblings that look like bar charts
    const allContainers = document.querySelectorAll('div, section');
    allContainers.forEach(container => {
        const children = [...container.children];
        if (children.length < 2 || children.length > 10) return;
        
        // Check if children have distinct background colors and similar widths
        let coloredChildren = 0;
        let hasPercentage = false;
        children.forEach(child => {
            const style = getComputedStyle(child);
            const bg = style.backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== 'rgb(255, 255, 255)') {
                coloredChildren++;
            }
            const text = (child.textContent || '').trim();
            if (/\\d+%/.test(text)) hasPercentage = true;
        });
        
        // If 2+ colored children with percentages, it's likely a bar chart
        if (coloredChildren >= 2 && hasPercentage) {
            container.setAttribute('data-clone-chart', 'bar');
            container.setAttribute('data-clone-type', 'chart');
            
            // Mark individual bar elements
            children.forEach((child, idx) => {
                const style = getComputedStyle(child);
                const bg = style.backgroundColor;
                if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== 'rgb(255, 255, 255)') {
                    child.setAttribute('data-clone-bar', idx);
                    child.style.animationDelay = (idx * 0.3) + 's';
                    
                    // Find percentage text inside
                    const percentEl = [...child.querySelectorAll('*')].find(el => /\\d+%/.test(el.textContent?.trim()));
                    if (percentEl) percentEl.setAttribute('data-clone-bar-label', idx);
                }
            });
        }
    });
    
    // Also detect progress fill bars (thin colored bars that represent progress)
    document.querySelectorAll('[style*="width:"], [style*="width :"]').forEach(el => {
        const style = getComputedStyle(el);
        const h = parseFloat(style.height);
        const w = parseFloat(style.width);
        const bg = style.backgroundColor;
        if (h > 5 && h < 40 && w > 20 && bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            const parent = el.parentElement;
            if (parent && !parent.hasAttribute('data-clone-chart')) {
                parent.setAttribute('data-clone-chart', 'progress');
                parent.setAttribute('data-clone-type', 'chart');
                el.setAttribute('data-clone-bar', '0');
            }
        }
    });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', detectCharts);
else setTimeout(detectCharts, 100);
})();
</script>`;
            fullDoc = fullDoc.replace('</body>', chartDetectScript + '</body>');

            console.log('[Clone-Stream] Full doc captured, size:', Math.round(fullDoc.length / 1024), 'KB');
        } catch (e) {
            console.log('[Clone-Stream] Failed to capture full doc:', e.message);
        }

        // Download all external assets locally for independence
        let localEditable = editableCode;
        let localFullDoc = fullDoc || '';
        try {
            console.log('[CloneAssets] Processing assets for page...');
            localEditable = await downloadCloneAssets(localEditable, sessionId);
            if (localFullDoc) localFullDoc = await downloadCloneAssets(localFullDoc, sessionId);
        } catch (assetErr) {
            console.log('[CloneAssets] Asset download error (non-fatal):', assetErr.message);
        }

        // Canvas charts don't survive serialization: swap them for the PNG snapshots taken by annotate
        const canvasUrls = saveCanvases(canvases);
        const swapCanvas = (html) => html.replace(/<canvas\b[^>]*data-qf-canvas="(c\d+)"[^>]*>(?:[\s\S]*?<\/canvas>)?/gi, (m, id) =>
            canvasUrls[id] ? `<img src="${canvasUrls[id]}" data-qf-canvas-img="${id}" style="max-width:100%;height:auto;display:block;margin:0 auto" alt="Gráfico"/>` : m);
        localEditable = swapCanvas(localEditable);
        localFullDoc = swapCanvas(localFullDoc);

        return { editableCode: localEditable, fullCode: localFullDoc, canvasUrls };
    };

    return { cachedCSS, keyframesCSS, extractPageHTML, saveCanvases, saveScreenshot, downloadAsset, saveText, assetDir, assetUrl };
}

module.exports = { makeCapture };

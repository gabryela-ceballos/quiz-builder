#!/usr/bin/env node
// Test script with SPANISH language to reproduce user's exact experience
const puppeteer = require('puppeteer');

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function test() {
    const url = 'https://inlead.digital/progrma-pilates-em-casa/';
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=es-ES'],
    });
    const pg = await browser.newPage();
    
    // Force Spanish language like user's browser
    await pg.setViewport({ width: 430, height: 932 });
    await pg.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
    await pg.setExtraHTTPHeaders({ 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.5' });
    // Override navigator.language
    await pg.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'language', { get: () => 'es-ES' });
        Object.defineProperty(navigator, 'languages', { get: () => ['es-ES', 'es'] });
    });
    
    await pg.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    
    for (let i = 0; i < 25; i++) {
        await pg.screenshot({ path: `/tmp/es-quiz/page-${String(i+1).padStart(2,'0')}.png` });
        
        const info = await pg.evaluate(() => {
            const body = (document.body.innerText || '').trim().slice(0, 200);
            const btns = [...document.querySelectorAll('button, [role="button"], a')].filter(el => {
                const r = el.getBoundingClientRect();
                return r.height > 15 && r.width > 30 && r.top < 1200 && r.top > -10;
            }).map(el => {
                const r = el.getBoundingClientRect();
                return {
                    tag: el.tagName,
                    text: (el.innerText || '').trim().slice(0, 80),
                    disabled: el.disabled || el.classList.contains('cursor-not-allowed'),
                    top: Math.round(r.top),
                    h: Math.round(r.height),
                    w: Math.round(r.width),
                    classes: (el.className || '').toString().slice(0, 60),
                };
            });
            // Also check for elements matching multi-select patterns
            const checkEls = document.querySelectorAll('[class*="option-icon-value"], [class*="checkbox"], input[type="checkbox"]');
            return { body, btns, hasCheckboxes: checkEls.length > 0 };
        });
        
        console.log(`\n=== PAGE ${i+1} ===`);
        console.log(`Body: ${info.body.slice(0, 120)}`);
        console.log(`Buttons: ${info.btns.length}, hasCheckboxes: ${info.hasCheckboxes}`);
        info.btns.forEach((b, j) => console.log(`  [${j}] <${b.tag}> "${b.text}" disabled:${b.disabled} ${b.w}x${b.h}@${b.top} cls:${b.classes.slice(0,40)}`));
        
        // Try to click first non-disabled, non-nav button
        const prevHash = await pg.evaluate(() => document.body.innerText.length + '_' + document.querySelectorAll('*').length);
        let advanced = false;
        
        const navPattern = /privacy|terms|cond|poli|legal|cookie|login|sign|lang|© |central/i;
        const submitPattern = /continuar|continue|siguiente|comenzar|empezar|next|avançar|start|enviar|submit/i;
        
        // For multi-select: click an option first, then look for submit
        if (info.hasCheckboxes || info.body.match(/marcar vari|selecciona.*más|puede.*elegir|puedes.*seleccionar|puede marcar/i)) {
            console.log('>> MULTI-SELECT PAGE detected!');
            // Click first option (non-submit, non-nav)
            const optBtns = info.btns.filter(b => !submitPattern.test(b.text) && !navPattern.test(b.text) && !b.disabled && b.text.length > 0);
            if (optBtns.length > 0) {
                console.log(`>> Clicking option: "${optBtns[0].text}"`);
                await pg.mouse.click(optBtns[0].top > 0 ? 215 : 215, optBtns[0].top + optBtns[0].h/2);
                await delay(2000);
                
                // Now look for enabled submit
                const submitInfo = await pg.evaluate(() => {
                    const pattern = /continuar|continue|siguiente|comenzar|empezar|next|enviar|submit/i;
                    const btns = [...document.querySelectorAll('button, [role="button"]')].filter(el => {
                        const r = el.getBoundingClientRect();
                        if (r.height < 20 || r.width < 40 || r.top > 1200) return false;
                        const text = (el.innerText || '').trim();
                        if (!pattern.test(text)) return false;
                        return !el.disabled && !el.classList.contains('cursor-not-allowed');
                    });
                    if (btns.length > 0) {
                        const r = btns[0].getBoundingClientRect();
                        return { x: r.x + r.width/2, y: r.y + r.height/2, text: (btns[0].innerText||'').trim(), disabled: false };
                    }
                    // Check if still disabled
                    const disabledBtns = [...document.querySelectorAll('button')].filter(el => {
                        const text = (el.innerText || '').trim();
                        return pattern.test(text);
                    });
                    if (disabledBtns.length > 0) return { disabled: true, text: (disabledBtns[0].innerText||'').trim(), classes: disabledBtns[0].className };
                    return null;
                });
                
                console.log('>> Submit button after option click:', JSON.stringify(submitInfo));
                
                if (submitInfo && !submitInfo.disabled) {
                    await pg.mouse.click(submitInfo.x, submitInfo.y);
                    await delay(2500);
                    const newHash = await pg.evaluate(() => document.body.innerText.length + '_' + document.querySelectorAll('*').length);
                    if (newHash !== prevHash) { advanced = true; console.log('>> Advanced!'); }
                }
            }
        } else {
            // Single-click page
            const clickable = info.btns.find(b => !navPattern.test(b.text) && !b.disabled && b.text.length > 0);
            if (clickable) {
                console.log(`>> Clicking: "${clickable.text}"`);
                // Use precise coordinates
                const coords = await pg.evaluate((btnText) => {
                    const el = [...document.querySelectorAll('button, [role="button"], a')].find(e => (e.innerText||'').trim().slice(0,80) === btnText);
                    if (el) {
                        const r = el.getBoundingClientRect();
                        return { x: r.x + r.width/2, y: r.y + r.height/2 };
                    }
                    return null;
                }, clickable.text);
                
                if (coords) {
                    await pg.mouse.click(coords.x, coords.y);
                    await delay(3000);
                    const newHash = await pg.evaluate(() => document.body.innerText.length + '_' + document.querySelectorAll('*').length);
                    if (newHash !== prevHash) { advanced = true; console.log('>> Advanced!'); }
                    else console.log('>> Hash unchanged, trying submit...');
                }
            }
        }
        
        // If didn't advance, try submit buttons with XPath
        if (!advanced) {
            try {
                const xBtn = await pg.$x('//button[contains(text(),"Continuar")] | //button[contains(text(),"Siguiente")] | //button[contains(text(),"Comenzar")] | //button[contains(text(),"Continue")]');
                for (const btn of xBtn) {
                    const isDisabled = await btn.evaluate(el => el.disabled || el.classList.contains('cursor-not-allowed'));
                    if (isDisabled) { console.log('>> XPath button found but disabled'); continue; }
                    console.log('>> Clicking XPath submit');
                    prevHash2 = await pg.evaluate(() => document.body.innerText.length + '_' + document.querySelectorAll('*').length);
                    await btn.click();
                    await delay(2500);
                    const nh = await pg.evaluate(() => document.body.innerText.length + '_' + document.querySelectorAll('*').length);
                    if (nh !== prevHash) { advanced = true; console.log('>> Advanced via XPath!'); break; }
                }
            } catch(e) { console.log('>> XPath error:', e.message); }
        }
        
        if (!advanced) {
            console.log('>> STUCK at page', i+1);
            await pg.screenshot({ path: `/tmp/es-quiz/page-${String(i+1).padStart(2,'0')}-stuck.png` });
            break;
        }
    }
    
    await browser.close();
    console.log('\nDone!');
}

require('fs').mkdirSync('/tmp/es-quiz', { recursive: true });
test().catch(e => { console.error('Error:', e); process.exit(1); });

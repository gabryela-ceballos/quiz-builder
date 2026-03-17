const puppeteer = require('puppeteer');
const delay = ms => new Promise(r => setTimeout(r, ms));

async function test() {
    const url = 'https://nutrizen-plan.com/?utm_source=organic&utm_campaign=&utm_medium=&utm_content=&utm_term=&subid=organic&sid2=&subid2=&subid3=&subid4=&subid5=&xcod=organichQwK21wXxRhQwK21wXxRhQwK21wXxRhQwK21wXxR&sck=organichQwK21wXxRhQwK21wXxRhQwK21wXxRhQwK21wXxR';
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const pg = await browser.newPage();
    await pg.setViewport({ width: 430, height: 932 });
    await pg.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
    
    await pg.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    
    const fs = require('fs');
    fs.mkdirSync('/tmp/nutrizen-debug', { recursive: true });
    
    for (let i = 0; i < 20; i++) {
        await pg.screenshot({ path: `/tmp/nutrizen-debug/page-${String(i+1).padStart(2,'0')}.png` });
        
        const info = await pg.evaluate(() => {
            const body = (document.body.innerText || '').trim();
            const h1 = document.querySelector('h1,h2,h3,[class*="title"],[class*="heading"]');
            const title = h1 ? h1.innerText.trim() : body.slice(0, 80);
            
            // Get ALL interactive elements
            const els = [...document.querySelectorAll('button, [role="button"], a, input, label, div[onclick], span[onclick]')].map(el => {
                const r = el.getBoundingClientRect();
                if (r.height < 5 || r.width < 5 || r.top > 2000 || r.top < -100) return null;
                const text = (el.innerText || el.value || el.placeholder || '').trim().slice(0, 80);
                if (!text) return null;
                const style = getComputedStyle(el);
                return {
                    tag: el.tagName,
                    type: el.type || '',
                    text,
                    disabled: el.disabled || el.classList.contains('cursor-not-allowed'),
                    cursor: style.cursor,
                    classes: (el.className || '').toString().slice(0, 60),
                    top: Math.round(r.top),
                    h: Math.round(r.height),
                    w: Math.round(r.width),
                    x: Math.round(r.x + r.width/2),
                    y: Math.round(r.y + r.height/2),
                    hasCheckbox: !!el.querySelector('input[type="checkbox"]') || el.classList.toString().includes('check'),
                };
            }).filter(Boolean);
            
            // Check for checkbox inputs
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            const hasCheckboxes = checkboxes.length > 0;
            
            // Check for animations
            const anims = document.getAnimations ? document.getAnimations().length : 0;
            
            return { title, bodyLen: body.length, bodyPreview: body.slice(0, 200), els, hasCheckboxes, anims, url: location.href };
        });
        
        console.log(`\n=== PAGE ${i+1} ===`);
        console.log(`URL: ${info.url}`);
        console.log(`Title: ${info.title}`);
        console.log(`Body (${info.bodyLen} chars): ${info.bodyPreview.slice(0, 100)}`);
        console.log(`Elements: ${info.els.length}, hasCheckboxes: ${info.hasCheckboxes}, anims: ${info.anims}`);
        info.els.forEach((e, j) => console.log(`  [${j}] <${e.tag}${e.type?' type='+e.type:''}> "${e.text.slice(0,50)}" ${e.w}x${e.h}@y${e.top} cursor:${e.cursor} disabled:${e.disabled} chk:${e.hasCheckbox} cls:${e.classes.slice(0,30)}`));
        
        // Try to advance
        const prevUrl = info.url;
        const prevBody = info.bodyPreview;
        
        // Filter out nav/footer elements
        const navPattern = /privacy|terms|policy|cookie|login|©|todas|criado|inlead|central|derechos|condici|t[eé]rminos/i;
        const submitPattern = /continuar|continue|siguiente|next|start|comenzar|empezar|enviar|submit|avançar|próximo|começ|toque|seguir/i;
        
        const clickableEls = info.els.filter(e => !navPattern.test(e.text) && e.cursor === 'pointer' && !e.disabled);
        const submitEls = clickableEls.filter(e => submitPattern.test(e.text));
        const optionEls = clickableEls.filter(e => !submitPattern.test(e.text) && e.text.length > 2);
        
        console.log(`\nClickable: ${clickableEls.length}, Submit: ${submitEls.length}, Options: ${optionEls.length}`);
        
        let advanced = false;
        
        if (info.hasCheckboxes && optionEls.length > 0) {
            // Multi-select: click option first
            console.log(`>> Multi-select: clicking option "${optionEls[0].text}"`);
            await pg.mouse.click(optionEls[0].x, optionEls[0].y);
            await delay(2000);
            
            // Re-find submit
            const freshSubmit = await pg.evaluate(() => {
                const pattern = /continuar|continue|siguiente|next|enviar|submit|avançar|comenzar|seguir/i;
                const btns = [...document.querySelectorAll('button, [role="button"], a')].filter(el => {
                    const r = el.getBoundingClientRect();
                    return r.height > 20 && r.width > 40 && r.top > 0 && r.top < 1200 && 
                        !el.disabled && !el.classList.contains('cursor-not-allowed') &&
                        pattern.test((el.innerText || '').trim());
                });
                if (btns.length > 0) {
                    const r = btns[0].getBoundingClientRect();
                    return { x: r.x + r.width/2, y: r.y + r.height/2, text: btns[0].innerText.trim().slice(0,50) };
                }
                // Try lowest button
                const allBtns = [...document.querySelectorAll('button, [role="button"]')].filter(el => {
                    const r = el.getBoundingClientRect();
                    return r.height > 30 && r.width > 100 && r.top > 0 && r.top < 1200 && !el.disabled;
                }).sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
                if (allBtns.length > 0) {
                    const r = allBtns[0].getBoundingClientRect();
                    return { x: r.x + r.width/2, y: r.y + r.height/2, text: allBtns[0].innerText.trim().slice(0,50), isLowest: true };
                }
                return null;
            });
            
            console.log('>> Fresh submit:', JSON.stringify(freshSubmit));
            if (freshSubmit) {
                await pg.mouse.click(freshSubmit.x, freshSubmit.y);
                await delay(3000);
            }
        } else if (optionEls.length > 0 && !submitEls.length) {
            // Single choice: click option
            console.log(`>> Single choice: clicking "${optionEls[0].text}"`);
            await pg.mouse.click(optionEls[0].x, optionEls[0].y);
            await delay(3000);
        } else if (submitEls.length > 0) {
            // Submit/continue
            console.log(`>> Submit: clicking "${submitEls[0].text}"`);
            await pg.mouse.click(submitEls[0].x, submitEls[0].y);
            await delay(3000);
        } else if (clickableEls.length > 0) {
            console.log(`>> Fallback: clicking "${clickableEls[0].text}"`);
            await pg.mouse.click(clickableEls[0].x, clickableEls[0].y);
            await delay(3000);
        }
        
        // Check if advanced
        const newInfo = await pg.evaluate(() => ({
            url: location.href,
            body: (document.body.innerText || '').trim().slice(0, 200),
        }));
        
        if (newInfo.body !== prevBody || newInfo.url !== prevUrl) {
            advanced = true;
            console.log('>> ADVANCED!');
        } else {
            console.log('>> NOT ADVANCED - STUCK!');
            // Try keyboard
            await pg.keyboard.press('Enter');
            await delay(2000);
            const afterKey = await pg.evaluate(() => (document.body.innerText||'').trim().slice(0,200));
            if (afterKey !== prevBody) { advanced = true; console.log('>> Advanced via Enter key'); }
        }
        
        if (!advanced) {
            console.log('>> STUCK! Breaking.');
            break;
        }
    }
    
    await browser.close();
    console.log('\nDone!');
}

test().catch(e => { console.error('Error:', e.message); process.exit(1); });

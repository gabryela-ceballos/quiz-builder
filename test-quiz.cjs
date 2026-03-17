#!/usr/bin/env node
// Test script to directly navigate the quiz and screenshot each page
const puppeteer = require('puppeteer');
const fs = require('fs');

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function testQuiz() {
    const url = process.argv[2] || 'https://inlead.digital/progrma-pilates-em-casa/';
    console.log('Testing URL:', url);
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=es-ES'],  // Spanish language
        defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 }
    });
    
    const pg = await browser.newPage();
    
    // Set Spanish language headers to match user's experience
    await pg.setExtraHTTPHeaders({ 'Accept-Language': 'es-ES,es;q=0.9' });
    
    await pg.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    
    const MAX_PAGES = 30;
    const dir = '/tmp/quiz-test-pages';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    for (let i = 0; i < MAX_PAGES; i++) {
        // Screenshot
        await pg.screenshot({ path: `${dir}/page-${String(i+1).padStart(2,'0')}.png` });
        
        // Get page info
        const info = await pg.evaluate(() => {
            const body = document.body.innerText?.trim().slice(0, 300) || '';
            const clickables = [...document.querySelectorAll('button, [role="button"], a, [onclick]')].filter(el => {
                const r = el.getBoundingClientRect();
                return r.height > 20 && r.width > 20 && r.top < 1200 && r.top > 0;
            }).map(el => ({
                tag: el.tagName,
                text: (el.innerText || '').trim().slice(0, 100),
                classes: el.className?.toString().slice(0, 100) || '',
                top: Math.round(el.getBoundingClientRect().top),
                height: Math.round(el.getBoundingClientRect().height),
                width: Math.round(el.getBoundingClientRect().width),
            }));
            
            const inputs = [...document.querySelectorAll('input, select, textarea, [contenteditable]')].filter(el => {
                const r = el.getBoundingClientRect();
                return r.height > 5 && r.width > 5;
            }).map(el => ({
                type: el.type || el.tagName,
                name: el.name || '',
                placeholder: el.placeholder || '',
            }));
            
            const checkboxes = document.querySelectorAll('input[type="checkbox"], [role="checkbox"]').length;
            const radios = document.querySelectorAll('input[type="radio"], [role="radio"]').length;
            
            // Check for custom interactive elements
            const customEls = [...document.querySelectorAll('[class*="option"], [class*="answer"], [class*="choice"], [class*="select"], [data-option], [data-answer], [data-value]')].filter(el => {
                const r = el.getBoundingClientRect();
                return r.height > 20 && r.width > 20 && r.top < 1200;
            }).map(el => ({
                tag: el.tagName,
                text: (el.innerText || '').trim().slice(0, 80),
                classes: el.className?.toString().slice(0, 100) || '',
            }));
            
            return { bodyText: body, clickables, inputs, checkboxes, radios, customEls };
        });
        
        console.log(`\n=== PAGE ${i+1} ===`);
        console.log(`Body: ${info.bodyText.slice(0, 150)}`);
        console.log(`Clickables: ${info.clickables.length}`);
        info.clickables.forEach((c, j) => console.log(`  [${j}] <${c.tag}> "${c.text}" top:${c.top} ${c.width}x${c.height} class:${c.classes.slice(0,60)}`));
        console.log(`Inputs: ${info.inputs.length}`, info.inputs);
        console.log(`Checkboxes: ${info.checkboxes}, Radios: ${info.radios}`);
        if (info.customEls.length > 0) {
            console.log(`Custom elements: ${info.customEls.length}`);
            info.customEls.slice(0, 5).forEach(e => console.log(`  "${e.text}" class:${e.classes.slice(0,60)}`));
        }
        
        // Try to advance: click the first interactive element
        const prevURL = pg.url();
        const prevHash = await pg.evaluate(() => document.body.innerText?.length + '_' + document.querySelectorAll('*').length);
        
        // Strategy 1: Click first non-navigation clickable
        let advanced = false;
        const clickableEls = await pg.evaluate(() => {
            const navWords = /privacy|priv|terms|cond|poli|legal|cookie|login|sign|lang/i;
            return [...document.querySelectorAll('button, [role="button"], a, div[onclick], span[onclick]')].filter(el => {
                const r = el.getBoundingClientRect();
                if (r.height < 20 || r.width < 40 || r.top > 1200 || r.top < 0) return false;
                const text = (el.innerText || '').trim();
                if (text.length < 1 || text.length > 200) return false;
                if (navWords.test(text)) return false;
                return true;
            }).map((el, idx) => ({ idx, text: (el.innerText || '').trim().slice(0, 80), tag: el.tagName, top: Math.round(el.getBoundingClientRect().top) }));
        });
        
        if (clickableEls.length > 0) {
            // Try clicking the first option-like element (not a submit button at the top)
            const target = clickableEls[0];
            console.log(`>> Clicking: "${target.text}" (${target.tag})`);
            
            try {
                const els = await pg.$$('button, [role="button"], a, div[onclick], span[onclick]');
                const navWords = /privacy|priv|terms|cond|poli|legal|cookie|login|sign|lang/i;
                let clickIdx = 0;
                for (const el of els) {
                    const box = await el.boundingBox();
                    const text = await el.evaluate(e => (e.innerText || '').trim());
                    if (!box || box.height < 20 || box.width < 40 || box.y > 1200 || box.y < 0) continue;
                    if (text.length < 1 || text.length > 200) continue;
                    if (navWords.test(text)) continue;
                    
                    // Click it
                    await el.click();
                    break;
                }
                
                await delay(3000);
                
                const newHash = await pg.evaluate(() => document.body.innerText?.length + '_' + document.querySelectorAll('*').length);
                if (newHash !== prevHash) {
                    advanced = true;
                    console.log(`>> Advanced! (hash changed: ${prevHash} -> ${newHash})`);
                }
            } catch (err) {
                console.log(`>> Click failed:`, err.message);
            }
        }
        
        if (!advanced) {
            // Try finding submit/continuar button
            try {
                const submitBtn = await pg.$x('//button[contains(text(),"Continuar")] | //button[contains(text(),"Comenzar")] | //button[contains(text(),"Continue")] | //div[contains(text(),"Continuar")] | //a[contains(text(),"Continuar")] | //span[contains(text(),"Continuar")] | //div[contains(text(),"Comenzar")]');
                if (submitBtn.length > 0) {
                    console.log(`>> Clicking submit via XPath (found ${submitBtn.length})`);
                    await submitBtn[0].click();
                    await delay(3000);
                    const newHash = await pg.evaluate(() => document.body.innerText?.length + '_' + document.querySelectorAll('*').length);
                    if (newHash !== prevHash) {
                        advanced = true;
                        console.log(`>> Advanced via submit!`);
                    }
                }
            } catch {}
        }
        
        if (!advanced) {
            console.log('>> STUCK — could not advance');
            // Take one more screenshot
            await pg.screenshot({ path: `${dir}/page-${String(i+1).padStart(2,'0')}-stuck.png` });
            break;
        }
    }
    
    await browser.close();
    console.log(`\nDone! Screenshots saved to ${dir}/`);
}

testQuiz().catch(err => { console.error('Error:', err); process.exit(1); });

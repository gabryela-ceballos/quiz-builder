const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const pg = await browser.newPage();
    await pg.setViewport({ width: 430, height: 932 });
    await pg.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');

    console.log('Navigating...');
    await pg.goto('https://tryleaply.com/br/tns', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // Find all buttons
    const buttons = await pg.$$eval('button', btns => btns.map(b => {
        const r = b.getBoundingClientRect();
        return {
            text: (b.innerText || '').trim().slice(0, 50),
            aria: b.getAttribute('aria-label'),
            top: Math.round(r.top),
            left: Math.round(r.left),
            height: Math.round(r.height),
            width: Math.round(r.width),
            visible: r.height > 0 && r.width > 0,
        };
    }).filter(b => b.visible && b.text));

    console.log(`\nButtons found: ${buttons.length}`);
    buttons.forEach((b, i) => console.log(`  ${i}: "${b.text.slice(0, 35)}" top=${b.top} left=${b.left} ${b.width}x${b.height}`));

    // Try clicking using aria-label selector
    console.log('\n--- Clicking button[aria-label="Idade: 18-29"] ---');
    try {
        await pg.click('button[aria-label="Idade: 18-29"]');
        console.log('Click succeeded!');
    } catch (e) {
        console.log('Selector click failed:', e.message.slice(0, 100));
        // Try mouse coordinate click on the first button
        if (buttons.length > 0) {
            const b = buttons[0];
            console.log(`Trying mouse.click(${b.left + b.width / 2}, ${b.top + b.height / 2})...`);
            await pg.mouse.click(b.left + b.width / 2, b.top + b.height / 2);
            console.log('Mouse click done');
        }
    }

    await new Promise(r => setTimeout(r, 3000));

    // Check URL
    console.log('\nURL after click:', pg.url());

    // Check new content
    const newButtons = await pg.$$eval('button', btns => btns.map(b => {
        const r = b.getBoundingClientRect();
        return { text: (b.innerText || '').trim().slice(0, 50), visible: r.height > 0 };
    }).filter(b => b.visible && b.text));

    console.log(`\nButtons after click: ${newButtons.length}`);
    newButtons.forEach((b, i) => console.log(`  ${i}: "${b.text.slice(0, 40)}"`));

    // Check heading text
    const headings = await pg.$$eval('h1,h2,h3,h4,h5', els =>
        els.filter(e => e.getBoundingClientRect().height > 0).map(e => e.innerText.trim().slice(0, 100)));
    console.log('\nHeadings:', headings);

    await browser.close();
    console.log('\nDone!');
})().catch(e => console.error('FATAL:', e.message));

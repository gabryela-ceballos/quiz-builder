// ClonedPage.jsx — renders a page cloned from an external quiz (moved out of Player.jsx so the v2 runtime can reuse it)
import { useState, useEffect, useRef } from 'react';
import { recordEvent } from '../hooks/useQuizStore';

// ═══ CLONED PAGE BLOCK — iframe-based for full JS execution ═══
export default function ClonedPageBlock({ html, fullCode, onAdvance, onBack, onLink, btnStyle, buttonActions, pixelCode, clonePageType, quizId, pageIndex, setAnswers }) {
  const iframeRef = useRef(null);
  const htmlRef = useRef(null);
  const isMultiSelect = clonePageType === 'multi-select';
  const [hasSelection, setHasSelection] = useState(false);

  // Listen for postMessage from iframe to advance
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data?.type === 'clone-advance') {
        // Record answer from cloned page
        if (e.data.answer) {
          recordEvent(quizId || '', 'answer', { questionIndex: pageIndex, value: e.data.answer, source: 'clone' });
          if (setAnswers) setAnswers(prev => ({ ...prev, [pageIndex]: e.data.answer }));
        } else {
          recordEvent(quizId || '', 'answer', { questionIndex: pageIndex, value: 'advanced', source: 'clone' });
        }
        onAdvance(e.data.answer || '');
      }
      if (e.data?.type === 'clone-selection') {
        setHasSelection(true);
      }
      if (e.data?.type === 'clone-back') {
        if (onBack) onBack(); else window.history.back();
      }
      if (e.data?.type === 'clone-link' && e.data.href) {
        recordEvent(quizId || '', 'cta_click', { url: e.data.href, source: 'clone' });
        if (onLink) onLink(e.data.href, !!e.data.newTab);
        else if (e.data.newTab) window.open(e.data.href, '_blank', 'noopener');
        else window.location.href = e.data.href;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onAdvance, onBack, onLink]);

  // If we have fullCode, render in iframe for full JS execution
  if (fullCode) {
    // Inject a navigation bridge that uses postMessage to communicate with parent
    const playerBridge = `<script data-player-bridge>
(function() {
  var advanced = false;
  var pageType = ${JSON.stringify(clonePageType || 'choice')};
  var isMultiSelect = pageType === 'multi-select';
  var btnActions = ${JSON.stringify(buttonActions || {})};
  var submitRe = /continuar|continue|next|enviar|submit|avan|come|pr.ximo|siguiente|seguir|empezar|iniciar|start/i;
  
  function doAdvance(answerText) {
    if (advanced) return;
    advanced = true;
    window.parent.postMessage({ type: 'clone-advance', answer: answerText || '' }, '*');
    setTimeout(function() { advanced = false; }, 2000);
  }
  
  function isSubmitButton(el) {
    var tag = el.tagName ? el.tagName.toLowerCase() : '';
    var cls = (el.className || '').toString().toLowerCase();
    var text = (el.textContent || '').trim();
    var role = (el.getAttribute && el.getAttribute('role') || '').toLowerCase();
    // Must have submit-like text AND be a button/CTA-like element
    if (submitRe.test(text) && text.length < 80) {
      if (tag === 'button' || tag === 'a') return true;
      if (cls.includes('btn') || cls.includes('cta') || cls.includes('submit') || cls.includes('action') || cls.includes('next')) return true;
      if (role === 'button') return true;
    }
    // Explicit CTA/submit classes with very short text (button feel)
    if ((cls.includes('cta') || cls.includes('submit')) && text.length < 60 && text.length > 1) return true;
    return false;
  }
  
  function isOptionElement(el) {
    var tag = el.tagName ? el.tagName.toLowerCase() : '';
    var cls = (el.className || '').toString().toLowerCase();
    var text = (el.textContent || '').trim();
    var role = (el.getAttribute && el.getAttribute('role') || '').toLowerCase();
    if (text.length < 2 || text.length > 300) return false;
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return false;
    // Direct tag check
    if (tag === 'button') return true;
    // Role check
    if (role === 'button' || role === 'option' || role === 'radio' || role === 'listitem') return true;
    // Class pattern check (very broad)
    if (cls.includes('option') || cls.includes('choice') || cls.includes('card') || cls.includes('answer') || 
        cls.includes('cursor-pointer') || cls.includes('quiz') || cls.includes('opt') || cls.includes('select') ||
        cls.includes('radio') || cls.includes('check') || cls.includes('item') || cls.includes('variant') ||
        cls.includes('clickable') || cls.includes('hover') || cls.includes('btn') || cls.includes('cta')) return true;
    // data-* attribute check
    if (el.getAttribute) {
      var attrs = el.attributes || [];
      for (var i = 0; i < attrs.length; i++) {
        var name = attrs[i].name.toLowerCase();
        if (name.startsWith('data-') && (name.includes('option') || name.includes('answer') || name.includes('choice') || name.includes('value') || name.includes('click') || name.includes('action'))) return true;
      }
    }
    // Style check: if element has cursor:pointer, it's interactive
    try {
      var cStyle = window.getComputedStyle(el);
      if (cStyle && cStyle.cursor === 'pointer') return true;
    } catch(e) {}
    // Parent group check
    var parent = el.parentElement;
    if (parent) {
      var pCls = (parent.className || '').toString().toLowerCase();
      var pTag = parent.tagName ? parent.tagName.toLowerCase() : '';
      if ((pCls.includes('group') || pCls.includes('list') || pCls.includes('options') || pCls.includes('grid') || pCls.includes('stack') || pTag === 'ul' || pTag === 'ol') && (tag === 'div' || tag === 'li' || tag === 'label')) return true;
    }
    return false;
  }
  
  function findOptionAncestor(el) {
    var node = el;
    var depth = 0;
    while (node && node !== document.body && depth < 10) {
      if (isOptionElement(node)) return node;
      node = node.parentElement;
      depth++;
    }
    return null;
  }
  
  // Also find any clickable ancestor (a, button, or cursor:pointer)
  function findClickableAncestor(el) {
    var node = el;
    var depth = 0;
    while (node && node !== document.body && depth < 8) {
      var tag = node.tagName ? node.tagName.toLowerCase() : '';
      if (tag === 'a' || tag === 'button') return node;
      try {
        var st = window.getComputedStyle(node);
        if (st && st.cursor === 'pointer' && node.offsetHeight > 20) return node;
      } catch(e) {}
      node = node.parentElement;
      depth++;
    }
    return null;
  }
  
  function toggleMultiSelect(card) {
    var sel = card.classList.contains('active');
    if (sel) {
      card.classList.remove('active');
      card.style.borderColor = '';
      card.style.boxShadow = '';
    } else {
      card.classList.add('active');
      card.style.borderColor = '#333';
      card.style.boxShadow = '0 0 0 1px #333';
    }
    card.querySelectorAll('svg').forEach(function(svg) {
      svg.style.opacity = sel ? '0' : '1';
    });
    var grp = card.closest('[class*="group"]');
    if (grp && grp !== card) {
      if (sel) grp.classList.remove('active');
      else grp.classList.add('active');
    }
    var cb = card.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = !sel;
    window.parent.postMessage({ type: 'clone-selection' }, '*');
  }
  
  // Stamp data-cta-url attributes on buttons that have CTA actions
  function resolvePath(root, path) {
    if (!path || !root) return null;
    var parts = path.split('/');
    var cur = root;
    for (var i = 0; i < parts.length; i++) {
      var m = parts[i].match(/^(\w+)\[(\d+)\]$/);
      if (!m) return null;
      var tag = m[1], idx = parseInt(m[2]);
      var children = [];
      for (var j = 0; j < cur.children.length; j++) {
        if (cur.children[j].tagName && cur.children[j].tagName.toLowerCase() === tag) children.push(cur.children[j]);
      }
      cur = children[idx];
      if (!cur) return null;
    }
    return cur;
  }
  
  // Collect all CTA URLs from btnActions
  var ctaUrls = [];
  for (var k in btnActions) {
    if (btnActions[k] && btnActions[k].action === 'cta' && btnActions[k].ctaUrl) {
      ctaUrls.push({ path: k, url: btnActions[k].ctaUrl });
    }
  }
  
  function stampCTAUrls() {
    if (ctaUrls.length === 0) return;
    ctaUrls.forEach(function(entry) {
      // Try multiple roots: body first, then .cloned-page
      var el = resolvePath(document.body, entry.path);
      if (!el) el = resolvePath(document.querySelector('.cloned-page'), entry.path);
      if (el) {
        el.setAttribute('data-cta-url', entry.url);
      } else {
        // Fallback: stamp ALL submit-like buttons with the CTA URL
        var allBtns = document.querySelectorAll('button, a, [role="button"]');
        for (var i = 0; i < allBtns.length; i++) {
          if (isSubmitButton(allBtns[i]) && !allBtns[i].getAttribute('data-cta-url')) {
            allBtns[i].setAttribute('data-cta-url', entry.url);
          }
        }
      }
    });
    // Also check for any elements already having data-cta-url from editor
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stampCTAUrls);
  else stampCTAUrls();
  
  // Roles detected when the page was cloned (data-qf-role): back / link / whatsapp / option / next
  function handleRole(e, target) {
    var qf = target && target.closest ? target.closest('[data-qf-role]') : null;
    if (!qf) return false;
    var role = qf.getAttribute('data-qf-role');
    var text = (qf.textContent || '').trim().substring(0, 200);
    if (role === 'back') { e.preventDefault(); e.stopPropagation(); window.parent.postMessage({ type: 'clone-back' }, '*'); return true; }
    if (role === 'link' || role === 'whatsapp') {
      var href = qf.getAttribute('data-qf-href');
      if (!href) return false;
      e.preventDefault(); e.stopPropagation();
      window.parent.postMessage({ type: 'clone-link', href: href, newTab: role === 'whatsapp' }, '*');
      return true;
    }
    if (role === 'option') {
      e.preventDefault(); e.stopPropagation();
      if (isMultiSelect) { toggleMultiSelect(qf); return true; }
      qf.style.transform = 'scale(0.97)'; qf.style.opacity = '0.7';
      setTimeout(function() { doAdvance(text); }, 350);
      return true;
    }
    if (role === 'next') {
      e.preventDefault(); e.stopPropagation();
      qf.style.transform = 'scale(0.97)'; qf.style.opacity = '0.7';
      var picked = Array.prototype.map.call(document.querySelectorAll('[data-qf-role="option"].active'), function(el) { return (el.textContent || '').trim(); }).join(', ');
      setTimeout(function() { doAdvance(picked || text); }, 250);
      return true;
    }
    return false;
  }

  document.addEventListener('click', function(e) {
    var target = e.target;
    var node = target;
    // Pre-check: walk up to find any ancestor with data-cta-url (always takes priority)
    var ctaNode = target;
    while (ctaNode && ctaNode !== document.body) {
      var cta = ctaNode.getAttribute && ctaNode.getAttribute('data-cta-url');
      if (cta) {
        e.preventDefault();
        e.stopPropagation();
        ctaNode.style.transform = 'scale(0.97)';
        ctaNode.style.opacity = '0.7';
        setTimeout(function() { window.top.location.href = cta; }, 200);
        return;
      }
      ctaNode = ctaNode.parentElement;
    }
    if (handleRole(e, target)) return;
    // Fallback CTA check: if we have CTA URLs and clicked a submit-like button, redirect
    if (ctaUrls.length > 0) {
      var btnNode = target;
      while (btnNode && btnNode !== document.body) {
        if (isSubmitButton(btnNode)) {
          e.preventDefault();
          e.stopPropagation();
          btnNode.style.transform = 'scale(0.97)';
          btnNode.style.opacity = '0.7';
          var url = ctaUrls[0].url;
          setTimeout(function() { window.top.location.href = url; }, 200);
          return;
        }
        btnNode = btnNode.parentElement;
      }
    }
    // First pass: check for submit buttons
    while (node && node !== document.body) {
      var tag = node.tagName ? node.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (isSubmitButton(node)) {
        e.preventDefault();
        e.stopPropagation();
        // Check if this button has a CTA url action
        var ctaUrl = node.getAttribute('data-cta-url');
        if (ctaUrl) {
          node.style.transform = 'scale(0.97)';
          node.style.opacity = '0.7';
          setTimeout(function() { window.top.location.href = ctaUrl; }, 200);
          return;
        }
        node.style.transform = 'scale(0.97)';
        node.style.opacity = '0.7';
        setTimeout(function() { doAdvance((node.textContent || '').trim().substring(0, 200)); }, 300);
        return;
      }
      node = node.parentElement;
    }
    // Second pass: check for option cards (always, regardless of pageType)
    var card = findOptionAncestor(target);
    if (card && !isSubmitButton(card)) {
      if (isMultiSelect) {
        e.preventDefault();
        e.stopPropagation();
        toggleMultiSelect(card);
      } else {
        e.preventDefault();
        e.stopPropagation();
        card.style.transform = 'scale(0.97)';
        card.style.opacity = '0.7';
        setTimeout(function() { doAdvance((card.textContent || '').trim().substring(0, 200)); }, 400);
      }
      return;
    }
    // Third pass: fallback — find any clickable ancestor (a, button, cursor:pointer)
    // Skip this fallback for multi-select pages (user needs to toggle, not advance)
    if (!isMultiSelect) {
      var clickable = findClickableAncestor(target);
      if (clickable) {
        var cTag = clickable.tagName ? clickable.tagName.toLowerCase() : '';
        var cText = (clickable.textContent || '').trim();
        // Don't advance for external links or navigation links
        if (cTag === 'a') {
          var href = (clickable.getAttribute('href') || '');
          if (href && href !== '#' && !href.startsWith('javascript') && href.startsWith('http')) return; // let real external links work
        }
        if (cText.length > 1 && cText.length < 200) {
          e.preventDefault();
          e.stopPropagation();
          // Check for CTA url on clickable element
          var ctaUrl2 = clickable.getAttribute('data-cta-url');
          if (ctaUrl2) {
            clickable.style.transform = 'scale(0.97)';
            clickable.style.opacity = '0.7';
            setTimeout(function() { window.top.location.href = ctaUrl2; }, 200);
            return;
          }
          clickable.style.transform = 'scale(0.97)';
          clickable.style.opacity = '0.7';
          setTimeout(function() { doAdvance((clickable.textContent || '').trim().substring(0, 200)); }, 400);
          return;
        }
      }
    }
  }, true);
  
  document.addEventListener('submit', function(e) { e.preventDefault(); doAdvance(); }, true);
  var origPush = history.pushState;
  var origReplace = history.replaceState;
  history.pushState = function() { origPush.apply(this, arguments); doAdvance(); };
  history.replaceState = function() { origReplace.apply(this, arguments); doAdvance(); };
  window.addEventListener('popstate', function() { doAdvance(); });
})();
</script>`;
    
    // Remove old nav bridge and inject new player bridge
    let iframeDoc = fullCode;
    
    // ═══ SANITIZE BROKEN STYLE ATTRIBUTES ═══
    // Cloned pages often have broken HTML where double quotes inside style values
    // (e.g. font-family:"Inter", sans-serif) break attribute parsing.
    // Fix: replace style="..." content to escape inner quotes properly.
    iframeDoc = iframeDoc.replace(/style\s*=\s*"([^"]*)"/gi, function(match, inner) {
      // If the inner content looks truncated or broken (very short for a style), skip
      if (inner.length < 2) return match;
      return 'style="' + inner + '"';
    });
    // More aggressive fix: find broken patterns like style="font-family:X, " attr="" 
    // and reconstruct them by merging orphaned attributes back into the style
    iframeDoc = iframeDoc.replace(/style="([^"]*)"(\s+(?:sans|serif|monospace|cursive|fantasy|system-ui|Arial|Helvetica|Inter|Roboto|Poppins|Montserrat|Open|Lato|Nunito|Outfit|Raleway|Oswald|Playfair)[^"]*="[^"]*")+/gi, function(match, styleContent) {
      // Extract the orphaned font parts and reconstruct
      const orphanedParts = match.slice(match.indexOf('"', 7) + 1);
      // Clean up: remove fake attribute patterns
      const cleanedParts = orphanedParts.replace(/\s*\w+="[^"]*"/g, '').replace(/[="]/g, '').trim();
      const fixedStyle = styleContent + (cleanedParts ? ', ' + cleanedParts : '');
      return 'style="' + fixedStyle + '"';
    });
    // Nuclear fix: convert all style attributes to use single quotes for font-family values
    iframeDoc = iframeDoc.replace(/style="([^"]*)"/gi, function(match, content) {
      // Replace font-family double quotes with single quotes inside style values
      const fixed = content.replace(/font-family\s*:\s*([^;]*)/gi, function(fMatch, fValue) {
        return 'font-family:' + fValue.replace(/"/g, "'");
      });
      return 'style="' + fixed + '"';
    });
    // Fix any remaining broken attributes caused by style quote escaping
    // Pattern: orphaned attributes like sans="" serif","="" that aren't real attributes
    iframeDoc = iframeDoc.replace(/\s+(sans|serif|monospace|cursive|fantasy)(?:-serif)?="[^"]*"/gi, '');
    // Strip ALL external scripts (prevents Next.js hydration crash)
    const keepScript = (m) => (/data-qf-keep/.test(m) ? m : '');
    iframeDoc = iframeDoc.replace(/<script[^>]+src=["'][^"']*["'][^>]*><\/script>/gi, keepScript);
    iframeDoc = iframeDoc.replace(/<script[^>]+src=["'][^"']*["'][^>]*>\s*<\/script>/gi, keepScript);
    // Remove inline scripts (except our bridge which we'll add)
    iframeDoc = iframeDoc.replace(/<script(?![^>]*(?:data-player-bridge|data-widget-fix|data-pb-anim|data-rc-anim|data-qf-keep))[^>]*>[\s\S]*?<\/script>/gi, '');
    // Remove Next.js __NEXT_DATA__ script
    iframeDoc = iframeDoc.replace(/<script id="__NEXT_DATA__"[^>]*>[\s\S]*?<\/script>/gi, '');
    
    // Inject widget interactivity script (ruler/slider, toggles, etc.)
    const widgetScript = `<script data-widget-fix>
(function() {
  // ═══ RULER / SLIDER DRAG ═══
  // Find ruler/scale containers (the ones with tick marks and numbers)
  function initRulers() {
    // Look for scroll containers with ruler-like content
    var containers = document.querySelectorAll('[class*="scroll"], [class*="slider"], [class*="ruler"], [class*="picker"], [class*="range"]');
    if (containers.length === 0) {
      // Fallback: find containers with multiple small tick-mark children
      document.querySelectorAll('div').forEach(function(div) {
        var children = div.children;
        if (children.length > 10) {
          var tickCount = 0;
          for (var i = 0; i < Math.min(children.length, 30); i++) {
            var ch = children[i];
            var w = ch.offsetWidth;
            var h = ch.offsetHeight;
            if ((w < 5 && h > 10) || (h < 5 && w > 10)) tickCount++;
          }
          if (tickCount > 5) containers = [div];
        }
      });
    }
    
    containers.forEach(function(container) {
      var dragging = false, startX = 0, scrollStart = 0;
      
      container.style.overflow = 'auto';
      container.style.cursor = 'grab';
      container.style.userSelect = 'none';
      container.style.webkitUserSelect = 'none';
      container.style.scrollbarWidth = 'none';
      
      function onStart(x) {
        dragging = true;
        startX = x;
        scrollStart = container.scrollLeft;
        container.style.cursor = 'grabbing';
      }
      function onMove(x) {
        if (!dragging) return;
        var delta = startX - x;
        container.scrollLeft = scrollStart + delta;
        updateValueDisplay(container);
      }
      function onEnd() {
        dragging = false;
        container.style.cursor = 'grab';
        updateValueDisplay(container);
      }
      
      container.addEventListener('mousedown', function(e) { onStart(e.clientX); e.preventDefault(); });
      document.addEventListener('mousemove', function(e) { onMove(e.clientX); });
      document.addEventListener('mouseup', onEnd);
      container.addEventListener('touchstart', function(e) { onStart(e.touches[0].clientX); }, {passive: true});
      document.addEventListener('touchmove', function(e) { onMove(e.touches[0].clientX); }, {passive: true});
      document.addEventListener('touchend', onEnd);
    });
  }
  
  // Update the large number display based on scroll position
  function updateValueDisplay(container) {
    // Find number elements nearby
    var parent = container.parentElement;
    if (!parent) return;
    
    // Get visible number labels in the ruler
    var numbers = [];
    container.querySelectorAll('div, span').forEach(function(el) {
      var num = parseInt(el.textContent);
      if (!isNaN(num) && num > 10 && num < 500 && el.children.length === 0) {
        numbers.push({ el: el, value: num, left: el.offsetLeft });
      }
    });
    
    if (numbers.length < 2) return;
    numbers.sort(function(a,b) { return a.left - b.left; });
    
    // Find which number is closest to center
    var centerX = container.scrollLeft + container.clientWidth / 2;
    var closest = numbers[0];
    var minDist = Infinity;
    numbers.forEach(function(n) {
      var dist = Math.abs(n.left - centerX);
      if (dist < minDist) { minDist = dist; closest = n; }
    });
    
    // Update the big number display
    var bigNumbers = parent.parentElement ? parent.parentElement.querySelectorAll('div, span, h2, h3') : [];
    bigNumbers.forEach(function(el) {
      var fontSize = parseFloat(getComputedStyle(el).fontSize || 0);
      if (fontSize > 28 && el.children.length <= 2) {
        var numText = el.textContent.match(/\\d+/);
        if (numText && parseInt(numText[0]) > 10 && parseInt(numText[0]) < 500) {
          el.childNodes.forEach(function(node) {
            if (node.nodeType === 3 && /\\d+/.test(node.textContent)) {
              node.textContent = node.textContent.replace(/\\d+/, closest.value);
            }
          });
        }
      }
    });
  }
  
  // ═══ TOGGLE BUTTONS (cm/pol, kg/lb) ═══
  function initToggles() {
    var toggleGroups = document.querySelectorAll('[class*="toggle"], [class*="tab"], [class*="switch"]');
    if (toggleGroups.length === 0) {
      // Fallback: find adjacent buttons/spans that look like unit toggles
      document.querySelectorAll('button, [role="button"]').forEach(function(btn) {
        var text = btn.textContent.trim().toLowerCase();
        if (['cm', 'pol', 'kg', 'lb', 'in', 'ft'].includes(text)) {
          btn.style.cursor = 'pointer';
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Toggle active state
            var siblings = btn.parentElement ? btn.parentElement.children : [];
            for (var i = 0; i < siblings.length; i++) {
              siblings[i].style.fontWeight = '';
              siblings[i].style.opacity = '0.5';
            }
            btn.style.fontWeight = '700';
            btn.style.opacity = '1';
          });
        }
      });
    }
  }
  
  // ═══ QUIZ PICKERS (data-quiz-picker elements) ═══
  function initPickers() {
    var pickers = document.querySelectorAll('[data-quiz-picker]');
    pickers.forEach(function(el) {
      if (el.dataset.pickerInit) return;
      el.dataset.pickerInit = '1';
      var min = parseInt(el.getAttribute('data-min')) || 0;
      var max = parseInt(el.getAttribute('data-max')) || 300;
      var unit = el.getAttribute('data-unit') || '';
      var def = parseInt(el.getAttribute('data-default')) || Math.round((min+max)/2);
      var vs = el.getAttribute('data-visual-style') || 'drum';
      var pType = el.getAttribute('data-quiz-picker');
      var color = pType === 'weight' ? '#10b981' : '#6366f1';
      var value = def;
      var question = el.getAttribute('data-question') || '';

      function render() {
        el.setAttribute('data-picker-value', value);
        var html = question ? '<div style="font-size:14px;font-weight:700;color:#1a2332;margin-bottom:8px">' + question + '</div>' : '';
        if (vs === 'drum') {
          html += '<div style="position:relative;height:220px;overflow:hidden;border-radius:10px;background:linear-gradient(to bottom,rgba(0,0,0,0.08),transparent 25%,transparent 75%,rgba(0,0,0,0.08));touch-action:none;cursor:grab;user-select:none" data-drum="1">';
          html += '<div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);height:40px;background:' + color + '12;border-top:2px solid ' + color + ';border-bottom:2px solid ' + color + ';z-index:1;pointer-events:none"></div>';
          html += '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%">';
          for (var i = value - 4; i <= value + 4; i++) {
            if (i < min || i > max) { html += '<div style="height:24px"></div>'; continue; }
            var d = Math.abs(i - value);
            var fs = d === 0 ? 22 : d === 1 ? 16 : 14;
            var fw = d === 0 ? 800 : d === 1 ? 600 : 400;
            var c = d === 0 ? color : d <= 1 ? '#4b5563' : '#9ca3af';
            var op = d > 3 ? 0.2 : d > 2 ? 0.4 : 1;
            html += '<div style="height:24px;font-size:' + fs + 'px;font-weight:' + fw + ';color:' + c + ';opacity:' + op + ';transition:all 0.1s">' + i + '</div>';
          }
          html += '</div></div>';
          html += '<div style="margin-top:10px;font-size:18px;font-weight:800;color:' + color + '">' + value + ' ' + unit + '</div>';
        } else if (vs === 'ruler') {
          html += '<div style="font-size:36px;font-weight:800;color:#1a2332;margin-bottom:4px">' + value + '<span style="font-size:16px;font-weight:600;color:#9ca3af;margin-left:4px">' + unit + '</span></div>';
          html += '<div style="position:relative;height:70px;touch-action:none;cursor:grab;user-select:none" data-drum="1"><div style="display:flex;align-items:flex-end;justify-content:center;height:50px">';
          for (var j = value - 15; j <= value + 15; j++) {
            if (j < min || j > max) continue;
            var mj = j % 10 === 0, md = j % 5 === 0, cr = j === value;
            html += '<div style="display:flex;flex-direction:column;align-items:center;width:' + (mj ? 8 : 5) + 'px;flex-shrink:0"><div style="width:' + (cr ? 3 : 1.5) + 'px;height:' + (mj ? 36 : md ? 24 : 14) + 'px;background:' + (cr ? '#1a2332' : '#d1d5db') + ';border-radius:1px"></div></div>';
          }
          html += '</div><div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%)"><div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:8px solid #1a2332"></div></div></div>';
          html += '<div style="font-size:11px;color:#9ca3af;margin-top:6px">Arraste para ajustar</div>';
        } else if (vs === 'slider') {
          var pct = ((value - min) / (max - min)) * 100;
          html += '<div style="font-size:36px;font-weight:800;color:' + color + ';margin-bottom:20px">' + value + ' <span style="font-size:16px;font-weight:600;color:#9ca3af">' + unit + '</span></div>';
          html += '<div data-slider="1" style="position:relative;height:10px;background:#e5e7eb;border-radius:5px;margin:0 12px;cursor:pointer;touch-action:none">';
          html += '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:5px"></div>';
          html += '<div style="position:absolute;top:50%;left:' + pct + '%;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;background:#fff;border:3px solid ' + color + ';box-shadow:0 2px 10px rgba(0,0,0,0.15)"></div>';
          html += '</div>';
          html += '<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:#9ca3af;padding:0 12px"><span>' + min + ' ' + unit + '</span><span>' + max + ' ' + unit + '</span></div>';
        } else if (vs === 'input') {
          html += '<div style="display:flex;align-items:center;justify-content:center;gap:20px;margin-top:8px">';
          html += '<div data-minus="1" style="width:52px;height:52px;border-radius:14px;background:#f1f5f9;border:2px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#9ca3af;cursor:pointer;user-select:none">−</div>';
          html += '<div style="text-align:center;min-width:100px"><div style="font-size:42px;font-weight:800;color:#1a2332;line-height:1">' + value + '</div><div style="font-size:14px;font-weight:600;color:#9ca3af;margin-top:4px">' + unit + '</div></div>';
          html += '<div data-plus="1" style="width:52px;height:52px;border-radius:14px;background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff;cursor:pointer;user-select:none;box-shadow:0 4px 12px rgba(0,0,0,0.15)">+</div>';
          html += '</div>';
        }
        el.innerHTML = html;
        bindEvents();
      }

      function bindEvents() {
        // Drum / ruler drag
        var drum = el.querySelector('[data-drum]');
        if (drum) {
          var dragging = false, startY = 0, startX = 0;
          drum.addEventListener('pointerdown', function(e) { dragging = true; startY = e.clientY; startX = e.clientX; e.preventDefault(); });
          document.addEventListener('pointermove', function(e) {
            if (!dragging) return;
            if (vs === 'ruler') {
              var dx = startX - e.clientX;
              if (Math.abs(dx) > 8) { value = Math.max(min, Math.min(max, value + (dx > 0 ? 1 : -1))); startX = e.clientX; render(); }
            } else {
              var dy = startY - e.clientY;
              if (Math.abs(dy) > 12) { value = Math.max(min, Math.min(max, value + (dy > 0 ? 1 : -1))); startY = e.clientY; render(); }
            }
          });
          document.addEventListener('pointerup', function() { dragging = false; });
          drum.addEventListener('wheel', function(e) { e.preventDefault(); value = Math.max(min, Math.min(max, value + (e.deltaY > 0 ? 1 : -1))); render(); });
        }
        // Slider click/drag
        var slider = el.querySelector('[data-slider]');
        if (slider) {
          function sliderUpdate(e) {
            var rect = slider.getBoundingClientRect();
            var x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            value = Math.round(min + x * (max - min));
            render();
          }
          var sdrag = false;
          slider.addEventListener('pointerdown', function(e) { sdrag = true; sliderUpdate(e); e.preventDefault(); });
          document.addEventListener('pointermove', function(e) { if (sdrag) sliderUpdate(e); });
          document.addEventListener('pointerup', function() { sdrag = false; });
        }
        // Input +/- buttons
        var minus = el.querySelector('[data-minus]');
        var plus = el.querySelector('[data-plus]');
        if (minus) minus.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); value = Math.max(min, value - 1); render(); });
        if (plus) plus.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); value = Math.min(max, value + 1); render(); });
      }

      render();
    });
  }
  
  // Init after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { initRulers(); initToggles(); initPickers(); });
  } else {
    setTimeout(function() { initRulers(); initToggles(); initPickers(); }, 100);
  }
})();
</script>`;

    const carouselScript = `<script data-carousel-enhance>
(function() {
  function initCarousels() {
    document.querySelectorAll('div, section').forEach(function(el) {
      if (el.hasAttribute('data-carousel') || el.dataset.enhanced) return;
      var cs = window.getComputedStyle(el);
      var hasScroll = cs.overflowX === 'auto' || cs.overflowX === 'scroll';
      var snapType = (cs.scrollSnapType || '') + (cs.webkitScrollSnapType || '');
      if (!hasScroll && snapType.indexOf('x') < 0) return;
      var imgs = el.querySelectorAll('img');
      if (imgs.length >= 2 && el.scrollWidth > el.clientWidth * 1.3) {
        el.setAttribute('data-carousel', 'true');
        el.setAttribute('data-orientation', 'horizontal');
      }
    });
    var carousels = document.querySelectorAll('[data-carousel]');
    carousels.forEach(function(carousel) {
      if (carousel.dataset.enhanced) return;
      carousel.dataset.enhanced = 'true';
      var allChildren = Array.from(carousel.children);
      var slides = allChildren.filter(function(ch) { return ch.querySelector && ch.querySelector('img'); });
      if (slides.length < 2) {
        var directImgs = Array.from(carousel.querySelectorAll('img'));
        if (directImgs.length >= 2) {
          slides = directImgs.map(function(img) { var w = document.createElement('div'); w.appendChild(img.cloneNode(true)); return w; });
          while (carousel.firstChild) carousel.removeChild(carousel.firstChild);
          slides.forEach(function(s) { carousel.appendChild(s); });
        }
      }
      if (slides.length < 1) return;
      allChildren.forEach(function(ch) {
        if (ch.style && ch.style.fontStyle && ch.style.fontStyle.indexOf('italic') >= 0) ch.remove();
        var badges = ch.querySelectorAll ? ch.querySelectorAll('div') : [];
        for (var b = 0; b < badges.length; b++) { var t = (badges[b].textContent || '').trim(); if (/^[0-9]+\\/[0-9]+$/.test(t)) badges[b].remove(); }
      });
      var par = carousel.parentElement;
      if (par) {
        par.querySelectorAll('[class*=dot],[class*=pag],[class*=indicator],[class*=bullet],[class*=swiper]').forEach(function(d) { if (!carousel.contains(d)) d.style.display = 'none'; });
        Array.from(par.children).forEach(function(sib) { if (sib === carousel) return; if (sib.querySelectorAll('img').length === 0 && (sib.textContent||'').trim().length < 5 && sib.offsetHeight < 50) sib.style.display = 'none'; });
      }
      var firstImg = slides[0].querySelector('img');
      var cw = carousel.offsetWidth || (par ? par.offsetWidth : 400);
      var h = 280;
      if (firstImg && firstImg.naturalWidth > 0 && firstImg.naturalHeight > 0) { h = Math.round(cw * (firstImg.naturalHeight / firstImg.naturalWidth)); }
      else if (firstImg && firstImg.offsetHeight > 50) { h = firstImg.offsetHeight; }
      h = Math.max(200, Math.min(600, h));
      var isHoriz = (carousel.getAttribute('data-orientation') || 'horizontal') !== 'vertical';
      carousel.style.cssText = 'position:relative;overflow:hidden;width:100%;padding:0;display:block;height:'+h+'px;border-radius:0;background:#000;';
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex;transition:transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94);will-change:transform;height:100%;flex-direction:'+(isHoriz?'row':'column')+';';
      slides.forEach(function(slide) {
        slide.style.cssText = 'min-width:100%;width:100%;height:100%;flex-shrink:0;border:none;border-radius:0;margin:0;padding:0;position:relative;overflow:hidden;background:#000;';
        var img = slide.querySelector('img'); if (img) img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
        wrapper.appendChild(slide);
      });
      while (carousel.firstChild) carousel.removeChild(carousel.firstChild);
      carousel.appendChild(wrapper);
      var dotsC = document.createElement('div');
      dotsC.style.cssText = 'position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:10;';
      var cur = 0, dots = [];
      for (var i = 0; i < slides.length; i++) { (function(idx) {
        var dot = document.createElement('button');
        dot.style.cssText = 'width:10px;height:10px;border-radius:50%;border:2px solid rgba(255,255,255,0.9);background:'+(idx===0?'#fff':'rgba(255,255,255,0.35)')+';cursor:pointer;padding:0;transition:all 0.3s;box-shadow:0 1px 4px rgba(0,0,0,0.3);outline:none;';
        dot.onclick = function(e) { e.preventDefault(); e.stopPropagation(); goTo(idx); };
        dots.push(dot); dotsC.appendChild(dot);
      })(i); }
      carousel.appendChild(dotsC);
      function goTo(idx) { cur = idx; wrapper.style.transform = (isHoriz?'translateX':'translateY')+'(-'+(idx*100)+'%)'; dots.forEach(function(d,di) { d.style.background = di===idx?'#fff':'rgba(255,255,255,0.35)'; d.style.transform = di===idx?'scale(1.3)':'scale(1)'; }); }
      var ap = setInterval(function() { goTo((cur+1)%slides.length); }, 3500);
      carousel.onmouseenter = function() { clearInterval(ap); };
      carousel.onmouseleave = function() { ap = setInterval(function() { goTo((cur+1)%slides.length); }, 3500); };
      var sx = 0;
      carousel.addEventListener('touchstart', function(e) { sx = e.touches[0].clientX; }, {passive:true});
      carousel.addEventListener('touchend', function(e) { var d = sx - e.changedTouches[0].clientX; if (Math.abs(d)>50) { if (d>0&&cur<slides.length-1) goTo(cur+1); else if (d<0&&cur>0) goTo(cur-1); } }, {passive:true});
    });
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function() { setTimeout(initCarousels, 300); }); }
  else { setTimeout(initCarousels, 300); }
  window.addEventListener('load', function() { setTimeout(initCarousels, 200); });
})();
</script>`;
    // Inject widget script + carousel script + player bridge before </body>
    // Inject widget script + carousel script + player bridge before </body>
    const lottieScript = /<(dot)?lottie-player/i.test(iframeDoc) ? '<script data-qf-keep src="https://cdn.jsdelivr.net/npm/@lottiefiles/lottie-player@2.0.8/dist/lottie-player.js"></script>' : '';
    if (iframeDoc.includes('</body>')) {
        iframeDoc = iframeDoc.replace('</body>', lottieScript + widgetScript + carouselScript + playerBridge + '</body>');
    } else {
        // fullCode might be body-only content (from CloneEditor edits)
        iframeDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${iframeDoc}${widgetScript}${carouselScript}${playerBridge}</body></html>`;
    }
    
    // Add sandbox attributes to allow scripts but block navigation
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', position: 'relative' }}>
        <iframe
          ref={iframeRef}
          srcDoc={iframeDoc}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
          style={{
            flex: 1,
            width: '100%',
            border: 'none',
            minHeight: '100vh',
            background: '#fff',
          }}
          title="Quiz Page"
        />
        {pixelCode && <div dangerouslySetInnerHTML={{ __html: pixelCode }} style={{ display: 'none' }} />}
        
        {/* Floating submit button for multi-select pages — only if iframe doesn't have its own */}
        {isMultiSelect && hasSelection && !(fullCode && />(Continuar|Continue|Next|Submit|Enviar|Avançar|Siguiente|Suivant|Weiter)\s*[^<]*</i.test(fullCode)) && (
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            padding: '12px 20px 20px',
            background: 'linear-gradient(transparent, rgba(255,255,255,0.95) 30%)',
            zIndex: 100,
          }}>
            <button
              onClick={() => onAdvance()}
              style={{
                ...btnStyle,
                width: '100%',
                maxWidth: 520,
                margin: '0 auto',
                display: 'block',
                animation: 'pulse 2s infinite',
              }}
            >
              Continuar →
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Fallback: old dangerouslySetInnerHTML approach (no fullCode) ──
  useEffect(() => {
    if (!htmlRef.current) return;
    const container = htmlRef.current;
    container.querySelectorAll('input[type="range"]').forEach(range => {
      const oninput = range.getAttribute('oninput');
      if (oninput) {
        range.addEventListener('input', () => { try { new Function(oninput).call(range); } catch {} });
      }
    });
  }, [html]);

  useEffect(() => {
    if (!htmlRef.current) return;
    const container = htmlRef.current;
    const isSubmitText = (text) => /continuar|continue|next|enviar|submit|avançar|começar|start|prosseguir/i.test(text);
    const handleClick = (e) => {
      let target = e.target;
      if (['input', 'textarea', 'select'].includes(target.tagName?.toLowerCase())) return;
      const qf = target.closest?.('[data-qf-role]');
      if (qf) {
        const role = qf.getAttribute('data-qf-role');
        const href = qf.getAttribute('data-qf-href');
        if (role === 'back') { e.preventDefault(); e.stopPropagation(); if (onBack) onBack(); return; }
        if ((role === 'link' || role === 'whatsapp') && href) { e.preventDefault(); e.stopPropagation(); if (onLink) onLink(href, role === 'whatsapp'); else window.location.href = href; return; }
      }
      for (let i = 0; i < 12; i++) {
        if (!target || target === container) break;
        const tag = target.tagName?.toLowerCase();
        const cls = (target.className?.toString?.() || '').toLowerCase();
        const text = (target.textContent || '').trim();
        let isClickable = tag === 'button' || tag === 'a' || cls.includes('btn') || cls.includes('button') || cls.includes('option') || cls.includes('choice');
        if (!isClickable) { try { if (window.getComputedStyle(target).cursor === 'pointer') isClickable = true; } catch {} }
        if (isClickable) {
          e.preventDefault(); e.stopPropagation();
          target.style.transform = 'scale(0.97)'; target.style.opacity = '0.7';
          setTimeout(() => { if (target) { target.style.transform = ''; target.style.opacity = ''; } onAdvance(); }, 250);
          return;
        }
        target = target.parentElement;
      }
    };
    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [html, onAdvance, onBack, onLink]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', width: '100%' }}>
      <div ref={htmlRef} style={{ flex: 1, width: '100%', maxWidth: '100%', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: html }} />
      {pixelCode && <div dangerouslySetInnerHTML={{ __html: pixelCode }} style={{ display: 'none' }} />}
    </div>
  );
}


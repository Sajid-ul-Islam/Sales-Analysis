import { spawn } from 'child_process';
import http from 'http';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          resolve(msg.result);
        }
      }
    };
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (result.exceptionDetails) {
      throw new Error(`Eval exception: ${JSON.stringify(result.exceptionDetails)}`);
    }
    return result.result?.value;
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  console.log('=== EMPIRICAL CHALLENGER: M1 ACCESSIBILITY, TOUCH TARGETS & THEME STRESS TEST ===\n');

  // Launch Chrome
  const chromeProcess = spawn('google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1280,800',
    'about:blank'
  ]);

  try {
    let version = null;
    for (let i = 0; i < 20; i++) {
      try {
        version = await getJson('http://localhost:9222/json/version');
        break;
      } catch {
        await sleep(250);
      }
    }

    if (!version) {
      throw new Error('Failed to connect to Chrome remote debugging port 9222');
    }

    const pages = await getJson('http://localhost:9222/json/list');
    const targetPage = pages.find(p => p.type === 'page') || pages[0];
    const client = new CdpClient(targetPage.webSocketDebuggerUrl);
    await client.connect();

    // Enable Runtime & Page
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    client.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
        console.log(`[Browser Console ${msg.params.type}]`, text);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[Browser Exception]', JSON.stringify(msg.params.exceptionDetails));
      }
    });

    console.log('Navigating to http://localhost:3000 ...');
    await client.send('Page.navigate', { url: 'http://localhost:3000' });
    
    // Wait for header to exist in DOM
    let headerReady = false;
    for (let i = 0; i < 40; i++) {
      const ready = await client.evaluate(`Boolean(document.querySelector('header'))`);
      if (ready) {
        headerReady = true;
        break;
      }
      await sleep(500);
    }
    console.log('Header ready in DOM:', headerReady);
    await sleep(1000);

    // =========================================================================
    // TEST 1: DESKTOP HEADER TOUCH TARGETS (1280px)
    // =========================================================================
    console.log('\n--- SUITE 1A: Desktop (1280px) Header Elements Bounding Boxes ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(500);

    let desktopHeaderButtons = await client.evaluate(`
      (() => {
        const header = document.querySelector('header');
        if (!header) return { error: 'Header not found' };

        const buttons = Array.from(header.querySelectorAll('button, input')).filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
        });
        return buttons.map(el => {
          const rect = el.getBoundingClientRect();
          const text = (el.innerText || el.getAttribute('aria-label') || el.placeholder || el.title || '').trim();
          const tag = el.tagName.toLowerCase();
          const classes = el.className;
          return {
            tag,
            text,
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
            boxSizing: window.getComputedStyle(el).boxSizing,
            minWidth: window.getComputedStyle(el).minWidth,
            minHeight: window.getComputedStyle(el).minHeight,
            padding: window.getComputedStyle(el).padding,
            ariaLabel: el.getAttribute('aria-label'),
            title: el.getAttribute('title'),
            classes
          };
        });
      })()
    `);

    if (!Array.isArray(desktopHeaderButtons)) {
      console.error('Desktop Header query error:', desktopHeaderButtons);
      desktopHeaderButtons = [];
    }
    console.log('Desktop Header Elements found:', desktopHeaderButtons.length);
    let desktopViolations = [];
    desktopHeaderButtons.forEach((b, idx) => {
      const isTargetValid = b.width >= 44 && b.height >= 44;
      const status = isTargetValid ? 'PASS' : 'FAIL';
      console.log(`  [${status}] #${idx + 1} <${b.tag}> "${b.text || b.ariaLabel}" => ${b.width}x${b.height}px (minW: ${b.minWidth}, minH: ${b.minHeight})`);
      if (!isTargetValid) {
        desktopViolations.push(b);
      }
    });

    // =========================================================================
    // TEST 1B: MOBILE HEADER TOUCH TARGETS (390px - iPhone 12/13/14)
    // =========================================================================
    console.log('\n--- SUITE 1B: Mobile (390px) Header Elements Bounding Boxes ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true
    });
    await sleep(500);

    let mobileHeaderButtons = await client.evaluate(`
      (() => {
        const header = document.querySelector('header');
        if (!header) return { error: 'Header not found' };

        // Visible buttons and inputs in header on mobile
        const elements = Array.from(header.querySelectorAll('button, input')).filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
        });

        return elements.map(el => {
          const rect = el.getBoundingClientRect();
          const text = (el.innerText || el.getAttribute('aria-label') || el.placeholder || el.title || '').trim();
          return {
            tag: el.tagName.toLowerCase(),
            text,
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
            minWidth: window.getComputedStyle(el).minWidth,
            minHeight: window.getComputedStyle(el).minHeight,
            ariaLabel: el.getAttribute('aria-label'),
            title: el.getAttribute('title')
          };
        });
      })()
    `);

    if (!Array.isArray(mobileHeaderButtons)) {
      console.error('Mobile Header query error:', mobileHeaderButtons);
      mobileHeaderButtons = [];
    }
    console.log('Mobile Header Elements visible:', mobileHeaderButtons.length);
    let mobileHeaderViolations = [];
    mobileHeaderButtons.forEach((b, idx) => {
      // In header, mission requires >= 44x44px
      const isTargetValid = b.width >= 44 && b.height >= 44;
      const status = isTargetValid ? 'PASS' : 'FAIL';
      console.log(`  [${status}] #${idx + 1} <${b.tag}> "${b.text || b.ariaLabel}" => ${b.width}x${b.height}px (minW: ${b.minWidth}, minH: ${b.minHeight})`);
      if (!isTargetValid) {
        mobileHeaderViolations.push(b);
      }
    });

    let hamburgerTest = await client.evaluate(`
      (async () => {
        const hamburger = document.querySelector('header button[aria-label="Toggle navigation menu"]');
        if (!hamburger) return { error: 'No hamburger found' };
        const initialExpanded = hamburger.getAttribute('aria-expanded');
        hamburger.click();
        await new Promise(r => setTimeout(r, 150));
        const afterClickDrawer = document.querySelector('div[role="dialog"][aria-label="Navigation drawer"]');
        const afterClickExpanded = hamburger.getAttribute('aria-expanded');
        return {
          initialExpanded,
          afterClickExpanded,
          drawerMounted: Boolean(afterClickDrawer)
        };
      })()
    `);
    console.log('Hamburger Click React Response:', hamburgerTest);
    console.log('\n--- SUITE 2: MobileBottomNav Buttons Touch Bounding Boxes (Requirement: >= 48px) ---');
    let bottomNavButtons = await client.evaluate(`
      (() => {
        const nav = document.querySelector('nav[aria-label="Mobile Navigation"]');
        if (!nav) return { error: 'MobileBottomNav not found' };

        const buttons = Array.from(nav.querySelectorAll('button'));
        return buttons.map(el => {
          const rect = el.getBoundingClientRect();
          const label = el.querySelector('span')?.innerText || el.getAttribute('aria-label') || '';
          return {
            label,
            ariaLabel: el.getAttribute('aria-label'),
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
            minWidth: window.getComputedStyle(el).minWidth,
            minHeight: window.getComputedStyle(el).minHeight,
            boxSizing: window.getComputedStyle(el).boxSizing
          };
        });
      })()
    `);

    let bottomNavViolations = [];
    if (!Array.isArray(bottomNavButtons)) {
      console.error('Error finding MobileBottomNav:', bottomNavButtons);
      bottomNavViolations.push({ error: bottomNavButtons });
      bottomNavButtons = [];
    } else {
      console.log('MobileBottomNav Buttons found:', bottomNavButtons.length);
      bottomNavButtons.forEach((b, idx) => {
        const isTargetValid = b.width >= 48 && b.height >= 48;
        const status = isTargetValid ? 'PASS' : 'FAIL';
        console.log(`  [${status}] #${idx + 1} "${b.label}" (aria: ${b.ariaLabel}) => ${b.width}x${b.height}px (minW: ${b.minWidth}, minH: ${b.minHeight})`);
        if (!isTargetValid) {
          bottomNavViolations.push(b);
        }
      });
    }

    // =========================================================================
    // TEST 3: KEYBOARD NAVIGATION & FOCUS-VISIBLE RING STYLES
    // =========================================================================
    console.log('\n--- SUITE 3: Keyboard Navigation & Focus-Visible Rings on Actionable Elements ---');
    const focusTestResults = await client.evaluate(`
      (() => {
        // Collect actionable elements: buttons, links, inputs
        const actionable = Array.from(document.querySelectorAll('button, a[href], input')).filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
        });

        const results = [];
        for (const el of actionable) {
          el.focus();
          const style = window.getComputedStyle(el);
          const className = el.className;
          const hasFocusClass = className.includes('focus-visible:') || className.includes('focus:');
          const outlineStyle = style.outlineStyle;
          const outlineWidth = style.outlineWidth;
          const outlineColor = style.outlineColor;
          const boxShadow = style.boxShadow;
          const hasVisibleRing = (outlineStyle !== 'none' && parseFloat(outlineWidth) > 0) ||
                                (boxShadow && boxShadow !== 'none');

          results.push({
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || el.getAttribute('aria-label') || el.placeholder || '').trim().slice(0, 30),
            hasFocusVisibleClass: hasFocusClass,
            hasVisibleRing,
            boxShadow: boxShadow?.slice(0, 50),
            outline: \`\${outlineWidth} \${outlineStyle} \${outlineColor}\`
          });
        }
        return results;
      })()
    `);

    console.log('Actionable elements checked for focus-visible:', focusTestResults.length);
    let focusViolations = [];
    focusTestResults.forEach((r, idx) => {
      const pass = r.hasFocusVisibleClass;
      const status = pass ? 'PASS' : 'WARN';
      if (!pass) {
        focusViolations.push(r);
      }
      if (idx < 15 || !pass) {
        console.log(`  [${status}] #${idx + 1} <${r.tag}> "${r.text}" hasFocusClass=${r.hasFocusVisibleClass}, ring=${r.hasVisibleRing} (shadow: ${r.boxShadow || 'none'})`);
      }
    });

    // =========================================================================
    // TEST 4: THEME TOGGLING (DOCUMENT ELEMENT & BODY CLASS APPLICATION)
    // =========================================================================
    console.log('\n--- SUITE 4: Theme Toggling (classList & attributes) ---');
    // Switch to desktop to test theme button in Header
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(500);

    const themeToggleResult = await client.evaluate(`
      (async () => {
        const root = document.documentElement;
        const body = document.body;

        // Locate theme toggle button in header
        const themeBtn = Array.from(document.querySelectorAll('header button')).find(b => {
          const label = b.getAttribute('aria-label') || b.title || '';
          return label.toLowerCase().includes('dark mode') || label.toLowerCase().includes('light mode');
        });

        if (!themeBtn) {
          return { error: 'Theme toggle button not found in header', buttons: Array.from(document.querySelectorAll('header button')).map(b => b.outerHTML) };
        }

        const reactKeys = Object.keys(themeBtn).filter(k => k.startsWith('__react'));
        const hasReactProps = Boolean(reactKeys.find(k => k.startsWith('__reactProps')));
        const reactProps = hasReactProps ? Object.keys(themeBtn[reactKeys.find(k => k.startsWith('__reactProps'))] || {}) : [];

        const initialRootClasses = Array.from(root.classList);
        const initialBodyClasses = Array.from(body.classList);
        const initialIsDark = root.classList.contains('dark');
        const themeBtnHtml = themeBtn.outerHTML;

        // Click theme button to toggle
        themeBtn.click();
        await new Promise(r => setTimeout(r, 150));

        const afterClick1RootClasses = Array.from(root.classList);
        const afterClick1BodyClasses = Array.from(body.classList);
        const afterClick1IsDark = root.classList.contains('dark');
        const afterClick1BodyHasCanvas = body.classList.contains('dark-canvas');

        // Click again to revert
        themeBtn.click();
        await new Promise(r => setTimeout(r, 150));

        const afterClick2RootClasses = Array.from(root.classList);
        const afterClick2BodyClasses = Array.from(body.classList);
        const afterClick2IsDark = root.classList.contains('dark');

        return {
          themeBtnFound: true,
          themeBtnHtml,
          themeBtnAria: themeBtn.getAttribute('aria-label'),
          reactKeys,
          hasReactProps,
          reactProps,
          initial: { root: initialRootClasses, body: initialBodyClasses, isDark: initialIsDark },
          afterClick1: { root: afterClick1RootClasses, body: afterClick1BodyClasses, isDark: afterClick1IsDark, bodyHasCanvas: afterClick1BodyHasCanvas },
          afterClick2: { root: afterClick2RootClasses, body: afterClick2BodyClasses, isDark: afterClick2IsDark }
        };
      })()
    `);

    console.log('Theme Toggle Inspection:');
    console.log('  React Hydration Debug: reactKeys=', themeToggleResult.reactKeys, 'hasProps=', themeToggleResult.hasReactProps, 'props=', themeToggleResult.reactProps);
    
    // Inspect script tags and window errors
    const scriptReport = await client.evaluate(`
      (() => {
        return {
          scripts: Array.from(document.scripts).map(s => ({
            src: s.src,
            async: s.async,
            defer: s.defer
          })),
          hasReact: typeof React !== 'undefined',
          hasNext: typeof __NEXT_DATA__ !== 'undefined',
          nextKeys: Object.keys(window).filter(k => k.startsWith('next') || k.startsWith('__NEXT')),
        };
      })()
    `);
    console.log('  Script Report:', JSON.stringify(scriptReport, null, 2));
    console.log('  Button matched:', themeToggleResult.themeBtnAria, 'HTML:', themeToggleResult.themeBtnHtml);
    console.log('  Initial state: root dark=', themeToggleResult.initial?.isDark, 'root classes:', themeToggleResult.initial?.root);
    console.log('  After Toggle 1: root dark=', themeToggleResult.afterClick1?.isDark, 'body dark-canvas=', themeToggleResult.afterClick1?.bodyHasCanvas, 'root classes:', themeToggleResult.afterClick1?.root);
    console.log('  After Toggle 2: root dark=', themeToggleResult.afterClick2?.isDark, 'root classes:', themeToggleResult.afterClick2?.root);

    const themePass = themeToggleResult.themeBtnFound &&
                      themeToggleResult.afterClick1?.isDark !== themeToggleResult.initial?.isDark &&
                      themeToggleResult.afterClick2?.isDark === themeToggleResult.initial?.isDark;

    console.log(`  Theme toggling test: ${themePass ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // FINAL SUMMARY
    // =========================================================================
    console.log('\n=== EMPIRICAL CHALLENGE VERIFICATION SUMMARY ===');
    console.log(`Suite 1A (Desktop Header Touch Targets >=44px): ${desktopViolations.length === 0 ? 'PASS' : `FAIL (${desktopViolations.length} violations)`}`);
    console.log(`Suite 1B (Mobile Header Touch Targets >=44px): ${mobileHeaderViolations.length === 0 ? 'PASS' : `FAIL (${mobileHeaderViolations.length} violations)`}`);
    console.log(`Suite 2 (MobileBottomNav Touch Targets >=48px): ${bottomNavViolations.length === 0 ? 'PASS' : `FAIL (${bottomNavViolations.length} violations)`}`);
    console.log(`Suite 3 (Focus-Visible Ring Styles): ${focusViolations.length === 0 ? 'PASS' : `WARN/FAIL (${focusViolations.length} missing)`}`);
    console.log(`Suite 4 (Theme Toggling documentElement/body): ${themePass ? 'PASS' : 'FAIL'}`);

    client.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(err => {
  console.error('Fatal error in stress test:', err);
  process.exit(1);
});

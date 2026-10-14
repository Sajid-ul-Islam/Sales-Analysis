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

async function runEmpiricalStressTest() {
  console.log('=== EMPIRICAL CHALLENGER: ACCESSIBILITY, TOUCH TARGETS & KPI GRID DEEP STRESS HARNESS ===\n');

  const chromeProcess = spawn('google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--user-data-dir=/tmp/test-chrome-profile-' + Date.now(),
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
    if (!version) throw new Error('Chrome remote debugging port 9222 unreachable');

    const pages = await getJson('http://localhost:9222/json/list');
    const targetPage = pages.find(p => p.type === 'page') || pages[0];
    const client = new CdpClient(targetPage.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    console.log('Navigating to http://localhost:3000 ...');
    await client.send('Page.navigate', { url: 'http://localhost:3000' });

    // Wait for Header and KPI overview to render
    for (let i = 0; i < 40; i++) {
      const ready = await client.evaluate(`Boolean(document.querySelector('header') && document.querySelector('svg[viewBox="0 0 36 36"]'))`);
      if (ready) break;
      await sleep(500);
    }
    await sleep(1000);

    // =========================================================================
    // SECTION 1: HEADER INTERACTIVE ELEMENTS TOUCH TARGET AUDIT (1280px Desktop)
    // =========================================================================
    console.log('\n--- SECTION 1A: Desktop (1280px) Detailed Header Interactive Elements ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(500);

    const desktopElements = await client.evaluate(`
      (() => {
        const header = document.querySelector('header');
        if (!header) return { error: 'Header not found' };

        const items = [];
        // 1. Search input
        const searchInput = header.querySelector('input');
        if (searchInput) {
          const r = searchInput.getBoundingClientRect();
          items.push({ name: 'Search Input', tag: 'input', width: r.width, height: r.height, minW: window.getComputedStyle(searchInput).minWidth, minH: window.getComputedStyle(searchInput).minHeight });
        }
        // 2. Data source buttons
        const sourceButtons = header.querySelectorAll('button[aria-label*="Switch data source"]');
        sourceButtons.forEach(b => {
          const r = b.getBoundingClientRect();
          items.push({ name: b.getAttribute('aria-label'), tag: 'button', width: r.width, height: r.height, minW: window.getComputedStyle(b).minWidth, minH: window.getComputedStyle(b).minHeight });
        });
        // 3. Date range selector trigger
        const dateTrigger = header.querySelector('button[title*="Filter by date range"]');
        if (dateTrigger) {
          const r = dateTrigger.getBoundingClientRect();
          items.push({ name: 'Date Range Selector Trigger', tag: 'button', width: r.width, height: r.height, minW: window.getComputedStyle(dateTrigger).minWidth, minH: window.getComputedStyle(dateTrigger).minHeight });
        }
        // 4. Reset baseline
        const resetBtn = header.querySelector('button[aria-label*="baseline"]');
        if (resetBtn) {
          const r = resetBtn.getBoundingClientRect();
          items.push({ name: 'Reset Baseline Button', tag: 'button', width: r.width, height: r.height, minW: window.getComputedStyle(resetBtn).minWidth, minH: window.getComputedStyle(resetBtn).minHeight });
        }
        // 5. Export button
        const exportBtn = header.querySelector('button[title*="Export"]');
        if (exportBtn) {
          const r = exportBtn.getBoundingClientRect();
          items.push({ name: 'Export Button', tag: 'button', width: r.width, height: r.height, minW: window.getComputedStyle(exportBtn).minWidth, minH: window.getComputedStyle(exportBtn).minHeight });
        }
        // 6. Copilot button
        const copilotBtn = header.querySelector('button[title*="Copilot"]');
        if (copilotBtn) {
          const r = copilotBtn.getBoundingClientRect();
          items.push({ name: 'Copilot Button', tag: 'button', width: r.width, height: r.height, minW: window.getComputedStyle(copilotBtn).minWidth, minH: window.getComputedStyle(copilotBtn).minHeight });
        }
        // 7. Theme toggle button
        const themeBtn = header.querySelector('button[title*="dark mode"], button[title*="light mode"]');
        if (themeBtn) {
          const r = themeBtn.getBoundingClientRect();
          items.push({ name: 'Theme Toggle Button', tag: 'button', width: r.width, height: r.height, minW: window.getComputedStyle(themeBtn).minWidth, minH: window.getComputedStyle(themeBtn).minHeight });
        }
        // 8. Settings button
        const settingsBtn = header.querySelector('button[title*="Settings & Custom Themes"]');
        if (settingsBtn) {
          const r = settingsBtn.getBoundingClientRect();
          items.push({ name: 'Settings Button', tag: 'button', width: r.width, height: r.height, minW: window.getComputedStyle(settingsBtn).minWidth, minH: window.getComputedStyle(settingsBtn).minHeight });
        }
        // 9. Avatar button
        const avatarBtn = header.querySelector('button[title*="Account & System Settings"]');
        if (avatarBtn) {
          const r = avatarBtn.getBoundingClientRect();
          items.push({ name: 'Avatar Button', tag: 'button', width: r.width, height: r.height, minW: window.getComputedStyle(avatarBtn).minWidth, minH: window.getComputedStyle(avatarBtn).minHeight });
        }
        return items;
      })()
    `);

    let desktopFailed = 0;
    desktopElements.forEach(item => {
      const ok = item.width >= 44 && item.height >= 44;
      if (!ok) desktopFailed++;
      console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${item.name}: ${item.width.toFixed(1)} x ${item.height.toFixed(1)} px (minW: ${item.minW}, minH: ${item.minH})`);
    });

    // =========================================================================
    // SECTION 1B: MOBILE (390px) HEADER INTERACTIVE ELEMENTS
    // =========================================================================
    console.log('\n--- SECTION 1B: Mobile (390px) Detailed Header Interactive Elements ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true
    });
    await sleep(500);

    const mobileElements = await client.evaluate(`
      (() => {
        const header = document.querySelector('header');
        if (!header) return { error: 'Header not found' };

        const items = [];
        // Hamburger
        const hamburger = header.querySelector('button[aria-label="Toggle navigation menu"]');
        if (hamburger) {
          const r = hamburger.getBoundingClientRect();
          items.push({ name: 'Hamburger Toggle Button', width: r.width, height: r.height, minW: window.getComputedStyle(hamburger).minWidth, minH: window.getComputedStyle(hamburger).minHeight });
        }
        // Search Input
        const searchInput = header.querySelector('input');
        if (searchInput) {
          const r = searchInput.getBoundingClientRect();
          items.push({ name: 'Search Input', width: r.width, height: r.height, minW: window.getComputedStyle(searchInput).minWidth, minH: window.getComputedStyle(searchInput).minHeight });
        }
        // Data source buttons
        const sourceButtons = header.querySelectorAll('button[aria-label*="Switch data source"]');
        sourceButtons.forEach(b => {
          const r = b.getBoundingClientRect();
          items.push({ name: b.getAttribute('aria-label'), width: r.width, height: r.height, minW: window.getComputedStyle(b).minWidth, minH: window.getComputedStyle(b).minHeight });
        });
        // Reset Baseline
        const resetBtn = header.querySelector('button[aria-label*="baseline"]');
        if (resetBtn) {
          const r = resetBtn.getBoundingClientRect();
          items.push({ name: 'Reset Baseline Button', width: r.width, height: r.height, minW: window.getComputedStyle(resetBtn).minWidth, minH: window.getComputedStyle(resetBtn).minHeight });
        }
        // Export button
        const exportBtn = header.querySelector('button[title*="Export"]');
        if (exportBtn) {
          const r = exportBtn.getBoundingClientRect();
          items.push({ name: 'Export Button', width: r.width, height: r.height, minW: window.getComputedStyle(exportBtn).minWidth, minH: window.getComputedStyle(exportBtn).minHeight });
        }
        // Copilot button
        const copilotBtn = header.querySelector('button[title*="Copilot"]');
        if (copilotBtn) {
          const r = copilotBtn.getBoundingClientRect();
          items.push({ name: 'Copilot Button', width: r.width, height: r.height, minW: window.getComputedStyle(copilotBtn).minWidth, minH: window.getComputedStyle(copilotBtn).minHeight });
        }
        // Theme toggle button
        const themeBtn = header.querySelector('button[title*="dark mode"], button[title*="light mode"]');
        if (themeBtn) {
          const r = themeBtn.getBoundingClientRect();
          items.push({ name: 'Theme Toggle Button', width: r.width, height: r.height, minW: window.getComputedStyle(themeBtn).minWidth, minH: window.getComputedStyle(themeBtn).minHeight });
        }
        // Settings button
        const settingsBtn = header.querySelector('button[title*="Settings & Custom Themes"]');
        if (settingsBtn) {
          const r = settingsBtn.getBoundingClientRect();
          items.push({ name: 'Settings Button', width: r.width, height: r.height, minW: window.getComputedStyle(settingsBtn).minWidth, minH: window.getComputedStyle(settingsBtn).minHeight });
        }
        // Avatar button
        const avatarBtn = header.querySelector('button[title*="Account & System Settings"]');
        if (avatarBtn) {
          const r = avatarBtn.getBoundingClientRect();
          items.push({ name: 'Avatar Button', width: r.width, height: r.height, minW: window.getComputedStyle(avatarBtn).minWidth, minH: window.getComputedStyle(avatarBtn).minHeight });
        }
        return items;
      })()
    `);

    let mobileFailed = 0;
    mobileElements.forEach(item => {
      const ok = item.width >= 44 && item.height >= 44;
      if (!ok) mobileFailed++;
      console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${item.name}: ${item.width.toFixed(1)} x ${item.height.toFixed(1)} px (minW: ${item.minW}, minH: ${item.minH})`);
    });

    // =========================================================================
    // SECTION 2: KPI OVERVIEW GRID RESPONSIVENESS ACROSS VIEWPORTS
    // =========================================================================
    console.log('\n--- SECTION 2: KPI Overview Grid Column Layout Across Breakpoints ---');
    const viewports = [
      { name: 'Mobile (375px)', width: 375, height: 667, expectedCols: 1 },
      { name: 'Mobile (390px)', width: 390, height: 844, expectedCols: 1 },
      { name: 'Tablet Small (640px)', width: 640, height: 800, expectedCols: 2 },
      { name: 'Tablet Medium (768px)', width: 768, height: 1024, expectedCols: 2 },
      { name: 'Laptop / Desktop (1024px)', width: 1024, height: 768, expectedCols: 3 },
      { name: 'Wide Desktop (1280px)', width: 1280, height: 800, expectedCols: 5 },
      { name: 'Ultra-Wide Desktop (1536px)', width: 1536, height: 900, expectedCols: 5 }
    ];

    let gridViolations = 0;
    for (const vp of viewports) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 768
      });
      await sleep(300);

      const gridInfo = await client.evaluate(`
        (() => {
          // Find both KPI rows
          const grids = Array.from(document.querySelectorAll('div.grid.gap-3\\\\.5, div[class*="grid-cols-1"]'));
          const kpiGrids = grids.filter(g => g.querySelectorAll('svg[viewBox="0 0 36 36"]').length > 0 || g.children.length === 5);

          return kpiGrids.map((g, i) => {
            const computed = window.getComputedStyle(g);
            const templateCols = computed.gridTemplateColumns.split(' ').filter(Boolean);
            const classes = g.className;
            return {
              rowIndex: i + 1,
              colCount: templateCols.length,
              template: computed.gridTemplateColumns,
              classes: classes
            };
          });
        })()
      `);

      console.log(`Viewport: ${vp.name} (width: ${vp.width}px):`);
      gridInfo.forEach(row => {
        const pass = row.colCount === vp.expectedCols;
        if (!pass) gridViolations++;
        console.log(`  [${pass ? 'PASS' : 'FAIL'}] Row ${row.rowIndex}: ${row.colCount} cols (expected ${vp.expectedCols})`);
      });
    }

    // =========================================================================
    // SECTION 3: MICRO-DONUT SVG CONSTRAINTS EMPIRICAL VERIFICATION
    // =========================================================================
    console.log('\n--- SECTION 3: Micro-Donut SVG Strict Constraint Verification ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(300);

    const svgAudit = await client.evaluate(`
      (() => {
        const svgs = Array.from(document.querySelectorAll('svg[viewBox="0 0 36 36"]'));
        return svgs.map((svg, idx) => {
          const rect = svg.getBoundingClientRect();
          const computed = window.getComputedStyle(svg);
          const viewBox = svg.getAttribute('viewBox');
          const widthAttr = svg.getAttribute('width');
          const heightAttr = svg.getAttribute('height');
          const hasShrink0 = svg.classList.contains('shrink-0');
          const parent = svg.parentElement;
          const parentRect = parent?.getBoundingClientRect();

          return {
            index: idx + 1,
            viewBox,
            widthAttr,
            heightAttr,
            hasShrink0,
            renderedWidth: Math.round(rect.width * 10) / 10,
            renderedHeight: Math.round(rect.height * 10) / 10,
            computedWidth: computed.width,
            computedHeight: computed.height,
            isAspectRatioSquare: Math.abs(rect.width - rect.height) < 0.5,
            parentWidth: parentRect ? Math.round(parentRect.width * 10) / 10 : null,
            parentHeight: parentRect ? Math.round(parentRect.height * 10) / 10 : null,
          };
        });
      })()
    `);

    console.log(`Total micro-donut SVGs found in DOM: ${svgAudit.length}`);
    let svgViolations = 0;
    svgAudit.forEach(s => {
      const viewBoxOk = s.viewBox === '0 0 36 36';
      const widthAttrOk = s.widthAttr === '44';
      const heightAttrOk = s.heightAttr === '44';
      const shrinkOk = s.hasShrink0;
      const sizeOk = s.renderedWidth >= 44 && s.renderedHeight >= 44;
      const squareOk = s.isAspectRatioSquare;

      const allOk = viewBoxOk && widthAttrOk && heightAttrOk && shrinkOk && sizeOk && squareOk;
      if (!allOk) svgViolations++;

      console.log(`  [${allOk ? 'PASS' : 'FAIL'}] Donut #${s.index}: rendered=${s.renderedWidth}x${s.renderedHeight}px, viewBox="${s.viewBox}", attr=${s.widthAttr}x${s.heightAttr}, shrink-0=${s.hasShrink0}, square=${squareOk}`);
    });

    // =========================================================================
    // SECTION 4: MOBILE BODY SCROLL & OVERFLOW STRESS TEST
    // =========================================================================
    console.log('\n--- SECTION 4: Zero Layout Overflow / Body Scroll at Mobile ---');
    const mobileWidths = [360, 375, 390, 412, 430];
    let overflowViolations = 0;
    for (const w of mobileWidths) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 800,
        deviceScaleFactor: 2,
        mobile: true
      });
      await sleep(300);

      const overflow = await client.evaluate(`
        (() => {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
          const innerW = window.innerWidth;
          return {
            scrollW,
            innerW,
            hasHorizontalScroll: scrollW > innerW
          };
        })()
      `);

      const pass = !overflow.hasHorizontalScroll;
      if (!pass) overflowViolations++;
      console.log(`  [${pass ? 'PASS' : 'FAIL'}] Viewport ${w}px: scrollWidth=${overflow.scrollW}px, innerWidth=${overflow.innerW}px (overflow: ${overflow.scrollW - overflow.innerW}px)`);
    }

    console.log('\n=================================================================');
    console.log('STRESS TEST HARNESS RESULTS:');
    console.log(`  Desktop Header Interactive Elements: ${desktopFailed === 0 ? 'ALL PASS' : `${desktopFailed} FAILS`}`);
    console.log(`  Mobile Header Interactive Elements: ${mobileFailed === 0 ? 'ALL PASS' : `${mobileFailed} FAILS`}`);
    console.log(`  KPI Grid Responsive Auto-Flow Breakpoints: ${gridViolations === 0 ? 'ALL PASS' : `${gridViolations} FAILS`}`);
    console.log(`  Micro-Donut SVG Strict Constraints: ${svgViolations === 0 ? 'ALL PASS' : `${svgViolations} FAILS`}`);
    console.log(`  Zero Mobile Layout Overflow: ${overflowViolations === 0 ? 'ALL PASS' : `${overflowViolations} FAILS`}`);
    console.log('=================================================================\n');

    client.close();
  } finally {
    chromeProcess.kill();
  }
}

runEmpiricalStressTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

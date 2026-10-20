import { LiveOpsReport, LiveCategoryItem, LiveTopProduct } from '@/lib/liveOpsProcessor';
import { RawOrderRow } from '@/types';
import { OrderWiseGroup } from '@/lib/orderGrouping';

export interface HtmlReportExportOptions {
  includeOrdersTable?: boolean;
  maxOrdersInTable?: number;
  orderWiseGroups?: OrderWiseGroup[];
  title?: string;
}

function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const PALETTE = [
  '#f43f5e', // Rose / Jeans
  '#6366f1', // Indigo / Polo
  '#f59e0b', // Amber / Hoodie
  '#10b981', // Emerald / Regular
  '#06b6d4', // Cyan / Trousers
  '#8b5cf6', // Purple / Casual
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#14b8a6', // Teal / Cargo
  '#f97316', // Orange / Twill
];

/**
 * Generates pure SVG Donut chart for category sales revenue.
 */
function renderDonutChartSvg(items: LiveCategoryItem[], totalRevenue: number): string {
  const size = 300;
  const center = size / 2;
  const outerR = 120;
  const innerR = 75;

  const validItems = (items || []).filter((i) => i.revenue > 0);
  const total = validItems.reduce((acc, curr) => acc + curr.revenue, 0) || totalRevenue || 1;

  if (validItems.length === 0) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="donut-chart" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${center}" cy="${center}" r="${outerR}" fill="none" stroke="#e2e8f0" stroke-width="40" />
        <text x="${center}" y="${center + 5}" text-anchor="middle" font-size="14" fill="#94a3b8" font-family="sans-serif">No Data</text>
      </svg>
    `;
  }

  let currentAngle = -Math.PI / 2;
  const paths: string[] = [];

  validItems.slice(0, 10).forEach((item, idx) => {
    const sliceAngle = (item.revenue / total) * 2 * Math.PI;
    const endAngle = currentAngle + sliceAngle;
    const color = item.color || PALETTE[idx % PALETTE.length];
    const sharePct = item.revenueShare !== undefined ? Math.round(item.revenueShare) : Math.round((item.revenue / total) * 100);

    if (sliceAngle >= 2 * Math.PI - 0.001) {
      paths.push(`
        <circle cx="${center}" cy="${center}" r="${(outerR + innerR) / 2}" fill="none" stroke="${color}" stroke-width="${outerR - innerR}" />
      `);
    } else {
      const x1 = center + outerR * Math.cos(currentAngle);
      const y1 = center + outerR * Math.sin(currentAngle);
      const x2 = center + outerR * Math.cos(endAngle);
      const y2 = center + outerR * Math.sin(endAngle);

      const x3 = center + innerR * Math.cos(endAngle);
      const y3 = center + innerR * Math.sin(endAngle);
      const x4 = center + innerR * Math.cos(currentAngle);
      const y4 = center + innerR * Math.sin(currentAngle);

      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      const pathData = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;

      paths.push(`<path d="${pathData}" fill="${color}" stroke="#ffffff" stroke-width="1.5"><title>${escapeHtml(item.name)}: ৳${item.revenue.toLocaleString()} (${sharePct}%)</title></path>`);
    }

    currentAngle = endAngle;
  });

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="donut-chart" xmlns="http://www.w3.org/2000/svg">
      <g>${paths.join('')}</g>
      <circle cx="${center}" cy="${center}" r="${innerR - 1}" class="donut-hole" />
      <text x="${center}" y="${center - 8}" text-anchor="middle" font-size="11" font-weight="600" class="donut-center-sub">NET REVENUE</text>
      <text x="${center}" y="${center + 16}" text-anchor="middle" font-size="18" font-weight="800" class="donut-center-val">৳${Math.round(total).toLocaleString()}</text>
    </svg>
  `;
}

/**
 * Generates pure SVG 7-Day Trend Bar Chart.
 */
function render7DayTrendSvg(history: LiveOpsReport['last7DaysHistory']): string {
  const width = 560;
  const height = 190;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 40;

  if (!history || history.length === 0) {
    return `<div style="text-align: center; color: #94a3b8; padding: 40px;">No historical trend data available</div>`;
  }

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const maxRevenue = Math.max(...history.map((d) => d.revenue), 1) * 1.15;
  const slotW = plotW / history.length;
  const barW = Math.min(36, slotW * 0.65);

  const bars = history.map((day, idx) => {
    const h = Math.max(4, (day.revenue / maxRevenue) * plotH);
    const x = padLeft + idx * slotW + (slotW - barW) / 2;
    const y = padTop + plotH - h;
    const barColor = day.isToday ? '#6366f1' : '#cbd5e1';
    const dayLabel = day.isToday ? 'Today' : day.dayName.slice(0, 3);
    const amountLabel = day.revenue >= 1000 ? `৳${Math.round(day.revenue / 1000)}k` : `৳${day.revenue}`;
    const ordersCount = day.orderCount ?? (day.orders ? day.orders.length : 0);

    return `
      <g class="bar-group">
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="5" fill="${barColor}">
          <title>${escapeHtml(day.dateIso || day.dateLabel || '')} (${escapeHtml(day.dayName)}): ৳${day.revenue.toLocaleString()} (${ordersCount} orders)</title>
        </rect>
        <text x="${(x + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="${day.isToday ? '700' : '600'}" fill="${day.isToday ? '#4f46e5' : '#64748b'}">${amountLabel}</text>
        <text x="${(x + barW / 2).toFixed(1)}" y="${(padTop + plotH + 16).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="${day.isToday ? '800' : '500'}" fill="${day.isToday ? '#4f46e5' : '#475569'}">${dayLabel}</text>
        <text x="${(x + barW / 2).toFixed(1)}" y="${(padTop + plotH + 28).toFixed(1)}" text-anchor="middle" font-size="9" fill="#94a3b8">${ordersCount} ord</text>
      </g>
    `;
  });

  return `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="trend-chart" xmlns="http://www.w3.org/2000/svg">
      <line x1="${padLeft}" y1="${padTop + plotH}" x2="${width - padRight}" y2="${padTop + plotH}" stroke="#e2e8f0" stroke-width="1" />
      <g>${bars.join('')}</g>
    </svg>
  `;
}

/**
 * Generates pure SVG Courier Telemetry breakdown progress bar.
 */
function renderCourierStatusBar(orders: RawOrderRow[]): string {
  const counts = { Delivered: 0, 'In Transit': 0, Returned: 0, Untracked: 0 };
  orders.forEach((o) => {
    const s = String(o['Courier Status'] || o.courierStatus || 'Untracked');
    if (s.toLowerCase().includes('deliver')) counts.Delivered++;
    else if (s.toLowerCase().includes('transit')) counts['In Transit']++;
    else if (s.toLowerCase().includes('return')) counts.Returned++;
    else counts.Untracked++;
  });

  const total = orders.length || 1;
  const pDelivered = Math.round((counts.Delivered / total) * 100);
  const pTransit = Math.round((counts['In Transit'] / total) * 100);
  const pReturned = Math.round((counts.Returned / total) * 100);
  const pUntracked = Math.max(0, 100 - pDelivered - pTransit - pReturned);

  return `
    <div class="courier-bar-wrapper">
      <div class="courier-bar">
        <div style="width: ${pDelivered}%; background: #10b981;" title="Delivered: ${counts.Delivered} (${pDelivered}%)"></div>
        <div style="width: ${pTransit}%; background: #3b82f6;" title="In Transit: ${counts['In Transit']} (${pTransit}%)"></div>
        <div style="width: ${pReturned}%; background: #f43f5e;" title="Returned: ${counts.Returned} (${pReturned}%)"></div>
        <div style="width: ${pUntracked}%; background: #94a3b8;" title="Untracked: ${counts.Untracked} (${pUntracked}%)"></div>
      </div>
      <div class="courier-legend">
        <span><span class="dot" style="background: #10b981;"></span> Delivered: <strong>${counts.Delivered}</strong> (${pDelivered}%)</span>
        <span><span class="dot" style="background: #3b82f6;"></span> In Transit: <strong>${counts['In Transit']}</strong> (${pTransit}%)</span>
        <span><span class="dot" style="background: #f43f5e;"></span> Returned: <strong>${counts.Returned}</strong> (${pReturned}%)</span>
        <span><span class="dot" style="background: #94a3b8;"></span> Untracked: <strong>${counts.Untracked}</strong> (${pUntracked}%)</span>
      </div>
    </div>
  `;
}

/**
 * Builds the standalone, self-contained HTML report.
 */
export function generateLiveOpsHtmlReport(
  report: LiveOpsReport,
  options: HtmlReportExportOptions = {}
): string {
  const {
    includeOrdersTable = true,
    maxOrdersInTable = 150,
    orderWiseGroups,
    title = `DEEN Operations & Dispatch Report — ${report.referenceDate}`,
  } = options;

  const now = new Date();
  const generatedAt = now.toLocaleString('en-US', {
    timeZone: 'Asia/Dhaka',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const revVal = Number(report.salesRevenue.rawValue ?? report.salesRevenue.value) || 0;
  const itemsVal = Number(report.shippedItems.rawValue ?? report.shippedItems.value) || 0;
  const ordersVal = Number(report.shippedOrders.rawValue ?? report.shippedOrders.value) || 0;
  const basketVal = Number(report.basketSize.rawValue ?? report.basketSize.value) || 0;

  const donutSvg = renderDonutChartSvg(report.categoryItems, revVal);
  const trendSvg = render7DayTrendSvg(report.last7DaysHistory);
  const courierBarHtml = renderCourierStatusBar(report.activeOrders);

  // Top products list
  const topProductsHtml = (report.topProducts || [])
    .slice(0, 10)
    .map(
      (p: LiveTopProduct, i: number) => {
        const pName = p.productName || (p as unknown as { itemName?: string }).itemName || 'Apparel Item';
        const units = p.unitsSold !== undefined ? p.unitsSold : ((p as unknown as { units?: number }).units || 0);

        return `
        <tr>
          <td style="font-weight: 700; width: 36px; text-align: center;">${i + 1}</td>
          <td>
            <div style="font-weight: 700; color: var(--text-heading);">${escapeHtml(pName)}</div>
            <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">SKU: ${escapeHtml(p.sku || 'N/A')}</div>
          </td>
          <td><span class="pill-category">${escapeHtml(p.category || 'Apparel')}</span></td>
          <td style="text-align: center; font-weight: 700;">${units}</td>
          <td style="text-align: right; font-weight: 800; font-family: monospace;">৳${Math.round(p.revenue).toLocaleString()}</td>
        </tr>
      `;
      }
    )
    .join('');

  // Orders Ledger rows (Order-wise or Line-item wise)
  let ordersTableRowsHtml = '';
  if (includeOrdersTable) {
    if (orderWiseGroups && orderWiseGroups.length > 0) {
      ordersTableRowsHtml = orderWiseGroups
        .slice(0, maxOrdersInTable)
        .map((g) => {
          const courierColor =
            g.courierStatus === 'Delivered'
              ? '#10b981'
              : g.courierStatus === 'In Transit'
              ? '#3b82f6'
              : g.courierStatus === 'Returned'
              ? '#f43f5e'
              : '#64748b';

          return `
          <tr>
            <td style="font-family: monospace; font-weight: 800; color: #4f46e5;">#${escapeHtml(g.orderId)}</td>
            <td style="white-space: nowrap;">${escapeHtml(g.orderDate)}</td>
            <td>
              <div style="font-weight: 700;">${escapeHtml(g.customerName)}</div>
              <div style="font-size: 11px; font-family: monospace; color: var(--text-muted);">${escapeHtml(g.phone || 'N/A')}</div>
            </td>
            <td>
              <div style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(g.items.map((i) => i.itemName).join(', '))}">
                ${escapeHtml(g.items[0]?.itemName || 'Apparel')}
                ${g.items.length > 1 ? `<span class="badge-more">+${g.items.length - 1} more</span>` : ''}
              </div>
            </td>
            <td style="text-align: center;">
              <span class="pill-collection ${g.collectionType === 'SELECTS' ? 'selects' : 'regular'}">
                ${g.collectionType === 'SELECTS' ? 'Selects' : g.collectionType === 'REGULAR' ? 'Regular' : 'Mixed'}
              </span>
            </td>
            <td style="text-align: center; font-weight: 700;">${g.totalQuantity}</td>
            <td style="text-align: right; font-weight: 800; font-family: monospace;">৳${g.totalAmount.toLocaleString()}</td>
            <td style="text-align: center;"><span class="pill-status">${escapeHtml(g.wcStatus)}</span></td>
            <td style="text-align: center;"><span class="pill-courier" style="color: ${courierColor}; border-color: ${courierColor};">${escapeHtml(g.courierStatus)}</span></td>
            <td style="text-align: center; font-family: monospace; font-size: 11px;">${escapeHtml(g.consignmentIds.join(', ') || '—')}</td>
          </tr>
        `;
        })
        .join('');
    } else {
      ordersTableRowsHtml = (report.activeOrders || [])
        .slice(0, maxOrdersInTable)
        .map((r) => {
          const oid = String(r['Order ID'] || r.orderId || '');
          const prod = String(r['Item Name'] || 'Apparel');
          const qty = Number(r.Quantity) || 1;
          const amt = Number(r['Order Amount'] || r['Item Cost'] || 0);
          const wc = String(r['Delivery Status'] || 'shipped');
          const cour = String(r['Courier Status'] || r.courierStatus || 'Untracked');
          const cid = String(r['Consignment ID'] || r.consignmentId || '—');

          return `
          <tr>
            <td style="font-family: monospace; font-weight: 800; color: #4f46e5;">#${escapeHtml(oid)}</td>
            <td>${escapeHtml(String(r['Order Date'] || ''))}</td>
            <td>${escapeHtml(String(r['Customer Name'] || 'Customer'))}</td>
            <td>${escapeHtml(prod)}</td>
            <td style="text-align: center;">Regular</td>
            <td style="text-align: center; font-weight: 700;">${qty}</td>
            <td style="text-align: right; font-weight: 800; font-family: monospace;">৳${amt.toLocaleString()}</td>
            <td style="text-align: center;"><span class="pill-status">${escapeHtml(wc)}</span></td>
            <td style="text-align: center;">${escapeHtml(cour)}</td>
            <td style="text-align: center; font-family: monospace; font-size: 11px;">${escapeHtml(cid)}</td>
          </tr>
        `;
        })
        .join('');
    }
  }

  // Category legend HTML
  const categoryLegendHtml = (report.categoryItems || [])
    .slice(0, 8)
    .map((item, idx) => {
      const color = item.color || PALETTE[idx % PALETTE.length];
      const share = item.revenueShare !== undefined ? Math.round(item.revenueShare) : 0;
      return `
      <div class="legend-row">
        <div class="legend-left">
          <span class="legend-swatch" style="background: ${color};"></span>
          <span class="legend-name">${escapeHtml(item.displayName || item.name)}</span>
        </div>
        <div class="legend-right">
          <span class="legend-val">৳${Math.round(item.revenue).toLocaleString()}</span>
          <span class="legend-pct">(${share}%)</span>
        </div>
      </div>
    `;
    })
    .join('');

  // Executive briefing bullet points
  const briefingPointsHtml = (report.executiveBriefing?.summaryPoints || [])
    .map((pt) => `<li>${escapeHtml(pt)}</li>`)
    .join('');

  const newCustPct = report.customerMix?.newPercent ?? 0;
  const retCustPct = report.customerMix?.retPercent ?? 0;
  const retCustCount = report.customerMix?.retCount ?? 0;

  const selectsRevShare = report.selectsStats?.selectsRevShare ?? 0;
  const selectsRev = report.selectsStats?.selectsRevenue || 0;
  const selectsOrders = report.selectsStats?.selectsQty ?? 0;

  const itemsDeltaPct = report.shippedItems.deltaPercent ?? 0;
  const revDeltaPct = report.salesRevenue.deltaPercent ?? 0;
  const ordersDeltaPct = report.shippedOrders.deltaPercent ?? 0;

  const itemsAvg = report.avg7dMetrics?.items ?? 0;
  const revAvg = report.avg7dMetrics?.revenue ?? 0;
  const ordersAvg = report.avg7dMetrics?.orders ?? 0;
  const aovVal = report.avg7dMetrics?.aov ?? (ordersVal > 0 ? revVal / ordersVal : 0);

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg-page: #f8fafc;
      --bg-card: #ffffff;
      --bg-elevated: #f1f5f9;
      --text-heading: #0f172a;
      --text-body: #334155;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      --primary: #4f46e5;
      --primary-hover: #4338ca;
      --accent: #f43f5e;
      --success: #10b981;
      --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    [data-theme="dark"] {
      --bg-page: #050505;
      --bg-card: #0d0d0d;
      --bg-elevated: #161616;
      --text-heading: #f8fafc;
      --text-body: #cbd5e1;
      --text-muted: #94a3b8;
      --border-color: #222222;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-family);
      background: var(--bg-page);
      color: var(--text-body);
      line-height: 1.5;
      padding: 24px 16px;
      -webkit-font-smoothing: antialiased;
    }

    .report-container {
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Top Action Bar */
    .action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-color);
      flex-wrap: wrap;
      gap: 12px;
    }

    .brand-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-logo {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: linear-gradient(135deg, #4f46e5, #ec4899);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 900;
      font-size: 20px;
    }

    .brand-title h1 {
      font-size: 20px;
      font-weight: 800;
      color: var(--text-heading);
      letter-spacing: -0.02em;
    }

    .brand-title p {
      font-size: 12px;
      color: var(--text-muted);
    }

    .btn-group {
      display: flex;
      gap: 8px;
    }

    .btn {
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid var(--border-color);
      background: var(--bg-card);
      color: var(--text-heading);
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-primary {
      background: var(--primary);
      border-color: var(--primary);
      color: #ffffff;
    }
    .btn-primary:hover { background: var(--primary-hover); }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }

    .kpi-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 18px 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }

    .kpi-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .kpi-value {
      font-size: 26px;
      font-weight: 900;
      color: var(--text-heading);
      letter-spacing: -0.03em;
      line-height: 1.1;
      margin-bottom: 8px;
    }

    .kpi-delta {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 6px;
    }

    .kpi-delta.pos { background: rgba(16, 185, 129, 0.12); color: #059669; }
    .kpi-delta.neg { background: rgba(244, 63, 94, 0.12); color: #e11d48; }

    .kpi-sub {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 6px;
    }

    /* Section Cards */
    .section-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 8px;
    }

    .section-title {
      font-size: 16px;
      font-weight: 800;
      color: var(--text-heading);
      letter-spacing: -0.01em;
    }

    .section-sub {
      font-size: 12px;
      color: var(--text-muted);
    }

    /* Charts Layout */
    .charts-row {
      display: grid;
      grid-template-columns: 1fr 1.35fr;
      gap: 20px;
      margin-bottom: 24px;
    }

    @media (max-width: 900px) {
      .charts-row { grid-template-columns: 1fr; }
    }

    .donut-container {
      display: flex;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
    }

    .donut-hole { fill: var(--bg-card); }
    .donut-center-sub { fill: var(--text-muted); }
    .donut-center-val { fill: var(--text-heading); }

    .donut-legend {
      flex: 1;
      min-width: 180px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .legend-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      padding: 4px 0;
      border-bottom: 1px dashed var(--border-color);
    }

    .legend-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .legend-swatch {
      width: 10px;
      height: 10px;
      border-radius: 3px;
    }

    .legend-name {
      font-weight: 600;
      color: var(--text-heading);
    }

    .legend-val {
      font-family: monospace;
      font-weight: 700;
      color: var(--text-heading);
    }

    .legend-pct {
      font-size: 10px;
      color: var(--text-muted);
      margin-left: 4px;
    }

    /* Courier Status Bar */
    .courier-bar-wrapper {
      margin-top: 14px;
    }
    .courier-bar {
      display: flex;
      height: 12px;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 10px;
    }
    .courier-legend {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      font-size: 12px;
      color: var(--text-body);
    }
    .courier-legend .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 4px;
    }

    /* Executive Briefing Card */
    .briefing-card {
      background: linear-gradient(135deg, #1e1b4b, #312e81);
      color: #ffffff;
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 24px;
    }

    .briefing-card h3 {
      font-size: 16px;
      font-weight: 800;
      margin-bottom: 14px;
      color: #e0e7ff;
    }

    .briefing-card ul {
      padding-left: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 13px;
      color: #c7d2fe;
    }

    /* Table Styles */
    .table-container {
      overflow-x: auto;
      border-radius: 12px;
      border: 1px solid var(--border-color);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      text-align: left;
    }

    th {
      background: var(--bg-elevated);
      color: var(--text-muted);
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.05em;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border-color);
    }

    td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-body);
    }

    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--bg-elevated); }

    /* Chips & Pills */
    .pill-category {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
      background: var(--bg-elevated);
      color: var(--text-muted);
    }

    .pill-collection {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 700;
    }
    .pill-collection.selects { background: #dcfce7; color: #15803d; }
    .pill-collection.regular { background: #e0e7ff; color: #4338ca; }

    .pill-status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      background: var(--bg-elevated);
      color: var(--text-muted);
    }

    .pill-courier {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 800;
      border: 1px solid currentColor;
    }

    .badge-more {
      font-size: 10px;
      font-weight: 700;
      background: #e0e7ff;
      color: #3730a3;
      padding: 1px 5px;
      border-radius: 4px;
      margin-left: 4px;
    }

    /* Print Optimization */
    @media print {
      body { background: #ffffff !important; color: #000000 !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .section-card { border: 1px solid #ccc !important; box-shadow: none !important; break-inside: avoid; }
      .briefing-card { background: #f8fafc !important; color: #000000 !important; border: 1px solid #ccc !important; }
      .briefing-card h3 { color: #000000 !important; }
      .briefing-card ul { color: #333333 !important; }
      .donut-hole { fill: #ffffff !important; }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- Action Bar -->
    <div class="action-bar no-print">
      <div class="brand-title">
        <div class="brand-logo">D</div>
        <div>
          <h1>DEEN Operations &amp; Dispatch Report</h1>
          <p>Reference Date: <strong>${escapeHtml(report.referenceDate)}</strong> (${escapeHtml(report.refDayName)}) &bull; Generated: ${escapeHtml(generatedAt)}</p>
        </div>
      </div>
      <div class="btn-group">
        <button type="button" class="btn" onclick="toggleTheme()">🌓 Theme</button>
        <button type="button" class="btn btn-primary" onclick="window.print()">🖨️ Print / Save as PDF</button>
      </div>
    </div>

    <!-- 6 KPI Metrics Cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Shipped Items</div>
        <div class="kpi-value">${itemsVal.toLocaleString()} <span style="font-size: 14px; font-weight: 600;">pcs</span></div>
        <div>
          <span class="kpi-delta ${itemsDeltaPct >= 0 ? 'pos' : 'neg'}">
            ${itemsDeltaPct >= 0 ? '▲ +' : '▼ '}${itemsDeltaPct}%
          </span>
          <span style="font-size: 11px; color: var(--text-muted); margin-left: 4px;">vs yesterday</span>
        </div>
        <div class="kpi-sub">7-Day Avg: ${Math.round(itemsAvg)} pcs/day</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Sales Revenue</div>
        <div class="kpi-value">৳${Math.round(revVal).toLocaleString()}</div>
        <div>
          <span class="kpi-delta ${revDeltaPct >= 0 ? 'pos' : 'neg'}">
            ${revDeltaPct >= 0 ? '▲ +' : '▼ '}${revDeltaPct}%
          </span>
          <span style="font-size: 11px; color: var(--text-muted); margin-left: 4px;">vs yesterday</span>
        </div>
        <div class="kpi-sub">7-Day Avg: ৳${Math.round(revAvg).toLocaleString()}/day</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Dispatched Orders</div>
        <div class="kpi-value">${ordersVal.toLocaleString()} <span style="font-size: 14px; font-weight: 600;">orders</span></div>
        <div>
          <span class="kpi-delta ${ordersDeltaPct >= 0 ? 'pos' : 'neg'}">
            ${ordersDeltaPct >= 0 ? '▲ +' : '▼ '}${ordersDeltaPct}%
          </span>
          <span style="font-size: 11px; color: var(--text-muted); margin-left: 4px;">vs yesterday</span>
        </div>
        <div class="kpi-sub">7-Day Avg: ${Math.round(ordersAvg)} orders/day</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Basket Size</div>
        <div class="kpi-value">${basketVal.toFixed(1)} <span style="font-size: 14px; font-weight: 600;">items/ord</span></div>
        <div class="kpi-sub">Avg Order Value: <strong>৳${Math.round(aovVal).toLocaleString()}</strong></div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Customer Mix</div>
        <div class="kpi-value">${newCustPct}% <span style="font-size: 14px; font-weight: 600;">New</span></div>
        <div class="kpi-sub">${retCustPct}% Returning (${retCustCount} orders)</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Selects Collection</div>
        <div class="kpi-value">${selectsRevShare}% <span style="font-size: 14px; font-weight: 600;">Share</span></div>
        <div class="kpi-sub">৳${Math.round(selectsRev).toLocaleString()} (${selectsOrders} units)</div>
      </div>
    </div>

    <!-- Executive Briefing -->
    ${
      briefingPointsHtml
        ? `
      <div class="briefing-card">
        <h3>📌 Executive Operational Briefing</h3>
        <ul>${briefingPointsHtml}</ul>
      </div>
    `
        : ''
    }

    <!-- Charts Row: Donut + 7-Day Trend -->
    <div class="charts-row">
      <div class="section-card">
        <div class="section-header">
          <div>
            <div class="section-title">Revenue by Apparel Category</div>
            <div class="section-sub">Product category contribution to net sales</div>
          </div>
        </div>
        <div class="donut-container">
          ${donutSvg}
          <div class="donut-legend">
            ${categoryLegendHtml}
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-header">
          <div>
            <div class="section-title">7-Day Dispatch Trend</div>
            <div class="section-sub">Historical daily revenue and orders comparison</div>
          </div>
        </div>
        ${trendSvg}
        <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border-color);">
          <div style="font-size: 12px; font-weight: 700; color: var(--text-heading); margin-bottom: 4px;">Courier Delivery Telemetry</div>
          ${courierBarHtml}
        </div>
      </div>
    </div>

    <!-- Top Selling Products Table -->
    <div class="section-card">
      <div class="section-header">
        <div>
          <div class="section-title">Top 10 Fast-Moving Products</div>
          <div class="section-sub">Ranked by dispatched quantity and revenue</div>
        </div>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 36px; text-align: center;">#</th>
              <th>Product &amp; SKU</th>
              <th>Category</th>
              <th style="text-align: center;">Units</th>
              <th style="text-align: right;">Revenue</th>
            </tr>
          </thead>
          <tbody>
            ${topProductsHtml || '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No product ranking data available</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Orders Ledger Summary Table -->
    ${
      includeOrdersTable && ordersTableRowsHtml
        ? `
      <div class="section-card">
        <div class="section-header">
          <div>
            <div class="section-title">Dispatched Orders Ledger (Top ${Math.min(maxOrdersInTable, (orderWiseGroups || report.activeOrders).length)})</div>
            <div class="section-sub">Consolidated order records with Pathao courier tracking</div>
          </div>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Customer &amp; Phone</th>
                <th>Product Summary</th>
                <th style="text-align: center;">Collection</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Total</th>
                <th style="text-align: center;">WC Status</th>
                <th style="text-align: center;">Courier Status</th>
                <th style="text-align: center;">Consignment</th>
              </tr>
            </thead>
            <tbody>
              ${ordersTableRowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `
        : ''
    }

    <!-- Footer Audit -->
    <div style="text-align: center; margin-top: 32px; font-size: 11px; color: var(--text-muted);" class="no-print">
      Generated automatically by DEEN Commerce Reconciliation Engine &bull; Confidential Executive Document
    </div>
  </div>

  <script>
    function toggleTheme() {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme');
      html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
    }
  </script>
</body>
</html>`;
}

/**
 * Browser helper to trigger instant download of the generated HTML report.
 */
export function downloadLiveOpsHtmlReport(
  report: LiveOpsReport,
  options: HtmlReportExportOptions = {}
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const htmlContent = generateLiveOpsHtmlReport(report, options);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const filename = `DEEN-Ops-Report-${report.referenceDate || new Date().toISOString().slice(0, 10)}.html`;
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

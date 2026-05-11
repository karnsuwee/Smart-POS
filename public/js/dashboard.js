import { api } from './api.js';
import { els } from './dom.js';
import { emptyState, escapeHtml, formatter, money } from './format.js';
import { state } from './state.js';

export function renderDashboard() {
  const data = state.dashboard || { totalSales: 0, totalSalesBeforeVat: 0, totalVat: 0, orderCount: 0, totalItems: 0, averageOrder: 0, topMenus: [], hourlySales: [] };
  const range = getDashboardRange();
  const chartConfig = getChartConfig(data, range);
  renderDashboardFilters(data, range);
  els.statSales.textContent = money(data.totalSales);
  if (els.statSalesBeforeVat) {
    els.statSalesBeforeVat.textContent = `ไม่รวม VAT ${money(data.totalSalesBeforeVat || 0)}`;
  }
  els.statOrders.textContent = formatter.format(data.orderCount);
  els.statItems.textContent = formatter.format(data.totalItems);
  els.statAverage.textContent = money(data.averageOrder);
  els.salesFlowTitle.textContent = chartConfig.title;
  els.salesFlowSubtitle.textContent = chartConfig.subtitle;
  els.dashboardRangeButtons.forEach(button => {
    button.classList.toggle('active', button.dataset.dashboardRange === range);
  });

  els.topMenus.innerHTML = data.topMenus.length ? `
    <div class="top-selling-row top-selling-head">
      <span>อาหาร</span>
      <span>จำนวน</span>
      <span>ยอดขาย</span>
    </div>
    ${data.topMenus.slice(0, 5).map((item, index) => `
      <div class="top-selling-row">
        <span>${index + 1}. ${escapeHtml(item.name)}</span>
        <span>${formatter.format(item.qty)}</span>
        <strong>${money(item.sales)}</strong>
      </div>
    `).join('')}
  ` : emptyState('ยังไม่มีข้อมูลขายดี');

  renderCategoryChart(data);
  const hasRows = chartConfig.rows.length > 0;
  els.hourChart.classList.toggle('hidden', !hasRows);
  els.hourChartEmpty.classList.toggle('hidden', hasRows);
  if (hasRows) drawFlowChart(els.hourChart, chartConfig.rows);
}

export async function getAiInsight() {
  const question = (els.aiPromptInput?.value || '').trim();
  els.aiButton.disabled = true;
  els.aiButton.textContent = 'กำลังวิเคราะห์...';
  try {
    const data = await api('/api/ai/stock-insight', {
      method: 'POST',
      body: JSON.stringify({ question })
    });
    renderAiInsight(data.provider, data.insight);
  } finally {
    els.aiButton.disabled = false;
    els.aiButton.textContent = 'วิเคราะห์สต็อก';
  }
}

export async function exportDashboardCsv() {
  els.exportCsvButton.disabled = true;
  els.exportCsvButton.textContent = 'กำลังเตรียมไฟล์...';
  try {
    const data = await api('/api/ai/orders-csv');
    const csv = String(data?.csv || '');
    const filename = `sales-data-for-gemini-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, csv);
  } finally {
    els.exportCsvButton.disabled = false;
    els.exportCsvButton.textContent = 'Export CSV';
  }
}

function renderCategoryChart(data) {
  if (!els.categoryChart || !els.categoryLegend) return;

  const rows = buildCategoryRows(data.menuSales || data.topMenus || []);
  const rawTotal = rows.reduce((sum, item) => sum + item.value, 0);
  const targetTotal = Number(data.totalSales || 0);
  const ratio = rawTotal > 0 && targetTotal > 0 ? targetTotal / rawTotal : 1;
  const normalizedRows = rows.map(row => ({ ...row, value: row.value * ratio }));
  const total = normalizedRows.reduce((sum, item) => sum + item.value, 0);
  els.categoryTotal.textContent = money(total || targetTotal || 0);

  if (!normalizedRows.length) {
    els.categoryChart.style.background = 'conic-gradient(#d8ded8 0 100%)';
    els.categoryLegend.innerHTML = emptyState('ยังไม่มีข้อมูลหมวดหมู่');
    return;
  }

  let current = 0;
  const segments = normalizedRows.map(row => {
    const start = current;
    current += (row.value / total) * 100;
    return `${row.color} ${start}% ${current}%`;
  });
  els.categoryChart.style.background = `conic-gradient(${segments.join(', ')})`;
  els.categoryLegend.innerHTML = normalizedRows.map(row => `
    <div class="category-legend-item">
      <i style="background:${row.color}"></i>
      <span>${escapeHtml(row.label)}</span>
      <strong>${Math.round((row.value / total) * 100)}%</strong>
    </div>
  `).join('');
}

function buildCategoryRows(menuSales) {
  const colors = ['#d94b45', '#91c788', '#f0a934', '#3d86ad', '#7b5ea7', '#4f9f88'];
  const categoryByName = new Map(state.menuItems.map(item => [item.name, item.category || 'อื่น ๆ']));
  const byCategory = new Map();

  menuSales.forEach(item => {
    const category = categoryByName.get(item.name) || 'อื่น ๆ';
    byCategory.set(category, (byCategory.get(category) || 0) + Number(item.sales || 0));
  });

  return Array.from(byCategory, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .map((row, index) => ({
      ...row,
      color: colors[index % colors.length]
    }));
}

function getDashboardRange() {
  return ['day', 'week', 'month'].includes(state.dashboardRange) ? state.dashboardRange : 'day';
}

function getChartConfig(data, range) {
  const configs = {
    day: {
      title: 'Sales by Hour',
      subtitle: 'ยอดขายในแต่ละชั่วโมงของวัน',
      rows: data.hourlySales || []
    },
    week: {
      title: 'Sales by Weekday',
      subtitle: 'ยอดขายในแต่ละวันของสัปดาห์',
      rows: data.dailySales || []
    },
    month: {
      title: 'Sales by Month Day',
      subtitle: 'ยอดขายในแต่ละวันของเดือน',
      rows: data.dateSales || []
    }
  };

  return configs[range] || configs.day;
}

function renderDashboardFilters(data, range) {
  els.dashboardDateFilter.value = state.dashboardFilters.date;
  els.dashboardWeekFilter.value = state.dashboardFilters.week;
  els.dashboardMonthFilter.value = state.dashboardFilters.month;

  els.dashboardDateFilter.classList.toggle('hidden', range !== 'day');
  els.dashboardWeekFilter.classList.toggle('hidden', range !== 'week');
  els.dashboardMonthFilter.classList.toggle('hidden', range !== 'month');
}

function drawFlowChart(canvas, rows) {
  const ctx = canvas.getContext('2d');
  const width = canvas.clientWidth || canvas.width;
  const height = 180;
  const gridLineCount = 5;
  const ratio = window.devicePixelRatio || 1;
  canvas.style.height = `${height}px`;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const styles = getComputedStyle(document.body);
  const text = styles.getPropertyValue('--muted').trim();
  const primary = styles.getPropertyValue('--primary').trim();
  const line = styles.getPropertyValue('--line').trim();
  const surfaceSoft = styles.getPropertyValue('--surface-soft').trim();
  const chartLeft = 64;
  const chartRight = width - 18;
  const chartTop = 20;
  const chartBottom = height - 30;
  const plotHeight = chartBottom - chartTop;

  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.font = '600 11px Tahoma, "Noto Sans Thai", sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  if (!rows.length) {
    for (let index = 0; index < gridLineCount; index += 1) {
      const y = chartTop + index * (plotHeight / (gridLineCount - 1));
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();
    }
    ctx.fillStyle = text;
    ctx.font = '600 14px Tahoma, "Noto Sans Thai", sans-serif';
    ctx.fillText('ยังไม่มีข้อมูลยอดขาย', chartLeft + 120, chartTop + plotHeight / 2);
    return;
  }

  const maxValue = Math.max(...rows.map(row => Number(row.value || 0)), 1);
  const scaleMax = getNiceScaleMax(maxValue, gridLineCount - 1);
  const stepValue = scaleMax / (gridLineCount - 1);

  for (let index = 0; index < gridLineCount; index += 1) {
    const y = chartTop + index * (plotHeight / (gridLineCount - 1));
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartRight, y);
    ctx.stroke();
    ctx.fillStyle = text;
    ctx.fillText(formatScaleLabel(scaleMax - (stepValue * index)), chartLeft - 12, y);
  }

  const points = rows.map((row, index) => {
    const x = rows.length === 1
      ? (chartLeft + chartRight) / 2
      : chartLeft + index * ((chartRight - chartLeft) / (rows.length - 1));
    const y = chartBottom - (Number(row.value || 0) / scaleMax) * plotHeight;
    return { x, y, ...row };
  });

  const areaGradient = ctx.createLinearGradient(0, chartTop, 0, chartBottom);
  areaGradient.addColorStop(0, withAlpha(primary, 0.34));
  areaGradient.addColorStop(1, withAlpha(primary, 0.04));

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.lineTo(points.at(-1).x, chartBottom);
  ctx.lineTo(points[0].x, chartBottom);
  ctx.closePath();
  ctx.fillStyle = areaGradient;
  ctx.fill();

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = primary;
  ctx.lineWidth = 3;
  ctx.stroke();

  points.forEach(point => {
    ctx.beginPath();
    ctx.fillStyle = surfaceSoft || '#eef4ee';
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = primary;
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  const pointLabelEvery = Math.max(1, Math.ceil(points.length / 8));
  points.forEach((point, index) => {
    if (index % pointLabelEvery !== 0 && index !== points.length - 1) return;
    ctx.font = '700 10px Tahoma, "Noto Sans Thai", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawPointLabel(ctx, formatMoneyPoint(point.value), point.x, Math.max(point.y - 12, 14), primary);
  });

  const axisLabelEvery = Math.max(1, Math.ceil(points.length / 6));
  points.forEach((point, index) => {
    if (index % axisLabelEvery !== 0 && index !== points.length - 1) return;
    ctx.fillStyle = text;
    ctx.font = '600 12px Tahoma, "Noto Sans Thai", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(point.label, point.x, height - 10);
  });
}

function getNiceScaleMax(maxValue, steps) {
  if (maxValue <= 0) return 1;
  const roughStep = maxValue / steps;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  let niceNormalized = 1;

  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 2.5) niceNormalized = 2.5;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;

  return niceNormalized * magnitude * steps;
}

function formatMoneyPoint(value) {
  const number = Number(value || 0);
  if (number >= 1000) return `฿${Math.round(number / 1000)}k`;
  return money(number);
}

function formatScaleLabel(value) {
  const number = Number(value || 0);
  if (number >= 1000) return `${Math.round(number / 1000)}k`;
  return formatter.format(Math.round(number));
}

function withAlpha(color, alpha) {
  if (!color.startsWith('#')) return color;
  const hex = color.replace('#', '');
  const bigint = parseInt(hex.length === 3 ? hex.split('').map(char => char + char).join('') : hex, 16);
  const red = (bigint >> 16) & 255;
  const green = (bigint >> 8) & 255;
  const blue = bigint & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function drawPointLabel(ctx, text, centerX, baselineY, primary) {
  const horizontalPadding = 6;
  const verticalPadding = 3;
  const radius = 6;
  const textWidth = ctx.measureText(text).width;
  const boxWidth = textWidth + horizontalPadding * 2;
  const boxHeight = 16;
  const x = centerX - boxWidth / 2;
  const y = baselineY - boxHeight;

  ctx.fillStyle = withAlpha(primary, 0.12);
  roundRect(ctx, x, y, boxWidth, boxHeight, radius);
  ctx.fill();

  ctx.strokeStyle = withAlpha(primary, 0.22);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#354a4f';
  ctx.fillText(text, x + horizontalPadding, y + boxHeight / 2 + 0.5);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function downloadCsv(filename, content) {
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderAiInsight(provider, insightText) {
  els.aiInsight.innerHTML = `
    <div class="ai-insight-item">
      <div class="ai-insight-provider">[${escapeHtml(provider || 'ai')}]</div>
      <div class="ai-insight-body">${formatAiInsight(insightText)}</div>
    </div>
  `;
}

function formatAiInsight(insightText) {
  const safeText = String(insightText || 'ยังไม่มีผลวิเคราะห์').trim() || 'ยังไม่มีผลวิเคราะห์';
  const paragraphs = safeText
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);

  return paragraphs.map(block => {
    const html = escapeHtml(block)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    return `<p>${html}</p>`;
  }).join('');
}

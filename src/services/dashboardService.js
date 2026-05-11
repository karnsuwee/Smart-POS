import { normalizeDoc } from '../utils/normalizeDoc.js';

export function buildDashboard(orders, filters = {}) {
  const range = ['day', 'week', 'month'].includes(filters.range) ? filters.range : 'day';
  const selectedDate = normalizeDateInput(filters.date);
  const selectedWeek = normalizeWeekInput(filters.week);
  const selectedMonth = normalizeMonthInput(filters.month);
  const filteredOrders = orders.filter(order => matchesRange(order.createdAt, { range, selectedDate, selectedWeek, selectedMonth }));
  const totalsByMenu = new Map();
  const salesByHour = new Map();
  const salesByDay = new Map();
  const salesByDate = new Map();
  const weekdayLabels = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
  const weekdayOrder = new Map(weekdayLabels.map((day, index) => [day, index]));
  let totalSales = 0;
  let totalSalesBeforeVat = 0;
  let totalVat = 0;
  let totalItems = 0;

  filteredOrders.forEach(order => {
    const date = new Date(order.createdAt);
    const day = weekdayLabels[getWeekdayOrderIndex(date)];
    const hour = `${String(date.getHours()).padStart(2, '0')}:00`;
    const dateKey = getLocalDateKey(date);
    const dateLabel = String(date.getDate()).padStart(2, '0');
    const subtotal = Number(order.subtotal || 0);
    const vatAmount = Number(order.vatAmount || 0);
    const total = Number(order.total || 0);
    totalSales += total;
    totalSalesBeforeVat += subtotal;
    totalVat += vatAmount;
    salesByHour.set(hour, (salesByHour.get(hour) || 0) + total);
    salesByDay.set(day, (salesByDay.get(day) || 0) + total);
    salesByDate.set(dateKey, {
      label: dateLabel,
      value: (salesByDate.get(dateKey)?.value || 0) + total
    });

    const orderItems = order.items || [];
    const lineBaseTotal = orderItems.reduce(
      (sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)),
      0
    );
    const grossRatio = lineBaseTotal > 0 ? (total / lineBaseTotal) : 1;

    orderItems.forEach(item => {
      totalItems += Number(item.qty || 0);
      const current = totalsByMenu.get(item.name) || { name: item.name, qty: 0, sales: 0 };
      const lineBase = Number(item.qty || 0) * Number(item.price || 0);
      current.qty += Number(item.qty || 0);
      current.sales += lineBase * grossRatio;
      totalsByMenu.set(item.name, current);
    });
  });

  const menuSales = Array.from(totalsByMenu.values()).sort((a, b) => b.qty - a.qty);

  return {
    totalSales,
    totalSalesBeforeVat,
    totalVat,
    orderCount: filteredOrders.length,
    totalItems,
    averageOrder: filteredOrders.length ? Math.round(totalSales / filteredOrders.length) : 0,
    menuSales,
    topMenus: menuSales.slice(0, 5),
    hourlySales: Array.from(salesByHour, ([label, value]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label)),
    dailySales: Array.from(salesByDay, ([label, value]) => ({ label, value }))
      .sort((a, b) => (weekdayOrder.get(a.label) ?? 99) - (weekdayOrder.get(b.label) ?? 99)),
    dateSales: Array.from(salesByDate, ([key, row]) => ({ key, ...row })).sort((a, b) => a.key.localeCompare(b.key)),
    recentOrders: filteredOrders.slice(0, 8).map(normalizeDoc),
    filters: {
      range,
      date: selectedDate,
      week: selectedWeek,
      month: selectedMonth
    }
  };
}

function matchesRange(createdAt, filters) {
  const date = new Date(createdAt);
  if (filters.range === 'day') return getLocalDateKey(date) === filters.selectedDate;
  if (filters.range === 'week') return getIsoWeekString(date) === filters.selectedWeek;
  if (filters.range === 'month') return getMonthInput(date) === filters.selectedMonth;
  return true;
}

function getWeekdayOrderIndex(date) {
  return (date.getDay() + 6) % 7;
}

function normalizeDateInput(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return getLocalDateKey(new Date());
}

function normalizeWeekInput(value) {
  if (typeof value === 'string' && /^\d{4}-W\d{2}$/.test(value)) return value;
  return getIsoWeekString(new Date());
}

function normalizeMonthInput(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)) return value;
  return getMonthInput(new Date());
}

function getLocalDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getIsoWeekString(date) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const weekYear = target.getFullYear();
  const firstThursday = new Date(weekYear, 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  const week = 1 + Math.round((target - firstThursday) / 604800000);
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}

function getMonthInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

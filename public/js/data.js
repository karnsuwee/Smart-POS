import { api } from './api.js';
import { state } from './state.js';

export async function loadAll() {
  await Promise.all([loadMenu(), loadTables(), loadDashboard(), loadTakeawayOrders()]);
}

export async function loadMenu() {
  state.menuItems = await api('/api/menu');
}

export async function loadTables() {
  state.tables = await api('/api/tables');
}

export async function loadDashboard() {
  const params = new URLSearchParams({ range: state.dashboardRange });
  if (state.dashboardRange === 'day') params.set('date', state.dashboardFilters.date);
  if (state.dashboardRange === 'week') params.set('week', state.dashboardFilters.week);
  if (state.dashboardRange === 'month') params.set('month', state.dashboardFilters.month);
  state.dashboard = await api(`/api/dashboard?${params.toString()}`);
  if (state.dashboard?.filters) {
    state.dashboardRange = state.dashboard.filters.range || state.dashboardRange;
    state.dashboardFilters = {
      ...state.dashboardFilters,
      date: state.dashboard.filters.date || state.dashboardFilters.date,
      week: state.dashboard.filters.week || state.dashboardFilters.week,
      month: state.dashboard.filters.month || state.dashboardFilters.month
    };
  }
}

export async function loadTakeawayOrders() {
  state.takeawayOrders = await api('/api/orders/kitchen');
}

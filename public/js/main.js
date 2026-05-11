import { els } from './dom.js';
import { state } from './state.js';
import { initTheme, toggleTheme } from './theme.js';
import { initGoogleAuth, logout } from './auth.js';
import { loadAll, loadDashboard } from './data.js';
import { showApp, showAuth, setActiveTab, renderOrderType, renderTabs } from './layout.js';
import { renderMenu, renderMenuManagement, handleMenuForm, openAddMenuDialog, addToppingOption, bindMenuImageInputs } from './menu.js';
import { renderTables, addTable, removeTable } from './tables.js';
import { renderCart, checkout, clearCurrentCart, confirmBillToKitchen } from './cart.js';
import { renderDashboard, getAiInsight, exportDashboardCsv } from './dashboard.js';
import { renderKitchen } from './kitchen.js';
import { confirmPendingAdd, cancelPendingAdd } from './orderConfirm.js';
import { renderSettings, saveSettings } from './settings.js';

init();

export function renderAll() {
  renderOrderType();
  renderTabs();
  renderMenu();
  renderMenuManagement();
  renderTables();
  renderKitchen();
  renderCart();
  renderDashboard();
  renderSettings();
}

function init() {
  initTheme();
  bindEvents();
  initGoogleAuth().catch(() => {});

  if (state.token) {
    showApp();
    loadAll().then(renderAll);
  } else {
    showAuth();
  }
}

function bindEvents() {
  els.logoutButton.addEventListener('click', logout);
  els.themeToggle.addEventListener('click', toggleTheme);
  els.searchInput.addEventListener('input', event => {
    state.search = event.target.value.trim().toLowerCase();
    renderMenu();
  });
  els.openAddMenu.addEventListener('click', openAddMenuDialog);
  els.openAddMenuFromManage.addEventListener('click', openAddMenuDialog);
  els.addToppingButton.addEventListener('click', addToppingOption);
  bindMenuImageInputs();
  els.closeMenuDialog.addEventListener('click', () => {
    state.editingMenuId = null;
    els.menuDialog.close();
  });
  els.menuForm.addEventListener('submit', handleMenuForm);
  els.clearCart.addEventListener('click', clearCurrentCart);
  els.confirmBillButton.addEventListener('click', confirmBillToKitchen);
  els.checkoutButton.addEventListener('click', checkout);
  els.aiPromptForm.addEventListener('submit', async event => {
    event.preventDefault();
    await getAiInsight();
  });
  els.exportCsvButton.addEventListener('click', exportDashboardCsv);
  els.dashboardRangeButtons.forEach(button => {
    button.addEventListener('click', async () => {
      state.dashboardRange = button.dataset.dashboardRange;
      await loadAllDashboardState();
    });
  });
  els.dashboardDateFilter.addEventListener('change', async event => {
    state.dashboardFilters.date = event.target.value;
    await loadAllDashboardState();
  });
  els.dashboardWeekFilter.addEventListener('change', async event => {
    state.dashboardFilters.week = event.target.value;
    await loadAllDashboardState();
  });
  els.dashboardMonthFilter.addEventListener('change', async event => {
    state.dashboardFilters.month = event.target.value;
    await loadAllDashboardState();
  });
  els.saveSettingsButton.addEventListener('click', saveSettings);
  els.addTableButton.addEventListener('click', addTable);
  els.removeTableButton.addEventListener('click', removeTable);
  els.confirmAddForm.addEventListener('submit', confirmPendingAdd);
  els.cancelAddButton.addEventListener('click', cancelPendingAdd);
  els.cancelAddAction.addEventListener('click', cancelPendingAdd);
  els.customerNameInput.addEventListener('input', event => {
    state.customerName = event.target.value;
  });

  els.navTabs.forEach(button => {
    button.addEventListener('click', () => {
      setActiveTab(button.dataset.tab);
      if (button.dataset.tab === 'kitchen') renderKitchen();
    });
  });

  els.orderTypeButtons.forEach(button => {
    button.addEventListener('click', () => {
      state.orderType = button.dataset.orderType;
      if (state.orderType === 'dine-in') {
        state.customerName = '';
      }
      renderOrderType();
      renderTables();
      renderCart();
    });
  });
}

async function loadAllDashboardState() {
  await loadDashboard();
  renderDashboard();
}

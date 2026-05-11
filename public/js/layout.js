import { els } from './dom.js';
import { state, titles } from './state.js';
import { loadDashboard } from './data.js';
import { renderDashboard } from './dashboard.js';

export function showAuth() {
  els.authScreen.classList.remove('hidden');
  els.appShell.classList.add('hidden');
}

export function showApp() {
  els.authScreen.classList.add('hidden');
  els.appShell.classList.remove('hidden');
  els.storeLabel.textContent = state.user?.storeName || 'ร้านของฉัน';
}

export function setActiveTab(tab) {
  state.activeTab = tab;
  renderTabs();
  if (tab === 'dashboard') loadDashboard().then(renderDashboard);
}

export function renderTabs() {
  els.navTabs.forEach(button => button.classList.toggle('active', button.dataset.tab === state.activeTab));
  els.menuView.classList.toggle('active', state.activeTab === 'menu');
  els.manageMenuView.classList.toggle('active', state.activeTab === 'manageMenu');
  els.tablesView.classList.toggle('active', state.activeTab === 'tables');
  els.kitchenView.classList.toggle('active', state.activeTab === 'kitchen');
  els.dashboardView.classList.toggle('active', state.activeTab === 'dashboard');
  els.settingsView.classList.toggle('active', state.activeTab === 'settings');
  document.body.classList.toggle('no-bill-layout', ['dashboard', 'manageMenu', 'kitchen', 'settings'].includes(state.activeTab));
  els.pageTitle.textContent = titles[state.activeTab];
  els.activeModeLabel.textContent = ['dashboard', 'manageMenu', 'kitchen', 'settings'].includes(state.activeTab) ? 'หลังร้าน' : 'หน้าร้าน';
}

export function renderOrderType() {
  els.orderTypeButtons.forEach(button => button.classList.toggle('active', button.dataset.orderType === state.orderType));
  els.billTitle.textContent = state.orderType === 'dine-in' ? 'กินที่ร้าน' : 'กลับบ้าน';
  els.customerNameField.classList.toggle('hidden', state.orderType !== 'takeaway');
  if (state.orderType !== 'takeaway') {
    els.customerNameInput.value = '';
  }
}

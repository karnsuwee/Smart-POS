export const state = {
  token: localStorage.getItem('smartPosToken') || '',
  user: normalizeStoredUser(JSON.parse(localStorage.getItem('smartPosUser') || 'null')),
  authMode: 'login',
  activeTab: 'menu',
  orderType: 'dine-in',
  selectedTable: null,
  menuItems: [],
  tables: [],
  takeawayOrders: [],
  cart: [],
  dashboard: null,
  dashboardRange: 'day',
  dashboardFilters: {
    date: getTodayDateInput(),
    week: getCurrentWeekInput(),
    month: getCurrentMonthInput()
  },
  search: '',
  editingMenuId: null,
  pendingMenuId: null,
  editingToppings: [],
  menuImageSource: 'url',
  menuImageUploadDataUrl: '',
  customerName: '',
  orderNote: ''
};

export const titles = {
  menu: 'เมนู',
  manageMenu: 'จัดการเมนู',
  tables: 'ที่นั่ง',
  kitchen: 'คิวครัว',
  dashboard: 'Dashboard',
  settings: 'Settings'
};

function normalizeStoredUser(user) {
  if (!user) return null;
  return {
    ...user,
    settings: {
      vatMode: user.settings?.vatMode || 'exclusive'
    }
  };
}

function getTodayDateInput() {
  const now = toBangkokDate(new Date());
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

function getCurrentWeekInput() {
  const target = toBangkokDate(new Date());
  target.setUTCHours(0, 0, 0, 0);
  target.setUTCDate(target.getUTCDate() + 3 - ((target.getUTCDay() + 6) % 7));
  const weekYear = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7));
  const week = 1 + Math.round((target - firstThursday) / 604800000);
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}

function getCurrentMonthInput() {
  const now = toBangkokDate(new Date());
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function toBangkokDate(date) {
  const utcMs = date.getTime();
  const bangkokOffsetMs = 7 * 60 * 60 * 1000;
  return new Date(utcMs + bangkokOffsetMs);
}

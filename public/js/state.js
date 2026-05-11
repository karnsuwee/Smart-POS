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
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getCurrentWeekInput() {
  const target = new Date();
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const weekYear = target.getFullYear();
  const firstThursday = new Date(weekYear, 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  const week = 1 + Math.round((target - firstThursday) / 604800000);
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}

function getCurrentMonthInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

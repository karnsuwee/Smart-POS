import { api } from './api.js';
import { els } from './dom.js';
import { escapeHtml } from './format.js';
import { renderOrderType, setActiveTab } from './layout.js';
import { state } from './state.js';
import { showToast } from './toast.js';
import { renderCart } from './cart.js';

export function renderTables() {
  els.selectedTableText.textContent = state.selectedTable ? state.selectedTable.name : 'ยังไม่ได้เลือกโต๊ะ';
  const tables = [...state.tables].sort(compareTablesByNumber);
  els.tableGrid.innerHTML = tables.map(table => `
    <article class="table-card ${state.selectedTable?.id === table.id ? 'active' : ''}" data-table-card="${table.id}">
      <strong>${escapeHtml(table.name)}</strong>
      <small>${table.currentItems?.length ? `${table.currentItems.length} เมนูในโต๊ะ` : 'ยังไม่มีออเดอร์'}</small>
      <div class="table-card-actions">
        <button class="secondary table-menu-button" data-table-menu="${table.id}" type="button">เพิ่มเมนู</button>
        <button class="table-status-button ${table.status === 'busy' ? 'busy' : 'free'}" data-table-status="${table.id}" type="button">${table.status === 'busy' ? 'ไม่ว่าง' : 'ว่าง'}</button>
      </div>
    </article>
  `).join('');

  document.querySelectorAll('[data-table-card]').forEach(card => {
    card.addEventListener('click', () => selectTable(card.dataset.tableCard));
  });
  document.querySelectorAll('[data-table-menu]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      selectTable(button.dataset.tableMenu);
      setActiveTab('menu');
      showToast(`เลือก ${state.selectedTable.name} แล้ว เพิ่มเมนูได้เลย`);
    });
  });
  document.querySelectorAll('[data-table-status]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      toggleTableStatus(button.dataset.tableStatus);
    });
  });
}

export async function addTable() {
  const table = await api('/api/tables', { method: 'POST' });
  state.tables.push(table);
  renderTables();
  showToast(`เพิ่ม ${table.name} แล้ว`);
}

export async function removeTable() {
  if (!state.tables.length) return showToast('ยังไม่มีโต๊ะให้ลบ');
  const table = state.selectedTable || state.tables[state.tables.length - 1];
  if (!confirm(`ลบ ${table.name}?`)) return;

  await api(`/api/tables/${table.id}`, { method: 'DELETE' });
  state.tables = state.tables.filter(item => item.id !== table.id);
  if (state.selectedTable?.id === table.id) state.selectedTable = null;
  renderTables();
  renderCart();
  showToast(`ลบ ${table.name} แล้ว`);
}

export function selectTable(id) {
  state.orderType = 'dine-in';
  state.selectedTable = state.tables.find(table => table.id === id);
  renderOrderType();
  renderTables();
  renderCart();
  showToast(`เลือก ${state.selectedTable.name}`);
}

export function updateTableInState(updatedTable) {
  updatedTable.currentItems = hydrateCartItems(updatedTable.currentItems || []);
  updatedTable.kitchenTickets = hydrateTickets(updatedTable.kitchenTickets || []);
  state.tables = state.tables.map(table => table.id === updatedTable.id ? updatedTable : table);
  if (state.selectedTable?.id === updatedTable.id) state.selectedTable = updatedTable;
}

async function toggleTableStatus(id) {
  const table = state.tables.find(item => item.id === id);
  if (!table) return;

  const nextStatus = table.status === 'busy' ? 'available' : 'busy';
  const updated = await api(`/api/tables/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: nextStatus })
  });
  updateTableInState(updated);
  renderTables();
  showToast(`${updated.name} ถูกตั้งเป็น ${updated.status === 'busy' ? 'ไม่ว่าง' : 'ว่าง'}`);
}

function hydrateCartItems(items) {
  return items.map(item => ({
    ...item,
    id: item.id || item.lineKey || item.menuItemId,
    kitchenStatus: item.kitchenStatus || 'waiting'
  }));
}

function hydrateTickets(tickets) {
  return tickets.map(ticket => ({
    ...ticket,
    items: hydrateCartItems(ticket.items || [])
  }));
}

function compareTablesByNumber(a, b) {
  const aNumber = extractTableNumber(a.name);
  const bNumber = extractTableNumber(b.name);

  if (aNumber !== null && bNumber !== null && aNumber !== bNumber) {
    return aNumber - bNumber;
  }

  if (aNumber !== null && bNumber === null) return -1;
  if (aNumber === null && bNumber !== null) return 1;

  return String(a.name || '').localeCompare(String(b.name || ''), 'th');
}

function extractTableNumber(name) {
  const match = String(name || '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

import { api } from './api.js';
import { els } from './dom.js';
import { emptyState, escapeHtml, formatter, getBillBreakdown, getVatMode, money } from './format.js';
import { setActiveTab } from './layout.js';
import { state } from './state.js';
import { showToast } from './toast.js';
import { loadDashboard, loadTables, loadTakeawayOrders } from './data.js';
import { renderDashboard } from './dashboard.js';
import { renderTables, updateTableInState } from './tables.js';
import { renderKitchen } from './kitchen.js';

export async function addToCart(id, customizations = {}) {
  if (state.orderType === 'dine-in' && !state.selectedTable) {
    setActiveTab('tables');
    return showToast('เลือกโต๊ะก่อนเพิ่มเมนู');
  }

  const item = state.menuItems.find(entry => entry.id === id);
  if (!item) return;
  const toppings = cleanToppings(customizations.toppings || []);
  const itemNote = String(customizations.itemNote || '').trim();
  const lineKey = makeLineKey(item.id, toppings, itemNote);
  const price = Number(item.price || 0) + toppings.reduce((sum, topping) => sum + Number(topping.price || 0), 0);
  const existing = state.cart.find(entry => entry.lineKey === lineKey);
  if (existing) {
    existing.qty += 1;
    existing.kitchenStatus = 'waiting';
  } else {
    state.cart.push({
      id: lineKey,
      lineKey,
      menuItemId: item.id,
      name: item.name,
      price,
      toppings,
      itemNote,
      qty: 1,
      addedAt: new Date().toISOString(),
      kitchenStatus: 'waiting'
    });
  }
  renderCart();
  showToast('เลือกเมนูใส่บิลแล้ว');
}

export function renderCart() {
  if (state.orderType === 'takeaway') {
    els.selectedTableCard.textContent = 'ออเดอร์กลับบ้าน';
  } else {
    els.selectedTableCard.textContent = state.selectedTable ? state.selectedTable.name : 'เลือกโต๊ะก่อนเช็คบิล';
  }

  const confirmedItems = state.orderType === 'dine-in' ? (state.selectedTable?.currentItems || []) : [];
  const visibleItems = state.cart.length ? state.cart : confirmedItems;
  els.cartList.innerHTML = visibleItems.length ? visibleItems.map(item => `
    <div class="cart-item">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        ${renderItemDetails(item)}
        <small>${state.cart.length ? 'ยังไม่ส่งครัว' : 'ส่งครัวแล้ว'} · ฿${formatter.format(item.price)} × ${item.qty}</small>
      </div>
      <div class="qty-controls">
        ${state.cart.length ? `<button data-qty="${item.id}" data-delta="-1" type="button">-</button>` : ''}
        <span>${item.qty}</span>
        ${state.cart.length ? `<button data-qty="${item.id}" data-delta="1" type="button">+</button>` : ''}
      </div>
    </div>
  `).join('') : emptyState('ยังไม่มีรายการในบิล');

  document.querySelectorAll('[data-qty]').forEach(button => {
    button.addEventListener('click', () => changeQty(button.dataset.qty, Number(button.dataset.delta)));
  });

  const subtotal = visibleItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const bill = getBillBreakdown(visibleItems, state.user);
  els.subtotalText.textContent = money(bill.subtotal);
  els.vatText.textContent = money(bill.vat);
  els.totalText.textContent = money(bill.total);
  els.vatRow.classList.toggle('hidden', bill.vatMode === 'none');
  els.subtotalLabel.textContent = bill.vatMode === 'inclusive' ? 'ก่อน VAT' : 'Subtotal';
  els.totalLabel.textContent = bill.vatMode === 'none' ? 'Total' : 'Total';
  els.confirmBillButton.classList.toggle('hidden', state.orderType !== 'dine-in' || !state.cart.length);
  syncBillMetaInputs();
}

export async function checkout() {
  if (state.orderType === 'dine-in' && !state.selectedTable) {
    setActiveTab('tables');
    return showToast('กรุณาเลือกโต๊ะก่อนเช็คบิล');
  }
  if (state.orderType === 'dine-in' && state.cart.length) {
    await confirmBillToKitchen();
  }

  const checkoutItems = state.orderType === 'dine-in'
    ? state.selectedTable?.currentItems || []
    : state.cart;
  if (!checkoutItems.length) return showToast('ยังไม่มีรายการอาหาร');

  const bill = getBillBreakdown(checkoutItems, state.user);
  await api('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      orderType: state.orderType,
      tableId: state.selectedTable?.id || null,
      tableName: state.selectedTable?.name || '',
      customerName: state.customerName,
      note: '',
      items: checkoutItems,
      subtotal: bill.subtotal,
      vatAmount: bill.vat,
      total: bill.total,
      vatMode: getVatMode(state.user)
    })
  });

  if (state.orderType === 'dine-in' && state.selectedTable) {
    await api(`/api/tables/${state.selectedTable.id}/order`, {
      method: 'DELETE'
    });
  }

  state.cart = [];
  await Promise.all([loadDashboard(), loadTables(), loadTakeawayOrders()]);
  if (state.orderType === 'dine-in' && state.selectedTable) {
    const freshTable = state.tables.find(table => table.id === state.selectedTable.id);
    if (freshTable) state.selectedTable = freshTable;
  }
  state.customerName = '';
  els.customerNameInput.value = '';
  renderCart();
  renderTables();
  renderKitchen();
  renderDashboard();
  showToast('เช็คบิลสำเร็จ บันทึกยอดขายแล้ว');
}

export async function clearCurrentCart() {
  state.cart = [];
  renderCart();
  showToast('ล้างบิลชั่วคราวแล้ว');
}

async function changeQty(id, delta) {
  const item = state.cart.find(entry => entry.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) state.cart = state.cart.filter(entry => entry.id !== id);
  renderCart();
}

function renderItemDetails(item) {
  const toppings = item.toppings || [];
  const parts = [
    toppings.length ? toppings.map(topping => `${topping.name}${Number(topping.price || 0) ? ` +฿${formatter.format(topping.price)}` : ''}`).join(', ') : '',
    item.itemNote ? `หมายเหตุ: ${item.itemNote}` : ''
  ].filter(Boolean);

  return parts.length ? `<small class="item-options">${escapeHtml(parts.join(' · '))}</small>` : '';
}

function cleanToppings(toppings) {
  return toppings.map(topping => ({
    name: String(topping.name || '').trim(),
    price: Number(topping.price || 0)
  })).filter(topping => topping.name && topping.price >= 0);
}

function makeLineKey(menuItemId, toppings, itemNote) {
  const optionKey = encodeURIComponent(JSON.stringify({
    toppings: [...toppings].sort((a, b) => a.name.localeCompare(b.name)),
    itemNote
  }));
  return `${menuItemId}::${optionKey}`;
}

export async function confirmBillToKitchen() {
  if (!state.cart.length) return showToast('ยังไม่มีรายการในบิล');
  if (state.orderType !== 'dine-in' || !state.selectedTable) {
    setActiveTab('tables');
    return showToast('เลือกโต๊ะก่อนยืนยันรายการ');
  }

  const updatedTable = await api(`/api/tables/${state.selectedTable.id}/tickets`, {
    method: 'POST',
    body: JSON.stringify({
      items: state.cart,
      customerName: state.customerName,
      note: ''
    })
  });
  updateTableInState(updatedTable);
  state.cart = [];
  renderCart();
  renderTables();
  renderKitchen();
  showToast('ยืนยันบิลและส่งเข้าคิวครัวแล้ว');
}

function syncBillMetaInputs() {
  if (document.activeElement !== els.customerNameInput) {
    els.customerNameInput.value = state.customerName || '';
  }
}

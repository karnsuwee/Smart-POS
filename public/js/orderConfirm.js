import { addToCart } from './cart.js';
import { els } from './dom.js';
import { escapeHtml, money } from './format.js';
import { setActiveTab } from './layout.js';
import { state } from './state.js';
import { showToast } from './toast.js';

export function openConfirmAddDialog(menuId) {
  if (state.orderType === 'dine-in' && !state.selectedTable) {
    setActiveTab('tables');
    showToast('เลือกโต๊ะก่อนเพิ่มเมนู');
    return;
  }

  const item = state.menuItems.find(entry => entry.id === menuId);
  if (!item) return;

  state.pendingMenuId = menuId;
  const target = state.orderType === 'dine-in'
    ? state.selectedTable?.name || 'ยังไม่ได้เลือกโต๊ะ'
    : 'ออเดอร์กลับบ้าน';
  els.confirmAddText.textContent = `เลือก ${item.name} (${money(item.price)}) ใส่บิลของ ${target}?`;
  els.itemNoteInput.value = '';
  els.confirmOptionList.innerHTML = (item.toppings || []).length
    ? `
      <div class="option-choice-list">
        ${(item.toppings || []).map((topping, index) => `
          <label class="option-choice">
            <input type="checkbox" data-pending-topping="${index}">
            <span>${escapeHtml(topping.name)}${Number(topping.price || 0) ? ` +${money(topping.price)}` : ''}</span>
          </label>
        `).join('')}
      </div>
    `
    : '<p class="muted compact-empty">ไม่มีตัวเลือกเพิ่มเติม</p>';
  els.confirmAddDialog.showModal();
}

export async function confirmPendingAdd(event) {
  event.preventDefault();
  if (!state.pendingMenuId) return;

  const menuId = state.pendingMenuId;
  const item = state.menuItems.find(entry => entry.id === menuId);
  const selectedToppings = Array.from(document.querySelectorAll('[data-pending-topping]:checked'))
    .map(input => item?.toppings?.[Number(input.dataset.pendingTopping)])
    .filter(Boolean)
    .map(topping => ({
      name: topping.name,
      price: Number(topping.price || 0)
    }));
  const itemNote = els.itemNoteInput.value.trim();

  state.pendingMenuId = null;
  els.confirmAddDialog.close();
  await addToCart(menuId, { toppings: selectedToppings, itemNote });
}

export function cancelPendingAdd() {
  state.pendingMenuId = null;
  els.itemNoteInput.value = '';
  els.confirmAddDialog.close();
}

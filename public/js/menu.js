import { api } from './api.js';
import { els } from './dom.js';
import { emptyState, escapeHtml, formatter } from './format.js';
import { state } from './state.js';
import { showToast } from './toast.js';
import { renderCart } from './cart.js';
import { openConfirmAddDialog } from './orderConfirm.js';

export function renderMenu() {
  const items = state.menuItems.filter(item => {
    const q = state.search;
    if (!q) return true;
    return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
  });
  const favorites = state.menuItems.filter(item => item.isFavorite);

  els.favoriteCount.textContent = `${favorites.length} รายการ`;
  els.menuCount.textContent = `${items.length} รายการ`;
  els.favoriteRow.innerHTML = favorites.length
    ? favorites.map(item => menuCard(item, true)).join('')
    : emptyState('ยังไม่มีเมนูโปรด กดดาวบนเมนูเพื่อบันทึก');
  els.menuGrid.innerHTML = items.length
    ? items.map(item => menuCard(item)).join('')
    : emptyState('ยังไม่พบเมนู');

  document.querySelectorAll('[data-add-menu]').forEach(button => {
    button.addEventListener('click', () => openConfirmAddDialog(button.dataset.addMenu));
  });
  document.querySelectorAll('[data-favorite-menu]').forEach(button => {
    button.addEventListener('click', () => toggleFavorite(button.dataset.favoriteMenu));
  });
}

export function openAddMenuDialog() {
  state.editingMenuId = null;
  state.editingToppings = [];
  state.menuImageSource = 'url';
  state.menuImageUploadDataUrl = '';
  els.menuDialogTitle.textContent = 'เพิ่มเมนู';
  els.menuSubmitButton.textContent = 'บันทึกเมนู';
  els.menuForm.reset();
  els.menuImageFileInput.value = '';
  renderImageSourceFields();
  setImagePreview('');
  renderToppingEditor();
  els.menuDialog.showModal();
}

export async function handleMenuForm(event) {
  event.preventDefault();
  const imagePayload = buildImagePayload();
  const payload = {
    name: els.menuNameInput.value.trim(),
    price: Number(els.menuPriceInput.value),
    category: els.menuCategoryInput.value.trim() || 'อื่นๆ',
    stockUnit: els.menuStockUnitInput.value.trim() || 'ชุด',
    image: imagePayload.image,
    imageUpload: imagePayload.imageUpload,
    toppings: collectToppings()
  };

  if (state.editingMenuId) {
    const updated = await api(`/api/menu/${state.editingMenuId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    state.menuItems = state.menuItems.map(item => item.id === updated.id ? updated : item);
    state.cart = state.cart.map(item => item.menuItemId === updated.id
      ? {
          ...item,
          name: updated.name,
          price: getLinePrice(updated.price, item.toppings || []),
          menuItemId: updated.id
        }
      : item);
    showToast('แก้ไขเมนูแล้ว');
  } else {
    const item = await api('/api/menu', { method: 'POST', body: JSON.stringify(payload) });
    state.menuItems.unshift(item);
    showToast('เพิ่มเมนูแล้ว');
  }

  state.editingMenuId = null;
  state.editingToppings = [];
  state.menuImageSource = 'url';
  state.menuImageUploadDataUrl = '';
  els.menuForm.reset();
  els.menuImageFileInput.value = '';
  renderImageSourceFields();
  setImagePreview('');
  els.menuDialog.close();
  renderMenu();
  renderMenuManagement();
  renderCart();
}

export function renderMenuManagement() {
  els.manageMenuList.innerHTML = state.menuItems.length
    ? state.menuItems.map(manageMenuItem).join('')
    : emptyState('ยังไม่มีเมนู กดเพิ่มเมนูใหม่เพื่อเริ่มต้น');

  document.querySelectorAll('[data-edit-menu]').forEach(button => {
    button.addEventListener('click', () => openEditMenuDialog(button.dataset.editMenu));
  });
  document.querySelectorAll('[data-manage-favorite]').forEach(button => {
    button.addEventListener('click', () => toggleFavorite(button.dataset.manageFavorite));
  });
  document.querySelectorAll('[data-delete-menu]').forEach(button => {
    button.addEventListener('click', () => deleteMenu(button.dataset.deleteMenu));
  });
}

async function toggleFavorite(id) {
  const updated = await api(`/api/menu/${id}/favorite`, { method: 'PATCH' });
  state.menuItems = state.menuItems.map(item => item.id === id ? updated : item);
  renderMenu();
  renderMenuManagement();
  showToast(updated.isFavorite ? 'เพิ่มในเมนูโปรดแล้ว' : 'นำออกจากเมนูโปรดแล้ว');
}

async function deleteMenu(id) {
  const item = state.menuItems.find(entry => entry.id === id);
  if (!item || !confirm(`ลบเมนู ${item.name}?`)) return;
  await api(`/api/menu/${id}`, { method: 'DELETE' });
  state.menuItems = state.menuItems.filter(entry => entry.id !== id);
  state.cart = state.cart.filter(entry => entry.menuItemId !== id);
  renderMenu();
  renderMenuManagement();
  renderCart();
  showToast('ลบเมนูแล้ว');
}

function menuCard(item, compact = false) {
  const fallback = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="100%" height="100%" fill="#dfe8df"/><text x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="32" fill="#607067">${item.name}</text></svg>`);
  return `
    <article class="menu-card">
      <img src="${escapeHtml(item.image || fallback)}" alt="${escapeHtml(item.name)}" loading="lazy">
      <div class="menu-body">
        <div class="menu-meta">
          <span>${escapeHtml(item.category || 'อื่นๆ')}</span>
          <span>${escapeHtml(item.stockUnit || 'ชุด')}</span>
        </div>
        <div class="menu-title">
          <h4>${escapeHtml(item.name)}</h4>
          <button class="favorite-button" data-favorite-menu="${item.id}" type="button" title="Favorite">${item.isFavorite ? '★' : '☆'}</button>
        </div>
        <div class="menu-actions">
          <button class="secondary" data-add-menu="${item.id}" type="button">เพิ่ม ฿${formatter.format(item.price)}</button>
        </div>
      </div>
    </article>
  `;
}

function openEditMenuDialog(id) {
  const item = state.menuItems.find(entry => entry.id === id);
  if (!item) return;

  state.editingMenuId = id;
  els.menuDialogTitle.textContent = 'แก้ไขเมนู';
  els.menuSubmitButton.textContent = 'บันทึกการแก้ไข';
  els.menuNameInput.value = item.name;
  els.menuPriceInput.value = item.price;
  els.menuCategoryInput.value = item.category || '';
  els.menuStockUnitInput.value = item.stockUnit || '';
  const isStoredUpload = item.image?.startsWith('data:image/') || item.image?.startsWith('/uploads/');
  els.menuImageInput.value = isStoredUpload ? '' : item.image || '';
  els.menuImageFileInput.value = '';
  state.menuImageSource = isStoredUpload ? 'upload' : 'url';
  state.menuImageUploadDataUrl = '';
  state.editingToppings = (item.toppings || []).map(topping => ({ ...topping }));
  renderImageSourceFields();
  setImagePreview(item.image || '');
  renderToppingEditor();
  els.menuDialog.showModal();
}

function manageMenuItem(item) {
  const toppingText = (item.toppings || []).length
    ? ` · ตัวเลือก ${(item.toppings || []).length} รายการ`
    : '';
  const fallback = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="100%" height="100%" fill="#dfe8df"/><text x="50%" y="52%" text-anchor="middle" font-family="Arial" font-size="18" fill="#607067">${item.name}</text></svg>`);
  return `
    <article class="manage-item">
      <img src="${escapeHtml(item.image || fallback)}" alt="${escapeHtml(item.name)}" loading="lazy">
      <div class="manage-info">
        <h4>${escapeHtml(item.name)}</h4>
        <p>${escapeHtml(item.category || 'อื่นๆ')} · ฿${formatter.format(item.price)} · หน่วย ${escapeHtml(item.stockUnit || 'ชุด')}${toppingText}</p>
      </div>
      <div class="manage-actions">
        <button class="favorite-button" data-manage-favorite="${item.id}" type="button" title="Favorite">${item.isFavorite ? '★' : '☆'}</button>
        <button class="secondary" data-edit-menu="${item.id}" type="button">แก้ไข</button>
        <button class="ghost danger" data-delete-menu="${item.id}" type="button">ลบ</button>
      </div>
    </article>
  `;
}

export function addToppingOption() {
  state.editingToppings.push({ name: '', price: 0 });
  renderToppingEditor();
}

export function bindMenuImageInputs() {
  els.menuImageSourceInputs.forEach(input => {
    input.addEventListener('change', () => {
      state.menuImageSource = input.value;
      renderImageSourceFields();
    });
  });

  els.menuImageInput.addEventListener('input', () => {
    if (state.menuImageSource === 'url') {
      setImagePreview(els.menuImageInput.value.trim());
    }
  });

  els.menuImageFileInput.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) {
      state.menuImageUploadDataUrl = '';
      setImagePreview('');
      return;
    }

    state.menuImageUploadDataUrl = await readFileAsDataUrl(file);
    setImagePreview(state.menuImageUploadDataUrl);
  });
}

function renderToppingEditor() {
  els.toppingList.innerHTML = state.editingToppings.length
    ? state.editingToppings.map((topping, index) => `
      <div class="topping-row">
        <input data-topping-name="${index}" value="${escapeHtml(topping.name || '')}" placeholder="เช่น เผ็ดน้อย">
        <input data-topping-price="${index}" value="${Number(topping.price || 0)}" type="number" min="0" placeholder="0">
        <button class="ghost danger" data-remove-topping="${index}" type="button">ลบ</button>
      </div>
    `).join('')
    : '<p class="muted compact-empty">ยังไม่มีตัวเลือก</p>';

  document.querySelectorAll('[data-topping-name]').forEach(input => {
    input.addEventListener('input', () => {
      state.editingToppings[Number(input.dataset.toppingName)].name = input.value;
    });
  });
  document.querySelectorAll('[data-topping-price]').forEach(input => {
    input.addEventListener('input', () => {
      state.editingToppings[Number(input.dataset.toppingPrice)].price = Number(input.value || 0);
    });
  });
  document.querySelectorAll('[data-remove-topping]').forEach(button => {
    button.addEventListener('click', () => {
      state.editingToppings.splice(Number(button.dataset.removeTopping), 1);
      renderToppingEditor();
    });
  });
}

function collectToppings() {
  return state.editingToppings
    .map(topping => ({
      name: String(topping.name || '').trim(),
      price: Number(topping.price || 0)
    }))
    .filter(topping => topping.name && topping.price >= 0);
}

function getLinePrice(basePrice, toppings) {
  return Number(basePrice || 0) + toppings.reduce((sum, topping) => sum + Number(topping.price || 0), 0);
}

function buildImagePayload() {
  if (state.menuImageSource === 'upload') {
    if (state.menuImageUploadDataUrl) {
      return {
        image: '',
        imageUpload: {
          name: els.menuImageFileInput.files?.[0]?.name || 'menu-image',
          dataUrl: state.menuImageUploadDataUrl
        }
      };
    }

    const existingPreview = els.menuImagePreview.getAttribute('src') || '';
    return {
      image: existingPreview.startsWith('data:image/') || existingPreview.startsWith('/uploads/') ? existingPreview : '',
      imageUpload: null
    };
  }

  return {
    image: els.menuImageInput.value.trim(),
    imageUpload: null
  };
}

function renderImageSourceFields() {
  els.menuImageSourceInputs.forEach(input => {
    input.checked = input.value === state.menuImageSource;
    input.closest('.radio-segment')?.classList.toggle('active-segment', input.checked);
  });
  els.menuImageUrlField.classList.toggle('hidden', state.menuImageSource !== 'url');
  els.menuImageFileField.classList.toggle('hidden', state.menuImageSource !== 'upload');
}

function setImagePreview(src) {
  els.menuImagePreview.classList.toggle('hidden', !src);
  if (src) {
    els.menuImagePreview.src = src;
  } else {
    els.menuImagePreview.removeAttribute('src');
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

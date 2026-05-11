import { api } from './api.js';
import { els } from './dom.js';
import { getVatMode } from './format.js';
import { renderCart } from './cart.js';
import { state } from './state.js';
import { showToast } from './toast.js';

export function renderSettings() {
  const vatMode = getVatMode(state.user);
  els.storeNameInput.value = state.user?.storeName || '';
  els.vatModeInputs.forEach(input => {
    input.checked = input.value === vatMode;
  });
}

export async function saveSettings() {
  const selected = Array.from(els.vatModeInputs).find(input => input.checked)?.value || 'exclusive';
  const storeName = (els.storeNameInput.value || '').trim();
  if (!storeName) {
    showToast('กรุณากรอกชื่อร้าน');
    return;
  }
  if (storeName.length > 80) {
    showToast('ชื่อร้านยาวเกินไป (สูงสุด 80 ตัวอักษร)');
    return;
  }
  const data = await api('/api/auth/me/settings', {
    method: 'PATCH',
    body: JSON.stringify({ vatMode: selected, storeName })
  });

  state.user = data.user;
  localStorage.setItem('smartPosUser', JSON.stringify(state.user));
  els.storeLabel.textContent = state.user?.storeName || 'ร้านของฉัน';
  renderSettings();
  renderCart();
  showToast('บันทึกการตั้งค่าแล้ว');
}

import { api } from './api.js';
import { els } from './dom.js';
import { getVatMode } from './format.js';
import { renderCart } from './cart.js';
import { state } from './state.js';
import { showToast } from './toast.js';

export function renderSettings() {
  const vatMode = getVatMode(state.user);
  els.vatModeInputs.forEach(input => {
    input.checked = input.value === vatMode;
  });
}

export async function saveSettings() {
  const selected = Array.from(els.vatModeInputs).find(input => input.checked)?.value || 'exclusive';
  const data = await api('/api/auth/me/settings', {
    method: 'PATCH',
    body: JSON.stringify({ vatMode: selected })
  });

  state.user = data.user;
  localStorage.setItem('smartPosUser', JSON.stringify(state.user));
  renderSettings();
  renderCart();
  showToast('บันทึกการตั้งค่า VAT แล้ว');
}

import { api } from './api.js';
import { els } from './dom.js';
import { state } from './state.js';
import { showToast } from './toast.js';
import { loadAll } from './data.js';
import { renderAll } from './main.js';
import { showApp, showAuth } from './layout.js';

let googleInitialized = false;

export async function initGoogleAuth() {
  const providerData = await api('/api/auth/providers');
  const googleProvider = providerData.google || {};
  if (!googleProvider.enabled || !googleProvider.clientId || !window.google?.accounts?.id) {
    els.googleAuthWrap.classList.add('hidden');
    els.googleAuthStatus.textContent = !googleProvider.enabled || !googleProvider.clientId
      ? 'Google Login ยังไม่พร้อม กรุณาตั้งค่า GOOGLE_CLIENT_ID ก่อน'
      : 'กำลังโหลด Google Login ไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง';
    return;
  }

  if (!googleInitialized) {
    window.handleGoogleCredential = async response => {
      const data = await api('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential: response.credential })
      });
      await completeLogin(data, 'เข้าสู่ระบบด้วย Google สำเร็จ');
    };

    window.google.accounts.id.initialize({
      client_id: googleProvider.clientId,
      callback: window.handleGoogleCredential
    });
    googleInitialized = true;
  }

  els.googleAuthWrap.classList.remove('hidden');
  els.googleAuthStatus.textContent = window.location.hostname === 'localhost'
    ? 'ถ้า Google Login ไม่ขึ้น ให้เพิ่ม http://localhost:3000 ใน Authorized JavaScript origins'
    : 'เลือกบัญชี Google เพื่อเข้าสู่ระบบ';
  els.googleAuthButton.innerHTML = '';
  window.google.accounts.id.renderButton(els.googleAuthButton, {
    theme: 'outline',
    size: 'large',
    shape: 'pill',
    text: 'continue_with',
    width: 320
  });
}

export function logout() {
  state.token = '';
  state.user = null;
  state.cart = [];
  state.selectedTable = null;
  localStorage.removeItem('smartPosToken');
  localStorage.removeItem('smartPosUser');
  showAuth();
  showToast('ออกจากระบบแล้ว');
}

async function completeLogin(data, message) {
  state.token = data.token;
  state.user = {
    ...data.user,
    settings: {
      vatMode: data.user?.settings?.vatMode || 'exclusive'
    }
  };
  localStorage.setItem('smartPosToken', state.token);
  localStorage.setItem('smartPosUser', JSON.stringify(state.user));
  showToast(message);
  showApp();
  await loadAll();
  renderAll();
}

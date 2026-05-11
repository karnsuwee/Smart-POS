import { state } from './state.js';
import { showToast } from './toast.js';

export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch {
    const message = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
    showToast(message);
    throw new Error(message);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail ? `: ${data.detail}` : '';
    const message = data.message
      ? `${data.message}${detail}`
      : (data.detail || `เกิดข้อผิดพลาด (${response.status})`);
    showToast(message);
    throw new Error(message);
  }
  return data;
}

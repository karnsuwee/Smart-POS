export const formatter = new Intl.NumberFormat('th-TH');

export function money(value) {
  return `฿${formatter.format(Math.round(Number(value || 0)))}`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function emptyState(text) {
  return `<p class="muted">${escapeHtml(text)}</p>`;
}

export function getVatMode(user) {
  return user?.settings?.vatMode || 'exclusive';
}

export function getBillBreakdown(items, user) {
  const gross = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
  const vatMode = getVatMode(user);

  if (vatMode === 'none') {
    return {
      vatMode,
      subtotal: gross,
      vat: 0,
      total: gross
    };
  }

  if (vatMode === 'inclusive') {
    const subtotal = gross / 1.07;
    return {
      vatMode,
      subtotal,
      vat: gross - subtotal,
      total: gross
    };
  }

  return {
    vatMode,
    subtotal: gross,
    vat: gross * 0.07,
    total: gross * 1.07
  };
}

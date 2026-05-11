import { api } from './api.js';
import { els } from './dom.js';
import { emptyState, escapeHtml, formatter } from './format.js';
import { state } from './state.js';
import { showToast } from './toast.js';
import { updateTableInState } from './tables.js';

const statusLabels = {
  waiting: 'รอทำ',
  cooking: 'กำลังทำ',
  done: 'เสร็จแล้ว'
};

export function renderKitchen() {
  const tickets = getKitchenTickets();
  els.kitchenCount.textContent = `${tickets.length} บิล`;
  els.kitchenList.innerHTML = tickets.length
    ? tickets.map(ticketCard).join('')
    : emptyState('ยังไม่มีรายการอาหารในคิวครัว');

  document.querySelectorAll('[data-kitchen-status]').forEach(button => {
    button.addEventListener('click', () => updateKitchenStatus(
      button.dataset.kitchenTable,
      button.dataset.kitchenTicket,
      button.dataset.kitchenItem,
      button.dataset.kitchenStatus
    ));
  });
  document.querySelectorAll('[data-clear-order]').forEach(button => {
    button.addEventListener('click', () => clearKitchenOrder(button.dataset.clearOrder));
  });
}

async function updateKitchenStatus(tableId, ticketId, menuItemId, status) {
  if (ticketId.startsWith('takeaway-')) {
    const updatedOrder = await api(`/api/orders/${ticketId.replace('takeaway-', '')}/kitchen-item`, {
      method: 'PATCH',
      body: JSON.stringify({ menuItemId, status })
    });
    state.takeawayOrders = state.takeawayOrders.map(order => order.id === updatedOrder.id ? updatedOrder : order);
    renderKitchen();
    showToast(`อัปเดตสถานะเป็น ${statusLabels[status]}`);
    return;
  }

  const table = state.tables.find(item => item.id === tableId);
  if (!table) return;

  const kitchenTickets = (table.kitchenTickets || []).map(ticket => {
    if (ticket.ticketId !== ticketId) return ticket;
    return {
      ...ticket,
      items: (ticket.items || []).map(item => {
        if ((item.lineKey || item.id || item.menuItemId) !== menuItemId) return item;
        return { ...item, kitchenStatus: status };
      })
    };
  });

  const updatedTable = await api(`/api/tables/${tableId}/tickets`, {
    method: 'PUT',
    body: JSON.stringify({ kitchenTickets })
  });
  updateTableInState(updatedTable);
  renderKitchen();
  showToast(`อัปเดตสถานะเป็น ${statusLabels[status]}`);
}

function getKitchenTickets() {
  const tableTickets = state.tables
    .flatMap(table => (table.kitchenTickets || []).map(ticket => ({
      ticketId: ticket.ticketId,
      tableId: table.id,
      tableName: table.name,
      customerName: ticket.customerName || '',
      note: ticket.note || '',
      items: ticket.items || [],
      addedAt: ticket.createdAt || getOldestAddedAt(ticket.items || [])
    })))
    .sort((a, b) => new Date(a.addedAt || 0) - new Date(b.addedAt || 0));

  const takeawayTickets = state.takeawayOrders.map(order => ({
    ticketId: `takeaway-${order.id}`,
    tableId: order.id,
    tableName: 'กลับบ้าน',
    customerName: order.customerName || '',
    note: order.note || '',
    items: order.items || [],
    addedAt: order.createdAt || getOldestAddedAt(order.items || [])
  }));

  return [...tableTickets, ...takeawayTickets]
    .sort((a, b) => new Date(a.addedAt || 0) - new Date(b.addedAt || 0));
}

function ticketCard(ticket, index) {
  const allDone = ticket.items.every(item => item.kitchenStatus === 'done');
  const hasCooking = ticket.items.some(item => item.kitchenStatus === 'cooking');
  const status = allDone ? 'done' : hasCooking ? 'cooking' : 'waiting';
  const clearTarget = ticket.ticketId.startsWith('takeaway-')
    ? `takeaway-order-${ticket.tableId}`
    : `table-ticket-${ticket.tableId}-${ticket.ticketId}`;
  return `
    <article class="kitchen-item ${status}">
      <div class="kitchen-card-head">
        <span class="queue-number">${index + 1}</span>
        <div class="kitchen-card-meta">
          <h4>${escapeHtml(ticket.tableName)}</h4>
          <p>${ticket.items.length} เมนู · ${escapeHtml(statusLabels[status])}</p>
          ${(ticket.customerName || ticket.note) ? `<small class="kitchen-meta-extra">${escapeHtml(ticket.customerName || 'ไม่ระบุชื่อ')} ${ticket.note ? `· ${escapeHtml(ticket.note)}` : ''}</small>` : ''}
        </div>
        <button class="ghost danger kitchen-clear-button" data-clear-order="${clearTarget}" type="button">ล้างออเดอร์นี้</button>
      </div>
      <div class="kitchen-bill-items">
        ${ticket.items.map(item => `
          <div class="kitchen-bill-row">
            <div class="kitchen-food">
              <div>
                <strong>${escapeHtml(item.name)} × ${item.qty}</strong>
                ${renderKitchenItemDetails(item)}
              </div>
              <small>${escapeHtml(statusLabels[item.kitchenStatus || 'waiting'])}</small>
            </div>
            <button class="secondary compact-button" data-kitchen-table="${ticket.tableId}" data-kitchen-ticket="${ticket.ticketId}" data-kitchen-item="${item.lineKey || item.id || item.menuItemId}" data-kitchen-status="cooking" type="button">กำลังทำ</button>
            <button class="primary compact-button" data-kitchen-table="${ticket.tableId}" data-kitchen-ticket="${ticket.ticketId}" data-kitchen-item="${item.lineKey || item.id || item.menuItemId}" data-kitchen-status="done" type="button">เสร็จ</button>
          </div>
        `).join('')}
      </div>
    </article>
  `;
}

async function clearKitchenOrder(tableId) {
  if (!confirm('ล้างเฉพาะออเดอร์นี้?')) return;
  if (tableId.startsWith('takeaway-order-')) {
    const orderId = tableId.replace('takeaway-order-', '');
    await api(`/api/orders/${orderId}/kitchen`, {
      method: 'DELETE'
    });
    state.takeawayOrders = state.takeawayOrders.filter(order => order.id !== orderId);
    renderKitchen();
    showToast('ล้างออเดอร์แล้ว');
    return;
  }

  if (!tableId.startsWith('table-ticket-')) return;

  const [, tableAndTicket] = tableId.split('table-ticket-');
  const separatorIndex = tableAndTicket.lastIndexOf('-');
  const tableIdOnly = tableAndTicket.slice(0, separatorIndex);
  const ticketId = tableAndTicket.slice(separatorIndex + 1);

  const updatedTable = await api(`/api/tables/${tableIdOnly}/tickets/${ticketId}`, {
    method: 'DELETE'
  });
  updateTableInState(updatedTable);
  renderKitchen();
  showToast('ล้างออเดอร์แล้ว');
}

function getOldestAddedAt(items) {
  return items
    .map(item => item.addedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(a) - new Date(b))[0];
}

function renderKitchenItemDetails(item) {
  const toppings = item.toppings || [];
  const parts = [
    toppings.length ? toppings.map(topping => `${topping.name}${Number(topping.price || 0) ? ` +฿${formatter.format(topping.price)}` : ''}`).join(', ') : '',
    item.itemNote ? `หมายเหตุ: ${item.itemNote}` : ''
  ].filter(Boolean);

  return parts.length ? `<small class="item-options">${escapeHtml(parts.join(' · '))}</small>` : '';
}

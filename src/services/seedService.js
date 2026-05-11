import { isDbReady } from '../db.js';
import mongoose from 'mongoose';
import { MenuItem } from '../models/MenuItem.js';
import { Table } from '../models/Table.js';
import { memory } from '../store/memoryStore.js';
import { makeId } from '../utils/ids.js';

const defaultMenus = [
  ['ข้าวผัดหมู', 60, 'ข้าวจานเดียว', 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80', 'จาน'],
  ['น้ำเปล่า', 15, 'เครื่องดื่ม', 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=600&q=80', 'ขวด']
];

export async function seedShop(ownerId) {
  if (isDbReady()) {
    if (!mongoose.isValidObjectId(ownerId)) {
      return;
    }

    const [menuCount, tableCount] = await Promise.all([
      MenuItem.countDocuments({ ownerId }),
      Table.countDocuments({ ownerId })
    ]);

    if (!menuCount) {
      await MenuItem.insertMany(defaultMenus.map(([name, price, category, image, stockUnit]) => ({
        ownerId,
        name,
        price,
        category,
        image,
        stockUnit,
        isFavorite: false
      })));
    }

    if (!tableCount) {
      await Table.insertMany(Array.from({ length: 10 }, (_, i) => ({
        ownerId,
        name: `โต๊ะ ${i + 1}`,
        currentItems: [],
        kitchenTickets: []
      })));
    }
    return;
  }

  if (!memory.menuItems.some(item => item.ownerId === ownerId)) {
    defaultMenus.forEach(([name, price, category, image, stockUnit]) => {
      memory.menuItems.push({
        id: makeId(),
        ownerId,
        name,
        price,
        category,
        image,
        stockUnit,
        isFavorite: false,
        isAvailable: true
      });
    });
  }

  if (!memory.tables.some(table => table.ownerId === ownerId)) {
    Array.from({ length: 10 }, (_, i) => {
      memory.tables.push({ id: makeId(), ownerId, name: `โต๊ะ ${i + 1}`, status: 'available', currentItems: [], kitchenTickets: [] });
    });
  }
}

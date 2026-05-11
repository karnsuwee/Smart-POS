import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  orderType: { type: String, enum: ['dine-in', 'takeaway'], required: true },
  tableId: { type: mongoose.Schema.Types.ObjectId, default: null },
  tableName: { type: String, default: '' },
  customerName: { type: String, default: '' },
  note: { type: String, default: '' },
  items: [{
    lineKey: String,
    menuItemId: String,
    name: String,
    qty: Number,
    price: Number,
    toppings: [{
      name: String,
      price: { type: Number, default: 0 }
    }],
    itemNote: { type: String, default: '' },
    kitchenStatus: { type: String, enum: ['waiting', 'cooking', 'done'], default: 'waiting' }
  }],
  kitchenOpen: { type: Boolean, default: false },
  subtotal: { type: Number, default: 0 },
  vatAmount: { type: Number, default: 0 },
  vatMode: { type: String, enum: ['none', 'inclusive', 'exclusive'], default: 'exclusive' },
  total: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Order = mongoose.model('Order', orderSchema);

import mongoose from 'mongoose';

const tableSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['available', 'busy'], default: 'available' },
  currentItems: [{
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
    addedAt: Date,
    kitchenStatus: { type: String, enum: ['waiting', 'cooking', 'done'], default: 'waiting' }
  }],
  kitchenTickets: [{
    ticketId: String,
    createdAt: Date,
    customerName: String,
    note: String,
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
      addedAt: Date,
      kitchenStatus: { type: String, enum: ['waiting', 'cooking', 'done'], default: 'waiting' }
    }]
  }]
});

export const Table = mongoose.model('Table', tableSchema);

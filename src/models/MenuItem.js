import mongoose from 'mongoose';

const menuItemSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, default: 'อาหาร' },
  image: { type: String, default: '' },
  stockUnit: { type: String, default: 'ชุด' },
  toppings: [{
    name: String,
    price: { type: Number, default: 0 }
  }],
  isFavorite: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export const MenuItem = mongoose.model('MenuItem', menuItemSchema);

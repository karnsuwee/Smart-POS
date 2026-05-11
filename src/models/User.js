import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  googleId: { type: String, unique: true, sparse: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, default: '' },
  storeName: { type: String, required: true },
  settings: {
    vatMode: {
      type: String,
      enum: ['none', 'inclusive', 'exclusive'],
      default: 'exclusive'
    }
  },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);

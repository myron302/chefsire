const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  businessName: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['caterer', 'venue', 'photographer', 'dj', 'florist', 'planner'],
    required: true 
  },
  description: String,
  pricing: String,
  images: [String],
  verified: { type: Boolean, default: false },
  featured: { type: Boolean, default: false },
  sponsored: { type: Boolean, default: false },
  subscription: {
    plan: { type: String, enum: ['free', 'professional', 'premium'] },
    expiresAt: Date
  },
  location: {
    city: String,
    state: String,
    serviceRadius: Number
  },
  availability: [{
    date: Date,
    booked: Boolean
  }],
  stats: {
    views: { type: Number, default: 0 },
    leads: { type: Number, default: 0 },
    bookings: { type: Number, default: 0 }
  }
}, { timestamps: true });

const LeadSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  eventDate: Date,
  guestCount: Number,
  budget: String,
  message: String,
  status: { 
    type: String, 
    enum: ['new', 'contacted', 'quoted', 'booked', 'declined'],
    default: 'new'
  },
  quote: {
    amount: Number,
    details: String,
    validUntil: Date
  }
}, { timestamps: true });

module.exports = {
  Vendor: mongoose.model('Vendor', VendorSchema),
  Lead: mongoose.model('Lead', LeadSchema)
};

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  sku: { type: String, sparse: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  imageUrl: { type: String }
}, { timestamps: true });

productSchema.index({ sku: 1 }, { unique: true, sparse: true });
productSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Product', productSchema);

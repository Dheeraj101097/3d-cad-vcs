const mongoose = require('mongoose');

const partSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  thumbnailUrl: { type: String }
}, { timestamps: true });

partSchema.index({ product: 1 });

module.exports = mongoose.model('Part', partSchema);

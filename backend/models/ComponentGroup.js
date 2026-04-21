const mongoose = require('mongoose');

const componentGroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },  // free-form, references ComponentType name
  description: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

componentGroupSchema.index({ type: 1, name: 1 });

module.exports = mongoose.model('ComponentGroup', componentGroupSchema);

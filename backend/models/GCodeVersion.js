const mongoose = require('mongoose');

const gcodeVersionSchema = new mongoose.Schema({
  part:          { type: mongoose.Schema.Types.ObjectId, ref: 'Part', required: true },
  version:       { type: String, required: true },
  versionNumber: { type: Number, required: true },
  originalName:  { type: String, required: true },
  fileType:      { type: String },
  fileSize:      { type: Number },
  notes:         { type: String },
  isLatest:      { type: Boolean, default: true },
  uploadedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // GridFS ObjectIds — file bytes live in MongoDB (cadfiles bucket)
  gridfsId:             { type: mongoose.Schema.Types.ObjectId },  // original uploaded file
  gcodePreviewGridfsId: { type: mongoose.Schema.Types.ObjectId },  // extracted .gcode from .3mf
  meshGridfsId:         { type: mongoose.Schema.Types.ObjectId },  // extracted .model mesh

  // Small PNG thumbnail stored as base64 data URL (extracted from .3mf)
  thumbnailUrl: { type: String },
}, { timestamps: true });

gcodeVersionSchema.index({ part: 1, versionNumber: -1 });
gcodeVersionSchema.index({ part: 1, isLatest: -1 });

module.exports = mongoose.model('GCodeVersion', gcodeVersionSchema);

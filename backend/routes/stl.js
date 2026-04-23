const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const StlVersion = require('../models/StlVersion');
const { uploadBuffer, pipeToResponse, deleteFile } = require('../utils/gridfs');
const { protect, requireActive, requireWrite, requireDelete } = require('../middleware/auth');

// All files received in memory — nothing touches disk
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    ext === '.stl' ? cb(null, true) : cb(new Error('Only .stl files allowed'));
  },
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

router.use(protect, requireActive);

// Get all STL versions for a part
router.get('/part/:partId', async (req, res) => {
  const versions = await StlVersion.find({ part: req.params.partId })
    .select('-__v')
    .populate('uploadedBy', 'name')
    .sort({ versionNumber: -1 })
    .lean();
  res.json(versions);
});

// Upload new STL version — file goes straight to GridFS
router.post('/part/:partId', requireWrite('products'), upload.single('file'), async (req, res) => {
  try {
    const { notes } = req.body;
    const partId = req.params.partId;

    await StlVersion.updateMany({ part: partId }, { isLatest: false });
    const latest = await StlVersion.findOne({ part: partId }).sort({ versionNumber: -1 }).select('versionNumber').lean();
    const versionNumber = (latest?.versionNumber ?? 0) + 1;

    const gridfsId = await uploadBuffer(req.file.buffer, req.file.originalname, 'application/octet-stream');

    const stl = await StlVersion.create({
      part: partId,
      version: `v${versionNumber}.0`,
      versionNumber,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      notes,
      isLatest: true,
      uploadedBy: req.user._id,
      gridfsId,
    });
    res.status(201).json(stl);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Serve STL file for viewer
router.get('/:id/file', async (req, res) => {
  const stl = await StlVersion.findById(req.params.id).select('gridfsId').lean();
  if (!stl) return res.status(404).json({ message: 'Not found' });
  res.setHeader('Content-Type', 'application/octet-stream');
  pipeToResponse(stl.gridfsId, res);
});

// Download — streams exact original file from GridFS
router.get('/:id/download', async (req, res) => {
  const stl = await StlVersion.findById(req.params.id).select('gridfsId originalName').lean();
  if (!stl) return res.status(404).json({ message: 'Not found' });
  res.setHeader('Content-Disposition', `attachment; filename="${stl.originalName}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  pipeToResponse(stl.gridfsId, res);
});

// Delete — removes GridFS file + document
router.delete('/:id', requireDelete('products'), async (req, res) => {
  const stl = await StlVersion.findById(req.params.id).select('gridfsId').lean();
  if (!stl) return res.status(404).json({ message: 'Not found' });
  await deleteFile(stl.gridfsId);
  await StlVersion.deleteOne({ _id: req.params.id });
  res.json({ message: 'Deleted' });
});

module.exports = router;

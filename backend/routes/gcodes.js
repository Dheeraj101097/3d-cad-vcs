const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const AdmZip = require('adm-zip');
const GCodeVersion = require('../models/GCodeVersion');
const Part = require('../models/Part');
const { uploadBuffer, pipeToResponse, downloadToBuffer, deleteFile } = require('../utils/gridfs');
const { protect, requireActive, requireWrite, requireDelete } = require('../middleware/auth');

// All files received in memory — nothing touches disk
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ['.gcode', '.gc', '.mf', '.3mf', '.nc', '.tap', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('File type not allowed'));
  },
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

// Extract gcode buffer and mesh buffer from a .3mf zip (all in memory)
function extractFrom3mf(fileBuffer) {
  const result = { gcodeBuffer: null, meshBuffer: null };
  try {
    const zip = new AdmZip(fileBuffer);
    const entries = zip.getEntries();

    const gcodeEntry =
      entries.find(e => /Metadata\/plate_\d+\.gcode$/i.test(e.entryName)) ||
      entries.find(e => /\.gcode$/i.test(e.entryName));
    if (gcodeEntry) result.gcodeBuffer = gcodeEntry.getData();

    const meshEntry =
      entries.find(e => /3D\/3dmodel\.model$/i.test(e.entryName)) ||
      entries.find(e => /\.model$/i.test(e.entryName));
    if (meshEntry) result.meshBuffer = meshEntry.getData();
  } catch (e) {
    console.error('3mf extraction failed:', e.message);
  }
  return result;
}

// Extract embedded thumbnail from .3mf and return as base64 data URL
function extractThumbnail(fileBuffer) {
  try {
    const zip = new AdmZip(fileBuffer);
    const entries = zip.getEntries();
    const thumb =
      entries.find(e => /thumbnails\/.*\.(png|jpe?g)$/i.test(e.entryName)) ||
      entries.find(e => /metadata\/plate_\d+\.(png|jpe?g)$/i.test(e.entryName)) ||
      entries.find(e => /\.(png|jpe?g)$/i.test(e.entryName));
    if (thumb) return `data:image/png;base64,${thumb.getData().toString('base64')}`;
  } catch (e) {
    console.error('Thumbnail extraction failed:', e.message);
  }
  return null;
}

router.use(protect, requireActive);

// Get all versions for a part
router.get('/part/:partId', async (req, res) => {
  const versions = await GCodeVersion.find({ part: req.params.partId })
    .select('-__v')
    .populate('uploadedBy', 'name')
    .sort({ versionNumber: -1 })
    .lean();
  res.json(versions);
});

// Upload new version — file goes straight to GridFS
router.post('/part/:partId', requireWrite('products'), upload.single('file'), async (req, res) => {
  try {
    const { notes } = req.body;
    const partId = req.params.partId;
    const fileBuffer = req.file.buffer;
    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');

    await GCodeVersion.updateMany({ part: partId }, { isLatest: false });
    const latest = await GCodeVersion.findOne({ part: partId }).sort({ versionNumber: -1 }).select('versionNumber').lean();
    const versionNumber = (latest?.versionNumber ?? 0) + 1;

    // Upload only the original file — no extracted copies stored
    const gridfsId = await uploadBuffer(fileBuffer, req.file.originalname, req.file.mimetype || 'application/octet-stream');

    let thumbnailUrl = null;
    if (ext === '3mf') {
      thumbnailUrl = extractThumbnail(fileBuffer);
      if (thumbnailUrl) {
        await Part.findByIdAndUpdate(partId, { thumbnailUrl });
      }
    }

    const gcode = await GCodeVersion.create({
      part: partId,
      version: `v${versionNumber}.0`,
      versionNumber,
      originalName: req.file.originalname,
      fileType: ext,
      fileSize: req.file.size,
      notes,
      isLatest: true,
      uploadedBy: req.user._id,
      gridfsId,
      // gcodePreviewGridfsId and meshGridfsId intentionally not set — extracted on-the-fly
      thumbnailUrl,
    });

    res.status(201).json(gcode);
  } catch (e) {
    console.error('GCode upload error:', e);
    res.status(400).json({ message: e.message });
  }
});

// Print options — all 3MF versions for print modal
router.get('/print-options', async (req, res) => {
  const versions = await GCodeVersion.find({ fileType: '3mf' })
    .select('version originalName part')
    .populate({ path: 'part', select: 'name product', populate: { path: 'product', select: 'name' } })
    .sort({ createdAt: -1 })
    .lean();
  res.json(versions.map(v => ({
    _id: v._id,
    version: v.version,
    originalName: v.originalName,
    label: `${v.part?.product?.name ?? '?'} › ${v.part?.name ?? '?'} › ${v.version} (${v.originalName})`,
  })));
});

// Serve raw gcode text for the renderer
// New docs: extract on-the-fly from original .3mf
// Old docs: fall back to stored gcodePreviewGridfsId if present
router.get('/:id/content', async (req, res) => {
  try {
    const gcode = await GCodeVersion.findById(req.params.id)
      .select('gcodePreviewGridfsId gridfsId fileType').lean();
    if (!gcode) return res.status(404).json({ message: 'Not found' });

    // Old doc with pre-extracted gcode stored separately — serve directly
    if (gcode.gcodePreviewGridfsId &&
        gcode.gcodePreviewGridfsId.toString() !== gcode.gridfsId?.toString()) {
      const buffer = await downloadToBuffer(gcode.gcodePreviewGridfsId);
      return res.type('text/plain').send(buffer.toString('utf8'));
    }

    if (!gcode.gridfsId) return res.status(404).json({ message: 'No file stored for this version' });
    const fileBuffer = await downloadToBuffer(gcode.gridfsId);

    // .3mf — extract gcode from zip in memory
    if (gcode.fileType === '3mf') {
      const { gcodeBuffer } = extractFrom3mf(fileBuffer);
      if (!gcodeBuffer) return res.status(404).json({ message: 'No gcode found inside .3mf' });
      return res.type('text/plain').send(gcodeBuffer.toString('utf8'));
    }

    // Plain gcode file — serve as-is
    res.type('text/plain').send(fileBuffer.toString('utf8'));
  } catch (e) {
    if (!res.headersSent) res.status(404).json({ message: 'File not found in storage' });
  }
});

// Serve mesh XML for 3D viewer
// New docs: extract on-the-fly from original .3mf
// Old docs: fall back to stored meshGridfsId if present
router.get('/:id/mesh', async (req, res) => {
  try {
    const gcode = await GCodeVersion.findById(req.params.id)
      .select('meshGridfsId gridfsId fileType').lean();
    if (!gcode) return res.status(404).json({ message: 'Not found' });

    // Old doc with pre-extracted mesh stored separately — serve directly
    if (gcode.meshGridfsId) {
      res.setHeader('Content-Type', 'application/xml');
      return pipeToResponse(gcode.meshGridfsId, res);
    }

    // New doc — extract mesh from .3mf on-the-fly
    if (gcode.fileType !== '3mf' || !gcode.gridfsId)
      return res.status(404).json({ message: 'No mesh available' });

    const fileBuffer = await downloadToBuffer(gcode.gridfsId);
    const { meshBuffer } = extractFrom3mf(fileBuffer);
    if (!meshBuffer) return res.status(404).json({ message: 'No mesh found inside .3mf' });
    res.setHeader('Content-Type', 'application/xml');
    res.send(meshBuffer);
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ message: 'Mesh extraction failed' });
  }
});

// Download — streams exact original file from GridFS
router.get('/:id/download', async (req, res) => {
  const gcode = await GCodeVersion.findById(req.params.id).select('gridfsId originalName').lean();
  if (!gcode) return res.status(404).json({ message: 'Not found' });
  res.setHeader('Content-Disposition', `attachment; filename="${gcode.originalName}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  pipeToResponse(gcode.gridfsId, res);
});

// Delete — removes GridFS files + document
// Handles both new docs (gridfsId only) and old docs (may have extra stored IDs)
router.delete('/:id', requireDelete('products'), async (req, res) => {
  const gcode = await GCodeVersion.findById(req.params.id)
    .select('gridfsId gcodePreviewGridfsId meshGridfsId').lean();
  if (!gcode) return res.status(404).json({ message: 'Not found' });

  const ids = new Set();
  if (gcode.gridfsId) ids.add(gcode.gridfsId.toString());
  if (gcode.gcodePreviewGridfsId) ids.add(gcode.gcodePreviewGridfsId.toString());
  if (gcode.meshGridfsId) ids.add(gcode.meshGridfsId.toString());

  await Promise.all([...ids].map(id => deleteFile(id)));
  await GCodeVersion.deleteOne({ _id: req.params.id });
  res.json({ message: 'Deleted' });
});

module.exports = router;

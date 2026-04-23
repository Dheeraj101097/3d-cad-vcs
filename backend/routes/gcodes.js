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

    // Upload original file to GridFS
    const gridfsId = await uploadBuffer(fileBuffer, req.file.originalname, req.file.mimetype || 'application/octet-stream');

    let gcodePreviewGridfsId = gridfsId;
    let meshGridfsId = null;
    let thumbnailUrl = null;

    if (ext === '3mf') {
      const { gcodeBuffer, meshBuffer } = extractFrom3mf(fileBuffer);
      if (gcodeBuffer) {
        gcodePreviewGridfsId = await uploadBuffer(gcodeBuffer, `preview_${Date.now()}.gcode`, 'text/plain');
      }
      if (meshBuffer) {
        meshGridfsId = await uploadBuffer(meshBuffer, `mesh_${Date.now()}.model`, 'application/xml');
      }
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
      gcodePreviewGridfsId,
      meshGridfsId,
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

// Serve raw gcode text for the renderer (uses extracted preview if available)
router.get('/:id/content', async (req, res) => {
  try {
    const gcode = await GCodeVersion.findById(req.params.id).select('gcodePreviewGridfsId gridfsId').lean();
    if (!gcode) return res.status(404).json({ message: 'Not found' });
    const id = gcode.gcodePreviewGridfsId || gcode.gridfsId;
    if (!id) return res.status(404).json({ message: 'No file stored for this version' });
    const buffer = await downloadToBuffer(id);
    res.type('text/plain').send(buffer.toString('utf8'));
  } catch (e) {
    if (!res.headersSent) res.status(404).json({ message: 'File not found in storage' });
  }
});

// Serve mesh XML for 3D viewer
router.get('/:id/mesh', async (req, res) => {
  const gcode = await GCodeVersion.findById(req.params.id).select('meshGridfsId').lean();
  if (!gcode || !gcode.meshGridfsId) return res.status(404).json({ message: 'No mesh available' });
  res.setHeader('Content-Type', 'application/xml');
  pipeToResponse(gcode.meshGridfsId, res);
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
router.delete('/:id', requireDelete('products'), async (req, res) => {
  const gcode = await GCodeVersion.findById(req.params.id)
    .select('gridfsId gcodePreviewGridfsId meshGridfsId').lean();
  if (!gcode) return res.status(404).json({ message: 'Not found' });

  const ids = [gcode.gridfsId];
  if (gcode.gcodePreviewGridfsId?.toString() !== gcode.gridfsId?.toString())
    ids.push(gcode.gcodePreviewGridfsId);
  if (gcode.meshGridfsId) ids.push(gcode.meshGridfsId);

  await Promise.all(ids.map(id => deleteFile(id)));
  await GCodeVersion.deleteOne({ _id: req.params.id });
  res.json({ message: 'Deleted' });
});

module.exports = router;

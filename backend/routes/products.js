const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const Product = require('../models/Product');
const { protect, requireActive, requireWrite, requireDelete } = require('../middleware/auth');

const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Only jpg, jpeg, png allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.use(protect, requireActive);

router.get('/', async (req, res) => {
  const products = await Product.find().select('-__v').populate('createdBy', 'name email').lean();
  res.json(products);
});

router.post('/', requireWrite('products'), imageUpload.single('image'), async (req, res) => {
  try {
    const { name, description, sku } = req.body;
    const imageUrl = req.file
      ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
      : undefined;
    const product = await Product.create({
      name, description,
      sku: sku || undefined,
      imageUrl,
      createdBy: req.user._id
    });
    res.status(201).json(product);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id).select('-__v').populate('createdBy', 'name').lean();
  if (!product) return res.status(404).json({ message: 'Not found' });
  res.json(product);
});

router.put('/:id', requireWrite('products'), async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, lean: true });
  res.json(product);
});

router.delete('/:id', requireDelete('products'), async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;

const router = require('express').Router();
const Part = require('../models/Part');
const { protect, requireActive, requireWrite, requireAdmin } = require('../middleware/auth');

router.use(protect, requireActive);

// Get all parts for a product
router.get('/product/:productId', async (req, res) => {
  const parts = await Part.find({ product: req.params.productId }).select('-__v').populate('createdBy', 'name').lean();
  res.json(parts);
});

router.post('/', requireWrite, async (req, res) => {
  try {
    const part = await Part.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(part);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.get('/:id', async (req, res) => {
  const part = await Part.findById(req.params.id).select('-__v').populate('product', 'name _id sku').populate('createdBy', 'name').lean();
  if (!part) return res.status(404).json({ message: 'Not found' });
  res.json(part);
});

router.put('/:id', requireWrite, async (req, res) => {
  const part = await Part.findByIdAndUpdate(req.params.id, req.body, { new: true, lean: true });
  res.json(part);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await Part.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;

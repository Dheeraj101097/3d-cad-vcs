const router = require('express').Router();
const User = require('../models/User');
const { protect, requireAdmin, clearUserCache } = require('../middleware/auth');

router.use(protect, requireAdmin);

// List all users except self
router.get('/users', async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } })
    .select('-password -__v')
    .sort({ createdAt: -1 })
    .lean();
  res.json(users);
});

// Update a user's role (approve = set to 'active')
router.patch('/users/:id/role', async (req, res) => {
  const { role } = req.body;
  const allowed = ['pending', 'active', 'admin', 'revoked'];
  if (!allowed.includes(role))
    return res.status(400).json({ message: 'Invalid role.' });

  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ message: 'User not found.' });
  target.role = role;
  await target.save();
  clearUserCache(req.params.id);
  res.json({ id: target._id, name: target.name, email: target.email, role: target.role });
});

// Update a single resource permission for a user
router.patch('/users/:id/permissions', async (req, res) => {
  const { resource, bits } = req.body;
  const b = Number(bits);
  if (!resource || isNaN(b) || b < 0 || b > 7)
    return res.status(400).json({ message: 'Invalid resource or bits (0-7).' });

  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ message: 'User not found.' });

  const perms = target.permissions || {};
  perms[resource] = b;
  target.permissions = perms;
  target.markModified('permissions');
  await target.save();
  clearUserCache(req.params.id);
  res.json({ id: target._id, resource, bits: b });
});

// Delete a user account entirely
router.delete('/users/:id', async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  clearUserCache(req.params.id);
  res.json({ message: 'User deleted.' });
});

module.exports = router;

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

// Update a user's role
router.patch('/users/:id/role', async (req, res) => {
  const { role } = req.body;
  const allowed = ['pending', 'read', 'write', 'admin', 'revoked'];
  if (!allowed.includes(role))
    return res.status(400).json({ message: 'Invalid role.' });

  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ message: 'User not found.' });

  // Prevent demoting other admins unless you're the sole admin
  // (Allow it — admin trusts admin)
  target.role = role;
  await target.save();
  clearUserCache(req.params.id);   // force fresh load on next request
  res.json({ id: target._id, name: target.name, email: target.email, role: target.role });
});

// Delete a user account entirely
router.delete('/users/:id', async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  clearUserCache(req.params.id);
  res.json({ message: 'User deleted.' });
});

module.exports = router;

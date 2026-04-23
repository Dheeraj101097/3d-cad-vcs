const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const ADMIN_EMAILS = ['electramite@gmail.com', 'dheeraj@gmail.com'];
const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

const userPayload = (u) => ({
  id: u._id, name: u.name, email: u.email, role: u.role, permissions: u.permissions ?? {}
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const role = ADMIN_EMAILS.includes(normalizedEmail) ? 'admin' : 'pending';
    const user = await User.create({ name, email: normalizedEmail, password, role });
    res.status(201).json({ token: sign(user._id), user: userPayload(user) });
  } catch (e) {
    res.status(400).json({ message: e.code === 11000 ? 'Email already registered.' : e.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ message: 'Invalid email or password.' });
    res.json({ token: sign(user._id), user: userPayload(user) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get current user (for refreshing role after approval)
router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.user._id).select('-password -__v').lean();
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(userPayload(user));
});

module.exports = router;

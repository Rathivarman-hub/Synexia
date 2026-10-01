import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';
import { deleteCache } from '../utils/cache.js';

// @desc    Register student
// @route   POST /api/auth/register
// @access  Public
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, college, rollNumber } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Please provide name, email and password');
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User with this email already exists');
  }

  const user = await User.create({ name, email, password, college, rollNumber });

  res.status(201).json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      college: user.college,
      rollNumber: user.rollNumber,
      avatar: user.avatar,
      token: generateToken(user._id),
    },
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Please provide email and password');
  }

  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  res.json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      college: user.college,
      rollNumber: user.rollNumber,
      avatar: user.avatar,
      token: generateToken(user._id),
    },
  });
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res) => {
  // req.user is already populated & cached by the protect middleware
  const user = await User.findById(req.user._id).select('-password');
  res.json({ success: true, data: user });
});

// @desc    Update profile
// @route   PUT /api/auth/me
// @access  Private
export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const { name, college, rollNumber, password, avatar } = req.body;

  if (name) user.name = name;
  if (college) user.college = college;
  if (rollNumber) user.rollNumber = rollNumber;
  if (password) user.password = password;

  if (avatar !== undefined) {
    // WHY: Storing raw base64 in MongoDB creates giant documents (up to 2MB each).
    // This bloats the collection, slows down queries that return user documents,
    // and wastes egress bandwidth. Accept URL strings only (use Cloudinary/S3).
    // Legacy base64 values already in the DB are preserved as-is.
    if (avatar && avatar.startsWith('data:image/')) {
      res.status(400);
      throw new Error(
        'Direct image upload is not supported. Please upload to Cloudinary first, then provide the URL. ' +
        'See SCALABILITY.md for setup instructions.'
      );
    }
    user.avatar = avatar;
  }

  const updated = await user.save();

  // Invalidate the Redis cache for this user so next request gets fresh data
  await deleteCache(`user:${req.user._id}`);

  res.json({
    success: true,
    data: {
      _id: updated._id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      college: updated.college,
      rollNumber: updated.rollNumber,
      avatar: updated.avatar,
    },
  });
});

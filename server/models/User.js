import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    college: { type: String, default: '' },
    rollNumber: { type: String, default: '' },
    avatar: { type: String, default: '' },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ─── Indexes ──────────────────────────────────────────────────────────────────
// WHY: email already has unique:true which auto-creates an index. ✅
// Adding role+createdAt for paginated student listings in admin panel.

// Used in: getStudents (role: 'student', sorted by createdAt)
userSchema.index({ role: 1, createdAt: -1 });

// Full-text search for admin student search (name, email, college)
userSchema.index({ name: 'text', email: 'text', college: 'text' });

export default mongoose.model('User', userSchema);

import React, { useRef, useState } from 'react';
import { Container, Row, Col, Form } from 'react-bootstrap';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', college: user?.college || '', rollNumber: user?.rollNumber || '', password: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [avatar, setAvatar] = useState(user?.avatar || '');

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Please choose an image smaller than 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const size = 512;
        const scale = Math.min(1, size / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const compressedAvatar = canvas.toDataURL('image/jpeg', 0.82);
        localStorage.setItem('techiz-avatar', compressedAvatar);
        setAvatar(compressedAvatar);
      };
      image.onerror = () => toast.error('Could not read this image');
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (form.password && form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    try {
      const payload = { name: form.name, college: form.college, rollNumber: form.rollNumber, avatar };
      if (form.password) payload.password = form.password;
      const { data } = await api.put('/auth/me', payload);
      updateUser({ ...data.data, avatar: data.data.avatar || avatar });
      toast.success('Profile updated successfully');
      setForm((f) => ({ ...f, password: '', confirmPassword: '' }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="page-wrapper">
      <Container>
        {/* Profile header */}
        <div className="techiz-card fade-in mb-4" style={{ padding: '32px', background: 'linear-gradient(135deg,rgba(108,99,255,0.1),rgba(0,212,170,0.1))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#6c63ff,#00d4aa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 800, color: '#fff', overflow: 'hidden' }}>
                {avatar ? <img src={avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user?.name?.charAt(0).toUpperCase()}
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="profile-avatar-button" title="Upload profile photo">Edit</button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} hidden />
            </div>
            <div>
              <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{user?.name}</h3>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{user?.email}</div>
              {user?.college && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{user?.college} {user?.rollNumber && `· Roll: ${user?.rollNumber}`}</div>}
            </div>
          </div>
        </div>

        <div className="techiz-card fade-in" style={{ padding: '32px' }}>
            <h5 style={{ fontWeight: 700, marginBottom: 24, color: 'var(--text-primary)' }}>Edit Profile</h5>
            <Form onSubmit={handleSave}>
              <Row className="g-3">
                {[['name', 'Full Name', 'text'], ['college', 'College Name', 'text'], ['rollNumber', 'Roll Number', 'text'], ['password', 'New Password (optional)', 'password'], ['confirmPassword', 'Confirm New Password', 'password']].map(([field, label, type]) => (
                  <Col key={field} md={field === 'name' ? 12 : 6}>
                    <label className="techiz-label">{label}</label>
                    <input type={type} className="techiz-input" value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} placeholder={label} />
                  </Col>
                ))}
              </Row>
              <button type="submit" className="btn-techiz mt-4" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </Form>
          </div>
      </Container>
    </div>
  );
};

export default ProfilePage;

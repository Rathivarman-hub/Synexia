import React, { useRef, useState } from 'react';
import { Container, Row, Col, Form } from 'react-bootstrap';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { FiSave, FiSettings } from 'react-icons/fi';

const SettingsPage = () => {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', password: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const fileInputRef = useRef(null);

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
      const payload = { name: form.name, avatar };
      if (form.password) payload.password = form.password;
      const { data } = await api.put('/auth/me', payload);
      updateUser({ ...data.data, avatar: data.data.avatar || avatar });
      setAvatar(data.data.avatar || avatar);
      toast.success('Settings saved');
      setForm((f) => ({ ...f, password: '', confirmPassword: '' }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="page-wrapper admin-page">
      <Container fluid style={{ maxWidth: 700 }}>
        <div className="admin-header fade-in">
          <div>
            <div className="admin-eyebrow"><FiSettings /> Account</div>
            <h2 className="admin-title">Settings</h2>
            <p className="admin-subtitle">Manage your administrator account</p>
          </div>
        </div>

        <div className="techiz-card fade-in" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#6c63ff,#00d4aa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: '#fff', fontWeight: 800, overflow: 'hidden' }}>
                {avatar ? <img src={avatar} alt="Admin profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user?.name?.charAt(0).toUpperCase()}
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="profile-avatar-button" title="Upload profile photo">Edit</button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} hidden />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.1rem' }}>{user?.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{user?.email}</div>
              <span style={{ fontSize: '0.7rem', padding: '2px 10px', borderRadius: 12, background: 'rgba(108,99,255,0.15)', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>Admin</span>
            </div>
          </div>

          <Form onSubmit={handleSave}>
            <Row className="g-3">
              <Col xs={12}>
                <label className="techiz-label">Display Name</label>
                <input className="techiz-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Col>
              <Col xs={12}>
                <label className="techiz-label">Email Address</label>
                <input className="techiz-input" value={user?.email} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
              </Col>
              <Col md={6}>
                <label className="techiz-label">New Password (optional)</label>
                <input type="password" className="techiz-input" placeholder="Leave blank to keep current" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </Col>
              <Col md={6}>
                <label className="techiz-label">Confirm New Password</label>
                <input type="password" className="techiz-input" placeholder="Repeat new password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
              </Col>
            </Row>
            <button type="submit" className="btn-techiz mt-4" disabled={saving}>
              <FiSave /> {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </Form>
        </div>
      </Container>
    </div>
  );
};

export default SettingsPage;

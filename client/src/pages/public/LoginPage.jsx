import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Form, Alert } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import logo from '../../assets/1logo.png';

const LoginPage = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name?.split(' ')[0]}!`);
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', paddingTop: 40, paddingBottom: 40 }}>
      <Container>
        <Row className="justify-content-center">
          <Col md={10} lg={8} xl={6}>
            <div className="techiz-card fade-in" style={{ padding: '48px 40px' }}>
              {/* Header */}
              <div className="text-center mb-4">
                <img src={logo} alt="Techiz" style={{ width: 72, height: 56, objectFit: 'contain', marginBottom: 12 }} />
                <h2 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>Welcome Back</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Sign in to your SYNEXIA account</p>
              </div>

              {error && <Alert variant="danger" style={{ borderRadius: 10, border: 'none', background: 'rgba(239,71,111,0.1)', color: 'var(--danger)' }}>{error}</Alert>}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <label className="techiz-label">Email Address</label>
                  <input
                    type="email"
                    className="techiz-input"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-4">
                  <label className="techiz-label">Password</label>
                  <input
                    type="password"
                    className="techiz-input"
                    placeholder="Your password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                </Form.Group>
                <button type="submit" className="btn-techiz w-100" style={{ justifyContent: 'center', fontSize: '1rem', padding: '14px' }} disabled={loading}>
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>
              </Form>

              <div className="text-center mt-4" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Don't have an account?{' '}
                <Link to="/register" style={{
                  color: '#ff6ad4',
                  fontWeight: 800,
                  textDecoration: 'none',
                  fontSize: '1.02rem',
                  letterSpacing: '0.01em',
                }}>Register here</Link>
              </div>

            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default LoginPage;

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Form, Alert } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import logo from '../../assets/1logo.png';

const RegisterPage = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', college: '', rollNumber: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const user = await register({ name: form.name, email: form.email, password: form.password, college: form.college, rollNumber: form.rollNumber });
      toast.success(`Account created! Welcome to SYNEXIA, ${user.name?.split(' ')[0]}!`);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { name: 'name', label: 'Full Name', type: 'text', placeholder: 'John Doe', required: true },
    { name: 'email', label: 'Email Address', type: 'email', placeholder: 'you@college.edu', required: true },
    { name: 'college', label: 'College Name', type: 'text', placeholder: 'Anna University, Chennai' },
    { name: 'rollNumber', label: 'Roll Number', type: 'text', placeholder: '20CS001' },
    { name: 'password', label: 'Password', type: 'password', placeholder: 'Min 6 characters', required: true },
    { name: 'confirmPassword', label: 'Confirm Password', type: 'password', placeholder: 'Repeat password', required: true },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', paddingTop: 40, paddingBottom: 40 }}>
      <Container>
        <Row className="justify-content-center">
          <Col md={10} lg={8} xl={7}>
            <div className="techiz-card fade-in" style={{ padding: '48px 40px' }}>
              <div className="text-center mb-4">
                <img src={logo} alt="Techiz" style={{ width: 72, height: 56, objectFit: 'contain', marginBottom: 12 }} />
                <h2 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>Create Account</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Join SYNEXIA and start your assessment journey</p>
              </div>

              {error && <Alert variant="danger" style={{ borderRadius: 10, border: 'none', background: 'rgba(239,71,111,0.1)', color: 'var(--danger)' }}>{error}</Alert>}

              <Form onSubmit={handleSubmit}>
                <Row className="g-3">
                  {fields.map((f) => (
                    <Col key={f.name} md={f.name === 'name' || f.name === 'email' ? 12 : 6}>
                      <Form.Group>
                        <label className="techiz-label">{f.label} {f.required && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                        <input
                          type={f.type}
                          name={f.name}
                          className="techiz-input"
                          placeholder={f.placeholder}
                          value={form[f.name]}
                          onChange={handleChange}
                          required={f.required}
                        />
                      </Form.Group>
                    </Col>
                  ))}
                </Row>

                <button type="submit" className="btn-techiz w-100 mt-4" style={{ justifyContent: 'center', fontSize: '1rem', padding: '14px' }} disabled={loading}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </Form>

              <div className="text-center mt-4" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Already have an account?{' '}
                <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default RegisterPage;

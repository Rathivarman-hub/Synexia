import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col } from 'react-bootstrap';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { FiBarChart2, FiCheckCircle, FiCode, FiPieChart, FiSettings, FiTrendingUp, FiUser, FiUsers } from 'react-icons/fi';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement);

// WHY hex literals and not `var(--primary)`: Chart.js paints to a <canvas>, and
// canvas fillStyle does not resolve CSS custom properties. These are the SYNEXIA
// brand values from the theme tokens, duplicated here because canvas needs a
// concrete colour.
const BRAND = { primary: '#D1007A', secondary: '#7C3AED', success: '#10B981', warning: '#F59E0B', danger: '#EF4444' };

// WHY the official language colours are kept: these are DATA series, not chrome.
// Seven greys would make the language doughnut unreadable, and a student
// scanning for "the C++ slice" expects the language's own hue.
const langColors = {
  python: '#3776ab',
  javascript: '#f7df1e',
  java: '#f89820',
  c: '#a8b9cc',
  cpp: '#00599c',
  csharp: '#68217A',
  go: '#00ADD8',
};
const LANGUAGE_LABELS = {
  python: 'Python',
  javascript: 'JavaScript',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  csharp: '.NET',
  go: 'Go',
};
const colorFor = (key) => langColors[key] || BRAND.secondary;

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [langStats, setLangStats] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [s, l, t] = await Promise.all([
          api.get('/admin/stats'),
          api.get('/admin/language-stats'),
          api.get('/admin/trends'),
        ]);
        setStats(s.data.data);
        setLangStats(l.data.data);
        setTrends(t.data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load admin dashboard data.');
      } finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  if (loading) return <Spinner text="Loading dashboard..." />;

  // WHY "Acceptance Rate" and not the old "Pass Rate": there is no single graded
  // paper per student in a coding judge, so the honest analogue is the share of
  // SUBMISSIONS the judge accepted. See adminController.getStats.
  const statCards = [
    { icon: <FiUsers />, label: 'Students', value: stats?.totalStudents || 0, color: BRAND.secondary },
    { icon: <FiUser />, label: 'Active Students', value: stats?.activeStudents || 0, color: BRAND.primary },
    { icon: <FiCode />, label: 'Problems', value: stats?.activeProblems ?? 0, hint: `${stats?.totalProblems || 0} total`, color: BRAND.warning },
    { icon: <FiBarChart2 />, label: 'Submissions', value: stats?.totalSubmissions || 0, color: BRAND.success },
    { icon: <FiCheckCircle />, label: 'Acceptance Rate', value: `${stats?.acceptanceRate ?? 0}%`, color: BRAND.danger },
  ];

  const doughnutData = {
    labels: langStats.map((l) => LANGUAGE_LABELS[l.language] || l.language),
    datasets: [{
      data: langStats.map((l) => l.submissions),
      backgroundColor: langStats.map((l) => colorFor(l.language)),
      borderWidth: 2,
      borderColor: 'var(--bg-card)',
    }],
  };

  // WHY successRate and not an average of `accuracy`: `accuracy` is the fraction
  // of ONE attempt's test cases that passed, so averaging it measures partial
  // progress, not "how often does a submission fully pass".
  const barData = {
    labels: langStats.map((l) => LANGUAGE_LABELS[l.language] || l.language),
    datasets: [{
      label: 'Acceptance %',
      data: langStats.map((l) => Math.round(l.successRate || 0)),
      backgroundColor: langStats.map((l) => `${colorFor(l.language)}cc`),
      borderRadius: 8,
    }],
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const trendData = {
    labels: trends.map((t) => `${monthNames[t._id.month - 1]} ${t._id.year}`),
    datasets: [{
      label: 'Submissions',
      data: trends.map((t) => t.submissions),
      backgroundColor: `${BRAND.primary}b3`,
      borderRadius: 8,
    }],
  };

  const chartOptions = {
    responsive: true,
    plugins: { legend: { labels: { color: '#888' } } },
    scales: {
      x: { ticks: { color: '#888' }, grid: { color: 'rgba(128,128,128,0.15)' } },
      y: { ticks: { color: '#888' }, grid: { color: 'rgba(128,128,128,0.15)' } }
    },
  };

  return (
    <div className="page-wrapper admin-page">
      <Container fluid>
        <div className="admin-header fade-in">
          <div>
            <div className="admin-eyebrow">Administration</div>
            <h2 className="admin-title">Dashboard</h2>
            <p className="admin-subtitle">Coding platform overview and performance metrics</p>
          </div>
        </div>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <div className="admin-stat-grid">
          {statCards.map((s, i) => (
              <div key={i} className="stat-card admin-stat fade-in" style={{ cursor: 'default' }}>
                <span className="stat-icon">{s.icon}</span>
                <div className="stat-number" style={{ color: s.color, WebkitTextFillColor: s.color, fontSize: '2rem' }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
                {s.hint && <div className="stat-hint">{s.hint}</div>}
              </div>
          ))}
        </div>

        <Row className="g-3 mb-4">
          {[
            { icon: <FiUsers />, label: 'View Students', to: '/admin/students' },
            { icon: <FiSettings />, label: 'Settings', to: '/admin/settings' },
          ].map((item) => (
            <Col key={item.to} xs={6} md={3}>
              <Link to={item.to} style={{ textDecoration: 'none' }}>
                <div className="techiz-card fade-in" style={{ padding: '20px', textAlign: 'center' }}>
                  <div style={{ color: 'var(--primary)', fontSize: '1.5rem', marginBottom: 8 }}>{item.icon}</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{item.label}</div>
                </div>
              </Link>
            </Col>
          ))}
        </Row>

        <Row className="g-4">
          <Col md={6} lg={4}>
            <div className="techiz-card admin-chart-card p-4 fade-in">
              <h6 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}><FiPieChart /> Submissions by Language</h6>
              {langStats.length > 0 ? <Doughnut data={doughnutData} options={chartOptions} /> : <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No submissions yet</p>}
            </div>
          </Col>
          <Col md={6} lg={4}>
            <div className="techiz-card admin-chart-card p-4 fade-in">
              <h6 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}><FiBarChart2 /> Acceptance by Language</h6>
              {langStats.length > 0 ? <Bar data={barData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} /> : <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No submissions yet</p>}
            </div>
          </Col>
          <Col md={12} lg={4}>
            <div className="techiz-card admin-chart-card p-4 fade-in">
              <h6 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}><FiTrendingUp /> Monthly Submissions</h6>
              {trends.length > 0 ? <Bar data={trendData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} /> : <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No submissions yet</p>}
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default AdminDashboard;

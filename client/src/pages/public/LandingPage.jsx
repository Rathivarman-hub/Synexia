import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Container, Row, Col } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import LanguageLogo from '../../components/LanguageLogo';
import { FiAward, FiCheckCircle, FiCode, FiCpu, FiMoon, FiMonitor, FiShield, FiTarget, FiTerminal, FiTrendingUp, FiZap } from 'react-icons/fi';

const features = [
  { icon: <FiCode />, title: 'Real Code, Real Judge', desc: 'Write a full solution and have it graded against test cases — not a multiple-choice guess.' },
  { icon: <FiCpu />, title: 'Hidden Test Cases', desc: 'Every problem ships public samples for practice and hidden cases for the verdict.' },
  { icon: <FiTrendingUp />, title: 'Live Leaderboard', desc: 'Climb the rankings by solving problems, with rank recalculated on every accepted submission.' },

  { icon: <FiTerminal />, title: 'Run Before You Submit', desc: 'Check your approach on the sample cases, then submit for the full graded run.' },
  { icon: <FiMonitor />, title: 'Editor That Remembers', desc: 'Monaco with per-language syntax highlighting, and your draft is kept if you navigate away.' },
  { icon: <FiMoon />, title: 'Dark Mode', desc: 'Easy on the eyes — choose your preferred theme anytime.' },
];

// WHY seven here: this list is the marketing face of the same 7 languages the
// judge actually executes. A landing page that advertised 5 would be a lie about
// the product, and the old list was exactly that lie for the MCQ module.
const languages = [
  { key: 'python', name: 'Python', color: '#3776ab', desc: 'Scripting & AI' },
  { key: 'java', name: 'Java', color: '#f89820', desc: 'OOP & Enterprise' },
  { key: 'javascript', name: 'JavaScript', color: '#f7df1e', desc: 'Web & Full-Stack' },
  { key: 'c', name: 'C', color: '#a8b9cc', desc: 'Systems & Embedded' },
  { key: 'cpp', name: 'C++', color: '#00599c', desc: 'OOP & Performance' },
  { key: 'csharp', name: '.NET', color: '#68217A', desc: 'Enterprise & Desktop' },
  { key: 'go', name: 'Go', color: '#00ADD8', desc: 'Cloud & Concurrency' },
];

const LandingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const revealRefs = useRef([]);

  useEffect(() => {
    if (user) navigate(user.role === 'admin' ? '/admin' : '/dashboard');
  }, [user]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    revealRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const addReveal = (el) => { if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el); };

  return (
    <>
      {/* ——— HERO ——— */}
      <section className="hero-section">
        {/* Particles */}
        <div className="particles">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${Math.random() * 100}%`,
              animationDuration: `${8 + Math.random() * 12}s`,
              animationDelay: `${-Math.random() * 15}s`,
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
                background: i % 2 === 0 ? 'rgba(209,0,122,0.7)' : 'rgba(124,58,237,0.7)',

            }} />
          ))}
        </div>

        <Container style={{ position: 'relative', zIndex: 1 }}>
          <Row className="align-items-center g-5">
            <Col lg={6} className="fade-in">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <span style={{ background: 'rgba(209,0,122,0.2)', border: '1px solid rgba(209,0,122,0.4)', borderRadius: 20, padding: '4px 16px', fontSize: '0.8rem', color: '#ff66c4', fontWeight: 600, letterSpacing: 1 }}>
                  <FiZap /> ONLINE JUDGE &amp; PRACTICE PLATFORM
                </span>
              </div>
              <h1 className="hero-title">
                Write Code.<br />
                <span className="gradient-text">Get Judged.</span><br />
                Climb the Ranks
              </h1>
              <p className="hero-subtitle" style={{ marginTop: 20, marginBottom: 36 }}>
                SYNEXIA is a coding practice platform for building and proving programming skills. Submit real solutions in 7 languages, get graded against hidden test cases, and climb the leaderboard.
              </p>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <Link to="/register" className="btn-techiz" style={{ fontSize: '1rem', padding: '14px 32px' }}>
                  <FiTarget /> Start Practising
                </Link>
                <Link to="/leaderboard" className="btn-outline-techiz" style={{ fontSize: '1rem', padding: '14px 32px', borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}>
                  <FiAward /> View Leaderboard
                </Link>
              </div>
              {/* Stats row */}
              <div style={{ display: 'flex', gap: 32, marginTop: 48, flexWrap: 'wrap' }}>
                {[['8', 'Problems'], ['63', 'Test cases'], ['7', 'Languages'], ['100%', 'Free']].map(([n, l]) => (
                  <div key={l}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>{n}</div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>{l}</div>
                  </div>
                ))}
              </div>
            </Col>

            {/* Floating cards — sample verdicts, the way a student actually meets
                a problem: language, problem, and what the judge said. */}
            <Col lg={6} className="d-none d-lg-flex flex-column gap-3">
              {[
                { key: 'python', lang: 'Python', q: 'Sum of Odd Numbers', type: 'Accepted', score: '7/7 cases', ok: true },
                { key: 'cpp', lang: 'C++', q: 'Reverse an Integer', type: 'Wrong answer', score: '5/8 cases', ok: false },
                { key: 'go', lang: 'Go', q: 'Count Vowels', type: 'Accepted', score: '8/8 cases', ok: true },
              ].map((card, i) => (
                <div key={i} className="floating-card glass-card" style={{ padding: '20px 24px', maxWidth: 380, marginLeft: i % 2 === 0 ? 'auto' : 60 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#fff' }}><LanguageLogo language={card.key} size="sm" style={{ '--language-color': '#fff' }} /> {card.lang}</span>
                    <span style={{ fontSize: '0.75rem', background: card.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', padding: '2px 10px', borderRadius: 10, color: card.ok ? '#34d399' : '#f87171' }}>{card.type}</span>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', margin: 0 }}>{card.q}</p>
                  <div style={{ marginTop: 10, color: card.ok ? '#34d399' : '#f87171', fontWeight: 700, fontSize: '0.9rem' }}><FiCheckCircle /> {card.score}</div>
                </div>
              ))}
            </Col>
          </Row>
        </Container>
      </section>

      {/* ——— FEATURES ——— */}
      <section style={{ padding: '80px 0', background: 'var(--bg-primary)' }}>
        <Container>
          <div ref={addReveal} className="reveal text-center mb-5">
            <h2 className="section-title">Why Choose <span className="gradient-text">SYNEXIA?</span></h2>
            <div className="divider" />
            <p className="section-subtitle mt-3">Everything you need to get comfortable before the technical interview.</p>
          </div>
          <Row className="g-4">
            {features.map((f, i) => (
              <Col key={i} md={6} lg={4}>
                <div ref={addReveal} className="reveal techiz-card" style={{ padding: '28px', animationDelay: `${i * 0.1}s` }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>{f.icon}</div>
                  <h5 style={{ fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>{f.title}</h5>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>{f.desc}</p>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* ——— LANGUAGES ——— */}
      <section style={{ padding: '80px 0', background: 'var(--bg-secondary)' }}>
        <Container>
          <div ref={addReveal} className="reveal text-center mb-5">
            <h2 className="section-title">7 Programming <span className="gradient-text">Languages</span></h2>
            <div className="divider" />
            <p className="section-subtitle mt-3">Pick a language and solve problems in it — the judge compiles and runs every one of these.</p>
          </div>
          <Row className="g-4 justify-content-center">
            {languages.map((lang, i) => (
              <Col key={i} xs={6} sm={4} md={3} lg={2}>
                <Link to="/register" style={{ textDecoration: 'none' }}>
                  <div ref={addReveal} className="reveal lang-card">
                    <LanguageLogo language={lang.key} size="lg" style={{ '--language-color': lang.color }} />
                    <div className="lang-name">{lang.name}</div>
                    <div className="lang-badge">{lang.desc}</div>
                  </div>
                </Link>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* ——— CTA ——— */}
      <section style={{ padding: '80px 0', background: 'var(--gradient-primary)' }}>
        <Container className="text-center">
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: 16 }}>Ready to Get Started?</h2>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.1rem', marginBottom: 32 }}>Join learners already building and ranking on SYNEXIA.</p>
          <Link to="/register" className="btn-techiz" style={{ background: '#fff', color: '#002366', fontSize: '1.1rem', padding: '14px 36px' }}>
            Create Free Account
          </Link>
        </Container>
      </section>

      {/* ——— FOOTER ——— */}
      <footer className="techiz-footer">
        <Container>
          <Row className="g-4 mb-4">
            <Col md={4}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 12 }}>SYNEXIA</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Online judge and practice platform for building practical coding skills.</p>
            </Col>
            <Col md={2}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>Platform</div>
              {[['Home', '/'], ['Practice', '/coding/problems'], ['Leaderboard', '/leaderboard']].map(([l, h]) => (
                <div key={l}><Link to={h} style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem', display: 'block', marginBottom: 6 }}>{l}</Link></div>
              ))}
            </Col>
            <Col md={2}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>Languages</div>
              {['Python', 'Java', 'JavaScript', 'C', 'C++', '.NET', 'Go'].map((l) => (
                <div key={l} style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 6 }}>{l}</div>
              ))}
            </Col>
            <Col md={4}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>Get Started</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link to="/register" className="btn-techiz" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>Register</Link>
                <Link to="/login" className="btn-outline-techiz" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>Login</Link>
              </div>
            </Col>
          </Row>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            © {new Date().getFullYear()} SYNEXIA. Built for people who build with code.
          </div>
        </Container>
      </footer>
    </>
  );
};

export default LandingPage;

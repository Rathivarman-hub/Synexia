import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import {
  FiArrowRight, FiBookOpen, FiCheckCircle,
  FiClock, FiCode, FiFileText, FiFlag, FiLock, FiShield, FiUsers,
} from 'react-icons/fi';
import { FaUniversity, FaUserCircle } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import './StudentDashboard.css';

const languages = ['Java', 'Python', 'JavaScript', 'C', 'C++', 'C#', 'Go'];

const assessmentSteps = [
  { label: 'Login', icon: FiUsers },
  { label: 'Start Assessment', icon: FiFlag },
  { label: 'Fullscreen Activated', icon: FiLock },
  { label: 'Solve Problems', icon: FiCode },
  { label: 'Submit Assessment', icon: FiFileText },
  { label: 'Results Recorded', icon: FiCheckCircle },
];

const statusFromAssessment = (data) => {
  if (data?.submitted) {
    return ['warning-limit', 'time-limit'].includes(data.submission?.reason)
      ? 'Auto Submitted'
      : 'Submitted';
  }
  return data?.session ? 'In Progress' : 'Not Started';
};

const StudentDashboard = () => {
  const { user } = useAuth();
  const [assessmentStatus, setAssessmentStatus] = useState('Not Started');
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/coding/assessment/me')
      .then(({ data }) => {
        if (!cancelled) setAssessmentStatus(statusFromAssessment(data.data));
      })
      .catch((error) => {
        if (!cancelled) setStatusError(error.response?.data?.message || 'Assessment status could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const isAssessmentSubmitted = ['Submitted', 'Auto Submitted'].includes(assessmentStatus);
  const assessmentLink = '/coding/problems';
  const firstName = user?.name?.split(' ')[0] || 'Student';
  const stats = [
    { label: 'Total Questions', value: '8', icon: FiBookOpen },
    { label: 'Assessment Duration', value: '90 Minutes', icon: FiClock },
    { label: 'Supported Languages', value: '7', icon: FiCode },
    { label: 'Maximum Warnings', value: '3', icon: FiShield },
  ];
  const guidelines = [
    'Total Duration: 90 Minutes',
    'Full Screen Mode Required',
    'Maximum 3 Warnings Allowed',
    'Auto Submission on Warning Limit',
    'Switching Tabs Increases Warning Count',
    'Assessment Cannot Be Retaken',
    'Only One Final Submission Allowed',
  ];

  return (
    <div className="page-wrapper student-dashboard">
      <Container fluid="xl">
        <section className="dash-welcome dash-glass-card" aria-labelledby="dash-welcome-title">
          <div className="dash-welcome-copy">
            <span className="dash-eyebrow"><FiCode /> SYNEXIA CODING ASSESSMENT</span>
            <h1 id="dash-welcome-title">
              <FaUserCircle aria-hidden="true" /> Welcome back, {firstName}!
            </h1>
            <p className="dash-welcome-details">
              {user?.college && <><FaUniversity aria-hidden="true" /> {user.college}</>}
              {user?.rollNumber && <span className="dash-roll-number">Roll: {user.rollNumber}</span>}
            </p>
            <div className="dash-status-line" aria-live="polite">
              <span className={`dash-status-dot dash-status-dot--${assessmentStatus.toLowerCase().replace(' ', '-')}`} />
              <strong>Assessment Status:</strong>
              <span>{statusLoading ? 'Loading…' : assessmentStatus}</span>
            </div>
            {statusError && <p className="dash-inline-error" role="alert">{statusError}</p>}
          </div>
          <div className="dash-welcome-actions">
            <Link
              to={assessmentLink}
              className={`btn-techiz dash-primary-action${isAssessmentSubmitted ? ' is-disabled' : ''}`}
              aria-disabled={isAssessmentSubmitted}
              onClick={(event) => { if (isAssessmentSubmitted) event.preventDefault(); }}
            >
              {isAssessmentSubmitted ? 'Assessment Submitted' : assessmentStatus === 'In Progress' ? 'Continue Assessment' : 'Start Coding Assessment'}
              <FiArrowRight aria-hidden="true" />
            </Link>
            <Link to="/profile" className="dash-quiet-link">View Profile</Link>
          </div>
          <div className="dash-hero-orb dash-hero-orb--one" aria-hidden="true" />
          <div className="dash-hero-orb dash-hero-orb--two" aria-hidden="true" />
        </section>

        <section className="dash-section" aria-labelledby="dash-overview-title">
          <div className="dash-section-heading">
            <div>
              <span className="dash-eyebrow">YOUR ASSESSMENT AT A GLANCE</span>
              <h2 id="dash-overview-title">Assessment Overview</h2>
            </div>
          </div>
          <div className="dash-stat-grid">
            {stats.map(({ label, value, icon: Icon }, index) => (
              <article className={`dash-stat-card dash-glass-card dash-stat-card--${index + 1}`} key={label}>
                <span className="dash-stat-icon"><Icon aria-hidden="true" /></span>
                <div>
                  <p>{label}</p>
                  <strong>{value}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="dash-main-grid">
          <section className="dash-panel dash-glass-card" id="assessment-guidelines" aria-labelledby="dash-guidelines-title">
            <div className="dash-panel-heading">
              <span className="dash-panel-icon"><FiShield /></span>
              <div>
                <span className="dash-eyebrow">BEFORE YOU BEGIN</span>
                <h2 id="dash-guidelines-title">Assessment Guidelines</h2>
              </div>
            </div>
            <ul className="dash-guidelines">
              {guidelines.map((guideline) => (
                <li key={guideline}><FiCheckCircle aria-hidden="true" /> {guideline}</li>
              ))}
            </ul>
          </section>

          <section className="dash-panel dash-glass-card" aria-labelledby="dash-flow-title">
            <div className="dash-panel-heading">
              <span className="dash-panel-icon dash-panel-icon--pink"><FiArrowRight /></span>
              <div>
                <span className="dash-eyebrow">SIMPLE, SECURE, TRANSPARENT</span>
                <h2 id="dash-flow-title">Assessment Flow</h2>
              </div>
            </div>
            <ol className="dash-flow">
              {assessmentSteps.map(({ label, icon: Icon }, index) => (
                <li key={label} className={index === 0 ? 'is-complete' : ''}>
                  <span className="dash-flow-icon"><Icon aria-hidden="true" /></span>
                  <span>{label}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section className="dash-bottom-grid">
          <div className="dash-panel dash-glass-card" aria-labelledby="dash-languages-title">
            <div className="dash-panel-heading">
              <span className="dash-panel-icon"><FiCode /></span>
              <div>
                <span className="dash-eyebrow">CHOOSE YOUR COMFORTABLE TOOL</span>
                <h2 id="dash-languages-title">Supported Languages</h2>
              </div>
            </div>
            <div className="dash-language-chips">
              {languages.map((language) => <span key={language}>{language}</span>)}
            </div>
          </div>
        </section>
      </Container>
    </div>
  );
};

export default StudentDashboard;

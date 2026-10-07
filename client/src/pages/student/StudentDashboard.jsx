import { Link } from 'react-router-dom';
import { Container, Row, Col } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { FaArrowRight, FaUniversity, FaUserCircle } from 'react-icons/fa';
import { FiCode } from 'react-icons/fi';
import './StudentDashboard.css';

const StudentDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="page-wrapper">
      <Container>
        {/* Welcome banner */}
        <div className="techiz-card fade-in mb-4" style={{ padding: '32px', background: 'linear-gradient(135deg,rgba(108,99,255,0.1),rgba(0,212,170,0.1))' }}>
          <Row className="align-items-center">
            <Col>
              <h2 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                <FaUserCircle className="welcome-icon" aria-hidden="true" /> Welcome back, {user?.name?.split(' ')[0]}!
              </h2>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                {user?.college && <><FaUniversity className="welcome-detail-icon" aria-hidden="true" /> {user.college}</>} {user?.rollNumber && `· Roll: ${user.rollNumber}`}
              </p>
            </Col>
            <Col xs="auto">
              <Link to="/debugging/problems" className="btn-techiz">Start Coding Assessment <FaArrowRight aria-hidden="true" /></Link>
            </Col>
          </Row>
        </div>

        <Row className="mb-4">
          <Col md={12}>
            <div className="techiz-card dash-coding-card">
              <div className="dash-coding-head">
                <div>
                  <h3 className="dash-coding-title"><FiCode aria-hidden="true" /> Coding Assessment</h3>
                  <p className="dash-coding-subtitle">
                    Solve coding problems and earn points across seven supported languages.
                  </p>
                </div>
                <Link to="/debugging/problems" className="btn-techiz btn-techiz--sm">
                  Browse coding questions <FaArrowRight aria-hidden="true" />
                </Link>
              </div>
            </div>
          </Col>
        </Row>

      </Container>
    </div>
  );
};

export default StudentDashboard;

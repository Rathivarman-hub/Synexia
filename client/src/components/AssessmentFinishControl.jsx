import React, { useState } from 'react';
import { FiAlertTriangle, FiClock, FiUploadCloud } from 'react-icons/fi';
import { useAssessmentSession } from '../context/AssessmentSessionContext';

const formatAssessmentTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`;
};

const AssessmentFinishControl = () => {
  const {
    endAssessment,
    remainingSeconds,
    assessmentSubmitting,
    assessmentSubmitError,
  } = useAssessmentSession();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className="assessment-session-controls">
        <div className={`assessment-countdown${remainingSeconds <= 300 ? ' is-urgent' : ''}`}>
          <span className="assessment-countdown-label"><FiClock /> Assessment Time Remaining</span>
          <span className="assessment-countdown-value" role="timer" aria-label={`${formatAssessmentTime(remainingSeconds)} remaining`}>
            {formatAssessmentTime(remainingSeconds)}
          </span>
        </div>
        <button
          type="button"
          className="assessment-finish-button"
          onClick={() => setConfirming(true)}
          disabled={assessmentSubmitting}
        >
          <FiUploadCloud /> {assessmentSubmitting ? 'Submitting…' : 'Submit Assessment'}
        </button>
      </div>

      {assessmentSubmitError && <div className="assessment-submit-error" role="alert">{assessmentSubmitError}</div>}

      {confirming && (
        <div
          className="assessment-finish-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirming(false);
          }}
        >
          <section
            className="assessment-finish-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="assessment-finish-title"
            aria-describedby="assessment-finish-description"
          >
            <div className="assessment-finish-mark" aria-hidden="true"><FiAlertTriangle /></div>
            <h2 id="assessment-finish-title">Submit and end assessment?</h2>
            <p id="assessment-finish-description">
              This grades and locks all 8 saved answers in one final submission. Any
              question you have not opened will be submitted with an empty answer.
            </p>
            <div className="assessment-finish-actions">
              <button
                type="button"
                className="assessment-finish-cancel"
                onClick={() => setConfirming(false)}
                disabled={assessmentSubmitting}
              >
                Keep working
              </button>
              <button
                type="button"
                className="assessment-finish-confirm"
                onClick={() => {
                  setConfirming(false);
                  void endAssessment('manual-submit');
                }}
                disabled={assessmentSubmitting}
              >
                {assessmentSubmitting ? 'Submitting…' : 'Submit Assessment'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
};

export default AssessmentFinishControl;

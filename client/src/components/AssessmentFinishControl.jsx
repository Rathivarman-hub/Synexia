import React, { useState } from 'react';
import { FiAlertTriangle, FiClock, FiUploadCloud } from 'react-icons/fi';
import { useAssessmentSession } from '../context/AssessmentSessionContext';
import { formatElapsed } from '../hooks/useElapsedTimer';

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
        <span
          className={`assessment-countdown${remainingSeconds <= 300 ? ' is-urgent' : ''}`}
          role="timer"
          aria-label={`${formatElapsed(remainingSeconds * 1000)} remaining`}
        >
          <FiClock /> {formatElapsed(remainingSeconds * 1000)} left
        </span>
        <button
          type="button"
          className="assessment-finish-button"
          onClick={() => setConfirming(true)}
          disabled={assessmentSubmitting}
        >
          <FiUploadCloud /> {assessmentSubmitting ? 'Submitting…' : 'Submit assessment'}
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
                {assessmentSubmitting ? 'Submitting…' : 'Submit assessment'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
};

export default AssessmentFinishControl;

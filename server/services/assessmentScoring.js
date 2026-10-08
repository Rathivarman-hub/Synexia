export const isAcceptedEvaluation = ({ status, passedTests, totalTests, accepted }) =>
  status === 'accepted'
  && accepted === true
  && Number.isInteger(passedTests)
  && Number.isInteger(totalTests)
  && totalTests > 0
  && passedTests === totalTests;

export const calculateAwardedPoints = (evaluation, maxPoints) =>
  isAcceptedEvaluation(evaluation) ? maxPoints : 0;

export const resolveAssessmentAnswer = ({
  answer,
  evaluation,
  maxPoints,
  questionTestCount,
  boilerplate,
}) => {
  const code = answer?.code || '';
  const language = answer?.language;
  const matchesLatestEvaluation = Boolean(evaluation)
    && evaluation.language === language
    && evaluation.code === code;
  const totalTests = matchesLatestEvaluation
    ? evaluation.totalTests
    : questionTestCount;
  const passedTests = matchesLatestEvaluation ? evaluation.passedTests : 0;
  const status = matchesLatestEvaluation
    ? evaluation.status
    : !code.trim() || boilerplate
      ? 'not-attempted'
      : 'not-evaluated';
  const accepted = matchesLatestEvaluation && isAcceptedEvaluation({
    status: evaluation.status,
    passedTests: evaluation.passedTests,
    totalTests: evaluation.totalTests,
    accepted: evaluation.accepted,
  });
  const awardedPoints = calculateAwardedPoints({
    status,
    passedTests,
    totalTests,
    accepted,
  }, maxPoints);

  return {
    status,
    accepted: Boolean(accepted),
    passedTests,
    totalTests,
    awardedPoints,
    failedTests: Math.max(0, totalTests - passedTests),
    accuracy: totalTests > 0 ? Math.round((passedTests / totalTests) * 1000) / 10 : 0,
  };
};

export const normalizeAssessmentSubmissionScore = (submission) => {
  const answers = (submission.answers || []).map((answer) => {
    const passedTests = answer.passedTests ?? answer.passedCases ?? 0;
    const totalTests = answer.totalTests ?? answer.totalCases ?? 0;
    const legacyAccepted = answer.accepted === undefined
      && answer.status === 'accepted'
      && totalTests > 0
      && passedTests === totalTests;
    const accepted = isAcceptedEvaluation({
      status: answer.status,
      passedTests,
      totalTests,
      accepted: answer.accepted === true || legacyAccepted,
    });
    const awardedPoints = calculateAwardedPoints({
      status: answer.status,
      passedTests,
      totalTests,
      accepted,
    }, answer.maxScore || 0);

    return {
      ...answer,
      accepted,
      passedTests,
      totalTests,
      awardedPoints,
      passedCases: passedTests,
      totalCases: totalTests,
      score: awardedPoints,
    };
  });

  const score = answers.reduce((sum, answer) => sum + answer.awardedPoints, 0);
  return {
    ...submission,
    answers,
    score,
  };
};

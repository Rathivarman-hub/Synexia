export const normalizeQuestionIdentity = (text) => String(text || '')
  .trim()
  .split(/\n\s*\n(?=(?:Constraints:|Input format:|Output format:|Examples:))/i, 1)[0]
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase();

export const countUniqueQuestions = (codingQuestions, debuggingQuestions) => {
  const questions = new Map();
  const addQuestion = (question, source) => {
    const identity = normalizeQuestionIdentity(source === 'coding' ? question.statement : question.description);
    const key = identity || `${source}:${question._id || question.slug}`;
    questions.set(key, Boolean(question.isActive) || questions.get(key) === true);
  };

  codingQuestions.forEach((question) => addQuestion(question, 'coding'));
  debuggingQuestions.forEach((question) => addQuestion(question, 'debugging'));

  const activeProblems = [...questions.values()].filter(Boolean).length;
  const totalProblems = questions.size;

  return {
    totalProblems,
    activeProblems,
    inactiveProblems: totalProblems - activeProblems,
  };
};

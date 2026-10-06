const EXPECTED_MISSING_RETURN = /error:\s*missing return statement/;

export const isExpectedIncompleteJavaStarter = (language, source, diagnostics) => {
  const diagnosticErrors = diagnostics.match(/error:/g) || [];
  return language === 'java' &&
    source.includes('Missing Line') &&
    diagnosticErrors.length === 1 &&
    EXPECTED_MISSING_RETURN.test(diagnostics);
};

export const normalizeStarterCode = (source) => String(source ?? '').replace(/\s+/g, '');

export const isStarterCode = (current, original) =>
  normalizeStarterCode(current) === normalizeStarterCode(original);

export const getChangedCodeLength = (current, original) => {
  const currentCode = normalizeStarterCode(current);
  const originalCode = normalizeStarterCode(original);
  let prefix = 0;
  let suffix = 0;

  while (
    prefix < currentCode.length &&
    prefix < originalCode.length &&
    currentCode[prefix] === originalCode[prefix]
  ) {
    prefix += 1;
  }

  while (
    suffix < currentCode.length - prefix &&
    suffix < originalCode.length - prefix &&
    currentCode[currentCode.length - 1 - suffix] === originalCode[originalCode.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return currentCode.length - prefix - suffix;
};
import { getStarterTemplate, LANGUAGE_KEYS } from '../config/languages.js';

const GENERIC_STARTER_CODE = Object.fromEntries(
  LANGUAGE_KEYS.map((language) => [language, getStarterTemplate(language)])
);


const sumOfOddNumbers = {
  title: 'Sum of Odd Numbers in an Array',
  difficulty: 'easy',
  points: 5,
  category: 'arrays',
  tags: ['array', 'loop', 'math'],
  statement: `Given an array of integers, find the sum of all odd numbers present in the array.`,
  constraints: [
    '1 <= N <= 10^5',
    '-10^5 <= arr[i] <= 10^5',
  ],
  inputFormat: 'The first line contains an integer N. The second line contains N space-separated integers.',
  outputFormat: 'Print the sum of all odd numbers in the array. Print 0 if there are no odd numbers.',
  examples: [
    { input: '5\n1 2 3 4 5', output: '9', explanation: 'The odd values are 1, 3, and 5.' },
    { input: '4\n2 4 6 8', output: '0', explanation: 'There are no odd values.' },
    { input: '6\n11 7 4 9 2 5', output: '32', explanation: '11 + 7 + 9 + 5 = 32.' },
  ],
  hints: [
    'A single pass is enough — you do not need a second traversal.',
    'In Python, `x % 2 != 0` also works for negative numbers.',
  ],
  starterCode: GENERIC_STARTER_CODE,
  testCases: [
    { input: '5\n1 2 3 4 5', expectedOutput: '9', hidden: false },
    { input: '4\n2 4 6 8', expectedOutput: '0', hidden: false },
    { input: '6\n11 7 4 9 2 5', expectedOutput: '32', hidden: false },
    { input: '1\n7', expectedOutput: '7', hidden: true },
    { input: '6\n2 4 6 8 10 12', expectedOutput: '0', hidden: true },
    { input: '3\n-2 -4 -6', expectedOutput: '0', hidden: true },
    { input: '8\n100 3 200 5 6 7 8 9', expectedOutput: '24', hidden: true },
    { input: '2\n-1 1', expectedOutput: '0', hidden: true },
  ],
  order: 1,
};

const findMissingNumber = {
  title: 'Find Missing Number in an Array',
  difficulty: 'easy',
  points: 7,
  category: 'arrays',
  tags: ['array', 'math', 'search'],
  statement: `You are given numbers from 1 to N with exactly one number missing. Find and print the missing number.`,
  constraints: [
    '2 <= N <= 10^5',
    'Every provided value is distinct and lies in [1, N]',
    'Exactly one value from 1..N is absent',
  ],
  inputFormat: 'The first line contains an integer N. The second line contains N-1 space-separated integers from 1 to N.',
  outputFormat: 'Print the single missing integer.',
  examples: [
    { input: '5\n1 2 4 5', output: '3', explanation: '3 is the only number missing from 1..5.' },
    { input: '6\n2 3 4 5 6', output: '1', explanation: '1 is missing from 1..6.' },
    { input: '7\n1 2 3 4 5 7', output: '6', explanation: '6 is missing from 1..7.' },
  ],
  hints: [
    'The sum of 1..N is N(N+1)/2. Subtracting the sum of the provided values leaves the missing value.',
    'Alternatively, XOR every number in 1..N together with every provided value.',
  ],
  starterCode: GENERIC_STARTER_CODE,
  testCases: [
    { input: '5\n1 2 4 5', expectedOutput: '3', hidden: false },
    { input: '6\n2 3 4 5 6', expectedOutput: '1', hidden: false },
    { input: '7\n1 2 3 4 5 7', expectedOutput: '6', hidden: false },
    { input: '2\n2', expectedOutput: '1', hidden: true },
    { input: '2\n1', expectedOutput: '2', hidden: true },
    { input: '4\n4 1 2', expectedOutput: '3', hidden: true },
    { input: '5\n5 4 3 2', expectedOutput: '1', hidden: true },
    { input: '6\n6 5 4 2 1', expectedOutput: '3', hidden: true },
  ],
  order: 2,
};

// ─────────────────────────────────────────────────────────────────────────────
// 3 · Reverse an Integer
// ─────────────────────────────────────────────────────────────────────────────
const reverseAnInteger = {
  title: 'Reverse Integer',
  slug: 'reverse-an-integer',
  difficulty: 'medium',
  points: 10,
  category: 'math',
  tags: ['math', 'digits'],
  statement: `Given a non-negative integer N, reverse its digits and print the resulting integer. Leading zeros in the reversed result are omitted.`,
  constraints: [
    '0 <= N <= 2^31 - 1',
  ],
  inputFormat: 'A single integer N.',
  outputFormat: 'Print N with its digits in reverse order.',
  examples: [
    { input: '1234', output: '4321', explanation: 'The digits 1, 2, 3, 4 become 4, 3, 2, 1.' },
    { input: '500', output: '5', explanation: 'Leading zeros in the reversed number are omitted.' },
    { input: '98765', output: '56789', explanation: 'The digits are printed in reverse order.' },
  ],
  hints: [
    'Extract digits with modulo 10 and build the reversed number with result * 10 + digit.',
    'Use a 64-bit integer type for the reversed value when needed.',
  ],
  starterCode: GENERIC_STARTER_CODE,
  testCases: [
    { input: '1234', expectedOutput: '4321', hidden: false },
    { input: '500', expectedOutput: '5', hidden: false },
    { input: '98765', expectedOutput: '56789', hidden: false },
    { input: '0', expectedOutput: '0', hidden: true },
    { input: '7', expectedOutput: '7', hidden: true },
    { input: '1000', expectedOutput: '1', hidden: true },
    { input: '120', expectedOutput: '21', hidden: true },
  ],
  order: 3,
};

// ─────────────────────────────────────────────────────────────────────────────
// 4 · Check Palindrome Number
// ─────────────────────────────────────────────────────────────────────────────
const checkPalindromeNumber = {
  title: 'Check Palindrome Number',
  difficulty: 'medium',
  points: 12,
  category: 'math',
  tags: ['math', 'two-pointers', 'strings'],
  statement: 'Determine whether a given integer is a palindrome. Print Palindrome if it reads the same forwards and backwards; otherwise print Not Palindrome.',
  constraints: [
    '0 <= N <= 2^31 - 1',
  ],
  inputFormat: 'A single integer N.',
  outputFormat: 'Print Palindrome or Not Palindrome.',
  examples: [
    { input: '121', output: 'Palindrome', explanation: '121 reads the same forwards and backwards.' },
    { input: '123', output: 'Not Palindrome', explanation: '123 reversed is 321.' },
    { input: '1221', output: 'Palindrome', explanation: '1221 reads the same in both directions.' },
  ],
  hints: [
    'Reversing the number and comparing is O(1) extra space.',
    'The simplest correct check: reverse, then compare — but mind the 32-bit overflow case.',
  ],
  starterCode: GENERIC_STARTER_CODE,
  testCases: [
    { input: '121', expectedOutput: 'Palindrome', hidden: false },
    { input: '123', expectedOutput: 'Not Palindrome', hidden: false },
    { input: '1221', expectedOutput: 'Palindrome', hidden: false },
    { input: '0', expectedOutput: 'Palindrome', hidden: true },
    { input: '7', expectedOutput: 'Palindrome', hidden: true },
    { input: '1001', expectedOutput: 'Palindrome', hidden: true },
    { input: '10', expectedOutput: 'Not Palindrome', hidden: true },
  ],
  order: 4,
};

// ─────────────────────────────────────────────────────────────────────────────
// 5 · Search Element in Array
// ─────────────────────────────────────────────────────────────────────────────
const searchElementInArray = {
  title: 'Search Element in Array',
  difficulty: 'medium',
  points: 15,
  category: 'arrays',
  tags: ['array', 'search', 'linear-search'],
  statement: `Given an array and a target element X, determine whether X exists in the array.`,
  constraints: [
    '0 <= n <= 100,000',
    '-10^9 <= nums[i] <= 10^9',
    'k is a single integer',
    'n may be 0 — then the answer is always Not Found',
  ],
  inputFormat: 'The first line contains n. The second line contains n space-separated integers. The third line contains the single integer k to search for.',
  outputFormat: 'Print "Found" if k occurs in the array, otherwise print "Not Found".',
  examples: [
    { input: '5\n10 20 30 40 50\n30', output: 'Found', explanation: '30 is present in the array.' },
    { input: '4\n1 2 3 4\n8', output: 'Not Found', explanation: '8 is not present in the array.' },
    { input: '6\n5 7 9 11 13 15\n11', output: 'Found', explanation: '11 is present in the array.' },
  ],
  hints: [
    'Stop as soon as you find a match — you do not need to count occurrences.',
    'Watch the empty-array case: the loop body simply never runs.',
  ],
  starterCode: GENERIC_STARTER_CODE,
  testCases: [
    { input: '5\n10 20 30 40 50\n30', expectedOutput: 'Found', hidden: false },
    { input: '4\n1 2 3 4\n8', expectedOutput: 'Not Found', hidden: false },
    { input: '6\n5 7 9 11 13 15\n11', expectedOutput: 'Found', hidden: false },
    { input: '1\n42\n42', expectedOutput: 'Found', hidden: true },
    { input: '0\n\n7', expectedOutput: 'Not Found', hidden: true },
    { input: '4\n-3 -1 -7 -9\n-7', expectedOutput: 'Found', hidden: true },
    { input: '3\n8 9 10\n8', expectedOutput: 'Found', hidden: true },
    { input: '3\n8 9 10\n11', expectedOutput: 'Not Found', hidden: true },
  ],
  order: 5,
};

// ─────────────────────────────────────────────────────────────────────────────
// 6 · Find Second Largest Distinct Element
// ─────────────────────────────────────────────────────────────────────────────
const secondLargestDistinct = {
    title: 'Find Second Largest Distinct Element',
    slug: 'find-second-largest-distinct-element-without-sorting',
    difficulty: 'hard',
    points: 16,
  category: 'arrays',
  tags: ['array', 'one-pass', 'no-sorting'],
  statement: `Write a program that finds the second largest distinct value in an array of integers. Do not sort the array. If the array has fewer than two distinct values, print -1.`,
  constraints: [
    '1 <= n <= 100,000',
    '-10^9 <= nums[i] <= 10^9',
    'n may be 1, in which case the answer is -1',
    'Sorting the array is explicitly disallowed',
  ],
  inputFormat: 'The first line contains n. The second line contains n space-separated integers.',
  outputFormat: 'Print the second largest distinct value, or -1 if it does not exist.',
  examples: [
    { input: '5\n10 20 30 40 50', output: '40', explanation: '40 is the second largest distinct value.' },
    { input: '6\n5 5 10 10 20 20', output: '10', explanation: 'After removing duplicates, 10 is second largest.' },
    { input: '4\n100 90 80 70', output: '90', explanation: '90 is the second largest distinct value.' },
  ],
  hints: [
    'Keep two variables: the largest seen so far and the second largest seen so far.',
    'Update them in the right order, and remember that a duplicate of the maximum must be ignored.',
  ],
  starterCode: GENERIC_STARTER_CODE,
  testCases: [
    { input: '5\n10 20 30 40 50', expectedOutput: '40', hidden: false },
    { input: '6\n5 5 10 10 20 20', expectedOutput: '10', hidden: false },
    { input: '4\n100 90 80 70', expectedOutput: '90', hidden: false },
    { input: '1\n99', expectedOutput: '-1', hidden: true },
    { input: '4\n-1 -2 -3 -4', expectedOutput: '-2', hidden: true },
    { input: '6\n1 1 1 1 1 1', expectedOutput: '-1', hidden: true },
    { input: '7\n5 5 5 4 4 3 100', expectedOutput: '5', hidden: true },
    { input: '3\n0 0 1', expectedOutput: '0', hidden: true },
  ],
  order: 6,
};

// ─────────────────────────────────────────────────────────────────────────────
// 7 · Count Vowels in a String
// ─────────────────────────────────────────────────────────────────────────────
const countVowels = {
    title: 'Count Vowels in String',
    slug: 'count-vowels-in-a-string',
    difficulty: 'hard',
    points: 17,
  category: 'strings',
  tags: ['string', 'character-classification', 'unicode'],
  statement: `Write a program that counts how many vowels appear in a line of text. The vowels are a, e, i, o, and u. Both uppercase and lowercase forms count.`,
  constraints: [
    '0 <= length of the line <= 100,000',
    'Only ASCII letters a-z and A-Z are considered for vowel matching',
  ],
  inputFormat: 'A single line of text (it may be empty or contain spaces).',
  outputFormat: 'Print one integer: the number of vowels in the line.',
  examples: [
    { input: 'hello', output: '2', explanation: 'The vowels are e and o.' },
    { input: 'programming', output: '3', explanation: 'The vowels are o, a, and i.' },
    { input: 'aeiou', output: '5', explanation: 'All five characters are vowels.' },
  ],
  hints: [
    'Normalise the case first, then check membership against the vowel set.',
    'Remember to read the entire line, not just the first whitespace-delimited token.',
  ],
  starterCode: GENERIC_STARTER_CODE,
  testCases: [
    { input: 'hello', expectedOutput: '2', hidden: false },
    { input: 'programming', expectedOutput: '3', hidden: false },
    { input: 'aeiou', expectedOutput: '5', hidden: false },
    { input: '', expectedOutput: '0', hidden: true },
    { input: 'AEIOUaeiou', expectedOutput: '10', hidden: true },
    { input: 'xyz', expectedOutput: '0', hidden: true },
    { input: 'The quick brown fox jumps over the lazy dog', expectedOutput: '11', hidden: true },
    { input: '   ', expectedOutput: '0', hidden: true },
    { input: 'BANANA', expectedOutput: '3', hidden: true },
    { input: 'SYNEXIA', expectedOutput: '3', hidden: true },
  ],
  order: 7,
};

// ─────────────────────────────────────────────────────────────────────────────
// 8 · Move All Zeros to the End of an Array
// ─────────────────────────────────────────────────────────────────────────────
const moveZerosToEnd = {
    title: 'Move All Zeros To End',
    slug: 'move-all-zeros-to-the-end-of-an-array',
    difficulty: 'hard',
    points: 18,
  category: 'arrays',
  tags: ['array', 'two-pointers', 'in-place', 'stability'],
  statement: `Write a program that moves every 0 in an array to the end while preserving the relative order of the non-zero elements. Print the resulting array.`,
  constraints: [
    '0 <= n <= 100,000',
    '-10^9 <= nums[i] <= 10^9',
    'The result must be stable',
    'O(n) time and O(1) extra space',
  ],
  inputFormat: 'The first line contains n. The second line contains n space-separated integers.',
  outputFormat: 'Print the n resulting integers separated by a single space, with the zeros at the end.',
  examples: [
    { input: '6\n1 0 2 0 3 4', output: '1 2 3 4 0 0', explanation: 'Non-zero values keep their original order.' },
    { input: '5\n0 0 1 2 3', output: '1 2 3 0 0', explanation: 'Zeros move after all non-zero values.' },
    { input: '5\n1 2 3 4 5', output: '1 2 3 4 5', explanation: 'There are no zeros to move.' },
  ],
  hints: [
    'Track a write index. Every non-zero value you meet gets written forward, leaving a gap of zeros behind it.',
    'Writing to the SAME array is what makes the space complexity O(1).',
  ],
  starterCode: GENERIC_STARTER_CODE,
  testCases: [
    { input: '6\n1 0 2 0 3 4', expectedOutput: '1 2 3 4 0 0', hidden: false },
    { input: '5\n0 0 1 2 3', expectedOutput: '1 2 3 0 0', hidden: false },
    { input: '5\n1 2 3 4 5', expectedOutput: '1 2 3 4 5', hidden: false },
    { input: '0\n0', expectedOutput: '', hidden: true },
    { input: '3\n1 2 3', expectedOutput: '1 2 3', hidden: true },
    { input: '6\n0 -1 0 -2 0 -3', expectedOutput: '-1 -2 -3 0 0 0', hidden: true },
    { input: '5\n5 0 4 0 3', expectedOutput: '5 4 3 0 0', hidden: true },
    { input: '7\n0 0 1 0 0 2 3', expectedOutput: '1 2 3 0 0 0 0', hidden: true },
  ],
  order: 8,
};

const PROBLEMS = [
  sumOfOddNumbers,
  findMissingNumber,
  reverseAnInteger,
  checkPalindromeNumber,
  searchElementInArray,
  secondLargestDistinct,
  countVowels,
  moveZerosToEnd,
];
export default PROBLEMS;
export { PROBLEMS };

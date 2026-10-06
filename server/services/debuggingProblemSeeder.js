import DebuggingProblem from '../models/DebuggingProblem.js';
import PROBLEMS from '../seedData/codingProblems.js';
import { getStarterTemplate, LANGUAGE_KEYS } from '../config/languages.js';
import { deleteCachePattern } from '../utils/cache.js';
import logger from '../config/logger.js';

const LEVELS = [
  { difficulty: 'easy', points: 5 },
  { difficulty: 'easy', points: 7 },
  { difficulty: 'easy-medium', points: 10 },
  { difficulty: 'medium', points: 12 },
  { difficulty: 'medium', points: 15 },
  { difficulty: 'medium-hard', points: 16 },
  { difficulty: 'hard', points: 17 },
  { difficulty: 'complex', points: 18 },
];

const MISSING_LINE_ANSWERS = [
  {
    python: 'if num % 2 != 0: total += num',
    java: 'if (num % 2 != 0) total += num;',
    javascript: 'if (num % 2 !== 0) total += num;',
    c: 'if (num % 2 != 0) total += num;',
    cpp: 'if (num % 2 != 0) total += num;',
    csharp: 'if (num % 2 != 0) total += num;',
    go: 'if num%2 != 0 { total += num }',
  },
  {
    python: 'print(total - current_sum)',
    java: 'System.out.println(total - currentSum);',
    javascript: 'console.log(total - currentSum);',
    c: 'printf("%lld\\n", total - currentSum);',
    cpp: "cout << (total - currentSum) << '\\n';",
    csharp: 'Console.WriteLine(total - currentSum);',
    go: 'fmt.Println(total - currentSum)',
  },
  {
    python: 'reversed_value = reversed_value * 10 + digit',
    java: 'reversed = reversed * 10 + digit;',
    javascript: 'reversed = reversed * 10 + digit;',
    c: 'reversed = reversed * 10 + digit;',
    cpp: 'reversed = reversed * 10 + digit;',
    csharp: 'reversed = reversed * 10 + digit;',
    go: 'reversed = reversed*10 + digit',
  },
  {
    python: 'return original == reversed_num',
    java: 'return original == reversed;',
    javascript: 'return original === reversed;',
    c: 'return original == reversed;',
    cpp: 'return original == reversed;',
    csharp: 'return original == reversed;',
    go: 'return original == reversed',
  },
  {
    python: 'return True',
    java: 'return true;',
    javascript: 'return true;',
    c: 'return 1;',
    cpp: 'return true;',
    csharp: 'return true;',
    go: 'return true',
  },
  {
    python: 'return second if second is not None else -1',
    java: 'return second == null ? -1 : second;',
    javascript: 'return second === null ? -1 : second;',
    c: 'return second == -2147483648 ? -1 : second;',
    cpp: 'return second == -2147483648 ? -1 : second;',
    csharp: 'return second == int.MinValue ? -1 : second;',
    go: 'if second == -2147483648 { return -1 }\n\treturn second',
  },
  {
    python: 'return count',
    java: 'return count;',
    javascript: 'return count;',
    c: 'return count;',
    cpp: 'return count;',
    csharp: 'return count;',
    go: 'return count',
  },
  {
    python: 'arr[write] = 0',
    java: 'arr[write++] = 0;',
    javascript: 'arr[write] = 0;',
    c: 'arr[write++] = 0;',
    cpp: 'arr[write++] = 0;',
    csharp: 'arr[write++] = 0;',
    go: 'arr[write] = 0',
  },
];

const replaceMissingLine = (source, answer) =>
  source.replace(/^([ \t]*)(?:#|\/\/) Missing Line[ \t]*$/m, (_match, indent) => `${indent}${answer}`);

const matchingBrace = (source, openIndex) => {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
};

const stripEntryPoint = (source, language) => {
  const entryPatterns = {
    python: /\n(?=def solve\s*\()/,
    javascript: /\n(?=function solve\s*\()/,
    java: /\n(?=    public static void main\s*\()/,
    c: /\n(?=int main\s*\()/,
    cpp: /\n(?=int main\s*\()/,
    csharp: /\n(?=    static void Main\s*\()/,
    go: /\n(?=func main\s*\()/,
  };
  const match = entryPatterns[language]?.exec(source);
  if (!match) return source;
  const entryStart = match.index + 1;
  if (language === 'python' || language === 'javascript') return source.slice(0, entryStart);
  const openIndex = source.indexOf('{', entryStart);
  const closeIndex = matchingBrace(source, openIndex);
  return closeIndex < 0 ? source : `${source.slice(0, entryStart)}${source.slice(closeIndex + 1)}`.trimEnd();
};

const replaceFunctionBody = (source, language, names) => {
  if (language === 'python') {
    const start = source.search(new RegExp(`^def (?:${names.join('|')})\\s*\\(`, 'm'));
    if (start < 0) return source;
    const end = source.indexOf('\n', source.indexOf(':', start)) + 1;
    const nextTopLevel = source.slice(end).search(/^(?:def |if __name__)/m);
    const bodyEnd = nextTopLevel < 0 ? source.length : end + nextTopLevel;
    const bodyIndent = source.slice(end).match(/^[ \t]*/)?.[0] || '    ';
    return `${source.slice(0, end)}${bodyIndent}# Implement the algorithm\n${source.slice(bodyEnd)}`;
  }

  const namePattern = new RegExp(`\\b(?:${names.join('|')})\\s*\\(`);
  const nameMatch = namePattern.exec(source);
  if (!nameMatch) return source;
  const openIndex = source.indexOf('{', nameMatch.index);
  const closeIndex = matchingBrace(source, openIndex);
  if (openIndex < 0 || closeIndex < 0) return source;
  const indent = source.slice(0, openIndex).match(/(?:^|\n)([ \t]*)[^\n]*$/)?.[1] || '';
  return `${source.slice(0, openIndex + 1)}\n${indent}    // Implement the algorithm\n${indent}${source.slice(closeIndex)}`;
};

const replaceEmptyMainBody = (source, language, body) => {
  const signatures = {
    java: 'public static void main(String[] args) {',
    csharp: 'public static void Main() {',
  };
  const signature = signatures[language];
  if (!signature) return source;
  const start = source.indexOf(signature);
  if (start < 0) return source;
  const openIndex = source.indexOf('{', start);
  const closeIndex = matchingBrace(source, openIndex);
  if (closeIndex < 0) return source;
  return `${source.slice(0, openIndex + 1)}\n${body}\n    }${source.slice(closeIndex + 1)}`;
};

const makeRunnableSolution = (source, level, language) => {
  if (level < 6) return source;

  if (level === 6 && ['java', 'csharp'].includes(language)) {
    const body = language === 'java'
      ? `        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextInt()) return;\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for (int i = 0; i < n; i++) arr[i] = sc.nextInt();\n        System.out.println(secondLargest(arr));`
      : `        var data = Console.In.ReadToEnd().Split(new[] { ' ', '\\n', '\\r', '\\t' }, StringSplitOptions.RemoveEmptyEntries);\n        if (data.Length == 0) return;\n        int n = int.Parse(data[0]);\n        var arr = new int[n];\n        for (int i = 0; i < n; i++) arr[i] = int.Parse(data[i + 1]);\n        Console.WriteLine(SecondLargest(arr));`;
    const runnable = replaceEmptyMainBody(source, language, body);
    return language === 'java' ? `import java.io.*;\nimport java.util.*;\n${runnable}` : `using System;\n${runnable}`;
  }
  if (level === 7 && ['java', 'csharp'].includes(language)) {
    const body = language === 'java'
      ? `        Scanner sc = new Scanner(System.in);\n        String line = sc.hasNextLine() ? sc.nextLine() : \"\";\n        System.out.println(countVowels(line));`
      : `        string line = Console.ReadLine() ?? \"\";\n        Console.WriteLine(CountVowels(line));`;
    const runnable = replaceEmptyMainBody(source, language, body);
    return language === 'java' ? `import java.io.*;\nimport java.util.*;\n${runnable}` : `using System;\n${runnable}`;
  }
  if (level === 8 && ['java', 'csharp'].includes(language)) {
    const body = language === 'java'
      ? `        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextInt()) return;\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for (int i = 0; i < n; i++) arr[i] = sc.nextInt();\n        moveZeros(arr);\n        for (int i = 0; i < n; i++) System.out.print((i == 0 ? \"\" : \" \") + arr[i]);\n        System.out.println();`
      : `        var data = Console.In.ReadToEnd().Split(new[] { ' ', '\\n', '\\r', '\\t' }, StringSplitOptions.RemoveEmptyEntries);\n        if (data.Length == 0) return;\n        int n = int.Parse(data[0]);\n        var arr = new int[n];\n        for (int i = 0; i < n; i++) arr[i] = int.Parse(data[i + 1]);\n        MoveZeros(arr);\n        Console.WriteLine(string.Join(\" \", arr));`;
    const runnable = replaceEmptyMainBody(source, language, body);
    return language === 'java' ? `import java.util.*;\n${runnable}` : `using System;\n${runnable}`;
  }

  const drivers = {
    6: {
      python: "\nimport sys\n_data = list(map(int, sys.stdin.read().split()))\nif _data:\n    print(second_largest(_data[1:1 + _data[0]]))\n",
      javascript: "\nconst _d = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nif (_d.length && !Number.isNaN(_d[0])) console.log(secondLargest(_d.slice(1, 1 + _d[0])));\n",
      c: "\n#include <stdio.h>\n#include <stdlib.h>\nint main(void) { int n; if (scanf(\"%d\", &n) != 1) return 0; int *a = malloc(sizeof(int) * (n > 0 ? n : 1)); for (int i = 0; i < n; i++) scanf(\"%d\", &a[i]); printf(\"%d\\n\", secondLargest(a, n)); free(a); return 0; }\n",
      cpp: "\n#include <iostream>\nint main() { int n; if (!(std::cin >> n)) return 0; std::vector<int> a(n); for (int &v : a) std::cin >> v; std::cout << secondLargest(a) << '\\n'; }\n",
      go: "\npackage main\nimport \"fmt\"\nfunc main() { var n int; if _, err := fmt.Scan(&n); err != nil { return }; a := make([]int, n); for i := range a { fmt.Scan(&a[i]) }; fmt.Println(secondLargest(a)) }\n",
    },
    7: {
      python: "\nimport sys\nprint(count_vowels(sys.stdin.read().rstrip('\\n')))\n",
      javascript: "\nconsole.log(countVowels(require('fs').readFileSync(0, 'utf8').replace(/\\r?\\n$/, '')));\n",
      c: "\n#include <stdio.h>\nint main(void) { char s[100005]; if (!fgets(s, sizeof(s), stdin)) s[0] = '\\0'; printf(\"%d\\n\", countVowels(s)); return 0; }\n",
      cpp: "\n#include <iostream>\n#include <cctype>\nint main() { std::string s; std::getline(std::cin, s); std::cout << countVowels(s) << '\\n'; }\n",
      go: "\npackage main\nimport (\"bufio\"; \"fmt\"; \"os\"; \"strings\")\nfunc main() { s, _ := bufio.NewReader(os.Stdin).ReadString('\\n'); s = strings.TrimSuffix(strings.TrimSuffix(s, \"\\n\"), \"\\r\"); fmt.Println(countVowels(s)) }\n",
    },
    8: {
      python: "\nimport sys\n_d = list(map(int, sys.stdin.read().split()))\nif _d:\n    _a = move_zeros(_d[1:1 + _d[0]])\n    print(' '.join(map(str, _a)))\n",
      javascript: "\nconst _d = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nif (_d.length && !Number.isNaN(_d[0])) console.log(moveZeros(_d.slice(1, 1 + _d[0])).join(' '));\n",
      c: "\n#include <stdio.h>\n#include <stdlib.h>\nint main(void) { int n; if (scanf(\"%d\", &n) != 1) return 0; int *a = malloc(sizeof(int) * (n > 0 ? n : 1)); for (int i = 0; i < n; i++) scanf(\"%d\", &a[i]); moveZeros(a, n); for (int i = 0; i < n; i++) printf(\"%s%d\", i ? \" \" : \"\", a[i]); putchar('\\n'); free(a); return 0; }\n",
      cpp: "\n#include <iostream>\nint main() { int n; if (!(std::cin >> n)) return 0; std::vector<int> a(n); for (int &v : a) std::cin >> v; moveZeros(a); for (int i = 0; i < n; i++) std::cout << (i ? \" \" : \"\") << a[i]; std::cout << '\\n'; }\n",
      go: "\npackage main\nimport \"fmt\"\nfunc main() { var n int; if _, err := fmt.Scan(&n); err != nil { return }; a := make([]int, n); for i := range a { fmt.Scan(&a[i]) }; moveZeros(a); for i, v := range a { if i > 0 { fmt.Print(\" \") }; fmt.Print(v) }; fmt.Println() }\n",
    },
  };
  if (drivers[level]?.[language]) {
    if (language === 'java' || language === 'csharp') return source;
    if (language === 'cpp') {
      return `#include <climits>\n#include <iostream>\n#include <cctype>\n${source}${drivers[level][language]}`;
    }
    if (language === 'go') return `package main\n${drivers[level][language].replace(/^\npackage main\n/, '')}\n${source}`;
    return `${source}${drivers[level][language]}`;
  }
  return source;
};

const makeStudentTemplate = (source, level, language) => {
  if (level === 4 || level === 5) return stripEntryPoint(source, language);
  if (level === 6) return replaceFunctionBody(source, language, ['secondLargest', 'SecondLargest', 'second_largest']);
  if (level === 7) {
    const signatureOnly = replaceFunctionBody(source, language, ['countVowels', 'CountVowels', 'count_vowels']);
    return stripEntryPoint(signatureOnly, language);
  }
  if (level === 8) return getStarterTemplate(language);
  return source;
};

export const buildDebuggingSeedRecord = (problem, index) => {
  const level = index + 1;
  const templates = {};
  const solutions = {};
  const boilerplateCode = {};
  const missingLinePosition = {};
  for (const language of LANGUAGE_KEYS) {
    const original = problem.starterCode?.[language] || '';
    const solved = replaceMissingLine(original, MISSING_LINE_ANSWERS[index][language]);
    solutions[language] = makeRunnableSolution(solved, level, language);
    templates[language] = makeStudentTemplate(level >= 4 ? solved : original, level, language);
    boilerplateCode[language] = original;
    const markerLine = templates[language].split('\n').findIndex((line) => /Missing Line|Implement the algorithm/i.test(line));
    missingLinePosition[language] = markerLine >= 0 ? String(markerLine + 1) : '';
  }

  const levelMeta = LEVELS[index];
  const sample = problem.testCases.find((testCase) => !testCase.hidden) || { input: '', expectedOutput: '' };
  return {
    level,
    title: [
      'Sum of Odd Numbers',
      'Missing Number',
      'Reverse Integer',
      'Palindrome Number',
      'Search Element',
      'Second Largest Distinct Number',
      'Count Vowels',
      'Move Zeros To End',
    ][index],
    slug: [
      'debug-sum-of-odd-numbers',
      'debug-missing-number',
      'debug-reverse-integer',
      'debug-palindrome-number',
      'debug-search-element',
      'debug-second-largest-distinct-number',
      'debug-count-vowels',
      'debug-move-zeros-to-end',
    ][index],
    assessmentType: 'debugging',
    description: `${problem.statement}\n\nInput format: ${problem.inputFormat}\nOutput format: ${problem.outputFormat}`,
    difficulty: levelMeta.difficulty,
    points: levelMeta.points,
    languageTemplates: templates,
    boilerplateCode,
    solutionCode: solutions,
    missingLinePosition,
    sampleInput: sample.input,
    sampleOutput: sample.expectedOutput,
    visibleTestCases: problem.testCases.filter((testCase) => !testCase.hidden).map(({ input, expectedOutput }) => ({ input, expectedOutput })),
    hiddenTestCases: problem.testCases.filter((testCase) => testCase.hidden).map(({ input, expectedOutput }) => ({ input, expectedOutput })),
    isActive: true,
    order: level,
  };
};

export const seedDebuggingProblems = async () => {
  const operations = PROBLEMS.map((problem, index) => {
    const body = buildDebuggingSeedRecord(problem, index);
    return {
      updateOne: {
        filter: { slug: body.slug },
        update: { $setOnInsert: body },
        upsert: true,
        runValidators: true,
      },
    };
  });
  const result = await DebuggingProblem.bulkWrite(operations, { ordered: false });
  await deleteCachePattern('debugging:*');
  logger.info(`Debugging catalogue checked: ${result.upsertedCount || 0} created, existing questions preserved`);
  return result;
};

export default { seedDebuggingProblems };

// Coding module language registry. This is the single source of truth for
// execution runtimes, Monaco identifiers and generic entry templates.
const RAW_LANGUAGES = {
  python: {
    label: 'Python', monaco: 'python', filename: 'main.py',
    judge0IdEnv: 'JUDGE0_ID_PYTHON', judge0Id: 92,
    piston: { language: 'python', version: '3.10.0' },
  },
  java: {
    label: 'Java', monaco: 'java', filename: 'Main.java',
    judge0IdEnv: 'JUDGE0_ID_JAVA', judge0Id: 62,
    piston: { language: 'java', version: '15.0.2' },
  },
  javascript: {
    label: 'JavaScript', monaco: 'javascript', filename: 'main.js',
    judge0IdEnv: 'JUDGE0_ID_JAVASCRIPT', judge0Id: 63,
    piston: { language: 'javascript', version: '18.15.0' },
  },
  c: {
    label: 'C', monaco: 'c', filename: 'main.c',
    judge0IdEnv: 'JUDGE0_ID_C', judge0Id: 50,
    piston: { language: 'c', version: '10.2.0' },
  },
  cpp: {
    label: 'C++', monaco: 'cpp', filename: 'main.cpp',
    judge0IdEnv: 'JUDGE0_ID_CPP', judge0Id: 54,
    piston: { language: 'c++', version: '10.2.0' },
  },
  csharp: {
    label: 'C#', monaco: 'csharp', filename: 'Main.cs',
    judge0IdEnv: 'JUDGE0_ID_CSHARP', judge0Id: 18,
    piston: { language: 'csharp', version: '6.12.0' },
  },
  go: {
    label: 'Go', monaco: 'go', filename: 'main.go',
    judge0IdEnv: 'JUDGE0_ID_GO', judge0Id: 28,
    piston: { language: 'go', version: '1.16.2' },
  },
};

const buildLanguages = () => {
  const languages = {};
  for (const [key, meta] of Object.entries(RAW_LANGUAGES)) {
    const parsed = Number(process.env[meta.judge0IdEnv]);
    languages[key] = {
      ...meta,
      judge0Id: Number.isInteger(parsed) && parsed > 0 ? parsed : meta.judge0Id,
    };
  }
  return languages;
};

export const LANGUAGES = buildLanguages();
export const LANGUAGE_KEYS = Object.keys(LANGUAGES);
export const DEFAULT_LANGUAGE = 'python';

export const isSupportedLanguage = (language) =>
  typeof language === 'string' && Object.prototype.hasOwnProperty.call(LANGUAGES, language);

export const getLanguage = (language) =>
  isSupportedLanguage(language) ? LANGUAGES[language] : null;

export const getLanguageManifest = () =>
  LANGUAGE_KEYS.map((key) => ({
    key,
    label: LANGUAGES[key].label,
    monaco: LANGUAGES[key].monaco,
  }));

const GENERIC_TEMPLATES = {
  python: `def solve():
    # Write your solution here
    pass

solve()
`,
  java: `import java.util.*;

public class Main {
    public static void main(String[] args) {

        // Write your solution here

    }
}
`,
  javascript: `function solve() {

    // Write your solution here

}

solve();
`,
  c: `#include <stdio.h>

int main() {

    // Write your solution here

    return 0;
}
`,
  cpp: `#include <iostream>
using namespace std;

int main() {

    // Write your solution here

    return 0;
}
`,
  csharp: `using System;

class Program
{
    static void Main()
    {
        // Write your solution here
    }
}
`,
  go: `package main

import "fmt"

func main() {

    // Write your solution here

}
`,
};

export const getStarterTemplate = (language) => GENERIC_TEMPLATES[language] || '';

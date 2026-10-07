import test from 'node:test';
import assert from 'node:assert/strict';
import PROBLEMS from '../seedData/codingProblems.js';
import { LANGUAGE_KEYS } from '../config/languages.js';
import { buildDebuggingSeedRecord } from '../services/debuggingProblemSeeder.js';

const EXPECTED_TEMPLATES = {
  java: `import java.util.*;

public class Main {
    public static void main(String[] args) {

        // Write your solution here

    }
}
`,
  python: `def solve():
    # Write your solution here
    pass

solve()
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

test('all seven debugging language templates are clean boilerplates', () => {
  assert.deepEqual(Object.keys(EXPECTED_TEMPLATES).sort(), [...LANGUAGE_KEYS].sort());

  PROBLEMS.forEach((problem, index) => {
    const record = buildDebuggingSeedRecord(problem, index);
    for (const language of LANGUAGE_KEYS) {
      assert.equal(record.languageTemplates[language], EXPECTED_TEMPLATES[language]);
      assert.equal(record.boilerplateCode[language], EXPECTED_TEMPLATES[language]);
    }
    assert.equal('solutionCode' in record, false);
    assert.equal('missingLinePosition' in record, false);
  });
});

test('debugging seed records retain statements, constraints, formats, examples, and cases', () => {
  PROBLEMS.forEach((problem, index) => {
    const record = buildDebuggingSeedRecord(problem, index);
    assert.ok(record.description.includes(problem.statement));
    for (const constraint of problem.constraints) {
      assert.ok(record.description.includes(constraint));
    }
    assert.ok(record.description.includes(`Input format: ${problem.inputFormat}`));
    assert.ok(record.description.includes(`Output format: ${problem.outputFormat}`));
    for (const example of problem.examples) {
      assert.ok(record.description.includes(example.input));
      assert.ok(record.description.includes(example.output));
    }
    assert.deepEqual(
      record.visibleTestCases.length + record.hiddenTestCases.length,
      problem.testCases.length
    );
  });
});

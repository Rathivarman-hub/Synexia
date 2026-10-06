import test from 'node:test';
import assert from 'node:assert/strict';
import { isExpectedIncompleteJavaStarter } from '../utils/expectedIncompleteJavaStarter.js';

test('accepts only the single expected Java missing-return diagnostic at a marked edit', () => {
  assert.equal(
    isExpectedIncompleteJavaStarter(
      'java',
      'returnType method() { // Missing Line\n}',
      'Main.java:3: error: missing return statement'
    ),
    true
  );
});

test('does not classify unrelated Java compile errors as intentional', () => {
  assert.equal(
    isExpectedIncompleteJavaStarter('java', '// Missing Line', 'error: cannot find symbol'),
    false
  );
});

test('does not classify multiple Java compile errors as intentional', () => {
  assert.equal(
    isExpectedIncompleteJavaStarter(
      'java',
      '// Missing Line',
      'error: missing return statement\nerror: cannot find symbol'
    ),
    false
  );
});

test('does not classify missing returns in other languages as intentional', () => {
  assert.equal(
    isExpectedIncompleteJavaStarter('csharp', '// Missing Line', 'error: missing return statement'),
    false
  );
});

test('requires the intentional edit marker', () => {
  assert.equal(
    isExpectedIncompleteJavaStarter('java', 'returnType method() {}', 'error: missing return statement'),
    false
  );
});

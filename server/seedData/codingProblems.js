
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
  starterCode: {
    python: String.raw`import sys

def solve():
    data = sys.stdin.read().split()
    if not data:
        return

    n = int(data[0])
    nums = list(map(int, data[1:1 + n]))

    # TODO: compute the sum of every odd number in nums
    total = 0

    print(total)


if __name__ == "__main__":
    solve()
`,
    java: String.raw`import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));

        String first = br.readLine();
        if (first == null) return;
        int n = Integer.parseInt(first.trim());

        long[] nums = new long[Math.max(n, 1)];
        String[] parts = br.readLine().trim().split("\\s+");
        for (int i = 0; i < n && i < parts.length; i++) {
            nums[i] = Long.parseLong(parts[i]);
        }

        // TODO: compute the sum of every odd number in nums
        long total = 0;

        System.out.println(total);
    }
}
`,
    javascript: String.raw`const fs = require('fs');

function solve() {
  const data = fs.readFileSync(0, 'utf-8').trim().split(/\s+/);
  if (!data.length || data[0] === '') return;

  const n = Number(data[0]);
  const nums = data.slice(1, 1 + n).map(Number);

  // TODO: compute the sum of every odd number in \`nums\`
  let total = 0;

  console.log(total);
}

solve();
`,
    c: String.raw`#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 0;

    long long *nums = malloc(sizeof(long long) * (n > 0 ? n : 1));
    for (int i = 0; i < n; i++) {
        if (scanf("%lld", &nums[i]) != 1) { free(nums); return 0; }
    }

    /* TODO: compute the sum of every odd number in nums */
    long long total = 0;

    printf("%lld\n", total);
    free(nums);
    return 0;
}
`,
    cpp: String.raw`#include <iostream>
#include <vector>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    if (!(cin >> n)) return 0;

    vector<long long> nums(n);
    for (int i = 0; i < n; i++) cin >> nums[i];

    // TODO: compute the sum of every odd number in \`nums\`
    long long total = 0;

    cout << total << '\n';
    return 0;
}
`,
    csharp: String.raw`using System;
using System.Linq;

class Program {
    static void Main() {
        var data = Console.In.ReadToEnd()
            .Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries);
        if (data.Length == 0) return;

        int n = int.Parse(data[0]);
        var nums = data.Skip(1).Take(n).Select(long.Parse).ToArray();

        // TODO: compute the sum of every odd number in \`nums\`
        long total = 0;

        Console.WriteLine(total);
    }
}
`,
    go: String.raw`package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
)

func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)

	sc.Scan()
	n, err := strconv.Atoi(sc.Text())
	if err != nil {
		return
	}

    nums := make([]int, 0, n-1)
    for i := 0; i < n-1 && sc.Scan(); i++ {
		v, err := strconv.Atoi(sc.Text())
		if err != nil {
			return
		}
		nums = append(nums, v)
	}

	// TODO: compute the sum of every odd number in \`nums\`
	total := 0

	fmt.Println(total)
}
`,
  },
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

// ─────────────────────────────────────────────────────────────────────────────
// 2 · Find Missing Number in an Array
// ─────────────────────────────────────────────────────────────────────────────
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
  starterCode: {
    python: String.raw`import sys

def solve():
    data = sys.stdin.read().split()
    if not data:
        return

    n = int(data[0])
    nums = list(map(int, data[1:n]))

    # TODO: find the one integer missing from the range 1..n
    missing = -1

    print(missing)


if __name__ == "__main__":
    solve()
`,
    java: String.raw`import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));

        String first = br.readLine();
        if (first == null) return;
        int n = Integer.parseInt(first.trim());

        String[] parts = br.readLine().trim().split("\\s+");
        long[] nums = new long[Math.max(n - 1, 1)];
        for (int i = 0; i < n - 1 && i < parts.length; i++) {
            nums[i] = Long.parseLong(parts[i]);
        }

        // TODO: find the one integer missing from the range 1..n
        long missing = -1;

        System.out.println(missing);
    }
}
`,
    javascript: String.raw`const fs = require('fs');

function solve() {
  const data = fs.readFileSync(0, 'utf-8').trim().split(/\s+/);
  if (!data.length || data[0] === '') return;

  const n = Number(data[0]);
    const nums = data.slice(1, n).map(Number);

  // TODO: find the one integer missing from the range 1..n
  let missing = -1;

  console.log(missing);
}

solve();
`,
    c: String.raw`#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 0;

    long long *nums = malloc(sizeof(long long) * (n > 1 ? n - 1 : 1));
    for (int i = 0; i < n - 1; i++) {
        if (scanf("%lld", &nums[i]) != 1) { free(nums); return 0; }
    }

    /* TODO: find the one integer missing from the range 1..n */
    long long missing = -1;

    printf("%lld\n", missing);
    free(nums);
    return 0;
}
`,
    cpp: String.raw`#include <iostream>
#include <vector>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    if (!(cin >> n)) return 0;

    vector<long long> nums(n - 1);
    for (int i = 0; i < n - 1; i++) cin >> nums[i];

    // TODO: find the one integer missing from the range 1..n
    long long missing = -1;

    cout << missing << '\n';
    return 0;
}
`,
    csharp: String.raw`using System;
using System.Linq;

class Program {
    static void Main() {
        var data = Console.In.ReadToEnd()
            .Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries);
        if (data.Length == 0) return;

        int n = int.Parse(data[0]);
        var nums = data.Skip(1).Take(n - 1).Select(long.Parse).ToArray();

        // TODO: find the one integer missing from the range 1..n
        long missing = -1;

        Console.WriteLine(missing);
    }
}
`,
    go: String.raw`package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
)

func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)

	sc.Scan()
	n, err := strconv.Atoi(sc.Text())
	if err != nil {
		return
	}

	nums := make([]int, 0, n)
	for i := 0; i < n && sc.Scan(); i++ {
		v, err := strconv.Atoi(sc.Text())
		if err != nil {
			return
		}
		nums = append(nums, v)
	}

	// TODO: find the one integer missing from the range 1..n
	missing := -1

	fmt.Println(missing)
}
`,
  },
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
    difficulty: 'easy',
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
  starterCode: {
    python: String.raw`import sys


def solve():
    data = sys.stdin.read().split()
    if not data:
        return

    x = int(data[0])

    # TODO: reverse the digits of N.
    result = 0

    print(result)


if __name__ == "__main__":
    solve()
`,
    java: String.raw`import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String line = br.readLine();
        if (line == null) return;

        long x = Long.parseLong(line.trim());

        // TODO: reverse the digits of N.
        long result = 0;

        System.out.println(result);
    }
}
`,
    javascript: String.raw`const fs = require('fs');

function reverse(x) {
    // TODO: reverse the digits of N.
  return 0;
}

function solve() {
  const data = fs.readFileSync(0, 'utf-8').trim().split(/\s+/);
  if (!data.length || data[0] === '') return;

  console.log(reverse(Number(data[0])));
}

solve();
`,
    c: String.raw`#include <stdio.h>
#include <stdlib.h>

long reverse(long long x) {
    /* TODO: reverse the digits of N. */
    return 0;
}

int main(void) {
    long long x;
    if (scanf("%lld", &x) != 1) return 0;

    printf("%lld\n", reverse(x));
    return 0;
}
`,
    cpp: String.raw`#include <iostream>
using namespace std;

long long reverseInteger(long long x) {
    // TODO: reverse the digits of N.
    return 0;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    long long x;
    if (!(cin >> x)) return 0;

    cout << reverseInteger(x) << '\n';
    return 0;
}
`,
    csharp: String.raw`using System;
using System.Linq;

class Program {
    static long ReverseInteger(long x) {
        // TODO: reverse the digits of N.
        return 0;
    }

    static void Main() {
        var data = Console.In.ReadToEnd()
            .Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries);
        if (data.Length == 0) return;

        Console.WriteLine(ReverseInteger(long.Parse(data[0])));
    }
}
`,
    go: String.raw`package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
)

func reverseInteger(x int) int64 {
    // TODO: reverse the digits of N.
	return 0
}

func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)

	sc.Scan()
	x, err := strconv.Atoi(sc.Text())
	if err != nil {
		return
	}

	fmt.Println(reverseInteger(x))
}
`,
  },
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
    difficulty: 'easy',
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
  starterCode: {
    python: String.raw`import sys


def solve():
    data = sys.stdin.read().split()
    if not data:
        return

    x = int(data[0])

    # TODO: print "Palindrome" or "Not Palindrome" depending on x.
    # Remember: negative numbers are never palindromes.
    is_palindrome = False

    print("Palindrome" if is_palindrome else "Not Palindrome")


if __name__ == "__main__":
    solve()
`,
    java: String.raw`import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String line = br.readLine();
        if (line == null) return;

        long x = Long.parseLong(line.trim());

        // TODO: decide whether x is a palindrome.
        boolean isPalindrome = false;

        System.out.println(isPalindrome ? "Palindrome" : "Not Palindrome");
    }
}
`,
    javascript: String.raw`const fs = require('fs');

function isPalindrome(x) {
  // TODO: return true only when x reads the same forwards and backwards.
  return false;
}

function solve() {
  const data = fs.readFileSync(0, 'utf-8').trim().split(/\s+/);
  if (!data.length || data[0] === '') return;

    console.log(isPalindrome(Number(data[0])) ? 'Palindrome' : 'Not Palindrome');
}

solve();
`,
    c: String.raw`#include <stdio.h>
#include <stdlib.h>

int isPalindrome(long long x) {
    /* TODO: return 1 when x is a palindrome, otherwise 0. */
    return 0;
}

int main(void) {
    long long x;
    if (scanf("%lld", &x) != 1) return 0;

    printf("%s\n", isPalindrome(x) ? "Palindrome" : "Not Palindrome");
    return 0;
}
`,
    cpp: String.raw`#include <iostream>
using namespace std;

bool isPalindrome(long long x) {
    // TODO: return true only when x reads the same forwards and backwards.
    return false;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    long long x;
    if (!(cin >> x)) return 0;

    cout << (isPalindrome(x) ? "Palindrome" : "Not Palindrome") << '\n';
    return 0;
}
`,
    csharp: String.raw`using System;
using System.Linq;

class Program {
    static bool IsPalindrome(long x) {
        // TODO: return true only when x reads the same forwards and backwards.
        return false;
    }

    static void Main() {
        var data = Console.In.ReadToEnd()
            .Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries);
        if (data.Length == 0) return;

        Console.WriteLine(IsPalindrome(long.Parse(data[0])) ? "Palindrome" : "Not Palindrome");
    }
}
`,
    go: String.raw`package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
)

func isPalindrome(x int) bool {
	// TODO: return true only when x reads the same forwards and backwards.
	return false
}

func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)

	sc.Scan()
	x, err := strconv.Atoi(sc.Text())
	if err != nil {
		return
	}

    if isPalindrome(x) {
        fmt.Println("Palindrome")
    } else {
        fmt.Println("Not Palindrome")
    }
}
`,
  },
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
    difficulty: 'easy',
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
  starterCode: {
    python: String.raw`import sys

def solve():
    data = sys.stdin.read().split()
    if not data:
        return

    n = int(data[0])
    nums = list(map(int, data[1:1 + n]))
    k = int(data[1 + n])

    # TODO: print "Found" if k is in nums, otherwise "Not Found"
    print("Not Found")


if __name__ == "__main__":
    solve()
`,
    java: String.raw`import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));

        String first = br.readLine();
        if (first == null) return;
        int n = Integer.parseInt(first.trim());

        String[] parts = br.readLine().trim().split("\\s+");
        long[] nums = new long[Math.max(n, 1)];
        for (int i = 0; i < n && i < parts.length; i++) {
            nums[i] = Long.parseLong(parts[i]);
        }
        long k = Long.parseLong(br.readLine().trim());

        // TODO: print "Found" if k is in nums, otherwise "Not Found"
        System.out.println("Not Found");
    }
}
`,
    javascript: String.raw`const fs = require('fs');

function solve() {
  const data = fs.readFileSync(0, 'utf-8').trim().split(/\s+/);
  if (!data.length || data[0] === '') return;

  const n = Number(data[0]);
  const nums = data.slice(1, 1 + n).map(Number);
  const k = Number(data[1 + n]);

  // TODO: print "Found" if k is in nums, otherwise "Not Found"
  console.log('Not Found');
}

solve();
`,
    c: String.raw`#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 0;

    long long *nums = malloc(sizeof(long long) * (n > 0 ? n : 1));
    for (int i = 0; i < n; i++) {
        if (scanf("%lld", &nums[i]) != 1) { free(nums); return 0; }
    }

    long long k;
    if (scanf("%lld", &k) != 1) { free(nums); return 0; }

    /* TODO: print "Found" if k is in nums, otherwise "Not Found" */
    printf("Not Found\n");

    free(nums);
    return 0;
}
`,
    cpp: String.raw`#include <iostream>
#include <vector>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    if (!(cin >> n)) return 0;

    vector<long long> nums(n);
    for (int i = 0; i < n; i++) cin >> nums[i];

    long long k;
    cin >> k;

    // TODO: print "Found" if k is in nums, otherwise "Not Found"
    cout << "Not Found" << '\n';

    return 0;
}
`,
    csharp: String.raw`using System;
using System.Linq;

class Program {
    static void Main() {
        var data = Console.In.ReadToEnd()
            .Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries);
        if (data.Length == 0) return;

        int n = int.Parse(data[0]);
        var nums = data.Skip(1).Take(n).Select(long.Parse).ToArray();
        long k = long.Parse(data[1 + n]);

        // TODO: print "Found" if k is in nums, otherwise "Not Found"
        Console.WriteLine("Not Found");
    }
}
`,
    go: String.raw`package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
)

func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)

	sc.Scan()
	n, err := strconv.Atoi(sc.Text())
	if err != nil {
		return
	}

	nums := make([]int, 0, n)
	for i := 0; i < n && sc.Scan(); i++ {
		v, err := strconv.Atoi(sc.Text())
		if err != nil {
			return
		}
		nums = append(nums, v)
	}

	sc.Scan()
	k, err := strconv.Atoi(sc.Text())
	if err != nil {
		return
	}

	// TODO: print "Found" if k is in nums, otherwise "Not Found"
	fmt.Println("Not Found")
}
`,
  },
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
    difficulty: 'easy',
    points: 16,
  category: 'arrays',
  tags: ['array', 'one-pass', 'no-sorting'],
  statement: `Write a program that finds the **second largest distinct** value in an array of integers.

Two rules define the answer:
1. **Distinct** — duplicates do not count. In \`[5, 5, 3]\` the second largest is \`3\`, not \`5\`.
2. **No sorting** — you must not call \`sort\`, \`sorted\`, \`Arrays.sort\`, \`std::sort\` or any equivalent. Solve it in a single pass in O(n) time and O(1) extra space.

If the array contains fewer than two distinct values, print \`-1\`.`,
  constraints: [
    '1 <= n <= 100,000',
    '-10^9 <= nums[i] <= 10^9',
    'n may be 1, in which case the answer is -1',
    'Sorting the array is explicitly disallowed and will be reviewed',
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
  starterCode: {
    python: String.raw`import sys

def solve():
    data = sys.stdin.read().split()
    if not data:
        return

    n = int(data[0])
    nums = list(map(int, data[1:1 + n]))

    # TODO: find the second largest DISTINCT value in one pass, without sorting.
    # Print -1 when fewer than two distinct values exist.
    second = -1

    print(second)


if __name__ == "__main__":
    solve()
`,
    java: String.raw`import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));

        String first = br.readLine();
        if (first == null) return;
        int n = Integer.parseInt(first.trim());

        String[] parts = br.readLine().trim().split("\\s+");
        long[] nums = new long[Math.max(n, 1)];
        for (int i = 0; i < n && i < parts.length; i++) {
            nums[i] = Long.parseLong(parts[i]);
        }

        // TODO: find the second largest DISTINCT value in one pass.
        // Arrays.sort() is NOT allowed here.
        long second = -1;

        System.out.println(second);
    }
}
`,
    javascript: String.raw`const fs = require('fs');

function secondLargestDistinct(nums) {
  // TODO: return the second largest distinct value, or -1.
  // Do NOT use Array.prototype.sort.
  return -1;
}

function solve() {
  const data = fs.readFileSync(0, 'utf-8').trim().split(/\s+/);
  if (!data.length || data[0] === '') return;

  const n = Number(data[0]);
  const nums = data.slice(1, 1 + n).map(Number);

  console.log(secondLargestDistinct(nums));
}

solve();
`,
    c: String.raw`#include <stdio.h>
#include <stdlib.h>

long long secondLargestDistinct(const long long *nums, int n) {
    /* TODO: return the second largest distinct value, or -1.
       Sorting is NOT allowed. */
    return -1;
}

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 0;

    long long *nums = malloc(sizeof(long long) * (n > 0 ? n : 1));
    for (int i = 0; i < n; i++) {
        if (scanf("%lld", &nums[i]) != 1) { free(nums); return 0; }
    }

    printf("%lld\n", secondLargestDistinct(nums, n));
    free(nums);
    return 0;
}
`,
    cpp: String.raw`#include <iostream>
#include <vector>
using namespace std;

long long secondLargestDistinct(const vector<long long> &nums) {
    // TODO: return the second largest distinct value, or -1.
    // std::sort / std::nth_element are NOT allowed here.
    return -1;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    if (!(cin >> n)) return 0;

    vector<long long> nums(n);
    for (int i = 0; i < n; i++) cin >> nums[i];

    cout << secondLargestDistinct(nums) << '\n';
    return 0;
}
`,
    csharp: String.raw`using System;
using System.Linq;

class Program {
    static long SecondLargestDistinct(long[] nums) {
        // TODO: return the second largest distinct value, or -1.
        // OrderBy / Array.Sort is NOT allowed here.
        return -1;
    }

    static void Main() {
        var data = Console.In.ReadToEnd()
            .Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries);
        if (data.Length == 0) return;

        int n = int.Parse(data[0]);
        var nums = data.Skip(1).Take(n).Select(long.Parse).ToArray();

        Console.WriteLine(SecondLargestDistinct(nums));
    }
}
`,
    go: String.raw`package main

import (
	"bufio"
	"fmt"
	"os"
	"sort"
	"strconv"
)

func secondLargestDistinct(nums []int) int64 {
	// TODO: return the second largest distinct value, or -1.
	// sort.Ints / sort.Slice are NOT allowed here.
	_ = sort.Ints
	return -1
}

func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)

	sc.Scan()
	n, err := strconv.Atoi(sc.Text())
	if err != nil {
		return
	}

	nums := make([]int, 0, n)
	for i := 0; i < n && sc.Scan(); i++ {
		v, err := strconv.Atoi(sc.Text())
		if err != nil {
			return
		}
		nums = append(nums, v)
	}

	fmt.Println(secondLargestDistinct(nums))
}
`,
  },
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
    difficulty: 'easy',
    points: 17,
  category: 'strings',
  tags: ['string', 'character-classification', 'unicode'],
  statement: `Write a program that counts how many vowels appear in a line of text.

The vowels are \`a\`, \`e\`, \`i\`, \`o\` and \`u\`. **Both uppercase and lowercase forms count** — \`A\` and \`a\` are the same vowel.

Rules that trip people up:
1. Everything else is a consonant: spaces, digits, punctuation and symbols are all **not** vowels and must not be counted.
2. An empty line is valid input and the answer is \`0\`.
3. The whole line is the string — do not stop at the first space, and do not read only the first word.`,
  constraints: [
    '0 <= length of the line <= 100,000',
    'The line may contain spaces, digits, punctuation and any printable ASCII',
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
  starterCode: {
    python: String.raw`import sys

def solve():
    line = sys.stdin.readline().rstrip('\n')

    # TODO: count every vowel (a, e, i, o, u) in \`line\`, in either case.
    # Spaces, digits and punctuation must not be counted.
    count = 0

    print(count)


if __name__ == "__main__":
    solve()
`,
    java: String.raw`import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));

        // readLine() keeps spaces; readLine() on an empty file returns null.
        String line = br.readLine();
        if (line == null) line = "";

        // TODO: count every vowel (a, e, i, o, u) in \`line\`, in either case.
        int count = 0;

        System.out.println(count);
    }
}
`,
    javascript: String.raw`const fs = require('fs');

function countVowels(str) {
  // TODO: return how many vowels (a, e, i, o, u — either case) are in \`str\`.
  return 0;
}

function solve() {
  // Read the whole first line, preserving internal spaces.
  const raw = fs.readFileSync(0, 'utf-8');
  const line = raw.length ? raw.split(/\r?\n/)[0] : '';

  console.log(countVowels(line));
}

solve();
`,
    c: String.raw`#include <stdio.h>
#include <string.h>
#include <ctype.h>

int main(void) {
    char line[100005];
    if (!fgets(line, sizeof(line), stdin)) {
        printf("0\n");
        return 0;
    }

    /* Strip the trailing newline fgets keeps. */
    line[strcspn(line, "\r\n")] = '\0';

    /* TODO: count every vowel (a, e, i, o, u) in \`line\`, in either case. */
    int count = 0;

    printf("%d\n", count);
    return 0;
}
`,
    cpp: String.raw`#include <iostream>
#include <string>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    string line;
    getline(cin, line);

    // TODO: count every vowel (a, e, i, o, u) in \`line\`, in either case.
    int count = 0;

    cout << count << '\n';
    return 0;
}
`,
    csharp: String.raw`using System;
using System.Linq;

class Program {
    static int CountVowels(string str) {
        // TODO: return how many vowels (a, e, i, o, u — either case) are in \`str\`.
        return 0;
    }

    static void Main() {
        var line = Console.In.ReadLine() ?? "";

        Console.WriteLine(CountVowels(line));
    }
}
`,
    go: String.raw`package main

import (
	"bufio"
	"fmt"
	"os"
)

func countVowels(str string) int {
	// TODO: return how many vowels (a, e, i, o, u — either case) are in \`str\`.
	return 0
}

func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)

	line := ""
	if sc.Scan() {
		line = sc.Text()
	}

	fmt.Println(countVowels(line))
}
`,
  },
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
    difficulty: 'easy',
    points: 18,
  category: 'arrays',
  tags: ['array', 'two-pointers', 'in-place', 'stability'],
  statement: `Write a program that moves every \`0\` in an array to the end, in place, while preserving the **relative order** of the non-zero elements.

- The relative order of the non-zero values must be preserved. \`[0, 1, 0, 3, 12]\` becomes \`[1, 3, 12, 0, 0]\` — not \`[12, 3, 1, 0, 0]\`.
- The array length never changes.
- Negative numbers are perfectly valid non-zero elements and must be treated like any other.

Print the resulting array, space-separated, on a single line.`,
  constraints: [
    '0 <= n <= 100,000',
    '-10^9 <= nums[i] <= 10^9',
    'The result must be stable — the order of the non-zero elements is part of the contract',
    'Solve it in O(n) time and O(1) extra space beyond the input array',
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
    'Writing to the SAME array (not building a second one) is what makes it O(1) extra space.',
  ],
  starterCode: {
    python: String.raw`import sys

def solve():
    data = sys.stdin.read().split()
    if not data:
        return

    n = int(data[0])
    nums = list(map(int, data[1:1 + n]))

    # TODO: move every 0 to the end of \`nums\` in place, preserving the relative
    # order of the non-zero elements. O(n) time, O(1) extra space.
    result = nums

    print(' '.join(str(x) for x in result))


if __name__ == "__main__":
    solve()
`,
    java: String.raw`import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));

        String first = br.readLine();
        if (first == null) return;
        int n = Integer.parseInt(first.trim());

        String[] parts = br.readLine().trim().split("\\s+");
        long[] nums = new long[Math.max(n, 1)];
        for (int i = 0; i < n && i < parts.length; i++) {
            nums[i] = Long.parseLong(parts[i]);
        }

        // TODO: move every 0 to the end in place, preserving non-zero order.
        int[] order = new int[Math.max(n, 1)];
        for (int i = 0; i < n; i++) order[i] = i;

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) {
            if (i > 0) sb.append(' ');
            sb.append(nums[order[i]]);
        }
        System.out.println(sb);
    }
}
`,
    javascript: String.raw`const fs = require('fs');

function moveZeroes(nums) {
  // TODO: move every 0 to the end IN PLACE, preserving the relative order of
  // the non-zero elements. O(n) time, O(1) extra space.
}

function solve() {
  const data = fs.readFileSync(0, 'utf-8').trim().split(/\s+/);
  if (!data.length || data[0] === '') return;

  const n = Number(data[0]);
  const nums = data.slice(1, 1 + n).map(Number);

  moveZeroes(nums);

  console.log(nums.join(' '));
}

solve();
`,
    c: String.raw`#include <stdio.h>
#include <stdlib.h>

void moveZeros(long long *nums, int n) {
    /* TODO: move every 0 to the end in place, preserving non-zero order.
       O(n) time, O(1) extra space. */
    (void)nums;
    (void)n;
}

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 0;

    long long *nums = malloc(sizeof(long long) * (n > 0 ? n : 1));
    for (int i = 0; i < n; i++) {
        if (scanf("%lld", &nums[i]) != 1) { free(nums); return 0; }
    }

    moveZeros(nums, n);

    for (int i = 0; i < n; i++) {
        printf("%s%lld", i ? " " : "", nums[i]);
    }
    printf("\n");

    free(nums);
    return 0;
}
`,
    cpp: String.raw`#include <iostream>
#include <vector>
using namespace std;

void moveZeros(vector<long long> &nums) {
    // TODO: move every 0 to the end in place, preserving non-zero order.
    // O(n) time, O(1) extra space. std::stable_partition is NOT allowed.
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    if (!(cin >> n)) return 0;

    vector<long long> nums(n);
    for (int i = 0; i < n; i++) cin >> nums[i];

    moveZeros(nums);

    for (int i = 0; i < n; i++) {
        if (i) cout << ' ';
        cout << nums[i];
    }
    cout << '\n';

    return 0;
}
`,
    csharp: String.raw`using System;
using System.Linq;

class Program {
    static void MoveZeros(long[] nums) {
        // TODO: move every 0 to the end in place, preserving non-zero order.
        // O(n) time, O(1) extra space.
    }

    static void Main() {
        var data = Console.In.ReadToEnd()
            .Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries);
        if (data.Length == 0) return;

        int n = int.Parse(data[0]);
        var nums = data.Skip(1).Take(n).Select(long.Parse).ToArray();

        MoveZeros(nums);

        Console.WriteLine(string.Join(" ", nums));
    }
}
`,
    go: String.raw`package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

func moveZeros(nums []int) {
	// TODO: move every 0 to the end in place, preserving non-zero order.
	// O(n) time, O(1) extra space.
	_ = nums
}

func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)

	sc.Scan()
	n, err := strconv.Atoi(sc.Text())
	if err != nil {
		return
	}

	nums := make([]int, 0, n)
	for i := 0; i < n && sc.Scan(); i++ {
		v, err := strconv.Atoi(sc.Text())
		if err != nil {
			return
		}
		nums = append(nums, v)
	}

	moveZeros(nums)

	parts := make([]string, len(nums))
	for i, v := range nums {
		parts[i] = strconv.Itoa(v)
	}
	fmt.Println(strings.Join(parts, " "))
}
`,
  },
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

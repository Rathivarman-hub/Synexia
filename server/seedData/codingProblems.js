
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

    total = 0
    for num in nums:
        # Missing Line
        pass

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

        long total = 0;
        for (int i = 0; i < n; i++) {
            long num = nums[i];
            // Missing Line
        }

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

  let total = 0;
  for (const num of nums) {
    // Missing Line
  }

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

    long long total = 0;
    for (int i = 0; i < n; i++) {
        long long num = nums[i];
        // Missing Line
    }

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

    long long total = 0;
    for (long long num : nums) {
        // Missing Line
    }

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

        long total = 0;
        foreach (var num in nums) {
            // Missing Line
        }

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
	sc.Split(bufio.ScanWords)

	if !sc.Scan() {
		return
	}
	count, err := strconv.Atoi(sc.Text())
	if err != nil {
		return
	}

	nums := make([]int, count)
	for i := 0; i < count; i++ {
		if !sc.Scan() {
			return
		}
		nums[i], err = strconv.Atoi(sc.Text())
		if err != nil {
			return
		}
	}

	total := 0
	for _, num := range nums {
		// Missing Line
	}

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

    total = n * (n + 1) // 2
    current_sum = sum(nums)
    # Missing Line


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

        long total = 1L * n * (n + 1) / 2;
        long currentSum = 0;
        for (int i = 0; i < n - 1; i++) {
            currentSum += nums[i];
        }
        // Missing Line

        System.out.println(total - currentSum);
    }
}
`,
    javascript: String.raw`const fs = require('fs');

function solve() {
  const data = fs.readFileSync(0, 'utf-8').trim().split(/\s+/);
  if (!data.length || data[0] === '') return;

  const n = Number(data[0]);
  const nums = data.slice(1, n).map(Number);

  const total = n * (n + 1) / 2;
  const currentSum = nums.reduce((sum, value) => sum + value, 0);
  // Missing Line
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

    long long total = 1LL * n * (n + 1) / 2;
    long long currentSum = 0;
    for (int i = 0; i < n - 1; i++) {
        currentSum += nums[i];
    }
    // Missing Line

    printf("%lld\n", total - currentSum);
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

    long long total = 1LL * n * (n + 1) / 2;
    long long currentSum = 0;
    for (long long value : nums) currentSum += value;
    // Missing Line

    cout << total - currentSum << '\n';
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

        long total = 1L * n * (n + 1) / 2;
        long currentSum = nums.Sum();
        // Missing Line

        Console.WriteLine(total - currentSum);
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
	sc.Split(bufio.ScanWords)

	if !sc.Scan() {
		return
	}
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

	total := n * (n + 1) / 2
	currentSum := 0
	for _, v := range nums {
		currentSum += v
	}
	// Missing Line

	fmt.Println(total - currentSum)
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
  starterCode: {
    python: String.raw`import sys


def reverse_number(n):
    # Write Logic Here
    pass


def solve():
    data = sys.stdin.read().split()
    if not data:
        return

    x = int(data[0])
    print(reverse_number(x))


if __name__ == "__main__":
    solve()
`,
    java: String.raw`import java.io.*;
import java.util.*;

public class Main {
    static int reverseNumber(int n) {
        // Write Logic Here
        return 0;
    }

    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String line = br.readLine();
        if (line == null) return;

        int n = Integer.parseInt(line.trim());
        System.out.println(reverseNumber(n));
    }
}
`,
    javascript: String.raw`const fs = require('fs');

function reverseNumber(n) {
  // Write Logic Here
  return 0;
}

function solve() {
  const data = fs.readFileSync(0, 'utf-8').trim().split(/\s+/);
  if (!data.length || data[0] === '') return;

  console.log(reverseNumber(Number(data[0])));
}

solve();
`,
    c: String.raw`#include <stdio.h>

int reverseNumber(int n) {
    // Write Logic Here
    return 0;
}

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 0;

    printf("%d\n", reverseNumber(n));
    return 0;
}
`,
    cpp: String.raw`#include <iostream>
using namespace std;

int reverseNumber(int n) {
    // Write Logic Here
    return 0;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    if (!(cin >> n)) return 0;

    cout << reverseNumber(n) << '\n';
    return 0;
}
`,
    csharp: String.raw`using System;

class Program {
    static int ReverseNumber(int n) {
        // Write Logic Here
        return 0;
    }

    static void Main() {
        var data = Console.In.ReadToEnd()
            .Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries);
        if (data.Length == 0) return;

        Console.WriteLine(ReverseNumber(int.Parse(data[0])));
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

func reverseNumber(n int) int {
	// Write Logic Here
	return 0
}

func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)
	sc.Split(bufio.ScanWords)

	if !sc.Scan() {
		return
	}

	n, err := strconv.Atoi(sc.Text())
	if err != nil {
		return
	}

	fmt.Println(reverseNumber(n))
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
  starterCode: {
    python: String.raw`import sys


def is_palindrome(x):
    # Write Logic Here
    pass


def solve():
    data = sys.stdin.read().split()
    if not data:
        return

    x = int(data[0])
    print("Palindrome" if is_palindrome(x) else "Not Palindrome")


if __name__ == "__main__":
    solve()
`,
    java: String.raw`import java.io.*;
import java.util.*;

public class Main {
    static boolean isPalindrome(int n) {
        // Write Logic Here
        return false;
    }

    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String line = br.readLine();
        if (line == null) return;

        int n = Integer.parseInt(line.trim());
        System.out.println(isPalindrome(n) ? "Palindrome" : "Not Palindrome");
    }
}
`,
    javascript: String.raw`const fs = require('fs');

function isPalindrome(x) {
  // Write Logic Here
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

int isPalindrome(int n) {
    // Write Logic Here
    return 0;
}

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 0;

    printf("%s\n", isPalindrome(n) ? "Palindrome" : "Not Palindrome");
    return 0;
}
`,
    cpp: String.raw`#include <iostream>
using namespace std;

bool isPalindrome(int n) {
    // Write Logic Here
    return false;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    if (!(cin >> n)) return 0;

    cout << (isPalindrome(n) ? "Palindrome" : "Not Palindrome") << '\n';
    return 0;
}
`,
    csharp: String.raw`using System;

class Program {
    static bool IsPalindrome(int n) {
        // Write Logic Here
        return false;
    }

    static void Main() {
        var data = Console.In.ReadToEnd()
            .Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries);
        if (data.Length == 0) return;

        Console.WriteLine(IsPalindrome(int.Parse(data[0])) ? "Palindrome" : "Not Palindrome");
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

func isPalindrome(n int) bool {
	// Write Logic Here
	return false
}

func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)
	sc.Split(bufio.ScanWords)

	if !sc.Scan() {
		return
	}

	n, err := strconv.Atoi(sc.Text())
	if err != nil {
		return
	}

	if isPalindrome(n) {
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
  starterCode: {
    python: String.raw`import sys


def search(nums, key):
    # Write Logic Here
    pass


def solve():
    data = sys.stdin.read().split()
    if not data:
        return

    n = int(data[0])
    nums = list(map(int, data[1:1 + n]))
    key = int(data[1 + n])
    print('Found' if search(nums, key) else 'Not Found')


if __name__ == "__main__":
    solve()
`,
    java: String.raw`import java.io.*;
import java.util.*;

public class Main {
    static boolean search(int[] arr, int key) {
        // Write Logic Here
        return false;
    }

    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));

        String first = br.readLine();
        if (first == null) return;
        int n = Integer.parseInt(first.trim());

        String[] parts = br.readLine().trim().split("\\s+");
        int[] nums = new int[Math.max(n, 1)];
        for (int i = 0; i < n && i < parts.length; i++) {
            nums[i] = Integer.parseInt(parts[i]);
        }
        int key = Integer.parseInt(br.readLine().trim());

        System.out.println(search(nums, key) ? "Found" : "Not Found");
    }
}
`,
    javascript: String.raw`const fs = require('fs');

function search(arr, key) {
  // Write Logic Here
  return false;
}

function solve() {
  const data = fs.readFileSync(0, 'utf-8').trim().split(/\s+/);
  if (!data.length || data[0] === '') return;

  const n = Number(data[0]);
  const nums = data.slice(1, 1 + n).map(Number);
  const key = Number(data[1 + n]);

  console.log(search(nums, key) ? 'Found' : 'Not Found');
}

solve();
`,
    c: String.raw`#include <stdio.h>
#include <stdlib.h>

int search(const int *arr, int n, int key) {
    // Write Logic Here
    return 0;
}

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 0;

    int *nums = malloc(sizeof(int) * (n > 0 ? n : 1));
    for (int i = 0; i < n; i++) {
        if (scanf("%d", &nums[i]) != 1) { free(nums); return 0; }
    }

    int key;
    if (scanf("%d", &key) != 1) { free(nums); return 0; }

    printf("%s\n", search(nums, n, key) ? "Found" : "Not Found");
    free(nums);
    return 0;
}
`,
    cpp: String.raw`#include <iostream>
#include <vector>
using namespace std;

bool search(const vector<int> &arr, int key) {
    // Write Logic Here
    return false;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    if (!(cin >> n)) return 0;

    vector<int> nums(n);
    for (int i = 0; i < n; i++) cin >> nums[i];

    int key;
    cin >> key;

    cout << (search(nums, key) ? "Found" : "Not Found") << '\n';
    return 0;
}
`,
    csharp: String.raw`using System;
using System.Linq;

class Program {
    static bool Search(int[] arr, int key) {
        // Write Logic Here
        return false;
    }

    static void Main() {
        var data = Console.In.ReadToEnd()
            .Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries);
        if (data.Length == 0) return;

        int n = int.Parse(data[0]);
        var nums = data.Skip(1).Take(n).Select(int.Parse).ToArray();
        int key = int.Parse(data[1 + n]);

        Console.WriteLine(Search(nums, key) ? "Found" : "Not Found");
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

func search(arr []int, key int) bool {
	// Write Logic Here
	return false
}

func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)
	sc.Split(bufio.ScanWords)

	if !sc.Scan() {
		return
	}

	n, err := strconv.Atoi(sc.Text())
	if err != nil {
		return
	}

	nums := make([]int, n)
	for i := 0; i < n; i++ {
		if !sc.Scan() {
			return
		}
		nums[i], err = strconv.Atoi(sc.Text())
		if err != nil {
			return
		}
	}

	if !sc.Scan() {
		return
	}
	key, err := strconv.Atoi(sc.Text())
	if err != nil {
		return
	}

	if search(nums, key) {
		fmt.Println("Found")
	} else {
		fmt.Println("Not Found")
	}
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
  starterCode: {
    python: String.raw`def second_largest(arr):
    pass
`,
    java: String.raw`public class Main {
    public static int secondLargest(int[] arr) {
        return 0;
    }

    public static void main(String[] args) {
    }
}
`,
    javascript: String.raw`function secondLargest(arr) {
  return 0;
}
`,
    c: String.raw`int secondLargest(int arr[], int n) {
    return 0;
}
`,
    cpp: String.raw`#include <vector>
using namespace std;

int secondLargest(const vector<int> &arr) {
    return 0;
}
`,
    csharp: String.raw`public class Program {
    public static int SecondLargest(int[] arr) {
        return 0;
    }

    public static void Main() {
    }
}
`,
    go: String.raw`func secondLargest(arr []int) int {
	return 0
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
  starterCode: {
    python: String.raw`def count_vowels(s):
    pass
`,
    java: String.raw`public class Main {
    public static int countVowels(String str) {
        return 0;
    }

    public static void main(String[] args) {
    }
}
`,
    javascript: String.raw`function countVowels(str) {
  return 0;
}
`,
    c: String.raw`int countVowels(char str[]) {
    return 0;
}
`,
    cpp: String.raw`#include <string>
using namespace std;

int countVowels(const string &str) {
    return 0;
}
`,
    csharp: String.raw`public class Program {
    public static int CountVowels(string str) {
        return 0;
    }

    public static void Main() {
    }
}
`,
    go: String.raw`func countVowels(str string) int {
	return 0
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
  starterCode: {
    python: String.raw`def move_zeros(arr):
    pass
`,
    java: String.raw`public class Main {
    public static void moveZeros(int[] arr) {
    }

    public static void main(String[] args) {
    }
}
`,
    javascript: String.raw`function moveZeros(arr) {
  return arr;
}
`,
    c: String.raw`void moveZeros(int arr[], int n) {
}
`,
    cpp: String.raw`#include <vector>
using namespace std;

void moveZeros(vector<int> &arr) {
}
`,
    csharp: String.raw`public class Program {
    public static void MoveZeros(int[] arr) {
    }

    public static void Main() {
    }
}
`,
    go: String.raw`func moveZeros(arr []int) {
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

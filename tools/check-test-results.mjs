// Shared acceptance rule for course examples: every expected test must run and pass.
export function testResultProblems(result, expectedCount) {
  const problems = [];
  if (!Number.isInteger(expectedCount) || expectedCount < 1) {
    problems.push('expectTests must be a positive integer');
  }
  if (result.error) problems.push(`Build failed: ${result.error.message}`);
  if (result.results.length !== expectedCount) {
    problems.push(`Expected ${expectedCount} tests, got ${result.results.length}`);
  }
  for (const test of result.results) {
    for (const issue of test.issues) problems.push(`${test.name}: ${issue.msg}`);
  }
  return problems;
}

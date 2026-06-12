import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

type Finding = {
  file: string;
  lineNumber: number;
  rule: string;
};

const trackedFiles = () =>
  execFileSync('git', ['ls-files', '-z'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean);

const allowedValueHints = [
  'dummy',
  'placeholder',
  'example',
  'change_me',
  'changeme',
  'your-',
  'your_',
  'localhost',
  '127.0.0.1',
  '${',
  'process.env',
  '<',
];

const shouldIgnoreLine = (line: string) => {
  const lower = line.toLowerCase();
  return allowedValueHints.some((hint) => lower.includes(hint));
};

const rules: Array<{ name: string; pattern: RegExp }> = [
  { name: 'AWS access key id', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'AWS secret access key', pattern: /\bAWS_SECRET_ACCESS_KEY\b\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}["']?/i },
  { name: 'OpenAI API key', pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/ },
  { name: 'private key block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
  { name: 'database URL with password', pattern: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i },
  { name: 'Redis URL with password', pattern: /redis:\/\/[^:\s]+:[^@\s]+@/i },
  { name: 'JWT secret literal', pattern: /\bJWT_SECRET\b\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{32,}["']?/i },
];

const scanFile = (file: string): Finding[] => {
  const content = readFileSync(file, 'utf8');
  return content.split(/\r?\n/).flatMap((line, index) => {
    if (shouldIgnoreLine(line)) return [];
    return rules
      .filter((rule) => rule.pattern.test(line))
      .map((rule) => ({
        file,
        lineNumber: index + 1,
        rule: rule.name,
      }));
  });
};

const findings = trackedFiles()
  .filter((file) => !file.includes('node_modules/'))
  .filter((file) => !file.includes('.next/'))
  .filter((file) => !file.endsWith('package-lock.json'))
  .flatMap(scanFile);

if (findings.length) {
  console.error('Potential committed secrets detected:');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.lineNumber} (${finding.rule})`);
  }
  process.exit(1);
}

console.log('No committed secrets detected.');

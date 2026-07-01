import fs from 'node:fs';
import path from 'node:path';

type Finding = {
  file: string;
  line: number;
  snippet: string;
};

const backendRoot = path.basename(process.cwd()) === 'backend' ? process.cwd() : path.join(process.cwd(), 'backend');
const sourceRoot = path.join(backendRoot, 'src');

const scanRoots = [
  'controllers',
  'services',
  'modules',
].map((entry) => path.join(sourceRoot, entry));

const highRiskPathPattern = /(student|parent|attendance|audit|import|export|report|notification|leave|homework|fee|payment|invoice|dormitory)/i;
const highCardinalityFindManyPattern =
  /\.(student|parentProfile|attendanceSession|attendanceRecord|mark|feeInvoice|feePayment|notificationLog|auditLog|importJob|importRowError|leaveApplication|homework|studentDormitoryAssignment)\.findMany\(/i;
const safeWindowPattern = /\btake\s*:|\.\.\.pageArgs\b|\.\.\.cursorPrismaArgs\b|pagination\.limit|payload\.limit|params\.limit|query\.pageSize|DEFAULT_EXPORT_ROW_LIMIT|DEFAULT_NESTED_LIST_LIMIT/i;

const collectTsFiles = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['__tests__', 'tests', 'repositories'].includes(entry.name)) return [];
      return collectTsFiles(fullPath);
    }
    if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) return [];
    return [fullPath];
  });
};

const inspectFile = (file: string): Finding[] => {
  const rel = path.relative(backendRoot, file);
  if (!highRiskPathPattern.test(rel)) return [];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const findings: Finding[] = [];

  lines.forEach((line, index) => {
    if (!highCardinalityFindManyPattern.test(line)) return;
    const window = lines.slice(index, index + 30).join('\n');
    if (safeWindowPattern.test(window)) return;
    findings.push({
      file: rel,
      line: index + 1,
      snippet: line.trim(),
    });
  });

  return findings;
};

const findings = scanRoots.flatMap(collectTsFiles).flatMap(inspectFile);

console.log('Academify scalability audit');
console.log(`Scanned ${scanRoots.map((root) => path.relative(backendRoot, root)).join(', ')}`);

if (!findings.length) {
  console.log('No advisory unbounded findMany candidates found in high-risk paths.');
  process.exit(0);
}

console.log(`Advisory unbounded findMany candidates: ${findings.length}`);
console.log('This script is advisory in Phase 2D and exits 0. Review candidates before changing behavior.');
findings.slice(0, 25).forEach((finding) => {
  console.log(`- ${finding.file}:${finding.line} ${finding.snippet}`);
});
if (findings.length > 25) {
  console.log(`- ... ${findings.length - 25} more candidate(s) omitted`);
}

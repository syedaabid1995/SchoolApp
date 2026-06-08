import OpenAI from 'openai';
import { env } from '../config/env';
import type { AiOperation, AiOperationPlan, AiPlannerFollowUp, AiPlannerResult } from '../types/aiAssistant.types';
import { buildSchemaPrompt } from './aiEntityRegistry.service';

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
const sectionName = (value: string) => normalize(value).replace(/^section\s+/i, '').toUpperCase();

const formatClassName = (value: string) => {
  const text = normalize(value).replace(/[.?!,;:]+$/g, '');
  if (/^class\s+/i.test(text)) return text.replace(/^class/i, 'Class');
  return `Class ${text}`;
};

const readPlan = (summary: string, operations: AiOperation[], preview: string[]): AiOperationPlan => ({
  type: 'operation_plan',
  status: 'READ_ONLY_EXECUTABLE',
  summary,
  risk: 'LOW',
  operations,
  preview,
});

const writePreviewPlan = (summary: string, operations: AiOperation[], preview: string[]): AiOperationPlan => ({
  type: 'operation_plan',
  status: 'WRITE_PREVIEW_ONLY',
  summary,
  risk: operations.reduce((total, operation) => total + (Array.isArray(operation.data) ? operation.data.length : 1), 0) > 10 ? 'MEDIUM' : 'LOW',
  operations,
  preview,
});

const classRange = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => ({ name: `Class ${from + index}` }));

const followUp = (message: string, missingFields: string[]): AiPlannerFollowUp => ({
  type: 'follow_up',
  message,
  missingFields,
  risk: 'LOW',
});

const parseDate = (value: string): string | null => {
  const text = normalize(value).replace(/^["']|["']$/g, '').replace(/[.?!,;:]+$/g, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(text)) return null;
  const match = text.match(/^(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})$/i);
  if (!match) return null;
  const monthMap: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
    jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };
  const month = monthMap[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const parseList = (value: string) =>
  normalize(value)
    .replace(/^["']|["']$/g, '')
    .split(/\s*(?:,|\/|and)\s*/i)
    .map((entry) => entry.trim())
    .map((entry) => entry.replace(/^["']|["']$/g, ''))
    .filter(Boolean);

const classNamesForRange = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => `Class ${from + index}`);

const classSectionMappings = (classNames: string[], sections: string[]) =>
  classNames.flatMap((className) => sections.map((section) => ({ className, sectionName: section })));

const academicSetupClauses = (message: string) =>
  message
    .replace(/\r\n/g, '\n')
    .replace(/[;\n]+/g, ';')
    .replace(/\.\s+(?=(?:create|add|map)\b)/gi, ';')
    .replace(/\s*,\s*(?=(?:create|add|map)\b)/gi, ';')
    .replace(/\s+\band\s+(?=(?:create|add|map)\b)/gi, ';')
    .replace(/\s*,?\s+\band\s+(?=only\s+section\b)/gi, ';map ')
    .replace(/\s+(?=map\s+(?:only\b|sections?\b|[A-Za-z0-9]+(?:\s*\/\s*[A-Za-z0-9]+)+))/gi, ';')
    .split(';')
    .map((clause) => normalize(clause).replace(/[.?!]+$/g, ''))
    .filter(Boolean);

const localAcademicSetupWritePlan = (message: string): AiPlannerResult | null => {
  const clauses = academicSetupClauses(message);
  if (
    !clauses.some((clause) =>
      /^(?:create|add)\s+(?:(?:an?\s+)?academic\s+year|classes?|sections?)\b/i.test(clause) || /^map\b/i.test(clause),
    )
  ) return null;

  const operations: AiOperation[] = [];
  const preview: string[] = [];
  let latestSections: string[] = [];
  let hasAcademicSetupClause = false;

  for (const clause of clauses) {
    let match = clause.match(/^create\s+(?:an?\s+)?academic\s+year\s+"?([\w -]+)"?.*?(?:starting|start|from)\s+(?:date\s+)?("?[\w -]+"?)\s+(?:to|through|until)\s+("?[\w -]+"?)$/i);
    if (match) {
      const name = normalize(match[1]).replace(/^["']|["']$/g, '');
      const startDate = parseDate(match[2]);
      const endDate = parseDate(match[3]);
      const missing = [
        ...(!startDate ? ['unambiguous start date'] : []),
        ...(!endDate ? ['unambiguous end date'] : []),
      ];
      if (missing.length) {
        return followUp(`I need ${missing.join(' and ')} before I can prepare that academic year. Please use a format like 2027-01-01.`, missing);
      }
      hasAcademicSetupClause = true;
      operations.push({ action: 'createRecord', entity: 'AcademicYear', data: { name, startDate, endDate } });
      preview.push(`Create academic year ${name}`);
      continue;
    }

    if (/^(?:create|add)\s+(?:an?\s+)?academic\s+year\b/i.test(clause)) {
      return followUp('I need the academic year name, start date, and end date before I can prepare that. For example: create academic year 2027-2028 starting 2027-01-01 to 2028-12-31.', ['name', 'startDate', 'endDate']);
    }

    match = clause.match(/^(?:create|add)\s+classes?\s+(?:between|from)?\s*"?(\d+)\s*(?:and|to|through|-)\s*(\d+)"?$/i);
    if (match) {
      const from = Number(match[1]);
      const to = Number(match[2]);
      hasAcademicSetupClause = true;
      operations.push({ action: 'bulkCreateRecords', entity: 'Class', data: classRange(from, to) });
      preview.push(`Create Class ${from} to Class ${to}`);
      continue;
    }

    match = clause.match(/^(?:create|add)\s+sections?\s+(.+)$/i);
    if (match) {
      const sections = parseList(match[1]).map(sectionName);
      if (!sections.length) return followUp('Which section names should I create?', ['name']);
      latestSections = sections;
      hasAcademicSetupClause = true;
      operations.push({ action: 'bulkCreateRecords', entity: 'Section', data: sections.map((name) => ({ name })) });
      preview.push(`Create sections ${sections.join(', ')}`);
      continue;
    }

    match = clause.match(/^map\s+only\s+(?:section\s+)?"?([\w-]+)"?\s+to\s+classes?\s+"?(\d+)\s*(?:to|through|-)\s*(\d+)"?$/i);
    if (match) {
      const section = sectionName(match[1]);
      const from = Number(match[2]);
      const to = Number(match[3]);
      hasAcademicSetupClause = true;
      const mappings = classSectionMappings(classNamesForRange(from, to), [section]);
      operations.push({ action: 'linkRecords', entity: 'ClassSection', data: mappings });
      preview.push(`Map section ${section} to Class ${from} to Class ${to}`);
      continue;
    }

    match = clause.match(/^map\s+only\s+(?:section\s+)?"?([\w-]+)"?\s+from\s+class\s+(\d+)\s+onwards$/i);
    if (match) {
      const section = sectionName(match[1]);
      const from = Number(match[2]);
      const to = 12;
      hasAcademicSetupClause = true;
      const mappings = classSectionMappings(classNamesForRange(from, to), [section]);
      operations.push({ action: 'linkRecords', entity: 'ClassSection', data: mappings });
      preview.push(`Map section ${section} to Class ${from} to Class ${to}`);
      continue;
    }

    match = clause.match(/^map\s+(?:(?:sections?|section)\s+)?"?(.+?)"?\s+to\s+classes?\s+"?(\d+)\s*(?:to|through|-)\s*(\d+)"?$/i);
    if (match) {
      const sections = /^them$/i.test(normalize(match[1])) ? latestSections : parseList(match[1]).map(sectionName);
      if (!sections.length) {
        return followUp('Which sections should I map to the classes?', ['sectionName']);
      }
      const from = Number(match[2]);
      const to = Number(match[3]);
      hasAcademicSetupClause = true;
      const mappings = classSectionMappings(classNamesForRange(from, to), sections);
      operations.push({ action: 'linkRecords', entity: 'ClassSection', data: mappings });
      preview.push(`Map sections ${sections.join(', ')} to Class ${from} to Class ${to}`);
      continue;
    }

    if (/^map\b/i.test(clause)) {
      return followUp('Which sections and class range should I use for this mapping?', ['sectionName', 'classRange']);
    }
  }

  if (!hasAcademicSetupClause || !operations.length) return null;
  const sectionCreates = operations
    .filter((operation) => operation.entity === 'Section')
    .reduce((total, operation) => total + (Array.isArray(operation.data) ? operation.data.length : 1), 0);
  const mappings = operations
    .filter((operation) => operation.entity === 'ClassSection')
    .reduce((total, operation) => total + (Array.isArray(operation.data) ? operation.data.length : 1), 0);
  return writePreviewPlan(
    `Prepare academic setup changes: ${sectionCreates} sections and ${mappings} class-section mappings.`,
    operations,
    preview,
  );
};

const localOperationPlan = (message: string): AiPlannerResult | null => {
  const text = message.trim();

  if (/classes?\s+without\s+sections?/i.test(text)) {
    return readPlan(
      'List classes without section mappings.',
      [{ action: 'findRecords', entity: 'Class', filters: [{ field: 'classSections', op: 'none', value: true }], limit: 100 }],
      ['Find classes with no class-section mappings'],
    );
  }

  if (/classes?\s+without\s+subjects?/i.test(text)) {
    return readPlan(
      'List classes without subject assignments.',
      [{ action: 'findRecords', entity: 'Class', filters: [{ field: 'assignSubjects', op: 'none', value: true }], limit: 100 }],
      ['Find classes with no subject assignments'],
    );
  }

  if (/sections?\s+(?:not\s+mapped|without\s+classes?|without\s+mappings?)/i.test(text)) {
    return readPlan(
      'List sections not mapped to classes.',
      [{ action: 'findRecords', entity: 'Section', filters: [{ field: 'classSections', op: 'none', value: true }], limit: 100 }],
      ['Find sections with no class-section mappings'],
    );
  }

  if (/(show|list).*(academic years?|years? exist)/i.test(text) || /what academic years? exist/i.test(text)) {
    return readPlan(
      'List academic years.',
      [{ action: 'findRecords', entity: 'AcademicYear', limit: 50 }],
      ['Find academic years'],
    );
  }

  if (/(setup status|setup is missing|what setup is missing|what setup is pending)/i.test(text)) {
    return readPlan(
      'Review academic setup status.',
      [
        { action: 'findRecords', entity: 'AcademicYear', limit: 25 },
        { action: 'findRecords', entity: 'Class', limit: 100 },
        { action: 'findRecords', entity: 'Section', limit: 100 },
        { action: 'findRecords', entity: 'Subject', limit: 100 },
        { action: 'findRecords', entity: 'ClassSection', limit: 100 },
      ],
      ['Review academic years, classes, sections, subjects, and mappings'],
    );
  }

  let match = text.match(/(?:show|list)\s+sections?\s+(?:for|in)\s+(class\s+[\w -]+|\d+)/i);
  if (match) {
    const className = formatClassName(match[1]);
    return readPlan(
      `List sections for ${className}.`,
      [{ action: 'findRecords', entity: 'ClassSection', filters: [{ field: 'class.name', op: 'equals', value: className }], limit: 100 }],
      [`Find section mappings for ${className}`],
    );
  }

  if (/(show|list).*(class|classes)/i.test(text)) {
    return readPlan(
      'List classes.',
      [{ action: 'findRecords', entity: 'Class', limit: 100 }],
      ['Find classes'],
    );
  }

  if (/(show|list).*sections/i.test(text)) {
    return readPlan(
      'List sections.',
      [{ action: 'findRecords', entity: 'Section', limit: 100 }],
      ['Find sections'],
    );
  }

  if (/(show|list).*subjects/i.test(text)) {
    return readPlan(
      'List subjects.',
      [{ action: 'findRecords', entity: 'Subject', limit: 100 }],
      ['Find subjects'],
    );
  }

  const academicSetupWritePlan = localAcademicSetupWritePlan(text);
  if (academicSetupWritePlan) return academicSetupWritePlan;

  match = text.match(/create\s+(?:an?\s+)?academic\s+year\s+"?([\w -]+)"?.*?(?:starting|start|from)\s+(?:date\s+)?(.+?)\s+(?:to|through|until)\s+(.+)$/i);
  if (match) {
    const name = normalize(match[1]);
    const startDate = parseDate(match[2]);
    const endDate = parseDate(match[3]);
    const missing = [
      ...(!startDate ? ['unambiguous start date'] : []),
      ...(!endDate ? ['unambiguous end date'] : []),
    ];
    if (missing.length) {
      return followUp(`I need ${missing.join(' and ')} before I can prepare that academic year. Please use a format like 2027-01-01.`, missing);
    }
    return writePreviewPlan(
      `Prepare academic year ${name}.`,
      [{ action: 'createRecord', entity: 'AcademicYear', data: { name, startDate, endDate } }],
      [`Create academic year ${name}`],
    );
  }

  if (/\b(add|create)\b.*academic\s+year/i.test(text)) {
    return followUp('I need the academic year name, start date, and end date before I can prepare that. For example: create academic year 2027-2028 starting 2027-01-01 to 2028-12-31.', ['name', 'startDate', 'endDate']);
  }

  if (/setup\s+primary\s+school\s+classes/i.test(text)) {
    return followUp('Which class range and academic year should I use for primary school setup? For example: create classes 1 to 5 for academic year 2027-2028.', ['classRange', 'academicYearName']);
  }

  match = text.match(/classes?\s+(?:between|from)\s+(?:class\s+)?(\d+)\s+(?:and|to)\s+(?:class\s+)?(\d+)/i);
  if (/create|add/i.test(text) && match) {
    const from = Number(match[1]);
    const to = Number(match[2]);
    return writePreviewPlan(
      `Prepare classes ${from}-${to}.`,
      [{ action: 'bulkCreateRecords', entity: 'Class', data: classRange(from, to) }],
      [`Create Class ${from} to Class ${to}`],
    );
  }

  match = text.match(/(?:create|add)\s+sections?\s+(.+)$/i);
  if (match) {
    const sections = parseList(match[1]).map(sectionName);
    if (!sections.length) return followUp('Which section names should I create?', ['name']);
    return writePreviewPlan(
      `Prepare sections ${sections.join(', ')}.`,
      [{ action: 'bulkCreateRecords', entity: 'Section', data: sections.map((name) => ({ name })) }],
      [`Create sections ${sections.join(', ')}`],
    );
  }

  match = text.match(/map\s+sections?\s+(.+?)\s+to\s+classes?\s+(\d+)\s+(?:to|through|-)\s+(\d+)/i);
  if (match) {
    const primarySections = parseList(match[1]).map(sectionName);
    const from = Number(match[2]);
    const to = Number(match[3]);
    const firstRange = classNamesForRange(from, to);
    const mappings = classSectionMappings(firstRange, primarySections);
    const suffix = text.match(/only\s+section\s+([\w-]+)\s+from\s+class\s+(\d+)\s+onwards/i);
    const onlySection = suffix?.[1] ? sectionName(suffix[1]) : null;
    const onlyFrom = suffix?.[2] ? Number(suffix[2]) : null;
    if (onlySection && onlyFrom) {
      mappings.push(...classSectionMappings(classNamesForRange(onlyFrom, 12), [onlySection]));
    }
    return writePreviewPlan(
      `Prepare ${mappings.length} class-section mappings.`,
      [{ action: 'linkRecords', entity: 'ClassSection', data: mappings }],
      [`Map sections by class rules (${mappings.length} mappings)`],
    );
  }

  match = text.match(/create\s+academic\s+year\s+([\w -]+).*?classes?\s+(\d+)\s*-\s*(\d+).*?sections?\s+(.+?)\s*,?\s*map\s+(.+)/i);
  if (match) {
    const name = normalize(match[1].replace(/,$/, ''));
    return followUp(
      `I can prepare the full setup for academic year ${name}, but I need the academic year start date and end date first. Please use YYYY-MM-DD dates.`,
      ['startDate', 'endDate'],
    );
  }

  match = text.match(/create\s+subjects?\s+(.+?)\s+and\s+assign\s+them\s+to\s+classes?\s+(\d+)\s+(?:to|-)\s+(\d+)/i);
  if (match) {
    return followUp('I can prepare the subjects, but assigning subjects requires class, section, and teacher information. Which section and teacher should I use?', ['sectionName', 'teacherName']);
  }

  match = text.match(/(?:create|add)\s+subjects?\s+(.+)$/i);
  if (match) {
    const subjects = parseList(match[1]).map((name) => normalize(name));
    if (!subjects.length) return followUp('Which subject names should I create?', ['name']);
    return writePreviewPlan(
      `Prepare subjects ${subjects.join(', ')}.`,
      [{ action: 'bulkCreateRecords', entity: 'Subject', data: subjects.map((name) => ({ name, type: 'THEORY' })) }],
      [`Create subjects ${subjects.join(', ')}`],
    );
  }

  return null;
};

const openAiOperationPlan = async (message: string): Promise<AiPlannerResult | null> => {
  if (!env.AI_ASSISTANT_ENABLED || !env.OPENAI_API_KEY) return null;
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          `Return only JSON for a school ERP operation plan. Use this schema map:\n${buildSchemaPrompt()}\n` +
          'Allowed output shapes: {"type":"operation_plan","status":"READ_ONLY_EXECUTABLE|WRITE_PREVIEW_ONLY","summary":"...","risk":"LOW|MEDIUM|HIGH","operations":[...],"preview":[...]} or {"type":"follow_up","message":"...","missingFields":[...],"risk":"LOW"}. ' +
          'Only use listed entities/actions/fields. Writes are preview only. Never generate SQL. If required information is missing, return follow_up and do not invent values or IDs.',
      },
      { role: 'user', content: message },
    ],
  });
  const raw = completion.choices[0]?.message.content;
  if (!raw) return null;
  const parsed = JSON.parse(raw) as AiPlannerResult;
  if (parsed.type !== 'operation_plan' && parsed.type !== 'follow_up') return null;
  return parsed;
};

export const planAiOperations = async (message: string): Promise<AiPlannerResult | null> => {
  console.log('Planning AI operations for message:', message);
  const local = localOperationPlan(message);
  if (local) return local;
  // try {
  //   console.log('Falling back to OpenAI for operation plan.');
  //   return await openAiOperationPlan(message);
  // } catch {
  //   return null;
  // }
};

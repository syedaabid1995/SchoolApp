import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { IdCardTemplate } from '../../../../id_cards/types';

const templatesDir = path.join(process.cwd(), 'id_cards', 'templates');

export async function GET() {
  try {
    const files = await fs.readdir(templatesDir);
    const templates: IdCardTemplate[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const raw = await fs.readFile(path.join(templatesDir, file), 'utf-8');
      const parsed = JSON.parse(raw) as IdCardTemplate;
      if (!parsed?.slug || !parsed?.name || !parsed?.variant) continue;
      templates.push(parsed);
    }

    templates.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json(templates);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load templates', details: String(error) }, { status: 500 });
  }
}

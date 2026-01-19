import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

const emailsPath = path.resolve(process.cwd(), '../emails.json');
const sentEmailsPath = path.resolve(process.cwd(), '../emailsdisparados.json');

interface Company {
  name: string;
  email: string;
  source: string;
  keyword: string;
  collectedAt: string;
  sentAt?: string;
}

interface EmailData {
  companies: Company[];
}

async function loadEmails(filePath: string): Promise<Company[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data: EmailData = JSON.parse(content);
    return data.companies;
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const [pending, sent] = await Promise.all([
      loadEmails(emailsPath),
      loadEmails(sentEmailsPath),
    ]);

    return NextResponse.json({
      pending,
      sent,
      stats: {
        pendingCount: pending.length,
        sentCount: sent.length,
        totalCount: pending.length + sent.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao carregar emails' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'pending';
    
    const emptyData: EmailData = { companies: [] };
    
    if (type === 'sent') {
      await fs.writeFile(sentEmailsPath, JSON.stringify(emptyData, null, 2), 'utf-8');
      return NextResponse.json({ message: 'Emails enviados limpos com sucesso' });
    } else {
      await fs.writeFile(emailsPath, JSON.stringify(emptyData, null, 2), 'utf-8');
      return NextResponse.json({ message: 'Emails pendentes limpos com sucesso' });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao limpar emails' },
      { status: 500 }
    );
  }
}

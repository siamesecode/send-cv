import { NextRequest } from 'next/server';
import nodemailer from 'nodemailer';
import * as fs from 'fs/promises';
import * as path from 'path';
import dotenv from 'dotenv';

// Load env from parent directory
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const emailsPath = path.resolve(process.cwd(), '../emails.json');
const sentEmailsPath = path.resolve(process.cwd(), '../emailsdisparados.json');
const templatePath = path.resolve(process.cwd(), '../templates/email-template.html');
const cvPath = path.resolve(process.cwd(), '../curriculo.pdf');

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

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { emailIds, subject, customHtml } = body;

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Load pending emails
        const allEmails = await loadEmails(emailsPath);
        
        // Filter by selected IDs or send all
        const emailsToSend = emailIds && emailIds.length > 0
          ? allEmails.filter(e => emailIds.includes(e.email))
          : allEmails;

        if (emailsToSend.length === 0) {
          send('error', { message: 'Nenhum email para enviar' });
          controller.close();
          return;
        }

        // Load email template
        let htmlContent = customHtml || '<h1>Olá!</h1><p>Gostaria de apresentar meu currículo.</p>';
        try {
          if (!customHtml) {
            htmlContent = await fs.readFile(templatePath, 'utf-8');
          }
        } catch {
          // Use default template
        }

        // Check for CV attachment
        const attachments: Array<{ filename: string; path: string }> = [];
        try {
          await fs.access(cvPath);
          attachments.push({ filename: 'curriculo.pdf', path: cvPath });
          send('status', { message: 'Currículo anexado', phase: 'preparing' });
        } catch {
          send('status', { message: 'Nenhum currículo encontrado, enviando sem anexo', phase: 'preparing' });
        }

        // Configure transporter
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        // Verify connection
        try {
          await transporter.verify();
          send('status', { message: 'Conexão SMTP verificada', phase: 'connected' });
        } catch (error) {
          send('error', { message: `Erro na conexão SMTP: ${error}` });
          controller.close();
          return;
        }

        const sentEmails: string[] = [];
        let sent = 0;
        let failed = 0;
        const delayMs = parseInt(process.env.EMAIL_DELAY || '2000');

        for (let i = 0; i < emailsToSend.length; i++) {
          const company = emailsToSend[i];
          
          send('sending', { 
            email: company.email, 
            index: i, 
            total: emailsToSend.length,
            company: company.name
          });

          try {
            await transporter.sendMail({
              from: process.env.EMAIL_FROM || process.env.SMTP_USER,
              to: company.email,
              subject: subject || 'Oportunidade Profissional - Desenvolvedor',
              html: htmlContent,
              attachments,
            });

            sent++;
            sentEmails.push(company.email);
            send('sent', { email: company.email, company });
          } catch (error) {
            failed++;
            send('failed', { email: company.email, error: String(error) });
          }

          if (i < emailsToSend.length - 1) {
            await delay(delayMs);
          }
        }

        // Move sent emails to sentEmails file
        if (sentEmails.length > 0) {
          const currentEmails = await loadEmails(emailsPath);
          let sentData: EmailData = { companies: [] };
          
          try {
            const sentContent = await fs.readFile(sentEmailsPath, 'utf-8');
            sentData = JSON.parse(sentContent);
          } catch {
            // File doesn't exist
          }

          const sentCompanies: Company[] = [];
          const remainingCompanies: Company[] = [];

          for (const company of currentEmails) {
            if (sentEmails.includes(company.email)) {
              sentCompanies.push({
                ...company,
                sentAt: new Date().toISOString()
              });
            } else {
              remainingCompanies.push(company);
            }
          }

          sentData.companies.push(...sentCompanies);
          
          await fs.writeFile(sentEmailsPath, JSON.stringify(sentData, null, 2), 'utf-8');
          await fs.writeFile(emailsPath, JSON.stringify({ companies: remainingCompanies }, null, 2), 'utf-8');
        }

        send('complete', { sent, failed, sentEmails });

      } catch (error) {
        send('error', { message: String(error) });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

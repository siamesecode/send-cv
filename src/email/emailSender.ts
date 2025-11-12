import nodemailer, { Transporter } from 'nodemailer';
import { Company } from '../types';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface EmailMessage {
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    path: string;
  }>;
}

export class EmailSender {
  private transporter: Transporter;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
    });
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('Conexão com servidor SMTP verificada');
      return true;
    } catch (error) {
      console.error('Erro ao conectar com servidor SMTP:', error);
      return false;
    }
  }

  async sendEmail(to: string, message: EmailMessage): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments,
      });

      console.log(`Email enviado para: ${to}`);
      return true;
    } catch (error) {
      console.error(`Erro ao enviar email para ${to}:`, error);
      return false;
    }
  }

  async sendBulkEmails(
    companies: Company[],
    message: EmailMessage,
    delayMs: number = 2000
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    console.log(`Iniciando envio em massa para ${companies.length} destinatários...`);

    for (const company of companies) {
      const success = await this.sendEmail(company.email, message);
      
      if (success) {
        sent++;
      } else {
        failed++;
      }

      if (delayMs > 0) {
        await this.delay(delayMs);
      }
    }

    console.log(`\nResumo do envio:`);
    console.log(`   Enviados: ${sent}`);
    console.log(`   Falhas: ${failed}`);

    return { sent, failed };
  }

  async sendTestEmail(testAddress: string, attachments?: Array<{filename: string; path: string}>): Promise<boolean> {
    const fs = require('fs');
    const path = require('path');
    
    let htmlContent = '<h1>Email de Teste</h1><p>Este é um email de teste da automação de envio de emails.</p>';
    let textContent = 'Este é um email de teste da automação de envio de emails.';
    
    try {
      const htmlTemplatePath = path.resolve(process.cwd(), 'templates/email-template.html');
      const txtTemplatePath = path.resolve(process.cwd(), 'templates/email-template.txt');
      
      if (fs.existsSync(htmlTemplatePath)) {
        htmlContent = fs.readFileSync(htmlTemplatePath, 'utf-8');
        console.log('   Template HTML carregado');
      }
      
      if (fs.existsSync(txtTemplatePath)) {
        textContent = fs.readFileSync(txtTemplatePath, 'utf-8');
        console.log('   Template texto carregado');
      }
    } catch (error) {
      console.log('   Usando template padrão');
    }
    
    const testMessage: EmailMessage = {
      subject: 'Email de Teste - Automação',
      text: textContent,
      html: htmlContent,
      attachments: attachments,
    };

    return await this.sendEmail(testAddress, testMessage);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

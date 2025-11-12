import dotenv from 'dotenv';
import { EmailConfig } from './email/emailSender';

dotenv.config();

export const config = {
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    from: process.env.EMAIL_FROM || '',
  } as EmailConfig,
  
  search: {
    maxResultsPerKeyword: parseInt(process.env.MAX_RESULTS_PER_KEYWORD || '10'),
  },
  
  sending: {
    delayBetweenSends: parseInt(process.env.DELAY_BETWEEN_SENDS || '2000'),
  },
  
  storage: {
    emailsFile: process.env.EMAILS_FILE || 'emails.json',
  },
};

export function validateConfig(): boolean {
  if (!config.smtp.auth.user || !config.smtp.auth.pass) {
    console.error('❌ Configurações SMTP não encontradas. Configure as variáveis SMTP_USER e SMTP_PASS no arquivo .env');
    return false;
  }
  
  if (!config.smtp.from) {
    console.error('❌ Email remetente não configurado. Configure a variável EMAIL_FROM no arquivo .env');
    return false;
  }
  
  return true;
}

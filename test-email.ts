import { EmailSender } from './src/email/emailSender';
import { config, validateConfig } from './src/config';
import * as fs from 'fs';
import * as path from 'path';

async function sendTestEmail() {
  // Validar configuração
  if (!validateConfig()) {
    console.error('Configuração inválida. Verifique o arquivo .env');
    process.exit(1);
  }

  // Criar instância do sender
  const sender = new EmailSender(config.smtp);

  // Verificar conexão
  console.log('Verificando conexão com servidor SMTP...');
  const connected = await sender.verifyConnection();
  
  if (!connected) {
    console.error('Não foi possível conectar ao servidor SMTP');
    process.exit(1);
  }

  // Ler template de email
  const templatePath = path.join(__dirname, 'templates', 'email-template.html');
  const htmlTemplate = fs.existsSync(templatePath) 
    ? fs.readFileSync(templatePath, 'utf-8')
    : '<h1>Email de Teste</h1><p>Este é um email de teste do sistema.</p>';

  // Preparar mensagem
  const message = {
    subject: '✅ Email de Teste - Sistema Send CV',
    html: htmlTemplate,
    text: 'Este é um email de teste do sistema Send CV.',
    attachments: [
      {
        filename: 'curriculo.pdf',
        path: path.join(__dirname, 'curriculo.pdf')
      }
    ]
  };

  // Enviar email
  console.log('\nEnviando email de teste para: apoiagatos@gmail.com');
  console.log('Anexo: curriculo.pdf');
  const success = await sender.sendEmail('apoiagatos@gmail.com', message);

  if (success) {
    console.log('✅ Email de teste enviado com sucesso!');
    process.exit(0);
  } else {
    console.log('❌ Falha ao enviar email de teste');
    process.exit(1);
  }
}

sendTestEmail().catch(error => {
  console.error('Erro:', error);
  process.exit(1);
});

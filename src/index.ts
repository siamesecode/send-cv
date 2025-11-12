#!/usr/bin/env node
import { Command } from 'commander';
import { EmailScraper } from './scraper/emailScraper';
import { StorageService } from './storage/storageService';
import { EmailSender, EmailMessage } from './email/emailSender';
import { config, validateConfig } from './config';
import { gerarTermosBusca, cidadesPrincipais } from './scraper/termosBusca';
import * as readline from 'readline/promises';

const program = new Command();

program
  .name('email-automation')
  .description('Automação para coletar e enviar emails')
  .version('1.0.0');

// Comando: Coletar emails
program
  .command('collect')
  .description('Coletar emails do Google usando palavras-chave')
  .option('-k, --keywords <keywords...>', 'Palavras-chave para busca (separadas por espaço)')
  .option('-m, --max <number>', 'Máximo de resultados por palavra-chave', String(config.search.maxResultsPerKeyword))
  .action(async (options) => {
    try {
      const keywords = options.keywords || ['tecnologia'];
      const maxResults = parseInt(options.max);

      console.log('Iniciando coleta de emails...');
      console.log(`Palavras-chave: ${keywords.join(', ')}`);
      console.log(`Máximo por palavra-chave: ${maxResults}\n`);

      const scraper = new EmailScraper();
      await scraper.initialize();

      const companies = await scraper.searchEmails(keywords, maxResults);
      await scraper.close();

      if (companies.length === 0) {
        console.log('Nenhum email encontrado');
        return;
      }

      const storage = new StorageService(config.storage.emailsFile);
      await storage.saveEmails(companies);

      console.log('\nColeta finalizada!');
    } catch (error) {
      console.error('Erro durante a coleta:', error);
      process.exit(1);
    }
  });

// Comando: Coletar emails por cidade
program
  .command('collect-city')
  .description('Coletar emails de empresas de tecnologia por cidade')
  .option('-c, --city <city>', 'Nome da cidade (ex: São Paulo, Rio de Janeiro)')
  .option('-m, --max <number>', 'Máximo de emails a coletar', '20')
  .action(async (options) => {
    try {
      const cidade = options.city;
      const maxResults = parseInt(options.max);

      if (!cidade) {
        console.log('Por favor, especifique uma cidade com -c "Nome da Cidade"');
        console.log('\nCidades disponíveis:');
        cidadesPrincipais.forEach(c => console.log(`   - ${c}`));
        return;
      }

      console.log('Iniciando coleta de emails...');
      console.log(`Cidade: ${cidade}`);
      console.log(`Máximo de emails: ${maxResults}\n`);

      const termos = gerarTermosBusca(cidade);
      console.log(`${termos.length} termos de busca serão usados\n`);

      const scraper = new EmailScraper();
      await scraper.initialize();

      const companies = await scraper.searchEmails(termos, maxResults);
      await scraper.close();

      if (companies.length === 0) {
        console.log('Nenhum email encontrado');
        return;
      }

      const storage = new StorageService(config.storage.emailsFile);
      await storage.saveEmails(companies);

      console.log('\nColeta finalizada!');
    } catch (error) {
      console.error('Erro durante a coleta:', error);
      process.exit(1);
    }
  });

// Comando: Enviar emails
program
  .command('send')
  .description('Enviar emails para os endereços coletados')
  .option('-s, --subject <subject>', 'Assunto do email', 'Oportunidade de Parceria')
  .option('-k, --keyword <keyword>', 'Filtrar por palavra-chave')
  .option('-t, --test <email>', 'Enviar email de teste para um endereço')
  .option('-a, --attachment <path>', 'Caminho do arquivo para anexar (ex: curriculo.pdf)')
  .action(async (options) => {
    try {
      if (!validateConfig()) {
        console.error('\nDica: Copie o arquivo .env.example para .env e configure suas credenciais');
        process.exit(1);
      }

      const sender = new EmailSender(config.smtp);
      
      // Verificar conexão
      const connected = await sender.verifyConnection();
      if (!connected) {
        console.error('Não foi possível conectar ao servidor SMTP');
        process.exit(1);
      }

      // Modo de teste
      if (options.test) {
        console.log(`Enviando email de teste para: ${options.test}`);
        
        // Preparar anexos se fornecidos
        let attachments;
        const fs = require('fs');
        const path = require('path');
        // Se não forneceu attachment, checar se existe VictorCurriculum.pdf na raiz
        if (!options.attachment) {
          const defaultPath = path.resolve(process.cwd(), 'VictorCurriculum.pdf');
          if (fs.existsSync(defaultPath)) {
            options.attachment = defaultPath;
            console.log(`Arquivo padrão encontrado e será anexado: ${path.basename(defaultPath)}`);
          }
        }
        if (options.attachment) {
          const fs = require('fs');
          const path = require('path');
          const attachmentPath = path.resolve(options.attachment);
          
          if (!fs.existsSync(attachmentPath)) {
            console.error(`Arquivo não encontrado: ${attachmentPath}`);
            process.exit(1);
          }
          
          attachments = [{
            filename: path.basename(attachmentPath),
            path: attachmentPath
          }];
          
          console.log(`Anexo: ${path.basename(attachmentPath)}`);
        }
        
        await sender.sendTestEmail(options.test, attachments);
        return;
      }

      // Carregar emails
      const storage = new StorageService(config.storage.emailsFile);
      let companies = await storage.loadEmails();

      if (companies.length === 0) {
        console.log('Nenhum email encontrado. Execute "npm run collect" primeiro.');
        return;
      }

      // Filtrar por palavra-chave se especificado
      if (options.keyword) {
        companies = await storage.getEmailsByKeyword(options.keyword);
        console.log(`Filtrados ${companies.length} emails com a palavra-chave "${options.keyword}"`);
      }

      // Solicitar conteúdo do email
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      console.log('\nDigite o conteúdo do email (HTML ou texto):');
      console.log('(Digite uma linha vazia para usar o template padrão)\n');

      let emailContent = '';
      let line = await rl.question('> ');
      while (line.trim() !== '') {
        emailContent += line + '\n';
        line = await rl.question('> ');
      }
      rl.close();

      // Se não forneceu conteúdo, usar template padrão
      if (!emailContent.trim()) {
        const fs = require('fs');
        const path = require('path');
        const templatePath = path.resolve(process.cwd(), 'templates/email-template.html');
        
        if (fs.existsSync(templatePath)) {
          emailContent = fs.readFileSync(templatePath, 'utf-8');
          console.log('Usando template padrão (templates/email-template.html)');
        } else {
          console.log('Conteúdo do email vazio e template não encontrado. Operação cancelada.');
          return;
        }
      }

      // Preparar anexos se fornecidos
      let attachments;
      const fs = require('fs');
      const path = require('path');
      // Se não forneceu attachment, checar se existe VictorCurriculum.pdf na raiz
      if (!options.attachment) {
        const defaultPath = path.resolve(process.cwd(), 'VictorCurriculum.pdf');
        if (fs.existsSync(defaultPath)) {
          options.attachment = defaultPath;
          console.log(`Arquivo padrão encontrado e será anexado: ${path.basename(defaultPath)}`);
        }
      }
      if (options.attachment) {
        const attachmentPath = path.resolve(options.attachment);

        if (!fs.existsSync(attachmentPath)) {
          console.error(`Arquivo não encontrado: ${attachmentPath}`);
          process.exit(1);
        }

        attachments = [{
          filename: path.basename(attachmentPath),
          path: attachmentPath
        }];

        console.log(`Anexando: ${path.basename(attachmentPath)}\n`);
      }

      const message: EmailMessage = {
        subject: options.subject,
        html: emailContent.includes('<') ? emailContent : undefined,
        text: emailContent.includes('<') ? undefined : emailContent,
        attachments: attachments,
      };

      // Enviar emails
      const result = await sender.sendBulkEmails(
        companies,
        message,
        config.sending.delayBetweenSends
      );

      // Mover emails enviados para emailsdisparados.json
      if (result.sentEmails.length > 0) {
        await storage.moveSentEmails(result.sentEmails);
      }

      console.log('\nEnvio finalizado!');
    } catch (error) {
      console.error('Erro durante o envio:', error);
      process.exit(1);
    }
  });

// Comando: Listar emails coletados
program
  .command('list')
  .description('Listar todos os emails coletados')
  .option('-k, --keyword <keyword>', 'Filtrar por palavra-chave')
  .action(async (options) => {
    try {
      const storage = new StorageService(config.storage.emailsFile);
      let companies = await storage.loadEmails();

      if (options.keyword) {
        companies = await storage.getEmailsByKeyword(options.keyword);
      }

      if (companies.length === 0) {
        console.log('Nenhum email encontrado');
        return;
      }

      console.log(`\nTotal de emails: ${companies.length}\n`);
      companies.forEach((company, index) => {
        console.log(`${index + 1}. ${company.name}`);
        console.log(`   Email: ${company.email}`);
        console.log(`   Palavra-chave: ${company.keyword}`);
        console.log(`   Coletado em: ${new Date(company.collectedAt).toLocaleString('pt-BR')}`);
        console.log('');
      });
    } catch (error) {
      console.error('Erro ao listar emails:', error);
      process.exit(1);
    }
  });

// Comando: Listar emails disparados
program
  .command('list-sent')
  .description('Listar todos os emails já disparados')
  .action(async () => {
    try {
      const storage = new StorageService(config.storage.emailsFile);
      const companies = await storage.loadSentEmails();

      if (companies.length === 0) {
        console.log('Nenhum email disparado ainda');
        return;
      }

      console.log(`\nTotal de emails disparados: ${companies.length}\n`);
      companies.forEach((company, index) => {
        console.log(`${index + 1}. ${company.name}`);
        console.log(`   Email: ${company.email}`);
        console.log(`   Palavra-chave: ${company.keyword}`);
        console.log(`   Coletado em: ${new Date(company.collectedAt).toLocaleString('pt-BR')}`);
        if ((company as any).sentAt) {
          console.log(`   Enviado em: ${new Date((company as any).sentAt).toLocaleString('pt-BR')}`);
        }
        console.log('');
      });
    } catch (error) {
      console.error('Erro ao listar emails disparados:', error);
      process.exit(1);
    }
  });

// Comando: Exportar para CSV
program
  .command('export')
  .description('Exportar emails para CSV')
  .option('-o, --output <file>', 'Arquivo de saída', 'emails.csv')
  .action(async (options) => {
    try {
      const storage = new StorageService(config.storage.emailsFile);
      await storage.exportToCSV(options.output);
    } catch (error) {
      console.error('Erro ao exportar:', error);
      process.exit(1);
    }
  });

// Comando: Limpar dados
program
  .command('clear')
  .description('Limpar todos os emails coletados')
  .action(async () => {
    try {
      const storage = new StorageService(config.storage.emailsFile);
      await storage.clearEmails();
    } catch (error) {
      console.error('Erro ao limpar dados:', error);
      process.exit(1);
    }
  });

program.parse();

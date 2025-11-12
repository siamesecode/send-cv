import * as fs from 'fs/promises';
import * as path from 'path';
import { Company, EmailData } from '../types';

export class StorageService {
  private filePath: string;
  private sentEmailsPath: string;

  constructor(filePath: string = 'emails.json') {
    this.filePath = path.resolve(process.cwd(), filePath);
    this.sentEmailsPath = path.resolve(process.cwd(), 'emailsdisparados.json');
  }

  async saveEmails(companies: Company[]): Promise<void> {
    try {
      let existingData: EmailData = { companies: [] };

      try {
        const fileContent = await fs.readFile(this.filePath, 'utf-8');
        existingData = JSON.parse(fileContent);
      } catch (error) {
        console.log('Criando novo arquivo de emails...');
      }

      const existingEmails = new Set(existingData.companies.map(c => c.email));
      const newCompanies = companies.filter(c => !existingEmails.has(c.email));

      existingData.companies.push(...newCompanies);

      await fs.writeFile(
        this.filePath,
        JSON.stringify(existingData, null, 2),
        'utf-8'
      );

      console.log(`${newCompanies.length} novos emails salvos em ${this.filePath}`);
      console.log(`Total de emails no banco: ${existingData.companies.length}`);
    } catch (error) {
      console.error('Erro ao salvar emails:', error);
      throw error;
    }
  }

  async loadEmails(): Promise<Company[]> {
    try {
      const fileContent = await fs.readFile(this.filePath, 'utf-8');
      const data: EmailData = JSON.parse(fileContent);
      return data.companies;
    } catch (error) {
      console.log('Nenhum arquivo de emails encontrado');
      return [];
    }
  }

  async getEmailsByKeyword(keyword: string): Promise<Company[]> {
    const companies = await this.loadEmails();
    return companies.filter(c => 
      c.keyword.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  async clearEmails(): Promise<void> {
    const emptyData: EmailData = { companies: [] };
    await fs.writeFile(
      this.filePath,
      JSON.stringify(emptyData, null, 2),
      'utf-8'
    );
    console.log('Arquivo de emails limpo');
  }

  async exportToCSV(outputPath: string = 'emails.csv'): Promise<void> {
    const companies = await this.loadEmails();
    const csvPath = path.resolve(process.cwd(), outputPath);

    const headers = 'Nome,Email,Palavra-chave,Fonte,Data de Coleta\n';
    const rows = companies.map(c => 
      `"${c.name}","${c.email}","${c.keyword}","${c.source}","${c.collectedAt}"`
    ).join('\n');

    await fs.writeFile(csvPath, headers + rows, 'utf-8');
    console.log(`Dados exportados para ${csvPath}`);
  }

  async moveSentEmails(sentEmails: string[]): Promise<void> {
    try {
     
      const currentEmails = await this.loadEmails();

      let sentData: EmailData = { companies: [] };
      try {
        const sentContent = await fs.readFile(this.sentEmailsPath, 'utf-8');
        sentData = JSON.parse(sentContent);
      } catch (error) {
        console.log('Criando arquivo de emails disparados...');
      }

      const sentCompanies: Company[] = [];
      const remainingCompanies: Company[] = [];

      for (const company of currentEmails) {
        if (sentEmails.includes(company.email)) {
          sentCompanies.push({
            ...company,
            sentAt: new Date().toISOString()
          } as any);
        } else {
          remainingCompanies.push(company);
        }
      }

      sentData.companies.push(...sentCompanies);

      await fs.writeFile(
        this.sentEmailsPath,
        JSON.stringify(sentData, null, 2),
        'utf-8'
      );

      const remainingData: EmailData = { companies: remainingCompanies };
      await fs.writeFile(
        this.filePath,
        JSON.stringify(remainingData, null, 2),
        'utf-8'
      );

      console.log(`\n${sentCompanies.length} emails movidos para emailsdisparados.json`);
      console.log(`${remainingCompanies.length} emails restantes em emails.json`);
    } catch (error) {
      console.error('Erro ao mover emails enviados:', error);
      throw error;
    }
  }

  async loadSentEmails(): Promise<Company[]> {
    try {
      const fileContent = await fs.readFile(this.sentEmailsPath, 'utf-8');
      const data: EmailData = JSON.parse(fileContent);
      return data.companies;
    } catch (error) {
      return [];
    }
  }
}

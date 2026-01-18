import puppeteer, { Browser, Page } from 'puppeteer';
import { EventEmitter } from 'events';
import { Company } from '../types';
import { EmailValidator } from '../utils/emailValidator';

export interface ScraperEvents {
  'keyword-start': { keyword: string; index: number; total: number };
  'site-visiting': { site: string; keyword: string };
  'email-found': { email: string; company: Company };
  'email-invalid': { email: string; reason: string };
  'keyword-complete': { keyword: string; emailsFound: number };
  'complete': { totalEmails: number; companies: Company[] };
  'error': { message: string; keyword?: string };
}

export class EmailScraper extends EventEmitter {
  private browser: Browser | null = null;
  private aborted: boolean = false;

  constructor() {
    super();
  }

  abort(): void {
    this.aborted = true;
  }

  async initialize(): Promise<void> {
    this.aborted = false;
    this.browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });
  }

  async searchEmails(keywords: string[], maxResults: number = 10): Promise<Company[]> {
    if (!this.browser) {
      throw new Error('Scraper não inicializado. Execute initialize() primeiro.');
    }

    const companies: Company[] = [];
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const foundEmailsSet = new Set<string>();

    for (let keywordIndex = 0; keywordIndex < keywords.length; keywordIndex++) {
      if (this.aborted) {
        this.emit('error', { message: 'Coleta cancelada pelo usuário' });
        break;
      }

      const keyword = keywords[keywordIndex];
      this.emit('keyword-start', { keyword, index: keywordIndex, total: keywords.length });
      console.log(`Buscando sites para: "${keyword}"`);
      
      let keywordEmailCount = 0;
      
      try {
        const sites = await this.buscarSitesNoGoogle(keyword);
        console.log(`Encontrados ${sites.length} sites para visitar`);

        const resultados = await Promise.all(
          sites.map(async (site) => {
            if (this.aborted) return { site, emails: [] };
            
            const page = await this.browser!.newPage();
            
            try {
              await page.setRequestInterception(true);
              page.on('request', (request) => {
                if (['image', 'stylesheet', 'font', 'media'].includes(request.resourceType())) {
                  request.abort();
                } else {
                  request.continue();
                }
              });

              page.on('error', () => {});
              page.on('pageerror', () => {});

              this.emit('site-visiting', { site, keyword });
              console.log(`   Acessando: ${site.substring(0, 60)}...`);

              const emails = await this.buscarEmailsNoSite(site, page);
              
              if (emails.length > 0) {
                return { site, emails };
              }
              
              return { site, emails: [] };
              
            } catch (error) {
              console.log(`   Erro ao acessar ${site.substring(0, 40)}, pulando...`);
              return { site, emails: [] };
            } finally {
              await page.close();
            }
          })
        );

        for (const resultado of resultados) {
          for (const email of resultado.emails) {
            if (this.aborted) break;
            
            if (this.isValidBusinessEmail(email) && !foundEmailsSet.has(email)) {
              // Validar se o domínio tem servidor de email (MX record)
              console.log(`   Validando: ${email}`);
              const isValid = await EmailValidator.isValid(email);
              
              if (isValid) {
                foundEmailsSet.add(email);
                const company: Company = {
                  name: this.extractCompanyName(email),
                  email: email,
                  source: resultado.site,
                  keyword: keyword,
                  collectedAt: new Date().toISOString()
                };
                companies.push(company);
                keywordEmailCount++;
                this.emit('email-found', { email, company });
                console.log(`   Email válido: ${email}`);
              } else {
                this.emit('email-invalid', { email, reason: 'Sem registro MX' });
                console.log(`   Email inválido (sem MX): ${email}`);
              }
              
              if (foundEmailsSet.size >= maxResults) break;
            }
          }
          if (foundEmailsSet.size >= maxResults) break;
        }

        this.emit('keyword-complete', { keyword, emailsFound: keywordEmailCount });
        console.log(`Total de emails válidos: ${foundEmailsSet.size}`);
        
      } catch (error) {
        this.emit('error', { message: String(error), keyword });
        console.error(`Erro ao buscar emails para "${keyword}":`, error);
      }
    }

    this.emit('complete', { totalEmails: companies.length, companies });
    return companies;
  }

  private async buscarSitesNoGoogle(keyword: string): Promise<string[]> {
    const page = await this.browser!.newPage();
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page.setViewport({ width: 1920, height: 1080 });
      
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
      
      console.log(`   Acessando Google...`);
      await page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 30000 });
      await this.delay(5000);

      try {
        await page.waitForSelector('button', { timeout: 3000 });
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || '', button);
          if (text.includes('Aceitar') || text.includes('Accept') || text.includes('Concordo')) {
            await button.click();
            console.log('   Cookies aceitos');
            await this.delay(2000);
            break;
          }
        }
      } catch (e) {
        console.log('   Sem popup de cookies');
      }

      const sites = await page.evaluate(() => {
        const links: string[] = [];
        
        const allLinks = (globalThis as any).document.querySelectorAll('a[href]');
        
        for (const el of allLinks) {
          if (el.href && el.href.startsWith('http')) {
            const url = el.href;
            const dominiosInvalidos = ['google', 'facebook', 'youtube', 'instagram', 'twitter', 'linkedin', 'gstatic', 'maps.goo.gl'];
            if (!dominiosInvalidos.some(d => url.includes(d))) {
              try {
                const urlObj = new URL(url);
                if (urlObj.hostname && !urlObj.hostname.includes('google')) {
                  links.push(url);
                }
              } catch (e) {
              }
            }
          }
        }
        
        return [...new Set(links)].slice(0, 10);
      });

      console.log(`   Links encontrados: ${sites.length}`);
      
      return sites;
      
    } catch (error) {
      console.error('Erro ao buscar no Google:', error);
      return [];
    } finally {
      await page.close();
    }
  }

  private async buscarEmailsNoSite(site: string, page: Page): Promise<string[]> {
    try {
      await page.goto(site, { 
        waitUntil: 'domcontentloaded', 
        timeout: 15000 
      });

      const emails = await page.evaluate(() => {
        const textoBody = (globalThis as any).document.body.innerText;
        const regex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
        return textoBody.match(regex) || [];
      });

      return [...new Set(emails)] as string[];
      
    } catch (error) {
      return [];
    }
  }

  private isValidBusinessEmail(email: string): boolean {
    // Filtrar emails genéricos e de serviços comuns
    const invalidDomains = ['example.com', 'test.com', 'gmail.com', 'hotmail.com', 
                           'yahoo.com', 'outlook.com', 'live.com', 'icloud.com',
                           'support.google.com', 'facebook.com', 'twitter.com',
                           'instagram.com', 'linkedin.com', 'youtube.com'];
    const invalidPrefixes = ['noreply', 'no-reply', 'donotreply', 'bounce', 'mailer-daemon'];
    
    const emailLower = email.toLowerCase();
    const domain = emailLower.split('@')[1];
    const prefix = emailLower.split('@')[0];
    
    if (!domain || !prefix) return false;
    
    if (invalidDomains.includes(domain)) return false;
    
    if (invalidPrefixes.some(inv => prefix.includes(inv))) return false;
    
    if (email.length < 6) return false;
    
    if (!domain.includes('.')) return false;
    
    return true;
  }

  private extractCompanyName(email: string): string {
    const domain = email.split('@')[1];
    const name = domain.split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

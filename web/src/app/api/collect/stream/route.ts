import { NextRequest } from 'next/server';
import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs/promises';
import * as path from 'path';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

const emailsPath = path.resolve(process.cwd(), '../emails.json');

interface Company {
  name: string;
  email: string;
  source: string;
  keyword: string;
  collectedAt: string;
}

interface EmailData {
  companies: Company[];
}

// Email validator
async function isValidEmail(email: string): Promise<boolean> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;

  const domain = email.split('@')[1];
  try {
    const mxRecords = await resolveMx(domain);
    return mxRecords && mxRecords.length > 0;
  } catch {
    return false;
  }
}

function isValidBusinessEmail(email: string): boolean {
  const invalidDomains = ['example.com', 'test.com', 'gmail.com', 'hotmail.com', 
                         'yahoo.com', 'outlook.com', 'live.com', 'icloud.com'];
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

function extractCompanyName(email: string): string {
  const domain = email.split('@')[1];
  const name = domain.split('.')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function saveEmails(companies: Company[]): Promise<void> {
  let existingData: EmailData = { companies: [] };
  
  try {
    const content = await fs.readFile(emailsPath, 'utf-8');
    existingData = JSON.parse(content);
  } catch {
    // File doesn't exist
  }
  
  const existingEmails = new Set(existingData.companies.map(c => c.email));
  const newCompanies = companies.filter(c => !existingEmails.has(c.email));
  existingData.companies.push(...newCompanies);
  
  await fs.writeFile(emailsPath, JSON.stringify(existingData, null, 2), 'utf-8');
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const keyword = searchParams.get('keyword') || 'empresa de tecnologia';
  const cidade = searchParams.get('cidade');
  const maxResults = parseInt(searchParams.get('maxResults') || '10');

  const fullKeyword = cidade ? `${keyword} em ${cidade}` : `${keyword} Brasil`;

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      let browser: Browser | null = null;
      
      try {
        send('status', { message: 'Iniciando navegador...', phase: 'init' });
        
        browser = await puppeteer.launch({
          headless: false,
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
          ],
          protocolTimeout: 60000
        });

        send('keyword-start', { keyword: fullKeyword, index: 0, total: 1 });

        // Search Google
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Remove detecção de automação
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(fullKeyword)}`;
        send('status', { message: 'Buscando no Google... (resolva CAPTCHA se aparecer)', phase: 'searching' });
        
        await page.goto(searchUrl, { waitUntil: 'load', timeout: 60000 });
        send('status', { message: '⏳ Aguardando 15 segundos para verificação...', phase: 'waiting' });
        await delay(15000);

        // Handle cookies popup - método simplificado
        try {
          const acceptButton = await page.$('button[id*="accept"], button[id*="L2AGLb"]');
          if (acceptButton) {
            await acceptButton.click();
            await delay(1500);
          }
        } catch {
          // No cookie popup
        }
        
        await delay(1000);

        // Extract sites from search results - método mais robusto
        let sites: string[] = [];
        try {
          sites = await page.$$eval('a[href]', (anchors) => {
            const links: string[] = [];
            const invalidDomains = ['google', 'facebook', 'youtube', 'instagram', 'twitter', 'linkedin', 'gstatic', 'maps.goo.gl', 'webcache'];
            
            for (const anchor of anchors) {
              const href = (anchor as HTMLAnchorElement).href;
              if (href && href.startsWith('http')) {
                if (!invalidDomains.some(d => href.includes(d))) {
                  try {
                    const urlObj = new URL(href);
                    if (urlObj.hostname && !urlObj.hostname.includes('google')) {
                      links.push(href);
                    }
                  } catch {
                    // Invalid URL
                  }
                }
              }
            }
            
            return [...new Set(links)].slice(0, 10);
          });
        } catch (evalError) {
          // Método alternativo: pegar o HTML e processar
          try {
            const html = await page.content();
            const hrefMatches = html.match(/href="(https?:\/\/[^"]+)"/g) || [];
            const extractedLinks = hrefMatches
              .map(match => match.replace(/href="|"/g, ''))
              .filter(url => {
                const invalidDomains = ['google', 'facebook', 'youtube', 'instagram', 'twitter', 'linkedin', 'gstatic', 'maps.goo.gl', 'webcache'];
                return !invalidDomains.some(d => url.includes(d));
              });
            sites = [...new Set(extractedLinks)].slice(0, 10);
          } catch {
            // Falhou também
          }
        }

        try {
          await page.close();
        } catch {
          // Ignora erro ao fechar
        }

        send('status', { message: `Encontrados ${sites.length} sites para visitar`, phase: 'visiting' });

        const companies: Company[] = [];
        const foundEmails = new Set<string>();

        for (const site of sites) {
          if (foundEmails.size >= maxResults) break;

          send('site-visiting', { site, keyword: fullKeyword });

          let sitePage;
          
          try {
            sitePage = await browser.newPage();
            
            // Não usa request interception - causa problemas de contexto
            sitePage.on('error', () => {});
            sitePage.on('pageerror', () => {});

            await sitePage.goto(site, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await delay(500);

            let emails: string[] = [];
            try {
              emails = await sitePage.$$eval('body', (bodies) => {
                const text = bodies[0]?.innerText || '';
                const regex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
                return text.match(regex) || [];
              });
            } catch {
              // Se falhar, tenta extrair do HTML
              try {
                const html = await sitePage.content();
                const emailMatches = html.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g) || [];
                emails = [...new Set(emailMatches)];
              } catch {
                // Ignora
              }
            }

            for (const email of emails) {
              if (foundEmails.size >= maxResults) break;
              
              if (isValidBusinessEmail(email) && !foundEmails.has(email)) {
                send('status', { message: `Validando ${email}...`, phase: 'validating' });
                
                const isValid = await isValidEmail(email);
                
                if (isValid) {
                  foundEmails.add(email);
                  const company: Company = {
                    name: extractCompanyName(email),
                    email,
                    source: site,
                    keyword: fullKeyword,
                    collectedAt: new Date().toISOString(),
                  };
                  companies.push(company);
                  
                  send('email-found', { email, company });
                } else {
                  send('email-invalid', { email, reason: 'Sem registro MX' });
                }
              }
            }
          } catch {
            // Error visiting site
          } finally {
            if (sitePage) {
              try {
                await sitePage.close();
              } catch {
                // Ignora erro ao fechar
              }
            }
          }
        }

        // Save emails
        if (companies.length > 0) {
          await saveEmails(companies);
        }

        send('keyword-complete', { keyword: fullKeyword, emailsFound: companies.length });
        send('complete', { totalEmails: companies.length, companies });

      } catch (error) {
        send('error', { message: String(error) });
      } finally {
        if (browser) {
          await browser.close();
        }
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

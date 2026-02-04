import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

export class EmailValidator {
  private static mxCache = new Map<string, { valid: boolean; timestamp: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos
  
  /**
   * Valida formato básico do email
   */
  static isValidFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Verifica se o domínio do email tem registro MX (servidor de email)
   * com timeout, retry e cache
   */
  static async hasValidMxRecord(email: string, retries: number = 2): Promise<boolean> {
    const domain = email.split('@')[1];
    
    // Verifica cache
    const cached = this.mxCache.get(domain);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`   [Cache] ${domain}: ${cached.valid ? 'válido' : 'inválido'}`);
      return cached.valid;
    }
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Timeout de 5 segundos
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('DNS timeout')), 5000)
        );
        
        const addresses = await Promise.race([
          resolveMx(domain),
          timeoutPromise
        ]);
        
        const isValid = addresses && addresses.length > 0;
        
        // Salva no cache
        this.mxCache.set(domain, { valid: isValid, timestamp: Date.now() });
        
        return isValid;
      } catch (error: any) {
        const isLastAttempt = attempt === retries;
        
        if (isLastAttempt) {
          console.log(`   [DNS] Falha ao resolver ${domain}: ${error.code || error.message}`);
          // Salva no cache como inválido
          this.mxCache.set(domain, { valid: false, timestamp: Date.now() });
          return false;
        }
        
        // Aguarda antes de tentar novamente (backoff exponencial)
        const delay = Math.pow(2, attempt) * 500;
        console.log(`   [DNS] Tentativa ${attempt + 1}/${retries + 1} falhou, aguardando ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return false;
  }

  /**
   * Validação completa: formato + MX record
   */
  static async isValid(email: string): Promise<boolean> {
    if (!this.isValidFormat(email)) {
      return false;
    }
    
    return await this.hasValidMxRecord(email);
  }

  /**
   * Valida lista de emails e retorna apenas os válidos
   */
  static async validateList(emails: string[]): Promise<{
    valid: string[];
    invalid: string[];
  }> {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const email of emails) {
      const isValid = await this.isValid(email);
      if (isValid) {
        valid.push(email);
      } else {
        invalid.push(email);
      }
    }

    return { valid, invalid };
  }
  
  /**
   * Limpa o cache de registros MX
   */
  static clearCache(): void {
    this.mxCache.clear();
    console.log('[EmailValidator] Cache limpo');
  }
  
  /**
   * Retorna estatísticas do cache
   */
  static getCacheStats(): { size: number; domains: string[] } {
    return {
      size: this.mxCache.size,
      domains: Array.from(this.mxCache.keys())
    };
  }
}

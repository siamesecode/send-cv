import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

export class EmailValidator {
  
  /**
   * Valida formato básico do email
   */
  static isValidFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Verifica se o domínio do email tem registro MX (servidor de email)
   */
  static async hasValidMxRecord(email: string): Promise<boolean> {
    try {
      const domain = email.split('@')[1];
      const addresses = await resolveMx(domain);
      return addresses && addresses.length > 0;
    } catch (error) {
      return false;
    }
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
}

export interface Company {
  name: string;
  email: string;
  source: string;
  keyword: string;
  collectedAt: string;
}

export interface EmailData {
  companies: Company[];
}

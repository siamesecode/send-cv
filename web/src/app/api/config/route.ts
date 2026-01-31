import { NextResponse } from 'next/server';

// Termos de busca para empresas de tecnologia
export const termosBuscaTecnologia = [
  'empresa de tecnologia',
  'software house',
  'empresa de desenvolvimento de software',
  'empresa de sistemas',
  'empresa de TI',
  'empresa de automação comercial',
  'consultoria de TI',
  'empresa de soluções digitais',
  'empresa de desenvolvimento web',
  'empresa de criação de sites',
  'agência de marketing digital',
  'empresa de aplicativos',
  'empresa de suporte técnico',
  'fábrica de software',
  'empresa de inovação tecnológica',
  'empresa de infraestrutura de TI',
  'empresa de cloud computing',
  'consultoria em tecnologia da informação',
  'soluções em TI',
  'empresa de inteligência artificial',
  'empresa de segurança da informação',
  'desenvolvedor de software',
  'serviços de TI',
  'empresa de automação industrial',
  'empresa de tecnologia da informação',
  'startup de tecnologia',
  'empresa de desenvolvimento mobile',
  'empresa de e-commerce',
  'empresa de ERP',
  'empresa de CRM',
  'empresa de business intelligence',
  'empresa de data science',
  'empresa de IoT',
  'empresa de blockchain',
  'empresa de DevOps',
  'empresa de cybersecurity'
];

export const cidadesPrincipais = [
  'São Paulo',
  'Rio de Janeiro',
  'Belo Horizonte',
  'Brasília',
  'Porto Alegre',
  'Curitiba',
  'Florianópolis',
  'Recife',
  'Salvador',
  'Fortaleza',
  'Campinas',
  'São José dos Campos',
  'Ribeirão Preto',
  'Santarém'
];

export async function GET() {
  return NextResponse.json({
    termosBusca: termosBuscaTecnologia,
    cidades: cidadesPrincipais,
  });
}

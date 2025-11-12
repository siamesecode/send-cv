export const sitesBaseTecnologia = [
  'https://www.startse.com/startups/',
  'https://www.canaltech.com.br/empresas/',
  'https://www.tecmundo.com.br/empresa',
  'https://www.b2bstack.com.br/empresas-de-tecnologia',
];

// Função para gerar sites baseados em palavras-chave
export function gerarSitesPorPalavraChave(keyword: string): string[] {
  const sites: string[] = [];
  
  // Se a palavra-chave mencionar cidade, adicionar sites locais
  if (keyword.toLowerCase().includes('são paulo') || keyword.toLowerCase().includes('sp')) {
    sites.push('https://www.google.com.br/maps/search/empresa+tecnologia+são+paulo');
  }
  
  if (keyword.toLowerCase().includes('rio')) {
    sites.push('https://www.google.com.br/maps/search/empresa+tecnologia+rio+de+janeiro');
  }
  
  // Sites genéricos com a palavra-chave
  sites.push(`https://www.google.com/search?q=site:*.com.br+${encodeURIComponent(keyword)}+contato+email`);
  
  return sites;
}

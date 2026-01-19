# Send CV - Automação de Emails

Sistema para coletar emails de empresas e enviar currículos em massa com interface web.

## Pré-requisitos

- Node.js 20+
- npm ou yarn

## Instalação

### Backend

```bash
npm install
```

### Interface Web

```bash
cd web
npm install
```

## Configuração

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seuemail@gmail.com
SMTP_PASS=suasenha // Senha de aplicativo (pesquisar o que é isso para criar)
```

## Execução

### Interface Web (Recomendado)

```bash
npm run web
```

Acesse http://localhost:3000 para usar a interface gráfica com:
- Coleta de emails por palavras-chave
- Envio de emails em massa
- Gerenciamento de emails coletados e enviados
- Acompanhamento em tempo real

### CLI (Terminal)

#### Coletar Emails

```bash
npm run collect
```

#### Enviar Emails

```bash
npm run send
```

#### Listar Emails Enviados

```bash
npm run list-sent
```

## Estrutura do Projeto

- `/src` - Backend TypeScript (scraper e envio de emails)
- `/web` - Interface Next.js
- `/templates` - Templates HTML para emails
- `emails.json` - Base de emails coletados
- `emailsdisparados.json` - Registro de emails enviados

## Funcionalidades

- Busca automatizada de emails no Google
- Validação de emails (formato e registro MX)
- Sistema de templates HTML personalizáveis
- Anexo automático de currículo em PDF
- Controle de emails já enviados
- Interface web moderna com acompanhamento em tempo real
- Modo headless ou com navegador visível

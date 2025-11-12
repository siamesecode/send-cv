# Email Automation

Automação para coletar emails de empresas e enviar mensagens em massa.

## Configuração

1. Copie `.env.example` para `.env` e configure suas credenciais SMTP
2. Instale as dependências: `npm install`
3. Compile o projeto: `npm run build`

## Comandos

### Coletar emails por palavras-chave
```bash
npm run collect -- -k "tecnologia" -k "desenvolvimento" -m 20
```

### Coletar emails por cidade
```bash
npm run collect-city -- -c "São Paulo" -m 20
```

### Enviar email de teste
```bash
npm run send -- -t seuemail@exemplo.com -s "Assunto do Email"
```

### Enviar emails em massa
```bash
npm run send -- -s "Assunto do Email"
```
(Carrega emails do arquivo JSON e solicita o conteúdo)

### Listar emails coletados
```bash
npm run list
```

### Filtrar emails por palavra-chave
```bash
npm run list -- -k "tecnologia"
```

### Exportar para CSV
```bash
npm run export -- -o emails.csv
```

### Limpar todos os emails
```bash
npm run clear
```

## Anexos

Coloque o arquivo `curriculo.pdf` na raiz do projeto para anexá-lo automaticamente aos emails.

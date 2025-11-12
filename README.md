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
(Pressione Enter para usar o template padrão. Emails enviados são movidos automaticamente para `emailsdisparados.json`)

### Listar emails coletados
```bash
npm run list
```

### Listar emails já disparados
```bash
npm run list-sent
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

## Recursos

- **Validação de email**: Verifica formato e registro MX antes de salvar
- **Controle de disparos**: Emails enviados são movidos para `emailsdisparados.json`
- **Template automático**: Usa `templates/email-template.html` se não fornecer conteúdo
- **Anexo automático**: Detecta e anexa `VictorCurriculum.pdf` automaticamente

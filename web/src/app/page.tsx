'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Company {
  name: string;
  email: string;
  source: string;
  keyword: string;
  collectedAt: string;
  sentAt?: string;
}

interface LogEntry {
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: Date;
}

export default function Home() {
  // Config state
  const [termosBusca, setTermosBusca] = useState<string[]>([]);
  const [cidades, setCidades] = useState<string[]>([]);
  const [selectedTermo, setSelectedTermo] = useState<string>('');
  const [selectedCidade, setSelectedCidade] = useState<string>('');
  const [customKeyword, setCustomKeyword] = useState<string>('');
  const [maxResults, setMaxResults] = useState<string>('10');

  // Emails state
  const [pendingEmails, setPendingEmails] = useState<Company[]>([]);
  const [sentEmails, setSentEmails] = useState<Company[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  // Operation state
  const [isCollecting, setIsCollecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Send dialog state
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('Oportunidade Profissional - Desenvolvedor');

  // Load config
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setTermosBusca(data.termosBusca);
        setCidades(data.cidades);
        if (data.termosBusca.length > 0) {
          setSelectedTermo(data.termosBusca[0]);
        }
      });
  }, []);

  // Load emails
  const loadEmails = useCallback(async () => {
    const res = await fetch('/api/emails');
    const data = await res.json();
    setPendingEmails(data.pending);
    setSentEmails(data.sent);
  }, []);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: new Date() }]);
  };

  const handleCollect = async () => {
    setIsCollecting(true);
    setProgress(0);
    setLogs([]);

    const keyword = customKeyword || selectedTermo;
    const params = new URLSearchParams({
      keyword,
      maxResults,
      ...(selectedCidade && { cidade: selectedCidade }),
    });

    addLog('info', `Iniciando coleta: "${keyword}"${selectedCidade ? ` em ${selectedCidade}` : ''}`);

    const eventSource = new EventSource(`/api/collect/stream?${params}`);

    eventSource.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      addLog('info', data.message);
    });

    eventSource.addEventListener('keyword-start', (e) => {
      const data = JSON.parse(e.data);
      addLog('info', `Buscando: ${data.keyword}`);
    });

    eventSource.addEventListener('site-visiting', (e) => {
      const data = JSON.parse(e.data);
      addLog('info', `Visitando: ${data.site.substring(0, 50)}...`);
    });

    eventSource.addEventListener('email-found', (e) => {
      const data = JSON.parse(e.data);
      addLog('success', `✓ Email encontrado: ${data.email}`);
      setProgress(prev => Math.min(prev + 10, 90));
    });

    eventSource.addEventListener('email-invalid', (e) => {
      const data = JSON.parse(e.data);
      addLog('warning', `✗ Email inválido: ${data.email} (${data.reason})`);
    });

    eventSource.addEventListener('keyword-complete', (e) => {
      const data = JSON.parse(e.data);
      addLog('info', `Keyword completa: ${data.emailsFound} emails encontrados`);
    });

    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      addLog('success', `✓ Coleta finalizada: ${data.totalEmails} emails coletados`);
      setProgress(100);
      eventSource.close();
      setIsCollecting(false);
      loadEmails();
    });

    eventSource.addEventListener('error', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        addLog('error', `Erro: ${data.message}`);
      } catch {
        addLog('error', 'Erro na conexão');
      }
      eventSource.close();
      setIsCollecting(false);
    });

    eventSource.onerror = () => {
      eventSource.close();
      setIsCollecting(false);
    };
  };

  const handleSend = async () => {
    setIsSending(true);
    setProgress(0);

    const emailIds = selectedEmails.size > 0 
      ? Array.from(selectedEmails) 
      : pendingEmails.map(e => e.email);

    addLog('info', `Iniciando envio para ${emailIds.length} emails...`);

    const response = await fetch('/api/send/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailIds, subject: emailSubject }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      addLog('error', 'Erro ao iniciar stream');
      setIsSending(false);
      return;
    }

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const eventMatch = line.match(/event: (\w+)/);
        const dataMatch = line.match(/data: (.+)/);

        if (eventMatch && dataMatch) {
          const event = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          switch (event) {
            case 'status':
              addLog('info', data.message);
              break;
            case 'sending':
              addLog('info', `Enviando para ${data.email} (${data.index + 1}/${data.total})`);
              setProgress(((data.index + 1) / data.total) * 100);
              break;
            case 'sent':
              addLog('success', `✓ Enviado: ${data.email}`);
              break;
            case 'failed':
              addLog('error', `✗ Falha: ${data.email}`);
              break;
            case 'complete':
              addLog('success', `✓ Envio finalizado: ${data.sent} enviados, ${data.failed} falhas`);
              setProgress(100);
              setIsSending(false);
              setSendDialogOpen(false);
              loadEmails();
              setSelectedEmails(new Set());
              break;
            case 'error':
              addLog('error', `Erro: ${data.message}`);
              setIsSending(false);
              break;
          }
        }
      }
    }
  };

  const handleClearEmails = async () => {
    if (confirm('Tem certeza que deseja limpar todos os emails pendentes?')) {
      await fetch('/api/emails', { method: 'DELETE' });
      loadEmails();
      addLog('info', 'Emails limpos');
    }
  };

  const toggleEmailSelection = (email: string) => {
    const newSelection = new Set(selectedEmails);
    if (newSelection.has(email)) {
      newSelection.delete(email);
    } else {
      newSelection.add(email);
    }
    setSelectedEmails(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedEmails.size === pendingEmails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(pendingEmails.map(e => e.email)));
    }
  };

  return (
    <main className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Send CV - Automação de Emails</h1>
        <p className="text-muted-foreground">
          Colete emails de empresas e envie seu currículo automaticamente
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Collection */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Coletar Emails</CardTitle>
              <CardDescription>
                Configure a busca por empresas de tecnologia
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Termo de Busca</Label>
                <Select value={selectedTermo} onValueChange={setSelectedTermo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um termo" />
                  </SelectTrigger>
                  <SelectContent>
                    {termosBusca.map((termo) => (
                      <SelectItem key={termo} value={termo}>
                        {termo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cidade (opcional)</Label>
                <Select value={selectedCidade} onValueChange={setSelectedCidade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as cidades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas (Brasil)</SelectItem>
                    {cidades.map((cidade) => (
                      <SelectItem key={cidade} value={cidade}>
                        {cidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Termo Customizado (sobrescreve seleção)</Label>
                <Input
                  placeholder="Ex: empresa de marketing"
                  value={customKeyword}
                  onChange={(e) => setCustomKeyword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Máximo de Resultados</Label>
                <Input
                  type="number"
                  value={maxResults}
                  onChange={(e) => setMaxResults(e.target.value)}
                  min="1"
                  max="50"
                />
              </div>

              {isCollecting && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-muted-foreground text-center">
                    Coletando... {Math.round(progress)}%
                  </p>
                </div>
              )}

              <Button 
                className="w-full" 
                onClick={handleCollect}
                disabled={isCollecting}
              >
                {isCollecting ? 'Coletando...' : 'Iniciar Coleta'}
              </Button>
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">{pendingEmails.length}</p>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{sentEmails.length}</p>
                  <p className="text-sm text-muted-foreground">Enviados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Emails & Logs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Emails Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Emails Coletados</CardTitle>
                  <CardDescription>
                    Gerencie e envie emails para as empresas
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleClearEmails}
                    disabled={pendingEmails.length === 0}
                  >
                    Limpar
                  </Button>
                  <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        size="sm"
                        disabled={pendingEmails.length === 0}
                      >
                        Enviar {selectedEmails.size > 0 ? `(${selectedEmails.size})` : 'Todos'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Enviar Emails</DialogTitle>
                        <DialogDescription>
                          Configure o envio de emails para {selectedEmails.size > 0 ? selectedEmails.size : pendingEmails.length} destinatários
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Assunto do Email</Label>
                          <Input
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          O template HTML será carregado de <code>templates/email-template.html</code>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          O currículo será anexado de <code>curriculo.pdf</code> se existir
                        </p>
                        {isSending && (
                          <div className="space-y-2">
                            <Progress value={progress} />
                            <p className="text-sm text-muted-foreground text-center">
                              Enviando... {Math.round(progress)}%
                            </p>
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleSend} disabled={isSending}>
                          {isSending ? 'Enviando...' : 'Confirmar Envio'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pending">
                <TabsList className="mb-4">
                  <TabsTrigger value="pending">
                    Pendentes <Badge variant="secondary" className="ml-2">{pendingEmails.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="sent">
                    Enviados <Badge variant="secondary" className="ml-2">{sentEmails.length}</Badge>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pending">
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox 
                              checked={selectedEmails.size === pendingEmails.length && pendingEmails.length > 0}
                              onCheckedChange={toggleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Keyword</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingEmails.map((company) => (
                          <TableRow key={company.email}>
                            <TableCell>
                              <Checkbox 
                                checked={selectedEmails.has(company.email)}
                                onCheckedChange={() => toggleEmailSelection(company.email)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{company.name}</TableCell>
                            <TableCell>{company.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {company.keyword.substring(0, 20)}...
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(company.collectedAt).toLocaleDateString('pt-BR')}
                            </TableCell>
                          </TableRow>
                        ))}
                        {pendingEmails.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              Nenhum email pendente. Inicie uma coleta!
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="sent">
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Keyword</TableHead>
                          <TableHead>Enviado em</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sentEmails.map((company) => (
                          <TableRow key={company.email}>
                            <TableCell className="font-medium">{company.name}</TableCell>
                            <TableCell>{company.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {company.keyword.substring(0, 20)}...
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {company.sentAt 
                                ? new Date(company.sentAt).toLocaleDateString('pt-BR')
                                : '-'
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                        {sentEmails.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              Nenhum email enviado ainda
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Logs</CardTitle>
              <CardDescription>Acompanhe o progresso das operações em tempo real</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px] rounded-md border p-4 bg-muted/50">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Os logs aparecerão aqui durante a coleta ou envio
                  </p>
                ) : (
                  <div className="space-y-1 font-mono text-sm">
                    {logs.map((log, index) => (
                      <div 
                        key={index}
                        className={`
                          ${log.type === 'success' ? 'text-green-600' : ''}
                          ${log.type === 'error' ? 'text-red-600' : ''}
                          ${log.type === 'warning' ? 'text-yellow-600' : ''}
                          ${log.type === 'info' ? 'text-muted-foreground' : ''}
                        `}
                      >
                        <span className="text-xs opacity-60">
                          [{log.timestamp.toLocaleTimeString()}]
                        </span>{' '}
                        {log.message}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

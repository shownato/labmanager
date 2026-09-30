# Configuração, implantação e operação

[Voltar ao índice](../README.md)

Este guia descreve os comandos do repositório e uma proposta de operação. Nenhum deploy, serviço systemd ou banco foi criado durante a documentação.

## Requisitos

- Node.js e npm. No lockfile inspecionado, o cliente Supabase exige Node.js >=20; o projeto não fixa runtime via engines ou arquivo de versão. A equipe deve escolher e registrar uma versão mantida e compatível no ambiente de implantação.
- Projeto Supabase com schema e permissões revisados, Auth e publicação Realtime de pc_status.
- Para GLPI por fila: host Ubuntu com acesso ao Supabase e ao GLPI interno, credenciais API e processo worker persistente.
- Para câmera: navegador com permissões adequadas; BarcodeDetector é necessário para leitura automática. Há entrada manual alternativa.

## Variáveis de ambiente

| Variável | Onde usar | Finalidade/padrão |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Aplicação, build e runtime | URL do projeto Supabase |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Aplicação, build e runtime | Chave pública anon usada com sessão e RLS |
| AUTHORIZED_EMAILS | Servidor Next.js | E-mails separados por vírgula; opcional |
| AUTHORIZED_EMAIL_DOMAINS | Servidor Next.js | Domínios separados por vírgula; opcional |
| GLPI_DELIVERY_MODE | Servidor Next.js | queue por padrão; direct para acesso direto |
| SUPABASE_URL | Worker | URL Supabase; não há fallback para NEXT_PUBLIC no worker |
| SUPABASE_SERVICE_ROLE_KEY | Worker | Chave privilegiada para consumir a fila |
| GLPI_API_URL | Worker ou servidor em modo direct | Base da API, incluindo apirest.php, sem barra final |
| GLPI_APP_TOKEN | Worker ou servidor em modo direct | App-Token GLPI |
| GLPI_USER_TOKEN | Worker ou servidor em modo direct | User-Token GLPI |
| GLPI_WORKER_INTERVAL_MS | Worker | Intervalo, default 10000 |
| GLPI_WORKER_MAX_ATTEMPTS | Worker | Limite de tentativas, default 5 |

As listas de autorização removem espaços externos e normalizam maiúsculas/minúsculas; domínios aceitam prefixo @. E-mail específico OU domínio permitido libera acesso. Sem ambas as listas, todos os autenticados passam nessa verificação.

As variáveis NEXT_PUBLIC são públicas no bundle. Nunca coloque service_role ou tokens GLPI nelas. No modo fila, a service_role fica no Ubuntu, não na aplicação Vercel. No modo direct, os tokens GLPI precisam existir somente no servidor que faz esse envio.

O arquivo de exemplo não inclui as listas de autorização nem os ajustes opcionais do worker; acrescente-os quando necessários. Não use os valores de exemplo como credenciais reais.

## Ambiente local

No diretório do projeto:

```powershell
npm ci
Copy-Item .env.local.example .env.local
```

Não sobrescreva um .env.local existente. Preencha pelo menos as duas variáveis públicas do Supabase, configure as listas autorizadas conforme a política CCI e use um banco de desenvolvimento. Leia [Banco de dados](BANCO-DE-DADOS.md) antes de aplicar scripts.

```powershell
npm run dev
```

Abra http://localhost:3000. O Next.js lê .env.local. Reinicie o processo após alterações de configuração. O Node.js do worker não carrega automaticamente esse arquivo.

## Comandos disponíveis

| Comando | Finalidade |
| --- | --- |
| npm run dev | Servidor Next.js em desenvolvimento |
| npm run build | Build de produção |
| npm start | Executa o build produzido |
| npm run lint | next lint; falta configuração para uso validado |
| npm run worker:glpi | Inicia worker com variáveis já carregadas |
| npm run import:teachers | Valida a lista privada local, sem criar contas por padrão |
| npm run test:auth | Executa testes de autenticação e importação |
| node generate-sql.js | Imprime seed SQL, sem aplicá-lo |

Validações auxiliares que não contatam os serviços:

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --check scripts/glpi-worker.mjs
```

## Aplicação em produção

A documentação original prevê Vercel para Next.js e Ubuntu para o worker. Não há confirmação de deploy ativo nem configuração versionada de infraestrutura.

1. Resolver as pendências de schema e autorização em ambiente de teste.
2. Configurar variáveis públicas Supabase no ambiente de build e execução.
3. Configurar listas autorizadas e GLPI_DELIVERY_MODE=queue.
4. Executar npm ci e npm run build; iniciar com npm start em hospedagem Node.js, ou usar o fluxo de build da hospedagem Next.js adotada.
5. Conferir os endereços permitidos pelo Auth para os fluxos que utilizam /auth/callback.
6. Testar sessão, rotas protegidas, manutenção, histórico, Realtime e etiquetas no domínio final.

As variáveis públicas são incorporadas ao build; mudanças exigem novo build/deploy. Não configure envio direct se o servidor da aplicação não alcançar a rede privada do GLPI.

O simples build não comprova que o banco tem as RPCs e políticas corretas, nem que um chamado chega ao GLPI.

## Worker Ubuntu

Prepare o código e suas dependências no host da rede interna. Crie um arquivo .env local com valores reais, sem versioná-lo:

```dotenv
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUBSTITUIR
GLPI_API_URL=http://HOST-GLPI/apirest.php
GLPI_APP_TOKEN=SUBSTITUIR
GLPI_USER_TOKEN=SUBSTITUIR
GLPI_WORKER_INTERVAL_MS=10000
GLPI_WORKER_MAX_ATTEMPTS=5
```

O arquivo é carregado como shell no exemplo abaixo; use somente conteúdo confiável e aspas apropriadas para valores especiais. Execute na pasta do projeto:

```bash
set -a
source .env
set +a
npm run worker:glpi
```

Esse comando consome a fila real configurada e pode criar chamados. Para validar, utilize uma fila/projeto de teste. Se uma variável obrigatória faltar, o worker informa apenas seu nome e encerra com código 1.

Mensagens esperadas: LabManager GLPI worker started, Sending queued ticket e Ticket ... sent to GLPI as .... Falhas são enviadas ao stderr e, quando possível, gravadas em last_error.

### Exemplo de serviço persistente

O modelo a seguir é uma proposta; **não está instalado**. Adapte usuário, diretório e caminho absoluto do Node.js ao host. Guarde a configuração protegida em /etc/labmanager/glpi-worker.env, legível apenas pelo administrador e pelo serviço conforme a política local.

```ini
[Unit]
Description=LabManager GLPI worker
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=labmanager
WorkingDirectory=/opt/labmanager
EnvironmentFile=/etc/labmanager/glpi-worker.env
ExecStart=/usr/bin/node /opt/labmanager/scripts/glpi-worker.mjs
Restart=on-failure
RestartSec=10
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

Após criar o usuário, ajustar permissões, instalar código/dependências e salvar a unit como labmanager-glpi.service, a equipe pode ativá-la:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now labmanager-glpi.service
sudo systemctl status labmanager-glpi.service
sudo journalctl -u labmanager-glpi.service -n 100 --no-pager
```

Não mantenha simultaneamente um worker manual esquecido e o serviço. A reserva atômica existe, mas não resolve todos os cenários de duplicidade. Antes de reiniciar durante processamento, consulte os itens em andamento e as limitações de recuperação.

## Diagnóstico

| Sintoma | Verificação |
| --- | --- |
| Build pede URL/chave Supabase | Variáveis NEXT_PUBLIC presentes durante o build; .env.local correto |
| Login rejeitado | Conta/senha em Auth e listas de autorização no servidor |
| Novo usuário não é criado | Trigger handle_new_user e existência da coluna email em user_profiles |
| Admin sem etiquetas | Perfil existente, role correta e leitura permitida |
| Manutenção não salva | RPC instalada, assinatura dos parâmetros, RLS e erro exibido |
| Salva manutenção, mas alerta GLPI | Resposta /api/tickets e tabela/política glpi_ticket_queue |
| Fila cresce | Serviço Ubuntu, variáveis, rede, logs e tentativas |
| Processing antigo | Queda/interrupção; reconciliar com GLPI antes de reenviar |
| Chamados duplicados | Falha entre criação GLPI e confirmação no Supabase |
| Dados não atualizam em outra tela | Publicação pc_status, assinatura Realtime e conexão |
| Câmera indisponível | Permissão, contexto seguro, BarcodeDetector; usar entrada manual |
| Etiqueta leva ao domínio errado | Etiquetas geradas em origem temporária; regenerar no domínio final |
| npm run lint não está pronto | Configuração ESLint ausente, conforme inspeção |

Consulte as queries somente leitura no [guia do banco](BANCO-DE-DADOS.md). Logs GLPI podem incluir detalhes internos; compartilhe apenas trechos necessários, sem tokens ou dados pessoais.

## Roteiro de aceite em ambiente de teste

1. Conferir 320 identificadores e totais por laboratório no seed e nas constantes.
2. Entrar como usuário comum; confirmar acesso às telas e bloqueio da área admin.
3. Entrar como admin e validar etiquetas no domínio escolhido.
4. Relatar problema: conferir uma alteração de status e o evento correspondente.
5. Observar a atualização em outra sessão aberta no laboratório/dashboard.
6. Conferir fila, consumo pelo worker e ID de chamado no GLPI de teste.
7. Resolver o PC: conferir estado ok e log, lembrando que GLPI não é encerrado automaticamente.
8. Validar busca, filtros e paginação do histórico.
9. Validar QR/campo manual, logout e acesso a link protegido após logout.
10. Testar as correções de segurança e falhas de integração descritas em Pendências antes de liberar produção.

## Continuidade e informações ainda necessárias

Não há rotina de backup/restauração ou monitoramento implementada no repositório. A equipe deve registrar e testar o procedimento de backup do Supabase e GLPI, conferir restauração em ambiente separado e definir acompanhamento de fila/erros.

Permanecem a levantar: domínio público, referência do projeto Supabase, proprietário e responsáveis, versão/configuração GLPI, caminho de instalação Ubuntu, serviço realmente usado, política de backup e procedimento de recuperação. Credenciais ficam em armazenamento de segredos, não nesta documentação.

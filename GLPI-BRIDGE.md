# GLPI Bridge sem abrir porta no roteador

Este fluxo permite que o LabManager na Vercel crie chamados no GLPI interno sem acesso direto ao IP `10.x.x.x`.

## Como funciona

1. O LabManager salva a manutencao no Supabase.
2. A API `/api/tickets` grava um item em `glpi_ticket_queue`.
3. Um worker rodando no Ubuntu da escola le essa fila.
4. O Ubuntu cria o chamado no GLPI usando a rede interna.

Fluxo:

```txt
Vercel -> Supabase -> Worker no Ubuntu -> GLPI interno
```

## 1. Criar a fila no Supabase

No SQL Editor do Supabase, execute:

```txt
supabase-glpi-queue.sql
```

## 2. Configurar variaveis no Ubuntu

No Ubuntu, dentro da pasta do projeto, crie um `.env` local para o worker:

```env
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
GLPI_API_URL=http://10.109.160.50/apirest.php
GLPI_APP_TOKEN=SEU_APP_TOKEN
GLPI_USER_TOKEN=SEU_USER_TOKEN
GLPI_WORKER_INTERVAL_MS=10000
GLPI_WORKER_MAX_ATTEMPTS=5
```

Importante: `SUPABASE_SERVICE_ROLE_KEY` fica somente no Ubuntu. Nao coloque essa chave na Vercel nem no frontend.

## 3. Rodar o worker manualmente

```bash
set -a
source .env
set +a
npm run worker:glpi
```

Quando houver chamados pendentes, o terminal deve mostrar:

```txt
Sending queued ticket ...
Ticket ... sent to GLPI as ...
```

## 4. Ativar modo fila na Vercel

Na Vercel, configure:

```env
GLPI_DELIVERY_MODE=queue
```

Depois faca um novo deploy.

## 5. Manter o worker ligado

Para producao, rode o worker como servico `systemd`, PM2 ou Docker. O ponto principal e que ele fique rodando dentro da rede que acessa o GLPI.

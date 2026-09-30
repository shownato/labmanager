# Banco de dados

[Voltar ao índice](../README.md)

Este guia descreve os SQLs versionados. Não confirma a estrutura aplicada ao Supabase em produção. UUIDs usam `gen_random_uuid()` e datas usam `TIMESTAMPTZ`.

Atualização para professores: `supabase-teacher-profiles.sql` é uma migração complementar após o schema principal. Adiciona email/updated_at quando ausentes, padroniza o trigger e remove o UPDATE de perfil que permitia mudar role. As descrições dos scripts antigos abaixo continuam relevantes antes dessa migração. Não reaplique add-roles.sql depois dela.

## Estrutura

### pc_status

Uma linha por computador, com nome único.

| Campo | Tipo/restrição | Uso |
| --- | --- | --- |
| id | UUID, PK, gerado | Identificador |
| pc_name | TEXT, obrigatório, único | Nome do PC |
| lab_id | INTEGER, obrigatório, 1–10 | Laboratório |
| status | TEXT, obrigatório, default ok | ok ou maintenance |
| reason, notes | TEXT, opcionais | Problema atual |
| reported_by | TEXT | Autor do relato |
| reported_at | TIMESTAMPTZ | Data do relato |
| resolved_by | TEXT | Autor da resolução |
| resolved_at | TIMESTAMPTZ | Data da resolução |
| created_at, updated_at | TIMESTAMPTZ, default NOW() | Controle temporal |

Índices explícitos em laboratório, status e nome. O trigger `pc_status_updated_at` atualiza `updated_at`. Não existe tabela de laboratórios nem vínculo que confira o nome do PC contra o inventário do frontend.

### maintenance_log

Registro de eventos; não há chave estrangeira para `pc_status`.

| Campo | Tipo/restrição | Uso |
| --- | --- | --- |
| id | UUID, PK | Evento |
| pc_name | TEXT, obrigatório | PC |
| lab_id | INTEGER, obrigatório, 1–10 | Laboratório |
| action | TEXT, obrigatório | reported ou resolved |
| status | TEXT | Estado associado ao evento |
| reason | TEXT, obrigatório | Motivo ou Problema Resolvido |
| notes | TEXT | Observações |
| performed_by | TEXT, obrigatório | Nome informado pelo cliente |
| performed_by_email | TEXT | E-mail informado pelo cliente |
| created_at | TIMESTAMPTZ, default NOW() | Data |

Índices em laboratório, ação, data decrescente e nome do PC. A aplicação não oferece edição ou exclusão do histórico.

### user_profiles

`supabase-setup.sql` cria `id` UUID como PK/FK para `auth.users` com exclusão em cascata, `full_name`, `role` (user/admin, default user) e `created_at`.

`add-roles.sql` declara outra versão, acrescentando `email NOT NULL`, `updated_at` e `role NOT NULL`. Como usa `CREATE TABLE IF NOT EXISTS`, **não adiciona esses campos a uma tabela existente**. Seu novo trigger passa a inserir `email`, produzindo incompatibilidade ao seguir a sequência antiga do README.

`handle_new_user` e `on_auth_user_created` criam o perfil após cadastro no Auth. O nome vem de `raw_user_meta_data.full_name`. Não há rotina de preenchimento retroativo de perfis de usuários já existentes.

### glpi_ticket_queue

| Campo | Tipo/restrição | Uso |
| --- | --- | --- |
| id | UUID, PK | Item da fila |
| title, description | TEXT, obrigatórios | Conteúdo do chamado |
| requested_by, requested_by_email | TEXT | Solicitante |
| status | TEXT, default pending | pending, processing, sent, failed |
| attempts | INTEGER, default 0 | Número de reservas/tentativas |
| last_error | TEXT | Erro mais recente, truncado pelo worker a 1.000 caracteres |
| glpi_ticket_id | TEXT | ID retornado pelo GLPI |
| locked_at, sent_at | TIMESTAMPTZ | Reserva e envio |
| created_at, updated_at | TIMESTAMPTZ, default NOW() | Controle temporal |

Índices em `(status, created_at)` e solicitante. Não há FK para usuário, PC ou histórico.

## RPCs

### report_pc_issue

Parâmetros: `p_pc_name TEXT`, `p_lab_id INTEGER`, `p_reason TEXT`, `p_notes TEXT`, `p_user_name TEXT`, `p_user_email TEXT`. Retorna `VOID`.

Insere ou atualiza o PC para `maintenance`, registra problema/autor/data e limpa dados de resolução. Insere um evento `reported` na mesma transação. No conflito por nome, não atualiza `lab_id`; os parâmetros precisam representar o equipamento correto.

### resolve_pc_issue

Parâmetros: `p_pc_name TEXT`, `p_lab_id INTEGER`, `p_notes TEXT`, `p_user_name TEXT`, `p_user_email TEXT`. Retorna `VOID`.

Atualiza o PC correspondente ao nome e laboratório para `ok`, limpa o relato atual, registra resolução e adiciona evento `resolved`. Não verifica se o UPDATE atingiu uma linha: pode gerar log mesmo sem PC correspondente. Não fecha chamado GLPI.

As duas funções são `SECURITY DEFINER`, sem conferência interna de `auth.uid()`, `search_path` fixado ou restrição explícita de execução nos scripts. Também aceitam a identidade fornecida pelo cliente. Essas propriedades exigem correção antes de confiar no histórico como auditoria protegida.

### claim_next_glpi_ticket

Parâmetro: `p_max_attempts INTEGER DEFAULT 5`. Retorna `SETOF glpi_ticket_queue` com até um item.

Seleciona o item mais antigo `pending` ou `failed`, abaixo do limite de tentativas e com bloqueio ausente ou anterior a cinco minutos. Usa `FOR UPDATE SKIP LOCKED`, muda para `processing`, incrementa tentativas e marca o bloqueio. A execução é revogada de PUBLIC, anon e authenticated e concedida a service_role.

Itens `processing` não entram na seleção, mesmo com bloqueio antigo; a recuperação após queda do worker não está implementada.

## View e Realtime

`lab_summary_view` agrupa linhas existentes em `pc_status` por `lab_id`, retornando `total`, `ok` e `maintenance`. A contagem difere potencialmente do frontend, que utiliza o inventário estático de 320 PCs. O dashboard atual não consulta essa view.

O SQL define proprietário postgres e concede SELECT para authenticated e anon. Essa exposição deve ser revisada. A publicação `supabase_realtime` recebe somente `pc_status` pelo script principal.

## Políticas RLS declaradas

| Objeto | Políticas |
| --- | --- |
| pc_status | authenticated pode SELECT, INSERT e UPDATE sem filtro por usuário |
| maintenance_log | authenticated pode SELECT e INSERT sem filtro por usuário |
| user_profiles | SELECT do próprio perfil; add-roles adiciona UPDATE do próprio perfil |
| glpi_ticket_queue | authenticated pode INSERT sem restrições de valores; SELECT compara e-mail com JWT |

O UPDATE do próprio perfil não protege a coluna `role`. As listas de e-mails da aplicação não são replicadas nas políticas. RLS e privilégios efetivamente instalados devem ser inspecionados no banco, incluindo concessões padrão do projeto.

## Instalação e migrações

Não execute os três scripts indiscriminadamente em produção. Eles não têm controle de versão de migração; políticas, triggers e publicação podem falhar ao serem reaplicados.

Sequência de preparação a concluir pela equipe:

1. Inspecionar schema e permissões existentes e obter backup conforme a infraestrutura usada.
2. Consolidar uma única definição de perfis e corrigir as pendências de autorização.
3. Criar migrações revisáveis para estrutura principal, perfis e fila.
4. Aplicar e testar em um projeto de desenvolvimento.
5. Popular inventário apenas após conferir registros existentes.
6. Validar criação de usuário, acesso, relato/resolução e processamento GLPI.

O comando abaixo **somente imprime SQL**:

```bash
node generate-sql.js
```

Ele gera 320 linhas em um INSERT, sem `ON CONFLICT`. Reexecutá-lo em inventário já populado pode falhar por nome duplicado. O gerador duplica a configuração do frontend e precisa ser mantido em sincronia.

Para promover um usuário, a equipe pode executar uma atualização por UUID no contexto administrativo do banco, após conferir o perfil correto. Não há tela para essa operação. Não use como referência um campo `email` sem antes conferir qual versão da tabela existe.

## Consultas de diagnóstico somente leitura

Execute com uma conta administrativa autorizada; resultados podem conter informação interna.

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_profiles'
ORDER BY ordinal_position;

SELECT lab_id, count(*) AS total
FROM public.pc_status GROUP BY lab_id ORDER BY lab_id;

SELECT status, count(*) AS total, min(created_at) AS mais_antigo
FROM public.glpi_ticket_queue GROUP BY status;

SELECT id, status, attempts, locked_at, last_error, glpi_ticket_id
FROM public.glpi_ticket_queue
WHERE status = 'failed'
   OR (status = 'processing' AND locked_at < now() - interval '5 minutes');

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public';
```

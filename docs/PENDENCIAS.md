# Pendências e limites conhecidos

[Voltar ao índice](../README.md)

Levantamento estático do código em 30/09/2026. Não comprova exploração de falhas nem a presença dessas definições no banco de produção. A documentação não corrige a implementação.

Atualização posterior: o cadastro por matrícula acrescentou 11 testes e a migração `supabase-teacher-profiles.sql`, que trata a incompatibilidade de perfis e remove a alteração da própria role. Ela ainda precisa ser aplicada. As pendências das RPCs e da fila permanecem. A senha inicial igual à matrícula foi solicitada; não existe troca obrigatória no primeiro acesso.

## Prioridade alta

| Achado | Evidência | Impacto e ação necessária |
| --- | --- | --- |
| Atualização da própria role | `add-roles.sql`, política de UPDATE de user_profiles | A política não bloqueia mudar role para admin. Restringir colunas/privilégios e reservar promoção para operação administrativa |
| RPCs privilegiadas sem autenticação interna | `supabase-setup.sql`, report_pc_issue e resolve_pc_issue | SECURITY DEFINER, sem auth.uid ou revogação explícita de execução; conferir grants, restringir chamadas, fixar search_path e derivar identidade da sessão |
| Perfis incompatíveis entre scripts | `supabase-setup.sql` e `add-roles.sql` | A segunda definição não adiciona email, mas o trigger usa a coluna. Consolidar schema e migrar perfis existentes |
| Autorização restrita à camada Next.js | `authorization.ts` e políticas SQL | Chamadas diretas ao Supabase não passam pelas listas de e-mail do middleware. Aplicar as regras necessárias também no banco |

## Confiabilidade da integração

| Achado | Consequência | Correção proposta, ainda não implementada |
| --- | --- | --- |
| Reserva não recupera processing antigo | Queda do worker deixa itens presos | Recuperação com prazo e proteção contra execução concorrente |
| Falha após GLPI criar e antes de markSent | Retentativa pode duplicar chamado | Idempotência/reconciliação com identificador estável |
| Relato e fila em duas requisições | Manutenção pode existir sem chamado enfileirado | Inserir evento de envio na mesma transação do relato |
| INSERT da fila usa WITH CHECK true | Cliente autenticado pode fornecer campos que deveriam ser controlados pelo servidor | Restringir campos, identidade e estado inicial |
| Worker sem timeout explícito e setInterval sobreposto | Requisições longas podem acumular execuções | Timeout, execução controlada e tratamento de encerramento |
| Ausência de encerramento GLPI na resolução | Dois sistemas podem manter estados divergentes | Definir se haverá sincronização e preservar associação com o chamado |

Antes de reenviar manualmente um item, confira se o GLPI já criou o chamado. Não basta mudar todos os itens presos para pending sem reconciliação.

## Qualidade e manutenção

- ESLint instalado, mas sem configuração; execução direta falhou na inspeção.
- Não há suíte de testes nem pipeline de CI encontrados no checkout.
- Build completo não validado sem variáveis Supabase; a compilação e a checagem de tipos passaram na inspeção inicial.
- Scripts SQL não são migrações idempotentes; reexecuções podem falhar em políticas, triggers, publicação e seed.
- View de resumo concedida a anon e não usada no dashboard: revisar exposição e finalidade.
- Status e histórico aceitam nomes/e-mails do cliente; não equivalem a uma trilha de auditoria imutável.
- resolve_pc_issue registra resolução mesmo sem atualizar equipamento; report_pc_issue não corrige lab_id no conflito por nome.
- Inventário duplicado em constants.ts e generate-sql.js; PCs sem linha no banco são apresentados como ok.
- Tipo MaintenanceLog em constants.ts difere do modelo SQL; a tela usa um tipo local compatível com os campos consultados.
- Não há agente de disponibilidade, gestão de ativos pela interface, painel da fila, fluxo de recuperação de senha ou gestão visual de usuários.
- QR codes dependem de serviço externo e enviam a URL do equipamento; avaliar geração local conforme necessidade operacional.

## Critérios para próxima validação

1. Corrigir schema e permissões, verificando tanto chamadas pela aplicação quanto acesso direto ao banco com papéis apropriados.
2. Configurar ambiente de desenvolvimento e concluir build e lint.
3. Testar login, autorização admin, relato/resolução e consistência do histórico.
4. Verificar integração em ambiente de teste, incluindo queda do worker e falha após criação GLPI.
5. Registrar domínio, projeto Supabase, responsável operacional e serviço Ubuntu sem incluir segredos.

Estado de deploy, dados reais, backups, observabilidade, versões do Ubuntu/GLPI e propriedade das contas permanecem não verificados.

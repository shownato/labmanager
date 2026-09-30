# Permissões de manutenção

Execute `supabase-maintenance-permissions.sql` após o schema base. A migração usa transação e não altera os estados atuais dos computadores. Cadastre os UUIDs das contas verificadas em `public.maintenance_technicians` usando o SQL Editor ou uma chave administrativa. Não conceda escrita nessa tabela aos clientes.

`can_resolve_pc_issue()` consulta a autorização atual por `auth.uid()`. A interface assume acesso negado até a consulta terminar e em caso de erro. Professores podem relatar inclusive em PCs já em manutenção. Cada relato fica no histórico; o cartão mostra o relato mais recente.

`resolve_pc_issue()` verifica essa mesma autorização no banco, antes de atualizar o estado. Apenas uma transição de manutenção para funcionamento gera log. Solicitações repetidas ou concorrentes de resolução não geram registros falsos.

`report_pc_issue()` exige autenticação, motivo e computador pertencente ao laboratório. Ambas as RPCs obtêm a autoria a partir da sessão, ignorando os parâmetros de identidade legados enviados pela interface. Os parâmetros são mantidos para compatibilidade com clientes já publicados.

As tabelas `pc_status` e `maintenance_log` ficam disponíveis aos usuários para leitura; escritas diretas são revogadas para evitar contornar as RPCs. O papel `admin` existente continua controlando a página de etiquetas e não concede liberação de equipamentos.

Para alterar a equipe, confirme a conta por UUID e modifique a tabela pelo acesso administrativo. Não use nomes como regra de autorização. Remover uma linha revoga a permissão imediatamente no backend, inclusive em sessões abertas.

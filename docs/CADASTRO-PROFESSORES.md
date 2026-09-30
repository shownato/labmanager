# Cadastro de professores por matrícula

[Voltar ao índice](../README.md)

## Regra de acesso

O professor informa **exatamente os seis primeiros dígitos da matrícula**, preservando zeros à esquerda. A senha inicial é a mesma sequência, conforme solicitado. Exemplo fictício: matrícula `001234-5-01`, login `001234` e senha inicial `001234`.

O nome completo é preservado e aparece na navegação após o login. Todos os novos perfis são `user`. A tela apresenta as opções **Matrícula** e **E-mail**; a segunda mantém as contas existentes sem alteração de senha ou perfil. O nome não é usado como credencial de entrada.

A senha é previsível porque coincide com o identificador. Troca obrigatória no primeiro acesso foi recomendada, mas **não foi implementada**. A política de senhas do Supabase precisa aceitar seis dígitos; o importador não altera essa política automaticamente.

## Fonte validada

A lista entregue em 30/09/2026 possui 125 registros em `Plan1!A2:B126`, com cabeçalhos `matricula` e `nome`. Todos têm nome e matrícula; os seis primeiros dígitos são únicos. As demais abas estão vazias. O Excel original não foi alterado.

O JSON fica em `.private/teachers-import.json`, ignorado pelo Git. Contém nomes e matrículas, sem campo de senha, mas deve ser tratado como sensível porque a senha inicial pode ser derivada. Não publique a lista nem a inclua no bundle do frontend.

## Implementação

O login visível é numérico. Internamente, `src/lib/auth/matricula.mjs` converte-o para `SEISDIGITOS@matricula.labmanager.invalid`, um alias de autenticação sem caixa de e-mail. A importação usa a [API administrativa createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser) com confirmação automática, sem envio de convite.

O importador grava `labmanager_login_type`, `matricula_login` e `matricula_full` em `app_metadata`. Middleware e API aceitam aliases somente quando correspondem aos metadados administrativos. Não basta ter o domínio ou alterar `user_metadata`. Contas CCI por e-mail mantêm as listas de autorização existentes.

O nome fica em `user_metadata.full_name` e no perfil criado pelo trigger. A interface e o conteúdo dos chamados mostram a matrícula. Os campos históricos de e-mail e a fila mantêm o alias para compatibilidade com o banco. Esses aliases não permitem recuperação por e-mail; resets precisam de procedimento administrativo.

## Preparar outra lista

O leitor usa a biblioteca padrão do Python, sem alterar o XLSX. Matrículas precisam estar armazenadas como texto para preservar zeros. Fórmulas, campos ausentes e prefixos duplicados bloqueiam a preparação.

```powershell
python scripts/prepare-teachers.py "C:\caminho\professores.xlsx" --sheet Plan1 --output .private/teachers-import.json
npm run import:teachers
```

O leitor não sobrescreve arquivo existente. Para outra lista, escolha outro caminho e passe `--file` ao importador. A simulação local valida a lista inteira sem conectar ao Supabase.

## Preparar o destino

1. Confirmar o projeto Supabase correto.
2. Revisar e aplicar `supabase-teacher-profiles.sql` após o schema principal. Ele adiciona colunas ausentes, corrige o trigger e remove a permissão antiga de atualizar a própria role. Não cria contas nem redefine administradores.
3. Não reaplicar `add-roles.sql` depois, pois ele reintroduz a política ampla de UPDATE.
4. Conferir política de senha, configuração de cadastro público e demais pendências de RLS/RPCs. A autorização Next.js não corrige as falhas anteriores de acesso direto ao banco.
5. Configurar a credencial administrativa em ambiente local confiável.

```powershell
Copy-Item .env.import.example .env.import.local
```

Preencha URL e service_role localmente. Não compartilhe a chave no chat, não a versione e não use variáveis NEXT_PUBLIC para ela. Não sobrescreva arquivo de credenciais existente. A aplicação web mantém URL e chave pública em `.env.local`.

## Pré-verificar e cadastrar

Os exemplos com `--env-file` exigem Node.js 20.6+ compatível com o projeto. Substitua a URL abaixo pelo destino autorizado:

```powershell
node --env-file=.env.import.local scripts/import-teachers.mjs --preflight
node --env-file=.env.import.local scripts/import-teachers.mjs --apply --project-url https://SEU-PROJETO.supabase.co
```

A pré-verificação consulta o schema e pagina usuários pela [API listUsers](https://supabase.com/docs/reference/javascript/auth-admin-listusers). Detecta aliases ocupados e confere perfis de contas já importadas. A aplicação exige URL explícita igual à configurada.

As criações são sequenciais, verificando cada perfil antes de continuar. Um erro interrompe o lote e informa quantas contas foram criadas. Não há rollback global entre chamadas Auth. Corrija a causa e reexecute: contas existentes são preservadas e **suas senhas não são redefinidas**. Colisões com outras identidades exigem revisão manual.

Se uma conta foi criada sem perfil correto, corrija trigger/perfil antes de continuar. O importador não apaga usuários, promove administradores ou envia e-mails. Não armazena senhas em relatórios nem imprime dados pessoais por registro.

## Validação e situação

- Simulação local: 125 registros válidos e distintos.
- `npm run test:auth`: 11 testes de identidade, autorização, colisões, paginação, falhas e preservação de contas.
- Checagem de tipos: `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- Build aprovado com URL/chave pública fictícias apenas para validar a compilação e geração das páginas. Isso não valida conexão, sessão real ou cadastro; gere novo build com a configuração real antes de publicar.
- Cadastro real, aplicação SQL, login real e deploy ainda dependem de acesso ao Supabase.

Após importar e publicar, validar um professor, uma conta CCI e o fluxo de manutenção/GLPI. A migração não resolve todas as [pendências de segurança](PENDENCIAS.md).

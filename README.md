# LabManager

Sistema do CCI para registrar e acompanhar manutenções de **320 computadores em 10 laboratórios**. Os estados são informados pelos usuários; não há agente de telemetria para detectar se uma máquina está ligada ou conectada.

Documentação revisada em **30/09/2026**, a partir do código do commit `59443b0`. Os serviços em produção não foram inspecionados.

## Documentação

| Guia | Conteúdo |
| --- | --- |
| [Guia de uso](docs/GUIA-DE-USO.md) | Acesso, inventário, manutenção, histórico e QR codes |
| [Cadastro de professores](docs/CADASTRO-PROFESSORES.md) | Matrículas, importação administrativa e situação do cadastro |
| [Arquitetura](docs/ARQUITETURA.md) | Stack, estrutura, rotas, fluxos e API |
| [Banco de dados](docs/BANCO-DE-DADOS.md) | Tabelas, RPCs, RLS, view e instalação |
| [Operação](docs/OPERACAO.md) | Configuração, implantação, worker e diagnóstico |
| [Pendências](docs/PENDENCIAS.md) | Problemas identificados e prioridades |
| [Ponte GLPI](GLPI-BRIDGE.md) | Referência rápida da integração por fila |

## Funcionalidades implementadas

- Login de professores pelos seis primeiros dígitos da matrícula e senha; opção separada por e-mail para a equipe CCI.
- Dashboard, resumo por laboratório e detalhamento de PCs em manutenção.
- Relato e resolução de problemas com histórico e RPCs atômicas.
- Dashboard e laboratórios atualizados via Supabase Realtime.
- Histórico com busca, filtros e paginação.
- Leitor QR com câmera compatível e entrada manual.
- Impressão de etiquetas restrita a administradores.
- Tema claro/escuro e navegação responsiva.
- Chamados GLPI por fila ou envio direto.

## Stack e execução local

Next.js 15, React 19, TypeScript, Tailwind CSS 3, Lucide React e Supabase. O worker GLPI é um processo Node.js separado. As versões reproduzíveis estão em `package-lock.json`; Framer Motion não é dependência.

Use Node.js compatível com todas as dependências do lockfile e npm. Confira os requisitos em [Operação](docs/OPERACAO.md).

```powershell
npm ci
Copy-Item .env.local.example .env.local
```

Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Utilize um banco de desenvolvimento previamente preparado. Leia [Banco de dados](docs/BANCO-DE-DADOS.md) antes de executar os SQLs: os scripts atuais possuem incompatibilidades e não constituem uma sequência segura de migrações.

```powershell
npm run dev
```

Abra `http://localhost:3000`. Para produção: `npm run build` e `npm start`. As variáveis públicas do Supabase precisam existir durante o build.

## Estado verificado

Em 30/09/2026, TypeScript e sintaxe do worker passaram. O build compilou o código, mas falhou na pré-renderização por ausência das variáveis do Supabase. O ESLint não encontrou configuração. Não foi encontrada suíte automatizada.

Atualização posterior: o cadastro por matrícula acrescentou 11 testes de autenticação/importação, todos aprovados. As 125 contas da lista recebida ainda dependem de execução administrativa no Supabase; consulte o guia de cadastro.

O build também passou com valores fictícios de Supabase para validação técnica. Integrações reais não foram testadas; a publicação exige novo build com as variáveis corretas.

Permissões, compatibilidade dos SQLs e recuperação da fila têm [pendências conhecidas](docs/PENDENCIAS.md). A disponibilidade da Vercel, do Supabase e do Ubuntu não foi confirmada.

## Manutenção

Atualize o guia correspondente a cada mudança. Alterações no inventário exigem revisão de `src/lib/constants.ts`, `generate-sql.js` e da documentação. Não registre credenciais ou dados reais de usuários nos exemplos.


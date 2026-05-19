# 🖥️ LabManager

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-blue?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Supabase-Backend-emerald?style=for-the-badge&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
</p>

> **Sistema inteligente para gestão e monitoramento de laboratórios de informática.** Controle 310 computadores em tempo real com uma interface moderna e focada em produtividade.

---

## ✨ Funcionalidades

- 📊 **Dashboard Consolidado**: Visualize a saúde de todos os 10 laboratórios em um único lugar.
- 🖥️ **Grid Interativo**: Cada laboratório possui um grid visual dos 31 PCs (LABX00-LABX30).
- 🛠️ **Gestão de Manutenção**: Relate problemas técnicos com gravidade (Manutenção vs Crítico) e motivos pré-definidos.
- 🕒 **Histórico em Tempo Real**: Acompanhe todas as ações realizadas no laboratório com atualizações instantâneas via Supabase Realtime.
- 🔐 **Autenticação Segura**: Fluxo completo de login e cadastro integrado ao Supabase Auth.
- 🌓 **Dark Mode Nativo**: Interface otimizada para uso diurno e noturno com Glassmorphism.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), Tailwind CSS, Lucide React, Framer Motion.
- **Backend**: Supabase (PostgreSQL, Auth, Realtime).
- **Linguagem**: TypeScript.

---

## 🚀 Como Iniciar

### 1. Requisitos
- Node.js 18+ instalado.
- Uma conta no [Supabase](https://supabase.com).

### 2. Clonar e Instalar
```bash
git clone <url-do-repositorio>
cd labmanager
npm install
```

### 3. Configuração do Banco de Dados (Supabase)
No SQL Editor do seu projeto Supabase, execute os arquivos na seguinte ordem:

1.  **`supabase-setup.sql`**: Cria as tabelas base, índices e políticas de segurança (RLS).
2.  **`add-roles.sql`**: Configura o sistema de perfis e roles de usuário.
3.  **Popular Dados**: Execute o comando abaixo para gerar o SQL de inserção inicial de todos os 240 PCs:
    ```bash
    node generate-sql.js
    ```
    Copie o resultado e execute no SQL Editor.

### 4. Variáveis de Ambiente
Crie um arquivo `.env.local` na raiz da pasta `labmanager`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

### 5. Rodar em Desenvolvimento
```bash
npm run dev
```
Acesse [http://localhost:3000](http://localhost:3000)

---

## 📂 Organização de Laboratórios

| Lab | Prefixo | Faixa de PCs | Total |
| :-- | :--- | :--- | :--- |
| **Lab 1** | 100 | LAB100 — LAB130 | 31 |
| **Lab 2** | 200 | LAB200 — LAB230 | 31 |
| **Lab 3** | 300 | LAB300 — LAB330 | 31 |
| **Lab 4** | 400 | LAB400 — LAB430 | 31 |
| **Lab 5** | 500 | LAB500 — LAB535 | 36 |
| **Lab 6** | 600 | LAB600 — LAB630 | 31 |
| **Lab 7** | 700 | LAB700 — LAB735 | 36 |
| **Lab 8** | 800 | LAB800 — LAB830 | 31 |
| **Lab 9** | 900 | LAB900 — LAB930 | 31 |
| **Lab 10** | 1000 | LAB1000 — LAB1030 | 31 |

---

## 📜 Licença
Desenvolvido para o **CCI (Centro de Computação e Informática)**.


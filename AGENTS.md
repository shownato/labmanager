# AGENTS.md - LabManager

## Stack Técnica
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS 3, Lucide React
- **Backend/Database**: Supabase (@supabase/supabase-js, @supabase/ssr)
- **Integrações**: GLPI API (App-Token e User-Token) para criação silenciosa de chamados paralelos
- **Servidor Dedicado GLPI**: Ubuntu Server (`glpiserver`)

## Padrões de Engenharia
- **Padrão "Iceberg"**: Divisão robusta de lógica de dados e regras de negócio no backend/RPCs do Supabase, deixando a interface leve.
- **RPCs Atômicas**: Uso de RPCs atômicas para logs e atualizações de status.
- **Views**: Uso de views no banco de dados para otimização de performance.

## Sincronização de Agentes
- **Última Atualização**: Gemini (Antigravity Kit) - Inicialização do AGENTS.md

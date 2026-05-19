/**
 * Utilitário de integração com a API REST do GLPI
 * Este módulo roda apenas no Servidor (Server-side) para proteger os tokens.
 */

const GLPI_API_URL = process.env.GLPI_API_URL;
const GLPI_APP_TOKEN = process.env.GLPI_APP_TOKEN;
const GLPI_USER_TOKEN = process.env.GLPI_USER_TOKEN;

// Verifica as credenciais durante o boot
if (!GLPI_API_URL || !GLPI_APP_TOKEN || !GLPI_USER_TOKEN) {
  console.warn("⚠️ Aviso: Credenciais da API do GLPI ausentes no .env.local. A integração de chamados não vai funcionar.");
}

export interface GlpiTicketInput {
  name: string;      // Título/Assunto do chamado
  content: string;   // Descrição completa com os detalhes
  urgency?: number;  // 1 (Muito Baixa) a 5 (Muito Alta)
  impact?: number;   // 1 (Muito Baixo) a 5 (Muito Alto)
}

/**
 * Inicia uma sessão com a API do GLPI e retorna o Token de Sessão (temporário)
 */
async function initSession(): Promise<string> {
  const url = `${GLPI_API_URL}/initSession`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'App-Token': GLPI_APP_TOKEN!,
      'Authorization': `user_token ${GLPI_USER_TOKEN!}`
    },
    cache: 'no-store' // Impede que o Next.js faça cache de uma sessão velha
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("GLPI initSession erro:", errorText);
    throw new Error(`Falha ao iniciar sessão no GLPI (Status ${response.status})`);
  }

  const data = await response.json();
  return data.session_token;
}

/**
 * Finaliza a sessão com a API do GLPI (Boas práticas para limpar o banco do servidor)
 */
async function killSession(sessionToken: string): Promise<void> {
  const url = `${GLPI_API_URL}/killSession`;
  
  await fetch(url, {
    method: 'GET',
    headers: {
      'App-Token': GLPI_APP_TOKEN!,
      'Session-Token': sessionToken
    }
  }).catch(err => console.error("Falha ao fechar sessão GLPI silenciosamente:", err));
}

/**
 * Função principal: Cria um chamado (Ticket) no GLPI
 */
export async function createTicket(ticketData: GlpiTicketInput) {
  if (!GLPI_API_URL) {
    throw new Error("Integração com GLPI não configurada no servidor.");
  }
  
  let sessionToken = null;
  
  try {
    // 1. Abre a porta do GLPI
    sessionToken = await initSession();

    // 2. Envia os dados do Chamado
    const url = `${GLPI_API_URL}/Ticket`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'App-Token': GLPI_APP_TOKEN!,
        'Session-Token': sessionToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: {
          name: ticketData.name,
          content: ticketData.content,
          urgency: ticketData.urgency || 3, // 3 = Média
          impact: ticketData.impact || 3,   // 3 = Média
          priority: 3, // Prioridade é calculada baseada em urgency e impact, mas mandamos 3 por segurança
          type: 1, // 1 = Incidente (problema a resolver), 2 = Requisição (novo serviço)
          requesttypes_id: 1 // Origem: 1 = Helpdesk
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GLPI Create Ticket erro:", errorText);
      throw new Error(`Falha ao criar chamado no GLPI: ${response.status}`);
    }

    const data = await response.json();
    return { 
      success: true, 
      ticketId: data.id, 
      message: data.message 
    };

  } catch (error) {
    console.error("Erro severo na integração GLPI:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Erro desconhecido ao comunicar com GLPI" 
    };
  } finally {
    // 3. Fecha a porta do GLPI (Mesmo se der erro no meio do processo)
    if (sessionToken) {
      await killSession(sessionToken);
    }
  }
}

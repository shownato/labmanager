# Guia de uso

[Voltar ao índice](../README.md)

## Acesso

Acesse `/login`, selecione **Matrícula** e informe os seis primeiros dígitos, sem traços, e sua senha. O nome cadastrado aparece na navegação após entrar. Nos novos cadastros, a senha inicial é a mesma sequência. O acesso depende da conclusão da importação pela equipe CCI. Contas existentes por e-mail selecionam **E-mail** e usam a senha atual. Não há telas de cadastro público, recuperação de senha ou gerenciamento de contas.

A conta usada no painel administrativo do Supabase é distinta do login do LabManager. O e-mail do proprietário do projeto Supabase não está registrado neste repositório.

O perfil `user` consulta laboratórios, relata e resolve problemas, usa o scanner e consulta o histórico. O perfil `admin` também acessa a geração de etiquetas.

Para contas por e-mail, o servidor pode limitar endereços e domínios por variáveis de ambiente; sem listas, aceita autenticados dessa modalidade. Professores com alias interno precisam dos metadados administrativos do importador. Veja [Cadastro de professores](CADASTRO-PROFESSORES.md) e [Pendências](PENDENCIAS.md).

## Inventário

| Laboratório | Identificadores | PCs |
| --- | --- | ---: |
| 1 | LAB100–LAB130 | 31 |
| 2 | LAB200–LAB230 | 31 |
| 3 | LAB300–LAB330 | 31 |
| 4 | LAB400–LAB430 | 31 |
| 5 | LAB500–LAB535 | 36 |
| 6 | LAB600–LAB630 | 31 |
| 7 | LAB700–LAB735 | 36 |
| 8 | LAB800–LAB830 | 31 |
| 9 | LAB900–LAB930 | 31 |
| 10 | LAB1000–LAB1030 | 31 |
| **Total** | | **320** |

O inventário é definido em `src/lib/constants.ts`; não há edição pela interface.

## Dashboard e laboratório

O dashboard apresenta totais, percentual de PCs sem manutenção e cartões por laboratório. O cartão de manutenção abre o detalhamento dos equipamentos afetados.

Selecione um laboratório e clique em um computador para consultar ou registrar um problema. O link `/lab/1?pc=LAB100` abre o laboratório e seleciona o equipamento.

Os estados são `ok` e `maintenance`. “Online” significa ausência de manutenção registrada, não conectividade medida. PCs configurados sem linha no banco também aparecem como `ok`. O dashboard, portanto, não comprova que o inventário foi integralmente populado.

## Relatar manutenção

1. Abra um PC sem manutenção.
2. Escolha o motivo obrigatório.
3. Informe observações, se necessário.
4. Clique em **Relatar Problema** e aguarde.

Há motivos para falhas de energia, sistema, rede, periféricos, desempenho, software, disco, fonte, memória, cabos e “Outro”. Não existe um estado separado de gravidade crítica.

O status e o histórico são gravados juntos. Depois, a aplicação solicita um chamado GLPI. No modo fila, a confirmação significa apenas que o chamado foi enfileirado. Se essa segunda etapa falhar, a manutenção permanece salva e um alerta é exibido. Avise a equipe CCI para conferir a fila antes de repetir a operação.

## Resolver manutenção

Abra o PC em manutenção, confira o relato, descreva o que foi feito e clique em **Colocar Online**. O status muda para `ok` e uma resolução é adicionada ao histórico. Sem observações, é usado “Sem observações adicionais”.

A resolução **não encerra o chamado GLPI**. O acompanhamento no GLPI é separado.

## Histórico

Em `/historico`, busque por PC, motivo ou responsável. Filtre por laboratório e ação: relato (`reported`) ou resolução (`resolved`). Os registros aparecem do mais recente para o mais antigo, com 20 itens por página.

A busca remove caracteres especiais não aceitos e limita o termo a 80 caracteres. A tela consulta novamente ao alterar busca, filtro ou página; não possui assinatura Realtime própria.

## Scanner e etiquetas

Em `/scanner`, permita a câmera e aponte para a etiqueta. O leitor usa `BarcodeDetector` nativo. Quando indisponível, use a entrada manual. O identificador precisa existir no inventário. A câmera depende de permissões e contexto seguro, como HTTPS ou localhost.

Em `/admin/qrcodes`, administradores selecionam um laboratório, copiam links ou imprimem etiquetas. Os links usam o endereço atual do navegador: gere as etiquetas no domínio definitivo.

As imagens são solicitadas ao serviço externo `api.qrserver.com`, que recebe a URL do equipamento. A impressão usa `window.print()`, três colunas e tamanho declarado de 6,5 × 8 cm por etiqueta. Confira a prévia, a escala e o papel antes de imprimir um lote.

## Tema e saída

O tema é persistido no navegador na chave `darkMode` do `localStorage`. Use **Sair** para encerrar a sessão.

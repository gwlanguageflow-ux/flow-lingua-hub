# Assinaturas, agenda e materiais-base

Data: 09/07/2026

## Objetivo

Ampliar os ciclos de assinatura, permitir cancelamento sem interrupcao indevida, organizar o
historico de aulas e permitir que a Diretoria distribua materiais-base aos professores.

## Planos e pacotes

Os planos-base continuam sendo:

- essential: R$ 179,90 por mes
- advanced: R$ 299,90 por mes
- conversation: R$ 169,90 por mes

O aluno escolhe primeiro o professor e o plano. Em seguida, escolhe o pacote:

- mensal: preco-base, cobrado mensalmente;
- semestral: seis mensalidades pagas integralmente, com desconto de 5%;
- anual: doze mensalidades pagas integralmente, com desconto de 10%.

Os pacotes serao variacoes do plano-base, e nao novos planos duplicados. A assinatura guardara o
ciclo contratado, o desconto, o valor total e o periodo de acesso. O checkout mensal permanece
recorrente. Os pacotes semestral e anual usam cobranca integral e liberam acesso por seis ou doze
meses.

Cupons, quando aplicaveis, incidirao sobre o valor do pacote ja calculado. O checkout deve exibir
preco-base, desconto do pacote, desconto de cupom e total final.

## Cancelamento

Aluno e Diretoria podem solicitar cancelamento.

O cancelamento:

- define `cancel_at_period_end`;
- impede nova renovacao;
- preserva acesso, agenda e materiais ate `current_period_end`;
- nao gera reembolso automatico;
- registra ator, data e motivo em log de auditoria.

No plano mensal recorrente, o cancelamento tambem deve ser comunicado ao provedor de pagamento.
Nos pacotes semestral e anual, que sao pagamentos unicos, basta impedir qualquer renovacao futura e
manter o acesso ate o fim contratado.

## Agenda e historico

Os paineis de professor e aluno terao grupos claros:

- proximas aulas;
- aguardando confirmacao;
- concluidas;
- canceladas.

Cada item exibira professor ou aluno, data, horario, duracao, link quando disponivel e status. O
historico preservara aulas concluidas e canceladas, sem remove-las da interface operacional.

## Materiais-base da Diretoria

A Diretoria podera enviar material-base para:

- um professor especifico;
- todos os professores ativos.

O material sera salvo como `source = director` e vinculado individualmente a cada professor
destinatario. Professores receberao o material na aba Material como material-base da Diretoria. O
envio para todos criara um registro por professor para manter rastreabilidade e permissao por
destinatario.

## Pagina inicial

Na vitrine de planos, a ordem sera:

1. advanced
2. essential
3. conversation

O essential permanecera com o selo `MAIS ESCOLHIDO`.

## Seguranca e consistencia

- Operacoes de cancelamento e criacao de checkout serao validadas no backend.
- A Diretoria tera permissao administrativa; o aluno so podera cancelar a propria assinatura.
- Alteracoes de banco serao feitas por migration com RLS e grants revisados.
- Eventos de pagamento permanecerao idempotentes.
- O valor do pacote sera recalculado no servidor, sem confiar no valor enviado pelo navegador.

## Validacao

Serao verificados:

- calculos dos tres ciclos para os tres planos;
- cancelamento por aluno e Diretoria;
- manutencao do acesso ate o fim do periodo;
- checkout e webhook para mensal, semestral e anual;
- listas de agenda e historico;
- envio de material para um professor e para todos;
- ordem dos cards na pagina inicial;
- lint e build de producao.

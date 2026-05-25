# Operadores e Terceiros - GWLanguageFlow

Versao: 2026.05.25
Revisado em: 2026-05-25

Este documento lista terceiros identificados no codigo e na arquitetura da GWLanguageFlow. Ele deve ser revisado antes de ativar novas tags, pixels, ferramentas de suporte, e-mails transacionais ou provedores de pagamento.

## Terceiros ativos ou preparados

| Terceiro                      | Papel                                                      | Dados envolvidos                                                                                 | Base/finalidade                                    | Local no codigo                                                                                                                                      | Status de consentimento                                                    | Medida de protecao                                                        |
| ----------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Supabase                      | Auth, Postgres, Storage, Realtime                          | Conta, e-mail, perfis, CPF, turmas, materiais, mensagens, assinaturas, logs                      | Execucao de contrato, seguranca, cumprimento legal | `src/integrations/supabase/*`, migrations                                                                                                            | Necessario                                                                 | RLS, service role so no servidor, storage policies                        |
| Vercel                        | Hospedagem, server functions, cron, DNS/app runtime        | IP, user-agent, logs tecnicos, requisicoes                                                       | Disponibilizacao do SaaS e seguranca               | `vercel.json`, rotas API                                                                                                                             | Necessario                                                                 | Headers, endpoints internos protegidos por token/cron                     |
| ValidaPay                     | Checkout de cartao/Pix, assinaturas, webhooks e saques Pix | E-mail, CPF/documento, assinatura, status de pagamento, nome, chave Pix, valor e status de saque | Execucao de contrato, pagamento e repasse          | `src/server/validapay.server.ts`, `src/functions/validapay-checkout.functions.ts`, `src/routes/api/public/validapay-webhook.ts`, funcoes de carteira | Necessario para pagamento e saque operacional                              | OAuth client credentials, assinatura HMAC de webhook, checkout hospedado, idempotencia |
| Stripe                        | Webhook legado e compatibilidade de assinaturas antigas    | Customer, assinatura e status de pagamento legados                                               | Execucao de contrato e historico financeiro        | `src/functions/stripe-checkout.functions.ts`, `src/routes/api/public/stripe-webhook.ts`                                                              | Mantido temporariamente para nao quebrar registros antigos                 | Webhook secret, sem cartao local                                          |
| Asaas                         | Integracao legada inativa                                  | Registros historicos de tentativas de saque                                                      | Historico operacional                              | `src/server/asaas.server.ts`, `src/routes/api/public/asaas-webhook.ts`                                                                               | Nao usado em novos pagamentos/saques                                       | Mantido apenas para rastreabilidade antiga                                |
| Google OAuth                  | Login social opcional                                      | Identificador Google, e-mail, nome, avatar quando usuario escolhe                                | Autenticacao por opcao do usuario                  | `src/lib/auth-providers.ts`, `src/routes/auth.login.tsx`                                                                                             | Necessario apenas se usuario escolher Google                               | Redirect controlado, Supabase OAuth                                       |
| Google Fonts                  | Fonte web Fraunces/Plus Jakarta Sans                       | Requisicao tecnica ao dominio de fontes                                                          | Apresentacao visual                                | `src/routes/__root.tsx`                                                                                                                              | Tratado como recurso de apresentacao; pode ser self-hosted em etapa futura | CSP restringe fonte e stylesheet                                          |
| Google Meet ou links externos | Sala de aula quando professor/diretoria usa URL externa    | Acesso ao link externo e dados tratados pelo provedor                                            | Execucao de aula                                   | `MeetingLinkEditor`, `bookings`, `class_groups`                                                                                                      | Depende do uso do link externo                                             | `noopener,noreferrer`; orientacao na politica                             |

## Terceiros nao ativos no codigo atual

| Terceiro                  | Resultado da auditoria                                                                   | Exigencia antes de ativar                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Google Analytics          | Nao encontrado carregamento de `gtag`, `analytics.js` ou tag manager no codigo atual     | Usar `ConsentScript` com categoria `analytics`; atualizar politica e mapa     |
| Meta Pixel/Facebook Pixel | Nao encontrado script/pixel no codigo atual                                              | Usar `ConsentScript` com categoria `marketing`; atualizar politica e mapa     |
| WhatsApp embed/API        | Nao encontrado widget ou API ativa no codigo atual                                       | Informar terceiro, finalidade e categoria de consentimento se houver tracking |
| CDN externo de scripts    | Nao encontrado script externo alem de fontes e provedores de pagamento permitidos no CSP | Bloquear por padrao e liberar por categoria se nao essencial                  |

## Pontos de controle

- Nenhum script analitico/marketing deve ser importado diretamente no `head` ou em componentes de pagina.
- Tags nao essenciais devem ser carregadas exclusivamente via `ConsentScript`.
- Webhooks devem continuar usando assinatura ou token: ValidaPay usa `VALIDAPAY_WEBHOOK_SECRET` com o header `x-webhook-signature`; Stripe legado usa `STRIPE_WEBHOOK_SECRET`.
- Chaves secretas devem permanecer somente em variaveis de ambiente server-side na Vercel.
- A politica de cookies deve ser atualizada quando um novo terceiro passar a gravar cookie, pixel ou identificador.

## Referencias tecnicas

- Guia ANPD de cookies: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-cookies-e-protecao-de-dados-pessoais.pdf/view
- OWASP HTTP Security Headers: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
- OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- OWASP CSRF Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

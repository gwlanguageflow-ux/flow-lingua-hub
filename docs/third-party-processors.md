# Operadores e Terceiros - GWLanguageFlow

Versao: 2026.05.19  
Revisado em: 2026-05-19

Este documento lista terceiros identificados no codigo e na arquitetura da GWLanguageFlow. Ele deve ser revisado antes de ativar novas tags, pixels, ferramentas de suporte, e-mails transacionais ou provedores de pagamento.

## Terceiros ativos ou preparados

| Terceiro                      | Papel                                                           | Dados envolvidos                                                            | Base/finalidade                                    | Local no codigo                                                                         | Status de consentimento                                                    | Medida de protecao                                    |
| ----------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| Supabase                      | Auth, Postgres, Storage, Realtime                               | Conta, e-mail, perfis, CPF, turmas, materiais, mensagens, assinaturas, logs | Execucao de contrato, seguranca, cumprimento legal | `src/integrations/supabase/*`, migrations                                               | Necessario                                                                 | RLS, service role so no servidor, storage policies    |
| Vercel                        | Hospedagem, server functions, cron, DNS/app runtime             | IP, user-agent, logs tecnicos, requisicoes                                  | Disponibilizacao do SaaS e seguranca               | `vercel.json`, rotas API                                                                | Necessario                                                                 | Headers, endpoints internos protegidos por token/cron |
| Stripe                        | Checkout de cartao recorrente e webhooks                        | E-mail, customer, assinatura, status de pagamento; cartao fica no Stripe    | Execucao de contrato e pagamento                   | `src/functions/stripe-checkout.functions.ts`, `src/routes/api/public/stripe-webhook.ts` | Necessario para pagamento por cartao                                       | Webhook secret, checkout hospedado, sem cartao local  |
| Asaas                         | Transferencias Pix de saque, quando habilitado operacionalmente | Nome, CPF/Pix, valor, status de transferencia                               | Execucao de contrato e repasse                     | `src/server/asaas.server.ts`, funcoes de carteira                                       | Necessario somente para saque automatico via Pix                           | Webhook token, env vars na Vercel, idempotencia       |
| Google OAuth                  | Login social opcional                                           | Identificador Google, e-mail, nome, avatar quando usuario escolhe           | Autenticacao por opcao do usuario                  | `src/lib/auth-providers.ts`, `src/routes/auth.login.tsx`                                | Necessario apenas se usuario escolher Google                               | Redirect controlado, Supabase OAuth                   |
| Google Fonts                  | Fonte web Fraunces/Plus Jakarta Sans                            | Requisicao tecnica ao dominio de fontes                                     | Apresentacao visual                                | `src/routes/__root.tsx`                                                                 | Tratado como recurso de apresentacao; pode ser self-hosted em etapa futura | CSP restringe fonte e stylesheet                      |
| Google Meet ou links externos | Sala de aula quando professor/diretoria usa URL externa         | Acesso ao link externo e dados tratados pelo provedor                       | Execucao de aula                                   | `MeetingLinkEditor`, `bookings`, `class_groups`                                         | Depende do uso do link externo                                             | `noopener,noreferrer`; orientacao na politica         |

## Terceiros nao ativos no codigo atual

| Terceiro                  | Resultado da auditoria                                                               | Exigencia antes de ativar                                                     |
| ------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Google Analytics          | Nao encontrado carregamento de `gtag`, `analytics.js` ou tag manager no codigo atual | Usar `ConsentScript` com categoria `analytics`; atualizar politica e mapa     |
| Meta Pixel/Facebook Pixel | Nao encontrado script/pixel no codigo atual                                          | Usar `ConsentScript` com categoria `marketing`; atualizar politica e mapa     |
| WhatsApp embed/API        | Nao encontrado widget ou API ativa no codigo atual                                   | Informar terceiro, finalidade e categoria de consentimento se houver tracking |
| CDN externo de scripts    | Nao encontrado script externo alem de fontes e Stripe permitido no CSP               | Bloquear por padrao e liberar por categoria se nao essencial                  |

## Pontos de controle

- Nenhum script analitico/marketing deve ser importado diretamente no `head` ou em componentes de pagina.
- Tags nao essenciais devem ser carregadas exclusivamente via `ConsentScript`.
- Webhooks devem continuar usando assinatura ou token: Stripe usa `STRIPE_WEBHOOK_SECRET`; provedores de payout devem usar token/assinatura propria quando habilitados.
- Chaves secretas devem permanecer somente em variaveis de ambiente server-side na Vercel.
- A politica de cookies deve ser atualizada quando um novo terceiro passar a gravar cookie, pixel ou identificador.

## Referencias tecnicas

- Guia ANPD de cookies: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-cookies-e-protecao-de-dados-pessoais.pdf/view
- OWASP HTTP Security Headers: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
- OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- OWASP CSRF Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

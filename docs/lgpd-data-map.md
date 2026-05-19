# Mapa de Dados Pessoais - GWLanguageFlow

Versao: 2026.05.19  
Projeto: https://gwlanguageflow.com.br  
Base tecnica revisada em: 2026-05-19

Este documento mapeia os pontos reais de coleta, tratamento, armazenamento e transmissao identificados no codigo do projeto. Ele deve ser revisado sempre que forem adicionadas novas integracoes, formularios, pixels, turmas, meios de pagamento ou rotinas administrativas.

## Fontes normativas usadas como referencia

- LGPD - Lei 13.709/2018: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Marco Civil da Internet - Lei 12.965/2014: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm
- Codigo de Defesa do Consumidor - Lei 8.078/1990: https://www.planalto.gov.br/ccivil_03/Leis/L8078compilado.htm
- ECA Digital - Lei 15.211/2025: https://planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm
- Guia ANPD sobre cookies: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-cookies-e-protecao-de-dados-pessoais.pdf/view
- Perguntas frequentes ANPD: https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/perguntas-frequentes-anpd

## Inventario de tratamento

| Dado pessoal | Finalidade | Base legal tecnica indicada | Origem | Destino/armazenamento | Retencao | Terceiros | Risco | Medida de protecao |
|---|---|---|---|---|---|---|---|---|
| Nome completo | Identificar aluno, professor ou diretoria; exibir perfil; processar suporte e saques | Execucao de contrato; exercicio regular de direitos | Cadastro, perfil, saque Pix | `profiles.full_name`, `teacher_withdrawal_requests.account_holder_name`, `platform_withdrawal_requests.account_holder_name` | Conta ativa + ate 5 anos para registros financeiros | Supabase, Asaas quando saque | Exposicao indevida e IDOR | RLS, server functions, painel admin restrito, logs |
| E-mail | Login, comunicacao, recuperacao de conta, recibos e identificacao administrativa | Execucao de contrato; cumprimento legal; legitimo interesse | Supabase Auth, cadastro, Stripe/Asaas checkout | `auth.users`, `profiles.email`, Stripe Customer, Asaas Customer | Conta ativa + retencao minima financeira | Supabase, Stripe, Asaas, Google OAuth quando usado | Phishing, enumeracao, vazamento | Auth Supabase, server-side secrets, logs sem senha |
| CPF | Identificacao, recuperacao de senha, validacao de titularidade e Pix | Execucao de contrato; prevencao a fraude; obrigacao legal quando aplicavel | Cadastro/onboarding e Pix | `profiles.cpf`, payload Asaas quando necessario | Conta ativa + retencao financeira/legal quando aplicavel | Supabase, Asaas | Dado sensivel operacional por identificacao nacional | Restricao de coluna, service role, mascara em UI, RLS |
| Idade | Perfil de aluno/professor, adequacao de experiencia e politica de menores | Execucao de contrato; protecao do menor | Cadastro | `profiles.age` | Conta ativa; anonimizacao em pedido valido | Supabase | Tratamento de menor sem processo claro | Politica de menores, rotas LGPD, minimizacao |
| Avatar/foto | Personalizacao de perfil e feed | Execucao de contrato; consentimento operacional quando enviado pelo usuario | Upload do usuario | Supabase Storage `avatars`, `profiles.avatar_url` | Conta ativa ou exclusao a pedido | Supabase Storage/CDN | Exposicao publica indevida | Bucket separado, path por usuario, politicas de storage |
| Bio, experiencias, idiomas, niveis e precos do professor | Mostrar perfil profissional no feed e pagina do professor | Execucao de contrato; legitimo interesse comercial | Perfil do professor | `teacher_profiles`, `teacher_posts` | Conta ativa; anonimizacao a pedido | Supabase | Exposicao maior que o necessario | Campos editaveis, RLS, status `is_active` |
| Idioma desejado e nivel do aluno | Personalizar aulas, turmas e materiais | Execucao de contrato | Cadastro do aluno | `student_profiles` | Conta ativa; anonimizacao a pedido | Supabase | Perfilamento educacional indevido | Acesso proprio e diretoria autorizada |
| Agenda, links de aula, presenca e observacoes | Reservas, aulas, historico e suporte | Execucao de contrato | Agendamentos e painel | `bookings`, `teacher_meetings`, `class_groups` | Relacao ativa + ate 2 anos/5 anos conforme disputa | Supabase, Google Meet se link externo | Exposicao de link privado | RLS por participante, links externos com `noopener` |
| Mensagens aluno-professor e diretoria-usuario | Comunicacao pedagogica, suporte, alertas e historico | Execucao de contrato; legitimo interesse; exercicio regular de direitos | Chats e Diretoria | `teacher_student_messages`, `director_user_messages`, `director_messages`, `director_alerts` | Ate 2 anos apos encerramento, salvo necessidade legal | Supabase Realtime | Conteudo sensivel em texto livre | RLS por participante, admin restrito, anonimizacao |
| Denuncias anonimas | Receber relatos e tratar risco operacional | Legitimo interesse; protecao de direitos | Diretoria/receptivo | `anonymous_reports` | Ate conclusao + prazo de defesa | Supabase | Reidentificacao por conteudo livre | Sem autor identificado, acesso so dev |
| Materiais, tarefas e arquivos | Entrega pedagogica e acompanhamento de turmas | Execucao de contrato | Upload de professores/diretoria | `learning-materials`, `class_materials`, `class_assignments` | Vigencia da turma/assinatura + revisao | Supabase Storage | Upload indevido, arquivo com dado pessoal | Bucket privado, RLS, limite de MIME/tamanho |
| Assinatura, plano, status e periodos | Cobrar, liberar acesso, repassar valores | Execucao de contrato; CDC; obrigacao legal | Checkout e webhooks | `student_subscriptions`, `asaas_subscription_payments` | Ate 5 anos | Stripe, Asaas, Supabase | Inconsistencia financeira, duplicidade | Webhook assinado/token, idempotencia, wallet ledger |
| Dados de cartao | Processamento de pagamento por cartao | Execucao de contrato | Stripe Checkout | Stripe, nao armazenado no banco local | Conforme Stripe/lei aplicavel | Stripe | PCI e vazamento financeiro | Checkout hospedado Stripe, secret key em servidor |
| Dados Pix, Pix Automatico e saques | Pagamento, cobranca recorrente Pix e transferencias para professor/diretoria | Execucao de contrato; obrigacao legal; exercicio regular de direitos | Checkout Pix, saque | Asaas, `teacher_withdrawal_requests`, `platform_withdrawal_requests` | Ate 5 anos | Asaas | Fraude, erro de destino Pix | Server functions, token webhook, mascaramento, reversao de falhas |
| IP, user-agent e eventos de seguranca | Auditoria, prevencao a fraude, resposta a incidente e Marco Civil | Legitimo interesse; cumprimento legal; seguranca | Requisicoes a APIs e servidor | `security_events`, `user_sessions`, `audit_logs`, `consents` | Ate 2 anos para seguranca; ate 5 anos para auditoria | Vercel, Supabase | Rastreabilidade excessiva | Retencao definida, minimizacao, acesso dev |
| Cookies necessarios | Login, sessao, preferencias essenciais e seguranca | Execucao de contrato; legitimo interesse tecnico | Navegador | LocalStorage/Supabase Auth, cookie `sidebar_state` | Enquanto necessario ao uso | Supabase, navegador | Sessao roubada | SameSite/Secure em cookie proprio, Supabase Auth |
| Cookies analiticos, marketing, preferencias e terceiros | Medicao e campanhas futuras apenas se habilitadas | Consentimento | Banner de cookies | `consents`, localStorage | Ate revogacao + 5 anos para comprovacao | Nenhum ativo nesta versao; futuras tags condicionadas | Carga sem consentimento | Banner granular, `ConsentScript`, bloqueio antes de consentir |
| Solicitacoes LGPD | Atender direitos do titular | Cumprimento legal | Central de Privacidade | `privacy_requests`, `audit_logs` | Ate 5 anos apos encerramento | Supabase | Resposta fora do prazo ou sem historico | Protocolo, status, painel admin, logs |

## Fluxos de dados principais

1. Cadastro e login: usuario informa e-mail, senha e dados de perfil; Supabase Auth autentica; `profiles` e `user_roles` controlam acesso.
2. Perfil educacional: aluno/professor completa dados; banco usa RLS e funcoes para criar perfis.
3. Assinatura: aluno escolhe professor/plano; Stripe ou Asaas processa pagamento; webhook ativa assinatura e registra repasse/carteira.
4. Aula e materiais: agendamento, turma, materiais e mensagens sao visiveis apenas para participantes, professor e diretoria autorizada.
5. Diretoria: dev acessa painel, comunicados, alertas, denuncias, carteira da plataforma e painel LGPD.
6. Privacidade: banner registra consentimento; central permite acesso, pedidos e revogacao; painel admin responde e executa exportacao/anonimizacao.

## Medidas tecnicas implementadas nesta revisao

- Tabelas `consents`, `privacy_requests`, `policy_versions`, `audit_logs`, `user_sessions`, `security_events` e `data_retention_rules`.
- RLS e politicas de acesso para novas tabelas.
- Rotina `retention_cleanup_lgpd` e funcao `anonymize_profile_lgpd`.
- Banner de cookies granular com persistencia local e registro no Supabase.
- Central `/privacidade` e painel `/admin/lgpd`.
- Headers de seguranca e CSP na Vercel.
- Logs de login, logout, falha de login, consentimento, revogacao e administracao LGPD.

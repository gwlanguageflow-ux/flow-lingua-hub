import type { LucideIcon } from "lucide-react";
import { Cookie, FileText, LockKeyhole, Scale, ShieldCheck, UserRoundCheck } from "lucide-react";

export type LegalPageSlug =
  | "politica-de-privacidade"
  | "politica-de-cookies"
  | "termos-de-uso"
  | "politica-de-retencao"
  | "seguranca"
  | "menores";

export type LegalSection = {
  title: string;
  body: string[];
};

export type LegalPageContent = {
  slug: LegalPageSlug;
  title: string;
  version: string;
  updatedAt: string;
  summary: string;
  icon: LucideIcon;
  sections: LegalSection[];
};

export const legalPages: Record<LegalPageSlug, LegalPageContent> = {
  "politica-de-privacidade": {
    slug: "politica-de-privacidade",
    title: "Política de Privacidade",
    version: "2026.05.19",
    updatedAt: "19 de maio de 2026",
    icon: ShieldCheck,
    summary:
      "Explica quais dados a GWLanguageFlow trata, por qual motivo, com quem compartilha e como o titular pode exercer seus direitos.",
    sections: [
      {
        title: "Controladora e canais de contato",
        body: [
          "A GWLanguageFlow opera a plataforma educacional de idiomas, com cadastro de alunos, professores, diretoria, aulas, materiais, mensagens, assinaturas e repasses.",
          "Solicitações sobre dados pessoais podem ser abertas pela Central de Privacidade em /privacidade. O e-mail operacional indicado no projeto é gwlanguageflow@gmail.com.",
        ],
      },
      {
        title: "Dados tratados",
        body: [
          "Tratamos dados cadastrais, CPF quando necessário para identificação e recuperação de conta, e-mail, papéis de acesso, dados de perfil do professor ou aluno, agenda, mensagens, materiais, assinaturas, pagamentos, saques, logs técnicos, consentimentos e eventos de segurança.",
          "Dados de cartão e PIX são processados pela Stripe. A plataforma não deve armazenar número completo de cartão nem dados bancários sensíveis de pagamento.",
        ],
      },
      {
        title: "Finalidades e bases legais",
        body: [
          "Usamos dados para executar o contrato educacional, autenticar usuários, entregar aulas e materiais, processar cobranças, repassar valores, responder suporte, prevenir fraude, cumprir obrigações legais e respeitar escolhas de cookies.",
          "Quando houver cookies analíticos, marketing ou terceiros não essenciais, a base utilizada é o consentimento granular registrado no sistema.",
        ],
      },
      {
        title: "Compartilhamento",
        body: [
          "Compartilhamos dados com Supabase para autenticação, banco e armazenamento; Vercel para hospedagem; Stripe para pagamentos por cartão e PIX; provedores de payout somente quando houver saque; e Google somente quando o usuário escolhe login com Google ou usa links externos de reunião.",
          "Não há Meta Pixel ou Google Analytics carregados nesta versão. Caso sejam ativados, eles devem permanecer bloqueados até o consentimento correspondente.",
        ],
      },
      {
        title: "Direitos do titular",
        body: [
          "O titular pode solicitar acesso, confirmação de tratamento, correção, exportação, portabilidade, revogação de consentimento, oposição, anonimização e exclusão, observadas retenções legais e defesa de direitos.",
          "Cada solicitação recebe protocolo e fica disponível para acompanhamento pela Diretoria autorizada.",
        ],
      },
      {
        title: "Segurança e retenção",
        body: [
          "Aplicamos RLS no Supabase, funções protegidas, chaves sensíveis apenas no servidor, registros de auditoria, CSP, headers de segurança e validação de entradas nos novos fluxos de privacidade.",
          "Prazos e critérios técnicos estão descritos na Política de Retenção.",
        ],
      },
    ],
  },
  "politica-de-cookies": {
    slug: "politica-de-cookies",
    title: "Política de Cookies",
    version: "2026.05.19",
    updatedAt: "19 de maio de 2026",
    icon: Cookie,
    summary:
      "Define categorias, finalidade e controle de cookies e scripts externos da GWLanguageFlow.",
    sections: [
      {
        title: "Categorias",
        body: [
          "Necessários: mantêm login, sessão Supabase, segurança, checkout e preferências essenciais da interface. Não podem ser desligados pela plataforma sem quebrar o serviço.",
          "Analíticos, marketing, preferências e terceiros: só podem ser ativados após escolha positiva no banner ou na Central de Privacidade.",
        ],
      },
      {
        title: "Bloqueio antes do consentimento",
        body: [
          "O aplicativo não carrega Google Analytics, Meta Pixel ou tags de marketing nesta versão. O componente de consentimento bloqueia carregamento futuro por categoria antes da autorização.",
          "Ao rejeitar todos, somente recursos necessários continuam funcionando.",
        ],
      },
      {
        title: "Registro e revogação",
        body: [
          "A escolha é guardada localmente e registrada no banco com versão da política, data/hora, identificador do visitante, IP quando disponível e user-agent.",
          "O consentimento pode ser revogado pela Central de Privacidade ou pelo botão de preferências de cookies.",
        ],
      },
    ],
  },
  "termos-de-uso": {
    slug: "termos-de-uso",
    title: "Termos de Uso",
    version: "2026.05.19",
    updatedAt: "19 de maio de 2026",
    icon: Scale,
    summary:
      "Regras de acesso, conduta, assinaturas, aulas, materiais, pagamentos e responsabilidades da plataforma.",
    sections: [
      {
        title: "Uso da plataforma",
        body: [
          "A GWLanguageFlow conecta alunos, professores e diretoria para aulas de idiomas, materiais, agenda, mensagens e acompanhamento pedagógico.",
          "Cada usuário deve manter seus dados atualizados, proteger suas credenciais e usar as ferramentas de forma respeitosa e compatível com a finalidade educacional.",
        ],
      },
      {
        title: "Assinaturas e pagamentos",
        body: [
          "Planos podem ser pagos por cartão recorrente via Stripe ou por PIX manual via Stripe. No PIX, a renovação exige novo pagamento ao fim do período contratado.",
          "Confirmações, cancelamentos, inadimplência, repasses e taxas da plataforma são registrados em banco e processados por webhooks protegidos.",
        ],
      },
      {
        title: "Materiais e mensagens",
        body: [
          "Materiais, tarefas e mensagens devem ser usados no contexto pedagógico e podem permanecer registrados para continuidade das aulas, suporte e segurança.",
          "Conteúdos abusivos, ilícitos ou incompatíveis com o ambiente educacional podem gerar restrição de acesso e registro de evento de segurança.",
        ],
      },
      {
        title: "Limitações",
        body: [
          "A plataforma depende de serviços externos como Supabase, Vercel, Stripe e provedores de conexão. Instabilidades desses serviços podem afetar disponibilidade.",
          "Mudanças relevantes nas regras devem ser versionadas e apresentadas de forma clara aos usuários.",
        ],
      },
    ],
  },
  "politica-de-retencao": {
    slug: "politica-de-retencao",
    title: "Política de Retenção",
    version: "2026.05.19",
    updatedAt: "19 de maio de 2026",
    icon: FileText,
    summary:
      "Critérios técnicos para manter, revisar, anonimizar ou excluir dados pessoais e registros operacionais.",
    sections: [
      {
        title: "Regras principais",
        body: [
          "Dados cadastrais permanecem durante a conta ativa e podem ser anonimizados após solicitação válida, preservando registros mínimos necessários.",
          "Registros financeiros, assinaturas, repasses e cobranças são preservados por até 5 anos ou pelo prazo necessário à defesa de direitos e obrigações legais.",
        ],
      },
      {
        title: "Mensagens e materiais",
        body: [
          "Mensagens operacionais e registros pedagógicos podem ser mantidos por até 2 anos após encerramento da relação, salvo necessidade de suporte, segurança ou defesa de direitos.",
          "Materiais de aula entram em revisão após encerramento de turma ou assinatura e podem ser excluídos ou anonimizados quando não forem mais necessários.",
        ],
      },
      {
        title: "Rotina técnica",
        body: [
          "O banco possui regras em data_retention_rules e função retention_cleanup_lgpd para expurgo de logs antigos, consentimentos revogados e solicitações encerradas.",
          "A execução da rotina deve ser feita por endpoint interno protegido por CRON_SECRET ou por operador autorizado.",
        ],
      },
    ],
  },
  seguranca: {
    slug: "seguranca",
    title: "Segurança da Informação",
    version: "2026.05.19",
    updatedAt: "19 de maio de 2026",
    icon: LockKeyhole,
    summary:
      "Medidas técnicas de proteção aplicadas à autenticação, banco, APIs, pagamentos, logs e interface.",
    sections: [
      {
        title: "Controles técnicos",
        body: [
          "A plataforma usa Supabase Auth, Row Level Security, funções server-side para operações sensíveis, variáveis de ambiente na Vercel e chaves secretas apenas no servidor.",
          "Webhooks de pagamento validam assinatura ou token, e endpoints internos exigem autorização.",
        ],
      },
      {
        title: "Proteção da aplicação",
        body: [
          "Foram configurados headers de segurança, política CSP, referrer-policy, permissions-policy, bloqueio de framing e proteção de conteúdo.",
          "Novos formulários LGPD usam validação Zod e sanitização de texto antes de gravar dados.",
        ],
      },
      {
        title: "Auditoria",
        body: [
          "Eventos de login, logout, falhas, consentimento, revogação, solicitação LGPD, resposta administrativa, exportação, anonimização e acesso admin podem ser registrados em tabelas próprias.",
          "Logs não devem guardar senhas, dados completos de cartão ou segredos de API.",
        ],
      },
    ],
  },
  menores: {
    slug: "menores",
    title: "Política para Menores",
    version: "2026.05.19",
    updatedAt: "19 de maio de 2026",
    icon: UserRoundCheck,
    summary: "Orientações para cadastro, acompanhamento e proteção de usuários menores de idade.",
    sections: [
      {
        title: "Participação de menores",
        body: [
          "A plataforma pode atender alunos menores em contexto educacional. Nesses casos, o uso deve ocorrer com ciência e acompanhamento do responsável legal.",
          "Dados de menores devem ser tratados pelo mínimo necessário para matrícula, aulas, segurança e comunicação educacional.",
        ],
      },
      {
        title: "Responsável legal",
        body: [
          "Quando houver aluno menor, a GWLanguageFlow deve validar internamente o fluxo operacional de autorização do responsável e canais de contato.",
          "Solicitações de acesso, correção ou exclusão envolvendo menores devem ser avaliadas com prioridade e cuidado adicional.",
        ],
      },
      {
        title: "Proteção reforçada",
        body: [
          "Professores e diretoria devem usar mensagens e materiais apenas para finalidade pedagógica.",
          "Denúncias, alertas e eventos de segurança envolvendo menor devem ser registrados e tratados pela Diretoria autorizada.",
        ],
      },
    ],
  },
};

export const legalNavigation = Object.values(legalPages).map(({ slug, title }) => ({
  slug,
  title,
}));

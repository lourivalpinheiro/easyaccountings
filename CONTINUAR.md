# Onde paramos — Easy Accountings

> Para retomar numa nova sessão do Claude Code: abra o projeto e envie
> **"Leia o CONTINUAR.md e continue de onde paramos."**

Última atualização: 08/10/2026.

## Preparar o outro computador

1. `git clone https://github.com/lourivalpinheiro/easyaccountings.git` e `npm install`.
2. Crie o `.env.local` a partir do `.env.example`. **Ele não vai para o GitHub**: copie os valores do
   computador original ou da Vercel (Settings → Environment Variables). Nunca cole chaves no chat.
3. `npm run dev` → http://localhost:3000

## Estado atual

Pronto e no GitHub: autenticação com 2FA por e-mail, multiempresa (PF, PJ e informal), módulo contábil
completo (parâmetros, plano de contas, notas explicativas, orçamentos, lançamentos, 6 relatórios),
módulo financeiro (fluxo de caixa + relatório), paginação, layout mobile first, impressão de relatórios,
correções de segurança.

### Em andamento: publicação de empresas (código pronto, falta validar)

Empresas publicadas ganham um link secreto `/publico/<código>` com painel e relatórios, **somente
leitura e sem login**. Tornar privada invalida o link; publicar de novo gera outro.

- Banco: colunas `companies.public_token` e `published_at` (migração `drizzle/0004_publicacao.sql`, já aplicada).
- Relatórios extraídos para `src/reports/*.tsx`, usados pelas páginas internas e pelas públicas.
- Rotas públicas: `src/app/publico/[token]/` (layout, painel e 7 relatórios); liberadas no `src/proxy.ts`.
- Busca da empresa pelo código: `src/lib/public-company.ts`.
- Ações `publishCompany` / `unpublishCompany` em `src/app/(app)/admin/actions.ts` (só administradores).
- Botões publicar / copiar link / tornar privada em `src/app/(app)/admin/empresas/companies-client.tsx`.

Typecheck e lint passaram. **Falta:**
1. Testar o link público no navegador (painel, os 7 relatórios, link inválido → 404) e confirmar que
   telas internas sem login redirecionam para `/login`.
2. **Excluir a empresa de teste "ZZ Teste publicação (temporária)"** que ficou no banco
   (Administração → Empresas, ou `delete from companies where legal_name = 'ZZ Teste publicação (temporária)'`).
3. `npx next build`, commit e push.

## Produção (Vercel) — login quebrado

https://easyaccountings.vercel.app mostra "O servidor não está configurado corretamente" ao entrar.
Faltam variáveis de ambiente na Vercel. Ver em **Vercel → Logs** a linha
`[login] Variáveis de ambiente ausentes: ...` e cadastrar as que faltarem. Obrigatórias:
`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `AUTH_2FA_SECRET`, `SITE_URL`, `MAIL_FROM` e
`RESEND_API_KEY` **ou** `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS`. Depois, **Redeploy**.
No Supabase → Authentication → URL Configuration: Site URL de produção e `https://<domínio>/auth/callback`
nas Redirect URLs.

## Pendências de segurança

- Trocar as chaves expostas em conversas anteriores: senha do banco, secret key e JWT do Supabase
  (e atualizar `.env.local` e Vercel). Trocar também a senha da conta do GitHub, que foi exposta.
- Hoje todo usuário logado acessa todas as empresas; restringir por usuário se for necessário.

## Convenções do projeto

- Next.js 16 (middleware chama-se `src/proxy.ts`); docs da versão em `node_modules/next/dist/docs/`.
- Migrações: editar `src/db/schema.ts` → `npx drizzle-kit generate --name <nome>` → `npx drizzle-kit migrate`.
- Valores monetários em centavos inteiros (`src/lib/accounting.ts`).
- Server actions sempre via `companyAction` (exige login e empresa ativa) ou `requireAdmin`.
- Textos da interface em português; commits em português.

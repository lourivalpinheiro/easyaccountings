# Easy Accountings

Sistema contábil multiempresa: Next.js 16, Drizzle ORM, Supabase (Postgres + Auth), shadcn/ui (tema azul claro/escuro), Lucide e fonte Changa.

## Configuração

1. `npm install`
2. Copie `.env.example` para `.env.local` e preencha (banco, Supabase, `AUTH_2FA_SECRET`, SMTP).
3. Aplique o schema: `npm run db:migrate`
4. Crie o primeiro administrador (a senha é pedida no terminal):
   ```bash
   npm run create-admin -- "Nome Completo" email@dominio.com
   ```
5. `npm run dev` e acesse http://localhost:3000

## Autenticação

- Login por e-mail e senha; não há cadastro público — contas são criadas por administradores em **Administração > Usuários**.
- Segundo fator: código de 6 dígitos enviado por e-mail (SMTP). Sem `SMTP_HOST`, em desenvolvimento o código aparece no console do servidor.
- Recuperação de senha pelo Supabase Auth. Em **Supabase > Authentication > URL Configuration**, adicione `SITE_URL/auth/callback` às Redirect URLs.

## Módulo contábil

- **Parâmetros**: natureza e numeração inicial dos grupos, categorias de DRE, zeramento (com estorno) e históricos padrão.
- **Arquivo**: plano de contas (4 graus; só analíticas recebem lançamentos), notas explicativas com editor rico (exibidas no Balanço), orçamentos.
- **Movimento**: lançamentos nas fórmulas 1x1, 1xN, Nx1 e NxN, com totais e diferença.
- **Relatórios**: Balanço Patrimonial, Balancete de Verificação, Livro Diário, Livro Razão (várias contas), DRE e Orçado x Realizado — todos imprimíveis/PDF.

## Deploy (Vercel)

Configure as mesmas variáveis de ambiente do `.env.local` no projeto da Vercel, com `SITE_URL` apontando para o domínio de produção e SMTP obrigatório.

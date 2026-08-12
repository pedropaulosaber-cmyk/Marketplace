# AUTOMATIZE

Marketplace profissional de soluções de IA: criadores publicam agentes,
automações, workflows, templates e prompts; empresas compram soluções prontas,
publicam demandas e contratam especialistas.

Construído a partir do design do Canvas (artefatos desktop 1440px e mobile
390px), com a paleta, a tipografia e os componentes transcritos diretamente da
fonte.

---

## Stack e decisões

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) + React 19 | Server Components mantêm a lógica de negócio e as queries no servidor; o bundle do cliente fica em ~102 kB compartilhados. |
| Linguagem | TypeScript `strict` + `noUncheckedIndexedAccess` | Erros de tipo falham o build. `any` é erro de lint. |
| Estilo | Tailwind CSS v4 | Tokens do Canvas viram variáveis de tema em `globals.css`; nenhuma cor é inventada fora delas. |
| Banco | PostgreSQL + Prisma 6 | Schema relacional com FKs, índices compostos e *check constraints* aplicadas por migration. |
| Autenticação | Sessões opacas próprias | Ver [decisão abaixo](#por-que-sessões-próprias-e-não-jwt). |
| Senhas | Argon2id (`@node-rs/argon2`) | Recomendação atual da OWASP; parâmetros 19 MiB / t=2 / p=1. |
| Validação | Zod | Um único schema por operação, executado **sempre** no servidor. |
| Pagamentos | Stripe (PaymentIntents + webhooks) | Integração real, orientada a credenciais de ambiente. |
| Storage | S3-compatível + URLs assinadas | Entregáveis nunca são públicos. |
| Testes | Vitest (unit + integração) + Playwright (E2E) | 94 testes contra o banco real, 36 verificações E2E no navegador. |
| Logs | pino | JSON estruturado, com redação central de segredos. |

### Por que sessões próprias e não JWT

Um marketplace precisa de **revogação imediata**: banir uma conta, trocar a
senha após um vazamento ou aceitar uma proposta tem de valer no próximo
request, não quando um token expirar. JWT stateless não oferece isso sem uma
lista de revogação — que reintroduz o estado que o JWT prometia evitar.

O desenho aqui: token aleatório de 256 bits em cookie `HttpOnly` + `Secure` +
`SameSite=Lax` (prefixo `__Host-` em produção); o banco guarda apenas o
**HMAC-SHA256** do token. Um dump do banco não é replayável sem o
`SESSION_SECRET`.

---

## Como rodar

```bash
# 1. Dependências
pnpm install

# 2. Ambiente
cp .env.example .env
#    Gere o segredo de sessão:
openssl rand -base64 48        # cole em SESSION_SECRET

# 3. Banco
createdb automatize
pnpm db:deploy                 # aplica as migrations
pnpm db:seed                   # dados realistas de desenvolvimento

# 4. Desenvolvimento
pnpm dev                       # http://localhost:3000
```

### Contas do seed

| Papel | E-mail | Senha |
| --- | --- | --- |
| Admin | `admin@automatize.dev` | `automatize2026` |
| Criador / Profissional | `lucas@automatize.dev` | `automatize2026` |
| Comprador | `comprador1@automatize.dev` | `automatize2026` |

O seed cria 6 categorias, 8 criadores, 6 perfis profissionais, 12 produtos
publicados, pedidos pagos, avaliações, 3 demandas e 9 propostas.

### Scripts

```bash
pnpm dev            # servidor de desenvolvimento
pnpm build          # build de produção (falha em erro de tipo ou lint)
pnpm start          # servidor de produção
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm test           # vitest (unit + integração)
pnpm test:e2e       # playwright (exige build + start + seed)
pnpm verify         # typecheck + lint + test
pnpm db:migrate     # nova migration em desenvolvimento
pnpm db:studio      # inspeção do banco
```

---

## Arquitetura

```
src/
├── app/                        # rotas (App Router)
│   ├── (public)/               # landing, produtos, profissionais, demandas, vender
│   ├── (auth)/                 # login, cadastro — sem chrome do site
│   ├── (app)/                  # área logada: biblioteca, favoritos, pedidos, checkout
│   ├── dashboard/              # painel do criador / profissional
│   ├── admin/                  # painel administrativo
│   └── api/                    # webhooks, health check
├── components/                 # UI reutilizável (sem regra de negócio)
│   ├── ui/                     # primitivos do design system
│   ├── brand/                  # logo
│   ├── layout/                 # header, footer, tab bar, shells
│   ├── marketplace/            # cards, filtros, paginação
│   └── dashboard/              # KPIs, tabelas, gráfico
├── server/                     # tudo que nunca vai ao cliente (`server-only`)
│   ├── auth/                   # sessão, senha, RBAC
│   ├── security/               # rate limit, auditoria, cripto
│   ├── services/               # regras de negócio
│   ├── actions/                # Server Actions (delegam aos services)
│   ├── payments/               # provedor de pagamento
│   ├── storage/                # object storage + URLs assinadas
│   └── db/                     # cliente Prisma
└── lib/                        # utilidades puras (env, money, erros, validação)
```

**Regra de dependência:** `app` → `components` → `lib`, e `app` → `server` →
`lib`. Componentes de UI nunca importam services; services nunca importam
componentes. Nenhuma regra de negócio vive dentro de um componente.

Server Actions são casca fina: validam com Zod, chamam um service, normalizam o
erro. Isso mantém a mesma lógica acessível a route handlers, jobs e testes sem
duplicar as verificações de autorização.

---

## Segurança

O modelo de ameaça assumido: **todo dado vindo do cliente é hostil**.

### Autorização em duas camadas

Papel **e** propriedade são verificados separadamente:

```ts
const user = await requirePermission('product:update');   // 1. capacidade
assertOwnership(user, product.authorId, { ... });          // 2. o recurso é dele?
```

Ter o papel `CREATOR` não permite editar o produto de outro criador. Consultas
de recurso são escopadas por dono na cláusula `where`, então um id alheio
retorna "não encontrado" em vez de outro registro — a defesa contra IDOR.

Erros de autorização e de inexistência usam **a mesma mensagem**, para que a
resposta não sirva de oráculo de enumeração.

### O que nunca é aceito do cliente

| Nunca vem do cliente | De onde vem |
| --- | --- |
| Preço, total, comissão | Lido do catálogo dentro da transação do pedido |
| Confirmação de pagamento | Webhook com assinatura verificada |
| `authorId`, `buyerId`, `sellerId` | Sessão do servidor |
| Papel na criação de conta | Enum fechado de intenção → papel |
| Status de publicação | Somente moderação administrativa |
| Chave de storage | Nunca sai do servidor |

O schema de checkout aceita **apenas** `productId`. Um cliente que enviar
`priceCents` vê o campo descartado pelo Zod — há teste para isso.

### Pagamentos

Um pedido nasce `PENDING`. Só vira `PAID` no handler de webhook, e apenas
depois de três verificações:

1. **Assinatura** conferida contra o `STRIPE_WEBHOOK_SECRET` antes de o corpo
   ser interpretado.
2. **Idempotência** — o id do evento é gravado na *mesma transação* da
   liberação, então uma reentrega viola a constraint única e não faz nada.
3. **Valor** — o montante capturado é comparado ao total do pedido; divergência
   recusa a liberação e registra o evento na auditoria.

Sem credenciais configuradas, o checkout pago **falha explicitamente**. Ele
nunca simula um pagamento bem-sucedido — isso entregaria produtos de graça.

### Entrega de arquivos

Entregáveis ficam num bucket privado com chaves opacas (UUID). Todo download
passa por: autenticado → rate limit → **entitlement** (pedido `PAID` que contém
o produto) → registro em `download_logs` → URL assinada de minutos. A chave de
storage nunca aparece no HTML — há teste E2E verificando isso.

### Demais controles

- **Rate limiting** nomeado por ação (login 8/15min, checkout 10/min, …), com
  bloqueio progressivo de conta após 10 falhas — duas camadas, porque a
  primeira é por IP e a segunda sobrevive à rotação de IPs.
- **Auditoria** append-only de toda ação privilegiada ou financeira.
- **Uploads** validados por MIME e tamanho, com nome rejeitado (não
  higienizado) se contiver `/`, `..` ou caracteres de controle.
- **Headers**: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`.
- **CSRF**: Server Actions são POST com verificação de Origin pelo Next.js,
  somada a `SameSite=Lax`.
- **Constraints no banco** como última linha: nota entre 1 e 5, valores não
  negativos, `fee + seller = unit`, exatamente um alvo por favorito.

---

## Banco de dados

24 tabelas. Convenções:

- **Dinheiro em centavos inteiros.** Nunca ponto flutuante.
- **Snapshot em `order_items`** (nome e preço na hora da compra) — um produto
  renomeado ou reprecificado não reescreve o histórico.
- **Soft delete** onde há histórico financeiro: arquivar um produto preserva a
  linha, então a biblioteca de quem comprou continua funcionando.
- **Agregados desnormalizados** (`ratingSum`, `salesCount`) atualizados na mesma
  transação da escrita que os altera — listagens não precisam de agregação N+1.
- **Índices compostos** desenhados a partir das queries reais
  (`[status, publishedAt]`, `[authorId, status]`, `[status, salesCount]`), mais
  um índice GIN de full-text e um índice parcial para o catálogo público.

Papéis vivem em tabela de junção (`user_roles`), então uma conta pode acumular
papéis sem migration.

---

## Testes

```
94 testes  (Vitest, contra PostgreSQL real)
36 checks  (Playwright, navegador real)
```

Os testes de integração usam o banco de verdade e o código de autorização de
verdade — nada de mock de repositório. O que é stubado é só o contexto de
request do Next (`cookies()`, `headers()`), que não existe fora de um request.

Cobertura dos fluxos críticos:

- **Auth** — hash da senha, enumeração de contas, lockout, sessões revogadas
  por suspensão/expiração/troca de senha.
- **Autorização** — papel sem capacidade, propriedade de recurso, IDOR em
  pedidos, moderação por não-admin, propostas de rivais ocultas.
- **Checkout** — preço vindo do catálogo, comissão exata, recompra recusada,
  produto não publicado, checkout pago sem provedor.
- **Webhook** — liberação idempotente sob entrega repetida (contador de vendas
  e repasse permanecem em 1).
- **Downloads** — sem entitlement, sem sessão, chave de storage não vazada.
- **Avaliações** — só quem comprou, uma por comprador, agregado consistente.
- **Publicação** — rascunho por padrão, produto pago sem arquivo recusado,
  aprovação/rejeição com notificação e auditoria.
- **Demandas e propostas** — dono, duplicatas, visibilidade, aceite que recusa
  as demais.
- **Admin** — não pode se auto-suspender nem remover o último administrador.

Para rodar os E2E:

```bash
pnpm build && pnpm start &
BASE_URL=http://localhost:3000 pnpm test:e2e
```

> O E2E faz vários logins do mesmo IP. O limitador permite 8 a cada 15 minutos,
> então execuções repetidas em sequência começam a bloquear — é o controle
> funcionando, não uma falha. Reinicie o servidor para zerar o contador.

---

## Performance

- Server Components por padrão; `'use client'` só onde há interação real.
- Listagens filtram, ordenam e paginam **no Postgres**, com `select` restrito
  ao que o card renderiza.
- Páginas de produto são pré-renderizadas (`generateStaticParams` para os 50
  mais vendidos) e revalidadas a cada 10 minutos.
- Landing revalida a cada hora.
- Fonte Manrope self-hosted via `next/font` — sem request a terceiros, sem
  render-blocking.
- Gráfico de receita é SVG renderizado no servidor: zero biblioteca de chart no
  cliente.
- `Suspense` com skeletons que preservam o layout, evitando salto de conteúdo.

---

## Acessibilidade

- HTML semântico; elementos interativos são `<button>`/`<a>` reais.
- Skip link como primeiro foco tabulável.
- Foco visível único e consistente (2px, offset 2px).
- Campos com `<label for>`, erros ligados por `aria-describedby` +
  `aria-invalid` e anunciados com `role="alert"`.
- Alvos de toque ≥ 44px no mobile; inputs a 16px para não disparar zoom no iOS.
- Estrelas de avaliação são decorativas, com o valor em texto para leitores.
- O gráfico tem tabela equivalente em `sr-only`.
- `prefers-reduced-motion` desativa todas as animações.

---

## SEO

Metadata dinâmica por produto, profissional e demanda; Open Graph e Twitter
cards; canonical em todas as páginas públicas; `sitemap.xml` gerado do banco;
`robots.txt`; structured data `Product` (com `AggregateRating`) e `WebSite`.

Áreas privadas ficam fora do índice por **três** camadas independentes:
`robots.txt`, metadata `noindex` por página e header `X-Robots-Tag` — porque um
`robots.txt` sozinho é só um pedido.

---

## Integrações externas

Nada aqui é simulado. Quando uma credencial falta, a funcionalidade se declara
indisponível em vez de fingir que funcionou.

| Integração | Sem credenciais |
| --- | --- |
| Stripe | Checkout pago recusa a compra; webhook responde 503. Produtos gratuitos seguem funcionando. |
| S3 | Download responde "não configurado"; o resto do catálogo funciona. |
| Redis | Cai para o limitador em memória, com aviso no log. |

`/api/health` reporta o estado de cada dependência.

---

## Deploy

Requisitos: Node ≥ 20.11, PostgreSQL 14+, e as variáveis de `.env.example`.

```bash
pnpm install --frozen-lockfile
pnpm db:deploy
pnpm build
pnpm start
```

`src/lib/env.ts` valida a configuração no boot e **derruba o processo** se algo
estiver inválido — um deploy mal configurado falha na largada, em vez de
quebrar na primeira compra. Em produção ele também exige `https` e recusa um
`SESSION_SECRET` de placeholder.

---

## O que ficou preparado, mas não ativado

Estruturado no schema e no código, sem UI ainda:

- **Mensagens** — `Conversation`, `ConversationParticipant` e `Message`
  existem, com a participação como fronteira de autorização.
- **Notificações por e-mail e push** — as colunas `emailSentAt` / `pushSentAt`
  já existem; habilitar um canal não exige migration.
- **Stripe Connect** — `createPaymentIntent` aceita `sellerAccountId` e
  `application_fee_amount`; hoje o valor liquida na plataforma e o repasse é
  controlado pelo ledger `Payout` (D+15).
- **Serviços de profissionais** — modelo `Service` pronto, exibido no perfil.

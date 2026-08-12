# Segurança

Este documento descreve o que a plataforma protege, como protege, e — a parte
mais importante — **o que um recurso novo precisa fazer para herdar essa
proteção**. A maior parte das falhas em marketplaces não vem de um controle
mal escrito; vem de uma tela nova que esqueceu de aplicar um controle que já
existia. O objetivo aqui é que esquecer seja difícil.

## O que estamos protegendo

Em ordem de gravidade se vazar:

1. **Dinheiro** — pedidos, comissões, repasses. Um erro aqui é irreversível.
2. **Entregáveis pagos** — os arquivos que o comprador pagou para ter. Se
   vazam, o produto do criador perde valor.
3. **Credenciais e sessões** — acesso a contas de terceiros.
4. **Dados pessoais** — e-mail, histórico de compra, mensagens.

## Modelo de ameaça

Assumimos como realistas, e defendemos contra:

- Visitante anônimo tentando ler dados de outra conta (IDOR).
- Usuário legítimo tentando escalar privilégio ou pagar menos.
- Criador hostil publicando conteúdo malicioso (XSS armazenado).
- Afiliado tentando fraudar atribuição para receber comissão indevida.
- Roubo de sessão via XSS ou rede.
- Replay de webhook de pagamento para liberar produto ou pagar duas vezes.
- Automação em massa: força bruta, enumeração de contas, raspagem.

Assumimos **fora de escopo** neste estágio: atacante com acesso ao banco de
produção, comprometimento da infraestrutura da Vercel/Supabase, e ataque
físico. Esses exigem controles operacionais, não de código.

## Controles em vigor

### Borda — `src/middleware.ts`

Cabeçalhos aplicados em **toda** resposta, sem exceção por rota:

- **CSP com nonce por requisição.** Sem `'unsafe-inline'` e sem
  `'unsafe-eval'` em `script-src`. Esse é o controle que transforma um XSS
  armazenado em texto inofensivo. A política é gerada por requisição porque
  uma política estática obriga a usar `'unsafe-inline'`, e um CSP com
  `'unsafe-inline'` em scripts não é um CSP — é um cabeçalho decorativo.
- `frame-ancestors 'none'` + `X-Frame-Options: DENY` — sem clickjacking.
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
- `connect-src` restrito à própria origem e ao provedor de pagamento: um
  script injetado não tem para onde exfiltrar.
- HSTS com `preload` em produção (nunca em desenvolvimento, para não
  envenenar o `localhost` do navegador).
- `Permissions-Policy` negando câmera, microfone, geolocalização e afins.
- `Cross-Origin-Opener-Policy: same-origin`.

> O CSP **não** é definido em `next.config.ts`. Se estivesse nos dois lugares,
> o navegador aplicaria os dois por interseção e a política estática vetaria
> justamente os scripts que o nonce libera. Fonte única, no middleware.

Esses cabeçalhos são verificados por teste (`tests/security-headers.test.ts`).
Afrouxar a política exige editar um teste que falha — não acontece por
descuido.

### Identidade e sessão

- Senhas com **Argon2id**. Nunca texto puro, nunca codificação reversível.
- Sessões são **tokens opacos aleatórios**; o banco guarda só o *fingerprint*
  HMAC. Um vazamento do banco não permite replay de sessão.
- Cookie `__Host-` em produção: `HttpOnly`, `Secure`, `SameSite=Lax`,
  `Path=/`, sem `Domain`. O prefixo é imposto pelo navegador e impede que um
  subdomínio grave sessão para o domínio principal.
- Revogação imediata: banir ou suspender uma conta vale na próxima
  requisição, não quando o token expirar. É o motivo de a sessão ser
  *stateful* em vez de JWT.
- Expiração deslizante com escrita limitada, para não gravar a cada request.
- Bloqueio de conta após falhas repetidas, **combinado** com limite por IP —
  um sozinho é contornável por rotação.

### Autorização

Duas camadas, e a de cima é só conveniência:

1. A navegação esconde o que a pessoa não pode acessar.
2. **Toda** página e ação verifica permissão por conta própria.

Regra prática: se a UI é a única coisa impedindo o acesso, não há controle
nenhum. Propriedade é sempre verificada contra o banco — o `id` que chega do
formulário nunca é evidência de posse.

### Dinheiro

- Preço é lido do catálogo **dentro** da transação do pedido. O cliente envia
  um id de produto e nada mais — nunca um valor.
- Um pedido só vira `PAID` a partir de webhook com assinatura verificada,
  nunca de um retorno do navegador.
- Idempotência de webhook por `(provider, eventId)` gravado na mesma
  transação: replay vira no-op em vez de liberar produto ou pagar duas vezes.
- Valores em centavos inteiros. Nunca ponto flutuante em ledger.
- Restrição no banco garante que taxa + parte do vendedor + comissão do
  afiliado nunca excedam o que o comprador pagou.

### Conteúdo de terceiros

- Markdown de criador é renderizado **em elementos React**, nunca via
  `dangerouslySetInnerHTML`. Não há sanitizador em que confiar: uma tag
  `<script>` injetada é texto.
- Links de criador aceitam só `https:` e relativos; `javascript:`, `data:` e
  protocol-relative caem para texto puro. Todos levam `rel="nofollow ugc
  noopener noreferrer"`.
- Embeds de vídeo têm allowlist de host e só carregam após clique explícito.

### Entregáveis

- Arquivos pagos ficam em bucket privado. A chave nunca chega ao cliente.
- O download sai por URL assinada de vida curta, emitida **depois** da
  verificação de direito de acesso.
- Cada emissão é registrada, o que também alimenta detecção de abuso.

### Afiliados

- Códigos são **gerados**, nunca escolhidos: código escolhido convida
  impersonação e enumeração do programa alheio.
- Auto-referência e compra pelo próprio link são recusadas.
- A janela de atribuição é validada no servidor contra a configuração atual do
  programa, não contra o que o cookie afirma.
- O cookie de referência é `HttpOnly` e é tratado como entrada hostil:
  qualquer valor malformado resulta em venda sem atribuição, nunca em erro.

### Auditoria

`AuditLog` é *append-only* e registra toda ação privilegiada ou que muda
estado, com ator, entidade e contexto. O código da aplicação nunca atualiza
nem apaga essas linhas.

### Observabilidade

Redação de segredos é **central**, no logger. Um ponto de log que precisa
lembrar de remover uma senha é um ponto de log que uma hora vai esquecer.

## Checklist para todo recurso novo

Antes de abrir PR de qualquer tela, ação ou rota nova:

- [ ] A ação verifica **permissão** e **propriedade** no servidor — não só na UI.
- [ ] Toda entrada passa por Zod antes de chegar ao banco.
- [ ] Nenhum valor monetário vem do cliente.
- [ ] Nenhum `id` do cliente é tratado como prova de posse.
- [ ] Conteúdo de usuário não vira HTML bruto.
- [ ] A operação é idempotente se puder ser reexecutada (webhook, retry).
- [ ] Mutação com efeito externo ou financeiro passa por transação.
- [ ] Ação sensível gera `AuditLog`.
- [ ] Endpoint que pode ser martelado tem rate limit.
- [ ] Erro não revela se um e-mail existe, se um recurso existe, ou por que
      exatamente falhou.
- [ ] Se precisou de host externo novo, o CSP foi ajustado **explicitamente** —
      e o teste de cabeçalhos foi atualizado junto.
- [ ] Se precisou de segredo novo, ele entrou na redação do logger.

## Pendências conhecidas

Registradas por honestidade, não como conquistas:

- **RLS no Supabase está desabilitado.** Hoje o acesso é sempre pela
  aplicação, que impõe autorização — mas RLS seria a rede de proteção caso uma
  chave vazasse. Deve ser ligado antes de qualquer acesso direto ao banco a
  partir do cliente.
- **2FA ainda não existe.** O schema já suporta revogação total de sessões,
  que é a peça que falta ser exercitada por um segundo fator.
- **Sem varredura automática de dependência e segredo em CI.**
- **Rate limit em memória** por padrão: só funciona por instância. Com mais de
  uma instância, precisa do driver compartilhado.

## Reportando uma vulnerabilidade

Envie para **security@automatize.com.br** com passos de reprodução. Não abra
issue pública. Respondemos em até 72 horas.

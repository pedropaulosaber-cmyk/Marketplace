# Estratégia de crescimento

Este documento registra a ideia por trás do produto e aponta onde ela está
implementada. Serve para que decisão de produto futura seja coerente com a
aposta, em vez de acumular funcionalidade solta.

## O problema real

Todo marketplace começa vazio dos dois lados. Comprador não vem porque não há
produto; criador não publica porque não há comprador. Quem tenta resolver isso
comprando tráfego paga caro e para de crescer quando para de pagar.

A saída é escolher **um lado para ser o motor**. Aqui o motor é o **criador**,
por um motivo específico do nosso mercado: quem constrói automação e agente de
IA no Brasil normalmente já tem audiência — comunidade, lista, canal, clientes
de consultoria. Ele não precisa de tráfego nosso. Precisa de infraestrutura
que hoje não tem: pagamento, entrega, licença, suporte, nota, reembolso.

**A aposta:** se a plataforma for claramente o melhor lugar para *vender*,
os criadores trazem os compradores. O comprador chega atrás de um produto
específico e descobre o catálogo. O catálogo retém.

## Por que um criador escolheria a Automatize

Cada item abaixo é uma objeção real, e cada um tem código correspondente.

### "Quanto sobra pra mim?"

15% sobre a venda, sem mensalidade, sem taxa de listagem. E a conta fica
visível antes do cadastro, com o preço que a pessoa mesmo digitou.

→ `src/app/(public)/sell/_components/earnings-calculator.tsx`

A calculadora mostra a taxa como dedução explícita, não escondida no rodapé.
Mostrar o desconto aumenta conversão porque remove a suspeita de pegadinha —
o criador experiente assume que existe uma taxa oculta até provarem o
contrário.

### "Como eu vendo mais sem gastar com anúncio?"

Programa de afiliados por produto. O criador define a comissão, e paga **só
quando vende**. Sem venda, custo zero.

→ `src/server/services/affiliate-service.ts`, `/dashboard/affiliate/programs`

Isso é o laço de crescimento principal:

```
criador abre programa
   → afiliado divulga para a audiência dele
      → compradores novos chegam à plataforma
         → alguns viram criadores ou afiliados
            → mais divulgação
```

Cada afiliado é um canal de aquisição que a plataforma não paga para manter.
A comissão sai da parte do vendedor, nunca da nossa taxa — então a plataforma
não tem incentivo para empurrar comissão alta, e o criador confia na conta.

### "E se o comprador pedir reembolso?"

A plataforma cobra a disputa e segura o repasse por 15 dias, dentro da janela
de 14 dias de reembolso. O criador não lida com chargeback.

→ `settleOrderEffects` em `src/server/services/order-service.ts`

### "Meu produto vai vazar?"

Arquivo em bucket privado, URL assinada de vida curta emitida só depois de
verificar direito de acesso, e log de cada download.

→ `src/server/services/download-service.ts`, `SECURITY.md`

## Por que um comprador confiaria

O risco do comprador não é preço — é comprar algo que não funciona. Todo
elemento de confiança existe para reduzir isso:

- **Avaliação só de quem comprou.** Não existe review sem pedido pago
  associado. É restrição de schema, não regra de moderação.
- **Criador verificado** por documento e histórico, com selo visível.
- **Reembolso em 14 dias**, declarado na página do produto.
- **Vídeo e galeria** mostrando o produto rodando antes da compra.
- **Contagem de vendas e nota** visíveis no card.

O contraste com vender curso em grupo de WhatsApp é o argumento inteiro.

## O segundo laço: demanda

Quando o comprador não acha o que precisa, ele **publica uma demanda** em vez
de sair do site. Profissionais respondem com proposta.

→ `/demands`, `src/server/services/demand-service.ts`

Isso faz três coisas: recupera intenção que viraria abandono, dá trabalho a
profissional sem catálogo próprio, e revela quais produtos faltam — a lista de
demandas abertas é uma pesquisa de mercado contínua e de graça.

## Sequência sugerida

1. **Recrutar 20–50 criadores à mão.** Sem catálogo não há marketplace. A
   calculadora e a página `/sell` são a ferramenta de venda dessa conversa.
2. **Ligar afiliados** com os criadores que já têm audiência.
3. **Deixar SEO trabalhar.** Cada produto e cada perfil já é uma página
   indexável com dado estruturado.
4. **Só então considerar mídia paga**, com número real de conversão em mãos.

Comprar tráfego antes do passo 1 é queimar dinheiro em cima de um catálogo
vazio.

## O que medir

Poucas métricas, e nenhuma de vaidade:

| Métrica | Por quê |
| --- | --- |
| Criadores com ≥1 produto publicado | Saúde do lado da oferta |
| Tempo do cadastro à primeira publicação | Onde o onboarding trava |
| % de vendas via afiliado | O laço está funcionando? |
| Repeat rate do comprador | O catálogo retém ou é compra única? |
| Demandas com ≥1 proposta | O segundo laço fecha? |
| Taxa de reembolso por criador | Qualidade antes de virar reputação ruim |

Visita e cadastro não entram: sobem com qualquer campanha e não dizem se o
negócio funciona.

## Escala

O gargalo de um marketplace assim é leitura de catálogo, não escrita. O que já
está no lugar:

- **Agregados desnormalizados** (`ratingSum`, `salesCount`, `proposalCount`)
  mantidos na mesma transação da escrita. Listagem nunca faz `COUNT`/`AVG` por
  linha.
- **Índices compostos** desenhados para as consultas reais — catálogo público,
  painel do criador, fila de moderação.
- **Contadores em vez de log de evento** para clique de afiliado. Clique é o
  evento de maior cardinalidade da plataforma; uma linha por clique dominaria
  o banco antes de pagar pelo que custa.
- **Paginação obrigatória** em toda listagem.
- **Renderização dinâmica com Suspense** por seção, então uma consulta lenta
  degrada um bloco em vez da página.

O que precisa mudar antes de escalar de verdade, e está registrado em
`SECURITY.md`: rate limit em memória só funciona por instância, e RLS no
Supabase está desligado.

## O que deliberadamente não fazemos

- **Assinatura da plataforma.** Cobrar do criador antes de ele vender inverte
  o incentivo e mata o lado da oferta no começo.
- **Exclusividade.** Exigir que o criador venda só aqui afasta exatamente quem
  já tem audiência — o público que queremos.
- **Ranking pago.** Destaque comprado destrói a confiança do comprador na
  ordenação, que é o ativo mais difícil de reconstruir.

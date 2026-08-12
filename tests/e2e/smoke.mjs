/**
 * End-to-end smoke test.
 *
 * Drives a real browser against a running build to verify the flows that the
 * unit and integration suites cannot: route protection as a user experiences
 * it, form submission, client navigation and responsive layout.
 *
 * Prerequisites:
 *   pnpm db:seed && pnpm build && pnpm start
 *   node tests/e2e/smoke.mjs            (BASE_URL defaults to :3000)
 *
 * Note on rate limiting: this script signs in several times from one address.
 * The login limiter allows 8 attempts per 15 minutes per IP, so running it
 * repeatedly in quick succession will legitimately start blocking logins —
 * that is the control working, not a failure of the app. Restart the server to
 * clear the in-memory counter.
 */

import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const PASSWORD = process.env.E2E_PASSWORD ?? 'automatize2026';

/**
 * The sandboxed CI image ships a Chromium that may not match the version
 * @playwright/test expects. Honour an explicit path when one is provided.
 */
const executablePath = process.env.CHROMIUM_PATH;

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  return page
    .waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25_000 })
    .then(() => true)
    .catch(() => false);
}

const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ['--no-sandbox'],
});

try {
  // --- Route protection ---------------------------------------------------
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    for (const path of [
      '/dashboard',
      '/admin',
      '/library',
      '/favorites',
      '/orders',
    ]) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      const landed = new URL(page.url()).pathname;
      check(`guest on ${path} is sent to /login`, landed.startsWith('/login'), landed);
    }

    await ctx.close();
  }

  // --- Buyer: browse and purchase ----------------------------------------
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    if (!(await login(page, 'comprador1@automatize.dev'))) {
      check('buyer can sign in', false, 'login blocked — rate limited?');
    } else {
      check('buyer can sign in', true);

      await page.goto(`${BASE}/products`, { waitUntil: 'networkidle' });
      const cards = await page.locator('article').count();
      check('catalog renders products', cards > 0, `${cards} cards`);

      await page.goto(`${BASE}/products?price=free`, { waitUntil: 'networkidle' });
      check(
        'price filter applies',
        (await page.locator('body').innerText()).includes('Grátis')
      );

      await page.goto(`${BASE}/products/meeting-notes-automation`, {
        waitUntil: 'networkidle',
      });

      const buy = page.getByRole('button', { name: /Instalar grátis|Comprar agora/ });

      if ((await buy.count()) > 0) {
        await buy.first().click();
        await page.waitForURL(/\/library/, { timeout: 25_000 }).catch(() => {});
        check('free purchase completes', page.url().includes('/library'), page.url());
      }

      // Whether just bought or owned from a previous run, the product must now
      // be in the library and the purchase CTA must be gone.
      await page.goto(`${BASE}/library`, { waitUntil: 'networkidle' });
      await page
        .getByText('Meeting Notes Automation')
        .first()
        .waitFor({ timeout: 15_000 })
        .catch(() => {});

      const library = await page.locator('body').innerText();
      check(
        'purchased product appears in the library',
        library.includes('Meeting Notes Automation')
      );
      check('library offers a download', library.includes('Baixar'));
      check(
        'library HTML never contains a private storage key',
        !(await page.content()).includes('product-file/')
      );

      await page.goto(`${BASE}/products/meeting-notes-automation`, {
        waitUntil: 'networkidle',
      });
      check(
        'owned product no longer offers purchase',
        (await page.locator('body').innerText()).includes('Acessar na biblioteca')
      );

      await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
      check(
        'buyer cannot reach /admin',
        !new URL(page.url()).pathname.startsWith('/admin'),
        new URL(page.url()).pathname
      );
    }

    await ctx.close();
  }

  // --- Creator: publishing ------------------------------------------------
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    if (await login(page, 'lucas@automatize.dev')) {
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
      check(
        'creator sees dashboard KPIs',
        (await page.locator('body').innerText()).includes('Receita')
      );

      await page.goto(`${BASE}/dashboard/products/new`, { waitUntil: 'networkidle' });

      const name = `Produto E2E ${Date.now()}`;
      await page.fill('input[name="name"]', name);
      await page.fill(
        'input[name="tagline"]',
        'Automatiza a triagem de mensagens do time de suporte.'
      );
      await page.selectOption('select[name="categoryId"]', { index: 1 });
      await page.fill('input[name="price"]', '199,00');
      await page.fill(
        'textarea[name="descriptionMd"]',
        'Descrição completa e suficientemente longa para satisfazer a validação do servidor neste teste automatizado.'
      );
      await page.click('button[type="submit"]');
      await page
        .waitForURL(/\/dashboard\/products$/, { timeout: 25_000 })
        .catch(() => {});

      // The list is a streamed Server Component; wait for the row itself
      // rather than reading the document before it has landed.
      const row = page.getByRole('row', { name: new RegExp(name) });
      const appeared = await row
        .first()
        .waitFor({ timeout: 20_000 })
        .then(() => true)
        .catch(() => false);

      check('product publishing flow creates the product', appeared, name);

      if (appeared) {
        check(
          'new product starts as a draft, never auto-published',
          (await row.first().innerText()).includes('Rascunho')
        );
      }
    } else {
      check('creator can sign in', false, 'login blocked — rate limited?');
    }

    await ctx.close();
  }

  // --- Buyer publishes a demand -------------------------------------------
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    if (await login(page, 'comprador2@automatize.dev')) {
      await page.goto(`${BASE}/demands/new`, { waitUntil: 'networkidle' });

      const title = `Demanda E2E ${Date.now()}`;
      await page.fill('input[name="title"]', title);
      await page.selectOption('select[name="category"]', { index: 1 });
      await page.fill(
        'textarea[name="problem"]',
        'O time perde horas por semana copiando dados entre sistemas manualmente.'
      );
      await page.fill(
        'textarea[name="goal"]',
        'Eliminar a digitação manual e reduzir o retrabalho pela metade.'
      );
      await page.fill(
        'textarea[name="details"]',
        'Temos três sistemas que não conversam e uma planilha intermediária que ninguém revisa.'
      );
      await page.fill('input[name="budgetMin"]', '5.000');
      await page.fill('input[name="budgetMax"]', '15.000');
      await page.fill('input[name="deadlineWeeks"]', '8');
      await page.click('button[type="submit"]');

      // The form navigates to the created demand — anything still on /new
      // means the submission did not land.
      const navigated = await page
        .waitForURL(
          (u) => /^\/demands\/.+/.test(u.pathname) && !u.pathname.endsWith('/new'),
          { timeout: 25_000 }
        )
        .then(() => true)
        .catch(() => false);

      check('demand publishing flow completes', navigated, page.url());

      if (navigated) {
        check(
          'created demand renders its own title',
          (await page.locator('body').innerText()).includes(title)
        );
      }
    } else {
      check('buyer can sign in to publish a demand', false, 'login blocked');
    }

    await ctx.close();
  }

  // --- Admin --------------------------------------------------------------
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    if (await login(page, 'admin@automatize.dev')) {
      for (const [path, marker, label] of [
        ['/admin', 'Visão geral da plataforma', 'admin overview'],
        ['/admin/users', '@automatize.dev', 'admin users'],
        ['/admin/audit', 'user.login', 'audit log'],
        ['/admin/transactions', 'Volume bruto', 'transactions'],
        ['/admin/moderation', 'Moderação de produtos', 'moderation queue'],
      ]) {
        await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
        check(
          `${label} loads`,
          (await page.locator('body').innerText()).includes(marker)
        );
      }
    } else {
      check('admin can sign in', false, 'login blocked — rate limited?');
    }

    await ctx.close();
  }

  // --- Responsive ---------------------------------------------------------
  {
    for (const [label, viewport] of [
      ['mobile 390', { width: 390, height: 844 }],
      ['tablet 768', { width: 768, height: 1024 }],
      ['desktop 1440', { width: 1440, height: 900 }],
    ]) {
      const ctx = await browser.newContext({ viewport });
      const page = await ctx.newPage();

      for (const path of ['/', '/products', '/professionals', '/demands']) {
        await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
        const overflows = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1
        );
        check(`${path} has no horizontal overflow at ${label}`, !overflows);
      }

      if (viewport.width === 390) {
        check(
          'mobile tab bar is visible at 390px',
          await page.locator('nav[aria-label="Navegação principal"]').isVisible()
        );
      }

      await ctx.close();
    }
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);

if (failed.length > 0) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name}`);
  process.exitCode = 1;
}

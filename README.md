This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Growth Hub - tareas programadas

El plan gratuito (Hobby) de Vercel solo permite **2 tareas programadas**, y ambas deben ser **diarias**. Por eso:

- En `vercel.json` solo queda activo el cron diario:
  - `POST /api/auth/refresh-tokens` → `0 6 * * *`

- Las frecuencias que el negocio requieren (`*/5` publicación, `0 * * * *` campañas) se ejecutan desde **Supabase** mediante la extensión `pg_cron` + `pg_net`, a través de los endpoints del Growth Hub:

  - `/api/publish/cron` → `*/5 * * * *`
  - `/api/campaigns/sync` → `0 * * * *`

  Migración: `supabase/migrations/20261105_growth_hub_cron.sql`

- Para habilitarlas en Supabase:
  1. `create extension pg_cron;`
  2. `create extension pg_net;`
  3. Ejecutar la migración `20261105_growth_hub_cron.sql`.
  4. Configurar el secreto (mismo valor que `CRON_SECRET` en Vercel):
     ```sql
     select public.growth_hub_configure('TU_CRON_SECRET');
     -- Opcional, si el app está en otro dominio:
     -- select public.growth_hub_configure('TU_CRON_SECRET', 'https://tu-dominio.com');
     ```
  5. Verificar:
     ```sql
     select jobname, schedule, active from cron.job;
     ```

> Si se sube a un plan de pago en Vercel, basta con restaurar en `vercel.json` los crons frecuentes (`*/5` y `0 * * * *`) y las rutas `CRON_SECRET`-protegidas.

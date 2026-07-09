# Subscription Packages, Cancellation, Agenda, and Director Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add prepaid semiannual and annual packages, period-end cancellation, organized lesson history, director-to-teacher base materials, and the requested home-page plan ordering.

**Architecture:** Keep the existing plan rows as monthly base products and store the selected billing package on each subscription and checkout. Perform pricing and cancellation authorization in server functions, preserve existing subscriptions through defaults, and reuse `class_materials` for individually traceable director materials.

**Tech Stack:** React 19, TanStack Start/Router, TypeScript, Supabase/Postgres/RLS, ValidaPay, Tailwind CSS.

---

### Task 1: Package schema and pricing model

**Files:**
- Create: `supabase/migrations/<timestamp>_subscription_packages_and_cancellation.sql`
- Create: `src/lib/subscription-packages.ts`
- Modify: `src/integrations/supabase/types.ts`

- [ ] **Step 1: Create the migration with Supabase CLI**

Run:

```powershell
supabase migration new subscription_packages_and_cancellation
```

Expected: one timestamped SQL file under `supabase/migrations`.

- [ ] **Step 2: Add package fields and cancellation audit fields**

Add a `subscription_package` enum with `mensal`, `semestral`, and `anual`. Add
`package_type`, `package_months`, `package_discount_rate`, `package_base_amount`,
`package_total_amount`, `cancel_requested_at`, `cancel_requested_by`, and `cancel_reason` to
`student_subscriptions`, using defaults that preserve existing monthly subscriptions.

- [ ] **Step 3: Add the shared server-safe calculator**

Implement:

```ts
export const SUBSCRIPTION_PACKAGES = {
  mensal: { months: 1, discountRate: 0 },
  semestral: { months: 6, discountRate: 0.05 },
  anual: { months: 12, discountRate: 0.1 },
} as const;

export function calculateSubscriptionPackage(baseMonthlyPrice: number, packageType: PackageType) {
  const config = SUBSCRIPTION_PACKAGES[packageType];
  const baseAmount = roundMoney(baseMonthlyPrice * config.months);
  const totalAmount = roundMoney(baseAmount * (1 - config.discountRate));
  return { ...config, baseAmount, totalAmount };
}
```

- [ ] **Step 4: Regenerate or update generated Supabase types**

Ensure the new enum and columns exist in `Database["public"]`.

- [ ] **Step 5: Verify migration and types**

Run:

```powershell
npm.cmd run typecheck
```

Expected: exit code 0.

### Task 2: Checkout packages and payment periods

**Files:**
- Modify: `src/functions/validapay-checkout.functions.ts`
- Modify: `src/server/validapay.server.ts`
- Modify: `src/server/subscription-activation.server.ts`
- Modify: `src/routes/api/public/validapay-webhook.ts`
- Modify: `src/routes/planos.tsx`
- Modify: `src/routes/minha-assinatura.tsx`

- [ ] **Step 1: Accept package type in checkout input**

Extend the checkout validator with:

```ts
packageType: z.enum(["mensal", "semestral", "anual"]).default("mensal")
```

- [ ] **Step 2: Calculate all amounts on the server**

Load the base plan/custom plan price and call `calculateSubscriptionPackage`. Persist all package
fields on the pending subscription. Never accept a total supplied by the browser.

- [ ] **Step 3: Configure provider behavior**

Monthly uses the existing recurring checkout. Semiannual and annual use a one-time checkout for the
calculated total while retaining card and Pix payment methods.

- [ ] **Step 4: Activate the correct access period**

Use `package_months` when calculating `current_period_end`. Webhook retries must be idempotent by
subscription/payment reference.

- [ ] **Step 5: Add the package selector to checkout UI**

Add a three-option segmented control showing:

```text
Mensal — preço mensal
Semestral — 5% OFF — total de 6 meses
Anual — 10% OFF — total de 12 meses
```

Show base total, package discount, coupon discount, and final total before checkout.

- [ ] **Step 6: Show package details in Meu Plano**

Display package, total paid, access end date, and renewal behavior.

- [ ] **Step 7: Validate**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

Expected: both exit code 0.

### Task 3: Period-end cancellation

**Files:**
- Create: `src/functions/subscription-cancellation.functions.ts`
- Modify: `src/routes/minha-assinatura.tsx`
- Modify: `src/routes/admin.tsx`
- Modify: `src/functions/admin.functions.ts`
- Modify: `src/server/validapay.server.ts`

- [ ] **Step 1: Implement student cancellation**

Create a server function that verifies `subscription.student_id === context.userId`, requires an
active/non-expired subscription, sets `cancel_at_period_end = true`, records audit fields, and
cancels provider recurrence only for monthly recurring subscriptions.

- [ ] **Step 2: Implement director cancellation**

Create an admin-only server function with the same state transition, accepting a required
administrative reason.

- [ ] **Step 3: Add confirmation dialogs**

Both interfaces must clearly state:

```text
O acesso continuará até DD/MM/AAAA. Não haverá nova renovação nem reembolso automático.
```

- [ ] **Step 4: Keep access active**

Do not change status to `cancelada` until `current_period_end`. Existing access checks continue to
use active status plus period end.

- [ ] **Step 5: Validate authorization**

Verify that a student cannot cancel another student's subscription and that non-directors cannot
use the administrative endpoint.

### Task 4: Agenda organization and lesson history

**Files:**
- Create: `src/components/LessonHistory.tsx`
- Modify: `src/routes/dashboard.tsx`
- Modify: `src/routes/meus-agendamentos.tsx`

- [ ] **Step 1: Add reusable status grouping**

Group bookings into upcoming, awaiting confirmation, completed, and cancelled without removing
historical records.

- [ ] **Step 2: Add professor views**

Show compact tabs/counters and chronological history with student, date, duration, meeting link,
and status.

- [ ] **Step 3: Add student views**

Show the same organization with professor information and retain confirmation/review actions where
valid.

- [ ] **Step 4: Verify historical behavior**

Confirm completed and cancelled lessons remain visible after refresh and realtime updates.

### Task 5: Director base materials for teachers

**Files:**
- Modify: `src/routes/admin.tsx`
- Modify: `src/functions/admin.functions.ts`
- Modify: `src/routes/dashboard.tsx`
- Modify: `src/routes/api/private/learning-upload.ts`

- [ ] **Step 1: Add recipient mode**

Add `Um professor` and `Todos os professores` options. Individual mode requires one active teacher.

- [ ] **Step 2: Create traceable material rows**

For every recipient, insert one `class_materials` row with `source = "director"` and
`teacher_id = recipient.id`. Reuse the uploaded PDF path instead of uploading duplicate files.

- [ ] **Step 3: Display in professor dashboard**

List these records under `Materiais-base da Diretoria`, showing title, description, file/link, and
sent date.

- [ ] **Step 4: Validate permissions**

Only directors can create base material records. Each professor only sees their targeted records.

### Task 6: Home-page plan order and final verification

**Files:**
- Modify: `src/routes/index.tsx`
- Modify: `src/routes/planos.tsx`

- [ ] **Step 1: Order the cards**

Use:

```ts
const order = { advanced: 0, essential: 1, conversation: 2 };
```

Keep `essential` as the only `MAIS ESCOLHIDO` card.

- [ ] **Step 2: Apply migration**

Run:

```powershell
supabase db push --linked --yes
```

Expected: new migration applied successfully.

- [ ] **Step 3: Run full verification**

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

Expected: no errors.

- [ ] **Step 4: Commit and publish**

```powershell
git add src supabase docs
git commit -m "Adiciona pacotes cancelamento agenda e materiais"
git push origin main
```

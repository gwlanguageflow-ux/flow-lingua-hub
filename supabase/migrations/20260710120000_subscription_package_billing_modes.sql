alter table public.student_subscriptions
  add column if not exists package_billing_mode text not null default 'monthly',
  add column if not exists package_commitment_months integer not null default 1,
  add column if not exists package_commitment_end timestamp with time zone,
  add column if not exists package_monthly_amount numeric(10, 2),
  add column if not exists package_upfront_amount numeric(10, 2);

alter table public.student_subscriptions
  drop constraint if exists student_subscriptions_package_billing_mode_check,
  add constraint student_subscriptions_package_billing_mode_check
    check (package_billing_mode in ('monthly', 'upfront'));

update public.student_subscriptions
set
  package_billing_mode = case
    when coalesce(package_months, 1) > 1
      and coalesce(package_total_amount, 0) > coalesce(package_base_amount, 0)
    then 'upfront'
    else 'monthly'
  end,
  package_commitment_months = greatest(coalesce(package_months, 1), 1),
  package_monthly_amount = case
    when coalesce(package_months, 1) > 1 and coalesce(package_total_amount, 0) > 0
      then round((package_total_amount / package_months)::numeric, 2)
    else package_total_amount
  end,
  package_upfront_amount = case
    when coalesce(package_months, 1) > 1 and coalesce(package_total_amount, 0) > 0
      then package_total_amount
    else package_total_amount
  end
where package_type is not null;

alter table public.subscription_package_prices
  add column if not exists package_billing_mode text not null default 'upfront';

alter table public.subscription_package_prices
  drop constraint if exists subscription_package_prices_package_billing_mode_check,
  add constraint subscription_package_prices_package_billing_mode_check
    check (package_billing_mode in ('monthly', 'upfront'));

drop index if exists public.subscription_package_prices_plan_idx;
drop index if exists public.subscription_package_prices_custom_plan_idx;

create unique index if not exists subscription_package_prices_plan_billing_idx
  on public.subscription_package_prices (plan_id, package_type, package_billing_mode, coupon_discount_percent)
  where plan_id is not null;

create unique index if not exists subscription_package_prices_custom_plan_billing_idx
  on public.subscription_package_prices (custom_plan_id, package_type, package_billing_mode, coupon_discount_percent)
  where custom_plan_id is not null;

drop policy if exists "Class materials visible to owners and students" on public.class_materials;
create policy "Class materials visible to owners and students"
on public.class_materials
for select
to authenticated
using (
  public.has_role(auth.uid(), 'dev'::public.app_role)
  or (
    source = 'platform'
    and (
      public.has_role(auth.uid(), 'professor'::public.app_role)
      or exists (
        select 1
        from public.student_subscriptions ss
        where ss.student_id = auth.uid()
          and ss.status = 'ativa'
          and (ss.current_period_end is null or ss.current_period_end > now())
      )
    )
  )
  or teacher_id = auth.uid()
  or (
    student_id = auth.uid()
    and exists (
      select 1
      from public.student_subscriptions ss
      where ss.student_id = auth.uid()
        and ss.status = 'ativa'
        and (ss.current_period_end is null or ss.current_period_end > now())
    )
  )
  or exists (
    select 1
    from public.student_subscriptions ss
    where ss.teacher_id = class_materials.teacher_id
      and ss.student_id = auth.uid()
      and ss.status = 'ativa'
      and (ss.current_period_end is null or ss.current_period_end > now())
  )
  or exists (
    select 1
    from public.class_members cm
    join public.class_groups cg on cg.id = cm.class_id
    join public.student_subscriptions ss
      on ss.teacher_id = cg.teacher_id
     and ss.student_id = cm.student_id
     and ss.status = 'ativa'
     and (ss.current_period_end is null or ss.current_period_end > now())
    where cm.class_id = class_materials.class_id
      and cm.student_id = auth.uid()
      and cm.status = 'ativo'
  )
);

drop policy if exists "Assignments visible to class participants" on public.class_assignments;
create policy "Assignments visible to class participants"
on public.class_assignments
for select
to authenticated
using (
  teacher_id = auth.uid()
  or public.has_role(auth.uid(), 'dev'::public.app_role)
  or (
    student_id = auth.uid()
    and exists (
      select 1
      from public.student_subscriptions ss
      where ss.teacher_id = class_assignments.teacher_id
        and ss.student_id = auth.uid()
        and ss.status = 'ativa'
        and (ss.current_period_end is null or ss.current_period_end > now())
    )
  )
  or exists (
    select 1
    from public.student_subscriptions ss
    where ss.teacher_id = class_assignments.teacher_id
      and ss.student_id = auth.uid()
      and ss.status = 'ativa'
      and (ss.current_period_end is null or ss.current_period_end > now())
  )
  or exists (
    select 1
    from public.class_members cm
    join public.class_groups cg on cg.id = cm.class_id
    join public.student_subscriptions ss
      on ss.teacher_id = cg.teacher_id
     and ss.student_id = cm.student_id
     and ss.status = 'ativa'
     and (ss.current_period_end is null or ss.current_period_end > now())
    where cm.class_id = class_assignments.class_id
      and cm.student_id = auth.uid()
      and cm.status = 'ativo'
  )
);

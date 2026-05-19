import { supabaseAdmin } from "@/integrations/supabase/client.server";

type DbError = {
  message: string;
  code?: string;
};

export type DbResult<T = unknown> = {
  data: T | null;
  error: DbError | null;
};

type QueryChain<T = unknown> = PromiseLike<DbResult<T>> & {
  select(columns?: string): QueryChain<T>;
  insert(values: unknown): QueryChain<T>;
  update(values: unknown): QueryChain<T>;
  eq(column: string, value: unknown): QueryChain<T>;
  is(column: string, value: unknown): QueryChain<T>;
  or(filters: string): QueryChain<T>;
  lte(column: string, value: unknown): QueryChain<T>;
  not(column: string, operator: string, value: unknown): QueryChain<T>;
  order(column: string, options?: { ascending?: boolean }): QueryChain<T>;
  limit(count: number): QueryChain<T>;
  single(): Promise<DbResult<T>>;
  maybeSingle(): Promise<DbResult<T>>;
};

export type ComplianceDb = {
  from<T = unknown>(table: string): QueryChain<T>;
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<DbResult<T>>;
};

export function getComplianceDb() {
  return supabaseAdmin as unknown as ComplianceDb;
}

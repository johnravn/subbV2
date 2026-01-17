-- Ensure views run with invoker privileges so RLS applies
ALTER VIEW IF EXISTS public.group_on_hand
  SET (security_invoker = on);

ALTER VIEW IF EXISTS public.group_parts
  SET (security_invoker = on);

ALTER VIEW IF EXISTS public.group_with_rollups
  SET (security_invoker = on);

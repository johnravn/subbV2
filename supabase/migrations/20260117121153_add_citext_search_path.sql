CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'add_member_or_invite'
      AND pg_get_function_identity_arguments(p.oid) = 'p_company_id uuid, p_email text, p_inviter_id uuid, p_role public.company_role'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.add_member_or_invite(uuid, text, uuid, public.company_role) SET search_path TO ''public'', ''extensions''';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'add_freelancer_or_invite'
      AND pg_get_function_identity_arguments(p.oid) = 'p_company_id uuid, p_email text, p_inviter_id uuid'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.add_freelancer_or_invite(uuid, text, uuid) SET search_path TO ''public'', ''extensions''';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'add_freelancer_or_invite'
      AND pg_get_function_identity_arguments(p.oid) = 'p_company_id uuid, p_email public.citext, p_inviter_id uuid'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.add_freelancer_or_invite(uuid, public.citext, uuid) SET search_path TO ''public'', ''extensions''';
  END IF;
END $$;

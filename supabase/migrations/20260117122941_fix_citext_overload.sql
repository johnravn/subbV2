CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;

DROP FUNCTION IF EXISTS public.add_freelancer_or_invite(uuid, public.citext, uuid);

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.add_member_or_invite(uuid, text, uuid, public.company_role)
      SET search_path TO 'public', 'extensions';
  EXCEPTION
    WHEN undefined_function THEN
      NULL;
  END;

  BEGIN
    ALTER FUNCTION public.add_freelancer_or_invite(uuid, text, uuid)
      SET search_path TO 'public', 'extensions';
  EXCEPTION
    WHEN undefined_function THEN
      NULL;
  END;
END;
$$;

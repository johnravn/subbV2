-- Ensure citext extension is available in extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;

-- Ensure API roles can resolve citext in search_path
DO $$
BEGIN
  BEGIN
    ALTER ROLE anon SET search_path TO 'public', 'extensions';
  EXCEPTION
    WHEN undefined_object THEN
      NULL;
  END;

  BEGIN
    ALTER ROLE authenticated SET search_path TO 'public', 'extensions';
  EXCEPTION
    WHEN undefined_object THEN
      NULL;
  END;
END;
$$;

-- Ensure RPC functions can resolve citext
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

  IF to_regtype('public.citext') IS NOT NULL THEN
    BEGIN
      EXECUTE 'ALTER FUNCTION public.add_freelancer_or_invite(uuid, public.citext, uuid) SET search_path TO ''public'', ''extensions''';
    EXCEPTION
      WHEN undefined_function THEN
        NULL;
    END;
  ELSIF to_regtype('extensions.citext') IS NOT NULL THEN
    BEGIN
      EXECUTE 'ALTER FUNCTION public.add_freelancer_or_invite(uuid, extensions.citext, uuid) SET search_path TO ''public'', ''extensions''';
    EXCEPTION
      WHEN undefined_function THEN
        NULL;
    END;
  END IF;
END;
$$;

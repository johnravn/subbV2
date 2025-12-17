


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "public";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."activity_type" AS ENUM (
    'inventory_item_created',
    'inventory_item_deleted',
    'inventory_group_created',
    'inventory_group_deleted',
    'vehicle_added',
    'vehicle_removed',
    'customer_added',
    'customer_removed',
    'crew_added',
    'crew_removed',
    'job_created',
    'job_deleted',
    'announcement',
    'job_status_changed'
);


ALTER TYPE "public"."activity_type" OWNER TO "postgres";


CREATE TYPE "public"."company_role" AS ENUM (
    'super_user',
    'owner',
    'employee',
    'freelancer'
);


ALTER TYPE "public"."company_role" OWNER TO "postgres";


CREATE TYPE "public"."crew_request_status" AS ENUM (
    'planned',
    'requested',
    'declined',
    'accepted'
);


ALTER TYPE "public"."crew_request_status" OWNER TO "postgres";


CREATE TYPE "public"."external_request_status" AS ENUM (
    'planned',
    'requested',
    'confirmed'
);


ALTER TYPE "public"."external_request_status" OWNER TO "postgres";


CREATE TYPE "public"."fuel" AS ENUM (
    'electric',
    'diesel',
    'petrol'
);


ALTER TYPE "public"."fuel" OWNER TO "postgres";


CREATE TYPE "public"."item_kind" AS ENUM (
    'bulk',
    'unique'
);


ALTER TYPE "public"."item_kind" OWNER TO "postgres";


CREATE TYPE "public"."job_status" AS ENUM (
    'draft',
    'planned',
    'requested',
    'confirmed',
    'in_progress',
    'completed',
    'canceled',
    'invoiced',
    'paid'
);


ALTER TYPE "public"."job_status" OWNER TO "postgres";


CREATE TYPE "public"."matter_recipient_status" AS ENUM (
    'pending',
    'sent',
    'viewed',
    'responded',
    'declined',
    'accepted'
);


ALTER TYPE "public"."matter_recipient_status" OWNER TO "postgres";


CREATE TYPE "public"."matter_type" AS ENUM (
    'crew_invite',
    'vote',
    'announcement',
    'chat',
    'update'
);


ALTER TYPE "public"."matter_type" OWNER TO "postgres";


CREATE TYPE "public"."offer_status" AS ENUM (
    'draft',
    'sent',
    'viewed',
    'accepted',
    'rejected',
    'superseded'
);


ALTER TYPE "public"."offer_status" OWNER TO "postgres";


CREATE TYPE "public"."offer_type" AS ENUM (
    'technical',
    'pretty'
);


ALTER TYPE "public"."offer_type" OWNER TO "postgres";


CREATE TYPE "public"."pretty_section_type" AS ENUM (
    'hero',
    'problem',
    'solution',
    'benefits',
    'testimonial'
);


ALTER TYPE "public"."pretty_section_type" OWNER TO "postgres";


CREATE TYPE "public"."reservation_source_kind" AS ENUM (
    'direct',
    'group'
);


ALTER TYPE "public"."reservation_source_kind" OWNER TO "postgres";


CREATE TYPE "public"."reservation_status" AS ENUM (
    'tentative',
    'requested',
    'confirmed',
    'in_progress',
    'completed',
    'canceled'
);


ALTER TYPE "public"."reservation_status" OWNER TO "postgres";


CREATE TYPE "public"."time_period_category" AS ENUM (
    'program',
    'equipment',
    'crew',
    'transport'
);


ALTER TYPE "public"."time_period_category" OWNER TO "postgres";


CREATE TYPE "public"."unit_status" AS ENUM (
    'in_service',
    'needs_service',
    'lost',
    'retired'
);


ALTER TYPE "public"."unit_status" OWNER TO "postgres";


CREATE TYPE "public"."vehicle_category" AS ENUM (
    'passenger_car_small',
    'passenger_car_medium',
    'passenger_car_big',
    'van_small',
    'van_medium',
    'van_big',
    'C1',
    'C1E',
    'C',
    'CE'
);


ALTER TYPE "public"."vehicle_category" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_rv_set_during"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$DECLARE
  hdr_start timestamptz;
  hdr_end   timestamptz;
BEGIN
  SELECT r.start_at, r.end_at INTO hdr_start, hdr_end
  FROM public.time_periods r
  WHERE r.id = NEW.time_period_id;

  IF NEW.start_at IS NULL AND NEW.end_at IS NULL THEN
    NEW.during := tstzrange(hdr_start, hdr_end, '[)');
  ELSE
    NEW.during := tstzrange(COALESCE(NEW.start_at, hdr_start),
                            COALESCE(NEW.end_at,   hdr_end), '[)');
  END IF;

  RETURN NEW;
END$$;


ALTER FUNCTION "public"."_rv_set_during"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_pending_invites_on_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_sqlstate text;
  v_message  text;
  v_detail   text;
  v_hint     text;
  v_context  text;
begin
  begin
    insert into public.company_users(company_id, user_id, role)
    select
      pi.company_id,
      new.user_id,
      (pi.role::company_role)   -- 👈 cast text → enum here
    from public.pending_invites pi
    where lower(pi.email) = lower(new.email)
      and pi.expires_at > now()
    on conflict (company_id, user_id) do nothing;

    delete from public.pending_invites
    where lower(email) = lower(new.email);
  exception
    when others then
      get stacked diagnostics
        v_sqlstate = returned_sqlstate,
        v_message  = message_text,
        v_detail   = pg_exception_detail,
        v_hint     = pg_exception_hint,
        v_context  = pg_exception_context;

      insert into public.dev_auth_logs(where_hint, user_id, sqlstate, message, detail, hint, context)
      values ('accept_pending_invites_on_profile', new.user_id, v_sqlstate, v_message, v_detail, v_hint, v_context);
  end;

  return new;
end;
$$;


ALTER FUNCTION "public"."accept_pending_invites_on_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_existing_users_to_welcome_matter"("p_company_id" "uuid", "p_matter_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Add all existing company members as recipients to the welcome matter
  INSERT INTO matter_recipients (matter_id, user_id, status)
  SELECT p_matter_id, cu.user_id, 'pending'
  FROM company_users cu
  WHERE cu.company_id = p_company_id
    -- Avoid duplicates
    AND NOT EXISTS (
      SELECT 1
      FROM matter_recipients mr
      WHERE mr.matter_id = p_matter_id
        AND mr.user_id = cu.user_id
    );
END;
$$;


ALTER FUNCTION "public"."add_existing_users_to_welcome_matter"("p_company_id" "uuid", "p_matter_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_freelancer_or_invite"("p_company_id" "uuid", "p_email" "text", "p_inviter_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.add_member_or_invite(p_company_id, p_email, p_inviter_id, 'freelancer'::public.company_role);
$$;


ALTER FUNCTION "public"."add_freelancer_or_invite"("p_company_id" "uuid", "p_email" "text", "p_inviter_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_freelancer_or_invite"("p_company_id" "uuid", "p_email" "public"."citext", "p_inviter_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_email         citext := lower(p_email);
  v_existing_user uuid;
  v_existing_role public.company_role;
  v_existing_inv  uuid;
  v_by_user_id    uuid;
BEGIN
  -- Does a profile with this email exist?
  SELECT user_id
    INTO v_existing_user
  FROM public.profiles
  WHERE email = v_email;

  IF v_existing_user IS NOT NULL THEN
    -- Already in the company?
    SELECT role
      INTO v_existing_role
    FROM public.company_users
    WHERE company_id = p_company_id
      AND user_id = v_existing_user;

    IF v_existing_role IS NOT NULL THEN
      RETURN jsonb_build_object('type','already_member','role', v_existing_role::text);
    END IF;

    -- Add them as freelancer
    INSERT INTO public.company_users (company_id, user_id, role)
    VALUES (p_company_id, v_existing_user, 'freelancer'::public.company_role)
    ON CONFLICT (company_id, user_id) DO NOTHING;

    RETURN jsonb_build_object('type','added');
  END IF;

  -- No user account yet: existing, unexpired invite?
  SELECT id, inviter_user_id
    INTO v_existing_inv, v_by_user_id
  FROM public.pending_invites
  WHERE company_id = p_company_id
    AND email = v_email
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_inv IS NOT NULL THEN
    RETURN jsonb_build_object('type','already_invited','by_user_id', v_by_user_id);
  END IF;

  -- Create invite
  INSERT INTO public.pending_invites (company_id, inviter_user_id, email, role, expires_at)
  VALUES (p_company_id, p_inviter_id, v_email, 'freelancer'::public.company_role, now() + interval '30 days');

  RETURN jsonb_build_object('type','invited');
END;
$$;


ALTER FUNCTION "public"."add_freelancer_or_invite"("p_company_id" "uuid", "p_email" "public"."citext", "p_inviter_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_member_or_invite"("p_company_id" "uuid", "p_email" "text", "p_inviter_id" "uuid", "p_role" "public"."company_role") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_email         citext := lower(p_email);
  v_existing_user uuid;
  v_existing_role public.company_role;
  v_existing_inv  uuid;
  v_by_user_id    uuid;
begin
  -- Does a profile with this email exist? (case-insensitive)
  select user_id
    into v_existing_user
  from public.profiles
  where lower(email) = v_email::text;

  if v_existing_user is not null then
    -- Already in the company?
    select role
      into v_existing_role
    from public.company_users
    where company_id = p_company_id
      and user_id    = v_existing_user;

    if v_existing_role is not null then
      return jsonb_build_object('type','already_member','role', v_existing_role::text);
    end if;

    -- Add them with the requested role
    insert into public.company_users (company_id, user_id, role)
    values (p_company_id, v_existing_user, p_role)
    on conflict (company_id, user_id) do nothing;

    return jsonb_build_object('type','added');
  end if;

  -- No user account yet: existing, unexpired invite?
  select id, inviter_user_id
    into v_existing_inv, v_by_user_id
  from public.pending_invites
  where company_id = p_company_id
    and lower(email::text) = v_email::text
    and expires_at > now()
  order by created_at desc
  limit 1;

  if v_existing_inv is not null then
    return jsonb_build_object('type','already_invited','by_user_id', v_by_user_id);
  end if;

  -- Create invite with requested role
  insert into public.pending_invites (company_id, inviter_user_id, email, role, expires_at)
  values (p_company_id, p_inviter_id, v_email::text, p_role, now() + interval '30 days');

  return jsonb_build_object('type','invited');
end;
$$;


ALTER FUNCTION "public"."add_member_or_invite"("p_company_id" "uuid", "p_email" "text", "p_inviter_id" "uuid", "p_role" "public"."company_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_user_to_welcome_matter"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  welcome_matter_id UUID;
BEGIN
  -- Find the welcome matter for the company the user is being added to
  -- Welcome matters have title 'Welcome to our company' and type 'announcement'
  SELECT id INTO welcome_matter_id
  FROM matters
  WHERE company_id = NEW.company_id
    AND title = 'Welcome to our company'
    AND matter_type = 'announcement'
  LIMIT 1;

  -- If a welcome matter exists for this company, add the user as a recipient
  -- This works for both new and existing users being added to any company
  IF welcome_matter_id IS NOT NULL THEN
    -- Insert recipient if it doesn't already exist (avoid duplicates)
    -- ON CONFLICT handles case where user might already be a recipient (shouldn't happen but safe)
    INSERT INTO matter_recipients (matter_id, user_id, status)
    VALUES (welcome_matter_id, NEW.user_id, 'pending')
    ON CONFLICT (matter_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_user_to_welcome_matter"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_item_availability_for_job"("p_job_id" "uuid", "p_item_id" "uuid") RETURNS json
    LANGUAGE "plpgsql"
    AS $$declare
  v_start timestamptz;
  v_end   timestamptz;
  v_conflicts int;
begin
  select start_at, end_at into v_start, v_end from public.jobs where id = p_job_id;
  if v_start is null or v_end is null then
    return json_build_object('conflicts', 0);
  end if;

  select count(distinct ri.time_period_id) into v_conflicts
  from public.reserved_items ri
  join public.time_periods r on r.id = ri.time_period_id
  where ri.item_id = p_item_id
    and r.start_at < v_end
    and r.end_at   > v_start
    and r.job_id <> p_job_id; -- exclude current job

  return json_build_object('conflicts', coalesce(v_conflicts,0));
end$$;


ALTER FUNCTION "public"."check_item_availability_for_job"("p_job_id" "uuid", "p_item_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_item_quantity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$DECLARE
  hdr_start timestamptz;
  hdr_end   timestamptz;
  eff_start timestamptz;
  eff_end   timestamptz;
  overlap_sum integer;
  capacity   integer;
BEGIN
  -- Header times
  SELECT r.start_at, r.end_at INTO hdr_start, hdr_end
  FROM public.time_periods r
  WHERE r.id = NEW.time_period_id;

  IF hdr_start IS NULL OR hdr_end IS NULL THEN
    RAISE EXCEPTION 'Reservation % must have start_at and end_at before adding items',
      NEW.time_period_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Effective times for NEW row
  eff_start := COALESCE(NEW.start_at, hdr_start);
  eff_end   := COALESCE(NEW.end_at,   hdr_end);

  -- Capacity from items
  SELECT total_quantity INTO capacity
  FROM public.items
  WHERE id = NEW.item_id;

  IF capacity IS NULL THEN
    RAISE EXCEPTION 'Item % does not exist', NEW.item_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Sum quantities of overlapping reservations for the same item (excluding NEW on update)
  SELECT COALESCE(SUM(ri.quantity), 0) INTO overlap_sum
  FROM public.reserved_items ri
  JOIN public.time_periods r2 ON r2.id = ri.time_period_id
  WHERE ri.item_id = NEW.item_id
    AND tstzrange(
          COALESCE(ri.start_at, r2.start_at),
          COALESCE(ri.end_at,   r2.end_at),
          '[)'
        ) && tstzrange(eff_start, eff_end, '[)')
    AND (TG_OP <> 'UPDATE' OR ri.id <> NEW.id);

  IF overlap_sum + NEW.quantity > capacity THEN
    RAISE EXCEPTION
      'Not enough quantity for item %, requested=% / capacity=% in period',
      NEW.item_id, (overlap_sum + NEW.quantity), capacity
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END$$;


ALTER FUNCTION "public"."check_item_quantity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_group_with_price_and_parts"("p_company_id" "uuid", "p_name" "text", "p_category_id" "uuid" DEFAULT NULL::"uuid", "p_description" "text" DEFAULT NULL::"text", "p_active" boolean DEFAULT true, "p_price" numeric DEFAULT NULL::numeric, "p_parts" "jsonb" DEFAULT '[]'::"jsonb", "p_unique" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_group_id uuid;
begin
  insert into public.item_groups (company_id, name, category_id, description, active, "unique")
  values (p_company_id, p_name, p_category_id, p_description, coalesce(p_active, true), coalesce(p_unique, false))
  returning id into v_group_id;

  if jsonb_typeof(p_parts) = 'array' and jsonb_array_length(p_parts) > 0 then
    insert into public.group_items (group_id, item_id, quantity)
    select
      v_group_id,
      (j->>'item_id')::uuid,
      greatest(1, coalesce((j->>'quantity')::int, 1))
    from jsonb_array_elements(p_parts) as j;
  end if;

  if p_price is not null then
    insert into public.group_price_history (company_id, group_id, amount, set_by)
    values (p_company_id, v_group_id, p_price, auth.uid());
  end if;
end;
$$;


ALTER FUNCTION "public"."create_group_with_price_and_parts"("p_company_id" "uuid", "p_name" "text", "p_category_id" "uuid", "p_description" "text", "p_active" boolean, "p_price" numeric, "p_parts" "jsonb", "p_unique" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_item_with_price"("p_company_id" "uuid", "p_name" "text", "p_category_id" "uuid" DEFAULT NULL::"uuid", "p_brand_id" "uuid" DEFAULT NULL::"uuid", "p_model" "text" DEFAULT NULL::"text", "p_allow_individual_booking" boolean DEFAULT true, "p_total_quantity" integer DEFAULT 0, "p_active" boolean DEFAULT true, "p_notes" "text" DEFAULT NULL::"text", "p_price" numeric DEFAULT NULL::numeric, "p_effective_from" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_item_id uuid;
begin
  insert into public.items (
    company_id, name, category_id, brand_id, model,
    allow_individual_booking, total_quantity, active, notes
  ) values (
    p_company_id, p_name, p_category_id, p_brand_id, p_model,
    p_allow_individual_booking, coalesce(p_total_quantity, 0), p_active, p_notes
  )
  returning id into v_item_id;

  if p_price is not null then
    insert into public.item_price_history (
      company_id, item_id, amount, effective_from, set_by
    ) values (
      p_company_id, v_item_id, p_price, coalesce(p_effective_from, now()), auth.uid()
    );
  end if;

  return v_item_id;
end;
$$;


ALTER FUNCTION "public"."create_item_with_price"("p_company_id" "uuid", "p_name" "text", "p_category_id" "uuid", "p_brand_id" "uuid", "p_model" "text", "p_allow_individual_booking" boolean, "p_total_quantity" integer, "p_active" boolean, "p_notes" "text", "p_price" numeric, "p_effective_from" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_item_with_price"("p_company_id" "uuid", "p_name" "text", "p_category_id" "uuid" DEFAULT NULL::"uuid", "p_brand_id" "uuid" DEFAULT NULL::"uuid", "p_model" "text" DEFAULT NULL::"text", "p_allow_individual_booking" boolean DEFAULT true, "p_total_quantity" numeric DEFAULT NULL::numeric, "p_active" boolean DEFAULT true, "p_notes" "text" DEFAULT NULL::"text", "p_price" numeric DEFAULT NULL::numeric, "p_currency" "text" DEFAULT 'NOK'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_item_id uuid;
begin
  -- insert item
  insert into public.items (
    company_id, name, category_id, brand_id, model,
    allow_individual_booking, total_quantity, active, notes
  ) values (
    p_company_id, p_name, p_category_id, p_brand_id, p_model,
    p_allow_individual_booking, p_total_quantity, p_active, p_notes
  )
  returning id into v_item_id;

  -- optional price
  if p_price is not null then
    insert into public.item_prices (item_id, amount, currency)
    values (v_item_id, p_price, coalesce(p_currency, 'NOK'));
  end if;

  return v_item_id;
end;
$$;


ALTER FUNCTION "public"."create_item_with_price"("p_company_id" "uuid", "p_name" "text", "p_category_id" "uuid", "p_brand_id" "uuid", "p_model" "text", "p_allow_individual_booking" boolean, "p_total_quantity" numeric, "p_active" boolean, "p_notes" "text", "p_price" numeric, "p_currency" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_company_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select nullif(auth.jwt()->>'company_id','')::uuid
$$;


ALTER FUNCTION "public"."current_company_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrypt_api_key"("p_company_id" "uuid", "p_encrypted_key" "bytea") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  encryption_key := coalesce(
    current_setting('app.settings.encryption_key', true),
    'dev-encryption-key-change-in-production-' || p_company_id::TEXT
  );
  
  RETURN pgp_sym_decrypt(
    p_encrypted_key,
    encryption_key || p_company_id::TEXT
  );
END;
$$;


ALTER FUNCTION "public"."decrypt_api_key"("p_company_id" "uuid", "p_encrypted_key" "bytea") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrypt_api_key"("p_company_id" "uuid", "p_encrypted_key" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_decrypted_key TEXT;
  v_secret_key TEXT;
  v_key_hash BYTEA;
  v_clean_base64 TEXT;
  v_encrypted_bytes BYTEA;
BEGIN
  -- Generate the same secret key used during encryption
  v_secret_key := 'conta_api_key_secret_' || p_company_id::TEXT;
  
  -- Hash the secret key to get the same fixed-length key used during encryption
  v_key_hash := digest(v_secret_key, 'sha256');
  
  -- Clean the base64 string: remove all invalid characters
  -- First, explicitly remove backslashes (common escape character issue)
  v_clean_base64 := replace(p_encrypted_key, '\', '');
  -- Remove all other non-base64 characters (whitespace, newlines, etc.)
  v_clean_base64 := regexp_replace(v_clean_base64, '[^A-Za-z0-9+/=]', '', 'g');
  
  -- Decrypt using decrypt function from pgcrypto extension
  BEGIN
    -- Decode the base64 string
    v_encrypted_bytes := decode(v_clean_base64, 'base64');
    
    -- Now decrypt the bytes
    SELECT convert_from(
      decrypt(
        v_encrypted_bytes,
        v_key_hash,
        'aes'
      ),
      'UTF8'
    ) INTO v_decrypted_key;
    
    RETURN v_decrypted_key;
  EXCEPTION
    WHEN OTHERS THEN
      -- If decryption fails, raise a clear error with more context
      RAISE EXCEPTION 'Unable to decrypt API key. The key may be corrupted or encrypted with a different method. Error: %', SQLERRM;
  END;
END;
$$;


ALTER FUNCTION "public"."decrypt_api_key"("p_company_id" "uuid", "p_encrypted_key" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."decrypt_api_key"("p_company_id" "uuid", "p_encrypted_key" "text") IS 'Decrypts an API key that was encrypted with encrypt_api_key. Requires the same company_id used during encryption.';



CREATE OR REPLACE FUNCTION "public"."encrypt_api_key"("p_company_id" "uuid", "p_api_key" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_encrypted_key TEXT;
  v_secret_key TEXT;
  v_key_hash BYTEA;
BEGIN
  -- Generate a secret key from company_id and a fixed salt
  -- In production, replace this with a key from Supabase Vault
  -- For now, we use a combination that's unique per company
  v_secret_key := 'conta_api_key_secret_' || p_company_id::TEXT;
  
  -- Hash the secret key to get a fixed-length key (32 bytes for AES-256)
  -- This ensures the key is the right length for encryption
  v_key_hash := digest(v_secret_key, 'sha256');
  
  -- Encrypt using encrypt function from pgcrypto extension
  -- Using 'aes' (AES-256) cipher which supports 32-byte keys
  SELECT encode(
    encrypt(
      p_api_key::bytea,
      v_key_hash,
      'aes'
    ),
    'base64'
  ) INTO v_encrypted_key;
  
  RETURN v_encrypted_key;
EXCEPTION
  WHEN OTHERS THEN
    -- If encryption fails, raise an error
    RAISE EXCEPTION 'Failed to encrypt API key: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."encrypt_api_key"("p_company_id" "uuid", "p_api_key" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."encrypt_api_key"("p_company_id" "uuid", "p_api_key" "text") IS 'Encrypts an API key for a company using pgcrypto. The company_id is used as part of the encryption key.';



CREATE OR REPLACE FUNCTION "public"."enforce_within_time_period"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$DECLARE
  hdr_start timestamptz;
  hdr_end   timestamptz;
BEGIN
  SELECT r.start_at, r.end_at INTO hdr_start, hdr_end
  FROM public.time_periods r
  WHERE r.id = NEW.time_period_id;

  IF hdr_start IS NULL OR hdr_end IS NULL THEN
    RAISE EXCEPTION 'Reservation % must have start_at and end_at before adding lines',
      NEW.time_period_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Only validate when overriding times
  IF NEW.start_at IS NOT NULL OR NEW.end_at IS NOT NULL THEN
    IF NEW.start_at IS NULL OR NEW.end_at IS NULL THEN
      RAISE EXCEPTION 'Both start_at and end_at must be set when overriding line times';
    END IF;

    IF NOT (NEW.start_at >= hdr_start AND NEW.end_at <= hdr_end) THEN
      RAISE EXCEPTION
        'Line window [% - %) must be within reservation window [% - %]',
        NEW.start_at, NEW.end_at, hdr_start, hdr_end
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END$$;


ALTER FUNCTION "public"."enforce_within_time_period"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_default_reservation"("p_job_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_time_period_id uuid;
  v_company_id uuid;
  v_job_start_at timestamptz;
  v_job_end_at timestamptz;
BEGIN
  -- Get the company_id and dates from the job
  SELECT company_id, start_at, end_at 
  INTO v_company_id, v_job_start_at, v_job_end_at
  FROM jobs
  WHERE id = p_job_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;

  -- Check if a time period exists for this job
  SELECT id INTO v_time_period_id
  FROM time_periods
  WHERE job_id = p_job_id
  AND deleted = false
  ORDER BY created_at ASC
  LIMIT 1;

  -- If no time period exists, create one
  IF v_time_period_id IS NULL THEN
    INSERT INTO time_periods (
      job_id,
      company_id,
      title,
      status,
      start_at,
      end_at
    )
    VALUES (
      p_job_id,
      v_company_id,
      'Default',
      'tentative',
      COALESCE(v_job_start_at, NOW()),
      COALESCE(v_job_end_at, NOW() + INTERVAL '1 day')
    )
    RETURNING id INTO v_time_period_id;
  END IF;

  RETURN v_time_period_id;
END;
$$;


ALTER FUNCTION "public"."ensure_default_reservation"("p_job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_profile_for_user"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  u record;
  meta jsonb;
  v_conflict_user uuid;
begin
  select id, email, raw_user_meta_data
  into u
  from auth.users
  where id = p_user_id;

  if not found or u.email is null then
    return;
  end if;

  meta := coalesce(u.raw_user_meta_data, '{}'::jsonb);

  -- DEV-SAFE: delete any stale profile with same email on a different user
  select p.user_id
    into v_conflict_user
  from public.profiles p
  where lower(p.email) = lower(u.email)
    and p.user_id <> u.id
  limit 1;

  if found then
    delete from public.profiles where user_id = v_conflict_user;
  end if;

  insert into public.profiles(
    user_id, email, display_name, first_name, last_name, phone, avatar_url
  )
  values (
    u.id,
    lower(u.email),
    nullif(trim(meta->>'full_name'), ''),
    nullif(trim(meta->>'first_name'), ''),
    nullif(trim(meta->>'last_name'), ''),
    nullif(trim(meta->>'phone'), ''),
    nullif(trim(meta->>'avatar_url'), '')
  )
  on conflict (user_id) do update set
    email        = excluded.email,
    display_name = coalesce(excluded.display_name, profiles.display_name),
    first_name   = coalesce(excluded.first_name,   profiles.first_name),
    last_name    = coalesce(excluded.last_name,    profiles.last_name),
    phone        = coalesce(excluded.phone,        profiles.phone),
    avatar_url   = coalesce(excluded.avatar_url,   profiles.avatar_url);
end;
$$;


ALTER FUNCTION "public"."ensure_profile_for_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fuzzy_search_multi"("search_term" "text", "fields" "text"[], "similarity_threshold" real DEFAULT 0.2) RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  field TEXT;
BEGIN
  -- If no fields provided, return false
  IF array_length(fields, 1) IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check each field for fuzzy match
  FOREACH field IN ARRAY fields
  LOOP
    IF fuzzy_search_text(search_term, COALESCE(field, ''), similarity_threshold) THEN
      RETURN TRUE;
    END IF;
  END LOOP;
  
  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."fuzzy_search_multi"("search_term" "text", "fields" "text"[], "similarity_threshold" real) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fuzzy_search_text"("search_term" "text", "text_to_search" "text", "similarity_threshold" real DEFAULT 0.2) RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  -- Return true if similarity is above threshold
  -- Also check for exact match or ilike match for exact queries
  RETURN 
    search_term ILIKE '%' || text_to_search || '%' OR
    text_to_search ILIKE '%' || search_term || '%' OR
    similarity(search_term, text_to_search) >= similarity_threshold;
END;
$$;


ALTER FUNCTION "public"."fuzzy_search_text"("search_term" "text", "text_to_search" "text", "similarity_threshold" real) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_job_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_year INTEGER;
  counter_value INTEGER;
  new_jobnr INTEGER;
BEGIN
  -- Get the current year (last 2 digits)
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER % 100;
  
  -- Get and increment the counter for this company
  -- Using SELECT FOR UPDATE to prevent race conditions
  SELECT job_number_counter + 1 INTO counter_value
  FROM companies
  WHERE id = NEW.company_id
  FOR UPDATE;
  
  -- Update the counter in the company table
  UPDATE companies
  SET job_number_counter = counter_value
  WHERE id = NEW.company_id;
  
  -- Generate jobnr: counter (4 digits) + year (2 digits)
  -- Example: counter=1, year=25 -> 000125
  -- Example: counter=1234, year=25 -> 123425
  new_jobnr := (LPAD(counter_value::TEXT, 4, '0') || LPAD(current_year::TEXT, 2, '0'))::INTEGER;
  
  -- Set the jobnr on the new job
  NEW.jobnr := new_jobnr;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_job_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_accounting_read_only"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_role TEXT;
  v_read_only BOOLEAN;
  v_is_superuser BOOLEAN;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the user's selected company from their profile
  SELECT selected_company_id INTO v_company_id
  FROM profiles
  WHERE user_id = v_user_id;

  -- If no company selected, try to get the first company they're a member of
  IF v_company_id IS NULL THEN
    SELECT company_id INTO v_company_id
    FROM company_users
    WHERE user_id = v_user_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any company';
  END IF;

  -- Check if user is a member of the company and get their role
  SELECT role INTO v_role
  FROM company_users
  WHERE user_id = v_user_id
    AND company_id = v_company_id;

  -- Allow superusers (global), owners, employees, and super_user role
  IF v_role IS NULL THEN
    -- Check if user is a global superuser
    SELECT COALESCE(superuser, false) INTO v_is_superuser
    FROM profiles
    WHERE user_id = v_user_id;
    
    IF NOT v_is_superuser THEN
      RAISE EXCEPTION 'User is not authorized to access accounting settings';
    END IF;
  ELSIF v_role NOT IN ('owner', 'employee', 'super_user') THEN
    RAISE EXCEPTION 'User role does not have permission to access accounting settings';
  END IF;

  -- Get the read-only setting from company_expansions
  SELECT COALESCE(accounting_api_read_only, false) INTO v_read_only
  FROM company_expansions
  WHERE company_id = v_company_id;

  -- Default to read-only if not set
  RETURN COALESCE(v_read_only, true);
END;
$$;


ALTER FUNCTION "public"."get_accounting_read_only"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_accounting_read_only"() IS 'Returns the read-only setting for accounting API operations. Requires user to be authenticated and have role owner, employee, or super_user in the company.';



CREATE OR REPLACE FUNCTION "public"."get_conta_api_key"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_role TEXT;
  v_api_key BYTEA;
  v_api_key_base64 TEXT;
  v_is_superuser BOOLEAN;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the user's selected company from their profile
  SELECT selected_company_id INTO v_company_id
  FROM profiles
  WHERE user_id = v_user_id;

  -- Verify the selected company exists and user is a member
  -- If selected_company_id is NULL or user is not a member, find a company they ARE a member of
  IF v_company_id IS NOT NULL THEN
    -- Check if user is actually a member of the selected company
    SELECT role INTO v_role
    FROM company_users
    WHERE user_id = v_user_id
      AND company_id = v_company_id;
    
    -- If not a member of selected company, reset to NULL to find a valid company
    IF v_role IS NULL THEN
      v_company_id := NULL;
      v_role := NULL;
    END IF;
  END IF;

  -- If no valid company found yet, get the first company they're a member of with allowed role
  IF v_company_id IS NULL THEN
    SELECT company_id, role INTO v_company_id, v_role
    FROM company_users
    WHERE user_id = v_user_id
      AND role IN ('owner', 'employee', 'super_user')
    ORDER BY 
      CASE role 
        WHEN 'owner' THEN 1
        WHEN 'super_user' THEN 2
        WHEN 'employee' THEN 3
      END
    LIMIT 1;
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any company with access permissions';
  END IF;

  -- Get the role if we don't have it yet (should already have it from above, but just in case)
  IF v_role IS NULL THEN
    SELECT role INTO v_role
    FROM company_users
    WHERE user_id = v_user_id
      AND company_id = v_company_id;
  END IF;

  -- Check if user is a global superuser (can access any company's API key)
  SELECT COALESCE(superuser, false) INTO v_is_superuser
  FROM profiles
  WHERE user_id = v_user_id;

  -- Allow access if:
  -- 1. User is a global superuser, OR
  -- 2. User has role 'owner', 'employee', or 'super_user' in the company
  IF v_is_superuser THEN
    -- Global superuser can access any company's API key
    NULL; -- Allow access
  ELSIF v_role IS NULL THEN
    -- User is not a member of the company and not a superuser
    RAISE EXCEPTION 'User is not a member of this company or does not have permission to access Conta API key';
  ELSIF v_role NOT IN ('owner', 'employee', 'super_user') THEN
    -- User is a member but doesn't have the right role
    RAISE EXCEPTION 'User role "%" does not have permission to access Conta API key. Required roles: owner, employee, or super_user', v_role;
  END IF;

  -- Get the encrypted API key from company_expansions (stored as BYTEA)
  SELECT accounting_api_key_encrypted INTO v_api_key
  FROM company_expansions
  WHERE company_id = v_company_id;

  IF v_api_key IS NULL THEN
    RAISE EXCEPTION 'No Conta API key configured for this company';
  END IF;

  -- Convert BYTEA back to base64 string for the decrypt function
  -- The column stores the base64 string as BYTEA (ASCII bytes of the base64 string)
  -- So we need to convert the bytes back to the original base64 TEXT string
  v_api_key_base64 := convert_from(v_api_key, 'UTF8');

  -- Decrypt and return the API key using the decrypt_api_key function
  RETURN decrypt_api_key(v_company_id, v_api_key_base64);
END;
$$;


ALTER FUNCTION "public"."get_conta_api_key"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_conta_api_key"() IS 'Returns the decrypted Conta API key for the current user''s company. Requires user to be authenticated and have role owner, employee, or super_user in the company.';



CREATE OR REPLACE FUNCTION "public"."handle_offer_acceptance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  previous_status public.job_status;
  job_title TEXT;
  project_lead_id UUID;
  creator_user_id UUID;
  new_matter_id UUID;
  status_metadata JSONB;
  accepted_by_name TEXT;
  accepted_phone TEXT;
BEGIN
  -- Only proceed when status transitions into accepted
  -- Fetch job details needed for subsequent updates
  SELECT status, title, project_lead_user_id
  INTO previous_status, job_title, project_lead_id
  FROM jobs
  WHERE id = NEW.job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Update job status to confirmed when needed
  IF previous_status IS DISTINCT FROM 'confirmed' THEN
    UPDATE jobs
    SET status = 'confirmed'
    WHERE id = NEW.job_id;
  END IF;

  -- Choose a creator user (prefer owner, then super_user, then employee, fallback to project lead)
  SELECT cu.user_id
  INTO creator_user_id
  FROM company_users cu
  WHERE cu.company_id = NEW.company_id
  ORDER BY
    CASE cu.role
      WHEN 'owner' THEN 1
      WHEN 'super_user' THEN 2
      WHEN 'employee' THEN 3
      WHEN 'freelancer' THEN 4
      ELSE 5
    END
  LIMIT 1;

  IF creator_user_id IS NULL THEN
    creator_user_id := project_lead_id;
  END IF;

  -- Prepare metadata for activity log
  status_metadata := jsonb_build_object(
    'job_id', NEW.job_id,
    'job_title', job_title,
    'previous_status', previous_status,
    'new_status', 'confirmed',
    'offer_id', NEW.id
  );

  -- Log activity for latest feed when we have a creator user
  IF creator_user_id IS NOT NULL THEN
    INSERT INTO activity_log (
      company_id,
      activity_type,
      created_by_user_id,
      title,
      metadata
    ) VALUES (
      NEW.company_id,
      'job_status_changed',
      creator_user_id,
      job_title,
      status_metadata
    );
  END IF;

  -- Send a matter to the project lead when available
  IF project_lead_id IS NOT NULL THEN
    accepted_by_name := coalesce(nullif(trim(NEW.accepted_by_name), ''), 'Customer');
    accepted_phone := coalesce(nullif(trim(NEW.accepted_by_phone), ''), NULL);

    INSERT INTO matters (
      company_id,
      created_by_user_id,
      matter_type,
      title,
      content,
      job_id,
      created_as_company,
      metadata
    ) VALUES (
      NEW.company_id,
      coalesce(creator_user_id, project_lead_id),
      'update',
      'Offer accepted: ' || coalesce(job_title, 'Untitled job'),
      CASE
        WHEN accepted_phone IS NULL THEN
          accepted_by_name || ' accepted the offer for "' || coalesce(job_title, 'Untitled job') || '".'
        ELSE
          accepted_by_name || ' accepted the offer for "' || coalesce(job_title, 'Untitled job') || '". Contact phone: ' || accepted_phone || '.'
      END,
      NEW.job_id,
      TRUE,
      jsonb_build_object(
        'offer_id', NEW.id,
        'offer_version', NEW.version_number,
        'accepted_at', NEW.accepted_at,
        'accepted_by_name', NEW.accepted_by_name,
        'accepted_by_phone', NEW.accepted_by_phone
      )
    )
    RETURNING id INTO new_matter_id;

    INSERT INTO matter_recipients (
      matter_id,
      user_id,
      status
    ) VALUES (
      new_matter_id,
      project_lead_id,
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_offer_acceptance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."item_available_qty"("p_company_id" "uuid", "p_item_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) RETURNS integer
    LANGUAGE "sql" STABLE
    AS $$WITH overlapping AS (
    SELECT COALESCE(SUM(ri.quantity), 0) AS reserved
    FROM public.reserved_items ri
    JOIN public.time_periods r ON r.id = ri.time_period_id
    WHERE r.company_id = p_company_id
      AND ri.item_id   = p_item_id
      -- overlap: [start,end) vs [start,end)
      AND r.start_at < p_ends_at
      AND r.end_at   > p_starts_at
  )
  SELECT i.total_quantity - o.reserved
  FROM public.items i
  CROSS JOIN overlapping o
  WHERE i.company_id = p_company_id
    AND i.id = p_item_id;$$;


ALTER FUNCTION "public"."item_available_qty"("p_company_id" "uuid", "p_item_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_email"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.email is not null then
    new.email := lower(new.email);
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."normalize_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_activity_creator"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  activity_creator_id UUID;
  activity_company_id UUID;
  activity_title TEXT;
  activity_metadata JSONB;
  actor_user_id UUID;
  notification_type TEXT;
  matter_title TEXT;
  matter_content TEXT;
  new_matter_id UUID;
  actor_display_name TEXT;
BEGIN
  -- Determine the actor (person who liked/commented) and notification type
  IF TG_TABLE_NAME = 'activity_likes' THEN
    actor_user_id := NEW.user_id;
    notification_type := 'like';
  ELSIF TG_TABLE_NAME = 'activity_comments' THEN
    actor_user_id := NEW.created_by_user_id;
    notification_type := 'comment';
  ELSE
    RETURN NEW;
  END IF;

  -- Get activity details
  SELECT 
    created_by_user_id,
    company_id,
    title,
    metadata
  INTO 
    activity_creator_id,
    activity_company_id,
    activity_title,
    activity_metadata
  FROM activity_log
  WHERE id = NEW.activity_id
    AND deleted = false;

  -- If activity not found or creator is the same as actor, don't create notification
  IF activity_creator_id IS NULL OR activity_creator_id = actor_user_id THEN
    RETURN NEW;
  END IF;

  -- Get actor's display name for the notification
  SELECT display_name INTO actor_display_name
  FROM profiles
  WHERE user_id = actor_user_id;
  
  -- Build notification title and content
  IF notification_type = 'like' THEN
    matter_title := COALESCE(actor_display_name, 'Someone') || ' liked your update';
    matter_content := 'Your latest update "' || COALESCE(activity_title, 'Untitled') || '" received a like.';
  ELSE -- comment
    matter_title := COALESCE(actor_display_name, 'Someone') || ' commented on your update';
    matter_content := 'Your latest update "' || COALESCE(activity_title, 'Untitled') || '" received a comment.';
  END IF;

  -- Create the matter
  INSERT INTO matters (
    company_id,
    created_by_user_id,
    matter_type,
    title,
    content,
    metadata
  ) VALUES (
    activity_company_id,
    actor_user_id, -- The person who liked/commented is the "creator" of the notification
    'update',
    matter_title,
    matter_content,
    jsonb_build_object(
      'activity_id', NEW.activity_id,
      'notification_type', notification_type,
      'activity_title', activity_title
    )
  )
  RETURNING id INTO new_matter_id;

  -- Create matter recipient for the activity creator
  INSERT INTO matter_recipients (
    matter_id,
    user_id,
    status
  ) VALUES (
    new_matter_id,
    activity_creator_id,
    'pending'
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_activity_creator"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reservations_kind_job_check"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.kind = 'job' AND NEW.job_id IS NULL THEN
    RAISE EXCEPTION 'job reservations must reference a job_id';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."reservations_kind_job_check"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_company_user_role"("p_company_id" "uuid", "p_target_user_id" "uuid", "p_new_role" "public"."company_role", "p_actor_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_role public.company_role;
  v_target_old_role public.company_role;
  v_owner_count integer;
begin
  -- Ensure actor belongs to the company and is allowed
  select role into v_actor_role
  from public.company_users
  where company_id = p_company_id
    and user_id = p_actor_user_id;

  if v_actor_role is null then
    raise exception 'not_in_company' using hint = 'Actor must be in company.';
  end if;

  if v_actor_role not in ('owner','super_user') then
    raise exception 'insufficient_privileges' using hint = 'Only owners/super users can change roles.';
  end if;

  -- Current target role?
  select role into v_target_old_role
  from public.company_users
  where company_id = p_company_id
    and user_id = p_target_user_id;

  if v_target_old_role is null then
    raise exception 'target_not_found' using hint = 'Target user is not in company.';
  end if;

  -- Prevent removing the last owner
  if v_target_old_role = 'owner' and p_new_role <> 'owner' then
    select count(*) into v_owner_count
    from public.company_users
    where company_id = p_company_id
      and role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'last_owner_guard' using hint = 'Company must have at least one owner.';
    end if;
  end if;

  update public.company_users
  set role = p_new_role
  where company_id = p_company_id
    and user_id = p_target_user_id;

  return jsonb_build_object('type','ok');
end;
$$;


ALTER FUNCTION "public"."set_company_user_role"("p_company_id" "uuid", "p_target_user_id" "uuid", "p_new_role" "public"."company_role", "p_actor_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_from_auth"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_sqlstate text;
  v_message  text;
  v_detail   text;
  v_hint     text;
  v_context  text;
begin
  begin
    perform public.ensure_profile_for_user(new.id);
  exception
    when others then
      -- capture diagnostics correctly
      get stacked diagnostics
        v_sqlstate = returned_sqlstate,
        v_message  = message_text,
        v_detail   = pg_exception_detail,
        v_hint     = pg_exception_hint,
        v_context  = pg_exception_context;

      insert into public.dev_auth_logs(where_hint, user_id, sqlstate, message, detail, hint, context)
      values ('sync_profile_from_auth', new.id, v_sqlstate, v_message, v_detail, v_hint, v_context);

      -- swallow so signup never 500s
  end;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_profile_from_auth"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_reserved_items_enforce"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_allow boolean;
BEGIN
  IF NEW.source_kind = 'group' AND NEW.source_group_id IS NULL THEN
    RAISE EXCEPTION
      USING ERRCODE = '23514', -- check_violation
            MESSAGE = 'source_group_id must be set when source_kind = ''group''';
  END IF;

  IF NEW.source_kind = 'direct' THEN
    SELECT i.allow_individual_booking INTO v_allow
    FROM public.items i
    WHERE i.id = NEW.item_id;

    IF v_allow IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION
        USING ERRCODE = '23514', -- check_violation
              MESSAGE = 'Item does not allow individual booking (source_kind = ''direct'')';
    END IF;
  END IF;

  RETURN NEW;
END $$;


ALTER FUNCTION "public"."trg_reserved_items_enforce"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_activity_comments_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_activity_comments_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_company_expansions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_company_expansions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_job_invoices_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_job_invoices_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_job_offers_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_job_offers_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_my_avatar"("p_path" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE public.profiles
     SET avatar_url = NULLIF(p_path, '')
   WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."update_my_avatar"("p_path" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "first_name" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "locale" "text" DEFAULT 'en'::"text",
    "timezone" "text",
    "bio" "text",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "superuser" boolean DEFAULT false NOT NULL,
    "last_name" "text",
    "selected_company_id" "uuid",
    "primary_address_id" "uuid"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."selected_company_id" IS 'last selected company to display';



CREATE OR REPLACE FUNCTION "public"."update_my_profile"("p_display_name" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_avatar_path" "text", "p_preferences" "jsonb") RETURNS "public"."profiles"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE public.profiles
     SET display_name = NULLIF(p_display_name, ''),
         first_name   = NULLIF(p_first_name, ''),
         last_name    = NULLIF(p_last_name, ''),
         phone        = NULLIF(p_phone, ''),
         bio          = NULLIF(p_bio, ''),
         avatar_url   = NULLIF(p_avatar_path, ''),
         preferences  = COALESCE(p_preferences, '{}'::jsonb)
   WHERE user_id = auth.uid()
   RETURNING *;
$$;


ALTER FUNCTION "public"."update_my_profile"("p_display_name" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_avatar_path" "text", "p_preferences" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "created_by_user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."activity_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "activity_type" "public"."activity_type" NOT NULL,
    "created_by_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "title" "text",
    "description" "text",
    "deleted" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "name" "text",
    "address_line" "text" NOT NULL,
    "zip_code" "text" NOT NULL,
    "city" "text" NOT NULL,
    "country" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted" boolean DEFAULT false NOT NULL,
    "is_personal" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "address" "text",
    "vat_number" "text",
    "general_email" "text",
    "contact_person_id" "uuid",
    "accent_color" "text",
    "job_number_counter" integer DEFAULT 0,
    "theme_radius" "text" DEFAULT 'small'::"text",
    "theme_gray_color" "text" DEFAULT 'gray'::"text",
    "theme_panel_background" "text" DEFAULT 'solid'::"text",
    "theme_scaling" "text" DEFAULT '100%'::"text",
    "terms_and_conditions_type" "text",
    "terms_and_conditions_text" "text",
    "terms_and_conditions_pdf_path" "text",
    "logo_path" "text",
    "logo_light_path" "text",
    "logo_dark_path" "text",
    CONSTRAINT "companies_accent_color_check" CHECK (("accent_color" = ANY (ARRAY['gray'::"text", 'gold'::"text", 'bronze'::"text", 'brown'::"text", 'yellow'::"text", 'amber'::"text", 'orange'::"text", 'tomato'::"text", 'red'::"text", 'ruby'::"text", 'pink'::"text", 'plum'::"text", 'purple'::"text", 'violet'::"text", 'iris'::"text", 'indigo'::"text", 'blue'::"text", 'cyan'::"text", 'teal'::"text", 'jade'::"text", 'green'::"text", 'grass'::"text", 'mint'::"text", 'lime'::"text", 'sky'::"text"]))),
    CONSTRAINT "companies_terms_and_conditions_type_check" CHECK ((("terms_and_conditions_type" IS NULL) OR ("terms_and_conditions_type" = ANY (ARRAY['pdf'::"text", 'text'::"text"])))),
    CONSTRAINT "companies_theme_gray_color_check" CHECK ((("theme_gray_color" IS NULL) OR ("theme_gray_color" = ANY (ARRAY['gray'::"text", 'mauve'::"text", 'slate'::"text", 'sage'::"text", 'olive'::"text", 'sand'::"text"])))),
    CONSTRAINT "companies_theme_panel_background_check" CHECK ((("theme_panel_background" IS NULL) OR ("theme_panel_background" = ANY (ARRAY['solid'::"text", 'translucent'::"text"])))),
    CONSTRAINT "companies_theme_radius_check" CHECK ((("theme_radius" IS NULL) OR ("theme_radius" = ANY (ARRAY['none'::"text", 'small'::"text", 'medium'::"text", 'large'::"text", 'full'::"text"])))),
    CONSTRAINT "companies_theme_scaling_check" CHECK ((("theme_scaling" IS NULL) OR ("theme_scaling" = ANY (ARRAY['90%'::"text", '95%'::"text", '100%'::"text", '105%'::"text", '110%'::"text"]))))
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


COMMENT ON COLUMN "public"."companies"."accent_color" IS 'Radix UI theme accent color preference for the company. Defaults to indigo if not set.';



CREATE TABLE IF NOT EXISTS "public"."company_expansions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "accounting_software" "text",
    "accounting_api_key_encrypted" "bytea",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "latest_feed_open_to_freelancers" boolean DEFAULT false NOT NULL,
    "accounting_api_read_only" boolean DEFAULT true NOT NULL,
    "accounting_organization_id" "text",
    "crew_rate_per_day" numeric(10,2),
    "crew_rate_per_hour" numeric(10,2),
    "customer_discount_percent" numeric(5,2),
    "partner_discount_percent" numeric(5,2),
    "rental_factor_config" "jsonb",
    "fixed_rate_start_day" integer,
    "fixed_rate_per_day" numeric(3,2),
    "vehicle_daily_rate" numeric(10,2),
    "vehicle_distance_rate" numeric(10,2),
    "vehicle_distance_increment" integer DEFAULT 150,
    CONSTRAINT "check_crew_rate_per_day" CHECK ((("crew_rate_per_day" IS NULL) OR ("crew_rate_per_day" >= (0)::numeric))),
    CONSTRAINT "check_crew_rate_per_hour" CHECK ((("crew_rate_per_hour" IS NULL) OR ("crew_rate_per_hour" >= (0)::numeric))),
    CONSTRAINT "check_customer_discount" CHECK ((("customer_discount_percent" IS NULL) OR (("customer_discount_percent" >= (0)::numeric) AND ("customer_discount_percent" <= (100)::numeric)))),
    CONSTRAINT "check_fixed_rate_per_day" CHECK ((("fixed_rate_per_day" IS NULL) OR (("fixed_rate_per_day" >= (0)::numeric) AND ("fixed_rate_per_day" <= (1)::numeric)))),
    CONSTRAINT "check_fixed_rate_start_day" CHECK ((("fixed_rate_start_day" IS NULL) OR ("fixed_rate_start_day" >= 1))),
    CONSTRAINT "check_partner_discount" CHECK ((("partner_discount_percent" IS NULL) OR (("partner_discount_percent" >= (0)::numeric) AND ("partner_discount_percent" <= (100)::numeric)))),
    CONSTRAINT "check_vehicle_daily_rate" CHECK ((("vehicle_daily_rate" IS NULL) OR ("vehicle_daily_rate" >= (0)::numeric))),
    CONSTRAINT "check_vehicle_distance_increment" CHECK ((("vehicle_distance_increment" IS NULL) OR ("vehicle_distance_increment" > 0))),
    CONSTRAINT "check_vehicle_distance_rate" CHECK ((("vehicle_distance_rate" IS NULL) OR ("vehicle_distance_rate" >= (0)::numeric))),
    CONSTRAINT "company_expansions_accounting_software_check" CHECK (("accounting_software" = ANY (ARRAY['none'::"text", 'conta'::"text"])))
);


ALTER TABLE "public"."company_expansions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."company_expansions"."accounting_api_read_only" IS 'When true, API calls will be restricted to read-only operations. When false, all operations (GET, POST, PUT, DELETE) are allowed.';



COMMENT ON COLUMN "public"."company_expansions"."accounting_organization_id" IS 'Organization ID for the accounting system (e.g., Conta opContextOrgId). Required for API calls to accounting endpoints.';



COMMENT ON COLUMN "public"."company_expansions"."crew_rate_per_day" IS 'Standard daily rate for crew members in technical offers';



COMMENT ON COLUMN "public"."company_expansions"."crew_rate_per_hour" IS 'Standard hourly rate for crew members in technical offers';



COMMENT ON COLUMN "public"."company_expansions"."customer_discount_percent" IS 'Default discount percentage for regular customers (non-partners)';



COMMENT ON COLUMN "public"."company_expansions"."partner_discount_percent" IS 'Default discount percentage for partners';



COMMENT ON COLUMN "public"."company_expansions"."rental_factor_config" IS 'JSON object mapping days to rental factor multipliers (e.g., {"1": 1.0, "2": 1.6})';



COMMENT ON COLUMN "public"."company_expansions"."fixed_rate_start_day" IS 'Day number when fixed rate multiplier should start being applied';



COMMENT ON COLUMN "public"."company_expansions"."fixed_rate_per_day" IS 'Fixed rate multiplier (0-1) to apply after fixed_rate_start_day';



COMMENT ON COLUMN "public"."company_expansions"."vehicle_daily_rate" IS 'Fixed daily rate for vehicles in technical offers';



COMMENT ON COLUMN "public"."company_expansions"."vehicle_distance_rate" IS 'Rate per distance increment for vehicles in technical offers';



COMMENT ON COLUMN "public"."company_expansions"."vehicle_distance_increment" IS 'Distance increment in kilometers for calculating distance-based rates (default: 150)';



CREATE TABLE IF NOT EXISTS "public"."company_users" (
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."company_role" NOT NULL
);


ALTER TABLE "public"."company_users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."company_user_profiles" AS
 SELECT "cu"."company_id",
    "cu"."user_id",
    "cu"."role",
    "p"."email",
    "p"."display_name",
    "p"."first_name",
    "p"."last_name",
    "p"."phone",
    "p"."avatar_url",
    "p"."created_at"
   FROM ("public"."company_users" "cu"
     JOIN "public"."profiles" "p" ON (("p"."user_id" = "cu"."user_id")));


ALTER VIEW "public"."company_user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "title" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "company_text" "text"
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "vat_number" "text",
    "email" "text",
    "phone" "text",
    "address" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_partner" boolean DEFAULT false NOT NULL,
    "deleted" boolean DEFAULT false NOT NULL,
    "logo_path" "text"
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dev_auth_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "where_hint" "text",
    "user_id" "uuid",
    "sqlstate" "text",
    "message" "text",
    "detail" "text",
    "hint" "text",
    "context" "text"
);


ALTER TABLE "public"."dev_auth_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_price_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "effective_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "effective_to" timestamp with time zone,
    "set_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "group_price_history_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."group_price_history" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."group_current_price" AS
 SELECT DISTINCT ON ("group_id") "group_id",
    "amount" AS "current_price",
    "effective_from"
   FROM "public"."group_price_history"
  WHERE ("effective_to" IS NULL)
  ORDER BY "group_id", "effective_from" DESC;


ALTER VIEW "public"."group_current_price" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_items" (
    "group_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    CONSTRAINT "group_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."group_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category_id" "uuid",
    "brand_id" "uuid",
    "model" "text",
    "allow_individual_booking" boolean DEFAULT true NOT NULL,
    "total_quantity" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "deleted" boolean DEFAULT false NOT NULL,
    "internal_owner_company_id" "uuid",
    "external_owner_id" "uuid",
    "internally_owned" boolean DEFAULT true NOT NULL,
    CONSTRAINT "items_owner_chk" CHECK (((("internally_owned" = true) AND ("external_owner_id" IS NULL)) OR (("internally_owned" = false) AND ("external_owner_id" IS NOT NULL)))),
    CONSTRAINT "items_owner_oneof_chk" CHECK (((
CASE
    WHEN ("internal_owner_company_id" IS NOT NULL) THEN 1
    ELSE 0
END +
CASE
    WHEN ("external_owner_id" IS NOT NULL) THEN 1
    ELSE 0
END) = ANY (ARRAY[0, 1]))),
    CONSTRAINT "items_total_quantity_check" CHECK (("total_quantity" >= 0))
);


ALTER TABLE "public"."items" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."group_on_hand" AS
 WITH "per_part" AS (
         SELECT "gi"."group_id",
            ("floor"((("i"."total_quantity")::numeric / (NULLIF("gi"."quantity", 0))::numeric)))::integer AS "possible_sets"
           FROM ("public"."group_items" "gi"
             JOIN "public"."items" "i" ON (("i"."id" = "gi"."item_id")))
        )
 SELECT "group_id",
    COALESCE("min"("possible_sets"), 0) AS "on_hand"
   FROM "per_part"
  GROUP BY "group_id";


ALTER VIEW "public"."group_on_hand" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_price_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "effective_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "effective_to" timestamp with time zone,
    "set_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "item_price_history_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."item_price_history" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."item_current_price" AS
 SELECT DISTINCT ON ("item_id") "item_id",
    "amount" AS "current_price",
    "effective_from"
   FROM "public"."item_price_history"
  WHERE ("effective_to" IS NULL)
  ORDER BY "item_id", "effective_from" DESC;


ALTER VIEW "public"."item_current_price" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."group_parts" AS
 SELECT "gi"."group_id",
    "gi"."item_id",
    "i"."name" AS "item_name",
    "gi"."quantity",
    "icp"."current_price" AS "item_current_price"
   FROM (("public"."group_items" "gi"
     JOIN "public"."items" "i" ON (("i"."id" = "gi"."item_id")))
     LEFT JOIN "public"."item_current_price" "icp" ON (("icp"."item_id" = "gi"."item_id")));


ALTER VIEW "public"."group_parts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."group_price_history_with_profile" AS
 SELECT "gph"."id",
    "gph"."company_id",
    "gph"."group_id",
    "gph"."amount",
    "gph"."effective_from",
    "gph"."effective_to",
    "gph"."set_by",
    COALESCE("p"."display_name", "p"."email") AS "set_by_name"
   FROM ("public"."group_price_history" "gph"
     LEFT JOIN "public"."profiles" "p" ON (("p"."user_id" = "gph"."set_by")));


ALTER VIEW "public"."group_price_history_with_profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true NOT NULL,
    "category_id" "uuid",
    "deleted" boolean DEFAULT false NOT NULL,
    "unique" boolean DEFAULT false NOT NULL,
    "internally_owned" boolean DEFAULT true NOT NULL,
    "external_owner_id" "uuid",
    CONSTRAINT "item_groups_owner_chk" CHECK (((("internally_owned" = true) AND ("external_owner_id" IS NULL)) OR (("internally_owned" = false) AND ("external_owner_id" IS NOT NULL))))
);


ALTER TABLE "public"."item_groups" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."groups_with_rollups" WITH ("security_invoker"='on') AS
 WITH "parts" AS (
         SELECT "gi"."group_id",
            "gi"."quantity",
            "i"."total_quantity",
            "icp"."current_price"
           FROM (("public"."group_items" "gi"
             JOIN "public"."items" "i" ON (("i"."id" = "gi"."item_id")))
             LEFT JOIN "public"."item_current_price" "icp" ON (("icp"."item_id" = "i"."id")))
        ), "agg" AS (
         SELECT "p"."group_id",
            COALESCE(("min"("floor"(((COALESCE("p"."total_quantity", 0))::numeric / (NULLIF("p"."quantity", 0))::numeric))))::integer, 0) AS "on_hand",
            "sum"((COALESCE("p"."current_price", (0)::numeric) * ("p"."quantity")::numeric)) AS "parts_value"
           FROM "parts" "p"
          GROUP BY "p"."group_id"
        )
 SELECT "g"."id",
    "g"."company_id",
    "g"."name",
    COALESCE("a"."on_hand", 0) AS "on_hand",
    COALESCE("gcp"."current_price", "a"."parts_value") AS "current_price",
    'NOK'::"text" AS "currency"
   FROM (("public"."item_groups" "g"
     LEFT JOIN "agg" "a" ON (("a"."group_id" = "g"."id")))
     LEFT JOIN "public"."group_current_price" "gcp" ON (("gcp"."group_id" = "g"."id")));


ALTER VIEW "public"."groups_with_rollups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "url" "text"
);


ALTER TABLE "public"."item_brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."item_categories" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."inventory_index" AS
 SELECT "i"."company_id",
    "i"."id",
    "i"."name",
    "ic"."name" AS "category_name",
    "ib"."name" AS "brand_name",
    "i"."total_quantity" AS "on_hand",
    "icp"."current_price",
    'NOK'::"text" AS "currency",
    false AS "is_group",
    NULL::boolean AS "unique",
    "i"."allow_individual_booking",
    "i"."active",
    "i"."deleted",
    "i"."internally_owned",
    "i"."external_owner_id",
    "co"."name" AS "external_owner_name"
   FROM (((("public"."items" "i"
     LEFT JOIN "public"."item_categories" "ic" ON (("ic"."id" = "i"."category_id")))
     LEFT JOIN "public"."item_brands" "ib" ON (("ib"."id" = "i"."brand_id")))
     LEFT JOIN "public"."item_current_price" "icp" ON (("icp"."item_id" = "i"."id")))
     LEFT JOIN "public"."customers" "co" ON (("co"."id" = "i"."external_owner_id")))
UNION ALL
 SELECT "g"."company_id",
    "g"."id",
    "g"."name",
    "ic2"."name" AS "category_name",
    NULL::"text" AS "brand_name",
    "gr"."on_hand",
    "gcp"."current_price",
    'NOK'::"text" AS "currency",
    true AS "is_group",
    "g"."unique",
    true AS "allow_individual_booking",
    "g"."active",
    "g"."deleted",
    "g"."internally_owned",
    "g"."external_owner_id",
    "co2"."name" AS "external_owner_name"
   FROM (((("public"."item_groups" "g"
     LEFT JOIN "public"."item_categories" "ic2" ON (("ic2"."id" = "g"."category_id")))
     LEFT JOIN "public"."groups_with_rollups" "gr" ON (("gr"."id" = "g"."id")))
     LEFT JOIN "public"."group_current_price" "gcp" ON (("gcp"."group_id" = "g"."id")))
     LEFT JOIN "public"."customers" "co2" ON (("co2"."id" = "g"."external_owner_id")));


ALTER VIEW "public"."inventory_index" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."item_index_ext" AS
 SELECT "i"."id",
    "i"."company_id",
    "i"."name",
    "i"."category_id",
    "i"."brand_id",
    "i"."model",
    "i"."allow_individual_booking",
    "i"."total_quantity",
    "i"."active",
    "i"."notes",
    "i"."deleted",
    "i"."internal_owner_company_id",
    "i"."external_owner_id",
    ("i"."external_owner_id" IS NOT NULL) AS "is_external",
    COALESCE("fc"."name", "c"."name") AS "owner_name"
   FROM (("public"."items" "i"
     LEFT JOIN "public"."customers" "fc" ON (("fc"."id" = "i"."external_owner_id")))
     LEFT JOIN "public"."companies" "c" ON (("c"."id" = "i"."internal_owner_company_id")));


ALTER VIEW "public"."item_index_ext" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."item_price_history_with_profile" AS
 SELECT "iph"."id",
    "iph"."company_id",
    "iph"."item_id",
    "iph"."amount",
    "iph"."effective_from",
    "iph"."effective_to",
    "iph"."set_by",
    COALESCE("p"."display_name", "p"."email") AS "set_by_name"
   FROM ("public"."item_price_history" "iph"
     LEFT JOIN "public"."profiles" "p" ON (("p"."user_id" = "iph"."set_by")));


ALTER VIEW "public"."item_price_history_with_profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_related" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_a_id" "uuid" NOT NULL,
    "item_b_id" "uuid" NOT NULL
);


ALTER TABLE "public"."item_related" OWNER TO "postgres";


COMMENT ON TABLE "public"."item_related" IS 'table referencing related items. example: mixer <-> stagerack';



CREATE OR REPLACE VIEW "public"."items_with_price" WITH ("security_invoker"='on') AS
 SELECT "i"."id",
    "i"."company_id",
    "i"."name",
    "ic"."name" AS "category_name",
    "i"."total_quantity",
    "icp"."current_price"
   FROM (("public"."items" "i"
     LEFT JOIN "public"."item_categories" "ic" ON ((("ic"."id" = "i"."category_id") AND ("ic"."company_id" = "i"."company_id"))))
     LEFT JOIN "public"."item_current_price" "icp" ON (("icp"."item_id" = "i"."id")));


ALTER VIEW "public"."items_with_price" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_contacts" (
    "job_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "role" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."job_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "uploaded_by_user_id" "uuid",
    "path" "text" NOT NULL,
    "filename" "text",
    "mime_type" "text",
    "size_bytes" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text",
    "note" "text"
);


ALTER TABLE "public"."job_files" OWNER TO "postgres";


COMMENT ON COLUMN "public"."job_files"."title" IS 'User-friendly title for the file';



COMMENT ON COLUMN "public"."job_files"."note" IS 'Optional notes or description about the file';



CREATE TABLE IF NOT EXISTS "public"."job_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "offer_id" "uuid",
    "organization_id" "text" NOT NULL,
    "conta_invoice_id" "text",
    "conta_customer_id" integer,
    "invoice_basis" "text" NOT NULL,
    "invoice_data" "jsonb" NOT NULL,
    "conta_response" "jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "created_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_invoices_invoice_basis_check" CHECK (("invoice_basis" = ANY (ARRAY['offer'::"text", 'bookings'::"text"]))),
    CONSTRAINT "job_invoices_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'created'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."job_invoices" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_invoices" IS 'Tracks invoices created via Conta API integration';



COMMENT ON COLUMN "public"."job_invoices"."conta_invoice_id" IS 'Invoice ID returned from Conta (if available)';



COMMENT ON COLUMN "public"."job_invoices"."invoice_data" IS 'Full invoice payload sent to Conta API';



COMMENT ON COLUMN "public"."job_invoices"."conta_response" IS 'Full response received from Conta API';



CREATE TABLE IF NOT EXISTS "public"."job_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "author_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL
);


ALTER TABLE "public"."job_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "offer_type" "public"."offer_type" NOT NULL,
    "version_number" integer DEFAULT 1 NOT NULL,
    "status" "public"."offer_status" DEFAULT 'draft'::"public"."offer_status" NOT NULL,
    "access_token" "text" NOT NULL,
    "title" "text" NOT NULL,
    "days_of_use" integer DEFAULT 1 NOT NULL,
    "discount_percent" numeric(5,2) DEFAULT 0 NOT NULL,
    "vat_percent" integer DEFAULT 25 NOT NULL,
    "equipment_subtotal" numeric(10,2) DEFAULT 0 NOT NULL,
    "crew_subtotal" numeric(10,2) DEFAULT 0 NOT NULL,
    "transport_subtotal" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_before_discount" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_after_discount" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_with_vat" numeric(10,2) DEFAULT 0 NOT NULL,
    "based_on_offer_id" "uuid",
    "locked" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "viewed_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "accepted_by_name" "text",
    "accepted_by_email" "text",
    "accepted_by_phone" "text",
    "show_price_per_line" boolean DEFAULT true NOT NULL,
    "rejected_at" timestamp with time zone,
    "rejected_by_name" "text",
    "rejected_by_phone" "text",
    "rejection_comment" "text",
    "revision_requested_at" timestamp with time zone,
    "revision_requested_by_name" "text",
    "revision_requested_by_phone" "text",
    "revision_comment" "text",
    CONSTRAINT "job_offers_discount_percent_check" CHECK ((("discount_percent" >= (0)::numeric) AND ("discount_percent" <= (100)::numeric))),
    CONSTRAINT "job_offers_vat_percent_check" CHECK (("vat_percent" = ANY (ARRAY[0, 25])))
);


ALTER TABLE "public"."job_offers" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_offers" IS 'Technical and pretty offers for jobs. Supports versioning, public access via tokens, and customer acceptance.';



COMMENT ON COLUMN "public"."job_offers"."show_price_per_line" IS 'If true, show price per line item to customer. If false, only show total at bottom of each group.';



COMMENT ON COLUMN "public"."job_offers"."rejected_at" IS 'Timestamp when offer was rejected';



COMMENT ON COLUMN "public"."job_offers"."rejected_by_name" IS 'Full name of person who rejected the offer';



COMMENT ON COLUMN "public"."job_offers"."rejected_by_phone" IS 'Phone number of person who rejected the offer';



COMMENT ON COLUMN "public"."job_offers"."rejection_comment" IS 'Optional comment explaining why the offer was rejected';



COMMENT ON COLUMN "public"."job_offers"."revision_requested_at" IS 'Timestamp when revision was requested';



COMMENT ON COLUMN "public"."job_offers"."revision_requested_by_name" IS 'Full name of person requesting revision';



COMMENT ON COLUMN "public"."job_offers"."revision_requested_by_phone" IS 'Phone number of person requesting revision';



COMMENT ON COLUMN "public"."job_offers"."revision_comment" IS 'Comment explaining what changes are requested';



CREATE TABLE IF NOT EXISTS "public"."job_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "status" "public"."job_status" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "set_by" "uuid"
);


ALTER TABLE "public"."job_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "public"."job_status" NOT NULL,
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "project_lead_user_id" "uuid",
    "customer_id" "uuid",
    "customer_contact_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "job_address_id" "uuid",
    "jobnr" integer,
    "customer_user_id" "uuid"
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."jobs"."customer_user_id" IS 'Optional reference to a user in the company who is the customer for this job';



CREATE TABLE IF NOT EXISTS "public"."matter_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "matter_id" "uuid" NOT NULL,
    "filename" "text" NOT NULL,
    "path" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" bigint,
    "title" "text",
    "note" "text",
    "uploaded_by_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."matter_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matter_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "matter_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."matter_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matter_recipients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "matter_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "public"."matter_recipient_status" DEFAULT 'pending'::"public"."matter_recipient_status" NOT NULL,
    "viewed_at" timestamp with time zone,
    "responded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."matter_recipients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matter_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "matter_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "response" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."matter_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "created_by_user_id" "uuid" NOT NULL,
    "matter_type" "public"."matter_type" DEFAULT 'announcement'::"public"."matter_type" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "job_id" "uuid",
    "time_period_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    "allow_custom_responses" boolean DEFAULT true NOT NULL,
    "created_as_company" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb"
);


ALTER TABLE "public"."matters" OWNER TO "postgres";


COMMENT ON COLUMN "public"."matters"."created_as_company" IS 'When true, the matter was created on behalf of the company and should display the company name instead of the creator''s name';



CREATE TABLE IF NOT EXISTS "public"."offer_crew_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "offer_id" "uuid" NOT NULL,
    "role_title" "text" NOT NULL,
    "crew_count" integer DEFAULT 1 NOT NULL,
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone NOT NULL,
    "daily_rate" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "chk_offer_crew_items_dates" CHECK (("end_date" > "start_date")),
    CONSTRAINT "offer_crew_items_crew_count_check" CHECK (("crew_count" > 0))
);


ALTER TABLE "public"."offer_crew_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."offer_crew_items" IS 'Crew roles and staffing requirements in offers.';



CREATE TABLE IF NOT EXISTS "public"."offer_equipment_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "offer_id" "uuid" NOT NULL,
    "group_name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."offer_equipment_groups" OWNER TO "postgres";


COMMENT ON TABLE "public"."offer_equipment_groups" IS 'Groups for organizing equipment in offers (e.g., Audio, Lights, AV, Rigging).';



CREATE TABLE IF NOT EXISTS "public"."offer_equipment_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "offer_group_id" "uuid" NOT NULL,
    "item_id" "uuid",
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "is_internal" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "offer_equipment_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."offer_equipment_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."offer_equipment_items" IS 'Equipment items included in offers with locked prices.';



CREATE TABLE IF NOT EXISTS "public"."offer_pretty_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "offer_id" "uuid" NOT NULL,
    "section_type" "public"."pretty_section_type" NOT NULL,
    "title" "text",
    "content" "text",
    "image_url" "text",
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."offer_pretty_sections" OWNER TO "postgres";


COMMENT ON TABLE "public"."offer_pretty_sections" IS 'Rich content sections for pretty offers (hero, problem statement, solution, benefits, testimonials).';



CREATE TABLE IF NOT EXISTS "public"."offer_transport_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "offer_id" "uuid" NOT NULL,
    "vehicle_name" "text" NOT NULL,
    "vehicle_id" "uuid",
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone NOT NULL,
    "daily_rate" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "is_internal" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "vehicle_category" "public"."vehicle_category",
    "distance_km" numeric(10,2),
    CONSTRAINT "chk_offer_transport_items_dates" CHECK (("end_date" > "start_date"))
);


ALTER TABLE "public"."offer_transport_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."offer_transport_items" IS 'Transportation requirements in offers (vehicles and logistics).';



COMMENT ON COLUMN "public"."offer_transport_items"."vehicle_category" IS 'Category of vehicle needed for this offer item';



COMMENT ON COLUMN "public"."offer_transport_items"."distance_km" IS 'Approximate distance in kilometers for this transport item';



CREATE TABLE IF NOT EXISTS "public"."pending_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "inviter_user_id" "uuid" NOT NULL,
    "email" "public"."citext" NOT NULL,
    "role" "public"."company_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL
);


ALTER TABLE "public"."pending_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reserved_crew" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "time_period_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "public"."crew_request_status" DEFAULT 'planned'::"public"."crew_request_status" NOT NULL,
    "requested_at" timestamp with time zone,
    "during" "tstzrange"
);


ALTER TABLE "public"."reserved_crew" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reserved_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "time_period_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "source_group_id" "uuid",
    "source_kind" "public"."reservation_source_kind" DEFAULT 'direct'::"public"."reservation_source_kind" NOT NULL,
    "external_status" "public"."external_request_status",
    "external_note" "text",
    "forced" boolean DEFAULT false NOT NULL,
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    CONSTRAINT "reserved_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."reserved_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reserved_vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "time_period_id" "uuid" NOT NULL,
    "vehicle_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "external_status" "public"."external_request_status",
    "external_note" "text",
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "during" "tstzrange"
);


ALTER TABLE "public"."reserved_vehicles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "reserved_by_user_id" "uuid",
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "title" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "updated_by_user_id" "uuid",
    "deleted" boolean DEFAULT false NOT NULL,
    "during" "tstzrange" GENERATED ALWAYS AS ("tstzrange"("start_at", "end_at", '[)'::"text")) STORED,
    "role_category" "text",
    "needed_count" smallint,
    "category" "public"."time_period_category" DEFAULT 'program'::"public"."time_period_category" NOT NULL
);


ALTER TABLE "public"."time_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "registration_no" "text",
    "active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted" boolean DEFAULT false NOT NULL,
    "image_path" "text",
    "external_owner_id" "uuid",
    "fuel" "public"."fuel",
    "internally_owned" boolean DEFAULT true NOT NULL,
    "vehicle_category" "public"."vehicle_category"
);


ALTER TABLE "public"."vehicles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vehicle_detail" AS
 SELECT "v"."id",
    "v"."company_id",
    "v"."name",
    "v"."registration_no",
    "v"."fuel",
    "v"."active",
    "v"."deleted",
    "v"."notes",
    "v"."image_path",
    "v"."internally_owned",
    "v"."external_owner_id",
        CASE
            WHEN "v"."internally_owned" THEN 'internal'::"text"
            ELSE 'external'::"text"
        END AS "owner_kind",
        CASE
            WHEN "v"."internally_owned" THEN "comp"."name"
            ELSE "cust"."name"
        END AS "owner_name",
        CASE
            WHEN "v"."internally_owned" THEN NULL::boolean
            ELSE "cust"."is_partner"
        END AS "external_owner_is_partner",
        CASE
            WHEN "v"."internally_owned" THEN NULL::"text"
            ELSE "cust"."email"
        END AS "external_owner_email",
        CASE
            WHEN "v"."internally_owned" THEN NULL::"text"
            ELSE "cust"."phone"
        END AS "external_owner_phone",
    "v"."created_at",
    "next_res"."reservation_id" AS "next_reservation_id",
    "next_res"."start_at" AS "next_reservation_start_at",
    "next_res"."end_at" AS "next_reservation_end_at",
    "next_res"."job_id" AS "next_reservation_job_id",
    "next_res"."title" AS "next_reservation_title"
   FROM ((("public"."vehicles" "v"
     JOIN "public"."companies" "comp" ON (("comp"."id" = "v"."company_id")))
     LEFT JOIN "public"."customers" "cust" ON (("cust"."id" = "v"."external_owner_id")))
     LEFT JOIN LATERAL ( SELECT "r"."id" AS "reservation_id",
            "r"."start_at",
            "r"."end_at",
            "r"."job_id",
            COALESCE("r"."title", 'Reservation'::"text") AS "title"
           FROM ("public"."time_periods" "r"
             JOIN "public"."reserved_vehicles" "rv" ON (("rv"."time_period_id" = "r"."id")))
          WHERE (("rv"."vehicle_id" = "v"."id") AND ("r"."company_id" = "v"."company_id") AND ("r"."end_at" > "now"()))
          ORDER BY "r"."start_at"
         LIMIT 1) "next_res" ON (true));


ALTER VIEW "public"."vehicle_detail" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vehicle_index" AS
 SELECT "v"."id",
    "v"."company_id",
    "v"."name",
    "v"."registration_no" AS "reg_number",
    "v"."image_path",
    "v"."fuel",
    "v"."internally_owned",
    "v"."external_owner_id",
    "c"."name" AS "external_owner_name",
    "v"."active",
    "v"."deleted",
    "v"."created_at"
   FROM ("public"."vehicles" "v"
     LEFT JOIN "public"."customers" "c" ON (("c"."id" = "v"."external_owner_id")));


ALTER VIEW "public"."vehicle_index" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."vehicle_index_mat" AS
 SELECT "v"."id",
    "v"."company_id",
    "v"."name",
    "v"."registration_no" AS "reg_number",
    "v"."image_path",
    "v"."fuel",
    "v"."internally_owned",
    "v"."external_owner_id",
    "c"."name" AS "external_owner_name",
    "v"."active",
    "v"."deleted",
    "v"."created_at"
   FROM ("public"."vehicles" "v"
     LEFT JOIN "public"."customers" "c" ON (("c"."id" = "v"."external_owner_id")))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."vehicle_index_mat" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_comments"
    ADD CONSTRAINT "activity_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_likes"
    ADD CONSTRAINT "activity_likes_activity_id_user_id_key" UNIQUE ("activity_id", "user_id");



ALTER TABLE ONLY "public"."activity_likes"
    ADD CONSTRAINT "activity_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_expansions"
    ADD CONSTRAINT "company_expansions_company_id_key" UNIQUE ("company_id");



ALTER TABLE ONLY "public"."company_expansions"
    ADD CONSTRAINT "company_expansions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_users"
    ADD CONSTRAINT "company_users_pkey" PRIMARY KEY ("company_id", "user_id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dev_auth_logs"
    ADD CONSTRAINT "dev_auth_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_items"
    ADD CONSTRAINT "group_items_pkey" PRIMARY KEY ("group_id", "item_id");



ALTER TABLE ONLY "public"."group_price_history"
    ADD CONSTRAINT "group_price_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_brands"
    ADD CONSTRAINT "item_brands_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."item_brands"
    ADD CONSTRAINT "item_brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_categories"
    ADD CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_groups"
    ADD CONSTRAINT "item_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_price_history"
    ADD CONSTRAINT "item_price_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_related"
    ADD CONSTRAINT "item_related_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_contacts"
    ADD CONSTRAINT "job_contacts_pkey" PRIMARY KEY ("job_id", "contact_id");



ALTER TABLE ONLY "public"."job_files"
    ADD CONSTRAINT "job_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_invoices"
    ADD CONSTRAINT "job_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_notes"
    ADD CONSTRAINT "job_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_offers"
    ADD CONSTRAINT "job_offers_access_token_key" UNIQUE ("access_token");



ALTER TABLE ONLY "public"."job_offers"
    ADD CONSTRAINT "job_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_status_history"
    ADD CONSTRAINT "job_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matter_files"
    ADD CONSTRAINT "matter_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matter_messages"
    ADD CONSTRAINT "matter_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matter_recipients"
    ADD CONSTRAINT "matter_recipients_matter_id_user_id_key" UNIQUE ("matter_id", "user_id");



ALTER TABLE ONLY "public"."matter_recipients"
    ADD CONSTRAINT "matter_recipients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matter_responses"
    ADD CONSTRAINT "matter_responses_matter_id_user_id_key" UNIQUE ("matter_id", "user_id");



ALTER TABLE ONLY "public"."matter_responses"
    ADD CONSTRAINT "matter_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matters"
    ADD CONSTRAINT "matters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reserved_vehicles"
    ADD CONSTRAINT "no_overlapping_vehicle_bookings" EXCLUDE USING "gist" ("vehicle_id" WITH =, "during" WITH &&);



ALTER TABLE ONLY "public"."offer_crew_items"
    ADD CONSTRAINT "offer_crew_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offer_equipment_groups"
    ADD CONSTRAINT "offer_equipment_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offer_equipment_items"
    ADD CONSTRAINT "offer_equipment_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offer_pretty_sections"
    ADD CONSTRAINT "offer_pretty_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offer_transport_items"
    ADD CONSTRAINT "offer_transport_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_invites"
    ADD CONSTRAINT "pending_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."reserved_crew"
    ADD CONSTRAINT "reserved_crew_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reserved_items"
    ADD CONSTRAINT "reserved_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reserved_vehicles"
    ADD CONSTRAINT "reserved_vehicles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_periods"
    ADD CONSTRAINT "time_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "addresses_company_name_unique" ON "public"."addresses" USING "btree" ("company_id", COALESCE("name", ''::"text"));



CREATE INDEX "customer_contacts_customer_id_idx" ON "public"."contacts" USING "btree" ("customer_id");



CREATE INDEX "customers_company_id_idx" ON "public"."customers" USING "btree" ("company_id");



CREATE INDEX "customers_company_name_idx" ON "public"."customers" USING "btree" ("company_id", "name");



CREATE INDEX "customers_company_partner_idx" ON "public"."customers" USING "btree" ("company_id", "is_partner");



CREATE INDEX "group_items_item_id_idx" ON "public"."group_items" USING "btree" ("item_id");



CREATE INDEX "idx_activity_comments_activity_id" ON "public"."activity_comments" USING "btree" ("activity_id");



CREATE INDEX "idx_activity_comments_created_at" ON "public"."activity_comments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_comments_deleted" ON "public"."activity_comments" USING "btree" ("deleted") WHERE ("deleted" = false);



CREATE INDEX "idx_activity_likes_activity_id" ON "public"."activity_likes" USING "btree" ("activity_id");



CREATE INDEX "idx_activity_likes_user_id" ON "public"."activity_likes" USING "btree" ("user_id");



CREATE INDEX "idx_activity_log_activity_type" ON "public"."activity_log" USING "btree" ("activity_type");



CREATE INDEX "idx_activity_log_company_created_at" ON "public"."activity_log" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "idx_activity_log_company_id" ON "public"."activity_log" USING "btree" ("company_id");



CREATE INDEX "idx_activity_log_created_at" ON "public"."activity_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_log_deleted" ON "public"."activity_log" USING "btree" ("deleted") WHERE ("deleted" = false);



CREATE INDEX "idx_addresses_company" ON "public"."addresses" USING "btree" ("company_id");



CREATE INDEX "idx_addresses_company_city_zip" ON "public"."addresses" USING "btree" ("company_id", "city", "zip_code");



CREATE INDEX "idx_company_expansions_company_id" ON "public"."company_expansions" USING "btree" ("company_id");



CREATE INDEX "idx_iph_item_latest" ON "public"."item_price_history" USING "btree" ("item_id", "effective_from" DESC) WHERE ("effective_to" IS NULL);



CREATE INDEX "idx_job_invoices_created_at" ON "public"."job_invoices" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_job_invoices_job_id" ON "public"."job_invoices" USING "btree" ("job_id");



CREATE INDEX "idx_job_invoices_offer_id" ON "public"."job_invoices" USING "btree" ("offer_id");



CREATE INDEX "idx_job_invoices_status" ON "public"."job_invoices" USING "btree" ("status");



CREATE INDEX "idx_job_offers_access_token" ON "public"."job_offers" USING "btree" ("access_token");



CREATE INDEX "idx_job_offers_company_id" ON "public"."job_offers" USING "btree" ("company_id");



CREATE INDEX "idx_job_offers_job_id" ON "public"."job_offers" USING "btree" ("job_id");



CREATE INDEX "idx_job_offers_rejected_at" ON "public"."job_offers" USING "btree" ("rejected_at") WHERE ("rejected_at" IS NOT NULL);



CREATE INDEX "idx_job_offers_revision_requested_at" ON "public"."job_offers" USING "btree" ("revision_requested_at") WHERE ("revision_requested_at" IS NOT NULL);



CREATE INDEX "idx_job_status_history_job" ON "public"."job_status_history" USING "btree" ("job_id", "changed_at" DESC);



CREATE INDEX "idx_jobs_customer_user_id" ON "public"."jobs" USING "btree" ("customer_user_id");



CREATE INDEX "idx_jobs_jobnr" ON "public"."jobs" USING "btree" ("jobnr");



CREATE INDEX "idx_matter_files_matter_id" ON "public"."matter_files" USING "btree" ("matter_id");



CREATE INDEX "idx_matter_files_uploaded_by_user_id" ON "public"."matter_files" USING "btree" ("uploaded_by_user_id");



CREATE INDEX "idx_matter_messages_created_at" ON "public"."matter_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_matter_messages_matter_id" ON "public"."matter_messages" USING "btree" ("matter_id");



CREATE INDEX "idx_matter_messages_user_id" ON "public"."matter_messages" USING "btree" ("user_id");



CREATE INDEX "idx_matter_recipients_matter_id" ON "public"."matter_recipients" USING "btree" ("matter_id");



CREATE INDEX "idx_matter_recipients_status" ON "public"."matter_recipients" USING "btree" ("status");



CREATE INDEX "idx_matter_recipients_user_id" ON "public"."matter_recipients" USING "btree" ("user_id");



CREATE INDEX "idx_matter_responses_matter_id" ON "public"."matter_responses" USING "btree" ("matter_id");



CREATE INDEX "idx_matter_responses_user_id" ON "public"."matter_responses" USING "btree" ("user_id");



CREATE INDEX "idx_matters_company_id" ON "public"."matters" USING "btree" ("company_id");



CREATE INDEX "idx_matters_created_by_user_id" ON "public"."matters" USING "btree" ("created_by_user_id");



CREATE INDEX "idx_matters_job_id" ON "public"."matters" USING "btree" ("job_id");



CREATE INDEX "idx_matters_time_period_id" ON "public"."matters" USING "btree" ("time_period_id");



CREATE INDEX "idx_matters_type" ON "public"."matters" USING "btree" ("matter_type");



CREATE INDEX "idx_offer_crew_items_offer_id" ON "public"."offer_crew_items" USING "btree" ("offer_id");



CREATE INDEX "idx_offer_equipment_groups_offer_id" ON "public"."offer_equipment_groups" USING "btree" ("offer_id");



CREATE INDEX "idx_offer_equipment_items_group_id" ON "public"."offer_equipment_items" USING "btree" ("offer_group_id");



CREATE INDEX "idx_offer_pretty_sections_offer_id" ON "public"."offer_pretty_sections" USING "btree" ("offer_id");



CREATE INDEX "idx_offer_transport_items_offer_id" ON "public"."offer_transport_items" USING "btree" ("offer_id");



CREATE INDEX "idx_profiles_display_name" ON "public"."profiles" USING "gin" ("to_tsvector"('"simple"'::"regconfig", COALESCE("display_name", ''::"text")));



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "iph_company_id_idx" ON "public"."item_price_history" USING "btree" ("company_id");



CREATE INDEX "iph_current_idx" ON "public"."item_price_history" USING "btree" ("item_id", "effective_to");



CREATE INDEX "iph_item_id_idx" ON "public"."item_price_history" USING "btree" ("item_id");



CREATE INDEX "item_groups_active_idx" ON "public"."item_groups" USING "btree" ("active");



CREATE INDEX "item_groups_company_id_idx" ON "public"."item_groups" USING "btree" ("company_id");



CREATE INDEX "item_groups_external_owner_id_idx" ON "public"."item_groups" USING "btree" ("external_owner_id");



CREATE INDEX "item_groups_name_trgm" ON "public"."item_groups" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "items_active_idx" ON "public"."items" USING "btree" ("active");



CREATE INDEX "items_company_id_idx" ON "public"."items" USING "btree" ("company_id");



CREATE INDEX "items_external_owner_id_idx" ON "public"."items" USING "btree" ("external_owner_id");



CREATE INDEX "items_external_owner_idx" ON "public"."items" USING "btree" ("external_owner_id") WHERE ("external_owner_id" IS NOT NULL);



CREATE INDEX "items_internal_owner_idx" ON "public"."items" USING "btree" ("internal_owner_company_id") WHERE ("internal_owner_company_id" IS NOT NULL);



CREATE INDEX "items_name_trgm" ON "public"."items" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "job_files_job_id_idx" ON "public"."job_files" USING "btree" ("job_id");



CREATE INDEX "job_notes_job_created_idx" ON "public"."job_notes" USING "btree" ("job_id", "created_at" DESC);



CREATE INDEX "job_notes_job_id_idx" ON "public"."job_notes" USING "btree" ("job_id");



CREATE INDEX "jobs_company_id_idx" ON "public"."jobs" USING "btree" ("company_id");



CREATE INDEX "jobs_company_status_idx" ON "public"."jobs" USING "btree" ("company_id", "status");



CREATE INDEX "jobs_time_idx" ON "public"."jobs" USING "btree" ("start_at", "end_at");



CREATE UNIQUE INDEX "pending_invites_company_id_email_key" ON "public"."pending_invites" USING "btree" ("company_id", "email");



CREATE UNIQUE INDEX "profiles_email_lower_key" ON "public"."profiles" USING "btree" ("lower"("email"));



CREATE INDEX "reservations_company_during_gist" ON "public"."time_periods" USING "gist" ("company_id", "during");



CREATE INDEX "reservations_company_idx" ON "public"."time_periods" USING "btree" ("company_id");



CREATE INDEX "reservations_job_idx" ON "public"."time_periods" USING "btree" ("job_id");



CREATE INDEX "reserved_crew_reservation_idx" ON "public"."reserved_crew" USING "btree" ("time_period_id");



CREATE INDEX "reserved_crew_user_during_gist" ON "public"."reserved_crew" USING "gist" ("user_id", "during");



CREATE INDEX "reserved_crew_user_idx" ON "public"."reserved_crew" USING "btree" ("user_id");



CREATE INDEX "reserved_items_item_id_idx" ON "public"."reserved_items" USING "btree" ("item_id");



CREATE INDEX "reserved_items_item_idx" ON "public"."reserved_items" USING "btree" ("item_id");



CREATE INDEX "reserved_items_reservation_id_idx" ON "public"."reserved_items" USING "btree" ("time_period_id");



CREATE INDEX "reserved_items_reservation_idx" ON "public"."reserved_items" USING "btree" ("time_period_id");



CREATE INDEX "reserved_items_source_group_idx" ON "public"."reserved_items" USING "btree" ("source_group_id");



CREATE INDEX "reserved_vehicles_reservation_idx" ON "public"."reserved_vehicles" USING "btree" ("time_period_id");



CREATE INDEX "reserved_vehicles_vehicle_during_gist" ON "public"."reserved_vehicles" USING "gist" ("vehicle_id", "during");



CREATE INDEX "reserved_vehicles_vehicle_idx" ON "public"."reserved_vehicles" USING "btree" ("vehicle_id");



CREATE INDEX "vehicle_index_mat_company_deleted_idx" ON "public"."vehicle_index_mat" USING "btree" ("company_id", "deleted");



CREATE INDEX "vehicles_company_active_idx" ON "public"."vehicles" USING "btree" ("company_id", "active");



CREATE INDEX "vehicles_company_deleted_idx" ON "public"."vehicles" USING "btree" ("company_id", "deleted");



CREATE INDEX "vehicles_company_internal_idx" ON "public"."vehicles" USING "btree" ("company_id", "internally_owned");



CREATE UNIQUE INDEX "vehicles_company_regno_key" ON "public"."vehicles" USING "btree" ("company_id", "registration_no") WHERE ("registration_no" IS NOT NULL);



CREATE INDEX "vehicles_deleted_idx" ON "public"."vehicles" USING "btree" ("company_id", "deleted");



CREATE INDEX "vehicles_external_owner_idx" ON "public"."vehicles" USING "btree" ("external_owner_id") WHERE ("external_owner_id" IS NOT NULL);



CREATE INDEX "vehicles_name_trgm_idx" ON "public"."vehicles" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "vehicles_reg_trgm_idx" ON "public"."vehicles" USING "gin" ("registration_no" "public"."gin_trgm_ops");



CREATE OR REPLACE TRIGGER "job_invoices_updated_at" BEFORE UPDATE ON "public"."job_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."update_job_invoices_updated_at"();



CREATE OR REPLACE TRIGGER "reserved_items_enforce_trg" BEFORE INSERT OR UPDATE ON "public"."reserved_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_reserved_items_enforce"();



CREATE OR REPLACE TRIGGER "reserved_items_qty_guard" BEFORE INSERT OR UPDATE OF "item_id", "quantity", "start_at", "end_at", "time_period_id" ON "public"."reserved_items" FOR EACH ROW EXECUTE FUNCTION "public"."check_item_quantity"();



CREATE OR REPLACE TRIGGER "ri_enforce_within_reservation_insupd" BEFORE INSERT OR UPDATE OF "start_at", "end_at", "time_period_id" ON "public"."reserved_items" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_within_time_period"();



CREATE OR REPLACE TRIGGER "rv_enforce_within_reservation_insupd" BEFORE INSERT OR UPDATE OF "start_at", "end_at", "time_period_id" ON "public"."reserved_vehicles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_within_time_period"();



CREATE OR REPLACE TRIGGER "rv_set_during_ins" BEFORE INSERT ON "public"."reserved_vehicles" FOR EACH ROW EXECUTE FUNCTION "public"."_rv_set_during"();



CREATE OR REPLACE TRIGGER "rv_set_during_upd" BEFORE UPDATE OF "start_at", "end_at", "time_period_id" ON "public"."reserved_vehicles" FOR EACH ROW EXECUTE FUNCTION "public"."_rv_set_during"();



CREATE OR REPLACE TRIGGER "trg_accept_pending_invites" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."accept_pending_invites_on_profile"();



CREATE OR REPLACE TRIGGER "trg_addresses_updated_at" BEFORE UPDATE ON "public"."addresses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_pending_invites_normalize_email" BEFORE INSERT OR UPDATE ON "public"."pending_invites" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_email"();



CREATE OR REPLACE TRIGGER "trg_profiles_normalize_email" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_email"();



CREATE OR REPLACE TRIGGER "trigger_add_user_to_welcome_matter" AFTER INSERT ON "public"."company_users" FOR EACH ROW EXECUTE FUNCTION "public"."add_user_to_welcome_matter"();



CREATE OR REPLACE TRIGGER "trigger_generate_job_number" BEFORE INSERT ON "public"."jobs" FOR EACH ROW WHEN (("new"."jobnr" IS NULL)) EXECUTE FUNCTION "public"."generate_job_number"();



CREATE OR REPLACE TRIGGER "trigger_handle_offer_acceptance" AFTER UPDATE ON "public"."job_offers" FOR EACH ROW WHEN ((("new"."status" = 'accepted'::"public"."offer_status") AND ("old"."status" IS DISTINCT FROM 'accepted'::"public"."offer_status"))) EXECUTE FUNCTION "public"."handle_offer_acceptance"();



CREATE OR REPLACE TRIGGER "trigger_notify_on_activity_comment" AFTER INSERT ON "public"."activity_comments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_activity_creator"();



CREATE OR REPLACE TRIGGER "trigger_notify_on_activity_like" AFTER INSERT ON "public"."activity_likes" FOR EACH ROW EXECUTE FUNCTION "public"."notify_activity_creator"();



CREATE OR REPLACE TRIGGER "trigger_update_job_offers_updated_at" BEFORE UPDATE ON "public"."job_offers" FOR EACH ROW EXECUTE FUNCTION "public"."update_job_offers_updated_at"();



CREATE OR REPLACE TRIGGER "update_activity_comments_updated_at" BEFORE UPDATE ON "public"."activity_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_activity_comments_updated_at"();



CREATE OR REPLACE TRIGGER "update_company_expansions_updated_at" BEFORE UPDATE ON "public"."company_expansions" FOR EACH ROW EXECUTE FUNCTION "public"."update_company_expansions_updated_at"();



CREATE OR REPLACE TRIGGER "update_matter_messages_updated_at" BEFORE UPDATE ON "public"."matter_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_matter_responses_updated_at" BEFORE UPDATE ON "public"."matter_responses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_matters_updated_at" BEFORE UPDATE ON "public"."matters" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."activity_comments"
    ADD CONSTRAINT "activity_comments_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activity_log"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_comments"
    ADD CONSTRAINT "activity_comments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_likes"
    ADD CONSTRAINT "activity_likes_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activity_log"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_likes"
    ADD CONSTRAINT "activity_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_contact_person_id_fkey" FOREIGN KEY ("contact_person_id") REFERENCES "public"."profiles"("user_id") ON UPDATE CASCADE ON DELETE SET DEFAULT;



ALTER TABLE ONLY "public"."company_expansions"
    ADD CONSTRAINT "company_expansions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_users"
    ADD CONSTRAINT "company_users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_users"
    ADD CONSTRAINT "company_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "customer_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."job_offers"
    ADD CONSTRAINT "fk_job_offers_based_on" FOREIGN KEY ("based_on_offer_id") REFERENCES "public"."job_offers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_offers"
    ADD CONSTRAINT "fk_job_offers_company" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_offers"
    ADD CONSTRAINT "fk_job_offers_job" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_crew_items"
    ADD CONSTRAINT "fk_offer_crew_items_offer" FOREIGN KEY ("offer_id") REFERENCES "public"."job_offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_equipment_groups"
    ADD CONSTRAINT "fk_offer_equipment_groups_offer" FOREIGN KEY ("offer_id") REFERENCES "public"."job_offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_equipment_items"
    ADD CONSTRAINT "fk_offer_equipment_items_group" FOREIGN KEY ("offer_group_id") REFERENCES "public"."offer_equipment_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_equipment_items"
    ADD CONSTRAINT "fk_offer_equipment_items_item" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."offer_pretty_sections"
    ADD CONSTRAINT "fk_offer_pretty_sections_offer" FOREIGN KEY ("offer_id") REFERENCES "public"."job_offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_transport_items"
    ADD CONSTRAINT "fk_offer_transport_items_offer" FOREIGN KEY ("offer_id") REFERENCES "public"."job_offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_transport_items"
    ADD CONSTRAINT "fk_offer_transport_items_vehicle" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_items"
    ADD CONSTRAINT "group_items_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."item_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_items"
    ADD CONSTRAINT "group_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."group_price_history"
    ADD CONSTRAINT "group_price_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."group_price_history"
    ADD CONSTRAINT "group_price_history_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."item_groups"("id");



ALTER TABLE ONLY "public"."group_price_history"
    ADD CONSTRAINT "group_price_history_set_by_fkey" FOREIGN KEY ("set_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."item_brands"
    ADD CONSTRAINT "item_brands_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_categories"
    ADD CONSTRAINT "item_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_groups"
    ADD CONSTRAINT "item_groups_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."item_categories"("id");



ALTER TABLE ONLY "public"."item_groups"
    ADD CONSTRAINT "item_groups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_groups"
    ADD CONSTRAINT "item_groups_external_owner_id_fkey" FOREIGN KEY ("external_owner_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."item_price_history"
    ADD CONSTRAINT "item_price_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_price_history"
    ADD CONSTRAINT "item_price_history_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_price_history"
    ADD CONSTRAINT "item_price_history_set_by_fkey" FOREIGN KEY ("set_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."item_related"
    ADD CONSTRAINT "item_related_item_a_id_fkey" FOREIGN KEY ("item_a_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_related"
    ADD CONSTRAINT "item_related_item_b_id_fkey" FOREIGN KEY ("item_b_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."item_brands"("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."item_categories"("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_external_owner_id_fkey" FOREIGN KEY ("external_owner_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_internal_owner_company_id_fkey" FOREIGN KEY ("internal_owner_company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_contacts"
    ADD CONSTRAINT "job_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_contacts"
    ADD CONSTRAINT "job_contacts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_files"
    ADD CONSTRAINT "job_files_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_files"
    ADD CONSTRAINT "job_files_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."job_invoices"
    ADD CONSTRAINT "job_invoices_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_invoices"
    ADD CONSTRAINT "job_invoices_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_invoices"
    ADD CONSTRAINT "job_invoices_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."job_offers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_notes"
    ADD CONSTRAINT "job_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."job_notes"
    ADD CONSTRAINT "job_notes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_offers"
    ADD CONSTRAINT "job_offers_based_on_offer_id_fkey" FOREIGN KEY ("based_on_offer_id") REFERENCES "public"."job_offers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_offers"
    ADD CONSTRAINT "job_offers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_offers"
    ADD CONSTRAINT "job_offers_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_status_history"
    ADD CONSTRAINT "job_status_history_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_status_history"
    ADD CONSTRAINT "job_status_history_set_by_fkey" FOREIGN KEY ("set_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_customer_contact_id_fkey" FOREIGN KEY ("customer_contact_id") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_job_address_id_fkey" FOREIGN KEY ("job_address_id") REFERENCES "public"."addresses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_project_lead_user_id_fkey" FOREIGN KEY ("project_lead_user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."matter_files"
    ADD CONSTRAINT "matter_files_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matter_files"
    ADD CONSTRAINT "matter_files_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matter_messages"
    ADD CONSTRAINT "matter_messages_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matter_messages"
    ADD CONSTRAINT "matter_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matter_recipients"
    ADD CONSTRAINT "matter_recipients_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matter_recipients"
    ADD CONSTRAINT "matter_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matter_responses"
    ADD CONSTRAINT "matter_responses_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matter_responses"
    ADD CONSTRAINT "matter_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matters"
    ADD CONSTRAINT "matters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matters"
    ADD CONSTRAINT "matters_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matters"
    ADD CONSTRAINT "matters_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matters"
    ADD CONSTRAINT "matters_time_period_id_fkey" FOREIGN KEY ("time_period_id") REFERENCES "public"."time_periods"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."offer_crew_items"
    ADD CONSTRAINT "offer_crew_items_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."job_offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_equipment_groups"
    ADD CONSTRAINT "offer_equipment_groups_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."job_offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_equipment_items"
    ADD CONSTRAINT "offer_equipment_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."offer_equipment_items"
    ADD CONSTRAINT "offer_equipment_items_offer_group_id_fkey" FOREIGN KEY ("offer_group_id") REFERENCES "public"."offer_equipment_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_pretty_sections"
    ADD CONSTRAINT "offer_pretty_sections_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."job_offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_transport_items"
    ADD CONSTRAINT "offer_transport_items_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."job_offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_transport_items"
    ADD CONSTRAINT "offer_transport_items_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pending_invites"
    ADD CONSTRAINT "pending_invites_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_invites"
    ADD CONSTRAINT "pending_invites_inviter_user_id_fkey" FOREIGN KEY ("inviter_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_primary_address_id_fkey" FOREIGN KEY ("primary_address_id") REFERENCES "public"."addresses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_selected_company_id_fkey" FOREIGN KEY ("selected_company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reserved_crew"
    ADD CONSTRAINT "reserved_crew_time_period_id_fkey" FOREIGN KEY ("time_period_id") REFERENCES "public"."time_periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reserved_crew"
    ADD CONSTRAINT "reserved_crew_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."reserved_items"
    ADD CONSTRAINT "reserved_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."reserved_items"
    ADD CONSTRAINT "reserved_items_source_group_id_fkey" FOREIGN KEY ("source_group_id") REFERENCES "public"."item_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reserved_items"
    ADD CONSTRAINT "reserved_items_time_period_id_fkey" FOREIGN KEY ("time_period_id") REFERENCES "public"."time_periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reserved_vehicles"
    ADD CONSTRAINT "reserved_vehicles_time_period_id_fkey" FOREIGN KEY ("time_period_id") REFERENCES "public"."time_periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reserved_vehicles"
    ADD CONSTRAINT "reserved_vehicles_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id");



ALTER TABLE ONLY "public"."time_periods"
    ADD CONSTRAINT "time_periods_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."time_periods"
    ADD CONSTRAINT "time_periods_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."time_periods"
    ADD CONSTRAINT "time_periods_reserved_by_user_id_fkey" FOREIGN KEY ("reserved_by_user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."time_periods"
    ADD CONSTRAINT "time_periods_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_external_owner_id_fkey" FOREIGN KEY ("external_owner_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



CREATE POLICY "Company members can manage their company's crew items" ON "public"."offer_crew_items" USING (("offer_id" IN ( SELECT "o"."id"
   FROM ("public"."job_offers" "o"
     JOIN "public"."company_users" "cu" ON (("o"."company_id" = "cu"."company_id")))
  WHERE ("cu"."user_id" = "auth"."uid"()))));



CREATE POLICY "Company members can manage their company's equipment groups" ON "public"."offer_equipment_groups" USING (("offer_id" IN ( SELECT "o"."id"
   FROM ("public"."job_offers" "o"
     JOIN "public"."company_users" "cu" ON (("o"."company_id" = "cu"."company_id")))
  WHERE ("cu"."user_id" = "auth"."uid"()))));



CREATE POLICY "Company members can manage their company's equipment items" ON "public"."offer_equipment_items" USING (("offer_group_id" IN ( SELECT "og"."id"
   FROM (("public"."offer_equipment_groups" "og"
     JOIN "public"."job_offers" "o" ON (("og"."offer_id" = "o"."id")))
     JOIN "public"."company_users" "cu" ON (("o"."company_id" = "cu"."company_id")))
  WHERE ("cu"."user_id" = "auth"."uid"()))));



CREATE POLICY "Company members can manage their company's offers" ON "public"."job_offers" USING (("company_id" IN ( SELECT "company_users"."company_id"
   FROM "public"."company_users"
  WHERE ("company_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Company members can manage their company's pretty sections" ON "public"."offer_pretty_sections" USING (("offer_id" IN ( SELECT "o"."id"
   FROM ("public"."job_offers" "o"
     JOIN "public"."company_users" "cu" ON (("o"."company_id" = "cu"."company_id")))
  WHERE ("cu"."user_id" = "auth"."uid"()))));



CREATE POLICY "Company members can manage their company's transport items" ON "public"."offer_transport_items" USING (("offer_id" IN ( SELECT "o"."id"
   FROM ("public"."job_offers" "o"
     JOIN "public"."company_users" "cu" ON (("o"."company_id" = "cu"."company_id")))
  WHERE ("cu"."user_id" = "auth"."uid"()))));



CREATE POLICY "Company owners can manage expansions" ON "public"."company_expansions" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users"
  WHERE (("company_users"."company_id" = "company_expansions"."company_id") AND ("company_users"."user_id" = "auth"."uid"()) AND ("company_users"."role" = 'owner'::"public"."company_role")))));



CREATE POLICY "Owners can delete activities" ON "public"."activity_log" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."company_users"
  WHERE (("company_users"."company_id" = "activity_log"."company_id") AND ("company_users"."user_id" = "auth"."uid"()) AND ("company_users"."role" = ANY (ARRAY['owner'::"public"."company_role", 'super_user'::"public"."company_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_users"
  WHERE (("company_users"."company_id" = "activity_log"."company_id") AND ("company_users"."user_id" = "auth"."uid"()) AND ("company_users"."role" = ANY (ARRAY['owner'::"public"."company_role", 'super_user'::"public"."company_role"]))))));



CREATE POLICY "Public can accept sent offers" ON "public"."job_offers" FOR UPDATE TO "authenticated", "anon" USING (("status" = 'sent'::"public"."offer_status")) WITH CHECK ((("status" = 'accepted'::"public"."offer_status") OR ("status" = 'rejected'::"public"."offer_status") OR ("status" = 'viewed'::"public"."offer_status")));



CREATE POLICY "Public can view crew items from accessible offers" ON "public"."offer_crew_items" FOR SELECT TO "authenticated", "anon" USING (("offer_id" IN ( SELECT "job_offers"."id"
   FROM "public"."job_offers"
  WHERE ("job_offers"."status" <> 'draft'::"public"."offer_status"))));



CREATE POLICY "Public can view equipment groups from accessible offers" ON "public"."offer_equipment_groups" FOR SELECT TO "authenticated", "anon" USING (("offer_id" IN ( SELECT "job_offers"."id"
   FROM "public"."job_offers"
  WHERE ("job_offers"."status" <> 'draft'::"public"."offer_status"))));



CREATE POLICY "Public can view equipment items from accessible offers" ON "public"."offer_equipment_items" FOR SELECT TO "authenticated", "anon" USING (("offer_group_id" IN ( SELECT "og"."id"
   FROM ("public"."offer_equipment_groups" "og"
     JOIN "public"."job_offers" "o" ON (("og"."offer_id" = "o"."id")))
  WHERE ("o"."status" <> 'draft'::"public"."offer_status"))));



CREATE POLICY "Public can view non-draft offers via access token" ON "public"."job_offers" FOR SELECT TO "authenticated", "anon" USING ((("status" <> 'draft'::"public"."offer_status") AND ("access_token" IS NOT NULL)));



CREATE POLICY "Public can view pretty sections from accessible offers" ON "public"."offer_pretty_sections" FOR SELECT TO "authenticated", "anon" USING (("offer_id" IN ( SELECT "job_offers"."id"
   FROM "public"."job_offers"
  WHERE ("job_offers"."status" <> 'draft'::"public"."offer_status"))));



CREATE POLICY "Public can view transport items from accessible offers" ON "public"."offer_transport_items" FOR SELECT TO "authenticated", "anon" USING (("offer_id" IN ( SELECT "job_offers"."id"
   FROM "public"."job_offers"
  WHERE ("job_offers"."status" <> 'draft'::"public"."offer_status"))));



CREATE POLICY "Recipients can update their own status" ON "public"."matter_recipients" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "System can insert matter recipients" ON "public"."matter_recipients" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can create activities" ON "public"."activity_log" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."company_users"
  WHERE (("company_users"."company_id" = "activity_log"."company_id") AND ("company_users"."user_id" = "auth"."uid"()) AND ("company_users"."role" = ANY (ARRAY['owner'::"public"."company_role", 'employee'::"public"."company_role", 'super_user'::"public"."company_role"]))))) AND ("created_by_user_id" = "auth"."uid"())));



CREATE POLICY "Users can create comments" ON "public"."activity_comments" FOR INSERT WITH CHECK ((("created_by_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM (("public"."activity_log" "al"
     JOIN "public"."company_users" "cu" ON (("cu"."company_id" = "al"."company_id")))
     JOIN "public"."company_expansions" "ce" ON (("ce"."company_id" = "al"."company_id")))
  WHERE (("al"."id" = "activity_comments"."activity_id") AND ("al"."deleted" = false) AND (("cu"."user_id" = "auth"."uid"()) AND (("cu"."role" = ANY (ARRAY['owner'::"public"."company_role", 'employee'::"public"."company_role", 'super_user'::"public"."company_role"])) OR (("cu"."role" = 'freelancer'::"public"."company_role") AND ("ce"."latest_feed_open_to_freelancers" = true)))))))));



CREATE POLICY "Users can create invoices for their company jobs" ON "public"."job_invoices" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."jobs" "j"
     JOIN "public"."company_users" "cu" ON (("cu"."company_id" = "j"."company_id")))
  WHERE (("j"."id" = "job_invoices"."job_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = ANY (ARRAY['owner'::"public"."company_role", 'super_user'::"public"."company_role", 'employee'::"public"."company_role"]))))));



CREATE POLICY "Users can create matters for their company" ON "public"."matters" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."company_users"
  WHERE (("company_users"."user_id" = "auth"."uid"()) AND ("company_users"."company_id" = "matters"."company_id")))) AND ("created_by_user_id" = "auth"."uid"())));



CREATE POLICY "Users can delete matters they created" ON "public"."matters" FOR DELETE USING (("created_by_user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own comments" ON "public"."activity_comments" FOR UPDATE USING (("created_by_user_id" = "auth"."uid"())) WITH CHECK (("created_by_user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete reserved_items for their company jobs" ON "public"."reserved_items" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."time_periods" "tp"
  WHERE (("tp"."id" = "reserved_items"."time_period_id") AND ("tp"."company_id" IN ( SELECT "company_users"."company_id"
           FROM "public"."company_users"
          WHERE ("company_users"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can delete their own files" ON "public"."matter_files" FOR DELETE USING (("uploaded_by_user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert matter files" ON "public"."matter_files" FOR INSERT WITH CHECK ((("uploaded_by_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."matters"
  WHERE (("matters"."id" = "matter_files"."matter_id") AND (EXISTS ( SELECT 1
           FROM "public"."company_users"
          WHERE (("company_users"."user_id" = "auth"."uid"()) AND ("company_users"."company_id" = "matters"."company_id")))))))));



CREATE POLICY "Users can insert matter messages" ON "public"."matter_messages" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."matters"
  WHERE (("matters"."id" = "matter_messages"."matter_id") AND (EXISTS ( SELECT 1
           FROM "public"."company_users"
          WHERE (("company_users"."user_id" = "auth"."uid"()) AND ("company_users"."company_id" = "matters"."company_id")))))))));



CREATE POLICY "Users can insert reserved_items for their company jobs" ON "public"."reserved_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."time_periods" "tp"
  WHERE (("tp"."id" = "reserved_items"."time_period_id") AND ("tp"."company_id" IN ( SELECT "company_users"."company_id"
           FROM "public"."company_users"
          WHERE ("company_users"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can insert their own responses" ON "public"."matter_responses" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can like activities" ON "public"."activity_likes" USING ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM (("public"."activity_log" "al"
     JOIN "public"."company_users" "cu" ON (("cu"."company_id" = "al"."company_id")))
     JOIN "public"."company_expansions" "ce" ON (("ce"."company_id" = "al"."company_id")))
  WHERE (("al"."id" = "activity_likes"."activity_id") AND ("al"."deleted" = false) AND (("cu"."user_id" = "auth"."uid"()) AND (("cu"."role" = ANY (ARRAY['owner'::"public"."company_role", 'employee'::"public"."company_role", 'super_user'::"public"."company_role"])) OR (("cu"."role" = 'freelancer'::"public"."company_role") AND ("ce"."latest_feed_open_to_freelancers" = true))))))))) WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM (("public"."activity_log" "al"
     JOIN "public"."company_users" "cu" ON (("cu"."company_id" = "al"."company_id")))
     JOIN "public"."company_expansions" "ce" ON (("ce"."company_id" = "al"."company_id")))
  WHERE (("al"."id" = "activity_likes"."activity_id") AND ("al"."deleted" = false) AND (("cu"."user_id" = "auth"."uid"()) AND (("cu"."role" = ANY (ARRAY['owner'::"public"."company_role", 'employee'::"public"."company_role", 'super_user'::"public"."company_role"])) OR (("cu"."role" = 'freelancer'::"public"."company_role") AND ("ce"."latest_feed_open_to_freelancers" = true)))))))));



CREATE POLICY "Users can update matters they created" ON "public"."matters" FOR UPDATE USING (("created_by_user_id" = "auth"."uid"())) WITH CHECK (("created_by_user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own comments" ON "public"."activity_comments" FOR UPDATE USING (("created_by_user_id" = "auth"."uid"())) WITH CHECK (("created_by_user_id" = "auth"."uid"()));



CREATE POLICY "Users can update reserved_items for their company jobs" ON "public"."reserved_items" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."time_periods" "tp"
  WHERE (("tp"."id" = "reserved_items"."time_period_id") AND ("tp"."company_id" IN ( SELECT "company_users"."company_id"
           FROM "public"."company_users"
          WHERE ("company_users"."user_id" = "auth"."uid"()))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."time_periods" "tp"
  WHERE (("tp"."id" = "reserved_items"."time_period_id") AND ("tp"."company_id" IN ( SELECT "company_users"."company_id"
           FROM "public"."company_users"
          WHERE ("company_users"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can update their own files" ON "public"."matter_files" FOR UPDATE USING (("uploaded_by_user_id" = "auth"."uid"())) WITH CHECK (("uploaded_by_user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own messages" ON "public"."matter_messages" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own responses" ON "public"."matter_responses" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view comments" ON "public"."activity_comments" FOR SELECT USING ((("deleted" = false) AND (EXISTS ( SELECT 1
   FROM (("public"."activity_log" "al"
     JOIN "public"."company_users" "cu" ON (("cu"."company_id" = "al"."company_id")))
     JOIN "public"."company_expansions" "ce" ON (("ce"."company_id" = "al"."company_id")))
  WHERE (("al"."id" = "activity_comments"."activity_id") AND (("cu"."user_id" = "auth"."uid"()) AND (("cu"."role" = ANY (ARRAY['owner'::"public"."company_role", 'employee'::"public"."company_role", 'super_user'::"public"."company_role"])) OR (("cu"."role" = 'freelancer'::"public"."company_role") AND ("ce"."latest_feed_open_to_freelancers" = true)))))))));



CREATE POLICY "Users can view company activities" ON "public"."activity_log" FOR SELECT USING ((("deleted" = false) AND (EXISTS ( SELECT 1
   FROM ("public"."company_users" "cu"
     JOIN "public"."company_expansions" "ce" ON (("ce"."company_id" = "cu"."company_id")))
  WHERE (("cu"."company_id" = "activity_log"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND (("cu"."role" = ANY (ARRAY['owner'::"public"."company_role", 'employee'::"public"."company_role", 'super_user'::"public"."company_role"])) OR (("cu"."role" = 'freelancer'::"public"."company_role") AND ("ce"."latest_feed_open_to_freelancers" = true))))))));



CREATE POLICY "Users can view company expansions" ON "public"."company_expansions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."company_users"
  WHERE (("company_users"."company_id" = "company_expansions"."company_id") AND ("company_users"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view invoices for their company jobs" ON "public"."job_invoices" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."jobs" "j"
     JOIN "public"."company_users" "cu" ON (("cu"."company_id" = "j"."company_id")))
  WHERE (("j"."id" = "job_invoices"."job_id") AND ("cu"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view likes" ON "public"."activity_likes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."activity_log" "al"
     JOIN "public"."company_users" "cu" ON (("cu"."company_id" = "al"."company_id")))
     JOIN "public"."company_expansions" "ce" ON (("ce"."company_id" = "al"."company_id")))
  WHERE (("al"."id" = "activity_likes"."activity_id") AND ("al"."deleted" = false) AND (("cu"."user_id" = "auth"."uid"()) AND (("cu"."role" = ANY (ARRAY['owner'::"public"."company_role", 'employee'::"public"."company_role", 'super_user'::"public"."company_role"])) OR (("cu"."role" = 'freelancer'::"public"."company_role") AND ("ce"."latest_feed_open_to_freelancers" = true))))))));



CREATE POLICY "Users can view matter files" ON "public"."matter_files" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."matters"
  WHERE (("matters"."id" = "matter_files"."matter_id") AND (EXISTS ( SELECT 1
           FROM "public"."company_users"
          WHERE (("company_users"."user_id" = "auth"."uid"()) AND ("company_users"."company_id" = "matters"."company_id"))))))));



CREATE POLICY "Users can view matter messages" ON "public"."matter_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."matters"
  WHERE (("matters"."id" = "matter_messages"."matter_id") AND (EXISTS ( SELECT 1
           FROM "public"."company_users"
          WHERE (("company_users"."user_id" = "auth"."uid"()) AND ("company_users"."company_id" = "matters"."company_id"))))))));



CREATE POLICY "Users can view matter recipients" ON "public"."matter_recipients" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."matters"
  WHERE (("matters"."id" = "matter_recipients"."matter_id") AND (EXISTS ( SELECT 1
           FROM "public"."company_users"
          WHERE (("company_users"."user_id" = "auth"."uid"()) AND ("company_users"."company_id" = "matters"."company_id"))))))));



CREATE POLICY "Users can view matter responses" ON "public"."matter_responses" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."matters"
  WHERE (("matters"."id" = "matter_responses"."matter_id") AND (EXISTS ( SELECT 1
           FROM "public"."company_users"
          WHERE (("company_users"."user_id" = "auth"."uid"()) AND ("company_users"."company_id" = "matters"."company_id"))))))));



CREATE POLICY "Users can view matters for their company" ON "public"."matters" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."company_users"
  WHERE (("company_users"."user_id" = "auth"."uid"()) AND ("company_users"."company_id" = "matters"."company_id")))));



CREATE POLICY "Users can view reserved_items for their company jobs" ON "public"."reserved_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."time_periods" "tp"
  WHERE (("tp"."id" = "reserved_items"."time_period_id") AND ("tp"."company_id" IN ( SELECT "company_users"."company_id"
           FROM "public"."company_users"
          WHERE ("company_users"."user_id" = "auth"."uid"())))))));



ALTER TABLE "public"."activity_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brands read own company" ON "public"."item_brands" FOR SELECT USING (("company_id" = (("auth"."jwt"() ->> 'company_id'::"text"))::"uuid"));



CREATE POLICY "categories read own company" ON "public"."item_categories" FOR SELECT USING (("company_id" = (("auth"."jwt"() ->> 'company_id'::"text"))::"uuid"));



ALTER TABLE "public"."company_expansions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dev_allow_all" ON "public"."companies" USING (true) WITH CHECK (true);



CREATE POLICY "dev_allow_all" ON "public"."company_users" USING (true) WITH CHECK (true);



CREATE POLICY "dev_allow_all" ON "public"."group_items" USING (true) WITH CHECK (true);



CREATE POLICY "dev_allow_all" ON "public"."group_price_history" USING (true) WITH CHECK (true);



CREATE POLICY "dev_allow_all" ON "public"."item_brands" USING (true) WITH CHECK (true);



CREATE POLICY "dev_allow_all" ON "public"."item_categories" USING (true) WITH CHECK (true);



CREATE POLICY "dev_allow_all" ON "public"."item_groups" USING (true) WITH CHECK (true);



CREATE POLICY "dev_allow_all" ON "public"."item_price_history" USING (true) WITH CHECK (true);



CREATE POLICY "dev_allow_all" ON "public"."item_related" USING (true) WITH CHECK (true);



CREATE POLICY "dev_allow_all" ON "public"."items" USING (true) WITH CHECK (true);



CREATE POLICY "dev_allow_all" ON "public"."profiles" USING (true) WITH CHECK (true);



CREATE POLICY "group_items read own company via group" ON "public"."group_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."item_groups" "g"
  WHERE (("g"."id" = "group_items"."group_id") AND ("g"."company_id" = (("auth"."jwt"() ->> 'company_id'::"text"))::"uuid")))));



CREATE POLICY "group_items read via group company" ON "public"."group_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."item_groups" "g"
  WHERE (("g"."id" = "group_items"."group_id") AND ("g"."company_id" = (("auth"."jwt"() ->> 'company_id'::"text"))::"uuid")))));



CREATE POLICY "group_price_history insert own company" ON "public"."group_price_history" FOR INSERT WITH CHECK (("company_id" = (("auth"."jwt"() ->> 'company_id'::"text"))::"uuid"));



CREATE POLICY "group_price_history read own company" ON "public"."group_price_history" FOR SELECT USING (("company_id" = (("auth"."jwt"() ->> 'company_id'::"text"))::"uuid"));



CREATE POLICY "groups read own company" ON "public"."item_groups" FOR SELECT USING (("company_id" = (("auth"."jwt"() ->> 'company_id'::"text"))::"uuid"));



CREATE POLICY "item_price_history read own company" ON "public"."item_price_history" FOR SELECT USING (("company_id" = (("auth"."jwt"() ->> 'company_id'::"text"))::"uuid"));



CREATE POLICY "items read own company" ON "public"."items" FOR SELECT USING (("company_id" = (("auth"."jwt"() ->> 'company_id'::"text"))::"uuid"));



ALTER TABLE "public"."job_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_offers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matter_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matter_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matter_recipients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matter_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offer_crew_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offer_equipment_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offer_equipment_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offer_pretty_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offer_transport_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."_rv_set_during"() TO "anon";
GRANT ALL ON FUNCTION "public"."_rv_set_during"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_rv_set_during"() TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_pending_invites_on_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."accept_pending_invites_on_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_pending_invites_on_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."add_existing_users_to_welcome_matter"("p_company_id" "uuid", "p_matter_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_existing_users_to_welcome_matter"("p_company_id" "uuid", "p_matter_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_existing_users_to_welcome_matter"("p_company_id" "uuid", "p_matter_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_freelancer_or_invite"("p_company_id" "uuid", "p_email" "text", "p_inviter_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_freelancer_or_invite"("p_company_id" "uuid", "p_email" "text", "p_inviter_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_freelancer_or_invite"("p_company_id" "uuid", "p_email" "text", "p_inviter_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_freelancer_or_invite"("p_company_id" "uuid", "p_email" "public"."citext", "p_inviter_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_freelancer_or_invite"("p_company_id" "uuid", "p_email" "public"."citext", "p_inviter_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_freelancer_or_invite"("p_company_id" "uuid", "p_email" "public"."citext", "p_inviter_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_member_or_invite"("p_company_id" "uuid", "p_email" "text", "p_inviter_id" "uuid", "p_role" "public"."company_role") TO "anon";
GRANT ALL ON FUNCTION "public"."add_member_or_invite"("p_company_id" "uuid", "p_email" "text", "p_inviter_id" "uuid", "p_role" "public"."company_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_member_or_invite"("p_company_id" "uuid", "p_email" "text", "p_inviter_id" "uuid", "p_role" "public"."company_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_user_to_welcome_matter"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_user_to_welcome_matter"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_user_to_welcome_matter"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_item_availability_for_job"("p_job_id" "uuid", "p_item_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_item_availability_for_job"("p_job_id" "uuid", "p_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_item_availability_for_job"("p_job_id" "uuid", "p_item_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_item_quantity"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_item_quantity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_item_quantity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_group_with_price_and_parts"("p_company_id" "uuid", "p_name" "text", "p_category_id" "uuid", "p_description" "text", "p_active" boolean, "p_price" numeric, "p_parts" "jsonb", "p_unique" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_group_with_price_and_parts"("p_company_id" "uuid", "p_name" "text", "p_category_id" "uuid", "p_description" "text", "p_active" boolean, "p_price" numeric, "p_parts" "jsonb", "p_unique" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_group_with_price_and_parts"("p_company_id" "uuid", "p_name" "text", "p_category_id" "uuid", "p_description" "text", "p_active" boolean, "p_price" numeric, "p_parts" "jsonb", "p_unique" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_item_with_price"("p_company_id" "uuid", "p_name" "text", "p_category_id" "uuid", "p_brand_id" "uuid", "p_model" "text", "p_allow_individual_booking" boolean, "p_total_quantity" integer, "p_active" boolean, "p_notes" "text", "p_price" numeric, "p_effective_from" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."create_item_with_price"("p_company_id" "uuid", "p_name" "text", "p_category_id" "uuid", "p_brand_id" "uuid", "p_model" "text", "p_allow_individual_booking" boolean, "p_total_quantity" integer, "p_active" boolean, "p_notes" "text", "p_price" numeric, "p_effective_from" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_item_with_price"("p_company_id" "uuid", "p_name" "text", "p_category_id" "uuid", "p_brand_id" "uuid", "p_model" "text", "p_allow_individual_booking" boolean, "p_total_quantity" integer, "p_active" boolean, "p_notes" "text", "p_price" numeric, "p_effective_from" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_item_with_price"("p_company_id" "uuid", "p_name" "text", "p_category_id" "uuid", "p_brand_id" "uuid", "p_model" "text", "p_allow_individual_booking" boolean, "p_total_quantity" numeric, "p_active" boolean, "p_notes" "text", "p_price" numeric, "p_currency" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_item_with_price"("p_company_id" "uuid", "p_name" "text", "p_category_id" "uuid", "p_brand_id" "uuid", "p_model" "text", "p_allow_individual_booking" boolean, "p_total_quantity" numeric, "p_active" boolean, "p_notes" "text", "p_price" numeric, "p_currency" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_item_with_price"("p_company_id" "uuid", "p_name" "text", "p_category_id" "uuid", "p_brand_id" "uuid", "p_model" "text", "p_allow_individual_booking" boolean, "p_total_quantity" numeric, "p_active" boolean, "p_notes" "text", "p_price" numeric, "p_currency" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_company_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_company_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_company_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrypt_api_key"("p_company_id" "uuid", "p_encrypted_key" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."decrypt_api_key"("p_company_id" "uuid", "p_encrypted_key" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrypt_api_key"("p_company_id" "uuid", "p_encrypted_key" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrypt_api_key"("p_company_id" "uuid", "p_encrypted_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."decrypt_api_key"("p_company_id" "uuid", "p_encrypted_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrypt_api_key"("p_company_id" "uuid", "p_encrypted_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."encrypt_api_key"("p_company_id" "uuid", "p_api_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."encrypt_api_key"("p_company_id" "uuid", "p_api_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."encrypt_api_key"("p_company_id" "uuid", "p_api_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_within_time_period"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_within_time_period"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_within_time_period"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_default_reservation"("p_job_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_default_reservation"("p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_default_reservation"("p_job_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_profile_for_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_profile_for_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_profile_for_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fuzzy_search_multi"("search_term" "text", "fields" "text"[], "similarity_threshold" real) TO "anon";
GRANT ALL ON FUNCTION "public"."fuzzy_search_multi"("search_term" "text", "fields" "text"[], "similarity_threshold" real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fuzzy_search_multi"("search_term" "text", "fields" "text"[], "similarity_threshold" real) TO "service_role";



GRANT ALL ON FUNCTION "public"."fuzzy_search_text"("search_term" "text", "text_to_search" "text", "similarity_threshold" real) TO "anon";
GRANT ALL ON FUNCTION "public"."fuzzy_search_text"("search_term" "text", "text_to_search" "text", "similarity_threshold" real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fuzzy_search_text"("search_term" "text", "text_to_search" "text", "similarity_threshold" real) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_job_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_job_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_job_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_accounting_read_only"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_accounting_read_only"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_accounting_read_only"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_conta_api_key"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_conta_api_key"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_conta_api_key"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_offer_acceptance"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_offer_acceptance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_offer_acceptance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."item_available_qty"("p_company_id" "uuid", "p_item_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."item_available_qty"("p_company_id" "uuid", "p_item_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."item_available_qty"("p_company_id" "uuid", "p_item_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_activity_creator"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_activity_creator"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_activity_creator"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reservations_kind_job_check"() TO "anon";
GRANT ALL ON FUNCTION "public"."reservations_kind_job_check"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reservations_kind_job_check"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_company_user_role"("p_company_id" "uuid", "p_target_user_id" "uuid", "p_new_role" "public"."company_role", "p_actor_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_company_user_role"("p_company_id" "uuid", "p_target_user_id" "uuid", "p_new_role" "public"."company_role", "p_actor_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_company_user_role"("p_company_id" "uuid", "p_target_user_id" "uuid", "p_new_role" "public"."company_role", "p_actor_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_profile_from_auth"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_profile_from_auth"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_from_auth"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_reserved_items_enforce"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_reserved_items_enforce"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_reserved_items_enforce"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_activity_comments_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_activity_comments_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_activity_comments_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_company_expansions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_company_expansions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_company_expansions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_job_invoices_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_job_invoices_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_job_invoices_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_job_offers_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_job_offers_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_job_offers_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_my_avatar"("p_path" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_my_avatar"("p_path" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_my_avatar"("p_path" "text") TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON FUNCTION "public"."update_my_profile"("p_display_name" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_avatar_path" "text", "p_preferences" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_my_profile"("p_display_name" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_avatar_path" "text", "p_preferences" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_my_profile"("p_display_name" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_avatar_path" "text", "p_preferences" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."activity_comments" TO "anon";
GRANT ALL ON TABLE "public"."activity_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_comments" TO "service_role";



GRANT ALL ON TABLE "public"."activity_likes" TO "anon";
GRANT ALL ON TABLE "public"."activity_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_likes" TO "service_role";



GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."addresses" TO "anon";
GRANT ALL ON TABLE "public"."addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."addresses" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_expansions" TO "anon";
GRANT ALL ON TABLE "public"."company_expansions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_expansions" TO "service_role";



GRANT ALL ON TABLE "public"."company_users" TO "anon";
GRANT ALL ON TABLE "public"."company_users" TO "authenticated";
GRANT ALL ON TABLE "public"."company_users" TO "service_role";



GRANT ALL ON TABLE "public"."company_user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."company_user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."company_user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."dev_auth_logs" TO "anon";
GRANT ALL ON TABLE "public"."dev_auth_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."dev_auth_logs" TO "service_role";



GRANT ALL ON TABLE "public"."group_price_history" TO "anon";
GRANT ALL ON TABLE "public"."group_price_history" TO "authenticated";
GRANT ALL ON TABLE "public"."group_price_history" TO "service_role";



GRANT ALL ON TABLE "public"."group_current_price" TO "anon";
GRANT ALL ON TABLE "public"."group_current_price" TO "authenticated";
GRANT ALL ON TABLE "public"."group_current_price" TO "service_role";



GRANT ALL ON TABLE "public"."group_items" TO "anon";
GRANT ALL ON TABLE "public"."group_items" TO "authenticated";
GRANT ALL ON TABLE "public"."group_items" TO "service_role";



GRANT ALL ON TABLE "public"."items" TO "anon";
GRANT ALL ON TABLE "public"."items" TO "authenticated";
GRANT ALL ON TABLE "public"."items" TO "service_role";



GRANT ALL ON TABLE "public"."group_on_hand" TO "anon";
GRANT ALL ON TABLE "public"."group_on_hand" TO "authenticated";
GRANT ALL ON TABLE "public"."group_on_hand" TO "service_role";



GRANT ALL ON TABLE "public"."item_price_history" TO "anon";
GRANT ALL ON TABLE "public"."item_price_history" TO "authenticated";
GRANT ALL ON TABLE "public"."item_price_history" TO "service_role";



GRANT ALL ON TABLE "public"."item_current_price" TO "anon";
GRANT ALL ON TABLE "public"."item_current_price" TO "authenticated";
GRANT ALL ON TABLE "public"."item_current_price" TO "service_role";



GRANT ALL ON TABLE "public"."group_parts" TO "anon";
GRANT ALL ON TABLE "public"."group_parts" TO "authenticated";
GRANT ALL ON TABLE "public"."group_parts" TO "service_role";



GRANT ALL ON TABLE "public"."group_price_history_with_profile" TO "anon";
GRANT ALL ON TABLE "public"."group_price_history_with_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."group_price_history_with_profile" TO "service_role";



GRANT ALL ON TABLE "public"."item_groups" TO "anon";
GRANT ALL ON TABLE "public"."item_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."item_groups" TO "service_role";



GRANT ALL ON TABLE "public"."groups_with_rollups" TO "anon";
GRANT ALL ON TABLE "public"."groups_with_rollups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups_with_rollups" TO "service_role";



GRANT ALL ON TABLE "public"."item_brands" TO "anon";
GRANT ALL ON TABLE "public"."item_brands" TO "authenticated";
GRANT ALL ON TABLE "public"."item_brands" TO "service_role";



GRANT ALL ON TABLE "public"."item_categories" TO "anon";
GRANT ALL ON TABLE "public"."item_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."item_categories" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_index" TO "anon";
GRANT ALL ON TABLE "public"."inventory_index" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_index" TO "service_role";



GRANT ALL ON TABLE "public"."item_index_ext" TO "anon";
GRANT ALL ON TABLE "public"."item_index_ext" TO "authenticated";
GRANT ALL ON TABLE "public"."item_index_ext" TO "service_role";



GRANT ALL ON TABLE "public"."item_price_history_with_profile" TO "anon";
GRANT ALL ON TABLE "public"."item_price_history_with_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."item_price_history_with_profile" TO "service_role";



GRANT ALL ON TABLE "public"."item_related" TO "anon";
GRANT ALL ON TABLE "public"."item_related" TO "authenticated";
GRANT ALL ON TABLE "public"."item_related" TO "service_role";



GRANT ALL ON TABLE "public"."items_with_price" TO "anon";
GRANT ALL ON TABLE "public"."items_with_price" TO "authenticated";
GRANT ALL ON TABLE "public"."items_with_price" TO "service_role";



GRANT ALL ON TABLE "public"."job_contacts" TO "anon";
GRANT ALL ON TABLE "public"."job_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."job_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."job_files" TO "anon";
GRANT ALL ON TABLE "public"."job_files" TO "authenticated";
GRANT ALL ON TABLE "public"."job_files" TO "service_role";



GRANT ALL ON TABLE "public"."job_invoices" TO "anon";
GRANT ALL ON TABLE "public"."job_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."job_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."job_notes" TO "anon";
GRANT ALL ON TABLE "public"."job_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."job_notes" TO "service_role";



GRANT ALL ON TABLE "public"."job_offers" TO "anon";
GRANT ALL ON TABLE "public"."job_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."job_offers" TO "service_role";



GRANT ALL ON TABLE "public"."job_status_history" TO "anon";
GRANT ALL ON TABLE "public"."job_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."job_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."matter_files" TO "anon";
GRANT ALL ON TABLE "public"."matter_files" TO "authenticated";
GRANT ALL ON TABLE "public"."matter_files" TO "service_role";



GRANT ALL ON TABLE "public"."matter_messages" TO "anon";
GRANT ALL ON TABLE "public"."matter_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."matter_messages" TO "service_role";



GRANT ALL ON TABLE "public"."matter_recipients" TO "anon";
GRANT ALL ON TABLE "public"."matter_recipients" TO "authenticated";
GRANT ALL ON TABLE "public"."matter_recipients" TO "service_role";



GRANT ALL ON TABLE "public"."matter_responses" TO "anon";
GRANT ALL ON TABLE "public"."matter_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."matter_responses" TO "service_role";



GRANT ALL ON TABLE "public"."matters" TO "anon";
GRANT ALL ON TABLE "public"."matters" TO "authenticated";
GRANT ALL ON TABLE "public"."matters" TO "service_role";



GRANT ALL ON TABLE "public"."offer_crew_items" TO "anon";
GRANT ALL ON TABLE "public"."offer_crew_items" TO "authenticated";
GRANT ALL ON TABLE "public"."offer_crew_items" TO "service_role";



GRANT ALL ON TABLE "public"."offer_equipment_groups" TO "anon";
GRANT ALL ON TABLE "public"."offer_equipment_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."offer_equipment_groups" TO "service_role";



GRANT ALL ON TABLE "public"."offer_equipment_items" TO "anon";
GRANT ALL ON TABLE "public"."offer_equipment_items" TO "authenticated";
GRANT ALL ON TABLE "public"."offer_equipment_items" TO "service_role";



GRANT ALL ON TABLE "public"."offer_pretty_sections" TO "anon";
GRANT ALL ON TABLE "public"."offer_pretty_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."offer_pretty_sections" TO "service_role";



GRANT ALL ON TABLE "public"."offer_transport_items" TO "anon";
GRANT ALL ON TABLE "public"."offer_transport_items" TO "authenticated";
GRANT ALL ON TABLE "public"."offer_transport_items" TO "service_role";



GRANT ALL ON TABLE "public"."pending_invites" TO "anon";
GRANT ALL ON TABLE "public"."pending_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_invites" TO "service_role";



GRANT ALL ON TABLE "public"."reserved_crew" TO "anon";
GRANT ALL ON TABLE "public"."reserved_crew" TO "authenticated";
GRANT ALL ON TABLE "public"."reserved_crew" TO "service_role";



GRANT ALL ON TABLE "public"."reserved_items" TO "anon";
GRANT ALL ON TABLE "public"."reserved_items" TO "authenticated";
GRANT ALL ON TABLE "public"."reserved_items" TO "service_role";



GRANT ALL ON TABLE "public"."reserved_vehicles" TO "anon";
GRANT ALL ON TABLE "public"."reserved_vehicles" TO "authenticated";
GRANT ALL ON TABLE "public"."reserved_vehicles" TO "service_role";



GRANT ALL ON TABLE "public"."time_periods" TO "anon";
GRANT ALL ON TABLE "public"."time_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."time_periods" TO "service_role";



GRANT ALL ON TABLE "public"."vehicles" TO "anon";
GRANT ALL ON TABLE "public"."vehicles" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicles" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_detail" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_detail" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicle_detail" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_index" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_index" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicle_index" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_index_mat" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_index_mat" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicle_index_mat" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








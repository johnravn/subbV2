CREATE OR REPLACE FUNCTION "public"."set_company_user_role"(
  "p_company_id" "uuid",
  "p_target_user_id" "uuid",
  "p_new_role" "public"."company_role",
  "p_actor_user_id" "uuid"
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
AS $$
declare
  v_actor_role public.company_role;
  v_actor_is_superuser boolean;
  v_target_old_role public.company_role;
  v_owner_count integer;
begin
  -- Allow superusers even if not explicitly in company_users
  select superuser into v_actor_is_superuser
  from public.profiles
  where user_id = p_actor_user_id;

  -- Check actor membership in the company
  select role into v_actor_role
  from public.company_users
  where company_id = p_company_id
    and user_id = p_actor_user_id;

  if v_actor_role is null and coalesce(v_actor_is_superuser, false) = false then
    raise exception 'not_in_company' using hint = 'Actor must be in company.';
  end if;

  if coalesce(v_actor_is_superuser, false) = false
    and v_actor_role not in ('owner','super_user') then
    raise exception 'insufficient_privileges'
      using hint = 'Only owners/super users can change roles.';
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
      raise exception 'last_owner_guard'
        using hint = 'Company must have at least one owner.';
    end if;
  end if;

  update public.company_users
  set role = p_new_role
  where company_id = p_company_id
    and user_id = p_target_user_id;

  return jsonb_build_object('type','ok');
end;
$$;

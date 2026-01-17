-- Add group support for offer equipment items
alter table public.offer_equipment_items
  add column if not exists group_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'offer_equipment_items_group_id_fkey'
  ) then
    alter table public.offer_equipment_items
      add constraint offer_equipment_items_group_id_fkey
      foreign key (group_id)
      references public.item_groups (id)
      on delete set null;
  end if;
end $$;

create index if not exists offer_equipment_items_group_id_idx
  on public.offer_equipment_items (group_id);

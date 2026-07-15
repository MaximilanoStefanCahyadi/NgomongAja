-- The signup trigger copies role + full_name from the signup metadata but not
-- phone, which registration requires (PRD A-1/A-2: delivery contact).
-- CREATE OR REPLACE swaps the function body; the trigger on auth.users that
-- calls it stays untouched.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'buyer'),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

DROP TRIGGER IF EXISTS "trg_sync_profile_from_auth" ON auth.users;

CREATE TRIGGER "trg_sync_profile_from_auth"
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_from_auth();

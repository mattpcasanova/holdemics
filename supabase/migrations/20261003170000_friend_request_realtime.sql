-- Stream friend request changes so players hear about new requests and
-- acceptances live. Clients subscribe on their private "invites:<id>" topic,
-- and RLS ("Players see requests involving them") limits what each receives.
alter publication supabase_realtime add table public.friend_requests;

-- Remove only the optional classroom dataset. Existing bookings prevent deletion.
BEGIN;

SELECT pg_advisory_xact_lock(33726, 28);

CREATE TEMP TABLE demo_reset_hosts ON COMMIT DROP AS
SELECT user_id, split_part(email_key, '@', 1) AS area
FROM public.users
WHERE email = email_key
  AND email_key ~ '^(pnc|metlife|monmouth|airport|asbury|longbranch|redbank)@parkshare-demo\.example$'
  AND full_name LIKE 'ParkShare Demo Host - %'
  AND is_owner
  AND password_hash IS NULL;

DELETE FROM public.parking_spots s
USING demo_reset_hosts h
WHERE s.owner_id = h.user_id
  AND s.address LIKE 'Classroom demo [' || h.area || '-_] - %'
  AND s.title LIKE 'Demo: %'
  AND s.description LIKE 'Fictional classroom listing. No parking is offered at this location. %';

DELETE FROM public.users u
USING demo_reset_hosts h
WHERE u.user_id = h.user_id
  AND NOT EXISTS (SELECT 1 FROM public.parking_spots s WHERE s.owner_id = u.user_id)
  AND NOT EXISTS (SELECT 1 FROM public.reservations r WHERE r.user_id = u.user_id);

COMMIT;

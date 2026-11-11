-- Optional demo data for a fresh schema. NULL hashes deliberately disable login.
-- Never use these users as authenticated accounts; register through /auth/register.
BEGIN;
WITH demo_owner AS (
    INSERT INTO public.users (email, email_key, password_hash, full_name, is_owner)
    VALUES ('demo-owner@example.com', 'demo-owner@example.com', NULL, 'Demo Owner', true)
    RETURNING user_id
), demo_spot AS (
    INSERT INTO public.parking_spots
        (owner_id, address, latitude, longitude, price_per_hour, description, is_available)
    SELECT user_id, '123 Main St', 40.1, -74.5, 5.00, 'Demo driveway parking', true
    FROM demo_owner
    RETURNING spot_id, owner_id
)
INSERT INTO public.reservations (spot_id, user_id, start_time, end_time, total_cost)
SELECT spot_id, owner_id, '2024-01-01 10:00:00+00', '2024-01-01 12:00:00+00', 10.00
FROM demo_spot;
COMMIT;

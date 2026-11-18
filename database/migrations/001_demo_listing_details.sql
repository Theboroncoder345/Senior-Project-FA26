BEGIN;

ALTER TABLE public.parking_spots
    ADD COLUMN IF NOT EXISTS title text,
    ADD COLUMN IF NOT EXISTS parking_type text,
    ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS parking_spots_owner_idx ON public.parking_spots (owner_id);
CREATE INDEX IF NOT EXISTS reservations_user_idx ON public.reservations (user_id);
CREATE INDEX IF NOT EXISTS reservations_spot_time_idx ON public.reservations (spot_id, end_time, start_time);

COMMIT;

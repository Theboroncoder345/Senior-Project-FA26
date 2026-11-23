BEGIN;

ALTER TABLE public.parking_spots
    ADD COLUMN IF NOT EXISTS amenities text[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(amenities) <= 7 AND array_position(amenities, NULL) IS NULL
        AND amenities <@ ARRAY['Covered', 'EV Charging', 'Overnight Parking',
            'Security Camera', 'Accessible Parking', 'Large Vehicle Friendly', '24/7 Access']);

CREATE TABLE IF NOT EXISTS public.favorites (
    favorite_id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
    spot_id integer NOT NULL REFERENCES public.parking_spots (spot_id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, spot_id)
);
CREATE INDEX IF NOT EXISTS favorites_spot_idx ON public.favorites (spot_id);

ALTER TABLE public.reservations
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'completed'));
ALTER TABLE public.reservations DROP CONSTRAINT reservations_no_overlap;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_no_overlap EXCLUDE USING gist
    (spot_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&) WHERE (status = 'active');

COMMIT;

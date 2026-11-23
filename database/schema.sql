-- Fresh database bootstrap, not an upgrade migration. See database/README.md.
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE public.users
(
    user_id serial NOT NULL,
    email text COLLATE pg_catalog."default" NOT NULL,
    email_key text COLLATE "C" NOT NULL,
    password_hash text COLLATE pg_catalog."default",
    full_name text COLLATE pg_catalog."default" NOT NULL,
    is_owner boolean NOT NULL DEFAULT false,
    phone character varying(50) COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT users_email_key_unique UNIQUE (email_key),
    CONSTRAINT users_email_key_not_blank CHECK (length(email_key) > 0),
    CONSTRAINT users_name_not_blank CHECK (length(trim(full_name)) > 0),
    CONSTRAINT users_pkey PRIMARY KEY (user_id)
)

TABLESPACE pg_default;


CREATE TABLE public.parking_spots
(
    spot_id serial NOT NULL,
    owner_id integer NOT NULL,
    address text COLLATE pg_catalog."default" NOT NULL,
    latitude double precision,
    longitude double precision,
    price_per_hour double precision NOT NULL,
    description text NOT NULL,
    is_available boolean NOT NULL DEFAULT true,
    title text,
    parking_type text,
    photo_urls text[] NOT NULL DEFAULT '{}',
    amenities text[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(amenities) <= 7 AND array_position(amenities, NULL) IS NULL
        AND amenities <@ ARRAY['Covered', 'EV Charging', 'Overnight Parking',
            'Security Camera', 'Accessible Parking', 'Large Vehicle Friendly', '24/7 Access']),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT parking_price_nonnegative CHECK (price_per_hour >= 0 AND price_per_hour < 'Infinity'::double precision),
    CONSTRAINT parking_address_not_blank CHECK (length(trim(address)) > 0),
    CONSTRAINT parking_description_not_blank CHECK (length(trim(description)) > 0),
    CONSTRAINT parking_spots_pkey PRIMARY KEY (spot_id),
    CONSTRAINT fk_owner_id FOREIGN KEY (owner_id)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;


CREATE TABLE public.reservations
(
    reservation_id serial NOT NULL,
    spot_id integer NOT NULL,
    user_id integer NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    total_cost numeric(10,2),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT reservations_pkey PRIMARY KEY (reservation_id),
    CONSTRAINT reservation_time_order CHECK (end_time > start_time),
    CONSTRAINT reservations_no_overlap EXCLUDE USING gist
        (spot_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&) WHERE (status = 'active'),
    CONSTRAINT reservations_spot_id_fkey FOREIGN KEY (spot_id)
        REFERENCES public.parking_spots (spot_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT reservations_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;


CREATE TABLE public.favorites (
    favorite_id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
    spot_id integer NOT NULL REFERENCES public.parking_spots (spot_id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, spot_id)
);
CREATE INDEX IF NOT EXISTS favorites_spot_idx ON public.favorites (spot_id);

CREATE INDEX IF NOT EXISTS parking_spots_owner_idx ON public.parking_spots (owner_id);
CREATE INDEX IF NOT EXISTS reservations_user_idx ON public.reservations (user_id);
CREATE INDEX IF NOT EXISTS reservations_spot_time_idx ON public.reservations (spot_id, end_time, start_time);

COMMIT;

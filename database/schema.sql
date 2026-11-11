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
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT reservations_pkey PRIMARY KEY (reservation_id),
    CONSTRAINT reservation_time_order CHECK (end_time > start_time),
    CONSTRAINT reservations_no_overlap EXCLUDE USING gist
        (spot_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&),
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


COMMIT;

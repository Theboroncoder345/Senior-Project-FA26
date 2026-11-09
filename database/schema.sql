CREATE TABLE IF NOT EXISTS public.users
(
    user_id serial NOT NULL,
    email character varying(255) COLLATE pg_catalog."default" NOT NULL,
    password_hash text COLLATE pg_catalog."default" NOT NULL,
    full_name character varying(255) COLLATE pg_catalog."default",
    phone character varying(50) COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (user_id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.users
    OWNER to postgres;

CREATE TABLE IF NOT EXISTS public.parking_spots
(
    spot_id serial NOT NULL,
    owner_id integer NOT NULL,
    address text COLLATE pg_catalog."default" NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    price_per_hour numeric(10,2) NOT NULL,
    is_available boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT parking_spots_pkey PRIMARY KEY (spot_id),
    CONSTRAINT fk_owner_id FOREIGN KEY (owner_id)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.parking_spots
    OWNER to postgres;

CREATE TABLE IF NOT EXISTS public.reservations
(
    reservation_id serial NOT NULL,
    spot_id integer NOT NULL,
    user_id integer NOT NULL,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone NOT NULL,
    total_cost numeric(10,2),
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT reservations_spot_id_fkey FOREIGN KEY (spot_id)
        REFERENCES public.parking_spots (spot_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID,
    CONSTRAINT reservations_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.reservations
    OWNER to postgres;

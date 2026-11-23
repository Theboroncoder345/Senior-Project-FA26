-- Classroom demo only. Every address is a fictional area label and every pin is approximate.
-- Safe to rerun. The reserved host identities and listing labels identify this dataset.
BEGIN;

-- Serialize classroom seed/reset runs without locking out normal application writes.
SELECT pg_advisory_xact_lock(33726, 28);

CREATE TEMP TABLE demo_hosts (
    area text PRIMARY KEY,
    email text UNIQUE NOT NULL,
    name text NOT NULL,
    color text NOT NULL
) ON COMMIT DROP;

INSERT INTO demo_hosts VALUES
    ('pnc',       'pnc@parkshare-demo.example',       'ParkShare Demo Host - Holmdel',         '174675'),
    ('metlife',   'metlife@parkshare-demo.example',   'ParkShare Demo Host - Meadowlands',    '703423'),
    ('monmouth',  'monmouth@parkshare-demo.example',  'ParkShare Demo Host - West Long Branch','4E3678'),
    ('airport',   'airport@parkshare-demo.example',   'ParkShare Demo Host - Newark Airport', '2D4863'),
    ('asbury',    'asbury@parkshare-demo.example',    'ParkShare Demo Host - Asbury Park',    '7B3152'),
    ('longbranch','longbranch@parkshare-demo.example','ParkShare Demo Host - Long Branch',    '1C5957'),
    ('redbank',   'redbank@parkshare-demo.example',   'ParkShare Demo Host - Red Bank',       '56602C');

INSERT INTO public.users (email, email_key, password_hash, full_name, is_owner)
SELECT email, email, NULL, name, true FROM demo_hosts
ON CONFLICT (email_key) DO NOTHING;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM demo_hosts h JOIN public.users u ON u.email_key = h.email
        WHERE u.email <> h.email OR u.full_name <> h.name
           OR NOT u.is_owner OR u.password_hash IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Classroom demo host identity conflicts with an existing account';
    END IF;
END;
$$;

WITH listings (area, slot, title, location, latitude, longitude, price, description, parking_type, available, image_label) AS (
    VALUES
    ('pnc', 1, 'Holmdel Concert Driveway', 'PNC Bank Arts Center area, Holmdel, NJ', 40.3899, -74.1822, 12.50, 'Open driveway for compact cars on concert evenings. Allow extra travel time after the show.', 'Driveway', true, 'Concert+Driveway'),
    ('pnc', 2, 'Parkway Evening Lot', 'PNC Bank Arts Center area, Holmdel, NJ', 40.4002, -74.1790, 16.00, 'Paved outdoor rows with room to turn. Drop-off near the venue would require a separate ride.', 'Outdoor Lot', true, 'Evening+Lot'),
    ('pnc', 3, 'Holmdel Covered Bay', 'PNC Bank Arts Center area, Holmdel, NJ', 40.3867, -74.1723, 19.50, 'Covered space for a sedan with a narrow entry and level pavement.', 'Covered Parking', true, 'Covered+Bay'),
    ('pnc', 4, 'North Holmdel Show Parking', 'PNC Bank Arts Center area, Holmdel, NJ', 40.4063, -74.1695, 10.00, 'Uncovered overflow space intended for event hours.', 'Event Parking', false, 'Show+Parking'),

    ('metlife', 1, 'Meadowlands Game-Day Lot', 'MetLife Stadium area, East Rutherford, NJ', 40.8145, -74.0791, 23.00, 'Wide outdoor lanes suit SUVs. Allow extra time for game-day traffic.', 'Event Parking', true, 'Game-Day+Lot'),
    ('metlife', 2, 'East Rutherford Covered Garage', 'MetLife Stadium area, East Rutherford, NJ', 40.8214, -74.0695, 21.50, 'Covered space with limited clearance. Standard-height cars preferred.', 'Garage', true, 'Covered+Garage'),
    ('metlife', 3, 'Meadowlands Paved Row', 'MetLife Stadium area, Carlstadt, NJ', 40.8259, -74.0750, 16.00, 'Open paved row with a broad entrance for concert and game arrivals.', 'Outdoor Lot', true, 'Paved+Row'),
    ('metlife', 4, 'Carlstadt Evening Driveway', 'MetLife Stadium area, Carlstadt, NJ', 40.8302, -74.0873, 11.50, 'Single uncovered driveway for a compact car. Plan onward transportation to the stadium.', 'Driveway', true, 'Evening+Driveway'),

    ('monmouth', 1, 'West Long Branch Campus Driveway', 'Monmouth University area, West Long Branch, NJ', 40.2869, -74.0127, 6.00, 'Level uncovered driveway for a short campus visit or evening lecture.', 'Driveway', true, 'Campus+Driveway'),
    ('monmouth', 2, 'Campus Concert Overflow', 'Monmouth University area, West Long Branch, NJ', 40.2832, -74.0071, 12.00, 'Open overflow lot intended for evening campus events.', 'Event Parking', true, 'Campus+Overflow'),
    ('monmouth', 3, 'University Carport', 'Monmouth University area, West Long Branch, NJ', 40.2756, -74.0103, 8.50, 'Sheltered bay with a short approach. Best for sedans and hatchbacks.', 'Covered Parking', true, 'University+Carport'),
    ('monmouth', 4, 'South Campus Compact Space', 'Monmouth University area, West Long Branch, NJ', 40.2728, -74.0034, 5.00, 'Compact residential space for weekday afternoon visits.', 'Residential', false, 'Compact+Space'),

    ('airport', 1, 'Elizabeth Overnight Garage', 'Newark Liberty International Airport area, Elizabeth, NJ', 40.6747, -74.1928, 20.00, 'Covered overnight parking with a compact turning area. Arrange your own ride to the terminal.', 'Garage', true, 'Overnight+Garage'),
    ('airport', 2, 'South Newark Flight Lot', 'Newark Liberty International Airport area, Newark, NJ', 40.6995, -74.1862, 14.00, 'Outdoor lot for early departures or overnight stays. Terminal transportation is separate.', 'Outdoor Lot', true, 'Flight+Lot'),
    ('airport', 3, 'Day-Trip Covered Bay', 'Newark Liberty International Airport area, Elizabeth, NJ', 40.6816, -74.2004, 17.50, 'Covered bay sized for a standard sedan, suitable for a short airport trip.', 'Covered Parking', true, 'Day-Trip+Bay'),
    ('airport', 4, 'Elizabeth Early Flight Driveway', 'Newark Liberty International Airport area, Elizabeth, NJ', 40.6685, -74.2015, 10.50, 'Uncovered compact-car driveway for a short booking before a flight.', 'Driveway', false, 'Early+Flight'),

    ('asbury', 1, 'Asbury Boardwalk Day Space', 'Asbury Park boardwalk area, Asbury Park, NJ', 40.2215, -74.0039, 9.00, 'Uncovered space for a beach day. Compact cars have the easiest entry.', 'Residential', true, 'Boardwalk+Space'),
    ('asbury', 2, 'Cookman Evening Garage', 'Downtown Asbury Park, NJ', 40.2165, -74.0100, 11.50, 'Covered downtown garage bay for dinner or a show.', 'Garage', true, 'Evening+Garage'),
    ('asbury', 3, 'Asbury Rail District Lot', 'Asbury Park train station area, Asbury Park, NJ', 40.2179, -74.0160, 6.50, 'Paved open lot for daytime trips near the station.', 'Outdoor Lot', true, 'Rail+District+Lot'),
    ('asbury', 4, 'North Asbury Beach Driveway', 'North Asbury Park, NJ', 40.2291, -74.0033, 8.00, 'Single driveway for a standard passenger car on beach weekends.', 'Driveway', true, 'Beach+Driveway'),

    ('longbranch', 1, 'Pier Village Day Lot', 'Pier Village area, Long Branch, NJ', 40.3034, -73.9852, 10.00, 'Paved day lot for beach and boardwalk visits with room for midsize SUVs.', 'Outdoor Lot', true, 'Pier+Village+Lot'),
    ('longbranch', 2, 'Long Branch Station Carport', 'Long Branch train station area, Long Branch, NJ', 40.2998, -73.9928, 8.00, 'Covered single bay near the rail district for daytime trips.', 'Covered Parking', true, 'Station+Carport'),
    ('longbranch', 3, 'West End Coffee Run Spot', 'West End area, Long Branch, NJ', 40.2841, -73.9859, 5.50, 'Compact residential space for a short visit to the West End.', 'Residential', true, 'West+End+Spot'),
    ('longbranch', 4, 'Oceanfront Weekend Garage', 'Long Branch oceanfront area, Long Branch, NJ', 40.3092, -73.9816, 13.00, 'Covered garage bay for a weekend beach visit. Standard passenger cars only.', 'Garage', false, 'Weekend+Garage'),

    ('redbank', 1, 'Red Bank Theater Night Bay', 'Downtown Red Bank, NJ', 40.3522, -74.0661, 9.50, 'Covered parking for a theater evening and dinner downtown.', 'Covered Parking', true, 'Theater+Night+Bay'),
    ('redbank', 2, 'West Side Rail Driveway', 'Red Bank train station area, Red Bank, NJ', 40.3485, -74.0753, 6.00, 'Level driveway for one compact car near the rail district.', 'Driveway', true, 'Rail+Driveway'),
    ('redbank', 3, 'Red Bank Riverfront Row', 'Red Bank riverfront area, Red Bank, NJ', 40.3544, -74.0722, 7.50, 'Outdoor paved row for short downtown visits and waterfront walks.', 'Outdoor Lot', true, 'Riverfront+Row'),
    ('redbank', 4, 'East Red Bank Day Space', 'East Red Bank, NJ', 40.3499, -74.0572, 4.50, 'Uncovered residential space for daytime use with a narrow entry.', 'Residential', true, 'Day+Space')
), demo_listings AS (
    SELECT u.user_id AS owner_id, l.*,
           'Classroom demo [' || l.area || '-' || l.slot || '] - ' || l.location AS address,
           CASE WHEN l.parking_type = 'Driveway' THEN '/demo-assets/driveway.jpg'
                ELSE 'https://placehold.co/640x420/' || h.color || '/FFFFFF/png?text=Demo+' || l.image_label
           END AS photo_url
    FROM listings l
    JOIN demo_hosts h USING (area)
    JOIN public.users u ON u.email_key = h.email
)
INSERT INTO public.parking_spots
    (owner_id, title, address, latitude, longitude, price_per_hour, description, parking_type, is_available, photo_urls, amenities)
SELECT owner_id, 'Demo: ' || title, address, latitude, longitude, price,
       'Fictional classroom listing. No parking is offered at this location. ' || description,
       parking_type, available, ARRAY[photo_url],
       CASE
           WHEN area = 'airport' AND slot = 1 THEN ARRAY['Covered', 'Overnight Parking']
           WHEN area = 'airport' AND slot = 2 THEN ARRAY['Overnight Parking']
           WHEN parking_type IN ('Garage', 'Covered Parking') THEN ARRAY['Covered']
           WHEN (area, slot) IN (('pnc', 2), ('metlife', 1)) THEN ARRAY['Large Vehicle Friendly']
           ELSE ARRAY[]::text[]
       END
FROM demo_listings d
WHERE NOT EXISTS (
    SELECT 1 FROM public.parking_spots s
    WHERE s.owner_id = d.owner_id AND s.address = d.address
)
ORDER BY area, slot;

COMMIT;

INSERT INTO users (email, password_hash, full_name)
  VALUES ('test@example.com', 'hash', 'Test User');

INSERT INTO parking_spots (owner_id, address, latitude, longitude, price_per_hour)
  VALUES (1, '123 Main St', 40.1, -74.5, 5.00);

INSERT INTO reservations (spot_id, user_id, start_time, end_time, total_cost) 
  VALUES (1, 1, '2024-01-01 10:00', '2024-01-01 12:00', 10.00);

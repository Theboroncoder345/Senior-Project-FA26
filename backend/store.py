from itertools import count
from threading import RLock


parking_spots = [
    {
        "id": 1,
        "address": "123 Main Street",
        "price": 20,
        "description": "Driveway parking near venue",
        "available": True,
        "owner_id": 1
    },
    {
        "id": 2,
        "address": "45 Ocean Avenue",
        "price": 30,
        "description": "Private parking spot",
        "available": True,
        "owner_id": 2
    }
]


reservations = []
# The sample spots must refer to existing registered owners.
users = [
    {"id": 1, "name": "Demo Owner 1", "email": "owner1@example.com", "is_owner": True},
    {"id": 2, "name": "Demo Owner 2", "email": "owner2@example.com", "is_owner": True},
]

# Credentials and sessions stay separate from public user records.
# Legacy /users accounts and demo owners have no password and cannot log in.
password_hashes = {}
sessions = {}

# Protect check-and-write operations across FastAPI's worker threads.
mutation_lock = RLock()

# Start above existing IDs and keep advancing even when records are deleted.
parking_spot_ids = count(max((spot["id"] for spot in parking_spots), default=0) + 1)
reservation_ids = count(max((reservation["id"] for reservation in reservations), default=0) + 1)
user_ids = count(max((user["id"] for user in users), default=0) + 1)

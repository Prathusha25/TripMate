import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "tripmate_db")

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None
    db = None

    @classmethod
    async def connect_db(cls):
        """Initialize Motor client and verify connection."""
        try:
            cls.client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=2000)
            cls.db = cls.client[DATABASE_NAME]
            # Ping database to verify connection
            await cls.client.admin.command('ping')
            logger.info(f"Successfully connected to MongoDB at: {MONGODB_URI.split('@')[-1]}")
            
            # Setup database indexes
            await cls._create_indexes()
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise e

    @classmethod
    async def close_db(cls):
        """Close Motor client connection."""
        if cls.client:
            cls.client.close()
            logger.info("MongoDB connection closed.")

    @classmethod
    async def _create_indexes(cls):
        """Create indexes on collections for search and uniqueness constraint validation."""
        # User collection indexes
        await cls.db.users.create_index("email", unique=True)
        
        # Trips collection indexes
        await cls.db.trips.create_index("user_id")
        await cls.db.trips.create_index("destination")
        
        # Travel Requests indexes
        await cls.db.travel_requests.create_index([("sender_id", 1), ("receiver_id", 1), ("trip_id", 1)], unique=True)
        await cls.db.travel_requests.create_index("sender_id")
        await cls.db.travel_requests.create_index("receiver_id")
        
        # Connections indexes
        await cls.db.connections.create_index([("user1_id", 1), ("user2_id", 1)], unique=True)
        await cls.db.connections.create_index("user1_id")
        await cls.db.connections.create_index("user2_id")
        
        # Messages indexes
        await cls.db.messages.create_index("connection_id")
        await cls.db.messages.create_index("timestamp")

        # Match Interactions indexes
        await cls.db.match_interactions.create_index([("sender_id", 1), ("receiver_id", 1), ("trip_id", 1)], unique=True)
        await cls.db.match_interactions.create_index("sender_id")
        await cls.db.match_interactions.create_index("receiver_id")

        # Reports indexes
        await cls.db.reports.create_index("reported_id")
        await cls.db.reports.create_index("reporter_id")

        # Blocks indexes
        await cls.db.blocks.create_index([("blocker_id", 1), ("blocked_id", 1)], unique=True)
        await cls.db.blocks.create_index("blocker_id")

        # Collaborations indexes
        await cls.db.collaborations.create_index("trip_id", unique=True)

def get_database():
    """Dependency provider for database instance."""
    return Database.db

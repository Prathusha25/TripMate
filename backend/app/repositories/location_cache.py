import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from app.config.db import get_database

logger = logging.getLogger(__name__)

class LocationCacheRepository:
    def __init__(self):
        pass

    def _get_collection(self):
        db = get_database()
        if db is not None:
            return db.location_cache
        return None

    async def get_cached_locations(self, normalized_query: str) -> Optional[List[Dict[str, Any]]]:
        """
        Retrieves cached location search results for a normalized query if not expired (TTL: 7 days).
        """
        try:
            col = self._get_collection()
            if col is None:
                return None

            record = await col.find_one({"normalizedQuery": normalized_query})
            if record:
                # Check expiration (e.g. 7 days TTL)
                created_at = record.get("updatedAt") or record.get("createdAt")
                if isinstance(created_at, datetime):
                    if datetime.utcnow() - created_at > timedelta(days=7):
                        return None
                results = record.get("results")
                if results and isinstance(results, list):
                    return results
        except Exception as e:
            logger.warning(f"Error reading from location_cache in MongoDB: {e}")
        return None

    async def cache_locations(self, query: str, normalized_query: str, results: List[Dict[str, Any]]):
        """
        Caches location search results in MongoDB.
        """
        if not results:
            return

        try:
            col = self._get_collection()
            if col is None:
                return

            now = datetime.utcnow()
            doc = {
                "query": query,
                "normalizedQuery": normalized_query,
                "results": results,
                "updatedAt": now
            }
            await col.update_one(
                {"normalizedQuery": normalized_query},
                {"$set": doc, "$setOnInsert": {"createdAt": now}},
                upsert=True
            )
        except Exception as e:
            logger.warning(f"Error caching locations in MongoDB: {e}")

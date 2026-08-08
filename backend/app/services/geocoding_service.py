import logging
import re
import math
import httpx
from typing import Optional, List, Dict, Any, Tuple, Set
from app.repositories.location_cache import LocationCacheRepository

logger = logging.getLogger(__name__)

OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"

# Comprehensive Curated Travel Destinations Catalog for Instant Match & Typo Reference
POPULAR_DESTINATIONS: List[Dict[str, Any]] = [
    # Top Indian Destinations & Tourist Hubs
    {"name": "Goa", "region": "Goa", "country": "India", "country_code": "IN", "latitude": 15.2993, "longitude": 74.1240, "timezone": "Asia/Kolkata", "population": 1500000, "feature_code": "ADM1", "popularity": 100, "aliases": ["goa", "gao", "panaji", "north goa", "south goa"]},
    {"name": "Manali", "region": "Himachal Pradesh", "country": "India", "country_code": "IN", "latitude": 32.2396, "longitude": 77.1887, "timezone": "Asia/Kolkata", "population": 8096, "feature_code": "PPL", "popularity": 95, "aliases": ["manali", "kullu manali"]},
    {"name": "Munnar", "region": "Kerala", "country": "India", "country_code": "IN", "latitude": 10.0889, "longitude": 77.0595, "timezone": "Asia/Kolkata", "population": 32000, "feature_code": "PPL", "popularity": 92, "aliases": ["munnar", "munar"]},
    {"name": "Ooty", "region": "Tamil Nadu", "country": "India", "country_code": "IN", "latitude": 11.4102, "longitude": 76.6950, "timezone": "Asia/Kolkata", "population": 88430, "feature_code": "PPL", "popularity": 90, "aliases": ["ooty", "udhagamandalam", "oti"]},
    {"name": "Darjeeling", "region": "West Bengal", "country": "India", "country_code": "IN", "latitude": 27.0410, "longitude": 88.2663, "timezone": "Asia/Kolkata", "population": 118805, "feature_code": "PPL", "popularity": 90, "aliases": ["darjeeling", "darjeling", "darjiling"]},
    {"name": "Srinagar", "region": "Jammu and Kashmir", "country": "India", "country_code": "IN", "latitude": 34.0837, "longitude": 74.7973, "timezone": "Asia/Kolkata", "population": 1180570, "feature_code": "PPLA", "popularity": 92, "aliases": ["srinagar", "kashmir", "shrinagar"]},
    {"name": "Jaipur", "region": "Rajasthan", "country": "India", "country_code": "IN", "latitude": 26.9124, "longitude": 75.7873, "timezone": "Asia/Kolkata", "population": 3073350, "feature_code": "PPLA", "popularity": 95, "aliases": ["jaipur", "pink city"]},
    {"name": "Bengaluru", "region": "Karnataka", "country": "India", "country_code": "IN", "latitude": 12.9716, "longitude": 77.5946, "timezone": "Asia/Kolkata", "population": 8443675, "feature_code": "PPLA", "popularity": 96, "aliases": ["bengaluru", "bangalore", "banglore", "bangluru", "blr"]},
    {"name": "Mumbai", "region": "Maharashtra", "country": "India", "country_code": "IN", "latitude": 19.0760, "longitude": 72.8777, "timezone": "Asia/Kolkata", "population": 12442373, "feature_code": "PPLA", "popularity": 98, "aliases": ["mumbai", "bombay", "mumabi", "mumbay"]},
    {"name": "Delhi", "region": "Delhi", "country": "India", "country_code": "IN", "latitude": 28.6139, "longitude": 77.2090, "timezone": "Asia/Kolkata", "population": 16787941, "feature_code": "PPLC", "popularity": 98, "aliases": ["delhi", "new delhi", "delh", "dilli"]},
    {"name": "Hyderabad", "region": "Telangana", "country": "India", "country_code": "IN", "latitude": 17.3850, "longitude": 78.4867, "timezone": "Asia/Kolkata", "population": 6809970, "feature_code": "PPLA", "popularity": 96, "aliases": ["hyderabad", "hydrabad", "hyderbad", "secunderabad", "hyd"]},
    {"name": "Kolkata", "region": "West Bengal", "country": "India", "country_code": "IN", "latitude": 22.5726, "longitude": 88.3639, "timezone": "Asia/Kolkata", "population": 4496694, "feature_code": "PPLA", "popularity": 92, "aliases": ["kolkata", "calcutta", "kolkatta"]},
    {"name": "Chennai", "region": "Tamil Nadu", "country": "India", "country_code": "IN", "latitude": 13.0827, "longitude": 80.2707, "timezone": "Asia/Kolkata", "population": 7088000, "feature_code": "PPLA", "popularity": 92, "aliases": ["chennai", "madras", "chenai"]},
    {"name": "Varanasi", "region": "Uttar Pradesh", "country": "India", "country_code": "IN", "latitude": 25.3176, "longitude": 82.9739, "timezone": "Asia/Kolkata", "population": 1198491, "feature_code": "PPL", "popularity": 94, "aliases": ["varanasi", "banaras", "kashi", "benaras"]},
    {"name": "Agra", "region": "Uttar Pradesh", "country": "India", "country_code": "IN", "latitude": 27.1767, "longitude": 78.0081, "timezone": "Asia/Kolkata", "population": 1585704, "feature_code": "PPL", "popularity": 94, "aliases": ["agra", "taj mahal"]},
    {"name": "Udaipur", "region": "Rajasthan", "country": "India", "country_code": "IN", "latitude": 24.5854, "longitude": 73.7125, "timezone": "Asia/Kolkata", "population": 451100, "feature_code": "PPL", "popularity": 92, "aliases": ["udaipur", "city of lakes"]},
    {"name": "Rishikesh", "region": "Uttarakhand", "country": "India", "country_code": "IN", "latitude": 30.0869, "longitude": 78.2676, "timezone": "Asia/Kolkata", "population": 102138, "feature_code": "PPL", "popularity": 90, "aliases": ["rishikesh", "hrishikesh"]},
    {"name": "Shimla", "region": "Himachal Pradesh", "country": "India", "country_code": "IN", "latitude": 31.1048, "longitude": 77.1734, "timezone": "Asia/Kolkata", "population": 169578, "feature_code": "PPLA", "popularity": 90, "aliases": ["shimla", "simla"]},
    {"name": "Leh", "region": "Ladakh", "country": "India", "country_code": "IN", "latitude": 34.1526, "longitude": 77.5771, "timezone": "Asia/Kolkata", "population": 30870, "feature_code": "PPLA", "popularity": 92, "aliases": ["leh", "ladakh", "leh ladakh"]},
    {"name": "Visakhapatnam", "region": "Andhra Pradesh", "country": "India", "country_code": "IN", "latitude": 17.6868, "longitude": 83.2185, "timezone": "Asia/Kolkata", "population": 2035922, "feature_code": "PPLA", "popularity": 88, "aliases": ["visakhapatnam", "vizag", "vishakapatnam"]},
    {"name": "Tirupati", "region": "Andhra Pradesh", "country": "India", "country_code": "IN", "latitude": 13.6288, "longitude": 79.4192, "timezone": "Asia/Kolkata", "population": 287482, "feature_code": "PPL", "popularity": 88, "aliases": ["tirupati", "tirupathi", "tirumala"]},
    {"name": "Araku Valley", "region": "Andhra Pradesh", "country": "India", "country_code": "IN", "latitude": 18.3273, "longitude": 82.8775, "timezone": "Asia/Kolkata", "population": 5000, "feature_code": "PPL", "popularity": 85, "aliases": ["araku", "araku valley"]},
    {"name": "Pondicherry", "region": "Puducherry", "country": "India", "country_code": "IN", "latitude": 11.9416, "longitude": 79.8083, "timezone": "Asia/Kolkata", "population": 244377, "feature_code": "PPLA", "popularity": 90, "aliases": ["pondicherry", "puducherry", "pondy"]},
    {"name": "Coorg", "region": "Karnataka", "country": "India", "country_code": "IN", "latitude": 12.3375, "longitude": 75.8069, "timezone": "Asia/Kolkata", "population": 32286, "feature_code": "PPL", "popularity": 89, "aliases": ["coorg", "kodagu", "madikeri"]},
    {"name": "Alleppey", "region": "Kerala", "country": "India", "country_code": "IN", "latitude": 9.4981, "longitude": 76.3388, "timezone": "Asia/Kolkata", "population": 174164, "feature_code": "PPL", "popularity": 91, "aliases": ["alleppey", "alappuzha"]},
    {"name": "Hampi", "region": "Karnataka", "country": "India", "country_code": "IN", "latitude": 15.3350, "longitude": 76.4600, "timezone": "Asia/Kolkata", "population": 2777, "feature_code": "PPL", "popularity": 90, "aliases": ["hampi"]},

    # Top International Travel Hubs
    {"name": "Paris", "region": "Île-de-France", "country": "France", "country_code": "FR", "latitude": 48.8566, "longitude": 2.3522, "timezone": "Europe/Paris", "population": 2161000, "feature_code": "PPLC", "popularity": 100, "aliases": ["paris", "pari"]},
    {"name": "London", "region": "England", "country": "United Kingdom", "country_code": "GB", "latitude": 51.5074, "longitude": -0.1278, "timezone": "Europe/London", "population": 8982000, "feature_code": "PPLC", "popularity": 100, "aliases": ["london", "londres"]},
    {"name": "New York", "region": "New York", "country": "United States", "country_code": "US", "latitude": 40.7128, "longitude": -74.0060, "timezone": "America/New_York", "population": 8804190, "feature_code": "PPL", "popularity": 100, "aliases": ["new york", "nyc", "new york city"]},
    {"name": "Dubai", "region": "Dubai", "country": "United Arab Emirates", "country_code": "AE", "latitude": 25.2048, "longitude": 55.2708, "timezone": "Asia/Dubai", "population": 3331420, "feature_code": "PPLA", "popularity": 98, "aliases": ["dubai", "dxb"]},
    {"name": "Tokyo", "region": "Tokyo", "country": "Japan", "country_code": "JP", "latitude": 35.6762, "longitude": 139.6503, "timezone": "Asia/Tokyo", "population": 13960000, "feature_code": "PPLC", "popularity": 100, "aliases": ["tokyo", "tokio"]},
    {"name": "Rome", "region": "Lazio", "country": "Italy", "country_code": "IT", "latitude": 41.9028, "longitude": 12.4964, "timezone": "Europe/Rome", "population": 2873000, "feature_code": "PPLC", "popularity": 97, "aliases": ["rome", "roma"]},
    {"name": "Barcelona", "region": "Catalonia", "country": "Spain", "country_code": "ES", "latitude": 41.3879, "longitude": 2.1699, "timezone": "Europe/Madrid", "population": 1620343, "feature_code": "PPLA", "popularity": 97, "aliases": ["barcelona", "bcn"]},
    {"name": "Bali", "region": "Bali", "country": "Indonesia", "country_code": "ID", "latitude": -8.4095, "longitude": 115.1889, "timezone": "Asia/Makassar", "population": 4362000, "feature_code": "ADM1", "popularity": 98, "aliases": ["bali", "denpasar", "ubud"]},
    {"name": "Bangkok", "region": "Bangkok", "country": "Thailand", "country_code": "TH", "latitude": 13.7563, "longitude": 100.5018, "timezone": "Asia/Bangkok", "population": 10539000, "feature_code": "PPLC", "popularity": 98, "aliases": ["bangkok", "bkk"]},
    {"name": "Singapore", "region": "Singapore", "country": "Singapore", "country_code": "SG", "latitude": 1.3521, "longitude": 103.8198, "timezone": "Asia/Singapore", "population": 5686000, "feature_code": "PPLC", "popularity": 98, "aliases": ["singapore", "singapur"]},
    {"name": "Amsterdam", "region": "North Holland", "country": "Netherlands", "country_code": "NL", "latitude": 52.3676, "longitude": 4.9041, "timezone": "Europe/Amsterdam", "population": 872680, "feature_code": "PPLC", "popularity": 96, "aliases": ["amsterdam", "ams"]},
    {"name": "Sydney", "region": "New South Wales", "country": "Australia", "country_code": "AU", "latitude": -33.8688, "longitude": 151.2093, "timezone": "Australia/Sydney", "population": 5312000, "feature_code": "PPLA", "popularity": 96, "aliases": ["sydney", "syd"]},
    {"name": "Cairo", "region": "Cairo", "country": "Egypt", "country_code": "EG", "latitude": 30.0444, "longitude": 31.2357, "timezone": "Africa/Cairo", "population": 9500000, "feature_code": "PPLC", "popularity": 94, "aliases": ["cairo", "al qahirah"]},
    {"name": "Istanbul", "region": "Istanbul", "country": "Turkey", "country_code": "TR", "latitude": 41.0082, "longitude": 28.9784, "timezone": "Europe/Istanbul", "population": 15460000, "feature_code": "PPLA", "popularity": 96, "aliases": ["istanbul", "constantinople"]},
]


def damerau_levenshtein_distance(s1: str, s2: str) -> int:
    """
    Computes Damerau-Levenshtein distance supporting insertions, deletions, substitutions, and transpositions.
    """
    d: Dict[Tuple[int, int], int] = {}
    len1, len2 = len(s1), len(s2)
    for i in range(-1, len1 + 1):
        d[(i, -1)] = i + 1
    for j in range(-1, len2 + 1):
        d[(-1, j)] = j + 1

    for i in range(len1):
        for j in range(len2):
            cost = 0 if s1[i] == s2[j] else 1
            d[(i, j)] = min(
                d[(i - 1, j)] + 1,        # deletion
                d[(i, j - 1)] + 1,        # insertion
                d[(i - 1, j - 1)] + cost  # substitution
            )
            if i > 0 and j > 0 and s1[i] == s2[j - 1] and s1[i - 1] == s2[j]:
                d[(i, j)] = min(d[(i, j)], d[(i - 2, j - 2)] + cost)  # transposition

    return d[(len1 - 1, len2 - 1)]


def calculate_string_similarity(query: str, target: str) -> float:
    """
    Calculates normalized similarity score between 0.0 and 1.0.
    Handles exact match, prefix, contains, and edit distance.
    """
    q = query.lower().strip()
    t = target.lower().strip()

    if not q or not t:
        return 0.0
    if q == t:
        return 1.0
    if t.startswith(q):
        return 0.92 - (len(t) - len(q)) * 0.01
    if q.startswith(t):
        return 0.88
    if q in t:
        return 0.82

    max_len = max(len(q), len(t))
    if max_len == 0:
        return 1.0
    dist = damerau_levenshtein_distance(q, t)
    sim = max(0.0, 1.0 - (dist / max_len))
    return sim


class GeocodingService:
    cache_repo = LocationCacheRepository()

    @staticmethod
    def normalize_query(query: str) -> str:
        """
        Normalizes destination search query: strips extra whitespace, lowercases, removes punctuation.
        """
        if not query:
            return ""
        cleaned = re.sub(r"\s+", " ", query.strip())
        return cleaned.lower()

    @staticmethod
    def _format_geocoding_result(item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Structures an Open-Meteo raw geocoding result into a consistent destination object.
        """
        name = item.get("name", "")
        country = item.get("country", "")
        country_code = item.get("country_code", "")
        region = item.get("admin1") or item.get("admin2") or ""
        timezone = item.get("timezone", "UTC")
        latitude = float(item.get("latitude", 0.0))
        longitude = float(item.get("longitude", 0.0))
        population = item.get("population")
        feature_code = item.get("feature_code")

        return {
            "name": name,
            "latitude": latitude,
            "longitude": longitude,
            "country": country,
            "country_code": country_code,
            "region": region,
            "timezone": timezone,
            "population": population,
            "feature_code": feature_code
        }

    @classmethod
    def _find_catalog_candidates(cls, query: str) -> List[Tuple[str, Dict[str, Any], float]]:
        """
        Scans curated popular destinations for exact, prefix, alias, and typo matches.
        Returns list of (query_term, destination_obj, similarity_score).
        """
        q = cls.normalize_query(query)
        candidates: List[Tuple[str, Dict[str, Any], float]] = []

        for dest in POPULAR_DESTINATIONS:
            best_sim = 0.0
            # Test direct name
            sim_name = calculate_string_similarity(q, dest["name"])
            if sim_name > best_sim:
                best_sim = sim_name

            # Test aliases
            for alias in dest.get("aliases", []):
                sim_alias = calculate_string_similarity(q, alias)
                if sim_alias > best_sim:
                    best_sim = sim_alias

            # If similarity meets threshold (e.g. >= 0.65 or distance <= 2 for short words)
            dist = damerau_levenshtein_distance(q, dest["name"].lower())
            if best_sim >= 0.70 or dist <= 2 or q in dest["name"].lower():
                candidates.append((dest["name"], dest, max(best_sim, 0.75 if dist <= 1 else 0.60)))

        # Sort candidates by similarity descending
        candidates.sort(key=lambda x: x[2], reverse=True)
        return candidates

    @classmethod
    async def _fetch_from_open_meteo(cls, search_term: str, count: int = 10) -> List[Dict[str, Any]]:
        """
        Performs an asynchronous HTTP GET request to Open-Meteo Geocoding API.
        """
        params = {
            "name": search_term,
            "count": count,
            "language": "en",
            "format": "json"
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(OPEN_METEO_GEOCODING_URL, params=params)
                response.raise_for_status()
                data = response.json()
                raw_results = data.get("results", [])
                return [cls._format_geocoding_result(item) for item in raw_results if "latitude" in item and "longitude" in item]
        except Exception as e:
            logger.debug(f"Open-Meteo Geocoding API request for '{search_term}': {e}")
            return []

    @classmethod
    def _calculate_ranking_score(cls, query: str, item: Dict[str, Any]) -> float:
        """
        Computes composite relevance score for a destination based on:
        - String similarity & typo tolerance (Levenshtein / Jaro-Winkler)
        - Population and administrative level
        - Travel hub / popularity index
        - Country/region matching
        """
        q = cls.normalize_query(query)
        name = item.get("name", "")
        region = item.get("region", "")
        country = item.get("country", "")
        country_code = item.get("country_code", "")
        population = item.get("population") or 0
        feature_code = item.get("feature_code", "")

        # 1. Text Similarity Score (0 - 100)
        sim_name = calculate_string_similarity(q, name)
        # Check if query is an exact transposition / 1-edit typo
        dist = damerau_levenshtein_distance(q, name.lower())
        if q == name.lower():
            text_score = 100.0
        elif dist == 1 and len(q) <= 4:
            # e.g. "gao" vs "goa"
            text_score = 90.0
        elif dist <= 2:
            text_score = max(sim_name * 85.0, 75.0)
        else:
            text_score = sim_name * 80.0

        # Check region / country text matching
        if q in region.lower() or q in country.lower():
            text_score = max(text_score, 65.0)

        # 2. Popularity & Travel Relevance (0 - 45)
        travel_boost = 0.0
        for dest in POPULAR_DESTINATIONS:
            if dest["name"].lower() == name.lower():
                # Compare coordinates to ensure it's the actual destination
                if abs(dest["latitude"] - item["latitude"]) < 1.0 and abs(dest["longitude"] - item["longitude"]) < 1.0:
                    travel_boost = dest.get("popularity", 90) * 0.45
                    break

        # 3. Population Weight (0 - 25)
        pop_score = 0.0
        if population > 5000000:
            pop_score = 25.0
        elif population > 1000000:
            pop_score = 20.0
        elif population > 100000:
            pop_score = 14.0
        elif population > 10000:
            pop_score = 8.0

        # 4. Feature Code Boost (0 - 15)
        feature_score = 0.0
        if feature_code in ["PPLC", "PPLA", "ADM1"]:
            feature_score = 15.0
        elif feature_code in ["PPL", "ADM2"]:
            feature_score = 8.0

        # 5. Penalize obscure places when query is a known travel typo (e.g. Gao, Mali vs Goa, India)
        penalty = 0.0
        if dist == 0 and travel_boost == 0 and pop_score < 5:
            # Obscure exact match
            penalty = 15.0

        total = text_score + travel_boost + pop_score + feature_score - penalty
        return total

    @classmethod
    async def search_destinations(cls, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Intelligently searches for destinations with typo tolerance, alias expansion,
        and travel-popularity ranking.
        """
        if not query or len(query.strip()) < 2:
            return []

        raw_query = query.strip()
        normalized = cls.normalize_query(raw_query)

        # 1. Check MongoDB cache first
        try:
            cached = await cls.cache_repo.get_cached_locations(normalized)
            if cached and len(cached) > 0:
                return cached[:limit]
        except Exception as e:
            logger.debug(f"Cache check skipped: {e}")

        # 2. Identify top fuzzy candidates from curated travel dictionary
        candidates = cls._find_catalog_candidates(raw_query)

        # 3. Multi-Query Open-Meteo Fetching
        search_terms_to_fetch: Set[str] = {raw_query}
        if candidates:
            for term, dest_obj, _ in candidates[:3]:
                search_terms_to_fetch.add(term)

        # Fetch Open-Meteo results for all terms
        all_results: List[Dict[str, Any]] = []

        # Also inject matched catalog destinations directly so they are immediately available
        for _, dest_obj, sim in candidates:
            if sim >= 0.70:
                all_results.append({
                    "name": dest_obj["name"],
                    "latitude": dest_obj["latitude"],
                    "longitude": dest_obj["longitude"],
                    "country": dest_obj["country"],
                    "country_code": dest_obj.get("country_code", ""),
                    "region": dest_obj.get("region", ""),
                    "timezone": dest_obj.get("timezone", "UTC"),
                    "population": dest_obj.get("population"),
                    "feature_code": dest_obj.get("feature_code")
                })

        for term in search_terms_to_fetch:
            res = await cls._fetch_from_open_meteo(term, count=8)
            all_results.extend(res)

        # 4. If query contains comma or multiple words (e.g. "Goa India", "Manali Himachal")
        if "," in raw_query or " " in raw_query:
            parts = [p.strip() for p in re.split(r"[, ]+", raw_query) if p.strip()]
            if parts:
                first_part = parts[0]
                res = await cls._fetch_from_open_meteo(first_part, count=8)
                all_results.extend(res)

        # 5. Deduplicate results by (name, country, rounded lat/lon)
        deduped: List[Dict[str, Any]] = []
        seen = set()
        for r in all_results:
            key = (r["name"].lower(), r.get("country", "").lower(), round(r["latitude"], 2), round(r["longitude"], 2))
            if key not in seen:
                seen.add(key)
                deduped.append(r)

        # 6. Rank all results using the comprehensive travel scoring formula
        ranked = sorted(
            deduped,
            key=lambda item: cls._calculate_ranking_score(raw_query, item),
            reverse=True
        )

        final_results = ranked[:limit]

        # 7. Cache results
        if final_results:
            try:
                await cls.cache_repo.cache_locations(raw_query, normalized, final_results)
            except Exception as e:
                logger.debug(f"Failed to cache geocoding results: {e}")

        return final_results

    @classmethod
    async def resolve_destination(
        cls, 
        query: str, 
        selected_location: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Resolves destination to a structured object containing name, coordinates, country, region, and timezone.
        """
        if selected_location and isinstance(selected_location, dict):
            if "latitude" in selected_location and "longitude" in selected_location:
                return {
                    "name": selected_location.get("name") or query,
                    "latitude": float(selected_location["latitude"]),
                    "longitude": float(selected_location["longitude"]),
                    "country": selected_location.get("country", ""),
                    "country_code": selected_location.get("country_code", ""),
                    "region": selected_location.get("region", ""),
                    "timezone": selected_location.get("timezone", "UTC"),
                    "population": selected_location.get("population"),
                    "feature_code": selected_location.get("feature_code")
                }

        results = await cls.search_destinations(query, limit=5)
        if results and len(results) > 0:
            return results[0]

        return None

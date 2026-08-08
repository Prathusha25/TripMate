import os
import chromadb
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# Base storage path for ChromaDB
CHROMA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chromadb_storage")

class RAGService:
    _client = None
    _collection = None

    @classmethod
    def get_client(cls):
        if cls._client is None:
            cls._client = chromadb.PersistentClient(path=CHROMA_PATH)
        return cls._client

    @classmethod
    def get_collection(cls):
        if cls._collection is None:
            client = cls.get_client()
            from chromadb.utils import embedding_functions
            ollama_ef = embedding_functions.OllamaEmbeddingFunction(
                url=f"{os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')}/api/embeddings",
                model_name=os.getenv("OLLAMA_MODEL", "llama3.1:8b")
            )
            cls._collection = client.get_or_create_collection("tripmate_places", embedding_function=ollama_ef)
        return cls._collection

    @classmethod
    def seed_initial_places(cls):
        """Seed initial popular destinations and activities for RAG search context."""
        collection = cls.get_collection()
        try:
            count = collection.count()
        except Exception:
            count = 0
            
        if count > 0:
            logger.info(f"ChromaDB already seeded with {count} documents.")
            return

        # Seed data for Manali, Goa, London, etc.
        seed_data = [
            # Manali
            {"id": "man_1", "destination": "Manali", "name": "Solang Valley", "description": "Famous for adventure sports like paragliding, zorbing, and skiing with gorgeous snowy peak views.", "why_matches": "Scenic views, photography, and adventure sports.", "activity_type": "Outdoor"},
            {"id": "man_2", "destination": "Manali", "name": "Hadimba Temple", "description": "Wooden temple surrounded by cedar forest, perfect for photography and history enthusiasts.", "why_matches": "Peaceful heritage site with rich historical context.", "activity_type": "Outdoor"},
            {"id": "man_3", "destination": "Manali", "name": "Old Manali Cafes", "description": "Lively cafes offering multi-cuisine street food, live music, and a vibrant evening social scene.", "why_matches": "Vibrant local food, culture, and nightlife experience.", "activity_type": "Indoor"},
            {"id": "man_4", "destination": "Manali", "name": "Jogini Waterfalls", "description": "Scenic trekking trail leading to a gorgeous cascading waterfall, great for photography and nature hiking.", "why_matches": "Trekking trail in nature with scenic views.", "activity_type": "Outdoor"},
            {"id": "man_5", "destination": "Manali", "name": "Mall Road Shopping", "description": "Lively shopping street with local wooden handicrafts, woolens, and popular street food stalls.", "why_matches": "Shopping, local snacks, and casual walk.", "activity_type": "Outdoor"},
            
            # Goa
            {"id": "goa_1", "destination": "Goa", "name": "Baga Beach", "description": "Famous sandy beach popular for water sports, beach shacks, seafood dining, and nightlife.", "why_matches": "Water sports, seafood, and active beach nightlife.", "activity_type": "Outdoor"},
            {"id": "goa_2", "destination": "Goa", "name": "Basilica of Bom Jesus", "description": "UNESCO World Heritage Site with stunning Baroque architecture holding the mortal remains of St. Francis Xavier.", "why_matches": "Historical architecture and cultural heritage.", "activity_type": "Indoor"},
            {"id": "goa_3", "destination": "Goa", "name": "Dudhsagar Falls", "description": "Four-tiered waterfall on the Mandovi River, accessible via a scenic jungle trek and jeep safari.", "why_matches": "Lush forest trek, scenic nature, and photography.", "activity_type": "Outdoor"},
            {"id": "goa_4", "destination": "Goa", "name": "Anjuna Flea Market", "description": "Weekly Wednesday market with vibrant local clothing, accessories, handicrafts, and cultural food stalls.", "why_matches": "Shopping and local cultural experience.", "activity_type": "Outdoor"},
            {"id": "goa_5", "destination": "Goa", "name": "Fontainhas Latin Quarter", "description": "Historic neighborhood in Panaji with brightly colored Portuguese houses, art galleries, and quaint bakeries.", "why_matches": "Photography, European architecture, and food.", "activity_type": "Outdoor"},

            # London
            {"id": "lon_1", "destination": "London", "name": "British Museum", "description": "Dedicated to human history, art and culture, housing a vast collection of world-famous heritage artifacts.", "why_matches": "World-class history, arts, and museum exploration.", "activity_type": "Indoor"},
            {"id": "lon_2", "destination": "London", "name": "Tower Bridge", "description": "Iconic suspension bridge over the River Thames, perfect for evening walks and sunset photography.", "why_matches": "Historic landmark, architecture, and photography.", "activity_type": "Outdoor"},
            {"id": "lon_3", "destination": "London", "name": "Borough Market", "description": "Historic food market offering premium British and international street foods, local delicacies, and pastries.", "why_matches": "Street food, local culinary culture, and market walk.", "activity_type": "Outdoor"},
            {"id": "lon_4", "destination": "London", "name": "Hyde Park", "description": "Huge royal park featuring the Serpentine lake, beautiful gardens, walking trails, and boating activities.", "why_matches": "Nature walk, relaxation, and park scenery.", "activity_type": "Outdoor"},
            {"id": "lon_5", "destination": "London", "name": "Soho Nightlife", "description": "Bustling entertainment district filled with historic pubs, theatres, live music, and restaurants.", "why_matches": "Vibrant night clubs, dining, and nightlife.", "activity_type": "Indoor"},
        ]

        ids = []
        documents = []
        metadatas = []

        for item in seed_data:
            ids.append(item["id"])
            text = f"Destination: {item['destination']}. Place: {item['name']}. Description: {item['description']} Why it matches: {item['why_matches']} Type: {item['activity_type']}"
            documents.append(text)
            metadatas.append({
                "destination": item["destination"],
                "name": item["name"],
                "description": item["description"],
                "why_matches": item["why_matches"],
                "activity_type": item["activity_type"]
            })

        collection.add(ids=ids, documents=documents, metadatas=metadatas)
        logger.info(f"ChromaDB seeded successfully with {len(ids)} places.")

    @classmethod
    def search_places(cls, destination: str, query: Any = "", limit: int = 5) -> List[Dict[str, Any]]:
        """Search places by destination and matching query using semantic similarity or catalog search."""
        if isinstance(query, list):
            search_query = ", ".join([str(q) for q in query if q])
        elif isinstance(query, str):
            search_query = query.strip()
        else:
            search_query = ""

        if not search_query:
            search_query = f"Top attractions and things to do in {destination}"

        dest_clean = destination.split(",")[0].strip().lower()

        try:
            collection = cls.get_collection()
            # Ensure seeded if empty
            if collection.count() == 0:
                cls.seed_initial_places()

            results = collection.query(
                query_texts=[search_query],
                n_results=15
            )
        except Exception as e:
            logger.debug(f"ChromaDB query fallback: {e}")
            results = None

        matched_places = []
        if results and results.get("metadatas") and len(results["metadatas"]) > 0:
            for metadata in results["metadatas"][0]:
                meta_dest = metadata.get("destination", "").lower()
                if dest_clean in meta_dest or meta_dest in dest_clean:
                    matched_places.append({
                        "name": metadata.get("name"),
                        "description": metadata.get("description"),
                        "why_matches": metadata.get("why_matches"),
                        "activity_type": metadata.get("activity_type")
                    })
                    if len(matched_places) >= limit:
                        break

        # In-memory places catalog fallback if ChromaDB returned empty
        if not matched_places:
            catalog = [
                {"destination": "goa", "name": "Baga Beach", "description": "Famous sandy beach with water sports and vibrant sunset shacks.", "why_matches": "Scenic views and beach activities.", "activity_type": "Outdoor"},
                {"destination": "goa", "name": "Basilica of Bom Jesus", "description": "UNESCO World Heritage Baroque landmark in Old Goa.", "why_matches": "Historical architecture and cultural heritage.", "activity_type": "Indoor"},
                {"destination": "goa", "name": "Dudhsagar Waterfalls", "description": "Majestic four-tiered cascading falls in lush greenery.", "why_matches": "Nature hiking, forest trek and photography.", "activity_type": "Outdoor"},
                {"destination": "manali", "name": "Solang Valley", "description": "Picturesque valley famous for mountain sports and scenic views.", "why_matches": "Adventure sports, photography and snowy landscapes.", "activity_type": "Outdoor"},
                {"destination": "manali", "name": "Hadimba Temple", "description": "Ancient wooden temple set amidst towering cedar forests.", "why_matches": "Peaceful heritage site and historic architecture.", "activity_type": "Outdoor"},
                {"destination": "paris", "name": "Eiffel Tower & Champ de Mars", "description": "World-famous iron monument with panoramic views.", "why_matches": "Iconic global landmark and evening illumination.", "activity_type": "Outdoor"},
                {"destination": "paris", "name": "Louvre Museum", "description": "World's largest art museum holding historical masterpieces.", "why_matches": "World-class art and cultural history.", "activity_type": "Indoor"},
                {"destination": "london", "name": "Tower Bridge & Thames Path", "description": "Historic suspension bridge with scenic river walking paths.", "why_matches": "Architecture, heritage and photography.", "activity_type": "Outdoor"},
            ]
            for item in catalog:
                if dest_clean in item["destination"] or item["destination"] in dest_clean:
                    matched_places.append({
                        "name": item["name"],
                        "description": item["description"],
                        "why_matches": item["why_matches"],
                        "activity_type": item["activity_type"]
                    })
                    if len(matched_places) >= limit:
                        break

        return matched_places

    @classmethod
    def add_custom_place(cls, destination: str, name: str, description: str, why_matches: str, activity_type: str = "Outdoor"):
        """Add a custom place dynamically so it can be searched and used in RAG in the future."""
        collection = cls.get_collection()
        import time
        doc_id = f"custom_{int(time.time())}"
        text = f"Destination: {destination}. Place: {name}. Description: {description} Why it matches: {why_matches} Type: {activity_type}"
        collection.add(
            ids=[doc_id],
            documents=[text],
            metadatas=[{
                "destination": destination,
                "name": name,
                "description": description,
                "why_matches": why_matches,
                "activity_type": activity_type
            }]
        )
        logger.info(f"Custom place '{name}' added to ChromaDB for destination '{destination}'.")

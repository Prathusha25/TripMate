# app/models/itinerary.py
# Under Motor/PyMongo, we work directly with BSON dictionary documents.
# This model file defines the database collection metadata for AI Itineraries.

class AIItineraryModel:
    COLLECTION_NAME = "ai_plans"
    
    # Schema Fields Reference:
    # - _id: ObjectId
    # - trip_id: str
    # - user_id: str
    # - destination: str
    # - days: Array of ItineraryDay objects
    # - recommendations: Array of PlaceRecommendation objects
    # - outfit_recommendations: Array of OutfitRecommendation objects
    # - packing_checklist: Array of PackingItem objects
    # - created_at: datetime
    # - updated_at: datetime

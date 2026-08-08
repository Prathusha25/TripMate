from bson import ObjectId

def serialize_doc(doc) -> dict:
    """Converts MongoDB document _id to string id and returns a copy."""
    if doc is None:
        return None
    
    serialized = dict(doc)
    if "_id" in serialized:
        serialized["id"] = str(serialized["_id"])
        del serialized["_id"]
        
    # Recursively serialize nested objects or ObjectIds if any
    for key, value in serialized.items():
        if isinstance(value, ObjectId):
            serialized[key] = str(value)
            
    return serialized

def serialize_docs(docs) -> list:
    """Converts a list of MongoDB documents."""
    return [serialize_doc(doc) for doc in docs if doc is not None]

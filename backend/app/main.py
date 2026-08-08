import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.config.db import Database
from app.routes import auth, users, trips, discovery, requests, connections, messages, ai, weather, ml, safety, collaboration, admin, notifications, ai_planner, ai_standalone, locations


# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Load env configuration
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events to manage database connection."""
    logger.info("Initializing TripMate AI Backend Services...")
    try:
        await Database.connect_db()
        # Seed ChromaDB vector store for local RAG
        from app.services.rag_service import RAGService
        RAGService.seed_initial_places()
    except Exception as e:
        logger.error(f"Critical error on startup: {e}")
        # Allow server to run even if Mongo is down initially, to avoid instant crashes 
        # and allow users to see nice error states.
    yield
    logger.info("Shutting down TripMate AI Backend Services...")
    await Database.close_db()

app = FastAPI(
    title="TripMate AI — API Backend",
    version="1.0.0",
    description="Backend services for TripMate AI - Social Travel & AI Planning Platform",
    lifespan=lifespan
)

# CORS Middleware Configuration
# Allow frontend origins (Vite defaults to localhost:5173)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "*"  # Allow wildcard for flexible local dev testing
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routes
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(trips.router)
app.include_router(discovery.router)
app.include_router(requests.router)
app.include_router(connections.router)
app.include_router(messages.router)
app.include_router(ai.router)
app.include_router(weather.router)
app.include_router(weather.forecast_router)
app.include_router(ai_planner.router)
app.include_router(ml.router)
app.include_router(safety.router)
app.include_router(collaboration.router)
app.include_router(admin.router)
app.include_router(notifications.router)
app.include_router(ai_standalone.router)
app.include_router(locations.router)


@app.get("/")
async def root():
    """Verify service liveness."""
    return {
        "status": "online",
        "app": "TripMate AI API Backend",
        "version": "1.0.0",
        "phase": 1
    }

from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, connection_id: str, websocket: WebSocket):
        await websocket.accept()
        if connection_id not in self.active_connections:
            self.active_connections[connection_id] = []
        self.active_connections[connection_id].append(websocket)

    def disconnect(self, connection_id: str, websocket: WebSocket):
        if connection_id in self.active_connections:
            if websocket in self.active_connections[connection_id]:
                self.active_connections[connection_id].remove(websocket)
            if not self.active_connections[connection_id]:
                del self.active_connections[connection_id]

    async def broadcast(self, connection_id: str, message: dict):
        if connection_id in self.active_connections:
            for connection in self.active_connections[connection_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()

@app.websocket("/ws/chat/{connection_id}")
async def websocket_endpoint(websocket: WebSocket, connection_id: str, token: str = None):
    from app.config.db import get_database
    from app.utils.security import decode_access_token
    from app.repositories.message import MessageRepository
    
    db = get_database()
    
    # Parse token from query parameters
    user_id = None
    if token:
        payload = decode_access_token(token)
        if payload:
            user_id = payload.get("sub")

    if db is not None:
        conn = await db.connections.find_one({"id": connection_id})
        if not conn:
            await websocket.close(code=4004)
            return
        if user_id and user_id != conn["user1_id"] and user_id != conn["user2_id"]:
            await websocket.close(code=4003)
            return

    await manager.connect(connection_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            content = message_data.get("content")
            sender_id = message_data.get("sender_id")

            if not content or not sender_id:
                continue

            # Censor content
            from app.routes.messages import censor_content
            censored_text = censor_content(content)

            if db is not None:
                conn = await db.connections.find_one({"id": connection_id})
            receiver_id = conn["user2_id"] if conn["user1_id"] == sender_id else conn["user1_id"]

            # Save message to DB
            message_repo = MessageRepository()
            new_msg = await message_repo.create_message(
                connection_id=connection_id,
                sender_id=sender_id,
                receiver_id=receiver_id,
                content=censored_text
            )

            # Send Notification
            try:
                from app.services.notification_service import NotificationService
                sender_user = await db.users.find_one({"id": sender_id})
                sender_name = sender_user["name"] if sender_user else "Buddy"
                await NotificationService.create_notification(
                    user_id=receiver_id,
                    type_="new_message",
                    title="New Private Message",
                    message=f"{sender_name}: {censored_text[:50]}...",
                    link=f"/chat/{connection_id}"
                )
            except Exception as e:
                logger.error(f"Error creating notification: {e}")

            broadcast_msg = {
                "id": new_msg["id"],
                "connection_id": connection_id,
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "content": censored_text,
                "timestamp": new_msg["timestamp"].isoformat() if hasattr(new_msg["timestamp"], "isoformat") else str(new_msg["timestamp"]),
                "is_read": False
            }
            await manager.broadcast(connection_id, broadcast_msg)
    except WebSocketDisconnect:
        manager.disconnect(connection_id, websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(connection_id, websocket)

# Reload trigger comment to refresh memory state 5


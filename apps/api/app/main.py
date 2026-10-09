import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Add project root ('finance-ai') to sys.path so modules like 'services' are findable
ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import firebase_admin
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import chat, expenses, receipts, reports, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initializes Firebase Auth, Firestore, and Storage using default credentials
    if not firebase_admin._apps:
        from app import firestore_client  # noqa: F401
    yield


app = FastAPI(title="Finance AI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(receipts.router)
app.include_router(expenses.router)
app.include_router(reports.router)
app.include_router(chat.router)
app.include_router(users.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
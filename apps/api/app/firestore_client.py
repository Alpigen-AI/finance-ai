"""
Firestore access layer using Firebase Admin Async Client.
"""
from __future__ import annotations

import os
from pathlib import Path
import firebase_admin
from firebase_admin import credentials, firestore_async

# Re-export FieldFilter, Increment, and ArrayUnion for routers
from google.cloud.firestore_v1 import FieldFilter, Increment, ArrayUnion  # noqa: F401

from app.config import settings

# 1. Resolve service account path relative to this file or root directory
BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SA_PATH = BASE_DIR / "service-account.json"

sa_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", str(DEFAULT_SA_PATH))

# 2. Safely initialize Firebase Admin App
if not firebase_admin._apps:
    if os.path.exists(sa_path):
        print(f"Loading Firebase Credentials from: {os.path.abspath(sa_path)}")
        cred = credentials.Certificate(sa_path)
        firebase_admin.initialize_app(cred, {
            "projectId": settings.gcp_project_id,
            "storageBucket": settings.firebase_storage_bucket,
        })
    else:
        print("WARNING: service-account.json not found! Initializing with Default Application Credentials.")
        firebase_admin.initialize_app(
            options={
                "projectId": settings.gcp_project_id,
                "storageBucket": settings.firebase_storage_bucket,
            }
        )

# 3. Obtain client after app initialization, explicitly passing project_id
db = firestore_async.client()


def get_client():
    return db


def user_doc(uid: str):
    return db.collection("users").document(uid)


def user_subcollection(uid: str, name: str):
    return user_doc(uid).collection(name)
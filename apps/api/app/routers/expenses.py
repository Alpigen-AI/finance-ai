from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from google.genai import types
from pydantic import BaseModel
from services.ai.tax_rules import resolve_tax_code

from app.auth import AuthedUser, get_current_user, require_scan_entitlement
from app.firestore_client import FieldFilter, user_subcollection
from app.storage import upload_receipt_image
from services.ai.agents.receipt_agent import (
    runner,
    session_service,
    parse_agent_output,
)
from services.ai.tax_rules import get_tax_rules

router = APIRouter(prefix="/expenses", tags=["expenses"])

def monthly_expenses_ref(uid: str, month: str):
    """
    Firestore structure:

    users/{uid}/expenses/{month}/items/{expense_id}
    """
    return (
        user_subcollection(uid, "expenses")
        .document(month)
        .collection("items")
    )


# ── Step A (optional): AI extraction — suggests fields, saves NOTHING ──

@router.post("/extract")
async def extract_from_upload(
    file: UploadFile,
    user: AuthedUser = Depends(require_scan_entitlement),
):
    """Camera photo or screenshot — same endpoint either way, AI doesn't
    care which. Returns suggested fields for the user to review/edit.
    Nothing is written to expenses here — this only stages a receipt doc
    and gives the client something to prefill the manual-entry form with."""
    image_bytes = await file.read()
    image_url = await upload_receipt_image(user.uid, image_bytes, file.content_type)

    receipt_ref = user_subcollection(user.uid, "receipts").document(str(uuid.uuid4()))
    await receipt_ref.set({
        "imageUrl": image_url,
        "status": "pending",
        "source": "upload",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    try:
        session_id = str(uuid.uuid4())

        await session_service.create_session(
            app_name="alpigen_ai",
            user_id=user.uid,
            session_id=session_id,
        )

        mime_type = file.content_type or "image/jpeg"

        content = types.Content(
            role="user",
            parts=[
                types.Part(
                    text=f"""
Analyze this receipt image.

User country: {user.country}

Use the receipt image itself as the source of truth.

Follow all receipt extraction and tax categorization instructions.
Return ONLY the required JSON object.
"""
                ),
                types.Part(
                    inline_data=types.Blob(
                        mime_type=mime_type,
                        data=image_bytes,
                    )
                ),
            ],
        )

        final_text = None

        async for event in runner.run_async(
            user_id=user.uid,
            session_id=session_id,
            new_message=content,
        ):
            if event.is_final_response():
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if part.text:
                            final_text = part.text
                            break

        if not final_text:
            raise ValueError("Receipt agent returned no final response")

        parsed = parse_agent_output(final_text)

    except Exception as exc:  # noqa: BLE001
        import traceback

        print("\n========== RECEIPT AI ERROR ==========")
        print(f"ERROR TYPE: {type(exc).__name__}")
        print(f"ERROR: {exc}")
        traceback.print_exc()
        print("======================================\n")

        await receipt_ref.update({"status": "failed"})

        raise HTTPException(
            status_code=502,
            detail=f"Couldn't read that image: {exc}",
        ) from exc

    engine = get_tax_rules(user.country)
    valid_codes = {c.code for c in engine.categories()}
    labels_by_code = {c.code: c.label for c in engine.categories()}
    for item in parsed["line_items"]:
        if item.get("tax_code") not in valid_codes:
            item["tax_code"] = engine.default_category().code
        item["tax_label"] = labels_by_code[item["tax_code"]]

    if parsed.get("tax_code") not in valid_codes:
        parsed["tax_code"] = engine.default_category().code

    parsed["tax_label"] = labels_by_code[parsed["tax_code"]]

    await receipt_ref.update({"status": "pending_review", **parsed})
    return {"receipt_id": receipt_ref.id, "extracted": parsed}


# ── Step B: the ONE creation endpoint — same path whether the fields ──
# ── came from typing or from confirming an AI extraction ──────────────

class ExpenseCreateRequest(BaseModel):
    vendor: str
    amount: float
    expense_date: str
    tax_code: str
    is_deductible: bool = True
    notes: str | None = None
    receipt_id: str | None = None


@router.post("/{month}")
async def create_expense(
    month: str,
    body: ExpenseCreateRequest,
    user: AuthedUser = Depends(get_current_user),
):
    category = resolve_tax_code(
        user.country,
        body.tax_code
    )

    ref = monthly_expenses_ref(
        user.uid,
        month
    ).document()

    payload = {
        "vendor": body.vendor,
        "amount": body.amount,
        "currency": "USD" if user.country == "US" else "INR",
        "expenseDate": body.expense_date,
        "taxCode": category.code,
        "taxLabel": category.label,
        "country": user.country,
        "isDeductible": body.is_deductible,
        "notes": body.notes,
        "receiptId": body.receipt_id,
        "source": "receipt" if body.receipt_id else "manual",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    await ref.set(payload)

    if body.receipt_id:
        receipt_ref = (
            user_subcollection(user.uid, "receipts")
            .document(body.receipt_id)
        )

        await receipt_ref.update({
            "status": "processed"
        })

    return {
        "id": ref.id,
        "month": month,
        "status": "created",
        **payload,
    }


@router.get("/{month}")
async def list_expenses(
    month: str,
    user: AuthedUser = Depends(get_current_user),
):
    ref = monthly_expenses_ref(
        user.uid,
        month
    )

    docs = [
        {
            "id": doc.id,
            **doc.to_dict()
        }
        async for doc in ref.stream()
    ]

    docs.sort(
        key=lambda x: x.get("expenseDate", ""),
        reverse=True
    )

    return {
        "month": month,
        "expenses": docs,
    }


class ExpenseUpdateRequest(BaseModel):
    vendor: str | None = None
    amount: float | None = None
    expense_date: str | None = None
    tax_code: str | None = None
    is_deductible: bool | None = None
    notes: str | None = None


@router.patch("/{month}/{expense_id}")
async def update_expense(
    month: str,
    expense_id: str,
    body: ExpenseUpdateRequest,
    user: AuthedUser = Depends(get_current_user),
):
    ref = (
        monthly_expenses_ref(
            user.uid,
            month
        )
        .document(expense_id)
    )

    snapshot = await ref.get()

    if not snapshot.exists:
        raise HTTPException(
            404,
            "Expense not found"
        )

    updates = {}

    if body.vendor is not None:
        updates["vendor"] = body.vendor

    if body.amount is not None:
        updates["amount"] = body.amount

    if body.expense_date is not None:
        updates["expenseDate"] = body.expense_date

    if body.tax_code is not None:
        category = resolve_tax_code(
            user.country,
            body.tax_code
        )

        updates["taxCode"] = category.code
        updates["taxLabel"] = category.label

    if body.is_deductible is not None:
        updates["isDeductible"] = body.is_deductible

    if body.notes is not None:
        updates["notes"] = body.notes

    if updates:
        await ref.update(updates)

    return {
        "status": "updated",
        "id": expense_id,
        "month": month,
    }


@router.delete("/{month}/{expense_id}")
async def delete_expense(
    month: str,
    expense_id: str,
    user: AuthedUser = Depends(get_current_user),
):
    ref = (
        monthly_expenses_ref(
            user.uid,
            month
        )
        .document(expense_id)
    )

    snapshot = await ref.get()

    if not snapshot.exists:
        raise HTTPException(
            404,
            "Expense not found"
        )

    await ref.delete()

    return {
        "status": "deleted",
        "id": expense_id,
        "month": month,
    }
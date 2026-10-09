"""
Receipt ingestion router — handles upload and AI extraction only.

Flow:
  1. POST /receipts -> Uploads receipt, runs AI extraction, saves staging receipt doc (status = "pending_review").
     Returns extracted fields (vendor, total, line items, date) to client.
  2. The client pre-fills its form using the returned extraction data.
  3. When the user confirms, the client posts directly to POST /expenses (passing body.receipt_id).
     That single endpoint handles writing the final expense record and updating receipt status to "processed".
"""
import uuid
from datetime import datetime, timezone
from services.ai.tax_rules import resolve_tax_code

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.auth import AuthedUser, get_current_user, require_scan_entitlement
from app.firestore_client import Increment, user_doc, user_subcollection , FieldFilter
from app.storage import upload_receipt_image
from services.ai.agents.receipt_agent import parse_agent_output, receipt_agent
from services.ai.tax_rules import resolve_tax_code

router = APIRouter(prefix="/receipts", tags=["receipts"])



@router.get("")
async def list_receipts(limit: int = 20, user: AuthedUser = Depends(get_current_user)):
    """Recent scans list — used by mobile/web Expense History screens."""
    query = (
        user_subcollection(user.uid, "receipts")
        .order_by("createdAt", direction="DESCENDING")
        .limit(limit)
    )
    docs = [{"id": d.id, **d.to_dict()} async for d in query.stream()]
    return {"receipts": docs}


@router.get("/{receipt_id}")
async def get_receipt(receipt_id: str, user: AuthedUser = Depends(get_current_user)):
    """Fetch details/status of a specific receipt."""
    snapshot = await user_subcollection(user.uid, "receipts").document(receipt_id).get()
    if not snapshot.exists:
        raise HTTPException(404, "Receipt not found")
    return {"id": snapshot.id, **snapshot.to_dict()}


@router.post("")
async def upload_and_extract_receipt(
    file: UploadFile,
    user: AuthedUser = Depends(require_scan_entitlement),
):
    """
    Step 1: Upload image, run AI extraction, stage the receipt doc.
    Saves NOTHING to the expenses collection.
    Returns extracted fields so the app can prefill the expense entry form.
    """
    image_bytes = await file.read()
    image_url = await upload_receipt_image(user.uid, image_bytes, file.content_type)

    receipts_ref = user_subcollection(user.uid, "receipts")
    receipt_ref = receipts_ref.document(str(uuid.uuid4()))
    await receipt_ref.set({
        "imageUrl": image_url,
        "status": "pending",
        "source": "upload",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    try:
        agent_response = await receipt_agent.run_async(
            input={"image_url": image_url, "country": user.country}
        )
        parsed = parse_agent_output(agent_response.text)
    except Exception as exc:  # noqa: BLE001
        await receipt_ref.update({"status": "failed"})
        raise HTTPException(502, f"Receipt extraction failed: {exc}") from exc

    # Validate/normalize tax codes using shared tax rule resolver
    for item in parsed.get("line_items", []):
        category = resolve_tax_code(user.country, item.get("tax_code", ""))
        item["tax_code"] = category.code
        item["tax_label"] = category.label

    await receipt_ref.update({
        "status": "pending_review",
        "vendor": parsed.get("vendor"),
        "totalAmount": parsed.get("total_amount"),
        "currency": parsed.get("currency"),
        "purchaseDate": parsed.get("purchase_date"),
        "lineItems": parsed.get("line_items", []),
        "rawAgentOutput": agent_response.text,
    })

    # Record scan entitlement usage
    await user_doc(user.uid).update({"freeScansUsed": Increment(1)})

    return {"receipt_id": receipt_ref.id, "status": "pending_review", "extracted": parsed}
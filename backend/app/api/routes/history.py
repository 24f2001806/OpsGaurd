from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.monitoring import HistoryItem
from app.services import history_service

router = APIRouter()


@router.get("/endpoints/{endpoint_id}/history", response_model=List[HistoryItem])
def get_history(
    endpoint_id: int,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return history_service.get_history(db, current_user.id, endpoint_id, limit)
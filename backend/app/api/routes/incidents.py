from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.incident import IncidentResponse
from app.services import history_service

router = APIRouter()


@router.get("/incidents", response_model=List[IncidentResponse])
def list_incidents(
    status: Optional[str] = None,  # optional filter: ?status=OPEN or RESOLVED
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return history_service.get_all_incidents(db, current_user.id, status)


@router.get("/endpoints/{endpoint_id}/incidents", response_model=List[IncidentResponse])
def get_endpoint_incidents(
    endpoint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return history_service.get_incidents_for_endpoint(db, current_user.id, endpoint_id)
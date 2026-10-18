from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.alert import AlertConfigResponse, AlertConfigUpdate
from app.services import alert_service

router = APIRouter()


@router.get("/endpoints/{endpoint_id}/alerts", response_model=AlertConfigResponse)
def get_alerts(
    endpoint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return alert_service.get_or_create_config(db, current_user.id, endpoint_id)


@router.put("/endpoints/{endpoint_id}/alerts", response_model=AlertConfigResponse)
def update_alerts(
    endpoint_id: int,
    data: AlertConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return alert_service.update_config(db, current_user.id, endpoint_id, data)
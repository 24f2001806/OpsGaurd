from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.monitored_endpoint import MonitoredEndpoint
from app.schemas.endpoint import EndpointCreate, EndpointUpdate
from app.services import queue_service


def list_endpoints(db: Session, user_id: int):
    stmt = select(MonitoredEndpoint).where(MonitoredEndpoint.user_id == user_id).order_by(MonitoredEndpoint.id)
    return list(db.scalars(stmt).all())


def get_endpoint(db: Session, user_id: int, endpoint_id: int) -> MonitoredEndpoint:
    stmt = select(MonitoredEndpoint).where(
        MonitoredEndpoint.id == endpoint_id,
        MonitoredEndpoint.user_id == user_id,
    )
    endpoint = db.scalar(stmt)
    if endpoint is None:
        # same 404 whether it doesn't exist or belongs to someone else
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")
    return endpoint


def create_endpoint(db: Session, user_id: int, data: EndpointCreate) -> MonitoredEndpoint:
    endpoint = MonitoredEndpoint(
        user_id=user_id,
        name=data.name,
        url=str(data.url),
        check_interval=data.check_interval,
        fast_check_interval=data.fast_check_interval,
        current_state="UNKNOWN",
    )
    db.add(endpoint)
    db.commit()
    db.refresh(endpoint)
    queue_service.enqueue_first_check(endpoint)
    return endpoint


def update_endpoint(db: Session, user_id: int, endpoint_id: int, data: EndpointUpdate) -> MonitoredEndpoint:
    endpoint = get_endpoint(db, user_id, endpoint_id)
    was_enabled = endpoint.enabled

    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if value is None:
            continue
        if field == "url":
            value = str(value)
        setattr(endpoint, field, value)

    # re-check the rule after merging with the existing values
    if endpoint.fast_check_interval >= endpoint.check_interval:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="fast_check_interval must be smaller than check_interval",
        )

    db.commit()
    db.refresh(endpoint)

    # Resuming: the worker dropped its job while the endpoint was paused,
    # so nothing is scheduled any more. Start a new chain of checks.
    if endpoint.enabled and not was_enabled:
        queue_service.enqueue_first_check(endpoint)

    return endpoint

def delete_endpoint(db: Session, user_id: int, endpoint_id: int) -> None:
    endpoint = get_endpoint(db, user_id, endpoint_id)
    db.delete(endpoint)
    db.commit()
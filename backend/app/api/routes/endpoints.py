from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.endpoint import EndpointCreate, EndpointResponse, EndpointUpdate
from app.services import endpoint_service

router = APIRouter()


@router.post("", response_model=EndpointResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    data: EndpointCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return endpoint_service.create_endpoint(db, current_user.id, data)


@router.get("", response_model=List[EndpointResponse])
def list_endpoints(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return endpoint_service.list_endpoints(db, current_user.id)


@router.get("/{endpoint_id}", response_model=EndpointResponse)
def get_endpoint(
    endpoint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return endpoint_service.get_endpoint(db, current_user.id, endpoint_id)


@router.put("/{endpoint_id}", response_model=EndpointResponse)
def update_endpoint(
    endpoint_id: int,
    data: EndpointUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return endpoint_service.update_endpoint(db, current_user.id, endpoint_id, data)


@router.delete("/{endpoint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    endpoint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    endpoint_service.delete_endpoint(db, current_user.id, endpoint_id)
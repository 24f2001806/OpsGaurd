from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alert_configuration import AlertConfiguration
from app.schemas.alert import AlertConfigUpdate
from app.services import endpoint_service


def get_or_create_config(db: Session, user_id: int, endpoint_id: int) -> AlertConfiguration:
    endpoint = endpoint_service.get_endpoint(db, user_id, endpoint_id)
    config = db.scalar(
        select(AlertConfiguration).where(AlertConfiguration.endpoint_id == endpoint.id)
    )
    if config is None:
        config = AlertConfiguration(endpoint_id=endpoint.id)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def update_config(db: Session, user_id: int, endpoint_id: int, data: AlertConfigUpdate):
    config = get_or_create_config(db, user_id, endpoint_id)
    config.email_enabled = data.email_enabled
    config.slack_enabled = data.slack_enabled
    config.email_address = str(data.email_address) if data.email_enabled else None
    config.slack_webhook = str(data.slack_webhook) if data.slack_enabled else None
    db.commit()
    db.refresh(config)
    return config
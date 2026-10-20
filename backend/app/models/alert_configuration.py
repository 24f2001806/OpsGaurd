from typing import Optional

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class AlertConfiguration(Base):
    __tablename__ = "alert_configurations"

    id: Mapped[int] = mapped_column(primary_key=True)
    endpoint_id: Mapped[int] = mapped_column(
        ForeignKey("monitored_endpoints.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    slack_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    email_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    slack_webhook: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
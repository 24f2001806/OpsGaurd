from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, HttpUrl, model_validator


class AlertConfigUpdate(BaseModel):
    email_enabled: bool = False
    slack_enabled: bool = False
    email_address: Optional[EmailStr] = None
    slack_webhook: Optional[HttpUrl] = None

    @model_validator(mode="after")
    def required_when_enabled(self):
        if self.email_enabled and not self.email_address:
            raise ValueError("email_address is required when email_enabled is true")
        if self.slack_enabled and not self.slack_webhook:
            raise ValueError("slack_webhook is required when slack_enabled is true")
        return self


class AlertConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    endpoint_id: int
    email_enabled: bool
    slack_enabled: bool
    email_address: Optional[str] = None
    slack_webhook: Optional[str] = None
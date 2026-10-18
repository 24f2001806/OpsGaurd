from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


class EndpointCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    url: HttpUrl  # only accepts http:// or https:// URLs
    check_interval: int = Field(default=60, ge=1)
    fast_check_interval: int = Field(default=10, ge=1)

    @model_validator(mode="after")
    def fast_must_be_smaller(self):
        if self.fast_check_interval >= self.check_interval:
            raise ValueError("fast_check_interval must be smaller than check_interval")
        return self


class EndpointUpdate(BaseModel):
    # every field optional: send only what you want to change
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    url: Optional[HttpUrl] = None
    check_interval: Optional[int] = Field(default=None, ge=1)
    fast_check_interval: Optional[int] = Field(default=None, ge=1)
    enabled: Optional[bool] = None


class EndpointResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    url: str
    check_interval: int
    fast_check_interval: int
    current_state: str
    consecutive_failures: int
    enabled: bool
    last_check_at: Optional[datetime] = None
    last_success_at: Optional[datetime] = None
    last_failure_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
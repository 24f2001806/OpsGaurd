from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class IncidentResponse(BaseModel):
    id: int
    endpoint_id: int
    endpoint_name: Optional[str] = None
    started_at: datetime
    resolved_at: Optional[datetime] = None
    status: str  # OPEN or RESOLVED
    duration_seconds: Optional[int] = None  # only filled when resolved
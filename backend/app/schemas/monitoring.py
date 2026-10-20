from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class HistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    endpoint_id: int
    checked_at: datetime
    is_success: bool
    status_code: Optional[int] = None
    response_time_ms: Optional[float] = None
    error: Optional[str] = None


class DashboardSummary(BaseModel):
    total_monitored: int
    healthy: int
    down: int
    active_incidents: int
    total_incidents: int
    average_response_time_ms: Optional[float] = None  # last 24 hours
    overall_uptime_percent: Optional[float] = None    # last 24 hours
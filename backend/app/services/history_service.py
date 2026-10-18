from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.incident import Incident
from app.models.monitored_endpoint import MonitoredEndpoint
from app.models.monitoring_result import MonitoringResult
from app.schemas.incident import IncidentResponse
from app.schemas.monitoring import DashboardSummary
from app.services import endpoint_service


def get_history(db: Session, user_id: int, endpoint_id: int, limit: int):
    endpoint = endpoint_service.get_endpoint(db, user_id, endpoint_id)  # 404 if not yours
    stmt = (
        select(MonitoringResult)
        .where(MonitoringResult.endpoint_id == endpoint.id)
        .order_by(MonitoringResult.checked_at.desc(), MonitoringResult.id.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


def _build_incident(incident: Incident, endpoint_name: Optional[str]) -> IncidentResponse:
    duration = None
    if incident.resolved_at and incident.started_at:
        duration = int((incident.resolved_at - incident.started_at).total_seconds())
    return IncidentResponse(
        id=incident.id,
        endpoint_id=incident.endpoint_id,
        endpoint_name=endpoint_name,
        started_at=incident.started_at,
        resolved_at=incident.resolved_at,
        status=incident.status,
        duration_seconds=duration,
    )


def get_incidents_for_endpoint(db: Session, user_id: int, endpoint_id: int):
    endpoint = endpoint_service.get_endpoint(db, user_id, endpoint_id)
    stmt = (
        select(Incident)
        .where(Incident.endpoint_id == endpoint.id)
        .order_by(Incident.started_at.desc())
    )
    return [_build_incident(i, endpoint.name) for i in db.scalars(stmt).all()]


def get_all_incidents(db: Session, user_id: int, status_filter: Optional[str] = None):
    stmt = (
        select(Incident, MonitoredEndpoint.name)
        .join(MonitoredEndpoint, Incident.endpoint_id == MonitoredEndpoint.id)
        .where(MonitoredEndpoint.user_id == user_id)
        .order_by(Incident.started_at.desc())
    )
    if status_filter:
        stmt = stmt.where(Incident.status == status_filter.upper())
    return [_build_incident(inc, name) for inc, name in db.execute(stmt).all()]


def get_dashboard_summary(db: Session, user_id: int) -> DashboardSummary:
    endpoints = list(
        db.scalars(select(MonitoredEndpoint).where(MonitoredEndpoint.user_id == user_id)).all()
    )
    ids = [e.id for e in endpoints]
    healthy = sum(1 for e in endpoints if e.current_state == "HEALTHY")
    down = sum(1 for e in endpoints if e.current_state == "DOWN")

    active_incidents = 0
    total_incidents = 0
    avg_response = None
    uptime = None

    if ids:
        total_incidents = db.scalar(
            select(func.count(Incident.id)).where(Incident.endpoint_id.in_(ids))
        ) or 0
        active_incidents = db.scalar(
            select(func.count(Incident.id)).where(
                Incident.endpoint_id.in_(ids), Incident.status == "OPEN"
            )
        ) or 0

        since = datetime.now(timezone.utc) - timedelta(hours=24)
        checks, successes, avg_ms = db.execute(
            select(
                func.count(MonitoringResult.id),
                func.count(case((MonitoringResult.is_success.is_(True), 1))),
                func.avg(
                    case((MonitoringResult.is_success.is_(True), MonitoringResult.response_time_ms))
                ),
            ).where(
                MonitoringResult.endpoint_id.in_(ids),
                MonitoringResult.checked_at >= since,
            )
        ).one()
        if checks:
            uptime = round(successes / checks * 100, 2)
        if avg_ms is not None:
            avg_response = round(float(avg_ms), 1)

    return DashboardSummary(
        total_monitored=len(endpoints),
        healthy=healthy,
        down=down,
        active_incidents=active_incidents,
        total_incidents=total_incidents,
        average_response_time_ms=avg_response,
        overall_uptime_percent=uptime,
    )
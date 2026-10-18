
from fastapi import FastAPI
import uvicorn

from app.config import settings

app = FastAPI(title="OpsGuard Worker Health")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "worker_id": settings.worker_id,
    }


def run_health_server():
    uvicorn.run(
        app,
        host=settings.health_host,
        port=settings.health_port,
        log_level="warning",
    )

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


def error_response(status_code: int, message: str, details=None, headers=None):
    body = {"error": {"status": status_code, "message": message}}
    if details:
        body["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=body, headers=headers)


def register_exception_handlers(app: FastAPI):
    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(request: Request, exc: StarletteHTTPException):
        return error_response(
            exc.status_code, str(exc.detail), headers=getattr(exc, "headers", None)
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        details = []
        for err in exc.errors():
            loc = [str(p) for p in err["loc"] if p not in ("body", "query", "path")]
            message = err["msg"].removeprefix("Value error, ")
            details.append({"field": ".".join(loc) or "body", "message": message})
        return error_response(422, "Validation failed", details)

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, exc: Exception):
        return error_response(500, "Internal server error")
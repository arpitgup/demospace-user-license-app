from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from shared_lib import admin_service
from starlette.responses import JSONResponse

from ..common.constants import X_DEMO_USER_EMAIL_HEADER


class UserValidationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        # Skip swagger documentation endpoints
        if request.url.path.startswith("/docs") or request.url.path.startswith("/openapi.json"):
            return await call_next(request)

        if (
            X_DEMO_USER_EMAIL_HEADER not in request.headers
            or not request.headers[X_DEMO_USER_EMAIL_HEADER]
        ):
            return JSONResponse(
                status_code=400,
                content={"detail": "Missing X-Demo-User-Email header."},
            )

        user_email = request.headers.get(X_DEMO_USER_EMAIL_HEADER)
        try:
            user = admin_service.get_user(user_email)
            if not user:
                raise HTTPException(
                    status_code=401, detail=f"User {user_email} is not valid."
                )

        except HTTPException as http_exc:
            response = JSONResponse(
                status_code=http_exc.status_code, content={"detail": http_exc.detail}
            )
            return response

        response = await call_next(request)
        return response

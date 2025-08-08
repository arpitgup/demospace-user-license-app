from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from ..utils import admin_service
from starlette.responses import JSONResponse

from ..common.constants import X_GOOGLE_USER_EMAIL_HEADER


class UserValidationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
        # Skip user validation for the license endpoints
        if request.url.path.startswith("/licenses"):
            response = await call_next(request)
            return response

        if (
            X_GOOGLE_USER_EMAIL_HEADER not in request.headers
            or not request.headers[X_GOOGLE_USER_EMAIL_HEADER]
        ):
            return JSONResponse(
                status_code=400,
                content={"detail": "Missing X-Google-User-Email header."},
            )

        user_email = request.headers.get(X_GOOGLE_USER_EMAIL_HEADER)
        try:
            user = admin_service.get_user(user_email)
            if not user:
                raise HTTPException(
                    status_code=401, detail=f"User {user_email} is not valid."
                )

        except HTTPException as http_exc:
            return JSONResponse(
                status_code=http_exc.status_code, content={"detail": http_exc.detail}
            )

        response = await call_next(request)
        return response

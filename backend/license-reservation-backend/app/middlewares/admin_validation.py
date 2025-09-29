from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from shared_lib import admin_service
from starlette.responses import JSONResponse
from loguru import logger

from ..common.constants import X_DEMO_USER_EMAIL_HEADER, PORTAL_ADMIN_GROUP_EMAIL


class AdminValidationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            if request.method == "OPTIONS":
                return await call_next(request)

            # Only run the validation for admin endpoints
            if not request.url.path.startswith("/admin"):
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
                if not admin_service.is_user_in_group(user_email, PORTAL_ADMIN_GROUP_EMAIL):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"User {user_email} is not authorized to perform this operation.",
                    )

            except HTTPException as http_exc:
                response = JSONResponse(
                    status_code=http_exc.status_code, content={"detail": http_exc.detail}
                )
                response.headers["Access-Control-Allow-Origin"]="*"
                return response

            response = await call_next(request)
            return response
        except Exception as e:
            logger.error(f"Exception occured in user admin validation middleware: {e}")
            response = JSONResponse(
                status_code=500, content={"detail": str(e)}
            )
            response.headers["Access-Control-Allow-Origin"]="*"
            return response
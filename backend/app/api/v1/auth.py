"""Эндпоинты аутентификации: регистрация, логин, refresh, logout, me."""

from __future__ import annotations

import jwt
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.requests import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import (
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.database import get_db
from app.crud import user as user_crud
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.user import (
    PasswordChangeRequest,
    UserLoginRequest,
    UserPublic,
    UserRegisterRequest,
)
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

_settings = get_settings()


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Положить refresh в httpOnly-cookie."""
    response.set_cookie(
        key=_settings.refresh_cookie_name,
        value=refresh_token,
        httponly=True,
        secure=_settings.cookie_secure,
        samesite="lax",
        max_age=_settings.refresh_token_expire_days * 24 * 3600,
        path="/api/v1/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=_settings.refresh_cookie_name,
        path="/api/v1/auth",
    )


def _build_token_response(user: User, response: Response) -> TokenResponse:
    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    _set_refresh_cookie(response, refresh)
    return TokenResponse(
        access_token=access,
        user=UserPublic.model_validate(user),
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    payload: UserRegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    user = await auth_service.register_user(
        db,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
    )
    return _build_token_response(user, response)


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: UserLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    user = await auth_service.authenticate(
        db, email=payload.email, password=payload.password
    )
    return _build_token_response(user, response)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    token = request.cookies.get(_settings.refresh_cookie_name)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Нет refresh-токена",
        )

    try:
        payload = decode_token(token, expected_type=TokenType.refresh)
    except jwt.ExpiredSignatureError as exc:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh-токен истёк",
        ) from exc
    except jwt.PyJWTError as exc:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный refresh-токен",
        ) from exc

    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError) as exc:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Битый refresh-токен",
        ) from exc

    user = await user_crud.get_by_id(db, user_id)
    if user is None or not user.is_active:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
        )

    return _build_token_response(user, response)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> Response:
    _clear_refresh_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserPublic)
async def me(current_user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(current_user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: PasswordChangeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    await auth_service.change_password(
        db,
        user=current_user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)

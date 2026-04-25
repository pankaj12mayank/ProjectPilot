from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

THEME_PREFERENCE = Literal["light", "dark", "system"]

USER_ROLE = Literal[
    "admin",
    "pmo",
    "project_manager",
    "client",
    "member",
    "viewer",
]


class UserOut(BaseModel):
    id: str
    # Plain str: DB may hold dev addresses (e.g. admin@localhost) that EmailStr rejects on read.
    email: str
    full_name: str
    role: str
    is_active: bool
    theme_preference: THEME_PREFERENCE | None = None
    created_at: datetime
    has_avatar: bool = False
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserSelfUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    theme_preference: THEME_PREFERENCE | None = None


class UserPasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    role: USER_ROLE = "member"


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    role: USER_ROLE | None = None
    is_active: bool | None = None

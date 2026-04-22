"""Application roles (stored on `users.role`)."""

SUPER_ADMIN = "super_admin"
ADMIN = "admin"
PMO = "pmo"
PROJECT_MANAGER = "project_manager"
DELIVERY_MANAGER = "delivery_manager"
CLIENT = "client"
VIEWER = "viewer"
# Legacy aliases (still valid in DB)
MANAGER = "manager"
MEMBER = "member"

ALL_ROLES: tuple[str, ...] = (
    SUPER_ADMIN,
    ADMIN,
    PMO,
    PROJECT_MANAGER,
    DELIVERY_MANAGER,
    CLIENT,
    VIEWER,
    MANAGER,
    MEMBER,
)

ALL_ROLES_SET = frozenset(ALL_ROLES)

BRAND_ADMIN_ROLES: tuple[str, ...] = (SUPER_ADMIN, ADMIN)


def is_valid_role(role: str) -> bool:
    return role in ALL_ROLES_SET


def is_brand_admin(role: str) -> bool:
    return role in BRAND_ADMIN_ROLES


def is_platform_admin(role: str) -> bool:
    """Users who may access /admin (dashboard, users, branding, audit)."""
    return role in BRAND_ADMIN_ROLES

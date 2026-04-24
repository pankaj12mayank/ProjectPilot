"""Application roles (stored on `users.role`).

Canonical values (API / UI):
  system_owner — first / bootstrap account; not assignable via user API
  admin, pmo, project_manager, client, member, viewer
"""

SYSTEM_OWNER = "system_owner"
ADMIN = "admin"
PMO = "pmo"
PROJECT_MANAGER = "project_manager"
CLIENT = "client"
MEMBER = "member"
VIEWER = "viewer"

ALL_ROLES: tuple[str, ...] = (
    SYSTEM_OWNER,
    ADMIN,
    PMO,
    PROJECT_MANAGER,
    CLIENT,
    MEMBER,
    VIEWER,
)

ALL_ROLES_SET = frozenset(ALL_ROLES)

# List/detail every project (navigation, portfolio scope, project access checks).
ROLES_SEE_ALL_PROJECTS: frozenset[str] = frozenset({SYSTEM_OWNER, ADMIN})

# Team pickers / assignable directory: internal roles that may list all users for assignment.
ROLES_FULL_DIRECTORY_ASSIGNABLE: frozenset[str] = frozenset({SYSTEM_OWNER, ADMIN, PMO, PROJECT_MANAGER})

# Backwards-compatible name: same as global project visibility (admin + system owner only).
ROLES_WITH_ALL_PROJECTS_READ: frozenset[str] = ROLES_SEE_ALL_PROJECTS

BRAND_ADMIN_ROLES: tuple[str, ...] = (SYSTEM_OWNER, ADMIN)


def is_valid_role(role: str) -> bool:
    return role in ALL_ROLES_SET


def is_brand_admin(role: str) -> bool:
    return role in BRAND_ADMIN_ROLES


def is_platform_admin(role: str) -> bool:
    """Users who may access /admin (dashboard, users, branding, audit)."""
    return role in BRAND_ADMIN_ROLES

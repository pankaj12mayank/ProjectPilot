"""Named FastAPI dependencies for role-based access (use with Depends(...)).

JWT issuance and get_current_user are unchanged; these only gate routes by user.role.
"""

from app.constants.roles import ADMIN, PMO, PROJECT_MANAGER, SYSTEM_OWNER
from app.deps.auth import require_roles

# Platform configuration: users, admin stats, audit logs, etc.
require_platform_admin = require_roles(SYSTEM_OWNER, ADMIN)

# Portfolio workspace entry (PMO/PM may open portfolio UI; project rows still filter by assignment unless admin).
require_project_portfolio_access = require_roles(SYSTEM_OWNER, ADMIN, PMO, PROJECT_MANAGER)

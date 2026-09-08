import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, isNetworkError, readJsonOk } from "../api/client";
import { deleteUserPermanent } from "../api/usersAdmin";
import { ROLE_LABELS, roleOptionsForActor, type AssignableUserRole, type UserRole } from "../auth/types";
import { useAuth } from "../auth/AuthContext";
import { isSystemOwner } from "../auth/roleUtils";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FormField } from "../components/ui/FormField";
import { PasswordInput } from "../components/ui/PasswordInput";
import { Modal } from "../components/ui/Modal";
import { Table, type Column } from "../components/ui/Table";
import { FilterField, FiltersBar, SearchField } from "@/components/ui/FiltersBar";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "../components/ToastProvider";
import { friendlyErrorMessage } from "@/lib/friendlyMessages";

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
};

/** API must send `id`; tolerate older/alternate payloads so row actions never call `/users/undefined`. */
function normalizeUserRow(raw: unknown): UserRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const idRaw = o.id ?? o.user_id;
  const id = typeof idRaw === "string" ? idRaw.trim() : idRaw != null ? String(idRaw).trim() : "";
  if (!id) return null;
  const email = typeof o.email === "string" ? o.email : "";
  const full_name = typeof o.full_name === "string" ? o.full_name : "";
  const role = (typeof o.role === "string" ? o.role : "member") as UserRole;
  const is_active = Boolean(o.is_active);
  const created_at = typeof o.created_at === "string" ? o.created_at : undefined;
  return { id, email, full_name, role, is_active, created_at };
}

function roleLabel(role: string): string {
  if (role in ROLE_LABELS) return ROLE_LABELS[role as UserRole];
  return role;
}

function fmtCreated(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function canManageSystemOwnerRow(actorRole: string | undefined, row: UserRow): boolean {
  if (!isSystemOwner(row.role)) return true;
  return isSystemOwner(actorRole);
}

function canHardDeleteRow(actorId: string | undefined, row: UserRow): boolean {
  if (!actorId || row.id === actorId) return false;
  if (isSystemOwner(row.role)) return false;
  return true;
}

export default function UsersPage() {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const actorRole = currentUser?.role;
  const assignableRoles = useMemo(() => roleOptionsForActor(actorRole), [actorRole]);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<UserRow | null>(null);
  const [role, setRole] = useState<AssignableUserRole>("member");
  const [fullName, setFullName] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [cEmail, setCEmail] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [cFullName, setCFullName] = useState("");
  const [cRole, setCRole] = useState<AssignableUserRole>("member");
  const [creating, setCreating] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<UserRow | null>(null);
  const [confirmDeletePermanent, setConfirmDeletePermanent] = useState<UserRow | null>(null);
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SZ = 12;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/users");
      const data = await readJsonOk<UserRow[]>(res);
      const raw = Array.isArray(data) ? data : [];
      const next = raw.map((x) => normalizeUserRow(x)).filter((r): r is UserRow => r !== null);
      setRows(next);
    } catch (e) {
      setRows([]);
      const msg = isNetworkError(e)
        ? "We could not reach the server. Check your connection and that the app is running."
        : friendlyErrorMessage(e, "Could not load the user list.");
      setError(msg);
      toast.push("error", msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter && r.role !== roleFilter) return false;
      if (!s) return true;
      return (
        r.email.toLowerCase().includes(s) ||
        r.full_name.toLowerCase().includes(s) ||
        (r.id && r.id.toLowerCase().includes(s))
      );
    });
  }, [rows, roleFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SZ));
  const pageSafe = Math.min(page, totalPages - 1);
  const pagedRows = useMemo(
    () => filteredRows.slice(pageSafe * PAGE_SZ, (pageSafe + 1) * PAGE_SZ),
    [filteredRows, pageSafe],
  );

  useEffect(() => {
    setPage(0);
  }, [roleFilter, search]);

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  useEffect(() => {
    if (modal) {
      const r = modal.role;
      const assignable = assignableRoles.includes(r as AssignableUserRole);
      const safe = assignable ? (r as AssignableUserRole) : assignableRoles[0] ?? "member";
      setRole(safe);
      setFullName(modal.full_name);
      setActive(modal.is_active);
    }
  }, [modal, assignableRoles]);

  useEffect(() => {
    if (createOpen && !assignableRoles.includes(cRole)) {
      setCRole(assignableRoles[0] ?? "member");
    }
  }, [createOpen, assignableRoles, cRole]);

  async function saveEdit() {
    if (!modal) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        is_active: active,
        full_name: fullName.trim() || undefined,
      };
      if (modal.role !== "system_owner") {
        payload.role = role;
      }
      const uid = encodeURIComponent(modal.id);
      const res = await apiFetch(`/users/${uid}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      await readJsonOk<UserRow>(res);
      setModal(null);
      await load();
      toast.push("success", "User details were saved.");
    } catch (e) {
      const msg = isNetworkError(e)
        ? "We could not reach the server. Check your connection."
        : friendlyErrorMessage(e, "Could not save changes to this user.");
      setError(msg);
      toast.push("error", msg);
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(u: UserRow) {
    if (u.id === currentUser?.id) return;
    if (!canManageSystemOwnerRow(actorRole, u)) return;
    setConfirmDeactivate(null);
    setError(null);
    try {
      const uid = encodeURIComponent(u.id);
      const res = await apiFetch(`/users/${uid}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: false }),
      });
      await readJsonOk<UserRow>(res);
      await load();
      toast.push("success", `${u.email} can no longer sign in until you turn the account back on.`);
    } catch (e) {
      const msg = isNetworkError(e)
        ? "We could not reach the server. Check your connection."
        : friendlyErrorMessage(e, "Could not deactivate this user.");
      setError(msg);
      toast.push("error", msg);
    }
  }

  async function activateUser(u: UserRow) {
    if (!canManageSystemOwnerRow(actorRole, u)) return;
    setError(null);
    try {
      const uid = encodeURIComponent(u.id);
      const res = await apiFetch(`/users/${uid}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: true }),
      });
      await readJsonOk<UserRow>(res);
      await load();
      toast.push("success", `${u.email} can sign in again.`);
    } catch (e) {
      const msg = isNetworkError(e)
        ? "We could not reach the server. Check your connection."
        : friendlyErrorMessage(e, "Could not turn this account back on.");
      setError(msg);
      toast.push("error", msg);
    }
  }

  async function deletePermanent(u: UserRow) {
    if (!canHardDeleteRow(currentUser?.id, u)) return;
    setConfirmDeletePermanent(null);
    const uid = (u.id || "").trim();
    if (!uid) {
      const msg = "This row is missing an account id. Refresh the page and try again.";
      setError(msg);
      toast.push("error", msg);
      return;
    }
    setError(null);
    try {
      await deleteUserPermanent(uid);
      await load();
      toast.push("success", `${u.email} has been permanently removed. Any projects they owned are now under your account.`);
    } catch (e) {
      const msg = isNetworkError(e)
        ? "We could not reach the server. Check your connection."
        : friendlyErrorMessage(e, "We could not remove that user.");
      setError(msg);
      toast.push("error", msg);
    }
  }

  async function createUser() {
    setError(null);
    if (!cEmail.trim() || !cPassword || cPassword.length < 8) {
      const msg = "Please enter an email and a password of at least 8 characters.";
      setError(msg);
      toast.push("error", msg);
      return;
    }
    if (!cFullName.trim()) {
      const msg = "Please enter the person’s full name.";
      setError(msg);
      toast.push("error", msg);
      return;
    }
    setCreating(true);
    try {
      const res = await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify({
          email: cEmail.trim(),
          password: cPassword,
          full_name: cFullName.trim(),
          role: cRole,
        }),
      });
      await readJsonOk<UserRow>(res);
      setCreateOpen(false);
      setCEmail("");
      setCPassword("");
      setCFullName("");
      setCRole(assignableRoles[0] ?? "member");
      await load();
      toast.push("success", "New user was created and can sign in with the email you entered.");
    } catch (e) {
      const msg = isNetworkError(e)
        ? "We could not reach the server. Check your connection."
        : friendlyErrorMessage(e, "Could not create this user.");
      setError(msg);
      toast.push("error", msg);
    } finally {
      setCreating(false);
    }
  }

  const columns: Column<UserRow>[] = [
    { key: "email", header: "Email" },
    { key: "full_name", header: "Name" },
    {
      key: "role",
      header: "Role",
      render: (r) => roleLabel(r.role),
    },
    {
      key: "created_at",
      header: "Joined",
      render: (r) => <span className="pp-muted">{fmtCreated(r.created_at)}</span>,
    },
    {
      key: "is_active",
      header: "Active",
      render: (r) => (r.is_active ? "Yes" : "No"),
    },
    {
      key: "_actions",
      header: "",
      render: (r) => {
        const manageSo = canManageSystemOwnerRow(actorRole, r);
        const delOk = canHardDeleteRow(currentUser?.id, r);
        return (
          <div className="pp-row-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={!manageSo}
              title={!manageSo ? "Only the system owner may change this account." : undefined}
              onClick={() => manageSo && setModal(r)}
            >
              Edit
            </Button>
            {r.is_active ? (
              <Button
                type="button"
                variant="secondary"
                disabled={r.id === currentUser?.id || !manageSo}
                title={
                  r.id === currentUser?.id
                    ? "You cannot deactivate yourself."
                    : !manageSo
                      ? "Only the system owner may change this account."
                      : undefined
                }
                onClick={() => setConfirmDeactivate(r)}
              >
                Deactivate
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={!manageSo}
                title={!manageSo ? "Only the system owner may change this account." : undefined}
                onClick={() => void activateUser(r)}
              >
                Activate
              </Button>
            )}
            <Button
              type="button"
              variant="danger"
              disabled={!delOk}
              title={
                !delOk
                  ? isSystemOwner(r.role)
                    ? "The system owner account cannot be deleted."
                    : r.id === currentUser?.id
                      ? "You cannot delete your own account."
                      : undefined
                  : undefined
              }
              onClick={() => setConfirmDeletePermanent(r)}
            >
              Delete
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <Card
      title="Users & roles"
      actions={
        <Button type="button" variant="secondary" onClick={() => setCreateOpen(true)}>
          Create user
        </Button>
      }
    >
      <p className="pp-muted" style={{ marginBottom: "1rem" }}>
        The first / bootstrap account is <strong>System owner</strong>. Users you create with the{" "}
        <strong>Admin</strong> role are separate platform administrators.{" "}
        <strong>Deactivate</strong> disables sign-in; <strong>Delete</strong> removes the user permanently (projects they
        owned move to you). You cannot remove the last active platform admin or delete the system owner.
      </p>
      {error ? (
        <p className="pp-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="pp-muted">Loading…</p> : null}
      {!loading && rows.length === 0 && !error ? <p className="pp-muted">No users.</p> : null}
      {!loading && rows.length > 0 ? (
        <FiltersBar className="mb-4">
          <SearchField label="Search" value={search} onChange={setSearch} placeholder="Name, email, or id" />
          <FilterField label="Role" className="max-w-[220px] flex-none">
            <select id="u-role-filter" className="pp-input h-9 rounded-xl" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All roles</option>
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((rk) => (
                <option key={rk} value={rk}>
                  {ROLE_LABELS[rk]}
                </option>
              ))}
            </select>
          </FilterField>
        </FiltersBar>
      ) : null}
      {!loading && filteredRows.length === 0 && rows.length > 0 ? (
        <p className="pp-muted">No users match these filters.</p>
      ) : null}
      {!loading && pagedRows.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-xl border border-border/60">
            <Table columns={columns} rows={pagedRows} rowKey={(r) => r.id || r.email || JSON.stringify(r)} />
            <Pagination
              page={pageSafe * PAGE_SZ}
              pageSize={PAGE_SZ}
              total={filteredRows.length}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            />
          </div>
        </>
      ) : null}

      <Modal
        open={modal !== null}
        title="Edit user"
        onClose={() => setModal(null)}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setModal(null)}>
              Cancel
            </Button>{" "}
            <Button type="button" disabled={saving} onClick={() => void saveEdit()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        {modal ? (
          <div className="pp-form">
            <p className="pp-muted">{modal.email}</p>
            <FormField label="Full name" htmlFor="edit-name">
              <input
                id="edit-name"
                className="pp-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={255}
              />
            </FormField>
            <FormField label="Role" htmlFor="edit-role">
              {modal.role === "system_owner" ? (
                <p className="pp-muted" id="edit-role">
                  {ROLE_LABELS.system_owner} (fixed for this account)
                </p>
              ) : (
                <select
                  id="edit-role"
                  className="pp-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as AssignableUserRole)}
                >
                  {assignableRoles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="Active" htmlFor="edit-active">
              <label className="pp-check">
                <input
                  id="edit-active"
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  disabled={modal.id === currentUser?.id && !active}
                />{" "}
                Account enabled
              </label>
              {modal.id === currentUser?.id ? (
                <p className="pp-muted" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
                  You cannot disable your own account here.
                </p>
              ) : null}
            </FormField>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={createOpen}
        title="Create user"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>{" "}
            <Button type="button" disabled={creating} onClick={() => void createUser()}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </>
        }
      >
        <div className="pp-form">
          <FormField label="Email" htmlFor="c-email">
            <input
              id="c-email"
              className="pp-input"
              type="email"
              autoComplete="off"
              value={cEmail}
              onChange={(e) => setCEmail(e.target.value)}
            />
          </FormField>
          <FormField label="Temporary password" htmlFor="c-pass">
            <PasswordInput
              id="c-pass"
              autoComplete="new-password"
              value={cPassword}
              onChange={(e) => setCPassword(e.target.value)}
              minLength={8}
            />
          </FormField>
          <FormField label="Full name" htmlFor="c-name">
            <input
              id="c-name"
              className="pp-input"
              value={cFullName}
              onChange={(e) => setCFullName(e.target.value)}
              maxLength={255}
            />
          </FormField>
          <FormField label="Role" htmlFor="c-role">
            <select
              id="c-role"
              className="pp-input"
              value={cRole}
              onChange={(e) => setCRole(e.target.value as AssignableUserRole)}
            >
              {assignableRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDeactivate !== null}
        title={`Deactivate ${confirmDeactivate?.email ?? ""}?`}
        message={
          <>
            <p>This person will no longer be able to sign in. Their projects and data remain intact.</p>
            <p className="mt-2">You can turn the account back on at any time.</p>
          </>
        }
        confirmLabel="Deactivate"
        variant="danger"
        loading={saving}
        onConfirm={() => confirmDeactivate && deactivate(confirmDeactivate)}
        onCancel={() => setConfirmDeactivate(null)}
      />

      <ConfirmDialog
        open={confirmDeletePermanent !== null}
        title={`Permanently delete ${confirmDeletePermanent?.email ?? ""}?`}
        message={
          <>
            <p>This cannot be undone. All data associated with this account will be removed.</p>
            <p className="mt-2">Any projects they own will be reassigned to you.</p>
          </>
        }
        confirmLabel="Delete account"
        variant="danger"
        loading={saving}
        onConfirm={() => confirmDeletePermanent && deletePermanent(confirmDeletePermanent)}
        onCancel={() => setConfirmDeletePermanent(null)}
      />
    </Card>
  );
}

import { useCallback, useEffect, useState } from "react";
import { apiFetch, parseJson } from "../api/client";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/FormField";
import { Modal } from "../components/ui/Modal";
import { Table, type Column } from "../components/ui/Table";
import type { UserRole } from "../auth/types";

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
};

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<UserRow | null>(null);
  const [role, setRole] = useState<UserRole>("member");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/users/");
      if (!res.ok) {
        const d = await parseJson<{ detail?: string }>(res);
        setError(typeof d.detail === "string" ? d.detail : "Failed to load users");
        setRows([]);
      } else {
        const data = await parseJson<UserRow[]>(res);
        setRows(Array.isArray(data) ? data : []);
      }
    } catch {
      setError("Network error while loading users.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (modal) {
      setRole(modal.role);
      setActive(modal.is_active);
    }
  }, [modal]);

  async function saveEdit() {
    if (!modal) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/users/${modal.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role, is_active: active }),
      });
      if (!res.ok) {
        const d = await parseJson<{ detail?: string }>(res);
        throw new Error(typeof d.detail === "string" ? d.detail : "Save failed");
      }
      setModal(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(u: UserRow) {
    if (!confirm(`Deactivate ${u.email}?`)) return;
    const res = await apiFetch(`/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await parseJson<{ detail?: string }>(res);
      setError(typeof d.detail === "string" ? d.detail : "Failed");
      return;
    }
    if (res.status !== 204) await res.text().catch(() => "");
    await load();
  }

  const columns: Column<UserRow>[] = [
    { key: "email", header: "Email" },
    { key: "full_name", header: "Name" },
    { key: "role", header: "Role" },
    {
      key: "is_active",
      header: "Active",
      render: (r) => (r.is_active ? "Yes" : "No"),
    },
    {
      key: "id",
      header: "",
      render: (r) => (
        <div className="pp-row-actions">
          <Button type="button" variant="secondary" onClick={() => setModal(r)}>
            Edit
          </Button>
          <Button type="button" variant="danger" onClick={() => void deactivate(r)}>
            Deactivate
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card title="Users">
      {error ? (
        <p className="pp-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="pp-muted">Loading…</p> : null}
      {!loading && rows.length === 0 && !error ? <p className="pp-muted">No users.</p> : null}
      {!loading && rows.length > 0 ? <Table columns={columns} rows={rows} rowKey={(r) => r.id} /> : null}

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
            <p className="pp-muted">
              {modal.email} — {modal.full_name}
            </p>
            <FormField label="Role" htmlFor="edit-role">
              <select
                id="edit-role"
                className="pp-input"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value="member">member</option>
                <option value="manager">manager</option>
                <option value="admin">admin</option>
              </select>
            </FormField>
            <FormField label="Active" htmlFor="edit-active">
              <label className="pp-check">
                <input
                  id="edit-active"
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />{" "}
                Account enabled
              </label>
            </FormField>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}

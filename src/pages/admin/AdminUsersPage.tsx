import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";

type UserRow = {
  id: number;
  username: string;
  role: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  created_at: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  admin: "超级管理员",
  manager: "预订管理员",
};

export function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);

  /** 修改密码弹层：目标用户 id */
  const [pwdUserId, setPwdUserId] = useState<number | null>(null);
  const [pwdUsername, setPwdUsername] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdAgain, setPwdAgain] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [profileUser, setProfileUser] = useState<UserRow | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetch<UserRow[]>("/api/admin/users");
      setRows(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setSaving(true);
    try {
      await apiFetch("/api/admin/users", {
        method: "POST",
        json: {
          username: newUser.trim(),
          password: newPass,
          full_name: newFullName.trim() || null,
          phone: newPhone.trim() || null,
          email: newEmail.trim() || null,
        },
      });
      setNewUser("");
      setNewPass("");
      setNewFullName("");
      setNewPhone("");
      setNewEmail("");
      setMsg("已创建预订管理员账号");
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "创建失败");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number, username: string) {
    if (!window.confirm(`确定删除员工「${username}」？`)) return;
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
      setMsg("已删除");
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "删除失败");
    }
  }

  function openPasswordModal(id: number, username: string) {
    setMsg(null);
    setErr(null);
    setPwdUserId(id);
    setPwdUsername(username);
    setPwdNew("");
    setPwdAgain("");
  }

  function closePasswordModal() {
    setPwdUserId(null);
    setPwdNew("");
    setPwdAgain("");
  }

  async function submitPassword() {
    if (pwdUserId == null) return;
    setErr(null);
    setMsg(null);
    if (pwdNew.length < 6) {
      setErr("新密码至少 6 位");
      return;
    }
    if (pwdNew !== pwdAgain) {
      setErr("两次输入的密码不一致");
      return;
    }
    setPwdBusy(true);
    try {
      await apiFetch(`/api/admin/users/${pwdUserId}`, {
        method: "PATCH",
        json: { password: pwdNew },
      });
      setMsg(`已更新「${pwdUsername}」的密码`);
      closePasswordModal();
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "修改失败");
    } finally {
      setPwdBusy(false);
    }
  }

  async function setRole(id: number, role: "admin" | "manager") {
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: "PATCH", json: { role } });
      setMsg("角色已更新");
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "更新失败");
    }
  }

  function openProfileModal(u: UserRow) {
    setProfileUser(u);
    setProfileName((u.full_name || "").trim());
    setProfilePhone((u.phone || "").trim());
    setProfileEmail((u.email || "").trim());
  }

  function closeProfileModal() {
    setProfileUser(null);
    setProfileName("");
    setProfilePhone("");
    setProfileEmail("");
  }

  async function submitProfile() {
    if (!profileUser || profileBusy) return;
    setProfileBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/api/admin/users/${profileUser.id}`, {
        method: "PATCH",
        json: {
          full_name: profileName.trim() || null,
          phone: profilePhone.trim() || null,
          email: profileEmail.trim() || null,
        },
      });
      setMsg(`已更新「${profileUser.username}」资料`);
      closeProfileModal();
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "更新资料失败");
    } finally {
      setProfileBusy(false);
    }
  }

  return (
    <div className="w-full px-3 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">员工账号</h1>
          <p className="text-sm text-stone-500">
            仅超级管理员可管理。新建账号均为「预订管理员」，可处理桌台与预订；系统与品牌等设置仅超级管理员可见。
          </p>
        </div>
        <Link to="/admin/settings" className="text-sm text-brand-coral hover:underline">
          返回系统设置
        </Link>
      </div>

      {msg && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}
      {err && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}

      {pwdUserId != null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            role="dialog"
            aria-labelledby="pwd-dialog-title"
          >
            <h2 id="pwd-dialog-title" className="font-display text-lg font-semibold">
              修改密码
            </h2>
            <p className="mt-1 text-sm text-stone-500">账号：{pwdUsername}</p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs text-stone-600">
                新密码（至少 6 位）
                <input
                  type="password"
                  minLength={6}
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  autoComplete="new-password"
                />
              </label>
              <label className="block text-xs text-stone-600">
                确认新密码
                <input
                  type="password"
                  minLength={6}
                  value={pwdAgain}
                  onChange={(e) => setPwdAgain(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  autoComplete="new-password"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closePasswordModal}
                className="rounded-xl border border-stone-300 px-4 py-2 text-sm text-stone-700"
              >
                取消
              </button>
              <button
                type="button"
                disabled={pwdBusy}
                onClick={() => void submitPassword()}
                className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {pwdBusy ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
      {profileUser && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl">
            <h2 className="font-display text-lg font-semibold">编辑资料</h2>
            <p className="mt-1 text-sm text-stone-500">账号：{profileUser.username}</p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs text-stone-600">
                姓名
                <input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs text-stone-600">
                手机
                <input
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs text-stone-600">
                邮箱
                <input
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeProfileModal}
                className="rounded-xl border border-stone-300 px-4 py-2 text-sm text-stone-700"
              >
                取消
              </button>
              <button
                type="button"
                disabled={profileBusy}
                onClick={() => void submitProfile()}
                className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {profileBusy ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <form onSubmit={(e) => void onCreate(e)} className="h-fit rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="font-display text-base font-semibold">新建预订管理员</h2>
          <div className="mt-3 grid gap-3">
            <label className="block text-xs text-stone-600">
              用户名
              <input
                required
                value={newUser}
                onChange={(e) => setNewUser(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                autoComplete="off"
              />
            </label>
            <label className="block text-xs text-stone-600">
              初始密码（至少 6 位）
              <input
                required
                type="password"
                minLength={6}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                autoComplete="new-password"
              />
            </label>
            <label className="block text-xs text-stone-600">
              姓名（选填）
              <input
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-stone-600">
              手机（选填）
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-stone-600">
              邮箱（选填）
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-4 rounded-xl bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "提交中…" : "创建账号"}
          </button>
        </form>

        <div className="min-w-0 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-600">
            <tr>
              <th className="px-3 py-2">用户名</th>
              <th className="px-3 py-2">姓名</th>
              <th className="px-3 py-2">手机</th>
              <th className="px-3 py-2">邮箱</th>
              <th className="px-3 py-2">角色</th>
              <th className="px-3 py-2">创建时间</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-stone-500">
                  加载中…
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.id} className="border-b border-stone-100">
                  <td className="px-3 py-2 font-medium">{r.username}</td>
                  <td className="px-3 py-2">{r.full_name || "—"}</td>
                  <td className="px-3 py-2">{r.phone || "—"}</td>
                  <td className="px-3 py-2">{r.email || "—"}</td>
                  <td className="px-3 py-2">{ROLE_LABEL[r.role] ?? r.role}</td>
                  <td className="px-3 py-2 text-stone-500">{r.created_at ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-xs text-stone-700 underline"
                        onClick={() => openProfileModal(r)}
                      >
                        编辑资料
                      </button>
                      <button
                        type="button"
                        className="text-xs text-brand-coral underline"
                        onClick={() => openPasswordModal(r.id, r.username)}
                      >
                        修改密码
                      </button>
                      {r.role === "manager" && (
                        <button
                          type="button"
                          className="text-xs text-stone-600 underline"
                          onClick={() => void setRole(r.id, "admin")}
                        >
                          设为超级管理员
                        </button>
                      )}
                      {r.role === "admin" && (
                        <button
                          type="button"
                          className="text-xs text-stone-600 underline"
                          onClick={() => void setRole(r.id, "manager")}
                        >
                          设为预订管理员
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-xs text-red-700 underline"
                        onClick={() => void onDelete(r.id, r.username)}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-stone-400">
        <Link to="/admin" className="text-stone-600 underline-offset-2 hover:underline">
          返回桌台
        </Link>
      </p>
    </div>
  );
}

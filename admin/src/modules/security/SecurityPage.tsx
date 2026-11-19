import { useEffect, useState } from 'react';
import { PageHeader, Card, DataTable, Button, Badge, Modal, Input, Select, Spinner, Tabs, SectionHeader, EmptyState } from '../../components/ui';
import type { Column } from '../../components/ui';
import { security as securityApi } from '../../lib/api';

interface StaffRow extends Record<string, unknown> {
  id: string;
  email: string;
  name?: string | null;
  role_id?: string;
  role?: string;
  mfa_enabled?: number;
  is_active?: number;
}

interface AuditRow extends Record<string, unknown> {
  id: string;
  admin_email?: string;
  actor_email?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  created_at: string;
}

interface SessionRow extends Record<string, unknown> {
  jti: string;
  created_at: string;
  expires_at?: string;
  mfa_verified?: number;
}

const SYSTEM_ROLES = [
  { id: 'role_super_admin', name: 'Super Administrator', desc: 'Unrestricted Commerce OS control including security, RBAC, MFA, finance, and publishing.' },
  { id: 'role_merch_director', name: 'Merchandising Director', desc: 'Full catalog, inventory, pricing, collections, reviews, promotions, and analytics access.' },
  { id: 'role_studio_editor', name: 'Visual Studio Editor', desc: 'Complete storefront CMS, brand identity, navigation, SEO, and media library control.' },
  { id: 'role_order_manager', name: 'Order & Fulfilment Lead', desc: 'Orders, Shiprocket fulfilment, pincode checks, returns, stock monitoring, and concierge.' },
  { id: 'role_concierge', name: 'Private Client Concierge', desc: 'Customer lookup, order tracking, returns assistance, review moderation, and inquiries.' },
  { id: 'role_finance', name: 'Finance & Audit Analyst', desc: 'Orders financial ledger, payment attempts, refunds, disputes, analytics, and audit logs.' },
];

export default function SecurityPage() {
  const [tab, setTab] = useState('staff');
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [mfaStatus, setMfaStatus] = useState<{ enabled: boolean; verified: boolean } | null>(null);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; uri: string; qrDataUrl: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', roleId: 'role_studio_editor' });
  const [roleTarget, setRoleTarget] = useState<StaffRow | null>(null);
  const [newRoleId, setNewRoleId] = useState('role_order_manager');
  const [disableMfaOpen, setDisableMfaOpen] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function loadTab(currentTab: string, page = auditPage) {
    setLoading(true);
    setError('');
    try {
      if (currentTab === 'staff') {
        const res = await securityApi.staff.list();
        const raw = res.data as unknown;
        setStaff((Array.isArray(raw) ? raw : (raw as { staff?: StaffRow[] })?.staff ?? []) as StaffRow[]);
      } else if (currentTab === 'mfa') {
        const res = await securityApi.mfa.status();
        setMfaStatus(res.data ?? { enabled: false, verified: false });
      } else if (currentTab === 'audit') {
        const res = await securityApi.auditLogs({ page });
        const raw = res.data as unknown;
        setAuditLogs((Array.isArray(raw) ? raw : (raw as { logs?: AuditRow[] })?.logs ?? []) as AuditRow[]);
      } else if (currentTab === 'sessions') {
        const res = await securityApi.sessions.list();
        const raw = res.data as unknown;
        setSessions((Array.isArray(raw) ? raw : (raw as { sessions?: SessionRow[] })?.sessions ?? []) as SessionRow[]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load security data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTab(tab, auditPage); }, [tab, auditPage]);

  async function handleInvite() {
    setSaving(true);
    setError('');
    try {
      await securityApi.staff.invite(inviteForm);
      setInviteOpen(false);
      setInviteForm({ email: '', name: '', roleId: 'role_studio_editor' });
      setNotice('Staff grant created.');
      loadTab('staff');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invite failed');
    } finally { setSaving(false); }
  }

  async function handleRoleUpdate() {
    if (!roleTarget) return;
    setSaving(true);
    try {
      await securityApi.staff.updateRole(roleTarget.id, newRoleId);
      setRoleTarget(null);
      setNotice('Role updated.');
      loadTab('staff');
    } finally { setSaving(false); }
  }

  async function handleDeactivate(s: StaffRow) {
    if (!confirm(`Revoke admin access for ${s.email}?`)) return;
    await securityApi.staff.deactivate(s.id);
    loadTab('staff');
  }

  async function startMfaSetup() {
    setSaving(true);
    setError('');
    try {
      const res = await securityApi.mfa.setup();
      setMfaSetup(res.data ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'MFA setup failed');
    } finally { setSaving(false); }
  }

  async function confirmEnableMfa() {
    setSaving(true);
    setError('');
    try {
      const res = await securityApi.mfa.enable(mfaCode.trim());
      setBackupCodes(res.data?.backupCodes ?? []);
      setMfaSetup(null);
      setMfaCode('');
      loadTab('mfa');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid verification code');
    } finally { setSaving(false); }
  }

  async function confirmDisableMfa() {
    setSaving(true);
    setError('');
    try {
      await securityApi.mfa.disable(disableCode.trim());
      setDisableMfaOpen(false);
      setDisableCode('');
      setNotice('Two-factor authentication disabled.');
      loadTab('mfa');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid code');
    } finally { setSaving(false); }
  }

  async function revokeSession(jti: string) {
    await securityApi.sessions.revoke(jti);
    loadTab('sessions');
  }

  async function revokeAllSessions() {
    if (!confirm('Revoke all active refresh sessions across all devices?')) return;
    await securityApi.sessions.revokeAll();
    loadTab('sessions');
  }

  const staffCols: Column<StaffRow>[] = [
    {
      key: 'email', header: 'Administrator', render: r => (
        <div>
          <p className="font-medium text-ink-900">{r.name || 'Admin Staff'}</p>
          <p className="text-xs text-ink-500">{r.email}</p>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: r => <Badge variant="gold">{r.role_id ?? r.role ?? 'admin'}</Badge> },
    { key: 'mfa', header: 'TOTP MFA', render: r => <Badge variant={r.mfa_enabled ? 'success' : 'warning'}>{r.mfa_enabled ? 'Enforced' : 'Not Set'}</Badge> },
    {
      key: 'actions', header: '', render: r => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="outline" onClick={() => { setRoleTarget(r); setNewRoleId(r.role_id ?? r.role ?? 'admin'); }}>Change Role</Button>
          <Button size="sm" variant="danger" onClick={() => handleDeactivate(r)}>Revoke</Button>
        </div>
      ),
    },
  ];

  const auditCols: Column<AuditRow>[] = [
    { key: 'actor', header: 'Actor', render: r => <span className="text-ink-800 text-xs font-medium">{r.admin_email ?? r.actor_email ?? 'system'}</span> },
    { key: 'action', header: 'Action', render: r => <code className="text-xs bg-ink-100 px-2 py-0.5 rounded text-ink-900">{r.action}</code> },
    { key: 'entity', header: 'Target', render: r => <span className="text-xs text-ink-600">{r.entity_type ?? '—'}{r.entity_id ? ` · ${r.entity_id.slice(0, 12)}` : ''}</span> },
    { key: 'created_at', header: 'Timestamp', render: r => <span className="text-xs text-ink-500">{new Date(r.created_at).toLocaleString('en-IN')}</span> },
  ];

  const sessionCols: Column<SessionRow>[] = [
    { key: 'jti', header: 'Session Token ID', render: r => <code className="text-xs font-mono text-ink-700">{r.jti.slice(0, 18)}…</code> },
    { key: 'mfa', header: 'MFA Verified', render: r => <Badge variant={r.mfa_verified ? 'success' : 'default'}>{r.mfa_verified ? 'Yes' : 'No'}</Badge> },
    { key: 'created_at', header: 'Issued', render: r => <span className="text-xs text-ink-500">{new Date(r.created_at).toLocaleString('en-IN')}</span> },
    { key: 'actions', header: '', render: r => <div className="flex justify-end"><Button size="sm" variant="danger" onClick={() => revokeSession(r.jti)}>Revoke</Button></div> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security & Access Control"
        description="Manage administrator RBAC grants, TOTP two-factor authentication, active device sessions, and immutable audit trails."
        actions={tab === 'staff' ? <Button onClick={() => setInviteOpen(true)}>+ Grant Staff Access</Button> : tab === 'sessions' ? <Button variant="danger" onClick={revokeAllSessions}>Revoke All Sessions</Button> : undefined}
      />

      {notice && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl">{notice}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'staff', label: 'Staff & Grants' },
          { id: 'roles', label: 'Roles Matrix' },
          { id: 'mfa', label: 'TOTP MFA' },
          { id: 'audit', label: 'Audit Trail' },
          { id: 'sessions', label: 'Active Sessions' },
        ]}
      />

      {tab === 'roles' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SYSTEM_ROLES.map(r => (
            <Card key={r.id}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-ink-900">{r.name}</h3>
                <Badge variant="gold">{r.id}</Badge>
              </div>
              <p className="text-sm text-ink-600 leading-relaxed">{r.desc}</p>
            </Card>
          ))}
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : tab === 'staff' ? (
        <Card padding={false}>
          <DataTable columns={staffCols} data={staff} emptyTitle="No admin staff grants" />
        </Card>
      ) : tab === 'mfa' ? (
        <Card>
          <SectionHeader title="Authenticator App (TOTP MFA)" description="Protect privileged Commerce OS actions with RFC 6238 time-based one-time passwords." />
          {mfaStatus?.enabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="success">MFA Active</Badge>
                <span className="text-sm text-ink-600">Your account is protected by hardware/app TOTP verification.</span>
              </div>
              <Button variant="danger" onClick={() => setDisableMfaOpen(true)}>Disable MFA</Button>
            </div>
          ) : mfaSetup ? (
            <div className="space-y-4 max-w-md">
              <p className="text-sm text-ink-600">Scan this QR code with Google Authenticator, 1Password, or Authy, then enter the 6-digit verification code below.</p>
              {mfaSetup.qrDataUrl && <img src={mfaSetup.qrDataUrl} alt="TOTP QR Code" className="w-44 h-44 border border-ink-200 rounded-xl p-2 bg-white" />}
              <div className="bg-ink-50 p-3 rounded-lg">
                <p className="text-xs text-ink-500 mb-1">Manual Setup Secret</p>
                <code className="text-xs font-mono text-ink-900 break-all">{mfaSetup.secret}</code>
              </div>
              <Input
                label="6-Digit Verification Code"
                tooltip="Enter the current 6-digit code displayed in your authenticator app."
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value)}
                placeholder="123456"
              />
              <Button loading={saving} disabled={mfaCode.trim().length < 6} onClick={confirmEnableMfa}>Verify & Enable MFA</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-ink-600">Two-factor authentication is not yet enabled on your administrator account.</p>
              <Button loading={saving} onClick={startMfaSetup}>Begin MFA Setup</Button>
            </div>
          )}

          {backupCodes && backupCodes.length > 0 && (
            <div className="mt-6 p-4 bg-gold-50 border border-gold-200 rounded-xl">
              <p className="text-sm font-semibold text-ink-900 mb-2">Save Your Recovery Backup Codes</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {backupCodes.map((c, i) => <code key={i} className="text-xs font-mono bg-white px-2 py-1 rounded border border-gold-200 text-center">{c}</code>)}
              </div>
            </div>
          )}
        </Card>
      ) : tab === 'audit' ? (
        <Card padding={false}>
          <DataTable columns={auditCols} data={auditLogs} emptyTitle="No audit events recorded" />
          <div className="flex justify-between items-center px-4 py-3 border-t border-ink-100">
            <span className="text-xs text-ink-500">Page {auditPage}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={auditPage <= 1} onClick={() => setAuditPage(p => p - 1)}>← Prev</Button>
              <Button size="sm" variant="ghost" disabled={auditLogs.length < 25} onClick={() => setAuditPage(p => p + 1)}>Next →</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card padding={false}>
          {sessions.length === 0 ? <EmptyState title="No active refresh sessions" /> : <DataTable columns={sessionCols} data={sessions} />}
        </Card>
      )}

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Grant Staff Access"
        footer={
          <>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button loading={saving} disabled={!inviteForm.email} onClick={handleInvite}>Grant Access</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Work Email"
            tooltip="Email address the staff member will use for OTP sign-in."
            type="email"
            value={inviteForm.email}
            onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
            placeholder="merchandiser@deynolddanny.com"
          />
          <Input
            label="Full Name"
            tooltip="Displayed in the audit trail and concierge replies."
            value={inviteForm.name}
            onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Kabir Kapoor"
          />
          <Select
            label="Assigned Role"
            tooltip="Controls server-enforced RBAC permissions across all admin routes."
            value={inviteForm.roleId}
            onChange={e => setInviteForm(f => ({ ...f, roleId: e.target.value }))}
            options={SYSTEM_ROLES.map(r => ({ value: r.id, label: r.name }))}
          />
        </div>
      </Modal>

      <Modal
        open={!!roleTarget}
        onClose={() => setRoleTarget(null)}
        title={`Change Role — ${roleTarget?.email ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRoleTarget(null)}>Cancel</Button>
            <Button loading={saving} onClick={handleRoleUpdate}>Update Role</Button>
          </>
        }
      >
        <Select
          label="New Role"
          tooltip="Takes effect immediately on the next authenticated API request."
          value={newRoleId}
          onChange={e => setNewRoleId(e.target.value)}
          options={SYSTEM_ROLES.map(r => ({ value: r.id, label: r.name }))}
        />
      </Modal>

      <Modal
        open={disableMfaOpen}
        onClose={() => setDisableMfaOpen(false)}
        title="Disable Two-Factor Authentication"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDisableMfaOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={saving} disabled={disableCode.trim().length < 6} onClick={confirmDisableMfa}>Disable MFA</Button>
          </>
        }
      >
        <Input
          label="Current TOTP Code"
          tooltip="Confirm your identity with a current 6-digit code from your authenticator app."
          value={disableCode}
          onChange={e => setDisableCode(e.target.value)}
          placeholder="123456"
        />
      </Modal>
    </div>
  );
}

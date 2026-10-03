import { useMemo, useState } from 'react';
import { Briefcase, CalendarClock, ExternalLink, Plus, Search, Trash2 } from 'lucide-react';
import { useStore } from '@/store';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, Select, StatCard, Textarea, useToast } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { ChartCard, SimpleBarChart } from '@/components/charts';
import { APPLICATION_STATUSES, APPLICATION_STATUS_META } from '@/lib/constants';
import { diffDays, formatDate, todayISO } from '@/lib/utils';
import type { Application, ApplicationStatus } from '@/types';

const blank = {
  company: '',
  role: '',
  type: 'Internship',
  applicationDate: todayISO(),
  deadline: '',
  status: 'interested' as ApplicationStatus,
  oaDate: '',
  interviewDate: '',
  resumeVersion: '',
  referral: false,
  notes: '',
};

export default function Applications() {
  const store = useStore();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Application | null>(null);
  const [form, setForm] = useState({ ...blank });
  const [toDelete, setToDelete] = useState<Application | null>(null);

  const today = todayISO();
  const apps = useMemo(
    () =>
      [...store.applications]
        .filter((a) => (statusFilter === 'all' ? true : a.status === statusFilter))
        .filter((a) => {
          const q = query.trim().toLowerCase();
          return q ? a.company.toLowerCase().includes(q) || a.role.toLowerCase().includes(q) : true;
        })
        .sort((a, b) => (b.applicationDate ?? '').localeCompare(a.applicationDate ?? '')),
    [store.applications, statusFilter, query],
  );

  const upcomingEvents = useMemo(() => {
    const events: { id: string; company: string; label: string; date: string; days: number }[] = [];
    for (const a of store.applications) {
      if (a.oaDate && a.oaDate >= today) events.push({ id: `${a.id}-oa`, company: a.company, label: 'Online Assessment', date: a.oaDate, days: diffDays(a.oaDate, today) });
      if (a.interviewDate && a.interviewDate >= today) events.push({ id: `${a.id}-iv`, company: a.company, label: 'Interview', date: a.interviewDate, days: diffDays(a.interviewDate, today) });
      if (a.deadline && a.deadline >= today) events.push({ id: `${a.id}-dl`, company: a.company, label: 'Deadline', date: a.deadline, days: diffDays(a.deadline, today) });
    }
    return events.sort((a, b) => a.days - b.days);
  }, [store.applications, today]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...blank });
    setOpen(true);
  };

  const openEdit = (a: Application) => {
    setEditing(a);
    setForm({
      company: a.company,
      role: a.role,
      type: a.type,
      applicationDate: a.applicationDate ?? '',
      deadline: a.deadline ?? '',
      status: a.status,
      oaDate: a.oaDate ?? '',
      interviewDate: a.interviewDate ?? '',
      resumeVersion: a.resumeVersion ?? '',
      referral: a.referral,
      notes: a.notes ?? '',
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.company.trim() || !form.role.trim()) {
      toast.push('Company and role are required', { tone: 'error' });
      return;
    }
    const payload = {
      ...form,
      company: form.company.trim(),
      role: form.role.trim(),
      applicationDate: form.applicationDate || undefined,
      deadline: form.deadline || undefined,
      oaDate: form.oaDate || undefined,
      interviewDate: form.interviewDate || undefined,
      resumeVersion: form.resumeVersion || undefined,
    };
    if (editing) {
      store.updateApplication(editing.id, payload);
      toast.push('Application updated', { tone: 'success' });
    } else {
      store.addApplication(payload);
      toast.push('Application added', { tone: 'success' });
    }
    setOpen(false);
  };

  const funnel = APPLICATION_STATUSES.map((s) => ({ label: APPLICATION_STATUS_META[s].label, value: store.applications.filter((a) => a.status === s).length })).filter((x) => x.value > 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Applications"
        description="Track every internship and full-time application in one place"
        meta={<Badge tone="slate">{store.applications.length} tracked</Badge>}
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>
            Add application
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Applied" value={store.applications.filter((a) => a.status !== 'interested' && a.status !== 'preparing').length} icon={<Briefcase size={16} />} />
        <StatCard label="In process" value={store.applications.filter((a) => ['oa', 'oa-cleared', 'interview', 'final-round'].includes(a.status)).length} />
        <StatCard label="Upcoming events" value={upcomingEvents.length} icon={<CalendarClock size={16} />} />
        <StatCard label="Deadlines ≤7d" value={upcomingEvents.filter((e) => e.label === 'Deadline' && e.days <= 7).length} />
      </div>

      {upcomingEvents.length > 0 && (
        <Card>
          <div className="flex flex-wrap gap-2 p-3">
            {upcomingEvents.slice(0, 6).map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                <Badge tone={e.days <= 2 ? 'red' : e.days <= 7 ? 'amber' : 'slate'}>{e.days}d</Badge>
                <span className="font-medium">{e.company}</span>
                <span className="text-content-muted">{e.label}</span>
                <span className="text-content-faint">{formatDate(e.date)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-faint" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company or role…" className="pl-8" aria-label="Search applications" />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="w-auto py-1.5 text-xs">
          <option value="all">All statuses</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {APPLICATION_STATUS_META[s].label}
            </option>
          ))}
        </Select>
      </Card>

      {apps.length === 0 ? (
        <EmptyState title="No applications yet" message="Add the roles you are interested in and track every stage." action={<Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>Add application</Button>} icon={<Briefcase size={20} />} />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-surface-muted/60 text-left text-xs text-content-muted">
                    <th className="px-3 py-2 font-medium">Company</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Applied</th>
                    <th className="px-3 py-2 font-medium">Deadline</th>
                    <th className="px-3 py-2 font-medium">OA</th>
                    <th className="px-3 py-2 font-medium">Interview</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {apps.map((a) => (
                    <tr key={a.id} className="hover:bg-surface-muted/50">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{a.company}</span>
                          {a.referral && <Badge tone="green">referral</Badge>}
                        </div>
                        <div className="text-[11px] text-content-faint">{a.type}{a.resumeVersion ? ` · resume ${a.resumeVersion}` : ''}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-content-muted">{a.role}</td>
                      <td className="px-3 py-2">
                        <Select value={a.status} onChange={(e) => store.updateApplication(a.id, { status: e.target.value as ApplicationStatus })} className="w-auto py-1 text-xs" ariaLabel={`Status for ${a.company}`}>
                          {APPLICATION_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {APPLICATION_STATUS_META[s].label}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-xs text-content-muted">{formatDate(a.applicationDate)}</td>
                      <td className="px-3 py-2 text-xs">
                        {a.deadline ? (
                          <span className={diffDays(a.deadline, today) <= 3 && a.deadline >= today ? 'text-amber-500' : 'text-content-muted'}>{formatDate(a.deadline)}</span>
                        ) : (
                          <span className="text-content-faint">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-content-muted">{formatDate(a.oaDate)}</td>
                      <td className="px-3 py-2 text-xs text-content-muted">{formatDate(a.interviewDate)}</td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {apps.map((a) => (
              <Card key={a.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium">{a.company}</span>
                      {a.referral && <Badge tone="green">referral</Badge>}
                    </div>
                    <div className="text-xs text-content-muted">{a.role} · {a.type}</div>
                  </div>
                  <Badge tone={APPLICATION_STATUS_META[a.status].tone}>{APPLICATION_STATUS_META[a.status].label}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-content-faint">
                  <span>Applied {formatDate(a.applicationDate)}</span>
                  {a.deadline && <span>· Deadline {formatDate(a.deadline)}</span>}
                  {a.oaDate && <span>· OA {formatDate(a.oaDate)}</span>}
                  {a.interviewDate && <span>· Interview {formatDate(a.interviewDate)}</span>}
                </div>
                {a.notes && <p className="mt-1.5 text-xs text-content-muted">{a.notes}</p>}
                <div className="mt-2 flex items-center gap-2">
                  <Select value={a.status} onChange={(e) => store.updateApplication(a.id, { status: e.target.value as ApplicationStatus })} className="w-auto py-1 text-xs" ariaLabel={`Status for ${a.company}`}>
                    {APPLICATION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {APPLICATION_STATUS_META[s].label}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
                    Edit
                  </Button>
                  <Button size="icon-sm" variant="ghost" className="ml-auto text-red-500" onClick={() => setToDelete(a)} aria-label="Delete application">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Application funnel" subtitle="Current status distribution">
          <SimpleBarChart horizontal data={funnel} />
        </ChartCard>
        <Card className="p-4">
          <h3 className="text-sm font-semibold">Keeping it honest</h3>
          <p className="mt-1 text-xs text-content-muted">
            This page tracks where each application is <em>right now</em>. It intentionally does not predict any hiring outcome
            — interview processes change for reasons outside your control, so only record what actually happened.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {APPLICATION_STATUSES.map((s) => (
              <Badge key={s} tone={APPLICATION_STATUS_META[s].tone}>
                {APPLICATION_STATUS_META[s].label}
              </Badge>
            ))}
          </div>
        </Card>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.company}` : 'Add application'}
        size="lg"
        footer={
          <>
            {editing && (
              <Button variant="danger" onClick={() => { setToDelete(editing); setOpen(false); }}>
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save}>
              {editing ? 'Save changes' : 'Add application'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company">
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="e.g. Microsoft" />
            </Field>
            <Field label="Role">
              <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. SWE Intern" />
            </Field>
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {['Internship', 'Full-time', 'Contract'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ApplicationStatus })}>
                {APPLICATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {APPLICATION_STATUS_META[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Application date">
              <Input type="date" value={form.applicationDate} onChange={(e) => setForm({ ...form, applicationDate: e.target.value })} />
            </Field>
            <Field label="Deadline">
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </Field>
            <Field label="OA date">
              <Input type="date" value={form.oaDate} onChange={(e) => setForm({ ...form, oaDate: e.target.value })} />
            </Field>
            <Field label="Interview date">
              <Input type="date" value={form.interviewDate} onChange={(e) => setForm({ ...form, interviewDate: e.target.value })} />
            </Field>
            <Field label="Resume version">
              <Input value={form.resumeVersion} onChange={(e) => setForm({ ...form, resumeVersion: e.target.value })} placeholder="v3" />
            </Field>
            <Field label="Referral">
              <label className="flex items-center gap-2 pt-2 text-sm">
                <input type="checkbox" checked={form.referral} onChange={(e) => setForm({ ...form, referral: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                Applied through a referral
              </label>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete application"
        message={`Delete the ${toDelete?.company} — ${toDelete?.role} application?`}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) {
            store.deleteApplication(toDelete.id);
            toast.push('Application deleted', { tone: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
          }
          setToDelete(null);
        }}
      />

      <p className="flex items-center gap-1.5 text-[11px] text-content-faint">
        <ExternalLink size={12} /> Tip: paste job links into the notes field so they stay with the application.
      </p>
    </div>
  );
}

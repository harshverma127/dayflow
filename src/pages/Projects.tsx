import { useState } from 'react';
import { CheckSquare, ExternalLink, FolderGit2, Github, Plus, Star, Trash2 } from 'lucide-react';
import { useStore } from '@/store';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, ProgressRing, Select, StatCard, Textarea, useToast } from '@/components/ui';
import { CheckRow, MetricBar, PageHeader } from '@/components/common';
import { PROJECT_CHECKLIST_ITEMS, PROJECT_STATUSES, PROJECT_STATUS_META, SUBJECT_COLORS } from '@/lib/constants';
import { cn, formatDate } from '@/lib/utils';
import { projectReadiness } from '@/lib/progress';
import type { Project, ProjectStatus } from '@/types';

const blankForm = {
  name: '',
  description: '',
  githubUrl: '',
  liveUrl: '',
  technologies: '',
  status: 'building' as ProjectStatus,
  startDate: '',
  endDate: '',
  features: '',
  architecture: '',
  database: '',
  apis: '',
  authentication: '',
  security: '',
  testing: '',
  deployment: '',
  challenges: '',
  tradeoffs: '',
  futureImprovements: '',
  color: SUBJECT_COLORS[0],
};

export default function Projects() {
  const store = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState({ ...blankForm });
  const [checklistFor, setChecklistFor] = useState<Project | null>(null);
  const [toDelete, setToDelete] = useState<Project | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...blankForm });
    setOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description,
      githubUrl: p.githubUrl ?? '',
      liveUrl: p.liveUrl ?? '',
      technologies: p.technologies.join(', '),
      status: p.status,
      startDate: p.startDate ?? '',
      endDate: p.endDate ?? '',
      features: p.features.join('\n'),
      architecture: p.architecture ?? '',
      database: p.database ?? '',
      apis: p.apis ?? '',
      authentication: p.authentication ?? '',
      security: p.security ?? '',
      testing: p.testing ?? '',
      deployment: p.deployment ?? '',
      challenges: p.challenges ?? '',
      tradeoffs: p.tradeoffs ?? '',
      futureImprovements: p.futureImprovements ?? '',
      color: p.color,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      toast.push('Project name required', { tone: 'error' });
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description,
      githubUrl: form.githubUrl || undefined,
      liveUrl: form.liveUrl || undefined,
      technologies: form.technologies.split(',').map((t) => t.trim()).filter(Boolean),
      status: form.status,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      features: form.features.split('\n').map((t) => t.trim()).filter(Boolean),
      architecture: form.architecture,
      database: form.database,
      apis: form.apis,
      authentication: form.authentication,
      security: form.security,
      testing: form.testing,
      deployment: form.deployment,
      challenges: form.challenges,
      tradeoffs: form.tradeoffs,
      futureImprovements: form.futureImprovements,
      color: form.color,
    };
    if (editing) {
      store.updateProject(editing.id, payload);
      toast.push('Project updated', { tone: 'success' });
    } else {
      store.addProject(payload);
      toast.push('Project added', { tone: 'success' });
    }
    setOpen(false);
  };

  const avgReadiness = store.projects.length ? Math.round(store.projects.reduce((a, p) => a + projectReadiness(p), 0) / store.projects.length) : 0;
  const liveChecklist = checklistFor ? store.projects.find((p) => p.id === checklistFor.id) ?? checklistFor : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Projects"
        description="Portfolio projects and how ready you are to explain them"
        meta={<Badge tone="slate">{store.projects.length} projects</Badge>}
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>
            Add project
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Projects" value={store.projects.length} icon={<FolderGit2 size={16} />} />
        <StatCard label="Interview ready" value={store.projects.filter((p) => p.status === 'interview-ready').length} />
        <StatCard label="Avg readiness" value={`${avgReadiness}%`} progress={avgReadiness} />
        <StatCard label="In progress" value={store.projects.filter((p) => p.status === 'building').length} />
      </div>

      {store.projects.length === 0 ? (
        <EmptyState title="No projects yet" message="Add your projects and track how ready you are to explain them in interviews." action={<Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>Add project</Button>} icon={<FolderGit2 size={20} />} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {store.projects.map((p) => {
            const readiness = projectReadiness(p);
            return (
              <Card key={p.id} className="flex flex-col p-4">
                <div className="flex items-start gap-3">
                  <ProgressRing value={readiness} size={64} stroke={6} color={p.color} sublabel="ready" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{p.name}</h3>
                      <Badge tone={PROJECT_STATUS_META[p.status].tone}>{PROJECT_STATUS_META[p.status].label}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-content-muted">{p.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.technologies.map((t) => (
                        <span key={t} className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-content-muted">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <MetricBar label="Interview checklist" value={readiness} color={p.color} right={`${Math.round(readiness)}%`} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="secondary" icon={<CheckSquare size={14} />} onClick={() => setChecklistFor(p)}>
                    Checklist
                  </Button>
                  {p.githubUrl && (
                    <a href={p.githubUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium hover:bg-surface-muted">
                      <Github size={13} /> Repo
                    </a>
                  )}
                  {p.liveUrl && (
                    <a href={p.liveUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium hover:bg-surface-muted">
                      <ExternalLink size={13} /> Live
                    </a>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="ml-auto text-red-500" onClick={() => setToDelete(p)} aria-label="Delete project">
                    <Trash2 size={14} />
                  </Button>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-content-faint">
                  <span>{p.startDate ? `Started ${formatDate(p.startDate)}` : ''}</span>
                  <span>{p.features.length} feature(s)</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Project editor */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add project'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save}>
              {editing ? 'Save changes' : 'Add project'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Campus Lost & Found" />
          </Field>
          <Field label="Description">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="GitHub URL">
              <Input value={form.githubUrl} onChange={(e) => setForm({ ...form, githubUrl: e.target.value })} placeholder="https://github.com/…" />
            </Field>
            <Field label="Live URL">
              <Input value={form.liveUrl} onChange={(e) => setForm({ ...form, liveUrl: e.target.value })} />
            </Field>
            <Field label="Technologies" hint="Comma separated" className="sm:col-span-2">
              <Input value={form.technologies} onChange={(e) => setForm({ ...form, technologies: e.target.value })} placeholder="React, Spring Boot, MySQL" />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_META[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Colour">
              <div className="flex flex-wrap gap-2">
                {SUBJECT_COLORS.map((c) => (
                  <button key={c} onClick={() => setForm({ ...form, color: c })} aria-label={`Colour ${c}`} className={cn('h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-surface', form.color === c ? 'ring-brand' : 'ring-transparent')} style={{ backgroundColor: c }} />
                ))}
              </div>
            </Field>
            <Field label="Start date">
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label="End date">
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </Field>
          </div>
          <Field label="Features" hint="One per line">
            <Textarea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} />
          </Field>
          <Field label="Architecture">
            <Textarea value={form.architecture} onChange={(e) => setForm({ ...form, architecture: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Database">
              <Textarea value={form.database} onChange={(e) => setForm({ ...form, database: e.target.value })} />
            </Field>
            <Field label="APIs">
              <Textarea value={form.apis} onChange={(e) => setForm({ ...form, apis: e.target.value })} />
            </Field>
            <Field label="Authentication">
              <Textarea value={form.authentication} onChange={(e) => setForm({ ...form, authentication: e.target.value })} />
            </Field>
            <Field label="Security">
              <Textarea value={form.security} onChange={(e) => setForm({ ...form, security: e.target.value })} />
            </Field>
            <Field label="Testing">
              <Textarea value={form.testing} onChange={(e) => setForm({ ...form, testing: e.target.value })} />
            </Field>
            <Field label="Deployment">
              <Textarea value={form.deployment} onChange={(e) => setForm({ ...form, deployment: e.target.value })} />
            </Field>
            <Field label="Challenges">
              <Textarea value={form.challenges} onChange={(e) => setForm({ ...form, challenges: e.target.value })} />
            </Field>
            <Field label="Trade-offs">
              <Textarea value={form.tradeoffs} onChange={(e) => setForm({ ...form, tradeoffs: e.target.value })} />
            </Field>
          </div>
          <Field label="Future improvements">
            <Textarea value={form.futureImprovements} onChange={(e) => setForm({ ...form, futureImprovements: e.target.value })} />
          </Field>
        </div>
      </Modal>

      {/* Checklist */}
      <Modal
        open={!!checklistFor}
        onClose={() => setChecklistFor(null)}
        title={checklistFor ? `Interview readiness — ${checklistFor.name}` : ''}
        size="md"
        footer={
          <Button variant="ghost" onClick={() => setChecklistFor(null)}>
            Close
          </Button>
        }
      >
        {liveChecklist && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <ProgressRing value={projectReadiness(liveChecklist)} size={56} stroke={5} />
              <div>
                <div className="text-sm font-medium">Can I explain…</div>
                <div className="text-xs text-content-muted">Tick each item you can confidently talk through in an interview.</div>
              </div>
            </div>
            <div className="divide-y rounded-lg border">
              {PROJECT_CHECKLIST_ITEMS.map((item) => (
                <CheckRow key={item} label={item} checked={!!liveChecklist.checklist[item]} onChange={() => store.toggleProjectChecklist(liveChecklist.id, item)} />
              ))}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete project"
        message={`Delete "${toDelete?.name}"? This removes its checklist and details.`}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) {
            store.deleteProject(toDelete.id);
            toast.push('Project deleted', { tone: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
          }
          setToDelete(null);
        }}
      />

      {store.projects.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-content-muted">
            <Star size={14} className="text-amber-400" />
            Readiness is the percentage of the 13-item interview checklist you have completed for each project.
          </div>
        </Card>
      )}
    </div>
  );
}

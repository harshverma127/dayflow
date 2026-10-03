import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, FolderGit2, RotateCcw, Trash2, Briefcase } from 'lucide-react';
import { useStore } from '@/store';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Tabs, useToast } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { CATEGORY_META, PRIORITY_META, PROJECT_STATUS_META, APPLICATION_STATUS_META } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

type Tab = 'subjects' | 'projects' | 'applications';

export default function Archived() {
  const store = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('subjects');
  const [toDelete, setToDelete] = useState<{ kind: Tab; id: string; name: string } | null>(null);

  const subjects = useMemo(() => store.subjects.filter((s) => s.archived), [store.subjects]);
  const projects = useMemo(() => store.projects.filter((p) => p.archived), [store.projects]);
  const applications = useMemo(() => store.applications.filter((a) => a.archived), [store.applications]);

  const counts = { subjects: subjects.length, projects: projects.length, applications: applications.length };
  const total = counts.subjects + counts.projects + counts.applications;

  const confirmDelete = () => {
    if (!toDelete) return;
    if (toDelete.kind === 'subjects') store.deleteSubject(toDelete.id);
    if (toDelete.kind === 'projects') store.deleteProject(toDelete.id);
    if (toDelete.kind === 'applications') store.deleteApplication(toDelete.id);
    toast.push(`${toDelete.name} permanently deleted`, { tone: 'success' });
    setToDelete(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Archived"
        description="Nothing is hard-deleted the moment you are done with it — archived items live here until you decide otherwise"
        meta={<Badge tone="slate">{total} archived</Badge>}
      />

      <Card className="p-4">
        <div className="flex items-start gap-2 text-xs text-content-muted">
          <Archive size={15} className="mt-0.5 shrink-0 text-accent-sand" />
          <p>
            Archiving keeps the history intact for analytics while decluttering your active workspace. Restore anything you still
            need, or delete it permanently from here.
          </p>
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'subjects', label: 'Subjects', count: counts.subjects },
          { value: 'projects', label: 'Projects', count: counts.projects },
          { value: 'applications', label: 'Applications', count: counts.applications },
        ]}
      />

      {total === 0 ? (
        <EmptyState
          title="Nothing archived"
          message="When you archive a subject, project or application it will show up here."
          icon={<Archive size={20} />}
        />
      ) : (
        <div className="space-y-2">
          {tab === 'subjects' &&
            (subjects.length === 0 ? (
              <EmptyState title="No archived subjects" message="Your active subjects are all in use." />
            ) : (
              subjects.map((s) => (
                <Card key={s.id} className="flex flex-wrap items-center gap-3 p-3.5">
                  <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{s.name}</span>
                      <Badge tone={CATEGORY_META[s.category].tone}>{CATEGORY_META[s.category].label}</Badge>
                      <Badge tone={PRIORITY_META[s.priority].tone}>{PRIORITY_META[s.priority].label}</Badge>
                    </div>
                    <div className="mt-0.5 text-[11px] text-content-faint">
                      Archived {s.archivedAt ? formatDate(s.archivedAt.slice(0, 10)) : '—'} ·{' '}
                      {store.topics.filter((t) => t.subjectId === s.id).length} topics preserved
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<RotateCcw size={13} />}
                      onClick={() => {
                        store.setSubjectArchived(s.id, false);
                        toast.push(`${s.name} restored`, { tone: 'success' });
                      }}
                    >
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-accent-clay"
                      aria-label="Delete permanently"
                      onClick={() => setToDelete({ kind: 'subjects', id: s.id, name: s.name })}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </Card>
              ))
            ))}

          {tab === 'projects' &&
            (projects.length === 0 ? (
              <EmptyState title="No archived projects" message="Your portfolio is all active." icon={<FolderGit2 size={20} />} />
            ) : (
              projects.map((p) => (
                <Card key={p.id} className="flex flex-wrap items-center gap-3 p-3.5">
                  <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{p.name}</span>
                      <Badge tone={PROJECT_STATUS_META[p.status].tone}>{PROJECT_STATUS_META[p.status].label}</Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-content-faint">{p.description || 'No description'}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<RotateCcw size={13} />}
                      onClick={() => {
                        store.updateProject(p.id, { archived: false });
                        toast.push(`${p.name} restored`, { tone: 'success' });
                      }}
                    >
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-accent-clay"
                      aria-label="Delete permanently"
                      onClick={() => setToDelete({ kind: 'projects', id: p.id, name: p.name })}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </Card>
              ))
            ))}

          {tab === 'applications' &&
            (applications.length === 0 ? (
              <EmptyState title="No archived applications" message="Your applications are all active." icon={<Briefcase size={20} />} />
            ) : (
              applications.map((a) => (
                <Card key={a.id} className="flex flex-wrap items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{a.company}</span>
                      <span className="text-xs text-content-muted">{a.role}</span>
                      <Badge tone={APPLICATION_STATUS_META[a.status].tone}>{APPLICATION_STATUS_META[a.status].label}</Badge>
                    </div>
                    {a.applicationDate && <div className="mt-0.5 text-[11px] text-content-faint">Applied {formatDate(a.applicationDate)}</div>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<RotateCcw size={13} />}
                      onClick={() => {
                        store.updateApplication(a.id, { archived: false });
                        toast.push(`${a.company} restored`, { tone: 'success' });
                      }}
                    >
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-accent-clay"
                      aria-label="Delete permanently"
                      onClick={() => setToDelete({ kind: 'applications', id: a.id, name: a.company })}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </Card>
              ))
            ))}
        </div>
      )}

      <div className="text-[11px] text-content-faint">
        Tip: open a subject from <Link to="/subjects" className="text-brand hover:underline">Subjects</Link> to see everything it still
        keeps.
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete permanently"
        message={`Permanently delete "${toDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete permanently"
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Code2, Eye, Pencil, Plus, Search, StickyNote, Trash2 } from 'lucide-react';
import { useStore } from '@/store';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, Select, Tabs, Textarea, useToast } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { cn } from '@/lib/utils';
import type { Note } from '@/types';

/** Minimal, safe markdown renderer: headings, bold, inline code, fenced code, list items. */
function Markdown({ content }: { content: string }) {
  const blocks = useMemo(() => content.split(/```/), [content]);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((block, i) => {
        if (i % 2 === 1) {
          return (
            <pre key={i} className="overflow-x-auto rounded-lg border bg-surface-muted p-3 font-mono text-xs">
              <code>{block.replace(/^\w*\n/, '')}</code>
            </pre>
          );
        }
        return block.split('\n').map((line, j) => {
          const key = `${i}-${j}`;
          if (!line.trim()) return <div key={key} className="h-1" />;
          if (line.startsWith('### ')) return <h4 key={key} className="text-sm font-semibold">{line.slice(4)}</h4>;
          if (line.startsWith('## ')) return <h3 key={key} className="text-base font-semibold">{line.slice(3)}</h3>;
          if (line.startsWith('# ')) return <h2 key={key} className="text-lg font-semibold">{line.slice(2)}</h2>;
          if (/^[-*] /.test(line)) {
            return (
              <div key={key} className="flex gap-2 pl-2">
                <span className="text-content-faint">•</span>
                <span>{inline(line.slice(2))}</span>
              </div>
            );
          }
          return <p key={key}>{inline(line)}</p>;
        });
      })}
    </div>
  );
}

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[0.85em]">{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
}

export default function Notes() {
  const store = useStore();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(store.notes[0]?.id ?? null);
  const [editing, setEditing] = useState<Note | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Note | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const [form, setForm] = useState({ title: '', content: '', tags: '', subjectId: '' });

  const tags = useMemo(() => [...new Set(store.notes.flatMap((n) => n.tags))], [store.notes]);

  const notes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return store.notes
      .filter((n) => (tag === 'all' ? true : n.tags.includes(tag)))
      .filter((n) => (q ? n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) : true))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [store.notes, query, tag]);

  const selected = store.notes.find((n) => n.id === selectedId) ?? notes[0];

  const openCreate = () => {
    setForm({ title: '', content: '', tags: '', subjectId: '' });
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (n: Note) => {
    setForm({ title: n.title, content: n.content, tags: n.tags.join(', '), subjectId: n.subjectId ?? '' });
    setEditing(n);
    setCreating(true);
  };

  const save = () => {
    if (!form.title.trim()) {
      toast.push('Note title required', { tone: 'error' });
      return;
    }
    const payload = {
      title: form.title.trim(),
      content: form.content,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      subjectId: form.subjectId || undefined,
    };
    if (editing) {
      store.updateNote(editing.id, payload);
      toast.push('Note updated', { tone: 'success' });
    } else {
      const id = store.addNote(payload);
      setSelectedId(id);
      toast.push('Note created', { tone: 'success' });
    }
    setCreating(false);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notes"
        description="Interview notes, SQL snippets and pattern templates"
        meta={<Badge tone="slate">{store.notes.length} notes</Badge>}
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>
            New note
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
        <Card className="flex max-h-[70vh] flex-col">
          <div className="space-y-2 border-b p-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-faint" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes…" className="pl-8" aria-label="Search notes" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setTag('all')} className={cn('rounded-md px-2 py-0.5 text-[11px]', tag === 'all' ? 'bg-brand/10 text-brand' : 'text-content-muted hover:bg-surface-muted')}>
                all
              </button>
              {tags.map((t) => (
                <button key={t} onClick={() => setTag(t)} className={cn('rounded-md px-2 py-0.5 text-[11px]', tag === t ? 'bg-brand/10 text-brand' : 'text-content-muted hover:bg-surface-muted')}>
                  #{t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 divide-y overflow-y-auto">
            {notes.length === 0 && <p className="p-4 text-xs text-content-faint">No notes found.</p>}
            {notes.map((n) => (
              <button
                key={n.id}
                onClick={() => { setSelectedId(n.id); setMode('view'); }}
                className={cn('w-full px-3 py-2.5 text-left', selected?.id === n.id ? 'bg-brand/5' : 'hover:bg-surface-muted')}
              >
                <div className="truncate text-sm font-medium">{n.title}</div>
                <div className="mt-0.5 line-clamp-1 text-[11px] text-content-faint">{n.content.replace(/[#*`]/g, '').slice(0, 80)}</div>
                {n.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {n.tags.map((t) => (
                      <span key={t} className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-content-muted">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex min-h-[50vh] flex-col">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState title="No note selected" message="Create your first note to capture something useful." action={<Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>New note</Button>} icon={<StickyNote size={20} />} />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">{selected.title}</h2>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-content-faint">
                    <span>updated {new Date(selected.updatedAt).toLocaleDateString()}</span>
                    {store.subjects.find((s) => s.id === selected.subjectId) && <Badge tone="blue">{store.subjects.find((s) => s.id === selected.subjectId)!.name}</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Tabs
                    value={mode}
                    onChange={setMode}
                    tabs={[
                      { value: 'view', label: 'Preview' },
                      { value: 'edit', label: 'Edit' },
                    ]}
                    className="border-0"
                  />
                  <Button size="icon-sm" variant="ghost" onClick={() => openEdit(selected)} aria-label="Edit note">
                    <Pencil size={14} />
                  </Button>
                  <Button size="icon-sm" variant="ghost" className="text-red-500" onClick={() => setToDelete(selected)} aria-label="Delete note">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {mode === 'view' ? (
                  <Markdown content={selected.content} />
                ) : (
                  <div className="space-y-3">
                    <Field label="Title">
                      <Input value={selected.title} onChange={(e) => store.updateNote(selected.id, { title: e.target.value })} />
                    </Field>
                    <Field label="Content (markdown supported)">
                      <Textarea value={selected.content} onChange={(e) => store.updateNote(selected.id, { content: e.target.value })} className="min-h-[320px] font-mono text-xs" />
                    </Field>
                    <div className="flex items-center gap-2 text-xs text-content-faint">
                      <Eye size={13} /> Switch to Preview to render markdown with code blocks.
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {store.notes.length === 0 && (
        <Card className="flex items-center gap-3 p-4">
          <Code2 size={18} className="text-content-faint" />
          <p className="text-xs text-content-muted">Notes support markdown: headings, **bold**, `inline code` and fenced code blocks for SQL/Java snippets.</p>
        </Card>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={editing ? 'Edit note' : 'New note'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save}>
              {editing ? 'Save note' : 'Create note'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Title">
            <Input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Indexing — quick recap" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tags" hint="Comma separated">
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="dbms, interview" />
            </Field>
            <Field label="Subject">
              <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                <option value="">— none —</option>
                {store.subjects.filter((s) => !s.archived).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Content">
            <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="min-h-[200px] font-mono text-xs" placeholder={'## Heading\n\n- point one\n\n```sql\nSELECT 1;\n```'} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete note"
        message={`Delete "${toDelete?.title}"?`}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) {
            store.deleteNote(toDelete.id);
            toast.push('Note deleted', { tone: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
            setSelectedId(null);
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}

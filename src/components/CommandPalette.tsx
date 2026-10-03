import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CornerDownLeft, Search } from 'lucide-react';
import { useStore } from '@/store';
import { useUi } from '@/uiStore';
import { cn } from '@/lib/utils';

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const store = useStore();
  const setQuickAddOpen = useUi((s) => s.setQuickAddOpen);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const commands: Cmd[] = useMemo(() => {
    const go = (to: string) => () => {
      onClose();
      navigate(to);
    };
    const add = (kind: string, to: string) => () => {
      onClose();
      setQuickAddOpen(true);
      // quick add opens with the chooser; navigate after for context
      setTimeout(() => navigate(to), 0);
      void kind;
    };
    return [
      { id: 'go-dash', label: 'Go to Dashboard', group: 'Navigate', run: go('/') },
      { id: 'go-roadmap', label: 'Go to My Roadmap', group: 'Navigate', run: go('/roadmap') },
      { id: 'go-dsa', label: 'Go to DSA', group: 'Navigate', run: go('/dsa') },
      { id: 'go-subjects', label: 'Go to Subjects', group: 'Navigate', run: go('/subjects') },
      { id: 'go-planner', label: 'Go to Daily Planner', group: 'Navigate', run: go('/planner') },
      { id: 'go-revision', label: 'Go to Revision', group: 'Navigate', run: go('/revision') },
      { id: 'go-analytics', label: 'Go to Analytics', group: 'Navigate', run: go('/analytics') },
      { id: 'go-journal', label: 'Go to Problem Journal', group: 'Navigate', run: go('/journal') },
      { id: 'go-review', label: 'Go to Weekly Review', group: 'Navigate', run: go('/review') },
      { id: 'go-settings', label: 'Go to Settings', group: 'Navigate', run: go('/settings') },
      { id: 'add-task', label: 'Add task', hint: 'N', group: 'Create', run: add('task', '/planner') },
      { id: 'add-problem', label: 'Add DSA problem', group: 'Create', run: add('problem', '/dsa') },
      { id: 'add-session', label: 'Log study session', group: 'Create', run: add('session', '/analytics') },
      { id: 'add-subject', label: 'Add subject', group: 'Create', run: add('subject', '/subjects') },
      { id: 'add-note', label: 'Add note', group: 'Create', run: add('note', '/notes') },
      { id: 'add-project', label: 'Add project', group: 'Create', run: add('project', '/projects') },
      { id: 'add-interview', label: 'Add interview question', group: 'Create', run: add('question', '/interviews') },
    ];
  }, [navigate, onClose, setQuickAddOpen]);

  const dynamic: Cmd[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: Cmd[] = [];
    const push = (label: string, group: string, to: string) => out.push({ id: `${group}-${to}-${label}`, label, group, run: () => { onClose(); navigate(to); } });
    store.subjects.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 5).forEach((s) => push(s.name, 'Subject', `/subjects/${s.id}`));
    store.topics.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 6).forEach((t) => push(t.name, 'Topic', `/subjects/${t.subjectId}`));
    store.dsaProblems.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6).forEach((p) => push(p.name, 'DSA Problem', '/dsa'));
    store.notes.filter((n) => n.title.toLowerCase().includes(q)).slice(0, 5).forEach((n) => push(n.title, 'Note', '/notes'));
    store.projects.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 4).forEach((p) => push(p.name, 'Project', '/projects'));
    store.interviewQuestions.filter((x) => x.question.toLowerCase().includes(q)).slice(0, 4).forEach((x) => push(x.question, 'Interview Q', '/interviews'));
    store.applications.filter((a) => a.company.toLowerCase().includes(q)).slice(0, 4).forEach((a) => push(`${a.company} — ${a.role}`, 'Application', '/applications'));
    store.companies.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 4).forEach((c) => push(c.name, 'Company', '/applications'));
    return out;
  }, [query, store, navigate, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? commands.filter((c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)) : commands;
    return [...base, ...dynamic];
  }, [commands, dynamic, query]);

  useEffect(() => setIndex(0), [query]);

  if (!open) return null;

  const grouped = results.reduce<Record<string, Cmd[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});
  let flatIndex = -1;
  const flat = results;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[10vh]">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="relative z-10 mx-3 w-full max-w-xl overflow-hidden rounded-xl border bg-surface shadow-2xl animate-slide-up">
        <div className="flex items-center gap-2 border-b px-3.5 py-3">
          <Search size={16} className="text-content-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndex((i) => Math.min(results.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                flat[index]?.run();
              }
            }}
            placeholder="Search subjects, topics, problems, notes… or run a command"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-content-faint"
            aria-label="Command input"
          />
          <kbd className="hidden rounded border bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-content-muted sm:block">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto py-1">
          {results.length === 0 && <p className="px-4 py-8 text-center text-sm text-content-faint">No matches for “{query}”.</p>}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="px-3.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-content-faint">{group}</div>
              {items.map((c) => {
                flatIndex += 1;
                const isActive = flatIndex === index;
                const myIndex = flatIndex;
                return (
                  <button
                    key={c.id}
                    onMouseEnter={() => setIndex(myIndex)}
                    onClick={() => c.run()}
                    className={cn('flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm', isActive ? 'bg-brand/10 text-brand' : 'text-content hover:bg-surface-muted')}
                  >
                    <ArrowRight size={14} className={cn('shrink-0', isActive ? 'text-brand' : 'text-content-faint')} />
                    <span className="flex-1 truncate">{c.label}</span>
                    {c.hint && <kbd className="rounded border bg-surface-muted px-1.5 py-0.5 font-mono text-[10px]">{c.hint}</kbd>}
                    {isActive && <CornerDownLeft size={13} className="text-content-faint" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

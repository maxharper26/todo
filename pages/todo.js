import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

function uuid() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(due_date) {
  return due_date && due_date < today();
}

const URGENCY_COLOUR = { high: '#cf222e', medium: '#bf8700', low: '#1a7f37' };
const URGENCIES = ['high', 'medium', 'low'];
const FORM_DEFAULT = { title: '', description: '', urgency: 'medium', category: 'work', due_date: '' };

export default function TodoPage() {
  const [tasks, setTasks] = useState([]);
  const [workOnly, setWorkOnly] = useState(false);
  const [closedOpen, setClosedOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null); // null = add mode, task = edit mode
  const [lastLoaded, setLastLoaded] = useState(null);
  const [form, setForm] = useState(FORM_DEFAULT);
  const draggingId = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => { loadTasks(); }, []);

  useEffect(() => {
    if (modalOpen) setTimeout(() => titleRef.current?.focus(), 50);
  }, [modalOpen]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') closeModal();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && modalOpen) saveTask();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modalOpen, form, editingTask]);

  const CACHE_KEY = 'tasks_cache';
  const CACHE_TTL = 5 * 60 * 1000;

  async function loadTasks(force = false) {
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
          setTasks(cached.data);
          setLastLoaded(new Date(cached.ts).toLocaleTimeString('en-AU'));
          return;
        }
      } catch {}
    }
    const res = await fetch('/api/tasks');
    const data = await res.json();
    const tasks = data.tasks || [];
    setTasks(tasks);
    setLastLoaded(new Date().toLocaleTimeString('en-AU'));
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: tasks })); } catch {}
  }

  async function saveTasks(updated) {
    setTasks(updated);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: updated })); } catch {}
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: updated }),
    });
  }

  function openAddModal() {
    setEditingTask(null);
    setForm(FORM_DEFAULT);
    setModalOpen(true);
  }

  function openEditModal(task) {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || '',
      urgency: task.urgency,
      category: task.category || 'work',
      due_date: task.due_date || '',
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingTask(null);
  }

  async function saveTask() {
    if (!form.title.trim()) return;
    const now = new Date().toISOString();
    let updated;
    if (editingTask) {
      updated = tasks.map(t => t.id === editingTask.id
        ? { ...t, title: form.title.trim(), description: form.description.trim(),
            urgency: form.urgency, category: form.category,
            due_date: form.due_date || null, updated_at: now }
        : t
      );
    } else {
      const newTask = {
        id: uuid(), title: form.title.trim(), description: form.description.trim(),
        urgency: form.urgency, category: form.category, status: 'open',
        due_date: form.due_date || null, created_at: now, updated_at: now,
      };
      updated = [...tasks, newTask];
    }
    setTasks(updated);
    await saveTasks(updated);
    closeModal();
  }

  async function closeTask(id) {
    const updated = tasks.map(t =>
      t.id === id ? { ...t, status: 'closed', updated_at: new Date().toISOString() } : t
    );
    setTasks(updated);
    await saveTasks(updated);
  }

  async function reopenTask(id) {
    const updated = tasks.map(t =>
      t.id === id ? { ...t, status: 'open', updated_at: new Date().toISOString() } : t
    );
    setTasks(updated);
    await saveTasks(updated);
  }

  async function onDrop(e, urgency) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const t = tasks.find(t => t.id === draggingId.current);
    if (!t || t.urgency === urgency) return;
    const updated = tasks.map(t =>
      t.id === draggingId.current ? { ...t, urgency, updated_at: new Date().toISOString() } : t
    );
    setTasks(updated);
    await saveTasks(updated);
  }

  const visible = (list) => workOnly ? list.filter(t => t.category === 'work') : list;
  const open = visible(tasks.filter(t => t.status === 'open'));
  const closed = visible(tasks.filter(t => t.status === 'closed'));
  const totalOpen = tasks.filter(t => t.status === 'open').length;

  return (
    <>
      <div className="topbar">
        <h1>📋 Tasks</h1>
        <div className="topbar-right">
          <span className="stat-pill">
            <strong>{open.length}</strong> open &nbsp;·&nbsp; {totalOpen} total
          </span>
          <div
            className={`cat-switch${workOnly ? ' personal' : ''}`}
            onClick={() => setWorkOnly(w => !w)}
          >
            <div className="cat-switch-pill" />
            <span className={!workOnly ? 'active' : ''}>All</span>
            <span className={workOnly ? 'active' : ''}>Work</span>
          </div>
          <button className="btn btn-ghost" onClick={() => loadTasks(true)}>↻ Refresh</button>
          <button className="btn btn-primary" onClick={openAddModal}>+ Add task</button>

        </div>
      </div>

      <div className="columns">
        {URGENCIES.map(u => (
          <div className="col" key={u}>
            <div className="col-header">
              <div className="col-dot" style={{ background: URGENCY_COLOUR[u] }} />
              <span className="col-title">{u.charAt(0).toUpperCase() + u.slice(1)}</span>
              <span className="col-count">{open.filter(t => t.urgency === u).length}</span>
            </div>
            <div
              className="col-body"
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
              onDrop={e => onDrop(e, u)}
              onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
            >
              {open.filter(t => t.urgency === u)
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .map(t => <Card key={t.id} task={t} onClose={closeTask} onReopen={reopenTask} onEdit={openEditModal} draggingId={draggingId} />)
              }
              {open.filter(t => t.urgency === u).length === 0 && <p className="empty">No tasks</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="closed-section">
        <div className="closed-toggle" onClick={() => setClosedOpen(o => !o)}>
          <span className={`chevron${closedOpen ? ' open' : ''}`}>▶</span>
          <span>Closed</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 2 }}>({closed.length})</span>
        </div>
        {closedOpen && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 12 }}>
            {URGENCIES.map(u => (
              <div className="col" key={u}>
                <div className="col-header">
                  <div className="col-dot" style={{ background: URGENCY_COLOUR[u], opacity: 0.4 }} />
                  <span className="col-title" style={{ color: 'var(--text-muted)' }}>
                    {u.charAt(0).toUpperCase() + u.slice(1)}
                  </span>
                  <span className="col-count">{closed.filter(t => t.urgency === u).length}</span>
                </div>
                <div className="col-body">
                  {closed.filter(t => t.urgency === u)
                    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
                    .map(t => <Card key={t.id} task={t} onClose={closeTask} onReopen={reopenTask} onEdit={openEditModal} draggingId={draggingId} />)
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {lastLoaded && <p className="page-footer">Last loaded {lastLoaded}</p>}

      {/* Add / Edit modal */}
      <div
        className={`modal-overlay${modalOpen ? ' open' : ''}`}
        onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
      >
        <div className="modal">
          <h2>{editingTask ? 'Edit task' : 'New task'}</h2>
          <div className="form-group">
            <label>Title</label>
            <input
              ref={titleRef}
              type="text"
              placeholder="Task title"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Description <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <textarea
              placeholder="More detail…"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Urgency</label>
              <select value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="work">💼 Work</option>
                <option value="personal">🏠 Personal</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Due date <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <input
              type="date"
              value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
            <button className="btn btn-primary" onClick={saveTask}>
              {editingTask ? 'Save changes' : 'Add task'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Card({ task: t, onClose, onReopen, onEdit, draggingId }) {
  const isClosed = t.status === 'closed';
  const overdue = !isClosed && isOverdue(t.due_date);
  const cat = t.category || 'work';

  return (
    <div className={`card${overdue ? ' overdue' : ''}`}>
      <div
        className="card-top"
        draggable={!isClosed}
        onDragStart={!isClosed ? e => { draggingId.current = t.id; e.dataTransfer.effectAllowed = 'move'; } : undefined}
        style={{ cursor: isClosed ? 'default' : 'grab' }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="urgency-dot" style={{ background: URGENCY_COLOUR[t.urgency] }} />
          <span className="task-id">#{t.id.slice(0, 8)}</span>
        </div>
        <div className="card-actions">
          <button className="close-btn" onClick={() => onEdit(t)}>✎ Edit</button>
          {isClosed
            ? <button className="close-btn" onClick={() => onReopen(t.id)}>↺ Reopen</button>
            : <button className="close-btn" onClick={() => onClose(t.id)}>✓ Close</button>
          }
        </div>
      </div>
      <h3 className={isClosed ? 'closed-title' : ''} style={{ userSelect: 'text' }}>{t.title}</h3>
      {t.description && (
        <p className="desc" style={{ userSelect: 'text', wordBreak: 'break-word' }}>
          {t.description.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}
        </p>
      )}
      <div className="card-footer">
        <div className="footer-left">
          {t.due_date && (
            <span className={`due-label${overdue ? ' overdue' : ''}`}>
              Due {t.due_date}{overdue ? ' ⚠' : ''}
            </span>
          )}
        </div>
        <span className="cat-badge">{cat === 'work' ? '💼' : '🏠'}</span>
      </div>
    </div>
  );
}

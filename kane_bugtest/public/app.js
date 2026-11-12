'use strict';

const $ = (sel) => document.querySelector(sel);

const loginView = $('#login-view');
const tasksView = $('#tasks-view');
const loginForm = $('#login-form');
const loginError = $('#login-error');
const taskForm = $('#task-form');
const taskList = $('#task-list');
const taskError = $('#task-error');
const taskEmpty = $('#task-empty');
const modeBadge = $('#mode-badge');

let tasks = [];

function showError(el, message) {
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

async function refreshMode() {
  try {
    const res = await fetch('/api/_mode', { cache: 'no-store' });
    const data = await res.json();
    modeBadge.textContent = 'mode: ' + data.mode;
    modeBadge.classList.toggle('dirty', data.mode !== 'off');
  } catch {
    modeBadge.textContent = 'mode: ?';
  }
}

function renderTasks() {
  taskList.innerHTML = '';
  taskEmpty.hidden = tasks.length > 0;
  tasks.forEach((task) => {
    const li = document.createElement('li');
    li.dataset.taskId = String(task.id);

    const span = document.createElement('span');
    span.className = 'task-title';
    span.textContent = task.title;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'task-delete';
    del.textContent = 'Delete';
    del.addEventListener('click', () => deleteTask(task.id));

    li.append(span, del);
    taskList.appendChild(li);
  });
}

async function loadTasks() {
  const res = await fetch('/api/tasks', { cache: 'no-store' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to load tasks');
  }
  const data = await res.json();
  tasks = data.tasks || [];
  renderTasks();
}

async function enterApp() {
  loginView.hidden = true;
  tasksView.hidden = false;
  showError(loginError, '');
  try {
    await loadTasks();
    showError(taskError, '');
  } catch (err) {
    showError(taskError, err.message);
  }
  await refreshMode();
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  tasks = [];
  renderTasks();
  tasksView.hidden = true;
  loginView.hidden = false;
  loginForm.reset();
  await refreshMode();
}

/**
 * NOTE: intentionally optimistic. On a non-2xx response we show an error,
 * but on a 2xx-without-real-persistence (the `data` bug) we happily render
 * the row. That is exactly the kind of thing a shallow check misses.
 */
async function addTask(title) {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.ok === false) {
    showError(taskError, data.error || 'Could not add task');
    return false;
  }

  tasks.push(data.task);
  renderTasks();
  showError(taskError, '');
  return true;
}

async function deleteTask(id) {
  const res = await fetch('/api/tasks/' + id, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    showError(taskError, data.error || 'Could not delete task');
    return;
  }
  // optimistic removal: trust the 200 and drop the row from the DOM
  tasks = tasks.filter((t) => t.id !== id);
  renderTasks();
  showError(taskError, '');
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError(loginError, '');

  const username = $('#username').value.trim();
  const password = $('#password').value;

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.ok === false) {
    showError(loginError, data.error || 'Sign in failed');
    return;
  }

  await enterApp();
});

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('#task-title');
  const title = input.value.trim();
  if (!title) return;
  const ok = await addTask(title);
  if (ok) input.value = '';
});

$('#logout').addEventListener('click', logout);

(async function boot() {
  await refreshMode();
  const res = await fetch('/api/session', { cache: 'no-store' });
  const data = await res.json().catch(() => ({ authenticated: false }));
  if (data.authenticated) await enterApp();
})();

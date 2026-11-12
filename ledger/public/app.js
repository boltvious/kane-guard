'use strict';

const $ = (s) => document.querySelector(s);
const list = $('#list');
const empty = $('#empty');
const input = $('#title');

function render(issues) {
  list.innerHTML = '';
  empty.hidden = issues.length > 0;
  for (const issue of issues) {
    const li = document.createElement('li');
    li.className = 'issue' + (issue.status === 'done' ? ' done' : '');
    li.dataset.id = String(issue.id);

    const title = document.createElement('span');
    title.className = 'issue-title';
    title.textContent = issue.title;

    const status = document.createElement('span');
    status.className = 'issue-status';
    status.textContent = issue.status;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del-btn';
    del.textContent = 'Hapus';
    del.addEventListener('click', () => remove(issue.id));

    li.append(title, status);

    // Tombol Selesai hanya muncul saat issue masih open. Setelah done,
    // tombol hilang (bukan disabled) supaya tidak ada target untuk diklik
    // dua kali oleh agent atau manusia.
    if (issue.status !== 'done') {
      const done = document.createElement('button');
      done.type = 'button';
      done.className = 'done-btn';
      done.textContent = 'Selesai';
      done.addEventListener('click', () => markDone(issue.id));
      li.append(done);
    }

    li.append(del);
    list.appendChild(li);
  }
}

async function load() {
  const res = await fetch('/api/issues', { cache: 'no-store' });
  const data = await res.json();
  render(data.issues || []);
}

async function add(title) {
  const res = await fetch('/api/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) return false;
  await load();
  return true;
}

async function markDone(id) {
  await fetch(`/api/issues/${id}/done`, { method: 'POST' });
  await load();
}

async function remove(id) {
  await fetch(`/api/issues/${id}`, { method: 'DELETE' });
  await load();
}

$('#add').addEventListener('click', async () => {
  const title = input.value.trim();
  if (!title) return;
  const ok = await add(title);
  if (ok) input.value = '';
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#add').click();
});

load();

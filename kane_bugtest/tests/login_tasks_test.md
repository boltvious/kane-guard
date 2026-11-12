---
url: http://127.0.0.1:4173
---

## Open the app

- Go to http://127.0.0.1:4173
- Confirm the heading "Kane Bug Sandbox" is visible
- Confirm the "Sign in" form is visible

## Reject invalid credentials

- Fill "Username" with `admin`
- Fill "Password" with `wrong-password`
- Click "Sign in"
- Confirm the app still shows the "Sign in" form
- Confirm no "Your tasks" heading is visible

## Sign in with valid credentials

- Fill "Username" with `admin`
- Fill "Password" with `secret123`
- Click "Sign in"
- Confirm the heading "Your tasks" is visible
- Confirm the "Add task" button is visible

## Add a task and verify persistence

- Fill "New task title" with `Buy milk`
- Click "Add task"
- Confirm a task titled `Buy milk` is listed
- Reload the page
- Confirm the heading "Your tasks" is visible
- Confirm a task titled `Buy milk` is still listed

## Delete the task and verify persistence

- Click the "Delete" button on the task titled `Buy milk`
- Confirm no task titled `Buy milk` is listed
- Reload the page
- Confirm no task titled `Buy milk` is listed

## Sign out

- Click "Sign out"
- Confirm the "Sign in" form is visible

# User Acceptance Testing (UAT) Plan - Todo Application

**Version:** 1.0
**Date:** 2025-10-14
**Application:** Todo App
**Test Environment:** http://localhost:3002

---

## Table of Contents

1. [Application Overview](#application-overview)
2. [Test Environment Setup](#test-environment-setup)
3. [Test Scenarios](#test-scenarios)
4. [Test Execution Summary](#test-execution-summary)

---

## Application Overview

### Purpose
The Todo Application is a web-based task management system that allows users to create accounts, log in, and manage their personal todo lists. Each user has a private todo list that is isolated from other users.

### Architecture

**Backend (Node.js/Express):**
- RESTful API server running on port 3002
- SQLite database for persistent storage
- JWT-based authentication
- bcrypt password hashing

**Frontend (Vanilla JavaScript):**
- Single-page application (SPA)
- Token-based authentication with localStorage
- Real-time UI updates
- Responsive design

**Key Technologies:**
- Express.js
- better-sqlite3
- JWT (jsonwebtoken)
- bcrypt
- Vanilla JavaScript (ES6+)
- CSS3 with CSS variables

### Security Features
- Password hashing with bcrypt (10 rounds)
- JWT tokens with 24-hour expiration
- Case-insensitive email handling
- User data isolation (users can only access their own todos)
- Authorization middleware on all protected routes

---

## Test Environment Setup

### Prerequisites
1. Node.js installed (v14 or higher)
2. npm installed
3. Application running on http://localhost:3002

### Starting the Application
```bash
cd /Users/williampearson/Legion/agents/full-stack/__tests__/test-apps/working-todo-app
npm install
npm start
```

### Test Data Cleanup
Before each test suite, the database should be in a clean state. The application creates a fresh SQLite database in `./data/todos.db`.

---

## Test Scenarios

### Scenario 1: User Registration - Valid Registration

**Test ID:** UAT-001
**Priority:** Critical
**User Story:** As a new user, I want to create an account so that I can start managing my todos.

#### Prerequisites
- Application is running
- Browser is open to http://localhost:3002
- User is on the login page
- No existing account with test email

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Navigate to http://localhost:3002 | Login page loads successfully with "Todo App" heading | `screenshots/scenario-1/step-1-landing-page.png` |
| 2 | Click the "Register" tab button | Register form appears with Name, Email, and Password fields | `screenshots/scenario-1/step-2-register-tab.png` |
| 3 | Enter "Test User" in the Name field | Name field accepts input | `screenshots/scenario-1/step-3-name-input.png` |
| 4 | Enter "testuser@example.com" in the Email field | Email field accepts input | `screenshots/scenario-1/step-4-email-input.png` |
| 5 | Enter "password123" in the Password field | Password field shows masked characters | `screenshots/scenario-1/step-5-password-input.png` |
| 6 | Click the "Register" button | Registration succeeds, user is redirected to dashboard | `screenshots/scenario-1/step-6-registration-success.png` |
| 7 | Verify dashboard header | Header shows "Welcome, Test User!" message | `screenshots/scenario-1/step-7-dashboard-welcome.png` |
| 8 | Verify empty todo list | Empty state message displays: "No todos yet. Add one above!" | `screenshots/scenario-1/step-8-empty-todos.png` |

#### Success Criteria
- ✅ Registration form validates all required fields
- ✅ User account is created in the database
- ✅ Password is hashed with bcrypt (not stored in plain text)
- ✅ JWT token is generated and stored in localStorage
- ✅ User is automatically logged in and redirected to dashboard
- ✅ User name displays correctly in the dashboard header
- ✅ Empty todo list shows appropriate message

#### API Verification
```bash
# Verify user created in database
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"testuser@example.com","password":"password123"}'

# Expected Response (200):
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "testuser@example.com",
    "name": "Test User"
  }
}
```

---

### Scenario 2: User Registration - Duplicate Email

**Test ID:** UAT-002
**Priority:** High
**User Story:** As a user, I should not be able to register with an email that already exists in the system.

#### Prerequisites
- Application is running
- An account exists with email "duplicate@example.com"

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Navigate to registration page | Register form is visible | `screenshots/scenario-2/step-1-register-page.png` |
| 2 | Enter "Duplicate User" in Name field | Name field accepts input | `screenshots/scenario-2/step-2-name-input.png` |
| 3 | Enter "duplicate@example.com" in Email field | Email field accepts input | `screenshots/scenario-2/step-3-email-input.png` |
| 4 | Enter "password456" in Password field | Password field accepts input | `screenshots/scenario-2/step-4-password-input.png` |
| 5 | Click "Register" button | Error message displays: "User already exists" | `screenshots/scenario-2/step-5-duplicate-error.png` |
| 6 | Verify user remains on registration page | User is not logged in, registration form is still visible | `screenshots/scenario-2/step-6-stays-on-page.png` |

#### Success Criteria
- ✅ Registration fails with HTTP 409 Conflict status
- ✅ Clear error message is displayed to user
- ✅ User remains on registration page
- ✅ No duplicate user is created in database
- ✅ No token is generated

---

### Scenario 3: User Registration - Case-Insensitive Email

**Test ID:** UAT-003
**Priority:** High
**User Story:** As a user, I should not be able to register with an email that differs only in case from an existing account.

#### Prerequisites
- Application is running
- An account exists with email "testuser@example.com" (lowercase)

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Navigate to registration page | Register form is visible | `screenshots/scenario-3/step-1-register-page.png` |
| 2 | Enter "Another User" in Name field | Name field accepts input | `screenshots/scenario-3/step-2-name-input.png` |
| 3 | Enter "TestUser@Example.COM" in Email field | Email field accepts input (mixed case) | `screenshots/scenario-3/step-3-email-mixedcase.png` |
| 4 | Enter "password789" in Password field | Password field accepts input | `screenshots/scenario-3/step-4-password-input.png` |
| 5 | Click "Register" button | Error message displays: "User already exists" | `screenshots/scenario-3/step-5-duplicate-error.png` |

#### Success Criteria
- ✅ System treats emails as case-insensitive
- ✅ Registration fails with appropriate error message
- ✅ Email is normalized to lowercase in database
- ✅ Prevents duplicate accounts with case variations

---

### Scenario 4: User Registration - Password Validation

**Test ID:** UAT-004
**Priority:** High
**User Story:** As a user, I should be prevented from creating an account with a weak password.

#### Prerequisites
- Application is running
- Browser is on registration page

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Enter "Short Pass User" in Name field | Name field accepts input | `screenshots/scenario-4/step-1-name-input.png` |
| 2 | Enter "shortpass@example.com" in Email field | Email field accepts input | `screenshots/scenario-4/step-2-email-input.png` |
| 3 | Enter "12345" in Password field (5 characters) | Password field accepts input | `screenshots/scenario-4/step-3-short-password.png` |
| 4 | Click "Register" button | Error message displays: "Password must be at least 6 characters" | `screenshots/scenario-4/step-4-password-error.png` |
| 5 | Enter "123456" in Password field (6 characters) | Password field accepts input | `screenshots/scenario-4/step-5-valid-password.png` |
| 6 | Click "Register" button | Registration succeeds, user redirected to dashboard | `screenshots/scenario-4/step-6-success.png` |

#### Success Criteria
- ✅ Passwords with less than 6 characters are rejected
- ✅ Clear validation error message is displayed
- ✅ Passwords with 6 or more characters are accepted
- ✅ HTML5 validation provides immediate feedback

---

### Scenario 5: User Registration - Required Fields

**Test ID:** UAT-005
**Priority:** High
**User Story:** As a user, I should be required to fill in all necessary information to create an account.

#### Prerequisites
- Application is running
- Browser is on registration page

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Leave all fields empty | Form fields are empty | `screenshots/scenario-5/step-1-empty-form.png` |
| 2 | Click "Register" button | Browser HTML5 validation prevents submission, highlights Name field | `screenshots/scenario-5/step-2-name-required.png` |
| 3 | Enter "Required Fields User" in Name field | Name field accepts input | `screenshots/scenario-5/step-3-name-filled.png` |
| 4 | Click "Register" button | Browser validation highlights Email field | `screenshots/scenario-5/step-4-email-required.png` |
| 5 | Enter "required@example.com" in Email field | Email field accepts input | `screenshots/scenario-5/step-5-email-filled.png` |
| 6 | Click "Register" button | Browser validation highlights Password field | `screenshots/scenario-5/step-6-password-required.png` |
| 7 | Enter "password123" in Password field | Password field accepts input | `screenshots/scenario-5/step-7-all-filled.png` |
| 8 | Click "Register" button | Registration succeeds | `screenshots/scenario-5/step-8-success.png` |

#### Success Criteria
- ✅ All fields (Name, Email, Password) are required
- ✅ HTML5 validation prevents form submission with empty fields
- ✅ Clear visual feedback indicates which fields are required
- ✅ Form submits successfully when all fields are filled

---

### Scenario 6: User Login - Valid Credentials

**Test ID:** UAT-006
**Priority:** Critical
**User Story:** As a registered user, I want to log in with my credentials so that I can access my todo list.

#### Prerequisites
- Application is running
- User account exists: email "loginuser@example.com", password "password123"

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Navigate to http://localhost:3002 | Login page is displayed (default tab is "Login") | `screenshots/scenario-6/step-1-login-page.png` |
| 2 | Verify "Login" tab is active | Login tab has blue underline and is highlighted | `screenshots/scenario-6/step-2-login-tab-active.png` |
| 3 | Enter "loginuser@example.com" in Email field | Email field accepts input | `screenshots/scenario-6/step-3-email-input.png` |
| 4 | Enter "password123" in Password field | Password is masked | `screenshots/scenario-6/step-4-password-input.png` |
| 5 | Click "Login" button | Login succeeds, user redirected to dashboard | `screenshots/scenario-6/step-5-login-success.png` |
| 6 | Verify dashboard loads | Header shows "Welcome, [User Name]!" and "My Todos" heading | `screenshots/scenario-6/step-6-dashboard-loaded.png` |
| 7 | Open browser DevTools → Application → Local Storage | authToken and user data are stored | `screenshots/scenario-6/step-7-localstorage.png` |

#### Success Criteria
- ✅ Valid credentials are accepted
- ✅ JWT token is generated and stored in localStorage
- ✅ User object is stored in localStorage
- ✅ User is redirected to dashboard
- ✅ User's todos are loaded and displayed
- ✅ Authentication token is included in subsequent API requests

---

### Scenario 7: User Login - Invalid Credentials

**Test ID:** UAT-007
**Priority:** High
**User Story:** As a user, I should be prevented from logging in with incorrect credentials.

#### Prerequisites
- Application is running
- User account exists: email "loginuser@example.com", password "password123"

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Navigate to login page | Login form is visible | `screenshots/scenario-7/step-1-login-page.png` |
| 2 | Enter "loginuser@example.com" in Email field | Email field accepts input | `screenshots/scenario-7/step-2-email-input.png` |
| 3 | Enter "wrongpassword" in Password field | Password field accepts input | `screenshots/scenario-7/step-3-wrong-password.png` |
| 4 | Click "Login" button | Error message displays: "Invalid credentials" | `screenshots/scenario-7/step-4-invalid-credentials.png` |
| 5 | Verify user remains on login page | Dashboard is not displayed, login form is still visible | `screenshots/scenario-7/step-5-stays-on-login.png` |
| 6 | Check localStorage | No authToken is stored | `screenshots/scenario-7/step-6-no-token.png` |

#### Success Criteria
- ✅ Login fails with HTTP 401 Unauthorized status
- ✅ Generic error message prevents user enumeration
- ✅ User remains on login page
- ✅ No token is generated or stored
- ✅ Password verification uses bcrypt compare

---

### Scenario 8: User Login - Non-Existent User

**Test ID:** UAT-008
**Priority:** High
**User Story:** As a user, I should receive appropriate feedback when attempting to log in with an email that doesn't exist.

#### Prerequisites
- Application is running
- No account exists with email "nonexistent@example.com"

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Navigate to login page | Login form is visible | `screenshots/scenario-8/step-1-login-page.png` |
| 2 | Enter "nonexistent@example.com" in Email field | Email field accepts input | `screenshots/scenario-8/step-2-email-input.png` |
| 3 | Enter "anypassword" in Password field | Password field accepts input | `screenshots/scenario-8/step-3-password-input.png` |
| 4 | Click "Login" button | Error message displays: "Invalid credentials" | `screenshots/scenario-8/step-4-invalid-credentials.png` |

#### Success Criteria
- ✅ Login fails with HTTP 401 Unauthorized status
- ✅ Generic error message (same as wrong password scenario)
- ✅ System does not reveal whether email exists
- ✅ Prevents user enumeration attacks

---

### Scenario 9: User Login - Case-Insensitive Email

**Test ID:** UAT-009
**Priority:** Medium
**User Story:** As a user, I should be able to log in regardless of the email case I use.

#### Prerequisites
- Application is running
- User account exists: email stored as "loginuser@example.com"

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Navigate to login page | Login form is visible | `screenshots/scenario-9/step-1-login-page.png` |
| 2 | Enter "LoginUser@Example.COM" in Email field | Email field accepts mixed case input | `screenshots/scenario-9/step-2-mixedcase-email.png` |
| 3 | Enter "password123" in Password field | Password field accepts input | `screenshots/scenario-9/step-3-password-input.png` |
| 4 | Click "Login" button | Login succeeds, user redirected to dashboard | `screenshots/scenario-9/step-4-login-success.png` |

#### Success Criteria
- ✅ Email comparison is case-insensitive
- ✅ User can log in with any case variation of their email
- ✅ Database query uses COLLATE NOCASE for email lookup

---

### Scenario 10: Session Persistence

**Test ID:** UAT-010
**Priority:** High
**User Story:** As a logged-in user, I should remain logged in when I refresh the page or close and reopen the browser.

#### Prerequisites
- Application is running
- User is logged in (authToken in localStorage)

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | User is logged in and viewing dashboard | Dashboard displays user's todos | `screenshots/scenario-10/step-1-logged-in.png` |
| 2 | Press F5 to refresh the page | Dashboard reloads, user remains logged in | `screenshots/scenario-10/step-2-after-refresh.png` |
| 3 | Verify todos still display | Todo list is loaded from server | `screenshots/scenario-10/step-3-todos-loaded.png` |
| 4 | Open DevTools → Application → Local Storage | authToken and user data are still present | `screenshots/scenario-10/step-4-localstorage-check.png` |
| 5 | Close browser tab | Tab closes | - |
| 6 | Open new tab to http://localhost:3002 | Dashboard loads automatically (user still logged in) | `screenshots/scenario-10/step-6-auto-login.png` |

#### Success Criteria
- ✅ Authentication token persists in localStorage
- ✅ User session survives page refresh
- ✅ User session survives browser close/reopen
- ✅ Token is automatically used for API requests
- ✅ Todos are fetched on page load if token exists

---

### Scenario 11: Create Todo

**Test ID:** UAT-011
**Priority:** Critical
**User Story:** As a logged-in user, I want to create new todo items so that I can track tasks.

#### Prerequisites
- Application is running
- User is logged in and on dashboard
- Todo list is empty or has existing items

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Locate the todo input field at top of dashboard | Input field with placeholder "What needs to be done?" is visible | `screenshots/scenario-11/step-1-input-field.png` |
| 2 | Click into the todo input field | Input field receives focus, border highlights blue | `screenshots/scenario-11/step-2-input-focused.png` |
| 3 | Type "Buy groceries" | Text appears in input field | `screenshots/scenario-11/step-3-text-entered.png` |
| 4 | Click "Add Todo" button | Todo is created and appears at top of list | `screenshots/scenario-11/step-4-todo-created.png` |
| 5 | Verify todo details | Todo shows: unchecked checkbox, "Buy groceries" title, "Delete" button | `screenshots/scenario-11/step-5-todo-details.png` |
| 6 | Verify input field is cleared | Input field is empty and ready for next todo | `screenshots/scenario-11/step-6-input-cleared.png` |
| 7 | Enter "Call dentist" and press Enter key | Todo is created without clicking button | `screenshots/scenario-11/step-7-enter-key.png` |

#### Success Criteria
- ✅ Todo is created with POST to /api/todos
- ✅ Todo appears immediately at top of list
- ✅ New todo is uncompleted by default
- ✅ Input field clears after creation
- ✅ Both button click and Enter key work
- ✅ Todo is saved to database
- ✅ Maximum 200 character limit enforced (HTML maxlength)

---

### Scenario 12: View Todo List

**Test ID:** UAT-012
**Priority:** Critical
**User Story:** As a logged-in user, I want to view all my todo items in a list.

#### Prerequisites
- Application is running
- User is logged in
- User has 3 existing todos:
  1. "Buy groceries" (uncompleted)
  2. "Call dentist" (completed)
  3. "Write report" (uncompleted)

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Dashboard loads after login | Todos are automatically fetched and displayed | `screenshots/scenario-12/step-1-dashboard-loaded.png` |
| 2 | Verify todo count | Three todo items are displayed | `screenshots/scenario-12/step-2-three-todos.png` |
| 3 | Verify todo order | Todos are displayed in reverse chronological order (newest first) | `screenshots/scenario-12/step-3-todo-order.png` |
| 4 | Verify completed todo styling | "Call dentist" has strikethrough text and lighter color | `screenshots/scenario-12/step-4-completed-styling.png` |
| 5 | Verify uncompleted todos | "Buy groceries" and "Write report" have normal text | `screenshots/scenario-12/step-5-uncompleted-styling.png` |

#### Success Criteria
- ✅ All user's todos are fetched from server
- ✅ Todos are displayed in correct order (newest first)
- ✅ Completed todos have visual distinction (strikethrough)
- ✅ Each todo shows checkbox, title, and delete button
- ✅ Loading indicator shows while fetching
- ✅ Only current user's todos are displayed

---

### Scenario 13: View Empty Todo List

**Test ID:** UAT-013
**Priority:** Medium
**User Story:** As a logged-in user with no todos, I should see a helpful message indicating the empty state.

#### Prerequisites
- Application is running
- User is logged in
- User has no todos in their list

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Dashboard loads after login | Empty state message is displayed | `screenshots/scenario-13/step-1-empty-state.png` |
| 2 | Verify message content | Message reads: "No todos yet. Add one above!" | `screenshots/scenario-13/step-2-message-content.png` |
| 3 | Verify message styling | Message is centered with muted gray color | `screenshots/scenario-13/step-3-message-styling.png` |

#### Success Criteria
- ✅ Empty state message displays when todo list is empty
- ✅ Message is clear and helpful
- ✅ Message encourages user to add their first todo
- ✅ No loading spinner remains visible

---

### Scenario 14: Toggle Todo Completion

**Test ID:** UAT-014
**Priority:** Critical
**User Story:** As a logged-in user, I want to mark todos as completed or uncompleted so that I can track my progress.

#### Prerequisites
- Application is running
- User is logged in
- User has todo "Buy groceries" (uncompleted)

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Locate uncompleted todo "Buy groceries" | Todo is displayed with unchecked checkbox | `screenshots/scenario-14/step-1-uncompleted-todo.png` |
| 2 | Click the checkbox next to "Buy groceries" | Checkbox becomes checked immediately | `screenshots/scenario-14/step-2-checkbox-checked.png` |
| 3 | Verify UI update | Todo text gets strikethrough and lighter color | `screenshots/scenario-14/step-3-completed-styling.png` |
| 4 | Verify todo item class | Todo item has "completed" class applied | `screenshots/scenario-14/step-4-completed-class.png` |
| 5 | Refresh the page | Todo remains in completed state | `screenshots/scenario-14/step-5-persisted-state.png` |
| 6 | Click the checkbox again | Checkbox becomes unchecked | `screenshots/scenario-14/step-6-unchecked.png` |
| 7 | Verify UI update | Strikethrough is removed, text color returns to normal | `screenshots/scenario-14/step-7-uncompleted-styling.png` |

#### Success Criteria
- ✅ Clicking checkbox toggles completion status
- ✅ UI updates immediately (optimistic update)
- ✅ PUT request to /api/todos/:id updates server
- ✅ Completed todos show strikethrough styling
- ✅ State persists after page refresh
- ✅ Toggle works in both directions
- ✅ If API call fails, checkbox reverts to previous state

---

### Scenario 15: Delete Todo

**Test ID:** UAT-015
**Priority:** Critical
**User Story:** As a logged-in user, I want to delete todos that are no longer needed.

#### Prerequisites
- Application is running
- User is logged in
- User has todo "Temporary task"

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Locate todo "Temporary task" | Todo is displayed with "Delete" button | `screenshots/scenario-15/step-1-todo-with-delete.png` |
| 2 | Click "Delete" button | Browser confirmation dialog appears: "Are you sure you want to delete this todo?" | `screenshots/scenario-15/step-2-confirm-dialog.png` |
| 3 | Click "Cancel" in confirmation dialog | Dialog closes, todo remains in list | `screenshots/scenario-15/step-3-cancel-delete.png` |
| 4 | Click "Delete" button again | Confirmation dialog appears again | `screenshots/scenario-15/step-4-confirm-dialog-again.png` |
| 5 | Click "OK" in confirmation dialog | Todo is immediately removed from list | `screenshots/scenario-15/step-5-todo-deleted.png` |
| 6 | Verify todo count decreased | Todo count is one less than before | `screenshots/scenario-15/step-6-updated-count.png` |
| 7 | Refresh the page | Deleted todo does not reappear | `screenshots/scenario-15/step-7-persisted-deletion.png` |

#### Success Criteria
- ✅ Delete button is visible on each todo
- ✅ Confirmation dialog prevents accidental deletion
- ✅ Canceling confirmation keeps todo in list
- ✅ Confirming deletion removes todo from UI immediately
- ✅ DELETE request to /api/todos/:id removes from server
- ✅ Deletion persists after page refresh
- ✅ If last todo is deleted, empty state message appears

---

### Scenario 16: Delete Todo - Show Empty State

**Test ID:** UAT-016
**Priority:** Medium
**User Story:** As a logged-in user, when I delete my last todo, I should see the empty state message.

#### Prerequisites
- Application is running
- User is logged in
- User has exactly one todo "Last remaining task"

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Verify only one todo exists | One todo is displayed in list | `screenshots/scenario-16/step-1-one-todo.png` |
| 2 | Click "Delete" button on the todo | Confirmation dialog appears | `screenshots/scenario-16/step-2-confirm-dialog.png` |
| 3 | Click "OK" | Todo is removed from list | `screenshots/scenario-16/step-3-todo-deleted.png` |
| 4 | Verify empty state | Message displays: "No todos yet. Add one above!" | `screenshots/scenario-16/step-4-empty-state.png` |

#### Success Criteria
- ✅ Empty state appears immediately after last todo is deleted
- ✅ No loading spinner or error message
- ✅ Add todo functionality still works

---

### Scenario 17: User Logout

**Test ID:** UAT-017
**Priority:** Critical
**User Story:** As a logged-in user, I want to log out so that others cannot access my account on a shared device.

#### Prerequisites
- Application is running
- User is logged in and on dashboard

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Locate "Logout" button in header | "Logout" button is visible in top-right corner | `screenshots/scenario-17/step-1-logout-button.png` |
| 2 | Click "Logout" button | User is redirected to login page | `screenshots/scenario-17/step-2-login-page.png` |
| 3 | Verify login form is empty | Email and password fields are cleared | `screenshots/scenario-17/step-3-empty-form.png` |
| 4 | Open DevTools → Application → Local Storage | authToken and user data are removed | `screenshots/scenario-17/step-4-cleared-storage.png` |
| 5 | Click browser back button | User remains on login page (cannot access dashboard) | `screenshots/scenario-17/step-5-cannot-go-back.png` |
| 6 | Manually navigate to http://localhost:3002 | Login page is displayed (not dashboard) | `screenshots/scenario-17/step-6-still-logged-out.png` |

#### Success Criteria
- ✅ Logout button is clearly visible
- ✅ Clicking logout clears authToken from localStorage
- ✅ User object is removed from localStorage
- ✅ User is redirected to login page
- ✅ Dashboard is not accessible after logout
- ✅ User must log in again to access dashboard

---

### Scenario 18: User Isolation - Cannot Access Other Users' Todos

**Test ID:** UAT-018
**Priority:** Critical (Security)
**User Story:** As a user, I should only be able to see and manage my own todos, not those of other users.

#### Prerequisites
- Application is running
- Two user accounts exist:
  - User A: "usera@example.com" with todos ["User A Task 1", "User A Task 2"]
  - User B: "userb@example.com" with todos ["User B Task 1"]

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Log in as User A | Dashboard loads with User A's todos | `screenshots/scenario-18/step-1-usera-dashboard.png` |
| 2 | Verify User A's todos | Only "User A Task 1" and "User A Task 2" are visible | `screenshots/scenario-18/step-2-usera-todos.png` |
| 3 | Open DevTools → Network tab | Monitor network requests | - |
| 4 | Refresh the page | GET /api/todos returns only User A's todos | `screenshots/scenario-18/step-4-usera-api-response.png` |
| 5 | Log out | User A is logged out | - |
| 6 | Log in as User B | Dashboard loads with User B's todos | `screenshots/scenario-18/step-6-userb-dashboard.png` |
| 7 | Verify User B's todos | Only "User B Task 1" is visible (User A's todos are NOT shown) | `screenshots/scenario-18/step-7-userb-todos.png` |
| 8 | Open DevTools → Network tab | Monitor network requests | - |
| 9 | Refresh the page | GET /api/todos returns only User B's todos | `screenshots/scenario-18/step-9-userb-api-response.png` |

#### Success Criteria
- ✅ Each user sees only their own todos
- ✅ API endpoint /api/todos filters by user_id from JWT token
- ✅ User cannot access another user's todos via API
- ✅ User cannot modify another user's todos
- ✅ Database queries include user_id filter

#### Security API Test
```bash
# Log in as User A
TOKEN_A=$(curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"usera@example.com","password":"password123"}' \
  | jq -r '.token')

# Get User A's todos
curl http://localhost:3002/api/todos \
  -H "Authorization: Bearer $TOKEN_A"

# Response should only contain User A's todos
```

---

### Scenario 19: Authorization - Protected Routes

**Test ID:** UAT-019
**Priority:** Critical (Security)
**User Story:** As a system, I should prevent unauthorized access to protected API endpoints.

#### Prerequisites
- Application is running
- No user is logged in

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Open browser DevTools → Console | Console is open | - |
| 2 | Execute: `fetch('http://localhost:3002/api/todos')` | Request fails with 401 Unauthorized | `screenshots/scenario-19/step-2-unauthorized-todos.png` |
| 3 | Log in as a user | User receives valid JWT token | - |
| 4 | Log out | Token is cleared from localStorage | - |
| 5 | Execute: `fetch('http://localhost:3002/api/todos')` | Request fails with 401 Unauthorized | `screenshots/scenario-19/step-5-unauthorized-after-logout.png` |

#### Success Criteria
- ✅ /api/todos/* routes require authentication
- ✅ Requests without Authorization header return 401
- ✅ Requests with invalid tokens return 401
- ✅ Requests with expired tokens return 401
- ✅ Authentication middleware is applied to all todo routes

#### API Security Test
```bash
# Attempt to get todos without token
curl http://localhost:3002/api/todos

# Expected Response (401):
{
  "error": "No authorization header"
}

# Attempt with invalid token
curl http://localhost:3002/api/todos \
  -H "Authorization: Bearer invalid-token"

# Expected Response (401):
{
  "error": "Invalid or expired token"
}
```

---

### Scenario 20: Authorization - Cannot Modify Other Users' Todos

**Test ID:** UAT-020
**Priority:** Critical (Security)
**User Story:** As a system, I should prevent users from modifying todos that don't belong to them.

#### Prerequisites
- Application is running
- User A logged in with todo ID 1 (User A's todo)
- User B logged in with todo ID 2 (User B's todo)

#### Test Steps (API Testing)

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Log in as User A, get token | User A has valid JWT token | - |
| 2 | Attempt to update todo ID 2 (User B's todo) using User A's token | PUT /api/todos/2 returns 403 Forbidden | `screenshots/scenario-20/step-2-forbidden-update.png` |
| 3 | Attempt to delete todo ID 2 using User A's token | DELETE /api/todos/2 returns 403 Forbidden | `screenshots/scenario-20/step-3-forbidden-delete.png` |
| 4 | Attempt to get todo ID 2 using User A's token | GET /api/todos/2 returns 403 Forbidden | `screenshots/scenario-20/step-4-forbidden-get.png` |

#### Success Criteria
- ✅ User cannot update another user's todo
- ✅ User cannot delete another user's todo
- ✅ User cannot view another user's todo details
- ✅ All todo operations check ownership via `belongsToUser()`
- ✅ Returns 403 Forbidden (not 404) to confirm resource exists but access is denied

#### API Security Test
```bash
# Log in as User A
TOKEN_A=$(curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"usera@example.com","password":"password123"}' \
  | jq -r '.token')

# Create todo as User B (todo_id = 10)
# Log in as User B
TOKEN_B=$(curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"userb@example.com","password":"password123"}' \
  | jq -r '.token')

# Try to update User B's todo using User A's token
curl -X PUT http://localhost:3002/api/todos/10 \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'

# Expected Response (403):
{
  "error": "Access denied"
}
```

---

### Scenario 21: Create Todo - Empty Title Validation

**Test ID:** UAT-021
**Priority:** High
**User Story:** As a user, I should not be able to create a todo with an empty title.

#### Prerequisites
- Application is running
- User is logged in and on dashboard

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Leave todo input field empty | Input field is empty | `screenshots/scenario-21/step-1-empty-input.png` |
| 2 | Click "Add Todo" button | Nothing happens, no todo is created | `screenshots/scenario-21/step-2-no-action.png` |
| 3 | Enter only spaces "   " in input field | Input field contains whitespace | `screenshots/scenario-21/step-3-whitespace.png` |
| 4 | Click "Add Todo" button | API returns 400 Bad Request: "Title is required" | `screenshots/scenario-21/step-4-validation-error.png` |

#### Success Criteria
- ✅ Frontend prevents submission with empty input (client-side validation)
- ✅ Backend validates trimmed title is not empty
- ✅ Whitespace-only titles are rejected
- ✅ Clear validation message is returned

---

### Scenario 22: JWT Token Expiration

**Test ID:** UAT-022
**Priority:** Medium
**User Story:** As a system, I should invalidate sessions after token expiration for security.

#### Prerequisites
- Application is running
- User has logged in and received a JWT token
- Token is configured to expire in 24 hours

#### Test Steps (Manual Token Manipulation)

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | User is logged in with valid token | Dashboard displays normally | `screenshots/scenario-22/step-1-valid-session.png` |
| 2 | Open DevTools → Application → Local Storage | Copy authToken value | `screenshots/scenario-22/step-2-copy-token.png` |
| 3 | Decode JWT at jwt.io | Token shows expiration time (exp claim) = 24 hours from issue | `screenshots/scenario-22/step-3-token-decoded.png` |
| 4 | Manually modify token in localStorage | Replace token with expired/invalid token | `screenshots/scenario-22/step-4-invalid-token.png` |
| 5 | Refresh the page | User is redirected to login page (401 error) | `screenshots/scenario-22/step-5-redirected-to-login.png` |

#### Success Criteria
- ✅ JWT tokens include expiration claim (exp)
- ✅ Token expiration is set to 24 hours
- ✅ Server validates token expiration on each request
- ✅ Expired tokens return 401 Unauthorized
- ✅ Frontend handles 401 by clearing storage and redirecting to login

---

### Scenario 23: Responsive Design - Mobile View

**Test ID:** UAT-023
**Priority:** Medium
**User Story:** As a mobile user, I should be able to use the todo app on my smartphone.

#### Prerequisites
- Application is running
- User is logged in
- Browser DevTools is open

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Open Chrome DevTools (F12) | DevTools panel opens | - |
| 2 | Click "Toggle device toolbar" (mobile icon) | Mobile emulation mode activates | `screenshots/scenario-23/step-2-mobile-mode.png` |
| 3 | Select "iPhone 12 Pro" from device dropdown | Viewport resizes to 390x844 | `screenshots/scenario-23/step-3-iphone-view.png` |
| 4 | Verify header layout | Header stacks vertically on mobile | `screenshots/scenario-23/step-4-header-stacked.png` |
| 5 | Verify todo form | Input and button stack vertically | `screenshots/scenario-23/step-5-form-stacked.png` |
| 6 | Verify todos list | Todos display properly with full width | `screenshots/scenario-23/step-6-todos-mobile.png` |
| 7 | Add a new todo | Todo is created successfully on mobile | `screenshots/scenario-23/step-7-add-todo-mobile.png` |
| 8 | Toggle a todo | Checkbox interaction works on mobile | `screenshots/scenario-23/step-8-toggle-mobile.png` |
| 9 | Delete a todo | Delete button is tappable and works | `screenshots/scenario-23/step-9-delete-mobile.png` |

#### Success Criteria
- ✅ Layout adapts to mobile viewport (<640px)
- ✅ All interactive elements are tappable (minimum 44x44px)
- ✅ Text is readable without zooming
- ✅ No horizontal scrolling required
- ✅ Forms stack vertically for better mobile UX
- ✅ Header stacks vertically
- ✅ Tab buttons remain accessible

---

### Scenario 24: Browser Compatibility - Multiple Browsers

**Test ID:** UAT-024
**Priority:** Medium
**User Story:** As a user, I should be able to use the todo app in different web browsers.

#### Prerequisites
- Application is running
- User account exists

#### Test Steps

| Browser | Login | Create Todo | Toggle Todo | Delete Todo | Screenshot |
|---------|-------|-------------|-------------|-------------|------------|
| Chrome (latest) | ✅ | ✅ | ✅ | ✅ | `screenshots/scenario-24/chrome-all-features.png` |
| Firefox (latest) | ✅ | ✅ | ✅ | ✅ | `screenshots/scenario-24/firefox-all-features.png` |
| Safari (latest) | ✅ | ✅ | ✅ | ✅ | `screenshots/scenario-24/safari-all-features.png` |
| Edge (latest) | ✅ | ✅ | ✅ | ✅ | `screenshots/scenario-24/edge-all-features.png` |

#### Success Criteria
- ✅ Application works in Chrome
- ✅ Application works in Firefox
- ✅ Application works in Safari
- ✅ Application works in Edge
- ✅ No JavaScript errors in any browser console
- ✅ Consistent visual appearance across browsers
- ✅ All features functional in all tested browsers

---

### Scenario 25: Network Error Handling

**Test ID:** UAT-025
**Priority:** Medium
**User Story:** As a user, I should receive clear feedback when network errors occur.

#### Prerequisites
- Application is running
- User is logged in
- Browser DevTools is open

#### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|----------------|------------|
| 1 | Open DevTools → Network tab | Network panel is open | - |
| 2 | Enable "Offline" mode in DevTools | Browser is offline | `screenshots/scenario-25/step-2-offline-mode.png` |
| 3 | Try to add a new todo | Error message displays: "Failed to add todo" | `screenshots/scenario-25/step-3-add-todo-error.png` |
| 4 | Try to toggle a todo | Checkbox reverts, error alert displays | `screenshots/scenario-25/step-4-toggle-error.png` |
| 5 | Try to delete a todo | Error alert displays: "Failed to delete todo" | `screenshots/scenario-25/step-5-delete-error.png` |
| 6 | Disable "Offline" mode | Browser is online | - |
| 7 | Try to add a todo again | Todo is created successfully | `screenshots/scenario-25/step-7-success-after-online.png` |

#### Success Criteria
- ✅ Network errors are caught and handled gracefully
- ✅ User-friendly error messages are displayed
- ✅ Application doesn't crash on network failure
- ✅ UI reverts to previous state when operations fail
- ✅ Operations succeed once connection is restored

---

## Test Execution Summary

### Test Coverage Matrix

| Category | # Scenarios | Priority |
|----------|-------------|----------|
| User Registration | 5 | Critical/High |
| User Authentication | 4 | Critical/High |
| Session Management | 2 | High/Medium |
| Todo CRUD Operations | 7 | Critical/High |
| Security & Authorization | 3 | Critical |
| User Isolation | 2 | Critical |
| UI/UX | 2 | Medium |
| Error Handling | 1 | Medium |
| **Total** | **25** | - |

### Pass/Fail Criteria

**Overall Test Suite Passes If:**
- ✅ All Critical priority scenarios pass (18 scenarios)
- ✅ At least 90% of High priority scenarios pass
- ✅ At least 80% of Medium priority scenarios pass
- ✅ No security vulnerabilities discovered
- ✅ No data corruption or loss occurs

### Test Environment Cleanup

After completing all test scenarios:
1. Stop the application server
2. Remove test database: `rm -f data/todos.db`
3. Clear browser localStorage
4. Close all browser tabs

---

## Appendix A: API Endpoint Reference

### Authentication Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| /api/auth/register | POST | Create new user account | No |
| /api/auth/login | POST | Authenticate user | No |
| /api/auth/me | GET | Get current user info | Yes |

### Todo Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| /api/todos | GET | Get all user's todos | Yes |
| /api/todos | POST | Create new todo | Yes |
| /api/todos/:id | GET | Get specific todo | Yes |
| /api/todos/:id | PUT | Update todo | Yes |
| /api/todos/:id | DELETE | Delete todo | Yes |

### Health Check

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| /health | GET | Server health check | No |

---

## Appendix B: Test Data

### Test User Accounts

| Name | Email | Password | Purpose |
|------|-------|----------|---------|
| Test User | testuser@example.com | password123 | General testing |
| User A | usera@example.com | password123 | Isolation testing |
| User B | userb@example.com | password123 | Isolation testing |
| Login User | loginuser@example.com | password123 | Login testing |

### Test Todo Items

| User | Title | Completed | Purpose |
|------|-------|-----------|---------|
| User A | Buy groceries | false | CRUD testing |
| User A | Call dentist | true | Completion testing |
| User A | Write report | false | CRUD testing |
| User B | User B Task 1 | false | Isolation testing |

---

## Appendix C: Known Limitations

1. **Password Reset**: No password reset functionality (not implemented)
2. **Email Verification**: No email verification (not implemented)
3. **Remember Me**: No "remember me" option (not implemented)
4. **Todo Editing**: No inline todo editing (not implemented)
5. **Todo Priorities**: No priority levels (not implemented)
6. **Todo Categories**: No categories or tags (not implemented)
7. **Search/Filter**: No search or filter functionality (not implemented)
8. **Pagination**: No pagination for large todo lists (not implemented)

---

## Appendix D: Screenshot Directory Structure

```
__tests__/
└── screenshots/
    ├── scenario-1/
    │   ├── step-1-landing-page.png
    │   ├── step-2-register-tab.png
    │   └── ...
    ├── scenario-2/
    │   └── ...
    └── scenario-25/
        └── ...
```

**Note:** Screenshots will be captured during integration testing by the Integration Tester agent.

---

**End of UAT Test Plan**

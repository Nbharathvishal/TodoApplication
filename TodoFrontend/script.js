// Shared script for login, register, and todos pages
const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.protocol === "file:";

const SERVER_URL = isLocal
    ? "http://localhost:8080"
    : "https://todo-backend-zyqf.onrender.com";

function getToken() {
    return localStorage.getItem("token");
}

function getLoggedInEmail() {
    return localStorage.getItem("userEmail") || "User";
}

// Logout logic
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    window.location.href = "login.html";
}

// Login page logic
function login() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const btn = document.getElementById("login-btn");

    if (!email || !password) {
        alert("Please enter both email and password");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Logging in...";
    }

    fetch(`${SERVER_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => { throw new Error(text || "Login Failed"); });
        }
        return response.json();
    })
    .then(data => {
        localStorage.setItem("token", data.token);
        localStorage.setItem("userEmail", email);
        window.location.href = "todos.html";
    })
    .catch(error => {
        alert(error.message);
    })
    .finally(() => {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Login";
        }
    });
}

// Register page logic
function register() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const btn = document.getElementById("register-btn");

    if (!email || !password) {
        alert("Please enter both email and password");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Registering...";
    }

    fetch(`${SERVER_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })
    .then(response => {
        if (response.ok) {
            alert("Registration Successful, Please Login");
            window.location.href = "login.html";
        } else {
            return response.text().then(text => { throw new Error(text || "Registration Failed"); });
        }
    })
    .catch(error => {
        alert(error.message);
    })
    .finally(() => {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Register";
        }
    });
}

// Todos page logic
function createTodoCard(todo) {
    const card = document.createElement("div");
    card.className = "todo-card";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todo-checkbox";
    checkbox.checked = todo.completed;

    checkbox.addEventListener("change", function () {
        const updatedTodo = {
            ...todo,
            completed: checkbox.checked
        };
        updateTodoStatus(updatedTodo);
    });

    const span = document.createElement("span");
    span.textContent = todo.title;

    if (todo.completed) {
        span.style.textDecoration = "line-through";
        span.style.color = "gray";
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "X";

    deleteBtn.onclick = function () {
        deleteTodo(todo.id);
    };

    card.appendChild(checkbox);
    card.appendChild(span);
    card.appendChild(deleteBtn);

    return card;
}

function loadTodos() {
    const currentToken = getToken();
    if (!currentToken) {
        alert("Please Login First");
        window.location.href = "login.html";
        return;
    }

    // Update email display if available
    const emailElem = document.getElementById("user-email");
    if (emailElem) {
        emailElem.textContent = `Logged in: ${getLoggedInEmail()}`;
    }

    fetch(`${SERVER_URL}/api/todo`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${currentToken}`
        }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem("token");
                throw new Error("Session expired. Please log in again.");
            }
            throw new Error("Failed to get Todos");
        }
        return response.json();
    })
    .then(todos => {
        const todoList = document.getElementById("todo-list");
        todoList.innerHTML = "";

        if (!todos || todos.length === 0) {
            todoList.innerHTML = '<p id="empty-message">No Todos yet. Add one below!</p>';
        } else {
            todos.forEach(todo => {
                todoList.appendChild(createTodoCard(todo));
            });
        }
    })
    .catch(error => {
        console.error(error);
        if (error.message.includes("Session expired")) {
            alert(error.message);
            window.location.href = "login.html";
        } else {
            document.getElementById("todo-list").innerHTML =
                '<p style="color:red">Failed to load Todos. Please try again.</p>';
        }
    });
}

function addTodo() {
    const currentToken = getToken();
    if (!currentToken) {
        alert("Please Login First");
        window.location.href = "login.html";
        return;
    }

    const input = document.getElementById("new-todo");
    const todoText = input.value.trim();

    if (!todoText) {
        alert("Please enter a Todo");
        return;
    }

    fetch(`${SERVER_URL}/api/todo/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`
        },
        body: JSON.stringify({
            title: todoText,
            description: todoText,
            completed: false
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Failed to Add Todo");
        }
        return response.json();
    })
    .then(() => {
        input.value = "";
        loadTodos();
    })
    .catch(error => {
        console.error(error);
        alert(error.message);
    });
}

function updateTodoStatus(todo) {
    const currentToken = getToken();
    if (!currentToken) {
        alert("Please Login First");
        window.location.href = "login.html";
        return;
    }

    fetch(`${SERVER_URL}/api/todo`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`
        },
        body: JSON.stringify(todo)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Failed to Update Todo");
        }
        return response.json();
    })
    .then(() => {
        loadTodos();
    })
    .catch(error => {
        console.error(error);
        alert(error.message);
    });
}

function deleteTodo(id) {
    const currentToken = getToken();
    if (!currentToken) {
        alert("Please Login First");
        window.location.href = "login.html";
        return;
    }

    fetch(`${SERVER_URL}/api/todo/${id}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${currentToken}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Failed to Delete Todo");
        }
        return response.text();
    })
    .then(() => {
        loadTodos();
    })
    .catch(error => {
        console.error(error);
        alert(error.message);
    });
}

// Page-specific initializations
document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("todo-list")) {
        loadTodos();
    }
});


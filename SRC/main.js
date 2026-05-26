const API_HEADERS = {
  'Content-Type': 'application/json',
};

function getApiBaseUrl() {
  const { protocol, hostname, port, origin } = window.location;
  if (protocol === 'file:') return 'http://127.0.0.1:3000';
  if ((hostname === '127.0.0.1' || hostname === 'localhost') && port && port !== '3000')
    return `${protocol}//${hostname}:3000`;
  return origin;
}

async function apiRequest(path, payload) {
  const apiBaseUrl = getApiBaseUrl();

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  return data;
}

async function getUserByEmail(email) {
  const data = await apiRequest('/api/users/by-email', { email });
  return data.user;
}

async function getUserByUsername(username) {
  const data = await apiRequest('/api/users/by-username', { username });
  return data.user;
}

async function addUser(user) {
  const data = await apiRequest('/api/users', user);
  return data.id;
}

async function getUserByEmailAndPassword(email, password) {
  const data = await apiRequest('/api/login', { email, password });
  return data.user;
}

async function getAdminByEmailAndPassword(email, password) {
  const data = await apiRequest('/api/admin/login', { email, password });
  return data.admin;
}

window.AppDB = {
  getUserByEmail,
  getUserByUsername,
  addUser,
  getUserByEmailAndPassword,
  getAdminByEmailAndPassword,
};

import { createCookieGetter } from './cookieParser.js';
const getCookie = createCookieGetter(document.cookie);

export const getToken = () => {
  const cookieToken = getCookie('token');
  const sessionToken = sessionStorage.getItem('token');
  const localToken = localStorage.getItem('token');
  return cookieToken || sessionToken || localToken;
}

export const saveToken = (token) => {
  const remember = localStorage.getItem('remember') === 'true';
  if (remember) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
    sessionStorage.setItem('token', token);
  }
}

export const setRemember = (remember) => {
  localStorage.setItem('remember', `${remember}`);
}

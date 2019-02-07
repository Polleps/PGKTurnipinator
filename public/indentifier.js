import { createCookieGetter } from './cookieParser.js';
const getCookie = createCookieGetter(document.cookie);

export const getAccesstoken = () => {
  const cookieToken = getCookie('accesstoken');
  const sessionToken = sessionStorage.getItem('accesstoken');
  const localToken = localStorage.getItem('accesstoken');
  return cookieToken || sessionToken || localToken;
}

export const saveToken = (token) => {
  const remember = localStorage.getItem('remember') === 'true';
  if (remember) {
    localStorage.setItem('accesstoken', token);
  } else {
    sessionStorage.setItem('accesstoken', token);
  }
}

export const setRemember = (remember) => {
  localStorage.setItem('remember', `${remember}`);
}

import { createCookieGetter } from './cookieParser.js';
const getCookie = createCookieGetter(document.cookie);

export const getToken = () => {
  return getCookie('token');
}

export const setRemember = (remember) => {
  localStorage.setItem('remember', `${remember}`);
}

export const forgetToken = () => {
  sessionStorage.removeItem('token');
  localStorage.removeItem('token');
  deleteCookie('token');
}

export const saveToken = (token)  => {
  const remember = localStorage.getItem('remember') === 'true';
  if (!remember) {
    setExpireAfterSession('token', token);
  }
}
export const setExpireAfterSession = (name, value) => {
  console.log('setExpire');
  document.cookie = `${name}=${value};path=/bot/`;
}

function deleteCookie(name) {
  document.cookie = name + '= ; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/bot/';
}

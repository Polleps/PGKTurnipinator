export const createAgent = (token) => {
  const baseURL = '/actions';
  return {
    postAction: async (action) => {
      const headers = { 'Content-Type': 'application/json' };
      const body = { action, token };
      const options = { headers, body: JSON.stringify(body), method: 'POST' };
      console.log(options);
      return fetch(baseURL + '/run', options).then(res => res.json());
    }
  }
}

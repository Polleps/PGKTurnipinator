export const createAgent = (token) => {
  const baseURL = '/actions';
  const tournamentURL = '/actions/tournamentdetails';

  return {
    postAction: async (action) => {
      const headers = { 'Content-Type': 'application/json' };
      const body = { action, token };
      const options = { headers, body: JSON.stringify(body), method: 'POST' };
      console.log(options);
      return fetch(baseURL + '/run', options).then(res => res.json());
    },

    fetchTournamentDetails: async (slug) => {
      if (slug.trim() === '') {
        return {message: 'Enter a slug', error: true};
      }
      const headers = { 'Content-Type': 'application/json' };
      const body = { token };
      const options = { headers, body: JSON.stringify(body), method: 'POST' };
      console.log(options);
      return fetch(`${tournamentURL}/${slug}`, options).then(res => res.json());
    }
  }
}

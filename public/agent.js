export const createAgent = (token) => {
  const baseURL = '/actions';
  const tournamentURL = '/actions/tournament';

  return {
    postAction: async (action) => {
      const headers = { 'Content-Type': 'application/json' };
      const body = { action, token };
      const options = { headers, body: JSON.stringify(body), method: 'POST' };
      console.log(options);
      return fetch(baseURL + '/run', options).then(res => res.json());
    },

    fetchTournamentDetails: async (slug) => {
      const headers = { 'Content-Type': 'application/json' };
      const body = { token };
      const options = { headers, body: JSON.stringify(body), method: 'POST' };
      console.log(options);
      return fetch(`${tournamentURL}/${slug}`, options).then(res => res.json());
    }
  }
}

import Flair from './actions/flair.js';

export const performAction = async (parsedURL, token) => {
  const validActions = new Map([
    ['flair', Flair]
  ]);
  const action = parsedURL.action;
  if (!(action && validActions.has(action))) throw new Error('No action paremeter in URL');

  const actionInstance = new (validActions.get(action))(parsedURL, token);

  if (!actionInstance.isValid()) throw new Error('URL not valid.');
  return actionInstance.run();
}

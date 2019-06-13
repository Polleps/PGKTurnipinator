const newValidator = (errorMsg, condition) => {
  return () => new Promise((resolve, reject) => {
    if (condition()) {
      resolve(true);
    } else {
      reject(errorMsg);
    }
  });
}

const empty = x => () => x !== '';
const priceEmpty = x => () => x.length === 1 && x[0].name === '' && x[0].amount === '';

export const createValidators = state => {
  return [
    newValidator("Smash.gg link is empty", empty(state.url)),
    newValidator("Title is empty", empty(state.title)),
    newValidator("Start Date is empty", empty(state.startDate)),
    newValidator("End Date is empty", empty(state.endDate)),
    newValidator("Start Date is after End Date", () => (new Date(state.startDate)) < (new Date(state.endDate))),
    newValidator("Start Date is before current date", () => (new Date(state.startDate) > Date.now())),
    newValidator("Location is empty", empty(state.location)),
    newValidator("The smash.gg page does not contain a City", empty(state.city)),
    newValidator("Tournament needs at least 1 event", () => state.events.length > 0),
    newValidator("At least one events needs an entry cap", () => state.events.some(e => e.cap && +e.cap > 0)),
    newValidator("Additional Notes cannot be longer than 250 characters", () => state.description.length < 250),
    newValidator("A price needs a value", () => priceEmpty(state.prices)() || state.prices.every(p => p.amount !== '')),
    newValidator("A price needs a name", () => priceEmpty(state.prices)() || state.prices.every(p => p.name !== '')),
  ]
}


export const validate = (validators) => {
  return new Promise((resolve, reject) => {
    Promise.all(validators.map(v => v()))
      .then(success => resolve(success[0]))
      .catch(validationErr => reject(validationErr));
  })
}

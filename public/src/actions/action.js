export default class Action {
  constructor(args) {
    this.args = args;
  }

  run() {
    throw new Error('Base Action class can not be ran');
  }

  isValid() {
    return true;
  }
}

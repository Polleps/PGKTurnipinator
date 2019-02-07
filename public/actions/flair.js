import Action from "./action.js";

export default class Flair extends Action {
  constructor(args) {
    super(args);
  }

  run() {
    console.log('flair');
  }

  isValid() {
    const { perform, role } = this.args;
    return (perform === 'add' || perform === 'remove') && role;
  }
}

import Action from "./action.js";
import { createAgent } from "../agent.js";

export default class Flair extends Action {
  constructor(args, token) {
    super(args);
    this.agent = createAgent(token);
  }

  run() {
    const { perform, role } = this.args;
    return this.agent.postAction({ name: 'flair', args: [perform, role] });
  }

  isValid() {
    const { perform, role } = this.args;
    return (perform === 'add' || perform === 'remove') && role;
  }
}

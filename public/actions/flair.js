import Action from "./action.js";
import { createAgent } from "../agent.js";
import { findElement } from "../helpers.js";

export default class Flair extends Action {
  constructor(args, token) {
    super(args);
    this.agent = createAgent(token);
  }

  async run() {
    const { perform, role } = this.args;
    const result = await this.agent.postAction({ name: 'flair', args: [perform, role] });
    const contentEL = findElement('.content');
    contentEL.innerHTML = `<section class="action-message">${result.message}</section>`
  }

  isValid() {
    const { perform, role } = this.args;
    return (perform === 'add' || perform === 'remove') && role;
  }
}

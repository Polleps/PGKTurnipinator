import { html } from 'lit-html';
import { input } from './input.js';

export const eventInput = ({ key, name = '', cap = '', isLast, onNew, onDelete, bind, disabled, capdisabled }) => {
  const state = {name, cap, key};
  const onClick = () => {
    if (isLast) {
      onNew(state);
    } else {
      onDelete(state);
    }
  };
  const icon = isLast ? 'add' : 'delete'
  return html`
  <div class="form-row">
    ${input({
      name: 'eventname' + state.key,
      value: state.name,
      classes: 'flex1',
      placeholder: 'Event Name',
      disabled,
      bind: (val) => {
        state.name = val;
        bind(state);
      },
    })}
    ${input({
      type: 'number',
      name: 'eventcap' + state.key,
      value: state.cap,
      classes: 'flex1',
      placeholder: 'Player Cap',
      disabled: disabled || capdisabled,
      bind: (val) => {
        state.cap = val;
        bind(state);
      },
    })}
    <a href="#" class="flex-auto add-btn" @click=${onClick}>
      <i class="material-icons">${icon}</i>
    </a>
    </div>
  `;
}

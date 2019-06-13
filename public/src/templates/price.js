import { html } from 'lit-html';
import { input } from './input.js';

export const priceInput = ({key, name = '', amount = '', isLast, onNew, onDelete, bind, disabled }) => {
  const state = {name, amount, key};
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
      name: 'pricename' + state.key,
      value: state.name,
      classes: 'flex1',
      placeholder: 'Price Name',
      disabled,
      bind: (val) => {
        state.name = val;
        bind(state);
      },
    })}
    ${input({
      type: 'number',
      name: 'priceamount' + state.key,
      value: state.cap,
      classes: 'flex1',
      placeholder: 'Amount',
      disabled,
      bind: (val) => {
        state.amount = val;
        bind(state);
      },
    })}
    <a href="#" class="flex-auto add-btn" @click=${onClick}>
      <i class="material-icons">${icon}</i>
    </a>
    </div>
  `;
}

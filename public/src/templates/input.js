import { html } from 'lit-html';
export const input = ({
  type = 'text',
  name,
  value, bind = () => { return; },
  classes,
  placeholder = '',
  disabled = false,
}) => {
  return html`
    <input
      type=${type}
      name=${name}
      class=${typeof classes==='string' ? classes : classes.join(' ')}
      .value=${value}
      @input=${change(bind)}
      placeholder=${placeholder}
      ?disabled=${disabled}
    />
  `;
}

const change = (binder) => ({
  handleEvent(e) {
    binder(e.target.value);
  },
  capture: true,
});

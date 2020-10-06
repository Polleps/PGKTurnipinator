import { html } from 'lit-html';
export const checkbox = ({
  name,
  value,
  bind = () => { return; },
  classes,
  label,
  disabled = false,
}) => {
  return html`
    <input
      type="checkbox"
      name=${name}
      id=${name}
      class=${typeof classes==='string' ? classes : classes.join(' ')}
      ?checked=${value}
      @input=${change(bind)}
      ?disabled=${disabled}
    />
    <label for=${name}>${label}</label>
  `;
}

const change = (binder) => ({
  handleEvent(e) {
    binder(e.target.checked);
  },
  capture: true,
});

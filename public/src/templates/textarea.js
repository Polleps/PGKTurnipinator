import { html } from 'lit-html';
export const textarea = ({
  name,
  value = '',
  bind = () => { return; },
  classes,
  placeholder = '',
  cols= '60',
  rows= '10',
  disabled = false,
  maxLength = 500,
}) => {
  return html`
    <textarea
      name=${name}
      class=${typeof classes==='string' ? classes : classes.join(' ')}
      .value=${value}
      @input=${change(bind)}
      placeholder=${placeholder}
      wrap="hard"
      ?disabled=${disabled}
      cols=${cols}
      rows=${rows}
      maxlength=${maxLength}
    />
  `;
}

const change = (binder) => ({
  handleEvent(e) {
    binder(e.target.value);
  },
  capture: true,
});

import { html } from 'https://unpkg.com/lit-html?module';
export const textarea = ({
  name,
  value = '',
  bind = () => { return; },
  classes,
  placeholder = '',
  cols= '30',
  rows= '10'
}) => {
  return html`
    <textarea
      name=${name}
      class=${typeof classes==='string' ? classes : classes.join(' ')}
      .value=${value}
      @input=${change(bind)}
      placeholder=${placeholder}
      wrap="hard"
      cols=${cols}
      rows=${rows}
    />
  `;
}

const change = (binder) => ({
  handleEvent(e) {
    binder(e.target.value);
  },
  capture: true,
});

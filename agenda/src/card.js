import { html } from 'lit-html';
import { pf } from './image';
import { title } from './title';
import { info } from './info';
import { eventList } from './events';
import { registerButton } from './register';

export const card = (t) => html`
<li class="card-list-item" ?prcount=${t.pr}>
  <div class="card">
    ${pf(t.image)}
    ${title(t.title)}
    ${info(t)}
    ${eventList(t.events)}
    ${registerButton(t.url, t.registrationClosesAt, t.startDate)}
  </div>
</li>
`;

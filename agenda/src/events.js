import { html } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat';
export const eventList = (events) => html`
<ul class="event-list">
  ${repeat(events, (e) => e, e => html`<li>${e.name}</li>`)}
</ul>`;

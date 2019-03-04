import Action from "./action.js";
import { createAgent } from "../agent.js";
import { html, render } from 'https://unpkg.com/lit-html?module';
import { repeat } from 'https://unpkg.com/lit-html@1.0.0/directives/repeat.js?module'
import { input } from '../templates/input.js';
import { eventInput } from '../templates/event.js';
import { priceInput } from '../templates/price.js';
import { textarea } from '../templates/textarea.js';

export default class PostTournament extends Action {
  constructor(args, token) {
    super(args);
    this.agent = createAgent(token);
    this.state = {
      smashggLink: '',
      title: '',
      startDate: '',
      endDate: '',
      location: '',
      events: [{name: '', cap: '', key: randomID()}],
      description: '',
      prices: [{name: '', amount: '', key: randomID()}],
      imgURL: '',
    }
    this.submitTournament = this.submitTournament.bind(this);
    this.postMessage = undefined;
  }

  run() {
    this.render();
  }

  render() {
    const contentEL = document.querySelector('.content');
    const ui = html`
    <form action="post" class="tournament-form">
      <h4>Enter Tournament Details</h4>
      <div class="form-row"><span>Smash.gg</span></div>
      <div class="form-row">
        ${input({
          name: "smashgg",
          value: this.state.smashggLink,
          classes: ["flex1 icon-input ta-link"],
          bind: (val) => {
            this.extractSlug(val);
          },
          placeholder: 'Smash.gg link (or slug)'
        })}
        ${html`<a href="#" class="fill-btn flex-auto" @click=${() => this.fetchTournament(this.state.smashggLink).then(() => this.render())}>Fill</a>`}
      </div>
      ${this.state.error ? html`<span class="fetch-error">${this.state.error}</span>` : ''}
      <div class="form-row gap"></div>
      <div class="form-row">
        <span class="icon-label">
          <i class="material-icons">list</i>
          Details
        </span>
      </div>
      <div class="form-row">
        ${input({
          name: "title",
          value: this.state.title,
          classes: "flex1",
          placeholder: "Tournament Name",
          bind: (val) => this.state.title = val,
        })}
      </div>
      <div class="form-row">
      ${input({
          name: "location",
          value: this.state.location,
          classes: "flex1 icon-input ta-location",
          placeholder: "Location",
          bind: (val) => this.state.location = val,
        })}
      </div>
      <div class="form-row">
        ${input({
          type: "datetime-local",
          name: "start_date",
          value: this.state.startDate,
          classes: "flex1 icon-input ta-date",
          bind: (val) => this.state.startDate = val,
        })}
        <span class="flex-auto date-divider"> - </span>
        ${input({
          type: "datetime-local",
          name: "end_date",
          value: this.state.endDate,
          classes: "flex1 icon-input ta-date",
          bind: (val) => this.state.endDate = val,
        })}
      </div>
      <div class="form-row"><span class="icon-label"><i class="material-icons">games</i>Events/Games</span></div>
        ${this.mapEvents()}
        <div class="form-row">
        <span class="icon-label">
          <i class="material-icons">speaker_notes</i>
          Additional Notes
          ${this.state.description.length > 0 ?
          html`<span class="counter">(${this.state.description.length}/250)</span>`
          : ''}
        </span>
      </div>
      <div class="form-row">
        ${textarea({
          name: "description",
          value: this.state.description,
          classes: "flex1",
          bind: (val) => {
            this.state.description = val;
            this.render();
          },
          maxLength: 250,
        })}
        ${this.state.imgURL ?
        html`
        <div class="flex1 logo-holder">
          <img src="${this.state.imgURL}" />
        </div>`
        : ''}
      </div>
      <div class="form-row"><span class="icon-label"><i class="material-icons">euro_symbol</i>Prices</span></div>
      ${this.mapPrices()}
      <div class="form-row">
        <a href="#" class="post-btn" @click=${createClick(this.submitTournament)}>Post</a>
      </div>
      ${this.postMessage ? html`
        <div class="form-row">
          <span class="fetch-error flex-auto">${this.postMessage}</span>
        </div>
      ` : ''}
    </form>`;
    render(ui, contentEL);
  }

  mapEvents() {
    return repeat(this.state.events, (evt) => evt.key, (evt, index) => eventInput({
      key: evt.key,
      name: evt.name,
      cap: evt.cap,
      onNew: () => {
        this.state.events.push({name: '', cap: '', key: randomID()});
        this.render();
      },
      onDelete: (e) => {
        this.state.events.splice(index, 1);
        console.log(e);
        console.log(this.state.events);
        this.render();
      },
      bind: (val) => {
        this.state.events[index] = {name: val.name, cap: val.cap, key: val.key};
      },
      isLast: this.state.events.length - 1 === index,
    }))
  }

  mapPrices() {
    return repeat(this.state.prices, (price) => price.key, (price, index) => priceInput({
      key: price.key,
      name: price.name,
      amount: price.amount,
      onNew: () => {
        this.state.prices.push({name: '', amount: '', key: randomID()});
        this.render();
      },
      onDelete: (e) => {
        this.state.prices.splice(index, 1);
        console.log(e);
        console.log(this.state.prices);
        this.render();
      },
      bind: (val) => {
        this.state.prices[index] = {name: val.name, amount: val.amount, key: val.key};
      },
      isLast: this.state.prices.length - 1 === index,
    }))
  }

  extractSlug(link) {
    try {
      const linkURL = new URL(link);
      const path = linkURL.pathname.split('/');

      path.shift();

      if (path.length < 2 || path[0] !== 'tournament') {
        this.state.error = 'Invalid Link';
        return this.render();
      }

      this.state.smashggLink = path[1];
    } catch(e) {
      // If link is not parsable to a URL try fetching it as a slug.
      this.state.smashggLink = link;
    }
  }

  async fetchTournament(slug) {
    const result = await this.agent.fetchTournamentDetails(slug);
    if (result.error) {
      this.state.error = result.message;
      return this.render();
    }
    const { data } = result;
    this.state.error = '';
    this.state.title = data.name;
    this.state.location = data.address;
    this.state.startDate = parseDate(new Date(data.startAt * 1000));
    this.state.endDate = parseDate(new Date(data.endAt * 1000));
    this.state.events = data.events.map((evt) => ({name: evt, cap: '', key: randomID()}));
    this.state.imgURL = data.image;
    this.state.locationID = data.mapsPlaceId;
    return;
  }

  isValid() {
    return true;
  }

  submitTournament() {
    this.agent.postAction({name: 'posttournament', args: [JSON.stringify(this.state)]})
    .then((res) => {
      console.log(res);
      if (res.error) {
        this.postMessage = res.message;
        this.render();
      }
      else {
        this.postMessage = "";
        this.render();
      }
    });
  }
}

const createClick = (func) => ({
  handleEvent(e) {
    func(e);
  },
  capture: true,
});

const parseDate = (date) => {
  const aZ = (x) => x < 10 ? `0${x}` : x;
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minutes = date.getMinutes();
  return `${year}-${aZ(month)}-${aZ(day)}T${aZ(hour)}:${aZ(minutes)}`;
}

const randomID = () => `${Math.floor(Math.random() * 100000)}`;

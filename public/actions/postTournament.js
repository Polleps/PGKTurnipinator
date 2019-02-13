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
      date: '',
      location: '',
      events: [{name: '', cap: '', key: randomID()}],
      description: '',
      prices: [{name: '', amount: '', key: randomID()}],
    }
  }

  run() {
    this.render();
  }

  render() {
    const contentEL = document.querySelector('.content');
    const ui = html`
    <form action="post" class="tournament-form">
      <h3>Enter Tournament Details</h3>
      <div class="form-row">
        ${input({
          name: "smashgg",
          value: this.state.smashggLink,
          classes: ["flex1 icon-input ta-link"],
          bind: (val) => {
            this.state.smashggLink = val;
            this.fetchTournament(val).then(() => this.render());
          },
          placeholder: 'Smash.gg slug (e.g. elysium-yggdrasil)'
        })}
        <a href="#" class="fill-btn flex-auto">Fill</a>
        <!-- <input type="url" name="smashgg" id="taSmashgg" placeholder="smash.gg link" class="flex1 icon-input ta-link"> -->
      </div>
      <div class="form-row gap"></div>
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
          type: "datetime-local",
          name: "date",
          value: this.state.date,
          classes: "flex1 icon-input ta-date",
          bind: (val) => this.state.date = val,
        })}
        ${input({
          name: "location",
          value: this.state.location,
          classes: "flex1 icon-input ta-location",
          placeholder: "Location",
          bind: (val) => this.state.location = val,
        })}
      </div>
      <div class="form-row"><span class="icon-label"><i class="material-icons">games</i>Events/Games</span></div>
        ${this.mapEvents()}
      <div class="form-row"><span>Description</span></div>
      <div class="form-row">
        ${textarea({
          name: "description",
          value: this.state.description,
          classes: "flex1",
          bind: (val) => this.state.description = val,
        })}
      </div>
      <div class="form-row"><span class="icon-label"><i class="material-icons">euro_symbol</i>Prices</span></div>
      ${this.mapPrices()}
      <div class="form-row">
        <a href="#" class="post-btn">Post</a>
      </div>
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
        this.state.prices[index] = {name: val.name, anount: val.amount, key: val.key};
      },
      isLast: this.state.prices.length - 1 === index,
    }))
  }

  async fetchTournament(slug) {
    const result = await this.agent.fetchTournamentDetails(slug);
    const { data } = result;
    this.state.title = data.name;
    this.state.location = data.address;
    this.state.date = parseDate(new Date(data.startAt * 1000));
    this.state.events = data.events.map((evt) => ({name: evt, cap: '', key: randomID()}));
    return;
  }

  isValid() {
    return true;
  }
}

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

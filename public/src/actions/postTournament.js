import Action from "./action.js";
import { createAgent } from "../agent.js";
import { html, render } from "lit-html";
import { repeat } from "lit-html/directives/repeat";
import { input } from "../templates/input.js";
import { eventInput } from "../templates/event.js";
import { priceInput } from "../templates/price.js";
import { textarea } from "../templates/textarea.js";
import { checkbox } from "../templates/checkbox.js";
import { createValidators, validate } from "../validateTournament.js";

const TWITCH_BASE_URL = "https://twitch.tv/";

const buildStreamURL = (name, source) => {
  if (source !== "TWITCH") {
    return undefined;
  }

  return `${TWITCH_BASE_URL}${name}`;
};

const getStreamURL = (streams, startDate) => {
  if (!streams || streams.length === 0) {
    return {};
  }

  return {
    streamURL: buildStreamURL(streams[0].streamName, streams[0].streamSource),
    streamStartDate: startDate,
  };
};

export default class PostTournament extends Action {
  constructor(args, token) {
    super(args);
    this.agent = createAgent(token);
    this.state = {
      url: "",
      title: "",
      id: "0",
      nocap: false,
      isOnline: false,
      startDate: "",
      endDate: "",
      location: "",
      city: "",
      events: [{ name: "", cap: "", key: randomID() }],
      description: "",
      prices: [{ name: "", amount: "", key: randomID() }],
      image: "",
      streamURL: "",
      streamStartDate: "",
    };
    this.detailControlsHidden = true;
    this.submitTournament = this.submitTournament.bind(this);
    this.postMessage = undefined;
    this.fullScreenMessage = undefined;
  }

  run() {
    this.render();
  }

  render() {
    if (this.fullScreenMessage) {
      this.renderFullScreenMessage();
    } else {
      this.renderForm();
    }
  }

  renderFullScreenMessage() {
    const contentEL = document.querySelector(".content");
    const ui = html`
      <div class="fs-message">
        <p>${this.fullScreenMessage}</p>
      </div>
    `;
    render(ui, contentEL);
  }

  renderForm() {
    const contentEL = document.querySelector(".content");
    const ui = html` <form action="post" class="tournament-form">
      <h4>Enter Tournament Details</h4>
      <div class="form-row"><span>Start.gg</span></div>
      <div class="form-row">
        ${input({
      name: "smashgg",
      value: this.state.url,
      classes: ["flex1 icon-input ta-link"],
      bind: (val) => {
        this.extractSlug(val);
      },
      placeholder: "Start.gg link",
    })}
        ${html`<a
          href="#"
          class="btn fill-btn flex-auto"
          @click=${() =>
          this.fetchTournament(this.state.url).then(() => this.render())}
          >Fill</a
        >`}
      </div>
      ${this.state.error
        ? html`<span class="fetch-error">${this.state.error}</span>`
        : ""}
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
          disabled: this.detailControlsHidden,
          classes: "flex1",
          placeholder: "Tournament Name",
          bind: (val) => (this.state.title = val),
        })}
      </div>
      <div class="form-row">
        ${input({
          name: "location",
          value: this.state.isOnline ? "Online" : this.state.location,
          disabled: this.detailControlsHidden || this.state.isOnline,
          classes: "flex1 icon-input ta-location",
          placeholder: "Location",
          bind: (val) => (this.state.location = val),
        })}
      </div>
      <div class="form-row">
        ${input({
          type: "datetime-local",
          name: "start_date",
          value: this.state.startDate,
          disabled: this.detailControlsHidden,
          classes: "flex1 icon-input ta-date",
          bind: (val) => (this.state.startDate = val),
        })}
        <span class="flex-auto date-divider"> - </span>
        ${input({
          type: "datetime-local",
          name: "end_date",
          value: this.state.endDate,
          disabled: this.detailControlsHidden,
          classes: "flex1 icon-input ta-date",
          bind: (val) => (this.state.endDate = val),
        })}
      </div>
      <div class="form-row">
        <span class="icon-label"
          ><i class="material-icons">games</i>Events/Games</span
        >
      </div>
      ${checkbox({
          name: "nocap",
          value: false,
          classes: "",
          label: "No player caps",
          bind: (val) => {
            this.state.nocap = val;
            this.render();
          },
        })}
      ${this.mapEvents(
          this.detailControlsHidden,
          this.detailControlsHidden || this.state.nocap
        )}
      <div class="form-row">
        <span class="icon-label">
          <i class="material-icons">speaker_notes</i>
          Additional Notes
          ${this.state.description.length > 0
        ? html`<span class="counter"
                >(${this.state.description.length}/250)</span
              >`
        : ""}
        </span>
      </div>
      <div class="form-row">
        ${textarea({
          name: "description",
          value: this.state.description,
          disabled: this.detailControlsHidden,
          classes: "flex1",
          bind: (val) => {
            this.state.description = val;
            this.render();
          },
          maxLength: 250,
        })}
        ${this.state.image
        ? html` <div class="flex1 logo-holder">
              <img src="${this.state.image}" />
            </div>`
        : ""}
      </div>
      <div class="form-row">
        <span class="icon-label">
          <i class="material-icons">live_tv</i>
          Stream
        </span>
      </div>
      <div class="form-row">
        ${input({
          name: "stream_url",
          value: this.state.streamURL,
          disabled: this.detailControlsHidden,
          classes: "flex1",
          placeholder: "Twitch URL",
          bind: (val) => (this.state.streamURL = val.toLowerCase().trim()),
        })}
        ${input({
          type: "datetime-local",
          name: "stream_start_date",
          value: this.state.streamStartDate,
          disabled: this.detailControlsHidden,
          classes: "flex1 icon-input ta-date",
          bind: (val) => (this.state.streamStartDate = val),
        })}
      </div>
      <!-- <div class="form-row"><span class="icon-label"><i class="material-icons">euro_symbol</i>Prices</span></div>
      ${this.mapPrices(this.detailControlsHidden)}-->
      <div class="form-row">
        <a
          href="#"
          class="btn post-btn"
          @click=${createClick(this.submitTournament)}
          >Post</a
        >
      </div>
      ${this.postMessage
        ? html`
            <div class="form-row">
              <span class="fetch-error flex-auto">${this.postMessage}</span>
            </div>
          `
        : ""}
    </form>`;
    render(ui, contentEL);
  }

  mapEvents(disabled, capdisabled) {
    return repeat(
      this.state.events,
      (evt) => evt.key,
      (evt, index) =>
        eventInput({
          key: evt.key,
          name: evt.name,
          cap: evt.cap,
          disabled,
          capdisabled,
          onNew: () => {
            this.state.events.push({ name: "", cap: "", key: randomID() });
            this.render();
          },
          onDelete: (e) => {
            this.state.events.splice(index, 1);
            console.log(e);
            console.log(this.state.events);
            this.render();
          },
          bind: (val) => {
            this.state.events[index] = {
              name: val.name,
              cap: val.cap,
              key: val.key,
            };
          },
          isLast: this.state.events.length - 1 === index,
        })
    );
  }

  mapPrices(disabled) {
    return repeat(
      this.state.prices,
      (price) => price.key,
      (price, index) =>
        priceInput({
          key: price.key,
          name: price.name,
          amount: price.amount,
          disabled,
          onNew: () => {
            this.state.prices.push({ name: "", amount: "", key: randomID() });
            this.render();
          },
          onDelete: (e) => {
            this.state.prices.splice(index, 1);
            console.log(e);
            console.log(this.state.prices);
            this.render();
          },
          bind: (val) => {
            this.state.prices[index] = {
              name: val.name,
              amount: val.amount,
              key: val.key,
            };
          },
          isLast: this.state.prices.length - 1 === index,
        })
    );
  }

  extractSlug(link) {
    try {
      const linkURL = new URL(link);
      const path = linkURL.pathname.split("/");

      path.shift();

      if (path.length < 2 || path[0] !== "tournament") {
        this.state.error = "Invalid Link";
        return this.render();
      }

      this.state.url = path[1];
    } catch (e) {
      // If link is not parsable to a URL try fetching it as a slug.
      this.state.url = link;
    }
  }

  async fetchTournament(slug) {
    const shortenName = (name) => name.replace("Super Smash Bros.", "").trim();
    const result = await this.agent.fetchTournamentDetails(slug);

    if (result.error) {
      this.state.error = result.message;
      return this.render();
    }

    const { data } = result;

    this.state = {
      ...this.state,
      error: "",
      id: data.id,
      isOnline: data.isOnline,
      title: data.name,
      location: data.address,
      startDate: parseDate(new Date(data.startAt * 1000)),
      endDate: parseDate(new Date(data.endAt * 1000)),
      events: data.events.map((evt) => ({
        name: shortenName(evt),
        cap: "",
        key: randomID(),
      })),
      image: data.image,
      city: data.city,
      locationID: data.mapsPlaceId,
      ...getStreamURL(data.streams, parseDate(new Date(data.startAt * 1000))),
    };

    this.detailControlsHidden = false;
    return;
  }

  isValid() {
    return true;
  }

  async submitTournament() {
    const validators = createValidators(this.state);
    try {
      const success = await validate(validators);
      this.agent
        .postAction({
          name: "posttournament",
          args: [JSON.stringify(convertToITournament(this.state))],
        })
        .then((res) => {
          if (res.error) {
            this.showMessage(`Server Error: ${res.message}`, true);
          } else {
            this.showMessage("Tournament Posted", false);
          }
        });
    } catch (err) {
      this.showMessage(`Validation Error: ${err}`, true);
    }
  }

  showMessage(message, error = false) {
    if (error) {
      this.postMessage = message;
      this.render();
    } else {
      this.fullScreenMessage = message;
      this.render();
    }
  }
}

const createClick = (func) => ({
  handleEvent(e) {
    func(e);
  },
  capture: true,
});

const parseDate = (date) => {
  const aZ = (x) => (x < 10 ? `0${x}` : x);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minutes = date.getMinutes();
  return `${year}-${aZ(month)}-${aZ(day)}T${aZ(hour)}:${aZ(minutes)}`;
};

const randomID = () => `${Math.floor(Math.random() * 100000)}`;

const convertToITournament = (x) => ({
  ...x,
  startDate: new Date(x.startDate).getTime(),
  endDate: new Date(x.endDate).getTime(),
  events: x.events.map((e) => ({
    name: e.name,
    cap: e.cap,
  })),
  prices: x.prices.map((p) => ({
    name: p.name,
    amount: +p.amount,
  })),
  type: "smashgg",
  ...(!!x.streamURL && !!streamStartDate && {
    streamURL: x.streamURL,
    streamStartDate: new Date(x.streamStartDate).getTime(),
  }),
});

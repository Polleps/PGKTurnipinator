import { render } from 'lit-html';
import { calendar } from './calendar';
import { cardList } from './cardList';
import { header, View } from './header';
import './agenda.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
        .then((reg) => {
          console.log('Service worker registered.', reg);
        });
  });
}

let tournaments = [];

const viewContainer = document.querySelector('.page');
const headerContainer = document.querySelector('header');

let date = new Date();
let view = +localStorage.getItem('agenda_view') || View.LIST;

// Upgrade old state.
if (view !== View.CALENDAR && view !== View.LIST) {
  view = View.LIST;
}

let showInstallBtn = false;
let installPrompt = () => null;

const calendarView = calendar({
  onDateChange: (newDate) => {
    date = newDate;
    renderView(tournaments);
  },
  onViewChange: (newView) => {
    view = newView;
    renderView(tournaments);
  }
});

const listView = cardList({
  onViewChange: (newView) => {
    view = newView;
  }
});

const renderView = (t) => {
  if (view === View.LIST) {
    render(listView(t, date.getMonth(), date.getFullYear()), viewContainer);
    renderHeader();
  } else {
    render(calendarView(t, date.getMonth(), date.getFullYear()), viewContainer);
    renderHeader();
  }
}

const renderHeader = () => {
  render(header({
    currentView: view,
    onViewChange: (v) => {
      view = v;
      renderView(tournaments);
      localStorage.setItem('agenda_view', v);
    },
    showInstallBtn,
    installPrompt,
  }), headerContainer);
}

renderHeader();

const fetchTournaments = async () => {
  const url = '/tournaments';
  return fetch(url).then(res => res.json());
}

const transformTournament = (t) => {
  const cap = t.events.map(e => e.cap)
              .filter(c => +c === +c)
              .sort((a, b) => b - a)[0] || '?';
  return {
    ...t,
    cap,
  }
}

renderView([]);

fetchTournaments().then(fetched => {
  tournaments = fetched.map(t => transformTournament(t));
  renderView(tournaments, showInstallBtn, installPrompt);
});

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  showInstallBtn = true;
  installPrompt = (ev) => {
    showInstallBtn = false;
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice
      .then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the A2HS prompt');
          renderHeader();
        } else {
          console.log('User dismissed the A2HS prompt');
          renderHeader();
        }
        deferredPrompt = null;
      });

  }
  renderHeader();
});

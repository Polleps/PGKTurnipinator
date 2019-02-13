import Config from "../../Config";
import fetch from "node-fetch";

const baseURL = "https://api.smash.gg/gql/alpha";
const query = `
query TournamentQuery($slug: String) {
  tournament(slug: $slug){
    id
    name
    images {
      type
      url
    }
    contactTwitter
    contactEmail
    mapsPlaceId
    venueAddress
    startAt
    endAt
    events {
      id
      name
    }
    currency
  }
}
`;

export const fetchTournamentDetails = async (slug: string): Promise<ITournamentDetails> => {
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${Config.SMASHGG_API_KEY}`,
  };
  const body = { query, variables: { slug } };
  const options = {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  };

  const result = await fetch(baseURL, options).then((res) => res.json());
  const { name, mapsPlaceId, startAt, endAt, images, venueAddress, events } = result.data.tournament;
  const tournamentDetails: ITournamentDetails = {
    name,
    mapsPlaceId,
    address: venueAddress,
    startAt,
    endAt,
    events: events.map((evt) => evt.name),
    image: images.find((img) => img.type === "profile").url,
  };
  return tournamentDetails;
};

interface ITournamentDetails {
  name: string;
  image: string;
  mapsPlaceId: string;
  address: string;
  startAt: Date;
  endAt: Date;
  events: string[];
}

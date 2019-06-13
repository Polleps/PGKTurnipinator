import Config from "../../Config";
import fetch from "node-fetch";

const baseURL = "https://api.smash.gg/gql/alpha";

const detailsQuery = `
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
    city
    isOnline
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

const participantsQuery = `
query TournamentQuery($id: ID) {
  tournament(id: $id){
    id
    participants(query:{}){
      pageInfo{
        total
      }
    }
  }
}
`;

export const fetchTournamentDetails = async (slug: string): Promise<ITournamentDetails> => {
  const result = await executeQuery(detailsQuery, { slug });
  const { name, id, mapsPlaceId, startAt, endAt, isOnline, images, venueAddress, events, city } = result.data.tournament;
  if (isOnline) {
    throw new Error("Online Tournaments are not supported.");
  }
  const img = images.find((img) => img.type === "profile");
  const tournamentDetails: ITournamentDetails = {
    name,
    id,
    mapsPlaceId,
    address: venueAddress,
    city,
    startAt,
    endAt,
    events: events.map((evt) => evt.name),
    image: img ? img.url : "",
  };
  return tournamentDetails;
};

export const fetchTournamentStatus = async (id: string): Promise<{ id: number, participants: number }> => {
  const result = (await executeQuery(participantsQuery, { id })) as IParticipantsResult;
  return {
    id: result.data.tournament.id,
    participants: result.data.tournament.participants.pageInfo.total,
  };
};

const executeQuery = async (query, variables) => {
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${Config.SMASHGG_API_KEY}`,
  };
  const body = { query, variables };
  const options = {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  };
  return fetch(baseURL, options).then((res) => res.json());
};

interface ITournamentDetails {
  name: string;
  id: number;
  image: string;
  mapsPlaceId: string;
  address: string;
  city: string;
  startAt: Date;
  endAt: Date;
  events: string[];
}

interface IParticipantsResult {
  data: {
    tournament: {
      id: number;
      participants: {
        pageInfo: {
          total: number;
        };
      };
    };
  };
};

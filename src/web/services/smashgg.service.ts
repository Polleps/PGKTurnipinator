import Config from "../../Config";
import fetch, { FetchError } from "node-fetch";

const baseURL = "https://api.start.gg/gql/alpha";
const TWITCH_BASE_URL = "https://twitch.tv/";

const detailsQuery = `
query TournamentQuery($slug: String) {
  tournament(slug: $slug){
    id
    name
    images {
      type
      url
    }
    mapsPlaceId
    streams {
      streamName
      streamSource
    }
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

const statusQuery = `
query TournamentQuery($id: ID) {
  tournament(id: $id){
    id
    registrationClosesAt
    participants(query:{}){
      pageInfo{
        total
      }
    }
  }
}
`;

export const fetchTournamentDetails = async (
  slug: string
): Promise<ITournamentDetails> => {
  const result = await executeQuery(detailsQuery, { slug });
  const {
    name,
    id,
    mapsPlaceId,
    startAt,
    endAt,
    isOnline,
    images,
    venueAddress,
    events,
    city,
    streams,
  } = result.data.tournament;

  const img = images.find((img) => img.type === "profile");
  const tournamentDetails: ITournamentDetails = {
    name,
    id,
    isOnline,
    mapsPlaceId,
    address: venueAddress,
    city,
    startAt,
    endAt,
    events: events.map((evt) => evt.name),
    image: img ? img.url : "",
    streams,
  };

  return tournamentDetails;
};

export type FETCH_ERROR = -1;

export const fetchTournamentStatus = async (
  id: string
): Promise<
  Array<{
    id: string;
    participants: number;
    registrationClosesAt: Date;
  }>
> => {
  try {
    const result = (await executeQuery(statusQuery, { id })) as IStatusResult;
    console.log(result);
    if (!result.data || !result.data.tournament) {
      return [];
    }

    return [
      {
        id: result.data.tournament.id,
        participants: result.data.tournament.participants.pageInfo.total,
        registrationClosesAt: result.data.tournament.registrationClosesAt,
      },
    ];
  } catch (e) {
    console.error(e);

    return [];
  }
};

const executeQuery = async (query, variables) => {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${Config.SMASHGG_API_KEY}`,
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
  id: string;
  isOnline: boolean;
  image: string;
  mapsPlaceId: string;
  address: string;
  city: string;
  startAt: Date;
  endAt: Date;
  events: string[];
  streams:
    | Array<{
        streamName: string;
        streamSource: string;
      }>
    | undefined;
}

interface IStatusResult {
  data: {
    tournament: {
      id: string;
      registrationClosesAt: Date;
      participants: {
        pageInfo: {
          total: number;
        };
      };
    };
  };
}

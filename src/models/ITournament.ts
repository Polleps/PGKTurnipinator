export default interface ITournament {
  url: string;
  title: string;
  image?: string;
  events: IEvent[];
  description?: string;
  location: string;
  city: string;
  locationID: string;
  startDate: Date;
  endDate: Date;
  type: "smashgg" | "other";
  smashggID?: string;
  id?: number;
  prices?: IPrice[];
  pr?: boolean;
  participants?: number;
}

interface IEvent {
  name: string;
  cap?: string;
}

interface IPrice {
  name: string;
  amount: number;
}

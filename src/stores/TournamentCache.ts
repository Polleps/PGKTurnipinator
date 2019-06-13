import StoreCache from "./StoreCache";
import { CollectionReference } from "@google-cloud/firestore";
import ITournament from "../models/ITournament";
import { fetchTournamentStatus } from "../web/services/smashgg.service";

export class TournamentStoreCache extends StoreCache<ITournament[], number, ITournament> {
  private expires: number;
  private expireTime: number = 600000;

  constructor(collection: CollectionReference) {
    super(collection);
    this.cache = new Array<ITournament>();
  }

  public async add(x: ITournament): Promise<void> {
    try {
      await this.ref.add(x);
      this.cache.push(x);
      this.updateExpire();
    } catch (e) {
      console.error(e);
    }
  }

  public get(index: number): ITournament {
    if (Date.now() > this.expires) {
      this.fillCache();
    }
    return this.cache[index];
  }

  public get data(): ITournament[] {
    if (Date.now() > this.expires) {
      this.fillCache();
    }
    return this.cache;
  }

  public has(index: number): boolean {
    return !!this.cache[index];
  }

  protected async fillCache(): Promise<void> {
    const snapshot = await this.ref.get();
    this.cache = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      this.cache.push(data as ITournament);
    });
    await this.updateParticipants();
    this.updateExpire();
    return;
  }

  private async updateParticipants() {
    const tournaments = this.cache.filter((t) => t.endDate >= new Date() && t.id);
    const participants = await Promise.all(tournaments.map((t) => fetchTournamentStatus(`${t.id}`)));
    participants.forEach((p) => {
      const tournament = this.cache.find((t) => t.id === p.id);
      tournament.participants = p.participants;
    });
    return;
  }

  private updateExpire() {
    this.expires = Date.now() + this.expireTime;
  }
}
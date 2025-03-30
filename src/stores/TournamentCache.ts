import StoreCache from "./StoreCache";
import { CollectionReference } from "@google-cloud/firestore";
import ITournament from "../models/ITournament";
import { fetchTournamentStatus } from "../web/services/smashgg.service";

export class TournamentStoreCache extends StoreCache<
  ITournament[],
  number,
  ITournament
> {
  private expires: number;
  private expireTime: number = 600000;

  constructor(collection: CollectionReference) {
    super(collection);
    this.cache = new Array<ITournament>();
  }

  public async add(
    x: ITournament,
    updateIfExist: boolean = true
  ): Promise<void> {
    try {
      if (updateIfExist && this.getByID(x.id)) {
        await this.update(x);
        this.updateExpire();
        return;
      }

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

  public getUpcoming(): ITournament[] {
    if (Date.now() > this.expires) {
      this.fillCache();
    }
    return this.cache.filter((t) => new Date() < t.endDate);
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

  public getByID(id: string): ITournament {
    return this.cache.find((x) => x.id === id);
  }

  public async updateCache() {
    await this.fillCache(true);
  }

  protected async fillCache(force: boolean = false): Promise<void> {
    if (this.cache.length > 0 && !force) {
      await this.updateStatus();

      return;
    }

    const snapshot = await this.ref.get();
    this.cache = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      this.cache.push(data as ITournament);
    });

    await this.updateStatus();
  }

  private async update(tournament: ITournament) {
    const snapshot = await this.ref.where("id", "==", tournament.id).get();
    if (snapshot.size === 0) {
      throw new Error(
        "Trying to update tournament that doens't already exsists."
      );
    }
    snapshot.forEach((doc) => {
      doc.ref.update(tournament);
    });

    const foundIndex = this.cache.findIndex((x) => x.id === tournament.id);
    this.cache[foundIndex] = tournament;
  }

  private async updateStatus() {
    const tournaments = this.cache.filter(
      (t) => t.endDate >= new Date() && t.id
    );
    const status = await Promise.all(
      tournaments.map((t) => fetchTournamentStatus(`${t.id}`))
    );
    status
      .filter((p) => p.length > 0)
      .forEach(([p]) => {
        const tournament = this.cache.find((t) => t.id === p.id);
        tournament.participants = p.participants;
        tournament.registrationClosesAt = p.registrationClosesAt;
      });

    this.updateExpire();
  }

  private updateExpire() {
    this.expires = Date.now() + this.expireTime;
  }
}

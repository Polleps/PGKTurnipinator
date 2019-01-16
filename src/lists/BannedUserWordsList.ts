import { IList, List } from ".";

export class BannedUserWordsList extends List {
  protected _list: IBannedUserWordsList[];

  public get data(): IBannedUserWordsList[] {
    return this._list;
  }
}

export interface IBannedUserWordsList extends IList {
  words: string[];
}

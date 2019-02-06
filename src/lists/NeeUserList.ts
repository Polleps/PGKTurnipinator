import { IList, List } from ".";

export class NeeUserList extends List {
  protected _list: INeeUserList[];

  public get data(): INeeUserList[] {
    return this._list;
  }
}

export interface INeeUserList extends IList {
  date: Date;
  time: number;
}

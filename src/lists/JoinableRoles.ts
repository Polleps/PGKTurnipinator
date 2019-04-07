import { IList, List } from ".";

export class JoinableRoles extends List {
  protected _list: IJoinableRoles[];

  public get data(): IJoinableRoles[] {
    return this._list;
  }
}

export interface IJoinableRoles extends IList {
  description?: string;
}

export default class DBManager {
  public static _instance: DBManager;
  private lists: Map<string, IList>;

  private constructor() {
    this.lists = new Map<string, IList>();
  }

  public static get Insance(): DBManager {
    return this._instance || (this._instance = new this());
  }

  public contains(listName: string, listItem: string): boolean {
    if (this.lists.has(listName)) {
      return this.lists.get(listName).data.some((x) => x === listItem);
    } else {
      throw new Error("List does not exist");
    }
  }
}

interface IList {
  data: string[];
  hash: string;
}

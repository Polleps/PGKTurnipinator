import { BannedUserWordsList, List } from "./lists";

export default class ListLoader {

  public static loadLists(): Promise<List[]> {
    return new Promise<List[]>((resolve, reject) => {
      const lists = new Array<List>(
        new List("bannedwords.json"),
        // new BannedUserWordsList("banneduserwords.json"),
        new List("botadmins.json"),
        new List("joinableroles.json"),
        new List("editablelists.json"),
        new List("shucfixes.json"),
      );
      Promise.all(lists.map((l: List) => l.load()))
        .then(() => resolve(lists));
    });
  }

  private constructor() { }
}

export enum LIST {
  BANNEDWORDS = 0,
  // BANNEDUSERWORDS,
  BOTADMINS,
  JOINABLEROLES,
  EDITABLELISTS,
  SHUCFIXES,
}

import * as fs from "fs";

export class List {
  protected _list: IList[];
  private _name: string;
  private _filename: string;
  private _basePath: string = `${process.cwd()}/data/lists/`;
  constructor(filename: string) {
    this._filename = filename;
  }

  public get name(): string {
    return this._name;
  }

  public get data(): IList[] {
    return this._list;
  }

  public load(): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.readFile(`${this._basePath}${this._filename}`, (err: NodeJS.ErrnoException, data: Buffer) => {
        if (!err) {
          const parsedData: IJSONList = JSON.parse(data.toString());
          this._name = parsedData.name;
          this._list = parsedData.list;
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }

  public save(): Promise<void> {
    return new Promise((resolve, reject) => {
      const dataToSave = { name: this._name, list: this._list };
      fs.writeFile(`${this._basePath}${this._filename}`, JSON.stringify(dataToSave), (err) => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }
}

export interface IList {
  key: string;
}

interface IJSONList {
  name: string;
  list: IList[];
}

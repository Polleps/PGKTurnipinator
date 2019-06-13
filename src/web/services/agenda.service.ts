import { CollectionReference } from "@google-cloud/firestore";
import { store } from "../../Store";

export default class AgendaService {
  private ref: CollectionReference;
  constructor() {
    this.ref = store.collection("tournaments");
  }
}

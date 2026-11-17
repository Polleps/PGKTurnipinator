// Attributes the agenda's CSS selects on (`[prcount]`, `[tooltip]`, ...), set with `attr:`.
import "solid-js";

declare module "solid-js" {
  namespace JSX {
    interface ExplicitAttributes {
      prcount: "" | undefined;
      online: "" | undefined;
      tooltip: string;
      "tooltip-position": "top" | "right" | "bottom" | "left";
    }
  }
}

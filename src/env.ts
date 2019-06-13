import { resolve } from "path";

import { config } from "dotenv";

config({ path: resolve(__dirname, process.env.NODE_ENV === "production" ? "../.env.prod" : "../.env.dev") });

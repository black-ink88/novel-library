import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://black-ink88.github.io",
  base: process.env.BASE_PATH ?? "/",
  output: "static"
});

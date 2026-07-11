import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://d0742534.github.io",
  base: process.env.BASE_PATH ?? "/",
  output: "static"
});

// The app's own Vite config, building only the cart lab page.
import { mergeConfig } from "vite";
import app from "./vite.config";

export default mergeConfig(app, { base: "./", build: { rollupOptions: { input: "lab-cart.html" } } });

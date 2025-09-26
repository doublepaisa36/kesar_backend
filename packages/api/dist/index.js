import { buildApp } from "./app.js";
const app = buildApp();
const port = Number(process.env.port) || 3000;
app.listen({ port, host: '0.0.0.0' }).catch(err => {
    app.log.error(err);
    process.exit(1);
});

import { createApp } from './app.js';

const port = Number(process.env.PORT) || 8787;
const app = createApp();

app.listen(port, '0.0.0.0', () => {
  console.log(`Notes server listening on port ${port}.`);
});

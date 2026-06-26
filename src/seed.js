require("dotenv").config();

const { AppStore } = require("./store");

async function main() {
  const store = new AppStore();
  await store.connect();
  await store.seed({ reset: true });
  console.log(`Jeu de donnees charge en mode ${store.mode}.`);
  await store.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

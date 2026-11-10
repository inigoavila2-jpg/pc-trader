const { PORT } = require("./server/config");
const app = require("./server/app");

app.listen(PORT, () => {
  console.log("PC Trader server running on port " + PORT);
});

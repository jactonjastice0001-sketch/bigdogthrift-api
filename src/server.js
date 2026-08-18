require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Duka Tag API running on port ${PORT}`);
  console.log(`Public URL configured as: ${process.env.PUBLIC_BASE_URL}`);
});

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const profileRoutes = require('./src/routes/profile.routes');
const careerRoutes = require('./src/routes/career.routes');
const planRoutes = require('./src/routes/plan.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/profile', profileRoutes);
app.use('/api/career', careerRoutes);
app.use('/api/plan', planRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

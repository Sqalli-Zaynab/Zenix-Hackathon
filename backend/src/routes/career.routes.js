const express = require("express");
const router = express.Router();
const careerController = require("../controllers/career.controller");

router.post("/recommend", careerController.recommendCareers);

module.exports = router;

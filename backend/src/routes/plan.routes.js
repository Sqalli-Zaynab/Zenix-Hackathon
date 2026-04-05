const express = require("express");
const router = express.Router();
const planController = require("../controllers/plan.controller");

router.post("/generate", planController.generatePlan);

module.exports = router;

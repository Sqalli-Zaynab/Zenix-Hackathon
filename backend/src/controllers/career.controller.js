const aiService = require("../services/ai.service");

exports.recommendCareers = async (req, res) => {
  try {
    const structuredProfile = req.body;
    const recommendations = await aiService.runCareerRecommendation(structuredProfile);
    return res.status(200).json(recommendations);
  } catch (error) {
    console.error("Career recommendation failed:", error);
    return res.status(500).json({ error: "Career recommendation failed" });
  }
};

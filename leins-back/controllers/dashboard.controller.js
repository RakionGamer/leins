const DashboardService = require('../services/dashboard.service');
const asyncHandler = require('../utils/helpers/asyncHandler');

const service = new DashboardService();

const getSummary = asyncHandler(async (req, res) => {
   const entityId = req.entityId || req.query.entityId || req.query.entity_id;
   const month = req.query.month;
   const scope = req.query.scope;
   const out = await service.monthlySummary({ entityId, month, scope });
   res.json(out);
});

module.exports = {
   getSummary,
};

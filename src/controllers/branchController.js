const branchService = require('../services/branchService');

const getBranches = async (_req, res) => {
  const branches = await branchService.getAllBranches();

  res.status(200).json({
    success: true,
    count: branches.length,
    data: { branches },
  });
};

const createBranch = async (req, res) => {
  const branch = await branchService.createBranch(req.body);

  res.status(201).json({
    success: true,
    message: 'Branch created successfully',
    data: { branch },
  });
};

const updateBranch = async (req, res) => {
  const branch = await branchService.updateBranch(req.params.id, req.body);

  res.status(200).json({
    success: true,
    message: 'Branch updated successfully',
    data: { branch },
  });
};

module.exports = {
  getBranches,
  createBranch,
  updateBranch,
};

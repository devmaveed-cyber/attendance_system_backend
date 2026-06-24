const groupService = require('../services/groupService');

const getGroups = async (_req, res) => {
  const groups = await groupService.getAllGroups();

  res.status(200).json({
    success: true,
    count: groups.length,
    data: { groups },
  });
};

const createGroup = async (req, res) => {
  const group = await groupService.createGroup(req.body);

  res.status(201).json({
    success: true,
    message: 'Group created successfully',
    data: { group },
  });
};

const updateGroup = async (req, res) => {
  const group = await groupService.updateGroup(req.params.id, req.body);

  res.status(200).json({
    success: true,
    message: 'Group updated successfully',
    data: { group },
  });
};

module.exports = {
  getGroups,
  createGroup,
  updateGroup,
};

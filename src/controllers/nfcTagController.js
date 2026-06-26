const nfcTagService = require('../services/nfcTagService');

const getNfcTags = async (req, res) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 25;

  const result = await nfcTagService.getNfcTags({
    page,
    limit,
    branchId: req.query.branchId,
    search: req.query.search,
  });

  res.status(200).json({
    success: true,
    count: result.tags.length,
    data: {
      nfcTags: result.tags,
      pagination: result.pagination,
    },
  });
};

const createNfcTag = async (req, res) => {
  const tag = await nfcTagService.createNfcTag(req.body);

  res.status(201).json({
    success: true,
    message: 'NFC tag registered successfully',
    data: { nfcTag: tag },
  });
};

const updateNfcTag = async (req, res) => {
  const tag = await nfcTagService.updateNfcTag(req.params.id, req.body);

  res.status(200).json({
    success: true,
    message: 'NFC tag updated successfully',
    data: { nfcTag: tag },
  });
};

module.exports = {
  getNfcTags,
  createNfcTag,
  updateNfcTag,
};

const Proposal = require('../../models/Proposal');
const Client = require('../../models/Client');
const { logger } = require('../logger');

/**
 * Show proposals list
 */
const showProposals = async (req, res) => {
    try {
        const { status, client, search, sort = '-createdAt' } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (client) filter.client = client;
        if (search) {
            filter.title = new RegExp(search, 'i'); // Only search by title now
        }

        const proposals = await Proposal.find(filter)
            .populate('client', 'name company')
            .sort(sort)
            .select(
                'title client status pricing.amount sentDate viewedDate acceptedDate rejectedDate createdAt documentUrl'
            );

        res.render('proposals/index', {
            title: 'Proposals - Sahab Solutions',
            layout: 'layout',
            proposals,
            additionalCSS: ['proposals.css'],
            additionalJS: ['proposals.js'],
            filters: { status, client, search },
            activeTab: 'proposals',
        });
    } catch (error) {
        logger.error('Show proposals error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load proposals',
            layout: 'layout',
        });
    }
};

/**
 * Show new proposal form
 */
const showNewProposal = async (req, res) => {
    try {
        const clients = await Client.find({
            status: { $in: ['active', 'lead', 'pending'] },
        })
            .sort('company name')
            .select('name company email');

        res.render('proposals/new', {
            title: 'New Proposal - Sahab Solutions',
            layout: 'layout',
            clients,
            additionalCSS: ['proposals.css'],
            additionalJS: ['proposals.js'],
            activeTab: 'proposals',
        });
    } catch (error) {
        logger.error('Show new proposal error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load form',
            layout: 'layout',
        });
    }
};

/**
 * Show proposal details
 */
const showProposal = async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id).populate('client');

        if (!proposal) {
            return res.status(404).render('error', {
                title: 'Proposal Not Found',
                message: 'The requested proposal could not be found',
                layout: 'layout',
            });
        }

        res.render('proposals/view', {
            title: `${proposal.title} - Sahab Solutions`,
            layout: 'layout',
            proposal,
            activeTab: 'proposals',
        });
    } catch (error) {
        logger.error('Show proposal error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load proposal',
            layout: 'layout',
        });
    }
};

/**
 * Show edit proposal form
 */
const showEditProposal = async (req, res) => {
    try {
        const [proposal, clients] = await Promise.all([
            Proposal.findById(req.params.id).populate('client'),
            Client.find({ status: { $in: ['active', 'lead', 'pending'] } })
                .sort('company name')
                .select('name company email'),
        ]);

        if (!proposal) {
            return res.status(404).render('error', {
                title: 'Proposal Not Found',
                message: 'The requested proposal could not be found',
                layout: 'layout',
            });
        }

        res.render('proposals/edit', {
            title: `Edit ${proposal.title} - Sahab Solutions`,
            layout: 'layout',
            proposal,
            clients,
            activeTab: 'proposals',
        });
    } catch (error) {
        logger.error('Show edit proposal error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load proposal',
            layout: 'layout',
        });
    }
};

/**
 * Get proposals API
 */
const getProposals = async (req, res) => {
    try {
        const {
            status,
            client,
            projectType,
            sort = '-createdAt',
            page = 1,
            limit = 20,
        } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (client) filter.client = client;
        if (projectType) filter.projectType = projectType;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [proposals, total] = await Promise.all([
            Proposal.find(filter)
                .populate('client', 'name company')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit)),
            Proposal.countDocuments(filter),
        ]);

        res.json({
            success: true,
            data: proposals,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        logger.error('Get proposals error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch proposals',
        });
    }
};

/**
 * Create new proposal
 */
const createProposal = async (req, res) => {
    try {
        const proposalData = req.body;

        // Set expiry date if not provided
        if (!proposalData.expiryDate) {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
            proposalData.expiryDate = expiryDate;
        }

        const proposal = new Proposal(proposalData);
        await proposal.save();

        logger.info(`Proposal created: ${proposal._id}`);

        res.json({
            success: true,
            data: proposal,
            message: 'Proposal created successfully',
        });
    } catch (error) {
        logger.error('Create proposal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create proposal',
        });
    }
};

/**
 * Get single proposal API
 */
const getProposal = async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id).populate('client');

        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: 'Proposal not found',
            });
        }

        res.json({
            success: true,
            data: proposal,
        });
    } catch (error) {
        logger.error('Get proposal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch proposal',
        });
    }
};

/**
 * Update proposal
 */
const updateProposal = async (req, res) => {
    try {
        const updates = req.body;
        delete updates._id;
        delete updates.proposalNumber;

        updates.updatedAt = new Date();

        const proposal = await Proposal.findByIdAndUpdate(req.params.id, updates, {
            new: true,
            runValidators: true,
        });

        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: 'Proposal not found',
            });
        }

        logger.info(`Proposal updated: ${proposal._id}`);

        res.json({
            success: true,
            data: proposal,
            message: 'Proposal updated successfully',
        });
    } catch (error) {
        logger.error('Update proposal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update proposal',
        });
    }
};

/**
 * Delete proposal
 */
const deleteProposal = async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id);

        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: 'Proposal not found',
            });
        }

        if (proposal.status === 'accepted') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete accepted proposals',
            });
        }

        await proposal.deleteOne();

        logger.info(`Proposal deleted: ${req.params.id}`);

        res.json({
            success: true,
            message: 'Proposal deleted successfully',
        });
    } catch (error) {
        logger.error('Delete proposal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete proposal',
        });
    }
};

/**
 * Send proposal
 */
const sendProposal = async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id).populate('client');

        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: 'Proposal not found',
            });
        }

        await proposal.markAsSent();

        // Update client last contact date
        await Client.findByIdAndUpdate(proposal.client._id, {
            lastContactDate: new Date(),
        });

        logger.info(`Proposal sent: ${proposal._id}`);

        res.json({
            success: true,
            data: proposal,
            message: 'Proposal sent successfully',
        });
    } catch (error) {
        logger.error('Send proposal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send proposal',
        });
    }
};

/**
 * Update proposal status
 */
const updateStatus = async (req, res) => {
    try {
        const { status, feedback } = req.body;
        const proposal = await Proposal.findById(req.params.id);

        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: 'Proposal not found',
            });
        }

        if (status === 'accepted') {
            await proposal.accept(feedback);
        } else if (status === 'rejected') {
            proposal.status = 'rejected';
            proposal.responseDate = new Date();
            proposal.clientResponse = {
                status: 'rejected',
                feedback,
                respondedAt: new Date(),
            };
            await proposal.save();
        } else if (status === 'viewed') {
            await proposal.markAsViewed();
        } else {
            proposal.status = status;
            await proposal.save();
        }

        logger.info(`Proposal status updated: ${proposal._id} -> ${status}`);

        res.json({
            success: true,
            data: proposal,
            message: 'Status updated successfully',
        });
    } catch (error) {
        logger.error('Update status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update status',
        });
    }
};

/**
 * Preview proposal
 */
const previewProposal = async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id).populate('client');

        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: 'Proposal not found',
            });
        }

        res.render('proposals/preview', {
            title: `Preview: ${proposal.title}`,
            layout: false,
            proposal,
        });
    } catch (error) {
        logger.error('Preview proposal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to preview proposal',
        });
    }
};

module.exports = {
    showProposals,
    showNewProposal,
    showProposal,
    showEditProposal,
    getProposals,
    createProposal,
    getProposal,
    updateProposal,
    deleteProposal,
    sendProposal,
    updateStatus,
    previewProposal,
};

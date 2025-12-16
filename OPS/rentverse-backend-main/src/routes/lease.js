// src/routes/leases.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth'); 
const leasesService = require('../services/leases.service');

router.post('/:id/sign', auth, async (req, res) => {
  try {
    if (!req.body.signature) {
      return res.status(400).json({ success: false, message: 'Signature is required' });
    }

    // Pass the User ID from the auth token so the service knows who is signing
    const result = await leasesService.signLease(
      req.params.id, 
      req.body.signature, 
      req.user.id
    );

    res.status(200).json({
      success: true,
      message: 'Signature saved successfully',
      data: result
    });

  } catch (error) {
    console.error("❌ Sign Error:", error.message);
    
    // Handle specific errors cleanly
    if (error.message === "Lease not found") {
      return res.status(404).json({ success: false, message: 'Lease not found' });
    }
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json({ success: false, message: 'You are not authorized to sign this lease' });
    }

    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
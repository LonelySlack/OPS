const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { auth } = require('../middleware/auth');

// GET /api/auth/mfa/setup - Generate secret + QR code
router.get('/setup', auth, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `Rentverse (${req.user.email})`,
      length: 32
    });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { mfaSecret: secret.base32 }
    });

    const qrUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      qrCode: qrUrl,
      secret: secret.base32,
      message: 'Scan with your authenticator app'
    });
  } catch (error) {
    console.error('[MFA Setup] Error:', error);
    res.status(500).json({ error: 'Failed to generate MFA setup' });
  }
});

// POST /api/auth/mfa/verify - Verify token and enable MFA
router.post('/verify', auth, async (req, res) => {
  const { token } = req.body;

  try {
    if (!token || token.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid 6-digit code'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { mfaSecret: true }
    });

    if (!user?.mfaSecret) {
      return res.status(400).json({
        success: false,
        message: 'MFA setup not completed. Generate a new QR code.'
      });
    }

    const maskedSecret = user.mfaSecret.substring(0, 4) + '...' + user.mfaSecret.slice(-4);

    console.log('[MFA Verify] User:', req.user.email);
    console.log('[MFA Verify] Token received:', token);
    console.log('[MFA Verify] Secret (masked):', maskedSecret);

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 6  // ← Critical: allows ±3 minutes drift
    });

    console.log('[MFA Verify] Result:', verified ? 'SUCCESS' : 'FAILED');
    await logActivity(user.id, 'LOGIN_SUCCESS', req, { mfa: true })
    if (verified) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { mfaEnabled: true }
      });

      console.log('[MFA Verify] MFA ENABLED for user:', req.user.id);
      res.json({
        success: true,
        message: 'MFA enabled successfully!'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid code – try again or sync your device time'
      });
    }
  } catch (error) {
    console.error('[MFA Verify] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during verification'
    });
  }
});

// POST /api/auth/mfa/disable
router.post('/disable', auth, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { mfaEnabled: false, mfaSecret: null }
    });

    console.log('[MFA] Disabled for user:', req.user.id);
    res.json({ success: true, message: 'MFA disabled' });
  } catch (error) {
    console.error('[MFA Disable] Error:', error);
    res.status(500).json({ error: 'Failed to disable MFA' });
  }
});

module.exports = router;
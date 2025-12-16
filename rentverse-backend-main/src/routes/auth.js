const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
// 👇 USE THIS IMPORT TO BE SAFE
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { passport } = require('../config/passport');


const router = express.Router();


const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true, isActive: true, mfaEnabled: true },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Access denied. User not found or inactive.' });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ success: false, message: 'Access denied. Invalid token.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

// --- Helpers ---

const logActivity = async (userId, fullAction, req, details = {}) => {
  try {
    let action = fullAction;
    let status = 'INFO';

    if (fullAction.includes('_SUCCESS')) {
      action = fullAction.replace('_SUCCESS', '');
      status = 'SUCCESS';
    } else if (fullAction.includes('_FAILED')) {
      action = fullAction.replace('_FAILED', '');
      status = 'FAILURE';
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
    
    await prisma.activityLog.create({
      data: {
        userId: userId,
        action: action,
        status: status,
        ipAddress: ipAddress,
        userAgent: req.headers['user-agent'] || 'Unknown',
        details: details,
      },
    });
    console.log(`✅ Logged: ${action} - ${status}`);
  } catch (err) {
    console.error('Failed to log activity:', err.message);
  }
};

// 👇 NEW: THREAT INTELLIGENCE (Account Lockout Logic)
const isAccountLocked = async (userId) => {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000); // 15 minute window
  
  try {
    // Count how many failures occurred in the last 15 minutes
    const failedLogins = await prisma.activityLog.count({
      where: {
        userId,
        action: 'LOGIN',
        status: 'FAILURE',
        createdAt: { gte: fifteenMinutesAgo },
      },
    });

    // If 5 or more failures, return TRUE (Locked)
    if (failedLogins >= 5) {
      console.warn(`🚨 ACCOUNT LOCKED: User ${userId} has ${failedLogins} failed attempts.`);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error checking lockout:", error);
    return false;
  }
};

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 6
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - firstName
 *         - lastName
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 6
 *         firstName:
 *           type: string
 *           description: User's first name
 *         lastName:
 *           type: string
 *           description: User's last name
 *         dateOfBirth:
 *           type: string
 *           format: date
 *           description: User's date of birth (YYYY-MM-DD)
 *         phone:
 *           type: string
 *           description: User's phone number
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 firstName:
 *                   type: string
 *                 lastName:
 *                   type: string
 *                 name:
 *                   type: string
 *                 dateOfBirth:
 *                   type: string
 *                   format: date
 *                 phone:
 *                   type: string
 *                 role:
 *                   type: string
 *             token:
 *               type: string
 */

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication endpoints
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Bad request
 *       409:
 *         description: User already exists
 */
router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const { email, password, firstName, lastName, dateOfBirth, phone } = req.body;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) return res.status(409).json({ success: false, message: 'User already exists' });

      const hashedPassword = await bcrypt.hash(password, 12);
      const fullName = `${firstName} ${lastName}`;

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          name: fullName,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          phone: phone || null,
          role: 'USER',
        },
      });

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: { user, token },
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/auth/login:
 * post:
 * summary: Login user with Adaptive Defense
 * tags: [Authentication]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/LoginRequest'
 * responses:
 * 200:
 * description: Login successful
 * 401:
 * description: Invalid credentials
 * 423:
 * description: Account locked (Threat Intelligence)
 */
router.post('/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });

      // Handle User Not Found or Inactive
      if (!user || !user.isActive) {
        // We don't lock non-existent users to prevent DoS on signup, but we log the attempt
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      // 🛑 THREAT INTELLIGENCE CHECK: Is account locked?
      if (await isAccountLocked(user.id)) {
         // Log the blocked attempt without counting it as a new "password failure"
         await logActivity(user.id, 'LOGIN_BLOCKED', req, { reason: 'account_locked' });
         
         return res.status(423).json({ 
           success: false, 
           message: 'Account temporarily locked due to repeated failed login attempts. Please try again in 15 minutes.' 
         });
      }

      // Verify Password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        // Log failure (This increases the counter for isAccountLocked)
        await logActivity(user.id, 'LOGIN_FAILED', req, { reason: 'wrong_password' });
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      // --- LOGIN SUCCESS ---
      await logActivity(user.id, 'LOGIN_SUCCESS', req);

      // 🛡️ ZERO-TRUST ACCESS LOGIC (New Device & IP Detection)
      try {
        const recentLogins = await prisma.activityLog.findMany({
          where: {
            userId: user.id,
            action: 'LOGIN',
            status: 'SUCCESS',
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Check last 30 days
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });

        const currentDevice = req.headers['user-agent'];
        const currentIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        // Check history (skip the log we just created)
        const previousHistory = recentLogins.slice(1);
        
        const isNewDevice = !previousHistory.some(log => log.userAgent === currentDevice);
        const isNewIp = !previousHistory.some(log => log.ipAddress === currentIp);

        if (isNewDevice || isNewIp) {
             console.log(`⚠️ Zero-Trust Alert: New Context for User ${user.email}`);
             
             // Create notification for the user
             await prisma.notification.create({
                data: {
                  userId: user.id,
                  title: 'Security Alert: New Sign-in',
                  message: `We detected a login from a new ${isNewDevice ? 'device' : 'IP address'}.\nIP: ${currentIp}\nTime: ${new Date().toLocaleString()}`,
                  type: 'security',
                },
             });
             
             // OPTIONAL: You could force MFA here if you wanted to be strict
        }
      } catch (logError) {
        console.error("Zero-Trust detection failed (non-blocking):", logError);
      }

      // Handle MFA
      if (user.mfaEnabled) {
        return res.json({
          success: true,
          requiresMFA: true,
          userId: user.id,
          message: 'MFA required'
        });
      }

      // Generate Token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      const { password: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: 'Login successful',
        data: { user: userWithoutPassword, token },
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/me', async (req, res) => {
  // ... (Your existing code for /me is fine) ...
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'No token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
    });

    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: { user } });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

/**
 * @swagger
 * /api/auth/check-email:
 *   post:
 *     summary: Check if email exists in the system
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to check
 *     responses:
 *       200:
 *         description: Email check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     exists:
 *                       type: boolean
 *                       description: Whether the email exists in the system
 *                     isActive:
 *                       type: boolean
 *                       description: Whether the account is active (only returned if exists is true)
 *                     role:
 *                       type: string
 *                       description: User role (only returned if exists is true)
 *       400:
 *         description: Bad request - Invalid email format
 */
router.post(
  '/check-email',
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { email } = req.body;

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          isActive: true,
          role: true,
        },
      });

      if (!user) {
        return res.json({
          success: true,
          data: {
            exists: false,
          },
        });
      }

      res.json({
        success: true,
        data: {
          exists: true,
          isActive: user.isActive,
          role: user.role,
        },
      });
    } catch (error) {
      console.error('Check email error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
);

// ============= OAuth Routes =============

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Initiate Google OAuth login
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth consent screen
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

/**
 * @swagger
 * /api/auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: OAuth login successful
 *       401:
 *         description: OAuth login failed
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  async (req, res) => {
    try {
      if (!req.user) {
        return res.redirect(
          `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`
        );
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: req.user.id, email: req.user.email, role: req.user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Redirect to frontend with token
      res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}&provider=google`
      );
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_error`
      );
    }
  }
);

/**
 * @swagger
 * /api/auth/facebook:
 *   get:
 *     summary: Initiate Facebook OAuth login
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect to Facebook OAuth consent screen
 */
router.get(
  '/facebook',
  passport.authenticate('facebook', {
    scope: ['email'],
  })
);

/**
 * @swagger
 * /api/auth/facebook/callback:
 *   get:
 *     summary: Facebook OAuth callback
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: OAuth login successful
 *       401:
 *         description: OAuth login failed
 */
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { session: false }),
  async (req, res) => {
    try {
      if (!req.user) {
        return res.redirect(
          `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`
        );
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: req.user.id, email: req.user.email, role: req.user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Redirect to frontend with token
      res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}&provider=facebook`
      );
    } catch (error) {
      console.error('Facebook OAuth callback error:', error);
      res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_error`
      );
    }
  }
);

/**
 * @swagger
 * /api/auth/github:
 *   get:
 *     summary: Initiate GitHub OAuth login
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect to GitHub OAuth consent screen
 */
router.get(
  '/github',
  passport.authenticate('github', {
    scope: ['user:email'],
  })
);

/**
 * @swagger
 * /api/auth/github/callback:
 *   get:
 *     summary: GitHub OAuth callback
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: OAuth login successful
 *       401:
 *         description: OAuth login failed
 */
router.get(
  '/github/callback',
  passport.authenticate('github', { session: false }),
  async (req, res) => {
    try {
      if (!req.user) {
        return res.redirect(
          `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`
        );
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: req.user.id, email: req.user.email, role: req.user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Redirect to frontend with token
      res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}&provider=github`
      );
    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_error`
      );
    }
  }
);

/**
 * @swagger
 * /api/auth/twitter:
 *   get:
 *     summary: Initiate Twitter OAuth login
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect to Twitter OAuth consent screen
 */
router.get('/twitter', passport.authenticate('twitter'));

/**
 * @swagger
 * /api/auth/twitter/callback:
 *   get:
 *     summary: Twitter OAuth callback
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: OAuth login successful
 *       401:
 *         description: OAuth login failed
 */
router.get(
  '/twitter/callback',
  passport.authenticate('twitter', { session: false }),
  async (req, res) => {
    try {
      if (!req.user) {
        return res.redirect(
          `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`
        );
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: req.user.id, email: req.user.email, role: req.user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Redirect to frontend with token
      res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}&provider=twitter`
      );
    } catch (error) {
      console.error('Twitter OAuth callback error:', error);
      res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_error`
      );
    }
  }
);

/**
 * @swagger
 * /api/auth/apple:
 *   post:
 *     summary: Apple Sign In authentication
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identityToken
 *             properties:
 *               identityToken:
 *                 type: string
 *                 description: Apple ID token from the client
 *               user:
 *                 type: object
 *                 description: User information (only provided on first sign in)
 *                 properties:
 *                   email:
 *                     type: string
 *                   name:
 *                     type: object
 *                     properties:
 *                       firstName:
 *                         type: string
 *                       lastName:
 *                         type: string
 *     responses:
 *       200:
 *         description: Apple Sign In successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Invalid Apple token
 */
router.post('/apple', async (req, res) => {
  try {
    const { identityToken, user: userInfo } = req.body;

    if (!identityToken) {
      return res.status(400).json({
        success: false,
        message: 'Identity token is required',
      });
    }

    // Handle Apple Sign In
    const user = await handleAppleSignIn(identityToken, userInfo);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: 'Apple Sign In successful',
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    console.error('Apple Sign In error:', error);
    res.status(401).json({
      success: false,
      message: 'Apple Sign In failed',
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/auth/oauth/link:
 *   post:
 *     summary: Link OAuth account to existing user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - providerId
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [google, facebook, apple, github, twitter]
 *               providerId:
 *                 type: string
 *                 description: ID from the OAuth provider
 *     responses:
 *       200:
 *         description: OAuth account linked successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: OAuth account already linked to another user
 */
router.post('/oauth/link', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { provider, providerId } = req.body;

    if (!provider || !providerId) {
      return res.status(400).json({
        success: false,
        message: 'Provider and providerId are required',
      });
    }

    if (
      !['google', 'facebook', 'apple', 'github', 'twitter'].includes(provider)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider',
      });
    }

    // Check if OAuth account is already linked to another user
    const fieldName = `${provider}Id`;
    const existingUser = await prisma.user.findFirst({
      where: {
        [fieldName]: providerId,
        id: { not: decoded.userId },
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: `This ${provider} account is already linked to another user`,
      });
    }

    // Link OAuth account to current user
    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: { [fieldName]: providerId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        googleId: true,
        facebookId: true,
        appleId: true,
        githubId: true,
        twitterId: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      message: `${provider} account linked successfully`,
      data: { user: updatedUser },
    });
  } catch (error) {
    console.error('OAuth link error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @swagger
 * /api/auth/oauth/unlink:
 *   post:
 *     summary: Unlink OAuth account from user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [google, facebook, apple, github, twitter]
 *     responses:
 *       200:
 *         description: OAuth account unlinked successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/oauth/unlink', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { provider } = req.body;

    if (!provider) {
      return res.status(400).json({
        success: false,
        message: 'Provider is required',
      });
    }

    if (
      !['google', 'facebook', 'apple', 'github', 'twitter'].includes(provider)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider',
      });
    }

    // Unlink OAuth account from current user
    const fieldName = `${provider}Id`;
    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: { [fieldName]: null },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        googleId: true,
        facebookId: true,
        appleId: true,
        githubId: true,
        twitterId: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      message: `${provider} account unlinked successfully`,
      data: { user: updatedUser },
    });
  } catch (error) {
    console.error('OAuth unlink error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

router.post('/mfa/login', async (req, res) => {
  const { userId, token } = req.body;

  try {
    if (!userId || !token) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId and token are required' 
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return res.status(400).json({ 
        success: false, 
        message: 'MFA not configured for this user' 
      });
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 2  // More tolerant for time drift
    });

    if (!verified) {
      // Enhanced logging for debugging MFA failures
      console.log(
        `[MFA-DEBUG] MFA login verification failed for userId: ${userId}`
      );
      console.log(`[MFA-DEBUG] Server time (UTC): ${new Date().toISOString()}`);
      // This helps check if the code would have been valid within the time window, hinting at a time-drift issue.
      const delta = speakeasy.totp.verifyDelta({
        secret: user.mfaSecret,
        encoding: 'base32',
        token,
        window: 2,
      });
      console.log(`[MFA-DEBUG] Verification delta:`, delta);

      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired MFA code' 
      });
    }

    // === SUCCESS: Generate JWT (same as normal login) ===
    const jwtToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Remove sensitive fields
    const { password: _, mfaSecret: __, ...safeUser } = user;

    res.json({
      success: true,
      message: 'Login successful with MFA',
      data: {
        user: safeUser,
        token: jwtToken
      }
    });

  } catch (error) {
    console.error('MFA login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

/**
 * @swagger
 * /api/auth/mfa/setup:
 *   get:
 *     summary: Generate MFA secret and QR code
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: MFA setup data
 *       401:
 *         description: Unauthorized
 */
router.get('/mfa/setup', auth, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `Rentverse (${req.user.email})`,
      length: 20
    });

    // Temporarily store secret in user record
    await prisma.user.update({
      where: { id: req.user.id },
      data: { mfaSecret: secret.base32 }
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      qrCode: qrCodeUrl,
      secret: secret.base32, // for backup
      message: 'Scan QR code with authenticator app'
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ error: 'Failed to generate MFA setup' });
  }
});

/**
 * @swagger
 * /api/auth/mfa/verify:
 *   post:
 *     summary: Verify MFA token and enable 2FA for the user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: 6-digit code from authenticator app
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: MFA enabled successfully
 *       400:
 *         description: Invalid or missing token / MFA not set up
 *       401:
 *         description: Unauthorized
 */
router.post('/mfa/verify', auth, async (req, res) => {
  const { token } = req.body;

  try {
    if (!token || token.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 6-digit code',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { mfaSecret: true },
    });

    if (!user?.mfaSecret) {
      return res.status(400).json({
        success: false,
        message: 'MFA setup not completed. Please generate a new QR code.',
      });
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 2, // Allows ±60 seconds drift (more user-friendly)
    });

    if (verified) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { mfaEnabled: true },
      });

      res.json({
        success: true,
        message: 'Two-Factor Authentication enabled successfully!',
      });
    } else {
      // Enhanced logging for debugging MFA failures
      console.log(
        `[MFA-DEBUG] MFA setup verification failed for userId: ${req.user.id}`
      );
      console.log(`[MFA-DEBUG] Server time (UTC): ${new Date().toISOString()}`);
      // This helps check if the code would have been valid within the time window, hinting at a time-drift issue.
      const delta = speakeasy.totp.verifyDelta({
        secret: user.mfaSecret,
        encoding: 'base32',
        token,
        window: 2,
      });
      console.log(`[MFA-DEBUG] Verification delta:`, delta);

      res.status(400).json({
        success: false,
        message: 'Invalid or expired code. Please try again.',
      });
    }
  } catch (error) {
    console.error('MFA verify error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed. Please try again later.',
    });
  }
});

/**
 * @swagger
 * /api/auth/mfa/disable:
 *   post:
 *     summary: Disable MFA for the current user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: MFA disabled successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/mfa/disable', auth, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    console.log(`[MFA] Disabled for user: ${req.user.id}`);
    res.json({
      success: true,
      message: 'Two-Factor Authentication has been disabled.',
    });
  } catch (error) {
    console.error('[MFA Disable] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disable MFA. Please try again later.',
    });
  }
});

module.exports = { router, auth, authorize };
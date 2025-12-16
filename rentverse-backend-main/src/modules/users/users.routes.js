const express = require('express');
const { body } = require('express-validator');
// Ensure this path matches your folder structure
const { auth, authorize } = require('../../middleware/auth'); 
const usersController = require('./users.controller');

const router = express.Router();

// ==============================================================================
// 1. SPECIFIC ROUTES (MUST BE AT THE TOP)
// ==============================================================================
// These routes must be defined BEFORE '/:id', otherwise the server will 
// mistake "logs" or "alerts" for a user ID.

// ✅ Security Logs (Admin Only)
router.get(
  '/logs', 
  auth, 
  authorize('ADMIN'), 
  usersController.getSystemLogs
);

// ✅ Security Alerts (Admin Only)
router.get(
  '/admin/alerts', 
  auth, 
  authorize('ADMIN'), 
  usersController.getSecurityAlerts
);

/**
 * @swagger
 * /api/users/profile:
 * get:
 * summary: Get current user's profile
 * tags: [Users]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: User profile retrieved successfully
 * 401:
 * description: Unauthorized
 */
router.get('/profile', auth, usersController.getProfile);

/**
 * @swagger
 * /api/users/profile:
 * patch:
 * summary: Update current user's profile
 * tags: [Users]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * firstName:
 * type: string
 * lastName:
 * type: string
 * dateOfBirth:
 * type: string
 * format: date
 * phone:
 * type: string
 * profilePicture:
 * type: string
 * responses:
 * 200:
 * description: Profile updated successfully
 * 400:
 * description: Validation errors
 * 401:
 * description: Unauthorized
 */
router.patch(
  '/profile',
  auth,
  [
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('dateOfBirth')
      .optional()
      .custom(value => {
        if (!value) return true; // Allow empty/null values
        let parsedDate;
        if (typeof value === 'string' && value.includes('T')) {
          parsedDate = new Date(value);
        } else if (typeof value === 'string') {
          parsedDate = new Date(value + 'T00:00:00.000Z');
        } else if (value instanceof Date) {
          parsedDate = value;
        } else if (typeof value === 'number') {
          parsedDate = new Date(value);
        }

        if (!parsedDate || isNaN(parsedDate.getTime())) {
          throw new Error('Invalid date format. Please use YYYY-MM-DD format or ISO-8601 DateTime string.');
        }
        return true;
      }),
    body('phone').optional().trim(),
    body('profilePicture').optional().isURL().withMessage('Profile picture must be a valid URL'),
  ],
  usersController.updateProfile
);

// ==============================================================================
// 2. GENERAL COLLECTION ROUTES
// ==============================================================================

/**
 * @swagger
 * /api/users:
 * get:
 * summary: Get all users (Admin only)
 * tags: [Users]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: query
 * name: page
 * schema:
 * type: integer
 * default: 1
 * - in: query
 * name: limit
 * schema:
 * type: integer
 * default: 10
 * - in: query
 * name: role
 * schema:
 * type: string
 * enum: [USER, ADMIN]
 * responses:
 * 200:
 * description: List of users
 * 401:
 * description: Unauthorized
 * 403:
 * description: Forbidden
 */
router.get('/', auth, authorize('ADMIN'), usersController.getAllUsers);

/**
 * @swagger
 * /api/users:
 * post:
 * summary: Create a new user (Admin only)
 * tags: [Users]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - email
 * - firstName
 * - lastName
 * - password
 * properties:
 * email:
 * type: string
 * format: email
 * firstName:
 * type: string
 * lastName:
 * type: string
 * password:
 * type: string
 * minLength: 6
 * role:
 * type: string
 * enum: [USER, ADMIN]
 * responses:
 * 201:
 * description: User created successfully
 * 400:
 * description: Validation errors
 * 401:
 * description: Unauthorized
 * 403:
 * description: Forbidden
 * 409:
 * description: User with this email already exists
 */
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('firstName').trim().notEmpty().isLength({ min: 1 }).withMessage('First name is required'),
    body('lastName').trim().notEmpty().isLength({ min: 1 }).withMessage('Last name is required'),
    body('dateOfBirth').optional().isISO8601().withMessage('Date of birth must be a valid date'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('phone').optional().trim(),
    body('role').optional().isIn(['USER', 'ADMIN']).withMessage('Role must be one of: USER, ADMIN'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  ],
  usersController.createUser
);

// ==============================================================================
// 3. ID-BASED ROUTES (MUST BE AT THE BOTTOM)
// ==============================================================================
// The '/:id' route is a "Wildcard". It matches ANYTHING.
// Any route placed below these lines will be unreachable if it starts with /api/users/

/**
 * @swagger
 * /api/users/{id}:
 * get:
 * summary: Get user by ID
 * tags: [Users]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: User details
 * 401:
 * description: Unauthorized
 * 403:
 * description: Forbidden
 * 404:
 * description: User not found
 */
router.get('/:id', auth, usersController.getUserById);

/**
 * @swagger
 * /api/users/{id}:
 * patch:
 * summary: Update user by ID (partial update)
 * tags: [Users]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * firstName:
 * type: string
 * lastName:
 * type: string
 * role:
 * type: string
 * enum: [USER, ADMIN]
 * isActive:
 * type: boolean
 * responses:
 * 200:
 * description: User updated successfully
 * 401:
 * description: Unauthorized
 * 403:
 * description: Forbidden
 * 404:
 * description: User not found
 */
router.patch(
  '/:id',
  auth,
  [
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('dateOfBirth').optional().isISO8601(),
    body('phone').optional().trim(),
    body('role').optional().isIn(['USER', 'ADMIN']),
    body('isActive').optional().isBoolean(),
  ],
  usersController.updateUser
);

/**
 * @swagger
 * /api/users/{id}:
 * delete:
 * summary: Delete user by ID (Admin only)
 * tags: [Users]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: User deleted successfully
 * 401:
 * description: Unauthorized
 * 403:
 * description: Forbidden
 * 404:
 * description: User not found
 */
router.delete('/:id', auth, authorize('ADMIN'), usersController.deleteUser);

module.exports = router;
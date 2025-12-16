const usersService = require('./users.service');
const monitoringService = require('../../services/monitoring.service');
const { validationResult } = require('express-validator');
// 👇 IMPORT PRISMA HERE so you can use it in getSystemLogs
const { prisma } = require('../../config/database'); 

class UsersController {
  async getAllUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const { role } = req.query;

      const result = await usersService.getAllUsers(page, limit, role);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  async getUserById(req, res) {
    try {
      const userId = req.params.id;

      // Check access permissions
      await usersService.checkUserAccess(userId, req.user);

      const user = await usersService.getUserById(userId);

      res.json({
        success: true,
        data: { user },
      });
    } catch (error) {
      console.error('Get user error:', error);

      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.includes('Access denied')) {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  async updateUser(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      // 👇 DEFINED VARIABLES HERE
      const userId = req.params.id;
      const updateData = req.body;

      // Perform the update
      const user = await usersService.updateUser(userId, updateData, req.user);

      // ✅ LOG: Now safe to log because variables exist
      await monitoringService.logActivity({
        userId: req.user.id, // The admin who performed the action
        action: 'UPDATE_USER',
        status: 'SUCCESS',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        details: { targetUserId: userId, updates: Object.keys(updateData) }
      });

      res.json({
        success: true,
        message: 'User updated successfully',
        data: { user },
      });
    } catch (error) {
      console.error('Update user error:', error);

      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.includes('Access denied')) {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
    

  async createUser(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array(),
        });
      }

      const userData = req.body;
      const newUser = await usersService.createUser(userData);

      // ✅ LOG: User creation
      await monitoringService.logActivity({
        userId: req.user ? req.user.id : newUser.id, 
        action: 'CREATE_USER',
        status: 'SUCCESS',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        details: { newUserId: newUser.id, role: newUser.role }
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { user: newUser },
      });
    } catch (error) {
      console.error('Create user error:', error);

      if (error.message === 'User with this email already exists') {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  async deleteUser(req, res) {
    try {
      const userId = req.params.id;

      const result = await usersService.deleteUser(userId, req.user);
      
      await monitoringService.logActivity({
        userId: req.user.id,
        action: 'DELETE_USER',
        status: 'SUCCESS',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        details: { deletedUserId: userId }
      });

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error('Delete user error:', error);

      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.includes('cannot delete')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  async getProfile(req, res) {
    try {
      const userId = req.user.id;
      const user = await usersService.getUserById(userId);

      res.json({
        success: true,
        data: { user },
      });
    } catch (error) {
      console.error('Get profile error:', error);

      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  async updateProfile(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const userId = req.user.id;
      const updateData = req.body;

      const allowedFields = [
        'firstName', 'lastName', 'dateOfBirth', 'phone', 'profilePicture',
      ];
      const profileUpdateData = {};

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          if (field === 'dateOfBirth') {
            const dateValue = updateData[field];
            if (dateValue) {
              let parsedDate;
              if (typeof dateValue === 'string' && dateValue.includes('T')) {
                parsedDate = new Date(dateValue);
              } else if (typeof dateValue === 'string') {
                parsedDate = new Date(dateValue + 'T00:00:00.000Z');
              } else if (dateValue instanceof Date) {
                parsedDate = dateValue;
              } else if (typeof dateValue === 'number') {
                parsedDate = new Date(dateValue);
              }

              if (!parsedDate || isNaN(parsedDate.getTime())) {
                throw new Error('Invalid date format.');
              }
              profileUpdateData[field] = parsedDate.toISOString();
            } else {
              profileUpdateData[field] = null;
            }
          } else {
            profileUpdateData[field] = updateData[field];
          }
        }
      });

      const user = await usersService.updateUser(userId, profileUpdateData, req.user);

      // ✅ LOG: User updated their own profile
      await monitoringService.logActivity({
        userId: userId,
        action: 'UPDATE_PROFILE',
        status: 'SUCCESS',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        details: { fieldsUpdated: Object.keys(profileUpdateData) }
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user },
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  }

  // 👇 FIXED: This must be a class method, not "exports.something ="
  async getSecurityAlerts(req, res) {
    try {
      const alerts = await prisma.securityAlert.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { email: true, name: true } 
          }
        },
        take: 50
      });

      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      console.error('Get alerts error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch alerts' });
    }
  }

  // 👇 FIXED: This must be a class method too
  async getSystemLogs(req, res) {
    try {
      const logs = await prisma.activityLog.findMany({
        take: 50, 
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { email: true, name: true, role: true } 
          }
        }
      });

      res.json(logs);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  }
}

module.exports = new UsersController();
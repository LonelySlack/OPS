// src/services/monitoring.service.js
const { prisma } = require('../config/database'); // Matches your setup

/**
 * Log an activity and check for suspicious patterns
 */
const logActivity = async ({ userId, action, status, ipAddress, userAgent, details }) => {
  try {
    // 1. Save the log
    // NOTE: Ensure your Prisma Schema has 'ActivityLog' model. 
    // If you haven't run 'npx prisma db push' yet, this might fail later.
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        status,
        ipAddress,
        userAgent,
        details: details || {}
      }
    });

    // 2. TRIGGER: Check for suspicious login patterns (Brute Force Detection)
    if (action === 'LOGIN' && status === 'FAILURE') {
      await checkBruteForce(ipAddress, userId);
    }

  } catch (error) {
    // We console log but don't throw, so we don't break the main app flow
    console.error("⚠️ Monitoring Log Error:", error.message);
  }
};

/**
 * Check if an IP has failed to login too many times recently
 */
const checkBruteForce = async (ipAddress, userId) => {
  const windowMinutes = 15;
  const maxAttempts = 5;

  try {
    // Count failed logins from this IP in the last 15 minutes
    const failedAttempts = await prisma.activityLog.count({
      where: {
        ipAddress: ipAddress,
        action: 'LOGIN',
        status: 'FAILURE',
        createdAt: {
          gte: new Date(Date.now() - windowMinutes * 60 * 1000)
        }
      }
    });

    if (failedAttempts >= maxAttempts) {
      await createAlert({
        userId,
        type: 'BRUTE_FORCE_ATTACK',
        severity: 'HIGH',
        message: `High number of failed login attempts (${failedAttempts}) detected from IP: ${ipAddress}`
      });
    }
  } catch (err) {
    console.error("⚠️ Brute Force Check Error:", err.message);
  }
};

/**
 * Create a Security Alert
 */
const createAlert = async ({ userId, type, severity, message }) => {
  console.log(`🚨 SECURITY ALERT [${severity}]: ${message}`);
  
  try {
    await prisma.securityAlert.create({
      data: {
        userId,
        type,
        severity,
        message
      }
    });
  } catch (err) {
    console.error("⚠️ Alert Creation Error:", err.message);
  }
};

module.exports = {
  logActivity,
  createAlert
};
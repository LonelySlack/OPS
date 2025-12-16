// src/services/leases.service.js
const { prisma } = require('../config/database');

const signLease = async (leaseId, signature, userId) => {
  // 1. Fetch the lease to check permissions
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId }
  });

  if (!lease) {
    throw new Error("Lease not found");
  }

  // 2. Identify who is signing
  const isTenant = lease.tenantId === userId;
  const isLandlord = lease.landlordId === userId;

  if (!isTenant && !isLandlord) {
    throw new Error("UNAUTHORIZED"); // Special error flag
  }

  // 3. Determine new status (Restoring your original logic)
  const currentTenantSigned = lease.tenantSignature !== null;
  const currentLandlordSigned = lease.landlordSignature !== null;

  // If Tenant is signing now, mark true. If they already signed, keep it true.
  const newTenantSigned = isTenant ? true : currentTenantSigned;
  const newLandlordSigned = isLandlord ? true : currentLandlordSigned;

  let newStatus = 'PENDING';
  if (newTenantSigned && newLandlordSigned) {
    newStatus = 'FULLY_SIGNED';
  } else if (newTenantSigned) {
    newStatus = 'TENANT_SIGNED';
  } else if (newLandlordSigned) {
    newStatus = 'LANDLORD_SIGNED';
  }

  // 4. Update the Database
  return await prisma.lease.update({
    where: { id: leaseId },
    data: {
      // Only update the signature for the person currently signing
      tenantSignature: isTenant ? signature : lease.tenantSignature,
      landlordSignature: isLandlord ? signature : lease.landlordSignature,
      
      // Only update the timestamp for the person currently signing
      tenantSignedAt: isTenant ? new Date() : lease.tenantSignedAt,
      landlordSignedAt: isLandlord ? new Date() : lease.landlordSignedAt,
      
      signatureStatus: newStatus,
    }
  });
};

module.exports = { signLease };
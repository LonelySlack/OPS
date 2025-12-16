// src/app/api/leases/[id]/sign/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth'; // Optional: if you need auth
// import { authOptions } from '@/lib/auth'; 

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const leaseId = params.id;
    const body = await request.json();

    // ---------------------------------------------------------
    // 🔧 CONFIGURATION: Check your Backend Port!
    // If your backend runs on port 4000, change this to 4000.
    // ---------------------------------------------------------
    const BACKEND_URL = `http://localhost:8000/api/leases/${leaseId}/sign`; // <--- DOUBLE CHECK THIS PORT

    console.log(`📨 [Next.js] Forwarding signature to: ${BACKEND_URL}`);

    // Forward the request to the Express Backend
    const backendResponse = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${token}`, // Add this if your backend needs a login token
      },
      body: JSON.stringify(body),
    });

    // Get the answer from the Backend
    const data = await backendResponse.json();

    // Pass the answer back to the UI
    return NextResponse.json(data, { status: backendResponse.status });

  } catch (error: any) {
    console.error("❌ [Next.js] Proxy Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to connect to backend server" }, 
      { status: 500 }
    );
  }
}
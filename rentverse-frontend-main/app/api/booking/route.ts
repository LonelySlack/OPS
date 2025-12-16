import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth'; // If using NextAuth
// import { authOptions } from '@/lib/auth'; 

export async function POST(request: Request) {
  try {
    // 1. Get the data from the frontend UI
    const body = await request.json();
    
    // 2. Security: Get the user's token (if you use NextAuth)
    // const session = await getServerSession(authOptions);
    // const token = session?.accessToken; 

    // 3. Forward the request to your REAL Backend (Express)
    // MAKE SURE THE PORT MATCHES YOUR BACKEND (e.g., localhost:3000, 4000, 5000, or 8080)
    const backendUrl = 'http://localhost:8000/api/bookings'; // <--- CHECK THIS PORT

    console.log("📨 [Next.js] Forwarding booking to Backend:", backendUrl);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${token}`, // specific auth header if needed
      },
      body: JSON.stringify(body),
    });

    // 4. Get the answer from the Backend
    const data = await response.json();

    // 5. Pass the answer back to the UI
    if (!response.ok) {
        return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: 200 });

  } catch (error: any) {
    console.error("❌ [Next.js] Proxy Failed:", error);
    return NextResponse.json(
      { message: 'Failed to reach backend server' }, 
      { status: 500 }
    );
  }
}
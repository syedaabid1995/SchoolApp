import { NextResponse } from 'next/server';
import { getApiBase } from '../../../../lib/getApiBase';
import axios from 'axios';

export async function POST(req: Request) {
  const API_BASE = getApiBase();
  const payload = await req.json();
  
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SchoolApp-Admin/1.0'
      }
    });

    const data = response.data;
    const nextResponse = NextResponse.json(data);

    nextResponse.cookies.set('access_token', data.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    nextResponse.cookies.set('refresh_token', data.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    if (data.mustChangePassword) {
      nextResponse.cookies.set('must_change_password', '1', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
    } else {
      nextResponse.cookies.delete('must_change_password');
    }

    return nextResponse;
  } catch (error: any) {
    console.error('Login API error:', error.message);
    
    if (error.response) {
      return new NextResponse(
        JSON.stringify(error.response.data),
        { status: error.response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new NextResponse(
      JSON.stringify({ error: { message: 'Connection failed. Please try again.' } }),
      { status: 408, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

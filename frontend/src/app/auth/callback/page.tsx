'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function AuthCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing authentication...');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      switch (error) {
        case 'authentication_failed':
          setMessage('Authentication failed. Please try again.');
          break;
        case 'server_error':
          setMessage('Server error occurred. Please try again later.');
          break;
        default:
          setMessage('An unknown error occurred.');
      }
      
      // Handle popup or direct navigation
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'AUTH_ERROR', error }, window.location.origin);
        setTimeout(() => window.close(), 2000);
      } else {
        setTimeout(() => router.push('/'), 3000);
      }
      
      return;
    }

    if (token) {
      // Store the token
      localStorage.setItem('authToken', token);
      setStatus('success');
      setMessage('Authentication successful! Redirecting...');
      
      // Handle popup or direct navigation
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'AUTH_SUCCESS', token }, window.location.origin);
        setTimeout(() => window.close(), 1000);
      } else {
        setTimeout(() => router.push('/'), 1500);
      }
    } else {
      setStatus('error');
      setMessage('No authentication token received.');
      
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'AUTH_ERROR', error: 'no_token' }, window.location.origin);
        setTimeout(() => window.close(), 2000);
      } else {
        setTimeout(() => router.push('/'), 3000);
      }
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full mx-4">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Processing...</h1>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Success!</h1>
            </>
          )}
          
          {status === 'error' && (
            <>
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
            </>
          )}
          
          <p className="text-gray-600">{message}</p>
          
          {status === 'loading' && (
            <div className="mt-4">
              <div className="animate-pulse bg-gray-200 h-2 rounded-full"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

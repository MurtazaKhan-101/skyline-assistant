'use client';

import { useState, useEffect } from 'react';
import { 
  Mail, 
  Calendar, 
  User, 
  LogIn, 
  LogOut, 
  Send,
  Search,
  Plus,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';

const API_BASE = 'http://localhost:3001';

interface User {
  _id: string;
  name: string;
  email: string;
  googleId?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

export default function HomePage() {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Gmail states
  const [emails, setEmails] = useState<any[]>([]);
  const [emailForm, setEmailForm] = useState({
    to: '',
    subject: '',
    body: '',
    isHtml: false
  });

  // Calendar states
  const [events, setEvents] = useState<any[]>([]);
  const [eventForm, setEventForm] = useState({
    summary: '',
    description: '',
    start: '',
    end: ''
  });

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      setAuth((prev: AuthState) => ({ ...prev, token }));
      checkAuth(token);
    }

    // Add axios interceptor for token expiration handling
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('authToken');
          setAuth({ isAuthenticated: false, user: null, token: null });
          showMessage('error', 'Session expired. Please login again.');
        }
        return Promise.reject(error);
      }
    );

    // Cleanup interceptor on unmount
    return () => {
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  const checkAuth = async (token: string, retryCount = 0) => {
    try {
      const response = await axios.get(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setAuth({
          isAuthenticated: true,
          user: response.data.data.user,
          token
        });
      }
    } catch (error: any) {
      console.error('Auth check failed:', error);
      
      if (error.response?.status === 401) {
        // Token is invalid
        localStorage.removeItem('authToken');
        setAuth({ isAuthenticated: false, user: null, token: null });
      } else if (retryCount < 2 && error.code === 'NETWORK_ERROR') {
        // Network error, retry up to 2 times
        setTimeout(() => checkAuth(token, retryCount + 1), 1000 * (retryCount + 1));
      } else {
        // Other errors
        localStorage.removeItem('authToken');
        setAuth({ isAuthenticated: false, user: null, token: null });
        if (error.response?.status !== 401) {
          showMessage('error', 'Failed to verify authentication. Please login again.');
        }
      }
    }
  };

  const loginWithGoogle = () => {
    const popup = window.open(
      `${API_BASE}/api/auth/google`, 
      'google-auth', 
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );
    
    // Listen for messages from the popup
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) {
        return;
      }
      
      if (event.data.type === 'AUTH_SUCCESS') {
        const { token } = event.data;
        localStorage.setItem('authToken', token);
        setAuth((prev: AuthState) => ({ ...prev, token }));
        checkAuth(token);
        showMessage('success', 'Login successful!');
        
        // Clean up
        window.removeEventListener('message', handleMessage);
        if (popup && !popup.closed) {
          popup.close();
        }
      } else if (event.data.type === 'AUTH_ERROR') {
        const { error } = event.data;
        let errorMessage = 'Authentication failed. Please try again.';
        
        switch (error) {
          case 'authentication_failed':
            errorMessage = 'Google authentication failed. Please try again.';
            break;
          case 'server_error':
            errorMessage = 'Server error occurred. Please try again later.';
            break;
          case 'no_token':
            errorMessage = 'Authentication token not received. Please try again.';
            break;
        }
        
        showMessage('error', errorMessage);
        
        // Clean up
        window.removeEventListener('message', handleMessage);
        if (popup && !popup.closed) {
          popup.close();
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Fallback: Check if popup was closed manually
    const checkClosed = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        
        // Check if token was set (in case message didn't work)
        setTimeout(() => {
          const token = localStorage.getItem('authToken');
          if (token && token !== auth.token) {
            checkAuth(token);
          }
        }, 1000);
      }
    }, 1000);
    
    // Clean up after 5 minutes
    setTimeout(() => {
      clearInterval(checkClosed);
      window.removeEventListener('message', handleMessage);
      if (popup && !popup.closed) {
        popup.close();
        showMessage('error', 'Authentication timeout. Please try again.');
      }
    }, 300000);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setAuth({ isAuthenticated: false, user: null, token: null });
    setMessage({ type: 'success', text: 'Logged out successfully' });
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  // Gmail functions
  const fetchEmails = async () => {
    if (!auth.token) {
      showMessage('error', 'Please login first');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/api/gmail/emails?maxResults=10`, {
        headers: { Authorization: `Bearer ${auth.token}` },
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data.success) {
        setEmails(response.data.data.emails);
        showMessage('success', `Fetched ${response.data.data.emails.length} emails successfully`);
      } else {
        throw new Error(response.data.message || 'Failed to fetch emails');
      }
    } catch (error: any) {
      console.error('Fetch emails error:', error);
      
      if (error.response?.status === 401) {
        showMessage('error', 'Session expired. Please login again.');
      } else if (error.response?.status === 403) {
        showMessage('error', 'Gmail access not authorized. Please reconnect your Google account.');
      } else if (error.code === 'ECONNABORTED') {
        showMessage('error', 'Request timeout. Please try again.');
      } else {
        showMessage('error', error.response?.data?.message || 'Failed to fetch emails. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async () => {
    if (!auth.token) {
      showMessage('error', 'Please login first');
      return;
    }
    
    if (!emailForm.to || !emailForm.subject || !emailForm.body) {
      showMessage('error', 'Please fill in all email fields');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailForm.to)) {
      showMessage('error', 'Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/api/gmail/send`, emailForm, {
        headers: { Authorization: `Bearer ${auth.token}` },
        timeout: 15000 // 15 second timeout for sending
      });
      
      if (response.data.success) {
        showMessage('success', 'Email sent successfully');
        setEmailForm({ to: '', subject: '', body: '', isHtml: false });
      } else {
        throw new Error(response.data.message || 'Failed to send email');
      }
    } catch (error: any) {
      console.error('Send email error:', error);
      
      if (error.response?.status === 401) {
        showMessage('error', 'Session expired. Please login again.');
      } else if (error.response?.status === 403) {
        showMessage('error', 'Gmail access not authorized. Please reconnect your Google account.');
      } else if (error.code === 'ECONNABORTED') {
        showMessage('error', 'Request timeout. Please try again.');
      } else {
        showMessage('error', error.response?.data?.message || 'Failed to send email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Calendar functions
  const fetchEvents = async () => {
    if (!auth.token) {
      showMessage('error', 'Please login first');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/api/calendar/events?maxResults=20`, {
        headers: { Authorization: `Bearer ${auth.token}` },
        timeout: 10000
      });
      
      if (response.data.success) {
        setEvents(response.data.data.events);
        showMessage('success', `Fetched ${response.data.data.events.length} events successfully`);
      } else {
        throw new Error(response.data.message || 'Failed to fetch events');
      }
    } catch (error: any) {
      console.error('Fetch events error:', error);
      
      if (error.response?.status === 401) {
        showMessage('error', 'Session expired. Please login again.');
      } else if (error.response?.status === 403) {
        showMessage('error', 'Calendar access not authorized. Please reconnect your Google account.');
      } else if (error.code === 'ECONNABORTED') {
        showMessage('error', 'Request timeout. Please try again.');
      } else {
        showMessage('error', error.response?.data?.message || 'Failed to fetch events. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async () => {
    if (!auth.token) {
      showMessage('error', 'Please login first');
      return;
    }
    
    if (!eventForm.summary || !eventForm.start || !eventForm.end) {
      showMessage('error', 'Please fill in all required event fields');
      return;
    }

    // Validate dates
    const startDate = new Date(eventForm.start);
    const endDate = new Date(eventForm.end);
    
    if (startDate >= endDate) {
      showMessage('error', 'End time must be after start time');
      return;
    }

    if (startDate < new Date()) {
      showMessage('error', 'Start time cannot be in the past');
      return;
    }
    
    setLoading(true);
    try {
      const eventData = {
        summary: eventForm.summary,
        description: eventForm.description,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      const response = await axios.post(`${API_BASE}/api/calendar/events`, eventData, {
        headers: { Authorization: `Bearer ${auth.token}` },
        timeout: 15000
      });
      
      if (response.data.success) {
        showMessage('success', 'Event created successfully');
        setEventForm({ summary: '', description: '', start: '', end: '' });
        // Refresh events list
        fetchEvents();
      } else {
        throw new Error(response.data.message || 'Failed to create event');
      }
    } catch (error: any) {
      console.error('Create event error:', error);
      
      if (error.response?.status === 401) {
        showMessage('error', 'Session expired. Please login again.');
      } else if (error.response?.status === 403) {
        showMessage('error', 'Calendar access not authorized. Please reconnect your Google account.');
      } else if (error.code === 'ECONNABORTED') {
        showMessage('error', 'Request timeout. Please try again.');
      } else {
        showMessage('error', error.response?.data?.message || 'Failed to create event. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full mx-4">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Skyline Assistant</h1>
            <p className="text-gray-600 mb-8">Your Personal AI Assistant</p>
            
            <button
              onClick={loginWithGoogle}
              className="flex items-center justify-center w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Login with Google
            </button>
            
            <p className="text-xs text-gray-500 mt-4">
              Sign in to access Gmail and Calendar features
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Skyline Assistant</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600">
                <User className="w-4 h-4 mr-2" />
                {auth.user?.name}
              </div>
              <button
                onClick={logout}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Message */}
      {message && (
        <div className={`mx-4 mt-4 p-4 rounded-lg flex items-center ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 mr-2" />
          ) : (
            <AlertCircle className="w-5 h-5 mr-2" />
          )}
          {message.text}
        </div>
      )}

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: User },
              { id: 'gmail', label: 'Gmail', icon: Mail },
              { id: 'calendar', label: 'Calendar', icon: Calendar },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Welcome, {auth.user?.name}!</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Gmail Integration</h3>
                  <p className="text-gray-600 text-sm mb-3">
                    Access and manage your Gmail messages
                  </p>
                  <button
                    onClick={() => setActiveTab('gmail')}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Go to Gmail →
                  </button>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Calendar Integration</h3>
                  <p className="text-gray-600 text-sm mb-3">
                    Manage your calendar events and appointments
                  </p>
                  <button
                    onClick={() => setActiveTab('calendar')}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Go to Calendar →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gmail' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Gmail</h2>
                <button
                  onClick={fetchEmails}
                  disabled={loading}
                  className="flex items-center bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {loading ? 'Loading...' : 'Fetch Emails'}
                </button>
              </div>
              
              {emails.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium">Recent Emails</h3>
                  {emails.slice(0, 5).map((email: any, index: number) => (
                    <div key={index} className="border rounded p-3">
                      <div className="font-medium text-sm">
                        {email.payload?.headers?.find((h: any) => h.name === 'Subject')?.value || 'No Subject'}
                      </div>
                      <div className="text-xs text-gray-600">
                        From: {email.payload?.headers?.find((h: any) => h.name === 'From')?.value || 'Unknown'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Send Email Form */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Send Email</h3>
              <div className="space-y-4">
                <input
                  type="email"
                  placeholder="To"
                  value={emailForm.to}
                  onChange={(e) => setEmailForm((prev) => ({ ...prev, to: e.target.value }))}
                  className="w-full p-3 border rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Subject"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm((prev) => ({ ...prev, subject: e.target.value }))}
                  className="w-full p-3 border rounded-lg"
                />
                <textarea
                  placeholder="Message"
                  rows={6}
                  value={emailForm.body}
                  onChange={(e) => setEmailForm((prev) => ({ ...prev, body: e.target.value }))}
                  className="w-full p-3 border rounded-lg"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={emailForm.isHtml}
                      onChange={(e) => setEmailForm((prev) => ({ ...prev, isHtml: e.target.checked }))}
                      className="mr-2"
                    />
                    HTML Email
                  </label>
                  <button
                    onClick={sendEmail}
                    disabled={loading}
                    className="flex items-center bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {loading ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Calendar</h2>
                <button
                  onClick={fetchEvents}
                  disabled={loading}
                  className="flex items-center bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {loading ? 'Loading...' : 'Fetch Events'}
                </button>
              </div>
              
              {events.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium">Upcoming Events</h3>
                  {events.slice(0, 5).map((event: any, index: number) => (
                    <div key={index} className="border rounded p-3">
                      <div className="font-medium text-sm">{event.summary}</div>
                      <div className="text-xs text-gray-600">
                        {event.start?.dateTime ? new Date(event.start.dateTime).toLocaleString() : 'All day'}
                      </div>
                      {event.description && (
                        <div className="text-xs text-gray-500 mt-1">{event.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create Event Form */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Create Event</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Event Title"
                  value={eventForm.summary}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, summary: e.target.value }))}
                  className="w-full p-3 border rounded-lg"
                />
                <textarea
                  placeholder="Description (optional)"
                  rows={3}
                  value={eventForm.description}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full p-3 border rounded-lg"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <input
                      type="datetime-local"
                      value={eventForm.start}
                      onChange={(e) => setEventForm((prev) => ({ ...prev, start: e.target.value }))}
                      className="w-full p-3 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input
                      type="datetime-local"
                      value={eventForm.end}
                      onChange={(e) => setEventForm((prev) => ({ ...prev, end: e.target.value }))}
                      className="w-full p-3 border rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={createEvent}
                    disabled={loading}
                    className="flex items-center bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {loading ? 'Creating...' : 'Create Event'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
